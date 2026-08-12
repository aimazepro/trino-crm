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
