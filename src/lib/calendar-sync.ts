import type { Database } from "@/lib/supabase/database.types";
// src/lib/calendar-sync.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getValidAccessToken, createEvent, updateEvent, deleteEvent, listChangedEvents,
} from "@/lib/google-calendar";

const MEET_TYPES = new Set(["Reunião", "Videochamada"]);

export async function pushActivity(
  admin: SupabaseClient<Database>,
  activityId: string,
  action: "upsert" | "delete"
): Promise<{ ok: boolean; skipped?: boolean; googleEventId?: string; meetLink?: string | null }> {
  const { data: activity } = await admin.from("activities").select("*, deals(title)").eq("id", activityId).maybeSingle();
  if (!activity) return { ok: false };

  let ownerId = activity.assignee_id;
  if (!ownerId) {
    // No assignee: fall back to whoever owns the workspace — activities no
    // longer carry their own creator, only the workspace they belong to.
    const { data: workspace } = await admin
      .from("workspaces")
      .select("owner_user_id")
      .eq("id", activity.workspace_id)
      .maybeSingle();
    ownerId = workspace?.owner_user_id ?? null;
  }
  if (!ownerId) return { ok: true, skipped: true };

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
  // Only ask Google for a NEW conference when this activity doesn't already have one —
  // a repeated createRequest on every edit would mint a fresh Meet link (and re-email
  // guests) each time, invalidating the one already shared. meetRequestId is stable
  // (the activity id) as a second layer of defense: Google treats a repeated requestId
  // on the same event as idempotent rather than a new conference.
  const withMeet = MEET_TYPES.has(activity.type) && !activity.meet_link;

  const input = {
    title,
    description: activity.description ?? undefined,
    startIso,
    endIso,
    attendees: (activity.guests as string[] | null) ?? [],
    withMeet,
    meetRequestId: activityId,
  };

  const result = activity.google_event_id
    ? await updateEvent(token.accessToken, token.calendarId, activity.google_event_id, input)
    : await createEvent(token.accessToken, token.calendarId, input);

  await admin.from("activities").update({
    google_event_id: result.googleEventId,
    // Never clobber an existing link with a null result (e.g. a pending conference
    // that hasn't finished provisioning on Google's side yet).
    meet_link: result.meetLink ?? activity.meet_link ?? null,
    calendar_synced_at: new Date().toISOString(),
  }).eq("id", activityId);

  return { ok: true, googleEventId: result.googleEventId, meetLink: result.meetLink ?? activity.meet_link ?? null };
}

export async function pullForUser(admin: SupabaseClient<Database>, userId: string): Promise<{ ok: boolean; skipped?: boolean; changed: number }> {
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

  // Persist the advanced sync token before processing events, not after. If something
  // below throws partway through a large batch, the next run still moves forward from
  // here instead of re-fetching the same window and potentially never converging.
  await admin.from("integrations").update({
    sync_token: nextSyncToken || integ.sync_token,
    last_synced_at: new Date().toISOString(),
  }).eq("id", integ.id);

  if (events.length === 0) return { ok: true, changed: 0 };

  // One batched lookup instead of one query per event. Scoped to this user's own
  // activities (assignee, or creator when unassigned) — without this, a guest who is
  // also a CRM user with Calendar connected would match the organizer's activity by
  // the shared google_event_id and overwrite it from their own pull.
  const eventIds = events.map((e) => e.id);
  const { data: matches } = await admin
    .from("activities")
    .select("id, google_event_id")
    .in("google_event_id", eventIds)
    .or(`assignee_id.eq.${userId},and(assignee_id.is.null,user_id.eq.${userId})`);
  const matchByEventId = new Map((matches ?? []).map((m) => [m.google_event_id as string, m.id as string]));

  let changed = 0;
  for (const event of events) {
    const activityId = matchByEventId.get(event.id);
    if (!activityId) continue; // event not originated by the CRM — ignored per spec

    if (event.status === "cancelled") {
      await admin.from("activities").update({ google_event_id: null }).eq("id", activityId);
      changed++;
      continue;
    }

    // Skip all-day events: Google's all-day end.date is exclusive (a day later than the
    // last day of the event), and writing a bare date into a timestamptz column would
    // silently shift the activity to midnight either way. Not something a "Ligação" or
    // "Reunião" activity is ever expected to become.
    if (!event.start?.dateTime) continue;
    const startIso = event.start.dateTime;
    const endIso = event.end?.dateTime ?? null;
    await admin.from("activities").update({
      date: startIso,
      end_date: endIso,
      calendar_synced_at: new Date().toISOString(),
    }).eq("id", activityId);
    changed++;
  }

  return { ok: true, changed };
}
