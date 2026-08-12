// vercel.ts
import type { VercelConfig } from "@vercel/config/v1";

// No cron declared here: this Vercel account is on the Hobby plan, which only allows
// cron jobs that run once a day — the calendar pull was designed for every 2 minutes
// (see docs/superpowers/specs/2026-08-12-google-calendar-sync-design.md), so a daily
// cron would gut the "near real-time" requirement rather than satisfy it. Declaring the
// 2-minute schedule here made every deploy of this project fail outright (Vercel
// validates cron limits before building), not just the calendar feature — so it's
// removed until there's a real cadence decision (Pro plan, an external scheduler
// hitting /api/cron/calendar-pull, or accepting a daily cadence).
export const config: VercelConfig = {};
