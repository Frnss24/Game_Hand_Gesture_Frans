import type { Beat, HitCircle, HandCursor, HitResult } from "@/types/game";
import { GAME_CONFIG } from "./constants";

// Beat filtering configuration for beginner-friendly gameplay
const BEAT_FILTER_CONFIG = {
  MIN_INTENSITY: 0.6, // Only keep beats with intensity >= 60% (strong beats)
  MIN_GAP_MS: 600, // Minimum 600ms (0.6s) between circles
} as const;

/**
 * Generate hit circles from beat timestamps
 */
export function generateHitCircles(
  beats: Beat[],
  canvasWidth: number,
  canvasHeight: number,
): HitCircle[] {
  const margin = GAME_CONFIG.HIT_CIRCLE_RADIUS * 2;

  console.log(`[BEAT FILTER] Starting with ${beats.length} raw beats`);

  // Step 1: Filter by approach time (must have enough time before beat)
  let filteredBeats = beats.filter(
    (beat) => beat.timestamp >= GAME_CONFIG.APPROACH_TIME,
  );
  console.log(
    `[BEAT FILTER] After time filter: ${filteredBeats.length} beats (removed ${beats.length - filteredBeats.length} early beats)`,
  );

  // Step 2: Filter by intensity - only keep strong beats
  const beforeIntensityFilter = filteredBeats.length;
  filteredBeats = filteredBeats.filter(
    (beat) => beat.intensity >= BEAT_FILTER_CONFIG.MIN_INTENSITY,
  );
  console.log(
    `[BEAT FILTER] After intensity filter (>=${BEAT_FILTER_CONFIG.MIN_INTENSITY}): ${filteredBeats.length} beats (removed ${beforeIntensityFilter - filteredBeats.length} weak beats)`,
  );

  // Step 3: Ensure minimum time gap between circles
  // Sort by timestamp first
  filteredBeats.sort((a, b) => a.timestamp - b.timestamp);

  const spacedBeats: Beat[] = [];
  let lastTimestamp = -Infinity;

  for (const beat of filteredBeats) {
    if (beat.timestamp - lastTimestamp >= BEAT_FILTER_CONFIG.MIN_GAP_MS) {
      spacedBeats.push(beat);
      lastTimestamp = beat.timestamp;
    }
  }

  console.log(
    `[BEAT FILTER] After spacing filter (>=${BEAT_FILTER_CONFIG.MIN_GAP_MS}ms): ${spacedBeats.length} beats (removed ${filteredBeats.length - spacedBeats.length} closely-spaced beats)`,
  );
  console.log(
    `[BEAT FILTER] ✅ Final reduction: ${beats.length} → ${spacedBeats.length} (${Math.round((spacedBeats.length / beats.length) * 100)}% kept, ${100 - Math.round((spacedBeats.length / beats.length) * 100)}% filtered)`,
  );

  if (spacedBeats.length === 0) {
    console.warn("[BEAT FILTER] ⚠️ No beats passed all filters!");
    return [];
  }

  // Generate circles from filtered beats
  return spacedBeats.map((beat, index) => ({
    id: index,
    x: margin + Math.random() * (canvasWidth - margin * 2),
    y: margin + Math.random() * (canvasHeight - margin * 2),
    radius: GAME_CONFIG.HIT_CIRCLE_RADIUS,
    beatTimestamp: beat.timestamp,
    spawnTime: beat.timestamp - GAME_CONFIG.APPROACH_TIME,
    isVisible: false,
    isHit: false,
  }));
}

/**
 * Check hit detection between hand cursor and circle
 */
export function checkHit(
  cursor: HandCursor,
  circle: HitCircle,
  currentTime: number,
): HitResult | null {
  if (!cursor.isTracking || circle.isHit) return null;

  // Check collision
  const dx = cursor.x - circle.x;
  const dy = cursor.y - circle.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > circle.radius + GAME_CONFIG.HAND_CURSOR_RADIUS) {
    return null; // No collision
  }

  // Calculate timing difference
  const timingDiff = Math.abs(currentTime - circle.beatTimestamp);

  // Determine hit result based on timing windows
  if (timingDiff < GAME_CONFIG.TIMING_WINDOWS.PERFECT) {
    return {
      type: "perfect",
      points: GAME_CONFIG.SCORE_VALUES.PERFECT,
      maintainCombo: true,
    };
  } else if (timingDiff < GAME_CONFIG.TIMING_WINDOWS.GOOD) {
    return {
      type: "good",
      points: GAME_CONFIG.SCORE_VALUES.GOOD,
      maintainCombo: true,
    };
  } else if (timingDiff < GAME_CONFIG.TIMING_WINDOWS.BAD) {
    return {
      type: "bad",
      points: GAME_CONFIG.SCORE_VALUES.BAD,
      maintainCombo: false,
    };
  }

  return null; // Too early or too late
}

/**
 * Calculate score with combo multiplier
 */
export function calculateScore(basePoints: number, combo: number): number {
  let multiplier = 1.0;

  for (const tier of GAME_CONFIG.COMBO_MULTIPLIERS) {
    if (combo >= tier.minCombo) {
      multiplier = tier.multiplier;
      break;
    }
  }

  return Math.floor(basePoints * multiplier);
}

/**
 * Check if circle should be marked as miss
 */
export function checkMiss(circle: HitCircle, currentTime: number): boolean {
  return (
    !circle.isHit &&
    currentTime > circle.beatTimestamp + GAME_CONFIG.TIMING_WINDOWS.BAD
  );
}

/**
 * Calculate accuracy percentage
 */
export function calculateAccuracy(
  perfectHits: number,
  goodHits: number,
  badHits: number,
  missCount: number,
): number {
  const totalNotes = perfectHits + goodHits + badHits + missCount;
  if (totalNotes === 0) return 100;

  const weightedScore =
    perfectHits * 300 + goodHits * 100 + badHits * 50 + missCount * 0;
  const maxScore = totalNotes * 300;

  return Math.round((weightedScore / maxScore) * 100);
}

/**
 * Get grade based on accuracy
 */
export function getGrade(accuracy: number): string {
  if (accuracy >= 95) return "S";
  if (accuracy >= 90) return "A";
  if (accuracy >= 80) return "B";
  if (accuracy >= 70) return "C";
  return "D";
}
