"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Script from "next/script";
import Link from "next/link";

// Define minimal types for what we use from global window objects
declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

interface Circle {
  x: number;
  y: number;
  radius: number;
  color: string;
  id: number;
  type: "score" | "killer" | "gold";
  speed: number;
}

const HandTrackingGame: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Game State
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [areScriptsLoaded, setAreScriptsLoaded] = useState(false);
  const [isBuffActive, setIsBuffActive] = useState(false);
  const [buffTimeLeft, setBuffTimeLeft] = useState(0);

  // Refs
  const scoreRef = useRef(0);
  const livesRef = useRef(5);
  const gameOverRef = useRef(false);
  const gameStartedRef = useRef(false);
  const circlesRef = useRef<Circle[]>([]);
  const lastSpawnTime = useRef<number>(0);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const multiHandLandmarksRef = useRef<any[]>([]);
  const trailsRef = useRef<{ [key: number]: { x: number; y: number }[] }>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Buff System Refs
  const buffSystemRef = useRef({
    active: false,
    endTime: 0,
  });

  // Track loaded scripts
  const scriptsLoadedRef = useRef({
    hands: false,
    camera: false,
    drawing: false,
  });

  // Initialize Audio
  useEffect(() => {
    audioRef.current = new Audio("/backsound.mp3");
    audioRef.current.loop = true;
    audioRef.current.volume = 0.5;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // --- Game Loop Helpers Defined First to avoid "Used before defined" ---

  const drawCircles = (ctx: CanvasRenderingContext2D) => {
    for (const circle of circlesRef.current) {
      ctx.save();

      // -- Motion Trail (Neon Tail) --
      const trailLength = circle.radius * 4;

      // Create gradient from circle center upwards
      const gradient = ctx.createLinearGradient(
        circle.x,
        circle.y,
        circle.x,
        circle.y - trailLength,
      );

      // Start with circle color (faded slightly), end with transparent
      gradient.addColorStop(0, circle.color);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      // Draw the trail as a rectangle/path behind the circle
      ctx.beginPath();
      ctx.fillStyle = gradient;
      // Width slightly smaller than diameter for a tapered look or same width
      ctx.rect(
        circle.x - circle.radius,
        circle.y - trailLength,
        circle.radius * 2,
        trailLength,
      );
      ctx.fill();

      // -- Main Circle --
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI);
      ctx.fillStyle = circle.color;

      // Neon Glow Effect
      ctx.shadowColor = circle.color;
      ctx.shadowBlur = circle.type === "gold" ? 40 : 20;

      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  };

  const activateBuff = () => {
    if (buffSystemRef.current.active) return; // Prevent stacking/extension

    buffSystemRef.current.active = true;
    buffSystemRef.current.endTime = performance.now() + 10000; // 10 seconds
    setIsBuffActive(true);

    // Convert ALL existing circles to GOLD
    circlesRef.current.forEach((circle) => {
      circle.type = "gold";
      circle.color = "rgba(255, 215, 0, 0.9)";
    });
  };

  const spawnCircle = (canvasWidth: number) => {
    const baseInterval = 1000;
    const decreasePer10Points = 50;
    const interval = Math.max(
      400,
      baseInterval - Math.floor(scoreRef.current / 10) * decreasePer10Points,
    );

    const now = performance.now();
    if (now - lastSpawnTime.current > interval) {
      let type: "score" | "killer" | "gold" = "score";

      if (buffSystemRef.current.active) {
        type = "gold"; // Force gold during buff
      } else {
        const rand = Math.random();
        if (rand > 0.98)
          type = "gold"; // 2% chance for gold
        else if (rand > 0.3) type = "score";
        else type = "killer";
      }

      const radius = 25;
      const y = -radius;
      const x = Math.random() * (canvasWidth - 2 * radius) + radius;

      const baseSpeed = 3;
      const speed = baseSpeed + Math.floor(scoreRef.current / 50) * 0.5;

      let color = "rgba(34, 197, 94, 0.8)"; // Green
      if (type === "killer") color = "rgba(239, 68, 68, 0.8)"; // Red
      if (type === "gold") color = "rgba(255, 215, 0, 0.9)"; // Gold

      const newCircle: Circle = {
        x,
        y,
        radius,
        color,
        id: now,
        type,
        speed,
      };

      circlesRef.current.push(newCircle);
      lastSpawnTime.current = now;
    }
  };

  const handleGameOver = () => {
    gameOverRef.current = true;
    setGameOver(true);
    setGameStarted(false);
    gameStartedRef.current = false;
    buffSystemRef.current.active = false;
    setIsBuffActive(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const updateGameLogic = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    // Check Buff Expiration
    if (buffSystemRef.current.active) {
      const remaining = buffSystemRef.current.endTime - performance.now();
      if (remaining <= 0) {
        buffSystemRef.current.active = false;
        setIsBuffActive(false);
        setBuffTimeLeft(0);
      } else {
        setBuffTimeLeft(Math.ceil(remaining / 1000));
      }
    }

    spawnCircle(width);

    // Get fingertips for ALL detected hands
    const fingertips: { x: number; y: number }[] = [];
    if (
      multiHandLandmarksRef.current &&
      multiHandLandmarksRef.current.length > 0
    ) {
      for (const landmarks of multiHandLandmarksRef.current) {
        const indexFingerTip = landmarks[8];
        if (indexFingerTip) {
          fingertips.push({
            x: (1 - indexFingerTip.x) * width,
            y: indexFingerTip.y * height,
          });
        }
      }
    }

    // Draw interaction points & Trails
    // First, update trails
    const currentFrameFingertips: { [key: number]: { x: number; y: number } } =
      {};

    if (
      multiHandLandmarksRef.current &&
      multiHandLandmarksRef.current.length > 0
    ) {
      multiHandLandmarksRef.current.forEach((landmarks, index) => {
        const indexFingerTip = landmarks[8];
        if (indexFingerTip) {
          const x = (1 - indexFingerTip.x) * width;
          const y = indexFingerTip.y * height;
          currentFrameFingertips[index] = { x, y };

          // Add to trail
          if (!trailsRef.current[index]) trailsRef.current[index] = [];
          trailsRef.current[index].push({ x, y });

          // Limit trail length
          if (trailsRef.current[index].length > 20) {
            trailsRef.current[index].shift();
          }
        }
      });
    } else {
      // Clear trails if no hands detected (optional, or let them fade)
      trailsRef.current = {};
    }

    // Render Trails (Lightsaber Interaction)
    Object.keys(trailsRef.current).forEach((key) => {
      const handIndex = parseInt(key);
      const trail = trailsRef.current[handIndex];

      if (trail.length < 2) return;

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Glow Color based on Buff
      const glowColor = buffSystemRef.current.active
        ? "rgba(255, 215, 0, 0.8)"
        : "rgba(0, 255, 255, 0.8)";
      const coreColor = "white";

      // Draw Glow (Outer Beam)
      ctx.shadowBlur = 20;
      ctx.shadowColor = glowColor;
      ctx.lineWidth = 15;
      ctx.strokeStyle = glowColor;

      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) {
        // Quadratic curve for smoother lines could be used, but simple lineTo is fast
        ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.stroke();

      // Draw Core (Inner Beam)
      ctx.shadowBlur = 10;
      ctx.shadowColor = "white";
      ctx.lineWidth = 6;
      ctx.strokeStyle = coreColor;
      ctx.stroke(); // Re-stroke path with inner core

      ctx.restore();
    });

    // Draw fingertip highlight
    for (const tip of fingertips) {
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = "white";
      ctx.shadowColor = buffSystemRef.current.active ? "gold" : "cyan";
      ctx.shadowBlur = 15;
      ctx.fill();
    }

    const survivingCircles: Circle[] = [];

    for (const circle of circlesRef.current) {
      circle.y += circle.speed;

      let hit = false;
      let offScreen = false;

      if (circle.y - circle.radius > height) {
        offScreen = true;
        // In Buff mode, or if gold, no penalty
        if (circle.type === "score" && !buffSystemRef.current.active) {
          livesRef.current -= 1;
          setLives(livesRef.current);

          if (livesRef.current <= 0) {
            handleGameOver();
          }
        }
      }

      if (!offScreen) {
        for (const tip of fingertips) {
          const dx = tip.x - circle.x;
          const dy = tip.y - circle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < circle.radius + 15) {
            hit = true;
            break;
          }
        }

        if (hit) {
          if (circle.type === "score") {
            scoreRef.current += 10;
            setScore(scoreRef.current);
          } else if (circle.type === "gold") {
            scoreRef.current += 20; // 2x points for gold (Green is 10)
            setScore(scoreRef.current);
            if (!buffSystemRef.current.active) {
              activateBuff();
            }
          } else {
            // Killer logic
            if (!buffSystemRef.current.active) {
              handleGameOver();
            }
          }
        }
      }

      if (!hit && !offScreen) {
        survivingCircles.push(circle);
      } else if (
        hit &&
        circle.type === "killer" &&
        !buffSystemRef.current.active
      ) {
        survivingCircles.push(circle);
      }
    }

    if (!gameOverRef.current) {
      circlesRef.current = survivingCircles;
    }

    drawCircles(ctx);
  };

  const onResults = useCallback((results: any) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvasCtx = canvasRef.current.getContext("2d");
    if (!canvasCtx) return;

    const { drawConnectors, drawLandmarks, HAND_CONNECTIONS } = window;

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, width, height);

    // Draw Video Feed mirrored
    canvasCtx.translate(width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, width, height);

    // Draw Hand Landmarks
    if (results.multiHandLandmarks) {
      multiHandLandmarksRef.current = results.multiHandLandmarks;
      for (const landmarks of results.multiHandLandmarks) {
        if (drawConnectors && HAND_CONNECTIONS) {
          drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
            color: "#00FF00",
            lineWidth: 5,
          });
        }
        if (drawLandmarks) {
          drawLandmarks(canvasCtx, landmarks, {
            color: "#FF0000",
            lineWidth: 2,
          });
        }
      }
    } else {
      multiHandLandmarksRef.current = [];
    }

    canvasCtx.restore();

    if (gameStartedRef.current && !gameOverRef.current) {
      updateGameLogic(canvasCtx, width, height);
    } else if (gameOverRef.current) {
      drawCircles(canvasCtx);
    }
  }, []); // Dependencies are mostly game logic which uses refs

  // --- Initialization ---

  const initializeMediaPipe = useCallback(() => {
    if (handsRef.current) return;

    console.log("Initializing MediaPipe...");
    const { Hands, Camera, HAND_CONNECTIONS } = window;

    if (!Hands || !Camera) {
      console.error("MediaPipe classes not found on window");
      return;
    }

    const hands = new Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    handsRef.current = hands;

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onResults);

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && handsRef.current) {
            await handsRef.current.send({ image: videoRef.current });
          }
        },
        width: 1280,
        height: 720,
      });
      camera.start();
      cameraRef.current = camera;
    }
  }, [onResults]);

  const checkScriptsLoaded = useCallback(() => {
    if (
      scriptsLoadedRef.current.hands &&
      scriptsLoadedRef.current.camera &&
      scriptsLoadedRef.current.drawing
    ) {
      setAreScriptsLoaded(true);
      initializeMediaPipe();
    }
  }, [initializeMediaPipe]);

  useEffect(() => {
    return () => {
      if (cameraRef.current) {
        // cameraRef.current.stop();
      }
      if (handsRef.current) {
        handsRef.current.close();
      }
    };
  }, []);

  const startGame = () => {
    setScore(0);
    setLives(5);
    setGameOver(false);
    setGameStarted(true);
    setIsBuffActive(false);

    scoreRef.current = 0;
    livesRef.current = 5;
    gameOverRef.current = false;
    gameStartedRef.current = true;
    circlesRef.current = [];
    lastSpawnTime.current = performance.now();
    buffSystemRef.current = { active: false, endTime: 0 };

    // Play Music
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .catch((e) => console.error("Audio play error:", e));
    }
  };

  return (
    <div className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
      <div className="grain-overlay" />
      <div className="orbit-glow left-[-110px] top-[-130px] h-[290px] w-[290px] bg-[#20d4b2]/30" />
      <div className="orbit-glow right-[-150px] top-[14%] h-[320px] w-[320px] bg-[#ff7a18]/26" />

      {/* Scripts */}
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log("Camera Utils loaded");
          scriptsLoadedRef.current.camera = true;
          checkScriptsLoaded();
        }}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log("Hands loaded");
          scriptsLoadedRef.current.hands = true;
          checkScriptsLoaded();
        }}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log("Drawing Utils loaded");
          scriptsLoadedRef.current.drawing = true;
          checkScriptsLoaded();
        }}
      />

      <div className="absolute left-4 top-4 z-30 sm:left-6 sm:top-6">
        <Link
          href="/"
          className="hud-chip inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#ffd9bb] transition hover:border-[#ffd166]/60 hover:text-[#ffe4ca]"
        >
          Back
          <span aria-hidden>Home</span>
        </Link>
      </div>

      <div
        className="absolute left-1/2 top-6 z-20 flex -translate-x-1/2 flex-col items-center gap-2 transition-all duration-500"
      >
        {isBuffActive && (
          <div className="title-display text-3xl font-black tracking-[0.12em] text-[#ffd166] drop-shadow-[0_0_14px_rgba(255,209,102,0.7)] animate-pulse sm:text-4xl">
            BUFF: {buffTimeLeft}s
          </div>
        )}
        <div
          className={`glass-panel flex flex-wrap items-center justify-center gap-3 rounded-2xl px-4 py-3 transition-all duration-500 sm:gap-6 sm:px-7 ${isBuffActive ? "border-[#ffd166]/70 bg-[#523711]/50" : ""}`}
        >
          <div className="flex items-center gap-2 text-lg font-bold tracking-[0.12em] text-white sm:text-2xl">
            SCORE
            <span
              className={`title-display text-2xl sm:text-3xl ${isBuffActive ? "text-[#ffe08f]" : "text-[#9df0df]"}`}
            >
              {score}
            </span>
          </div>
          <div className="hidden h-8 w-px self-center bg-white/20 sm:block" />
          <div className="flex items-center gap-2 text-lg font-bold tracking-[0.12em] text-white sm:text-2xl">
            LIVES
            <span className="title-display text-[#ff9b81]">
              {"♥".repeat(lives)}
            </span>
          </div>
        </div>
      </div>

      {gameOver && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="glass-panel group relative mx-4 max-w-2xl overflow-hidden rounded-3xl border-[#ff8f70]/50 p-8 text-center sm:p-10">
            <div className="absolute inset-0 bg-[#ff7a18]/10 opacity-0 blur-xl transition-opacity duration-700 group-hover:opacity-100" />
            <h1 className="title-display relative z-10 mb-3 text-6xl font-black tracking-[-0.04em] text-[#ffd166] sm:text-8xl">
              GAME OVER
            </h1>
            <p className="relative z-10 mb-8 text-2xl font-light tracking-wide text-[#d6e4ec] sm:mb-10 sm:text-4xl">
              Final Score: <span className="text-white font-bold">{score}</span>
            </p>
            <button
              onClick={startGame}
              className="cta-btn relative z-10 px-9 py-4 text-lg sm:px-12 sm:text-2xl"
            >
              RETRY
            </button>
          </div>
        </div>
      )}

      {!gameStarted && !gameOver && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl">
          {areScriptsLoaded ? (
            <div className="glass-panel relative mx-4 max-w-2xl rounded-3xl p-8 text-center sm:p-12">
              <h1 className="title-display mb-7 text-5xl text-[#f4fbff] sm:text-7xl">
                Hand Slicer
              </h1>
              <div className="mb-9 space-y-4 text-base font-light text-[#c4d8e3] sm:text-lg">
                <p>
                  Gunakan
                  <span className="mx-1 font-bold text-[#20d4b2]">
                    index finger
                  </span>
                  untuk menebas orb
                  <span className="mx-1 font-bold text-[#9bf2dc]">hijau</span>.
                </p>
                <p>
                  Hindari orb
                  <span className="mx-1 font-bold text-[#ff9b81]">merah</span>
                  dan aktifkan orb emas untuk buff.
                </p>
                <p className="border-t border-white/10 pt-4 text-sm text-[#94a9b5]">
                  Mendukung single hand maupun dual hand tracking.
                </p>
              </div>

              <button
                onClick={startGame}
                className="cta-btn px-8 py-4 text-base sm:px-10 sm:text-lg"
              >
                START MISSION
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <div className="relative h-24 w-24">
                <div className="absolute inset-0 animate-ping rounded-full border-4 border-[#20d4b2]/30" />
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-[#ff7a18] border-t-transparent" />
              </div>
              <p className="title-display text-lg tracking-[0.18em] text-[#cfe2eb] sm:text-xl">
                INITIALIZING SYSTEMS...
              </p>
            </div>
          )}
        </div>
      )}

      <video ref={videoRef} className="hidden" playsInline></video>

      <div className="relative w-full max-w-[1280px] rounded-3xl p-[3px]">
        <div className="absolute -inset-1 rounded-[30px] bg-gradient-to-r from-[#20d4b2]/40 via-[#ffd166]/30 to-[#ff7a18]/40 blur-lg" />
        <div className="glass-panel relative overflow-hidden rounded-[24px] border border-white/10 bg-[#08141f]">
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            className="block h-auto max-h-[78vh] w-full object-contain"
          ></canvas>

          <div className="pointer-events-none absolute left-3 top-3 h-12 w-12 rounded-tl-xl border-l-4 border-t-4 border-[#20d4b2]/55 sm:left-4 sm:top-4 sm:h-16 sm:w-16" />
          <div className="pointer-events-none absolute right-3 top-3 h-12 w-12 rounded-tr-xl border-r-4 border-t-4 border-[#ff7a18]/55 sm:right-4 sm:top-4 sm:h-16 sm:w-16" />
          <div className="pointer-events-none absolute bottom-3 left-3 h-12 w-12 rounded-bl-xl border-b-4 border-l-4 border-[#20d4b2]/55 sm:bottom-4 sm:left-4 sm:h-16 sm:w-16" />
          <div className="pointer-events-none absolute bottom-3 right-3 h-12 w-12 rounded-br-xl border-b-4 border-r-4 border-[#ff7a18]/55 sm:bottom-4 sm:right-4 sm:h-16 sm:w-16" />
        </div>
      </div>
    </div>
  );
};

export default HandTrackingGame;
