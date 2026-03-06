export const GAME_CONFIG = {
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,
  HIT_CIRCLE_RADIUS: 60, // Increased from 50 - bigger target!
  HAND_CURSOR_RADIUS: 25, // Increased from 20 - easier collision
  APPROACH_TIME: 3000, // Increased from 2000ms - 3 seconds to prepare
  TIMING_WINDOWS: {
    PERFECT: 100, // Doubled from 50ms - much more forgiving
    GOOD: 250, // Increased from 150ms - very generous
    BAD: 400, // Increased from 300ms - super forgiving
  },
  SCORE_VALUES: {
    PERFECT: 300,
    GOOD: 100,
    BAD: 50,
    MISS: 0,
  },
  COMBO_MULTIPLIERS: [
    { minCombo: 50, multiplier: 2.5 },
    { minCombo: 20, multiplier: 2.0 },
    { minCombo: 10, multiplier: 1.5 },
    { minCombo: 0, multiplier: 1.0 },
  ],
} as const;
