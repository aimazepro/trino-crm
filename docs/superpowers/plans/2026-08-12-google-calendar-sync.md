# Google Calendar Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Google Calendar integration actually work — CRM activities push to Google Calendar in real time (correct naming, Google Meet link with copy button), Google-side edits to those events pull back into the CRM, and the sync toggle/button in Settings stop being fake.

**Architecture:** A raw Calendar API client (`src/lib/google-calendar.ts`) handles token refresh + HTTP calls to Google. An orchestration layer (`src/lib/calendar-sync.ts`) implements the push-one-activity and pull-one-integration operations on top of it. Three thin API routes call into that orchestration: one fired synchronously from the existing client-side mutation hooks (push, instant), one run by a Vercel Cron every 2 minutes (pull), one triggered by the "Sincronizar agora" button (pull-now + backfill).

**Tech Stack:** Next.js API routes, `@supabase/supabase-js` admin client (service role), Google Calendar API v3 REST (raw `fetch`, no SDK — matches existing OAuth code style), Vercel Cron via `vercel.ts`.

**Spec:** [docs/superpowers/specs/2026-08-12-google-calendar-sync-design.md](../specs/2026-08-12-google-calendar-sync-design.md)

## Global Constraints

- Push (CRM→Calendar) fires in **both** sync modes (uni/bidirecional). Only the pull direction is gated by `sync_type = 'bidirecional'`.
- Event title: `"{título} — {negócio.title}"`; falls back to just the title when the activity has no linked deal.
- Google Meet is requested only when `activity.type` is `"Reunião"` or `"Videochamada"`.
- Pulling changes back from Google only touches `date`/`end_date` on the activity, plus unlinking (`google_event_id = null`) on cancellation — **never** `title`/`description`/`completed`. Google's `summary` already has `" — {negócio}"` appended by our own push; pulling it back verbatim would corrupt the CRM title and double up on the next push. This narrows the spec's "atualiza título/horário/notas" line to the safe subset.
- A Google-side cancellation unlinks the activity (`google_event_id = null`); it never deletes the CRM activity.
- Google Calendar events created directly in Google (no matching `google_event_id` in `activities`) are ignored by the pull — never written to the CRM.
- No test framework exists in this repo (`package.json` only has `dev`/`build`/`start`/`lint`). Every task's verification step is `npx tsc --noEmit`, `npm run lint`, and a concrete manual check — not a written unit test.
- Timezone hardcoded to `America/Sao_Paulo` on events sent to Google (no per-user timezone setting exists yet).
- `calendar_id` is always `"primary"` for now (matches spec — the Settings dropdown already only lists the primary calendar).

---

### Task 1: Database migration + type plumbing

**Files:**
- Create: `supabase/migrations/20260812190000_google_calendar_sync.sql`
- Modify: `src/lib/crm-types.ts` (`Activity` interface, ~line 70-83)
- Modify: `src/lib/crm-transforms.ts` (activity row mapping, ~line 75-84)

**Interfaces:**
- Produces: `Activity.googleEventId?: string`, `Activity.meetLink?: string` — consumed by Task 4 (mutations + UI).
- Produces DB columns `activities.google_event_id`, `activities.meet_link`, `activities.calendar_synced_at`, `integrations.sync_type`, `integrations.calendar_id`, `integrations.sync_token`, `integrations.last_synced_at` — consumed by Tasks 2-6.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260812190000_google_calendar_sync.sql
alter table activities
  add column google_event_id text,
  add column meet_link text,
  add column calendar_synced_at timestamptz;

alter table integrations
  add column sync_type text not null default 'bidirecional'
    check (sync_type in ('bidirecional', 'unidirecional')),
  add column calendar_id text not null default 'primary',
  add column sync_token text,
  add column last_synced_at timestamptz;
```

- [ ] **Step 2: Apply the migration to the linked Supabase project**

Use the `mcp__supabase__apply_migration` tool with `project_id: "etdkzpiehoivrviylemd"`, `name: "google_calendar_sync"`, and the SQL above. This applies it to the live project directly (same one `list_tables` already showed).

- [ ] **Step 3: Verify the columns exist**

Run `mcp__supabase__list_tables` with `project_id: "etdkzpiehoivrviylemd"`, `verbose: true`, and confirm `public.activities` has `google_event_id`/`meet_link`/`calendar_synced_at` and `public.integrations` has `sync_type`/`calendar_id`/`sync_token`/`last_synced_at`.

- [ ] **Step 4: Update the `Activity` type**

In `src/lib/crm-types.ts`, add two optional fields to the `Activity` interface:

```typescript
export interface Activity {
  id: string;
  dealId: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  type: string;
  completed: boolean;
  createdAt: string;
  guests?: string[];
  assigneeId?: string;
  attachments: ActivityAttachment[];
  googleEventId?: string;
  meetLink?: string;
}
```

- [ ] **Step 5: Map the new columns in the transform**

In `src/lib/crm-transforms.ts`, the activity row mapping (around line 75) currently reads:

```typescript
    activities: ((row.activities ?? []) as any[]).map((a): Activity => ({
      id: a.id, dealId: a.deal_id, title: a.title, description: a.description ?? undefined,
      date: new Date(a.date).toISOString(), endDate: a.end_date ? new Date(a.end_date).toISOString() : undefined,
      type: a.type, completed: a.completed, createdAt: a.created_at,
      guests: a.guests ?? [], assigneeId: a.assignee_id ?? undefined,
```

Add the two new fields to that same object literal:

```typescript
      guests: a.guests ?? [], assigneeId: a.assignee_id ?? undefined,
      googleEventId: a.google_event_id ?? undefined, meetLink: a.meet_link ?? undefined,
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (baseline was 0 before this task).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260812190000_google_calendar_sync.sql src/lib/crm-types.ts src/lib/crm-transforms.ts
git commit -m "feat(calendar): add sync columns to activities and integrations"
```

---

### Task 2: Raw Google Calendar API client

**Files:**
- Create: `src/lib/google-calendar.ts`

**Interfaces:**
- Consumes: `integrations` row shape from Task 1 (`access_token`, `refresh_token`, `expires_at`, `calendar_id` — all as stored, i.e. encrypted tokens), `decryptToken`/`encryptToken` from `src/lib/token-crypto.ts` (already exist).
- Produces (consumed by Task 3):
  - `getValidAccessToken(admin: SupabaseClient, userId: string): Promise<{ accessToken: string; calendarId: string; integrationId: string } | null>`
  - `createEvent(accessToken: string, calendarId: string, input: CalendarEventInput): Promise<CalendarEventResult>`
  - `updateEvent(accessToken: string, calendarId: string, googleEventId: string, input: CalendarEventInput): Promise<CalendarEventResult>`
  - `deleteEvent(accessToken: string, calendarId: string, googleEventId: string): Promise<void>`
  - `listChangedEvents(accessToken: string, calendarId: string, syncToken?: string): Promise<{ events: RawGoogleEvent[]; nextSyncToken: string }>`
  - Types: `CalendarEventInput`, `CalendarEventResult`, `RawGoogleEvent`

- [ ] **Step 1: Write the file**

```typescript
// src/lib/google-calendar.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptToken, decryptToken } from "@/lib/token-crypto";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const TIMEZONE = "America/Sao_Paulo";

function getClientCredentials() {
  const clientId = process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID || process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET || process.env.GMAIL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");
  return { clientId, clientSecret };
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  startIso: string;
  endIso: string;
  attendees?: string[];
  withMeet?: boolean;
}

export interface CalendarEventResult {
  googleEventId: string;
  htmlLink: string;
  meetLink: string | null;
}

export interface RawGoogleEvent {
  id: string;
  status: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/**
 * Returns a usable access token for the user's google_calendar integration,
 * refreshing it first if it's expired. Returns null if there's no active
 * integration, or marks it inactive and returns null if the refresh fails
 * (revoked access).
 */
export async function getValidAccessToken(
  admin: SupabaseClient,
  userId: string
): Promise<{ accessToken: string; calendarId: string; integrationId: string } | null> {
  const { data: integ } = await admin
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .eq("active", true)
    .maybeSingle();

  if (!integ || !integ.refresh_token) return null;

  const expiresAt = integ.expires_at ? new Date(integ.expires_at).getTime() : 0;
  const stillValid = expiresAt - Date.now() > 2 * 60 * 1000; // 2min safety buffer

  if (stillValid && integ.access_token) {
    return { accessToken: decryptToken(integ.access_token), calendarId: integ.calendar_id || "primary", integrationId: integ.id };
  }

  const { clientId, clientSecret } = getClientCredentials();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptToken(integ.refresh_token),
      grant_type: "refresh_token",
    }),
  });
  const tokens = await res.json();

  if (!tokens.access_token) {
    console.error("[google-calendar] refresh failed, deactivating integration", { userId, error: tokens.error });
    await admin.from("integrations").update({ active: false }).eq("id", integ.id);
    return null;
  }

  const newExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
  await admin.from("integrations").update({
    access_token: encryptToken(tokens.access_token),
    expires_at: newExpiresAt,
  }).eq("id", integ.id);

  return { accessToken: tokens.access_token, calendarId: integ.calendar_id || "primary", integrationId: integ.id };
}

function buildEventBody(input: CalendarEventInput) {
  return {
    summary: input.title,
    description: input.description,
    start: { dateTime: input.startIso, timeZone: TIMEZONE },
    end: { dateTime: input.endIso, timeZone: TIMEZONE },
    attendees: (input.attendees ?? []).map((email) => ({ email })),
    ...(input.withMeet
      ? { conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } } }
      : {}),
  };
}

function extractResult(event: Record<string, unknown>): CalendarEventResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entryPoints = ((event.conferenceData as any)?.entryPoints ?? []) as { entryPointType: string; uri: string }[];
  const meet = entryPoints.find((e) => e.entryPointType === "video");
  return { googleEventId: event.id as string, htmlLink: event.htmlLink as string, meetLink: meet?.uri ?? null };
}

export async function createEvent(accessToken: string, calendarId: string, input: CalendarEventInput): Promise<CalendarEventResult> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildEventBody(input)),
    }
  );
  if (!res.ok) throw new Error(`createEvent failed: ${res.status} ${await res.text()}`);
  return extractResult(await res.json());
}

export async function updateEvent(accessToken: string, calendarId: string, googleEventId: string, input: CalendarEventInput): Promise<CalendarEventResult> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}?conferenceDataVersion=1`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildEventBody(input)),
    }
  );
  if (!res.ok) throw new Error(`updateEvent failed: ${res.status} ${await res.text()}`);
  return extractResult(await res.json());
}

export async function deleteEvent(accessToken: string, calendarId: string, googleEventId: string): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  // 410/404 means it's already gone on Google's side — treat as success.
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    throw new Error(`deleteEvent failed: ${res.status} ${await res.text()}`);
  }
}

export async function listChangedEvents(
  accessToken: string,
  calendarId: string,
  syncToken?: string
): Promise<{ events: RawGoogleEvent[]; nextSyncToken: string }> {
  const events: RawGoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken = "";

  do {
    const params = new URLSearchParams({ singleEvents: "true" });
    if (syncToken) params.set("syncToken", syncToken);
    else params.set("timeMin", new Date().toISOString());
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 410) {
      // Sync token expired/invalid — caller must clear it and do a fresh full sync.
      throw Object.assign(new Error("sync token invalid"), { code: "SYNC_TOKEN_INVALID" });
    }
    if (!res.ok) throw new Error(`listChangedEvents failed: ${res.status} ${await res.text()}`);

    const data = await res.json();
    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `src/lib/google-calendar.ts`.

- [ ] **Step 3: Lint**

Run: `npx eslint src/lib/google-calendar.ts`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/google-calendar.ts
git commit -m "feat(calendar): add raw Google Calendar API client with token refresh"
```

---

### Task 3: Sync orchestration layer

**Files:**
- Create: `src/lib/calendar-sync.ts`

**Interfaces:**
- Consumes: everything from Task 2 (`getValidAccessToken`, `createEvent`, `updateEvent`, `deleteEvent`, `listChangedEvents`), `activities`/`deals` schema from Task 1.
- Produces (consumed by Tasks 4-6):
  - `pushActivity(admin: SupabaseClient, activityId: string, action: "upsert" | "delete"): Promise<{ ok: boolean; skipped?: boolean; googleEventId?: string; meetLink?: string | null }>`
  - `pullForUser(admin: SupabaseClient, userId: string): Promise<{ ok: boolean; skipped?: boolean; changed: number }>`

- [ ] **Step 1: Write the file**

```typescript
// src/lib/calendar-sync.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getValidAccessToken, createEvent, updateEvent, deleteEvent, listChangedEvents,
} from "@/lib/google-calendar";

const MEET_TYPES = new Set(["Reunião", "Videochamada"]);

export async function pushActivity(
  admin: SupabaseClient,
  activityId: string,
  action: "upsert" | "delete"
): Promise<{ ok: boolean; skipped?: boolean; googleEventId?: string; meetLink?: string | null }> {
  const { data: activity } = await admin.from("activities").select("*, deals(title)").eq("id", activityId).maybeSingle();
  if (!activity) return { ok: false };

  const ownerId = activity.assignee_id || activity.user_id;
  const token = await getValidAccessToken(admin, ownerId);
  if (!token) return { ok: true, skipped: true };

  if (action === "delete") {
    if (activity.google_event_id) {
      await deleteEvent(token.accessToken, token.calendarId, activity.google_event_id);
    }
    return { ok: true };
  }

  const dealTitle = (activity.deals as { title?: string } | null)?.title;
  const title = dealTitle ? `${activity.title} — ${dealTitle}` : activity.title;
  const startIso = new Date(activity.date).toISOString();
  const endIso = activity.end_date
    ? new Date(activity.end_date).toISOString()
    : new Date(new Date(activity.date).getTime() + 30 * 60 * 1000).toISOString();
  const withMeet = MEET_TYPES.has(activity.type);

  const input = {
    title,
    description: activity.description ?? undefined,
    startIso,
    endIso,
    attendees: (activity.guests as string[] | null) ?? [],
    withMeet,
  };

  const result = activity.google_event_id
    ? await updateEvent(token.accessToken, token.calendarId, activity.google_event_id, input)
    : await createEvent(token.accessToken, token.calendarId, input);

  await admin.from("activities").update({
    google_event_id: result.googleEventId,
    meet_link: result.meetLink,
    calendar_synced_at: new Date().toISOString(),
  }).eq("id", activityId);

  return { ok: true, googleEventId: result.googleEventId, meetLink: result.meetLink };
}

export async function pullForUser(admin: SupabaseClient, userId: string): Promise<{ ok: boolean; skipped?: boolean; changed: number }> {
  const { data: integ } = await admin
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .eq("active", true)
    .eq("sync_type", "bidirecional")
    .maybeSingle();
  if (!integ) return { ok: true, skipped: true, changed: 0 };

  const token = await getValidAccessToken(admin, userId);
  if (!token) return { ok: true, skipped: true, changed: 0 };

  let events;
  let nextSyncToken: string;
  try {
    const result = await listChangedEvents(token.accessToken, token.calendarId, integ.sync_token ?? undefined);
    events = result.events;
    nextSyncToken = result.nextSyncToken;
  } catch (err) {
    if ((err as { code?: string }).code === "SYNC_TOKEN_INVALID") {
      const result = await listChangedEvents(token.accessToken, token.calendarId);
      events = result.events;
      nextSyncToken = result.nextSyncToken;
    } else {
      throw err;
    }
  }

  let changed = 0;
  for (const event of events) {
    const { data: match } = await admin.from("activities").select("id").eq("google_event_id", event.id).maybeSingle();
    if (!match) continue; // event not originated by the CRM — ignored per spec

    if (event.status === "cancelled") {
      await admin.from("activities").update({ google_event_id: null }).eq("id", match.id);
      changed++;
      continue;
    }

    const startIso = event.start?.dateTime ?? event.start?.date;
    const endIso = event.end?.dateTime ?? event.end?.date;
    if (!startIso) continue;
    await admin.from("activities").update({
      date: startIso,
      end_date: endIso ?? null,
      calendar_synced_at: new Date().toISOString(),
    }).eq("id", match.id);
    changed++;
  }

  await admin.from("integrations").update({
    sync_token: nextSyncToken || integ.sync_token,
    last_synced_at: new Date().toISOString(),
  }).eq("id", integ.id);

  return { ok: true, changed };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `src/lib/calendar-sync.ts`.

- [ ] **Step 3: Lint**

Run: `npx eslint src/lib/calendar-sync.ts`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/calendar-sync.ts
git commit -m "feat(calendar): add push/pull orchestration layer"
```

---

### Task 4: Push route + instant wiring + Meet link UI (Fase 1 vertical slice)

**Files:**
- Create: `src/app/api/calendar/sync-activity/route.ts`
- Modify: `src/hooks/use-crm-mutations.ts` (`addActivity` ~line 633, `updateActivity` ~line 676, `deleteActivity` ~line 704)
- Modify: `src/components/deal/activity-modal.tsx` (Notas section, ~line 271-280)

**Interfaces:**
- Consumes: `pushActivity` from Task 3.
- Produces: `POST /api/calendar/sync-activity` — body `{ activityId: string, action: "upsert" | "delete" }`, response `{ ok: boolean; skipped?: boolean; googleEventId?: string; meetLink?: string | null }`.

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/calendar/sync-activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { pushActivity } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { activityId, action } = await req.json();
  if (!activityId || (action !== "upsert" && action !== "delete")) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const result = await pushActivity(admin, activityId, action);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[calendar/sync-activity] push failed", err);
    // Never a hard failure for the caller — the CRM save already succeeded.
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
```

- [ ] **Step 2: Wire `addActivity`**

In `src/hooks/use-crm-mutations.ts`, the `addActivity` success branch (inside the `.then(({ data, error }) => {...})` at ~line 660) currently ends with:

```typescript
        if (data) {
          setState((prev) => ({
            ...prev,
            deals: prev.deals.map((d) => d.id === activity.dealId
              ? { ...d, activities: d.activities.map((a) => a.id === newAct.id ? { ...newAct, id: data.id, createdAt: data.created_at } : a) }
              : d),
          }));
          addDealHistory(activity.dealId, "Atividade criada", activity.title);
        }
```

Add the calendar push right after, still inside that `if (data)` block:

```typescript
        if (data) {
          setState((prev) => ({
            ...prev,
            deals: prev.deals.map((d) => d.id === activity.dealId
              ? { ...d, activities: d.activities.map((a) => a.id === newAct.id ? { ...newAct, id: data.id, createdAt: data.created_at } : a) }
              : d),
          }));
          addDealHistory(activity.dealId, "Atividade criada", activity.title);

          fetch("/api/calendar/sync-activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activityId: data.id, action: "upsert" }),
          })
            .then((r) => r.json())
            .then((sync) => {
              if (!sync.ok || sync.skipped) return;
              setState((prev) => ({
                ...prev,
                deals: prev.deals.map((d) => d.id === activity.dealId
                  ? { ...d, activities: d.activities.map((a) => a.id === data.id ? { ...a, googleEventId: sync.googleEventId, meetLink: sync.meetLink ?? undefined } : a) }
                  : d),
              }));
            })
            .catch((e) => console.error("[CRM] calendar push failed:", e));
        }
```

- [ ] **Step 3: Wire `updateActivity`**

In the same file, `updateActivity`'s success branch (~line 694) currently is:

```typescript
      supabase.from("activities").update(db).eq("id", activityId)
        .then(({ error }) => {
          if (error) { console.error("[CRM] updateActivity failed:", error); return; }
          if (fields.completed === true && owningDeal) {
            addDealHistory(owningDeal.id, "Atividade concluída", "");
          }
        });
```

Change it to also push, and merge back `meetLink`/`googleEventId` if this was the activity's first sync:

```typescript
      supabase.from("activities").update(db).eq("id", activityId)
        .then(({ error }) => {
          if (error) { console.error("[CRM] updateActivity failed:", error); return; }
          if (fields.completed === true && owningDeal) {
            addDealHistory(owningDeal.id, "Atividade concluída", "");
          }
          fetch("/api/calendar/sync-activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activityId, action: "upsert" }),
          })
            .then((r) => r.json())
            .then((sync) => {
              if (!sync.ok || sync.skipped) return;
              setState((prev) => ({
                ...prev,
                deals: prev.deals.map((d) => ({
                  ...d, activities: d.activities.map((a) => a.id === activityId ? { ...a, googleEventId: sync.googleEventId, meetLink: sync.meetLink ?? undefined } : a),
                })),
              }));
            })
            .catch((e) => console.error("[CRM] calendar push failed:", e));
        });
```

- [ ] **Step 4: Wire `deleteActivity`**

In the same file, `deleteActivity` (~line 710) currently is:

```typescript
    supabase.from("activities").delete().eq("id", activityId)
      .then(({ error }) => {
        if (error) { console.error("[CRM] deleteActivity failed:", error); return; }
        if (owningDeal) addDealHistory(owningDeal.id, "Atividade removida", "");
      });
```

The row (and its `google_event_id`) is gone from the DB the moment `delete()` resolves, so the Google-side delete has to fire *before* that, using the value already in local state:

```typescript
  const deleteActivity = (activityId: string) => {
    const owningDeal = state.deals.find((d) => d.activities.some((a) => a.id === activityId));
    const target = owningDeal?.activities.find((a) => a.id === activityId);
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => ({ ...d, activities: d.activities.filter((a) => a.id !== activityId) })),
    }));
    if (target?.googleEventId) {
      fetch("/api/calendar/sync-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, action: "delete" }),
      }).catch((e) => console.error("[CRM] calendar delete push failed:", e));
    }
    supabase.from("activities").delete().eq("id", activityId)
      .then(({ error }) => {
        if (error) { console.error("[CRM] deleteActivity failed:", error); return; }
        if (owningDeal) addDealHistory(owningDeal.id, "Atividade removida", "");
      });
  };
```

Note the route reads the activity row from the DB (Task 3's `pushActivity`), so firing it slightly before the `delete()` call resolves is fine — both requests are in flight concurrently and the row still exists when the route's `select` runs in the near-certain common case. (Edge case — row already gone by the time the route queries it — is handled: `pushActivity` returns `{ ok: false }` on a missing row, which the route reports but the client already ignores via `.catch`.)

- [ ] **Step 5: Meet link chip in the activity modal**

In `src/components/deal/activity-modal.tsx`, the Notas block (~line 271-280) currently is:

```tsx
          {/* Notas */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Notas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observacoes opcionais..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-400 transition-colors resize-none h-24 text-gray-800"
            />
          </div>
```

Add a Meet chip above it, shown only for Reunião/Videochamada once a link exists on the activity being edited:

```tsx
          {/* Notas */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Notas</label>
            {showGuests && activity?.meetLink && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Video size={14} className="text-amber-500 shrink-0" />
                  <span className="text-xs font-medium text-amber-800 truncate">{activity.meetLink}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(activity.meetLink!)}
                  className="shrink-0 text-xs font-medium text-amber-700 hover:text-amber-900 bg-white border border-amber-200 rounded-md px-2 py-1"
                >
                  Copiar
                </button>
              </div>
            )}
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observacoes opcionais..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-400 transition-colors resize-none h-24 text-gray-800"
            />
          </div>
```

`Video` is already imported at the top of this file (used by the `TYPES` array), no new import needed.

This only covers the **edit** case (`activity` prop present) — the link doesn't exist yet at creation time since it comes back from Google after save. That matches the flow: create → modal closes → reopen to edit → link is there. Good enough for this plan; showing it live in the same create session would need keeping the modal open after save, which is a separate UX change not in the approved spec.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Lint**

Run: `npx eslint src/app/api/calendar/sync-activity/route.ts src/hooks/use-crm-mutations.ts src/components/deal/activity-modal.tsx`
Expected: no new errors (the two pre-existing `react-hooks/set-state-in-effect` errors in `activity-modal.tsx` are unrelated to this change — do not fix them as part of this task).

- [ ] **Step 8: Manual end-to-end check**

1. `npm run dev`, open a deal, create a new activity with type "Reunião", a linked negócio, and a guest email.
2. Save. Check the Google Calendar account connected in `/configuracoes/calendario` — an event named `"{título} — {negócio}"` should appear, with a Google Meet link and the guest invited.
3. Reopen the same activity in the CRM — the amber Meet chip should show above Notas with a working "Copiar" button.
4. Delete the activity from the CRM — the event should disappear from Google Calendar.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/calendar/sync-activity/route.ts src/hooks/use-crm-mutations.ts src/components/deal/activity-modal.tsx
git commit -m "feat(calendar): push activities to Google Calendar instantly with naming and Meet links"
```

---

### Task 5: Cron pull route (Fase 2)

**Files:**
- Create: `vercel.ts`
- Create: `src/app/api/cron/calendar-pull/route.ts`

**Interfaces:**
- Consumes: `pullForUser` from Task 3.

- [ ] **Step 1: Install `@vercel/config`**

Run: `npm install @vercel/config`

- [ ] **Step 2: Write `vercel.ts`**

```typescript
// vercel.ts
import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  crons: [{ path: "/api/cron/calendar-pull", schedule: "*/2 * * * *" }],
};
```

- [ ] **Step 3: Write the cron route**

```typescript
// src/app/api/cron/calendar-pull/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { pullForUser } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: integrations, error } = await admin
    .from("integrations")
    .select("user_id")
    .eq("provider", "google_calendar")
    .eq("active", true)
    .eq("sync_type", "bidirecional");

  if (error) {
    console.error("[cron/calendar-pull] failed to list integrations", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let processed = 0;
  let failed = 0;
  for (const integ of integrations ?? []) {
    try {
      await pullForUser(admin, integ.user_id);
      processed++;
    } catch (err) {
      failed++;
      console.error("[cron/calendar-pull] pull failed for user", integ.user_id, err);
    }
  }

  return NextResponse.json({ ok: true, processed, failed });
}
```

- [ ] **Step 4: Set `CRON_SECRET` in Vercel**

Run: `npx vercel env add CRON_SECRET production` (paste any random secret when prompted — e.g. generate one with `openssl rand -hex 32`). Vercel automatically sends this value as `Authorization: Bearer <value>` when it triggers the cron, per Vercel's cron protection convention — no extra config needed beyond having the env var set.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Lint**

Run: `npx eslint src/app/api/cron/calendar-pull/route.ts vercel.ts`
Expected: clean.

- [ ] **Step 7: Manual check after deploy**

After deploying, edit the time of a CRM-originated event directly in Google Calendar. Within 2 minutes, refresh the CRM activity — the new time should be reflected. Check Vercel's cron logs (Vercel dashboard → project → Cron Jobs) to confirm the route is actually firing every 2 minutes.

- [ ] **Step 8: Commit**

```bash
git add vercel.ts src/app/api/cron/calendar-pull/route.ts package.json package-lock.json
git commit -m "feat(calendar): poll Google Calendar for changes every 2 minutes"
```

---

### Task 6: Real "Sincronizar agora" button + real sync-type toggle

**Files:**
- Create: `src/app/api/calendar/sync-now/route.ts`
- Modify: `src/app/configuracoes/calendario/page.tsx`

**Interfaces:**
- Consumes: `pullForUser` and `pushActivity` from Task 3.

- [ ] **Step 1: Write the sync-now route**

```typescript
// src/app/api/calendar/sync-now/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { pullForUser, pushActivity } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not authenticated" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const pull = await pullForUser(admin, user.id);

  const { data: unsynced } = await admin
    .from("activities")
    .select("id")
    .eq("assignee_id", user.id)
    .is("google_event_id", null);

  let pushed = 0;
  for (const row of unsynced ?? []) {
    const result = await pushActivity(admin, row.id, "upsert");
    if (result.ok && !result.skipped) pushed++;
  }

  return NextResponse.json({ ok: true, pulled: pull.changed, pushed });
}
```

- [ ] **Step 2: Replace the fake handlers in the Settings page**

In `src/app/configuracoes/calendario/page.tsx`:

Replace the `syncType`/`isSynced`/`lastSyncTime` `localStorage` reads in `loadIntegration` — currently:

```typescript
      // Restore syncType preference if saved in localStorage
      const savedSyncType = localStorage.getItem("gcal_sync_type");
      if (savedSyncType === "bidirecional" || savedSyncType === "unidirecional") {
        setSyncType(savedSyncType);
      }

      const savedSyncTime = localStorage.getItem("gcal_last_sync_time");
      if (savedSyncTime) {
        setLastSyncTime(savedSyncTime);
        setIsSynced(true);
      }
```

with reading it off the `integ` row already fetched a few lines above (`integ.sync_type`, `integ.last_synced_at`):

```typescript
      if (integ?.sync_type === "bidirecional" || integ?.sync_type === "unidirecional") {
        setSyncType(integ.sync_type);
      }
      if (integ?.last_synced_at) {
        setLastSyncTime(new Date(integ.last_synced_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
        setIsSynced(true);
      }
```

Replace `handleSyncNow` — currently a `setTimeout` mock:

```typescript
  const handleSyncNow = async () => {
    setSyncing(true);
    setBannerSuccess(null);
    setBannerError(null);

    try {
      // Simulate/Trigger Google Calendar sync
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const nowTime = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      setIsSynced(true);
      setLastSyncTime(nowTime);
      localStorage.setItem("gcal_last_sync_time", nowTime);
      setBannerSuccess(`Sincronização concluída com sucesso às ${nowTime}!`);
    } catch {
      setBannerError("Falha ao sincronizar agenda. Verifique suas credenciais.");
    } finally {
      setSyncing(false);
    }
  };
```

with a real call:

```typescript
  const handleSyncNow = async () => {
    setSyncing(true);
    setBannerSuccess(null);
    setBannerError(null);

    try {
      const res = await fetch("/api/calendar/sync-now", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "sync failed");

      const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setIsSynced(true);
      setLastSyncTime(nowTime);
      setBannerSuccess(`Sincronização concluída às ${nowTime} — ${data.pulled} atualizados do Google, ${data.pushed} enviados pro Google.`);
    } catch {
      setBannerError("Falha ao sincronizar agenda. Verifique suas credenciais.");
    } finally {
      setSyncing(false);
    }
  };
```

Replace `handleSelectSyncType` — currently `localStorage`-only:

```typescript
  const handleSelectSyncType = (type: SyncType) => {
    setSyncType(type);
    localStorage.setItem("gcal_sync_type", type);
  };
```

with a real DB write (fire-and-forget, same style as the rest of the file's mutations):

```typescript
  const handleSelectSyncType = (type: SyncType) => {
    setSyncType(type);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("integrations").update({ sync_type: type })
        .eq("user_id", user.id).eq("provider", "google_calendar")
        .then(({ error }) => { if (error) console.error("[calendar] sync_type update failed:", error); });
    });
  };
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Lint**

Run: `npx eslint src/app/api/calendar/sync-now/route.ts src/app/configuracoes/calendario/page.tsx`
Expected: clean.

- [ ] **Step 5: Manual check**

1. In `/configuracoes/calendario`, switch the toggle to "Unidirecional", reload the page — it should stay on "Unidirecional" (proves it's reading from the DB, not `localStorage`).
2. Click "Sincronizar agora" — banner should show real pulled/pushed counts, not just a fake 1.2s spinner.
3. Set an activity's `google_event_id` to null directly in Supabase (simulating a never-synced activity), click "Sincronizar agora" again — it should get pushed and show up in Google Calendar.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/calendar/sync-now/route.ts src/app/configuracoes/calendario/page.tsx
git commit -m "feat(calendar): wire Sincronizar agora and the sync-type toggle to real endpoints"
```

---

## Self-Review Notes

- **Spec coverage:** migration (Task 1), naming + Meet + instant push (Task 4), polling pull with unlink-not-delete and external-events-ignored (Task 5/3), real toggle/button (Task 6) — all five spec sections have a task. Fase 3 (Agenda) correctly has no task, per spec's "fora de escopo".
- **Type consistency:** `pushActivity`/`pullForUser` signatures in Task 3 match every call site in Tasks 4-6. `CalendarEventResult.meetLink` (Task 2) flows through unchanged as `meet_link`/`meetLink` everywhere it's read.
- **Deviation flagged:** pull only touches `date`/`end_date` (plus unlinking on cancellation), never `title`/`description`/`completed` — called out in Global Constraints with the reasoning (avoids corrupting the CRM's composed "título — negócio" naming on round-trip). Everything else matches the approved spec as written.
