import type { Beat, AnalysisResult } from "@/types/game";

/**
 * Analyze audio file for BPM and beat detection
 * Supports: MP3, M4A, Opus, WAV, OGG
 * @param file - Audio file from user upload
 * @param onProgress - Callback for progress updates (0-100)
 * @returns Promise with BPM and beat timestamps
 */
export async function analyzeAudioFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<AnalysisResult> {
  try {
    // Step 1: Convert file to AudioBuffer (10%)
    onProgress?.(10);
    const audioContext = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    onProgress?.(30);

    // Extract mono audio data
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    onProgress?.(40);

    // Step 2: Detect BPM using simple peak detection algorithm
    // (Essentia.js might not work directly in browser, so we'll use a simplified approach)
    const bpm = await detectBPM(audioData, sampleRate);

    onProgress?.(60);

    // Step 3: Detect beat positions using onset detection
    const beats = await detectBeats(audioData, sampleRate, bpm);

    onProgress?.(90);

    // Close audio context to free resources
    await audioContext.close();

    onProgress?.(100);

    return {
      bpm: Math.round(bpm),
      beats,
      duration: audioBuffer.duration,
    };
  } catch (error) {
    console.error("Audio analysis failed:", error);

    // Check if it's a decoding error (unsupported format)
    if (error instanceof DOMException && error.name === "EncodingError") {
      throw new Error(
        "Audio format not supported by your browser. Please try MP3, M4A, or WAV format.",
      );
    }

    throw new Error(
      "Failed to analyze audio. Please ensure the file is a valid audio file (MP3, M4A, Opus, WAV, or OGG).",
    );
  }
}

/**
 * Detect BPM using autocorrelation and energy analysis
 */
async function detectBPM(
  audioData: Float32Array,
  sampleRate: number,
): Promise<number> {
  // Calculate energy in chunks
  const chunkSize = Math.floor(sampleRate * 0.1); // 100ms chunks
  const energies: number[] = [];

  for (let i = 0; i < audioData.length; i += chunkSize) {
    let energy = 0;
    const end = Math.min(i + chunkSize, audioData.length);
    for (let j = i; j < end; j++) {
      energy += audioData[j] * audioData[j];
    }
    energies.push(energy / (end - i));
  }

  // Find peaks in energy
  const peaks: number[] = [];
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
      const threshold = Math.max(...energies) * 0.3;
      if (energies[i] > threshold) {
        peaks.push(i);
      }
    }
  }

  // Calculate intervals between peaks
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  // Find most common interval (mode)
  if (intervals.length === 0) return 120; // Default BPM

  const intervalCounts = new Map<number, number>();
  intervals.forEach((interval) => {
    intervalCounts.set(interval, (intervalCounts.get(interval) || 0) + 1);
  });

  let mostCommonInterval = intervals[0];
  let maxCount = 0;
  intervalCounts.forEach((count, interval) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommonInterval = interval;
    }
  });

  // Convert interval to BPM
  const beatsPerChunk = 1 / mostCommonInterval;
  const chunksPerSecond = 1000 / (chunkSize / sampleRate);
  const beatsPerSecond = beatsPerChunk * chunksPerSecond;
  const bpm = beatsPerSecond * 60;

  // Clamp to reasonable range
  return Math.max(60, Math.min(200, bpm));
}

/**
 * Detect beat timestamps using onset detection
 */
async function detectBeats(
  audioData: Float32Array,
  sampleRate: number,
  bpm: number,
): Promise<Beat[]> {
  const beats: Beat[] = [];

  // Calculate spectral flux for onset detection
  const hopSize = 512;
  const frameSize = 2048;
  const numFrames = Math.floor((audioData.length - frameSize) / hopSize);

  const previousSpectrum: number[] = new Array(frameSize / 2).fill(0);
  const onsetStrength: number[] = [];

  for (let i = 0; i < numFrames; i++) {
    const offset = i * hopSize;
    const frame = audioData.slice(offset, offset + frameSize);

    // Simple FFT approximation using energy in frequency bands
    const spectrum: number[] = [];
    const numBands = frameSize / 2;

    for (let band = 0; band < numBands; band++) {
      let energy = 0;
      const startIdx = Math.floor((band / numBands) * frameSize);
      const endIdx = Math.floor(((band + 1) / numBands) * frameSize);

      for (let j = startIdx; j < endIdx && j < frame.length; j++) {
        energy += frame[j] * frame[j];
      }
      spectrum.push(Math.sqrt(energy));
    }

    // Calculate spectral flux (difference from previous frame)
    let flux = 0;
    for (let band = 0; band < spectrum.length; band++) {
      const diff = Math.max(0, spectrum[band] - previousSpectrum[band]);
      flux += diff;
    }
    onsetStrength.push(flux);

    // Update previous spectrum
    previousSpectrum.splice(0, previousSpectrum.length, ...spectrum);
  }

  // Find peaks in onset strength
  const threshold =
    onsetStrength.reduce((a, b) => a + b, 0) / onsetStrength.length;
  const adaptiveThreshold = threshold * 2;

  for (let i = 1; i < onsetStrength.length - 1; i++) {
    if (
      onsetStrength[i] > onsetStrength[i - 1] &&
      onsetStrength[i] > onsetStrength[i + 1] &&
      onsetStrength[i] > adaptiveThreshold
    ) {
      const timestamp = (i * hopSize * 1000) / sampleRate;
      const intensity = Math.min(
        1.0,
        onsetStrength[i] / (adaptiveThreshold * 2),
      );

      beats.push({ timestamp, intensity });
    }
  }

  // If too few beats detected, generate beats based on BPM
  if (beats.length < 10) {
    const beatInterval = (60 / bpm) * 1000; // ms per beat
    const duration = (audioData.length / sampleRate) * 1000;
    const numBeats = Math.floor(duration / beatInterval);

    beats.length = 0; // Clear array
    for (let i = 0; i < numBeats; i++) {
      beats.push({
        timestamp: i * beatInterval,
        intensity: 1.0,
      });
    }
  }

  return beats;
}
