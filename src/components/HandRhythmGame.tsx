"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Script from "next/script";
import Link from "next/link";
import type { HitCircle, HandCursor, Particle } from "@/types/game";
import { analyzeAudioFile } from "@/lib/essentiaAnalyzer";
import {
  generateHitCircles,
  checkHit,
  calculateScore,
  checkMiss,
  calculateAccuracy,
  getGrade,
} from "@/lib/gameEngine";
import {
  drawHitCircle,
  drawHandCursor,
  drawHitFeedback,
  drawParticles,
  createBurstParticles,
} from "@/lib/renderer";
import { GAME_CONFIG } from "@/lib/constants";

// Define MediaPipe types
declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

interface HitFeedbackItem {
  x: number;
  y: number;
  result: "perfect" | "good" | "bad" | "miss";
  alpha: number;
  id: number;
}

const HandRhythmGame: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // MediaPipe refs
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const multiHandLandmarksRef = useRef<any[]>([]);
  const videoImageRef = useRef<any>(null); // Store latest video frame

  // Game state
  const [gameState, setGameState] = useState<
    "menu" | "loading" | "playing" | "paused" | "results"
  >("menu");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

  // Audio analysis state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [bpm, setBpm] = useState(0);

  // MediaPipe loading
  const [areScriptsLoaded, setAreScriptsLoaded] = useState(false);

  // Game refs (for performance)
  const hitCirclesRef = useRef<HitCircle[]>([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const hitFeedbacksRef = useRef<HitFeedbackItem[]>([]);
  const gameStateRef = useRef<typeof gameState>("menu");

  // Stats refs
  const perfectHitsRef = useRef(0);
  const goodHitsRef = useRef(0);
  const badHitsRef = useRef(0);
  const missCountRef = useRef(0);

  // Script loading tracking
  const scriptsLoadedRef = useRef({
    hands: false,
    camera: false,
    drawing: false,
  });

  // Update gameStateRef when gameState changes
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // File upload handler
  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      alert("Please upload a valid audio file (MP3, WAV, etc.)");
      return;
    }

    setGameState("loading");
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      const result = await analyzeAudioFile(file, (progress) => {
        setAnalysisProgress(progress);
      });

      setBpm(result.bpm);
      setAudioFile(file);

      // Generate hit circles
      const circles = generateHitCircles(
        result.beats,
        GAME_CONFIG.CANVAS_WIDTH,
        GAME_CONFIG.CANVAS_HEIGHT,
      );
      hitCirclesRef.current = circles;

      // DEBUG: Log circle generation
      console.log(
        `✅ Generated ${circles.length} circles from ${result.beats.length} beats`,
      );
      console.log(
        "First 3 circles:",
        circles.slice(0, 3).map((c) => ({
          id: c.id,
          spawnTime: c.spawnTime,
          beatTimestamp: c.beatTimestamp,
          isVisible: c.isVisible,
        })),
      );
      const negativeSpawns = circles.filter((c) => c.spawnTime < 0);
      if (negativeSpawns.length > 0) {
        console.warn(
          `⚠️ ${negativeSpawns.length} circles have NEGATIVE spawn times!`,
          negativeSpawns.slice(0, 3),
        );
      }

      // Set audio element
      if (audioRef.current) {
        const audioUrl = URL.createObjectURL(file);
        audioRef.current.src = audioUrl;
      }

      setGameState("menu");
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Failed to analyze audio. Please try another file.");
      setGameState("menu");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Start game
  const startGame = () => {
    if (hitCirclesRef.current.length === 0) {
      alert("Please upload and analyze an audio file first!");
      return;
    }

    // DEBUG: Log game start
    console.log(
      "🎮 Starting game with",
      hitCirclesRef.current.length,
      "circles",
    );
    console.log("Audio duration:", audioRef.current?.duration, "seconds");

    // Reset game state
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    perfectHitsRef.current = 0;
    goodHitsRef.current = 0;
    badHitsRef.current = 0;
    missCountRef.current = 0;

    setScore(0);
    setCombo(0);
    setMaxCombo(0);

    // Reset circles
    hitCirclesRef.current.forEach((circle) => {
      circle.isVisible = false;
      circle.isHit = false;
      circle.hitResult = undefined;
    });

    particlesRef.current = [];
    hitFeedbacksRef.current = [];

    // Start audio
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .catch((e) => console.error("Audio play error:", e));
    }

    console.log("🎵 Audio started, game loop will begin");
    setGameState("playing");
  };

  // Get hand cursor positions for all detected hands
  const getHandCursors = useCallback((): HandCursor[] => {
    if (
      !multiHandLandmarksRef.current ||
      multiHandLandmarksRef.current.length === 0
    ) {
      return [];
    }

    // Return cursors for all detected hands
    return multiHandLandmarksRef.current.map((landmarks, index) => {
      const indexFingerTip = landmarks[8]; // Index finger tip

      return {
        x: (1 - indexFingerTip.x) * GAME_CONFIG.CANVAS_WIDTH,
        y: indexFingerTip.y * GAME_CONFIG.CANVAS_HEIGHT,
        isTracking: true,
        handIndex: index,
      };
    });
  }, []);

  // Game loop
  useEffect(() => {
    if (gameStateRef.current !== "playing") return;

    let animationFrameId: number;
    let feedbackIdCounter = 0;

    const gameLoop = () => {
      if (!canvasRef.current || !audioRef.current) return;

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      // Current audio time (source of truth)
      const currentTime = audioRef.current.currentTime * 1000; // to ms

      // Clear canvas and render video feed as background
      ctx.clearRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);

      // Draw video feed mirrored
      if (videoImageRef.current) {
        ctx.save();
        ctx.translate(GAME_CONFIG.CANVAS_WIDTH, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(
          videoImageRef.current,
          0,
          0,
          GAME_CONFIG.CANVAS_WIDTH,
          GAME_CONFIG.CANVAS_HEIGHT,
        );
        ctx.restore();
      }

      // DEBUG: Log visibility updates (only first 10 frames)
      if (animationFrameId < 10) {
        const visibleCount = hitCirclesRef.current.filter(
          (c) => c.isVisible,
        ).length;
        console.log(
          `Frame ${animationFrameId}: Time=${currentTime.toFixed(0)}ms, Visible=${visibleCount}/${hitCirclesRef.current.length}`,
        );
      }

      // Update circle visibility
      hitCirclesRef.current.forEach((circle) => {
        if (currentTime >= circle.spawnTime && !circle.isHit) {
          if (!circle.isVisible) {
            console.log(
              `[VISIBILITY] Circle ${circle.id} NOW VISIBLE at time ${currentTime.toFixed(0)}ms (spawnTime: ${circle.spawnTime})`,
            );
          }
          circle.isVisible = true;
        }

        // Check miss
        if (checkMiss(circle, currentTime) && !circle.isHit) {
          circle.isHit = true;
          circle.hitResult = "miss";
          comboRef.current = 0;
          setCombo(0);
          missCountRef.current += 1;

          // Add miss feedback
          hitFeedbacksRef.current.push({
            x: circle.x,
            y: circle.y,
            result: "miss",
            alpha: 1.0,
            id: feedbackIdCounter++,
          });
        }
      });

      // Check hits with all detected hands
      const handCursors = getHandCursors();

      hitCirclesRef.current.forEach((circle) => {
        if (!circle.isHit && circle.isVisible) {
          // Check collision with any hand
          for (const cursor of handCursors) {
            const hitResult = checkHit(cursor, circle, currentTime);

            if (hitResult) {
              circle.isHit = true;
              circle.hitResult = hitResult.type;

              // Update stats
              if (hitResult.type === "perfect") perfectHitsRef.current += 1;
              else if (hitResult.type === "good") goodHitsRef.current += 1;
              else if (hitResult.type === "bad") badHitsRef.current += 1;

              // Update score
              const points = calculateScore(hitResult.points, comboRef.current);
              scoreRef.current += points;
              setScore(scoreRef.current);

              // Update combo
              if (hitResult.maintainCombo) {
                comboRef.current += 1;
                setCombo(comboRef.current);

                if (comboRef.current > maxComboRef.current) {
                  maxComboRef.current = comboRef.current;
                  setMaxCombo(maxComboRef.current);
                }
              } else {
                comboRef.current = 0;
                setCombo(0);
              }

              // Create particles
              const color =
                hitResult.type === "perfect"
                  ? "#FFD700"
                  : hitResult.type === "good"
                    ? "#06B6D4"
                    : "#9CA3AF";
              const newParticles = createBurstParticles(
                circle.x,
                circle.y,
                color,
              );
              particlesRef.current.push(...newParticles);

              // Add hit feedback
              hitFeedbacksRef.current.push({
                x: circle.x,
                y: circle.y,
                result: hitResult.type,
                alpha: 1.0,
                id: feedbackIdCounter++,
              });

              break; // Stop checking other hands for this circle
            }
          }
        }
      });

      // Update particles
      particlesRef.current = particlesRef.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          life: p.life - 0.02,
        }))
        .filter((p) => p.life > 0);

      // Update hit feedbacks
      hitFeedbacksRef.current = hitFeedbacksRef.current
        .map((f) => ({
          ...f,
          alpha: f.alpha - 0.02,
        }))
        .filter((f) => f.alpha > 0);

      // Render
      const circlesToDraw = hitCirclesRef.current.filter(
        (c) => c.isVisible && !c.isHit,
      );
      console.log(
        `[RENDER LOOPS] Total circles: ${hitCirclesRef.current.length}, Visible: ${circlesToDraw.length}, currentTime: ${currentTime.toFixed(0)}ms`,
      );

      hitCirclesRef.current.forEach((circle) => {
        drawHitCircle(ctx, circle, currentTime);
      });

      // Draw all hand cursors (no need to redeclare, use from earlier)
      handCursors.forEach((cursor: HandCursor) => {
        drawHandCursor(ctx, cursor);
      });

      drawParticles(ctx, particlesRef.current);

      hitFeedbacksRef.current.forEach((feedback) => {
        drawHitFeedback(
          ctx,
          feedback.x,
          feedback.y,
          feedback.result,
          feedback.alpha,
        );
      });

      // Check if song ended
      if (audioRef.current.ended) {
        setGameState("results");
        return;
      }

      // Continue loop
      if (gameStateRef.current === "playing") {
        animationFrameId = requestAnimationFrame(gameLoop);
      }
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [getHandCursors, gameState]); // Updated to getHandCursors

  // MediaPipe initialization
  const initializeMediaPipe = useCallback(() => {
    if (handsRef.current) return;

    console.log("Initializings MediaPipe...");
    const { Hands, Camera } = window;

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
      maxNumHands: 2, // Support both hands
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
  }, []);

  const onResults = useCallback((results: any) => {
    // Only update landmarks and store video frame, NO RENDERING HERE
    // All rendering happens in game loop for proper synchronization

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      multiHandLandmarksRef.current = results.multiHandLandmarks;
    } else {
      multiHandLandmarksRef.current = [];
    }

    // Store the video frame for rendering in game loop
    if (results.image) {
      videoImageRef.current = results.image;
      // Only log once every 60 frames to avoid spam
      if (Math.random() < 0.016) {
        console.log(
          "[ON_RESULTS] Video frame stored, size:",
          results.image.width,
          "x",
          results.image.height,
        );
      }
    } else {
      console.warn("[ON_RESULTS] No video image in results");
    }
  }, []);

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

  // Cleanup
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

  // Calculate final stats
  const accuracy = calculateAccuracy(
    perfectHitsRef.current,
    goodHitsRef.current,
    badHitsRef.current,
    missCountRef.current,
  );
  const grade = getGrade(accuracy);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
      <div className="grain-overlay" />
      <div className="orbit-glow left-[-120px] top-[-140px] h-[300px] w-[300px] bg-[#20d4b2]/30" />
      <div className="orbit-glow right-[-150px] top-[12%] h-[330px] w-[330px] bg-[#ff7a18]/24" />

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

      {gameState === "playing" && (
        <div className="glass-panel absolute left-1/2 top-6 z-20 flex -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-2xl px-4 py-3 sm:gap-6 sm:px-8">
          <div className="flex items-center gap-2 text-lg font-bold tracking-[0.12em] text-white sm:text-2xl">
            SCORE
            <span className="title-display text-2xl text-[#9df0df] sm:text-3xl">
              {score}
            </span>
          </div>
          <div className="hidden h-8 w-px self-center bg-white/20 sm:block" />
          <div className="flex items-center gap-2 text-lg font-bold tracking-[0.12em] text-white sm:text-2xl">
            COMBO
            <span className="title-display text-2xl text-[#ffd166] sm:text-3xl">
              {combo}x
            </span>
          </div>
        </div>
      )}

      {gameState === "menu" && !isAnalyzing && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl">
          {areScriptsLoaded ? (
            <div className="glass-panel mx-4 max-w-3xl rounded-3xl p-8 text-center sm:p-12">
              <h1 className="title-display mb-7 text-5xl text-[#f4fbff] sm:text-7xl">
                Hand Rhythm
              </h1>

              <div className="mb-8 space-y-4 text-base font-light text-[#c4d8e3] sm:text-lg">
                <p>
                  Sentuh note dengan
                  <span className="mx-1 font-bold text-[#20d4b2]">
                    index finger
                  </span>
                  tepat saat beat tiba.
                </p>
                <p className="text-sm text-[#94a9b5]">
                  Rhythm challenge dengan input gerakan tangan real-time.
                </p>
              </div>

              {audioFile && bpm > 0 ? (
                <div className="space-y-6">
                  <div className="rounded-xl border border-[#20d4b2]/45 bg-[#20d4b2]/10 px-5 py-3">
                    <p className="text-sm font-semibold tracking-wide text-[#bff6eb] sm:text-base">
                      Audio analyzed: {bpm} BPM | {hitCirclesRef.current.length} beats detected
                    </p>
                  </div>
                  <button
                    onClick={startGame}
                    className="cta-btn px-8 py-4 text-base sm:px-10 sm:text-lg"
                  >
                    START GAME
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <label className="cta-btn inline-flex cursor-pointer items-center justify-center px-8 py-4 text-sm sm:px-10 sm:text-base">
                    <input
                      type="file"
                      accept=".mp3,.m4a,.opus,.wav,.ogg,audio/mpeg,audio/mp4,audio/opus,audio/wav,audio/ogg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    UPLOAD MUSIC
                  </label>
                  <p className="text-sm text-[#94a9b5]">
                    Supported: MP3, M4A, Opus, WAV, OGG
                  </p>
                </div>
              )}
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

      {gameState === "loading" && isAnalyzing && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl">
          <div className="glass-panel relative mx-4 max-w-md rounded-3xl p-8 text-center sm:p-12">
            <h2 className="title-display mb-6 text-3xl text-white sm:text-4xl">
              Analyzing Audio...
            </h2>
            <div className="mb-4 h-4 w-full overflow-hidden rounded-full bg-[#172a3a]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#20d4b2] to-[#ff7a18] transition-all duration-300"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <p className="title-display text-xl text-[#ffd166]">
              {analysisProgress}%
            </p>
            <p className="mt-4 text-sm text-[#9ab0bc]">
              Detecting BPM and beat positions...
            </p>
          </div>
        </div>
      )}

      {gameState === "results" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="glass-panel group relative mx-4 max-w-2xl overflow-hidden rounded-3xl border-[#20d4b2]/55 p-8 text-center sm:p-10">
            <div className="absolute inset-0 bg-[#20d4b2]/10 opacity-0 blur-xl transition-opacity duration-700 group-hover:opacity-100" />
            <h1 className="title-display relative z-10 mb-6 text-7xl text-[#ffd166] sm:text-8xl">
              {grade}
            </h1>
            <div className="relative z-10 mb-8 space-y-3 text-lg text-[#cfdde6] sm:mb-10 sm:text-2xl">
              <p>
                Score: <span className="text-white font-bold">{score}</span>
              </p>
              <p>
                Accuracy: <span className="font-bold text-[#9df0df]">{accuracy}%</span>
              </p>
              <p>
                Max Combo: <span className="font-bold text-[#ffd166]">{maxCombo}x</span>
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 sm:gap-4 sm:text-lg">
                <div className="rounded-lg border border-[#ffd166]/40 bg-[#ffd166]/10 p-3">
                  <div className="font-bold text-[#ffd166]">
                    {perfectHitsRef.current}
                  </div>
                  <div className="text-xs text-[#9ab0bc]">PERFECT</div>
                </div>
                <div className="rounded-lg border border-[#20d4b2]/40 bg-[#20d4b2]/10 p-3">
                  <div className="font-bold text-[#9df0df]">
                    {goodHitsRef.current}
                  </div>
                  <div className="text-xs text-[#9ab0bc]">GOOD</div>
                </div>
                <div className="rounded-lg border border-[#7f95a1]/35 bg-[#243748]/35 p-3">
                  <div className="font-bold text-[#ccd8e0]">{badHitsRef.current}</div>
                  <div className="text-xs text-[#9ab0bc]">BAD</div>
                </div>
                <div className="rounded-lg border border-[#ff9b81]/40 bg-[#ff9b81]/10 p-3">
                  <div className="font-bold text-[#ffaf99]">
                    {missCountRef.current}
                  </div>
                  <div className="text-xs text-[#9ab0bc]">MISS</div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setGameState("menu")}
              className="cta-btn relative z-10 px-9 py-4 text-base sm:px-12 sm:text-lg"
            >
              BACK TO MENU
            </button>
          </div>
        </div>
      )}

      <video ref={videoRef} className="hidden" playsInline />
      <audio ref={audioRef} />

      <div className="relative w-full max-w-[1280px] rounded-3xl p-[3px]">
        <div className="absolute -inset-1 rounded-[30px] bg-gradient-to-r from-[#20d4b2]/40 via-[#ffd166]/30 to-[#ff7a18]/40 blur-lg" />

        <div className="glass-panel relative overflow-hidden rounded-[24px] border border-white/10 bg-[#08141f]">
          <canvas
            ref={canvasRef}
            width={GAME_CONFIG.CANVAS_WIDTH}
            height={GAME_CONFIG.CANVAS_HEIGHT}
            className="block h-auto max-h-[78vh] w-full object-contain"
          />

          <div className="pointer-events-none absolute left-3 top-3 h-12 w-12 rounded-tl-xl border-l-4 border-t-4 border-[#20d4b2]/55 sm:left-4 sm:top-4 sm:h-16 sm:w-16" />
          <div className="pointer-events-none absolute right-3 top-3 h-12 w-12 rounded-tr-xl border-r-4 border-t-4 border-[#ff7a18]/55 sm:right-4 sm:top-4 sm:h-16 sm:w-16" />
          <div className="pointer-events-none absolute bottom-3 left-3 h-12 w-12 rounded-bl-xl border-b-4 border-l-4 border-[#20d4b2]/55 sm:bottom-4 sm:left-4 sm:h-16 sm:w-16" />
          <div className="pointer-events-none absolute bottom-3 right-3 h-12 w-12 rounded-br-xl border-b-4 border-r-4 border-[#ff7a18]/55 sm:bottom-4 sm:right-4 sm:h-16 sm:w-16" />
        </div>
      </div>
    </div>
  );
};

export default HandRhythmGame;
