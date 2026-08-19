// Turns whatever the browser recorded into a WhatsApp voice note.
//
// MediaRecorder has no format every browser agrees on: Chrome and Firefox give
// Opus, Safari gives AAC in an mp4 container. WhatsApp voice notes are Opus in
// Ogg and nothing else — an AAC blob is accepted by the provider, delivered,
// and then renders on the phone as a note with no waveform and a 0:00 length.
// Converting here means the recorder can stay simple and every browser works.

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

/** Bitrate WhatsApp's own voice notes use; higher is wasted on speech. */
const OPUS_BITRATE = "32k";
const TIMEOUT_MS = 30_000;

export interface VoiceNote {
  data: Buffer;
  mimetype: string;
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
 * Re-encodes to mono 48 kHz Opus in Ogg. Returns null when the conversion is
 * not possible, so the caller can fall back to sending the original rather
 * than dropping a recording the user already made.
 */
export async function toVoiceNote(data: Buffer, filename: string): Promise<VoiceNote | null> {
  if (!ffmpegPath) return null;

  // Real files, not pipes: an mp4 from Safari keeps its moov atom at the end,
  // and ffmpeg cannot seek back for it on stdin.
  const dir = await mkdtemp(join(tmpdir(), "wa-audio-"));
  const extension = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : ".bin";
  const input = join(dir, `${randomUUID()}${extension}`);
  const output = join(dir, `${randomUUID()}.ogg`);

  try {
    await writeFile(input, data);
    await run(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", input,
      "-vn",
      "-c:a", "libopus",
      "-b:a", OPUS_BITRATE,
      "-ar", "48000",
      "-ac", "1",
      "-f", "ogg",
      output,
    ]);
    const converted = await readFile(output);
    if (converted.length === 0) return null;
    return { data: converted, mimetype: "audio/ogg; codecs=opus" };
  } catch (err) {
    console.error("whatsapp/audio: conversion failed", err);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
