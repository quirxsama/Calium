import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { execFile, spawn } from "child_process";
import core from "shazamio-core";
import { fetchTrackMetadata, searchAnimeTheme } from "./animethemes";

export type RecognizedSong = {
  title: string;
  artist: string;
  coverUrl: string | null;
  spotifyUrl: string;
};

export type RecognitionResult =
  | { found: true; song: RecognizedSong }
  | { found: false };

/**
 * Extract audio segment using ffmpeg to a temporary WAV file
 */
export async function extractAudioSegmentToFile(
  streamUrl: string,
  startSec: number,
  durationSec: number,
  timeoutMs = 15000
): Promise<string> {
  const tempPath = path.join(
    os.tmpdir(),
    `calium-intro-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`
  );

  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-nostdin",
      "-loglevel",
      "error",
      "-ss",
      String(Math.max(0, startSec)),
      "-t",
      String(durationSec),
      "-i",
      streamUrl,
      "-vn",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-f",
      "wav",
      tempPath,
    ];

    const proc = spawn("ffmpeg", args);
    let errorOutput = "";

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
      reject(new Error(`ffmpeg timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stderr.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(tempPath)) {
        resolve(tempPath);
      } else {
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {}
        reject(new Error(`ffmpeg exited with code ${code}: ${errorOutput}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
      reject(err);
    });
  });
}

/**
 * Extract audio segment using ffmpeg from stream URL as Buffer
 */
export async function extractAudioSegment(
  streamUrl: string,
  startSec: number,
  durationSec: number,
  timeoutMs = 12000
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-nostdin",
      "-loglevel",
      "error",
      "-ss",
      String(Math.max(0, startSec)),
      "-t",
      String(durationSec),
      "-i",
      streamUrl,
      "-vn",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-f",
      "wav",
      "pipe:1",
    ];

    const proc = spawn("ffmpeg", args);
    const chunks: Buffer[] = [];
    let errorOutput = "";

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`ffmpeg timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${errorOutput}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Recognize song using native songrec CLI
 */
export async function recognizeWithSongrec(
  filePath: string
): Promise<RecognizedSong | null> {
  return new Promise((resolve) => {
    execFile(
      "songrec",
      ["audio-file-to-recognized-song", filePath],
      { timeout: 15000 },
      async (error, stdout) => {
        if (error) {
          return resolve(null);
        }
        try {
          const data = JSON.parse(stdout);
          const track = data.track;
          if (track && (track.title || track.heading?.title)) {
            const rawTitle = (track.title || track.heading?.title || "").trim();
            let artist = (track.subtitle || track.heading?.subtitle || "").trim();
            let coverUrl =
              track.images?.coverart ||
              track.images?.coverarthq ||
              track.share?.image ||
              null;

            // Verify with Deezer & iTunes to get official artist & HD cover art (cleans up cover artists)
            const meta = await fetchTrackMetadata(rawTitle, artist);
            const title = meta.title || rawTitle;
            if (meta.artist) artist = meta.artist;
            if (meta.coverUrl) coverUrl = meta.coverUrl;

            const searchQuery = [artist, title].filter(Boolean).join(" ");
            const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(searchQuery)}`;

            return resolve({
              title,
              artist,
              coverUrl,
              spotifyUrl,
            });
          }
          return resolve(null);
        } catch {
          return resolve(null);
        }
      }
    );
  });
}

type ShazamResponse = {
  track?: {
    title?: string;
    subtitle?: string;
    heading?: {
      title?: string;
      subtitle?: string;
    };
    images?: {
      coverart?: string;
      coverarthq?: string;
    };
    share?: {
      image?: string;
    };
  };
};

interface ShazamSignature {
  uri?: string;
  samplems?: number;
  free?: () => void;
}

/**
 * Send Shazam signature to Shazam discovery endpoint
 */
async function sendSignatureToShazam(
  sigUri: string,
  samplems: number
): Promise<ShazamResponse> {
  const uuid1 = crypto.randomUUID();
  const uuid2 = crypto.randomUUID();
  const endpoint = `https://amp.shazam.com/discovery/v5/en-US/US/web/-/tag/${uuid1}/${uuid2}`;

  const payload = {
    geolocation: { altitude: 300, latitude: 45, longitude: 2 },
    signature: {
      samplems: samplems || 8000,
      timestamp: Date.now(),
      uri: sigUri,
    },
    timestamp: Date.now(),
    timezone: "Europe/Istanbul",
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Shazam API responded with status ${res.status}`);
  }

  return (await res.json()) as ShazamResponse;
}

/**
 * Recognize song from raw audio buffer with iTunes validation
 */
export async function recognizeAudioBuffer(
  audioBuffer: Buffer,
  durationSec: number
): Promise<RecognizedSong | null> {
  let signatures: ShazamSignature[] = [];
  try {
    signatures = (core.recognizeBytes(
      new Uint8Array(audioBuffer),
      0,
      durationSec
    ) ?? []) as unknown as ShazamSignature[];

    if (!signatures || signatures.length === 0) {
      return null;
    }

    for (const sig of signatures) {
      try {
        const uri = sig.uri;
        const samplems = sig.samplems ?? 8000;
        if (!uri) continue;

        const data = await sendSignatureToShazam(uri, samplems);
        const track = data?.track;

        if (track && (track.title || track.heading?.title)) {
          const rawTitle = (track.title || track.heading?.title || "").trim();
          let artist = (track.subtitle || track.heading?.subtitle || "").trim();
          let coverUrl =
            track.images?.coverart ||
            track.images?.coverarthq ||
            track.share?.image ||
            null;

          // Verify with Deezer & iTunes to get official artist & HD cover art
          const meta = await fetchTrackMetadata(rawTitle, artist);
          const title = meta.title || rawTitle;
          if (meta.artist) artist = meta.artist;
          if (meta.coverUrl) coverUrl = meta.coverUrl;

          const searchQuery = [artist, title].filter(Boolean).join(" ");
          const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(searchQuery)}`;

          return {
            title,
            artist,
            coverUrl,
            spotifyUrl,
          };
        }
      } catch (e) {
        console.error("[Shazam] Error sending signature:", e);
      }
    }

    return null;
  } finally {
    if (Array.isArray(signatures)) {
      for (const sig of signatures) {
        try {
          if (typeof sig.free === "function") {
            sig.free();
          }
        } catch {
          // ignore free error
        }
      }
    }
  }
}

/**
 * Multi-layer recognition:
 * Tier 1: AnimeThemes Official Theme API
 * Tier 2: songrec CLI with vocal offset windows (0s, 12s, 20s) + iTunes verification
 * Tier 3: shazamio-core WebAssembly fallback
 */
export async function recognizeIntroSong(
  streamUrl: string,
  introStartSec = 0,
  animeName?: string,
  episodeNum?: number
): Promise<RecognitionResult> {
  // 1. TIER 1: Resmi Anime Tema API'si (AnimeThemes + iTunes)
  if (animeName && animeName.trim()) {
    try {
      console.log(
        `[IntroSong] Tier 1: Checking official AnimeThemes for '${animeName}' ep=${episodeNum}`
      );
      const officialSong = await searchAnimeTheme(animeName, episodeNum);
      if (officialSong) {
        console.log(
          `[IntroSong] Tier 1 Found official song: ${officialSong.title} by ${officialSong.artist}`
        );
        return { found: true, song: officialSong };
      }
    } catch (err) {
      console.warn("[IntroSong] Tier 1 error:", err);
    }
  }

  // 2. TIER 2: songrec CLI (İntronun 14 saniye sonrasından başlayarak vokali yakalar)
  const baseStart = introStartSec + 14;
  const offsets = [0, 8, 16]; // 14s, 22s, 30s
  const duration = 12;

  for (const offset of offsets) {
    let tempFile: string | null = null;
    try {
      const sampleStart = baseStart + offset;
      console.log(
        `[IntroSong] Tier 2 (songrec): Sampling stream at ${sampleStart}s (intro+${14 + offset}s, duration=${duration}s)`
      );
      tempFile = await extractAudioSegmentToFile(
        streamUrl,
        sampleStart,
        duration
      );

      const song = await recognizeWithSongrec(tempFile);
      if (song) {
        console.log(
          `[IntroSong] Tier 2 (songrec) Found song: ${song.title} by ${song.artist}`
        );
        return { found: true, song };
      }
    } catch (err) {
      console.warn(`[IntroSong] Tier 2 (offset ${14 + offset}s) error:`, err);
    } finally {
      if (tempFile) {
        try {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch {}
      }
    }
  }

  // 3. TIER 3: shazamio-core fallback (İntro + 14s'den başlayarak 8s, 16s, 24s)
  const durations = [8, 16, 24];
  for (const dur of durations) {
    try {
      console.log(
        `[IntroSong] Tier 3 (shazamio-core): Attempting start=${baseStart}s (intro+14s), duration=${dur}s`
      );
      const audioBuffer = await extractAudioSegment(
        streamUrl,
        baseStart,
        dur
      );
      const song = await recognizeAudioBuffer(audioBuffer, dur);
      if (song) {
        console.log(
          `[IntroSong] Tier 3 Found song: ${song.title} by ${song.artist}`
        );
        return { found: true, song };
      }
    } catch (err) {
      console.warn(`[IntroSong] Tier 3 error (${dur}s):`, err);
    }
  }

  console.log("[IntroSong] No song recognized across all tiers.");
  return { found: false };
}
