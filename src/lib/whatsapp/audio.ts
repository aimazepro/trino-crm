// Audio conversion for WhatsApp attachments.
//
// Two different targets, because the phone and the browser want opposite things:
//
// WhatsApp voice notes are Opus in Ogg and nothing else — an AAC blob is
// accepted by the provider, delivered, and then renders on the phone as a note
// with no waveform and a 0:00 length. That is `toVoiceNote`.
//
// What we keep in storage and play back in the thread has to satisfy every
// browser instead, and Opus fails that test twice over: Safari plays neither
// WebM nor Ogg, and a WebM straight out of MediaRecorder carries no Duration in
// its header, so Chrome loads it and still shows "0:00 / 0:00" with a dead
// seek bar. AAC in mp4 is the one audio format all of them play, and ffmpeg
// writes a real duration into it. That is `toPlayable`.

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmodSync, existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

/** Bitrate WhatsApp's own voice notes use; higher is wasted on speech. */
const OPUS_BITRATE = "32k";
/** AAC needs more than Opus for the same speech, and still lands well under the original. */
const AAC_BITRATE = "64k";
const TIMEOUT_MS = 30_000;

export interface ConvertedAudio {
  data: Buffer;
  mimetype: string;
  /** Extension the caller should store the file under, so the two never drift. */
  extension: string;
}

/** @deprecated name kept for callers; use ConvertedAudio. */
export type VoiceNote = ConvertedAudio;

/**
 * Where the ffmpeg binary actually is.
 *
 * `ffmpegPath` is computed from the package's own `__dirname`, which only
 * survives if the package stays external to the bundle — one config change away
 * from pointing at a directory that does not exist. Production ran for a week
 * spawning `/ROOT/node_modules/ffmpeg-static/ffmpeg` and swallowing the ENOENT,
 * so the path is checked here instead of trusted, with the deployed layout as a
 * fallback. Resolved once: the answer cannot change while the process lives.
 */
let resolvedFfmpeg: string | null | undefined;

function ffmpegBinary(): string | null {
  if (resolvedFfmpeg !== undefined) return resolvedFfmpeg;

  const candidates = [
    process.env.FFMPEG_BIN,
    ffmpegPath,
    join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
  ].filter((c): c is string => typeof c === "string" && c.length > 0);

  resolvedFfmpeg = candidates.find((c) => existsSync(c)) ?? null;

  if (!resolvedFfmpeg) {
    console.error("whatsapp/audio: ffmpeg binary not found; tried", candidates);
    return null;
  }

  // Serverless bundling does not always keep the executable bit.
  try {
    chmodSync(resolvedFfmpeg, 0o755);
  } catch {
    // Read-only filesystem, or already executable. spawn will say if it is not.
  }

  return resolvedFfmpeg;
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      // Only the tail matters: ffmpeg puts the actual failure last.
      stderr = (stderr + chunk.toString()).slice(-2000);
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg timed out"));
    }, TIMEOUT_MS);

    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.trim()}`));
    });
  });
}

/**
 * Runs one re-encode. Returns null on any failure, so every caller can fall
 * back to the bytes it already has rather than dropping a recording.
 */
async function transcode(
  data: Buffer,
  filename: string,
  outputExtension: string,
  encodeArgs: string[],
): Promise<Buffer | null> {
  const bin = ffmpegBinary();
  if (!bin) return null;

  // Real files, not pipes: an mp4 from Safari keeps its moov atom at the end,
  // and ffmpeg cannot seek back for it on stdin.
  const dir = await mkdtemp(join(tmpdir(), "wa-audio-"));
  const extension = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : ".bin";
  const input = join(dir, `${randomUUID()}${extension}`);
  const output = join(dir, `${randomUUID()}.${outputExtension}`);

  try {
    await writeFile(input, data);
    await run(bin, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", input,
      "-vn",
      ...encodeArgs,
      output,
    ]);
    const converted = await readFile(output);
    return converted.length > 0 ? converted : null;
  } catch (err) {
    console.error("whatsapp/audio: conversion failed", err);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Re-encodes to mono 48 kHz Opus in Ogg — what WhatsApp needs to render the
 * message as a voice note. Null when the conversion is not possible.
 */
export async function toVoiceNote(data: Buffer, filename: string): Promise<ConvertedAudio | null> {
  const converted = await transcode(data, filename, "ogg", [
    "-c:a", "libopus",
    "-b:a", OPUS_BITRATE,
    "-ar", "48000",
    "-ac", "1",
    "-f", "ogg",
  ]);
  if (!converted) return null;
  return { data: converted, mimetype: "audio/ogg; codecs=opus", extension: "ogg" };
}

/**
 * Re-encodes to mono 48 kHz AAC in mp4 — the copy that gets stored and played
 * back in the thread. `+faststart` moves the moov atom to the front so
 * `<audio preload="metadata">` learns the duration from the first range
 * request instead of pulling the whole file.
 */
export async function toPlayable(data: Buffer, filename: string): Promise<ConvertedAudio | null> {
  const converted = await transcode(data, filename, "m4a", [
    "-c:a", "aac",
    "-b:a", AAC_BITRATE,
    "-ar", "48000",
    "-ac", "1",
    "-movflags", "+faststart",
    "-f", "mp4",
  ]);
  if (!converted) return null;
  return { data: converted, mimetype: "audio/mp4", extension: "m4a" };
}

/** Swaps the extension on a filename, so what is stored matches what it is. */
export function withExtension(filename: string, extension: string): string {
  const base = filename.includes(".") ? filename.slice(0, filename.lastIndexOf(".")) : filename;
  return `${base || "audio"}.${extension}`;
}
