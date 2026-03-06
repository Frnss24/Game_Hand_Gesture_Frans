import type { HitCircle, HandCursor, Particle } from "@/types/game";
import { GAME_CONFIG } from "./constants";

/**
 * Draw hit circle with approach circle animation
 */
export function drawHitCircle(
  ctx: CanvasRenderingContext2D,
  circle: HitCircle,
  currentTime: number,
) {
  // DEBUG: Log every circle render attempt
  const shouldDraw = circle.isVisible && !circle.isHit;

  console.log(
    `[DRAW] Circle ${circle.id}: visible=${circle.isVisible}, hit=${circle.isHit}, shouldDraw=${shouldDraw}, spawnTime=${circle.spawnTime}, currentTime=${currentTime}`,
  );

  if (!circle.isVisible || circle.isHit) return;

  // Calculate approach circle progress
  const timeSinceSpawn = currentTime - circle.spawnTime;
  const progress = Math.min(timeSinceSpawn / GAME_CONFIG.APPROACH_TIME, 1);

  // Approach circle (outer ring): shrinks from 3x to 1x
  const approachRadius = circle.radius * (3 - 2 * progress);

  console.log(
    `[DRAW] Circle ${circle.id} RENDERING at (${circle.x}, ${circle.y}), progress=${progress.toFixed(2)}, approachRadius=${approachRadius.toFixed(1)}`,
  );

  ctx.save();

  // Draw approach circle (white outer ring)
  ctx.beginPath();
  ctx.arc(circle.x, circle.y, approachRadius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Draw hit circle (green inner circle)
  ctx.beginPath();
  ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(34, 197, 94, 0.8)"; // Green
  ctx.shadowColor = "rgba(34, 197, 94, 0.6)";
  ctx.shadowBlur = 15;
  ctx.fill();

  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw hand cursor (index finger indicator)
 */
export function drawHandCursor(
  ctx: CanvasRenderingContext2D,
  cursor: HandCursor,
) {
  if (!cursor.isTracking) return;

  ctx.save();

  // Outer glow
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, GAME_CONFIG.HAND_CURSOR_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(34, 211, 238, 0.3)"; // Cyan glow
  ctx.shadowColor = "cyan";
  ctx.shadowBlur = 20;
  ctx.fill();

  // Inner cursor
  ctx.beginPath();
  ctx.arc(
    cursor.x,
    cursor.y,
    GAME_CONFIG.HAND_CURSOR_RADIUS / 2,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = "white";
  ctx.fill();

  ctx.restore();
}

/**
 * Draw visual feedback for hit result
 */
export function drawHitFeedback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  result: "perfect" | "good" | "bad" | "miss",
  alpha: number, // 0-1, for fade out animation
) {
  const colors = {
    perfect: "#FFD700", // Gold
    good: "#06B6D4", // Cyan
    bad: "#9CA3AF", // Gray
    miss: "#EF4444", // Red
  };

  const texts = {
    perfect: "PERFECT!",
    good: "GOOD!",
    bad: "BAD",
    miss: "MISS",
  };

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.font = "bold 48px sans-serif";
  ctx.fillStyle = colors[result];
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = colors[result];
  ctx.shadowBlur = 10;

  ctx.fillText(texts[result], x, y - 80);

  ctx.restore();
}

/**
 * Draw particle effects
 */
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
) {
  particles.forEach((particle) => {
    ctx.save();
    ctx.globalAlpha = particle.life;

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.restore();
  });
}

/**
 * Create burst particles for hit effect
 */
export function createBurstParticles(
  x: number,
  y: number,
  color: string,
  count: number = 20,
): Particle[] {
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 2 + Math.random() * 3;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      color,
    });
  }

  return particles;
}
