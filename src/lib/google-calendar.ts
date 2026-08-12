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
