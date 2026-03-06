export interface Beat {
  timestamp: number; // in milliseconds
  intensity: number; // 0.0 to 1.0
}

export interface HitCircle {
  id: number;
  x: number;
  y: number;
  radius: number;
  beatTimestamp: number; // Target hit time (ms)
  spawnTime: number; // Spawn time (ms)
  isVisible: boolean;
  isHit: boolean;
  hitResult?: "perfect" | "good" | "bad" | "miss";
}

export interface HandCursor {
  x: number;
  y: number;
  isTracking: boolean;
  handIndex: number; // 0 for first hand, 1 for second hand
}

export interface HitResult {
  type: "perfect" | "good" | "bad" | "miss";
  points: number;
  maintainCombo: boolean;
}

export interface GameStats {
  state: "menu" | "loading" | "playing" | "paused" | "results";
  score: number;
  combo: number;
  maxCombo: number;
  accuracy: number;
  totalHits: number;
  perfectHits: number;
  goodHits: number;
  badHits: number;
  missCount: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0.0 to 1.0
  color: string;
}

export interface AnalysisResult {
  bpm: number;
  beats: Beat[];
  duration: number; // total audio duration in seconds
}
