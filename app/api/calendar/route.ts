import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TZ = "America/Los_Angeles";

// PT calendar date (YYYY-MM-DD) for a given instant — matches the date keys the
// rolling meal plan uses, so events line up with the right day card.
function ptDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TZ }); // en-CA => YYYY-MM-DD
}

async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    // Google's error code (e.g. invalid_grant) tells us why — no secrets here.
    throw new Error(
      `token refresh failed: ${data.error || res.status}${data.error_description ? ` (${data.error_description})` : ""}`
    );
  }
  return data.access_token as string;
}

function formatTime(dateTimeStr: string) {
  return new Date(dateTimeStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });
}

function detectWho(title: string) {
  const t = title.toLowerCase();
  if (t.includes("chris")) return "Chris";
  if (t.includes("julie")) return "Julie";
  if (t.includes("joshua")) return "Joshua";
  if (t.includes("elisha") || t.includes(" e:") || t.startsWith("e:")) return "Elisha";
  if (t.includes("kids") || t.includes("school") || t.includes("wildwood")) return "Kids";
  return "Family";
}

function detectIsOut(title: string) {
  const t = title.toLowerCase();
  return (
    t.includes("dinner") ||
    t.includes(" out") ||
    t.includes("away") ||
    t.includes("travel") ||
    t.includes("trip")
  );
}

type DayEvent = { time: string; title: string; who: string; isOut?: boolean };
// Keyed by PT calendar date (YYYY-MM-DD). The UI reads only the dates in its
// rolling window, so a slightly wider fetch range is harmless.
type EventMap = Record<string, DayEvent[]>;

export async function GET(request: Request) {
  // ?debug=1 returns a diagnostic summary (no secrets) instead of events,
  // so we can see which step fails without digging through Vercel logs.
  const debug = new URL(request.url).searchParams.get("debug") === "1";
  const diag: Record<string, unknown> = {
    hasClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    hasRefreshToken: Boolean(process.env.GOOGLE_REFRESH_TOKEN),
    calendarIdsConfigured: Boolean(process.env.GOOGLE_CALENDAR_IDS),
  };

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    console.error("[calendar] Missing env vars");
    if (debug) return NextResponse.json({ ...diag, failedAt: "env vars missing" });
    return NextResponse.json({});
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
    diag.tokenOk = true;
  } catch (e) {
    console.error("[calendar] Token error:", e);
    if (debug) {
      return NextResponse.json({
        ...diag,
        tokenOk: false,
        failedAt: "token refresh",
        error: e instanceof Error ? e.message : String(e),
      });
    }
    return NextResponse.json({});
  }

  // Cover the rolling window (today → +6) generously: from a day ago to 8 days
  // out. Bucketing is by PT date, and the UI keeps only the dates it shows.
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(now.getDate() - 1);
  const timeMax = new Date(now);
  timeMax.setDate(now.getDate() + 8);

  const calendarIds = (process.env.GOOGLE_CALENDAR_IDS || "primary")
    .split(",")
    .map((s) => s.trim());

  const events: EventMap = {};

  const calDiags: Record<string, unknown>[] = [];

  for (const calendarId of calendarIds) {
    // Mask the calendar id in debug output (it's usually an email address).
    const masked = calendarId.length > 8 ? `${calendarId.slice(0, 4)}…${calendarId.slice(-8)}` : calendarId;
    const calDiag: Record<string, unknown> = { calendar: masked };
    calDiags.push(calDiag);
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    );
    url.searchParams.set("timeMin", timeMin.toISOString());
    url.searchParams.set("timeMax", timeMax.toISOString());
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[calendar] Failed to fetch calendar ${calendarId}:`, res.status, err);
      calDiag.status = res.status;
      calDiag.error = err.slice(0, 200);
      continue;
    }

    const data = await res.json();
    console.log(`[calendar] ${calendarId}: ${data.items?.length ?? 0} events`);
    calDiag.status = 200;
    calDiag.eventsThisWeek = data.items?.length ?? 0;

    for (const event of data.items ?? []) {
      if (event.transparency === "transparent") continue;

      const start = event.start?.dateTime || event.start?.date;
      if (!start) continue;

      const isAllDay = !event.start?.dateTime;
      const title: string = event.summary || "";
      if (isAllDay && !detectIsOut(title)) continue;

      const tzOffset = "T12:00:00";
      const date = new Date(start.includes("T") ? start : start + tzOffset);

      if (event.start.dateTime) {
        // Google Calendar includes local time in the ISO string (e.g. "2026-05-13T09:00:00-07:00")
        const localHour = parseInt(event.start.dateTime.substring(11, 13), 10);
        if (localHour < 17) continue;
      }

      const dayKey = ptDateKey(date);

      console.log(`[calendar] KEEPING: "${title}" start=${event.start.dateTime || event.start.date}`);
      calDiag.eventsKept = ((calDiag.eventsKept as number) || 0) + 1;
      (events[dayKey] ??= []).push({
        time: event.start.dateTime ? formatTime(event.start.dateTime) : "All Day",
        title,
        who: detectWho(title),
        isOut: detectIsOut(title),
      });
    }
  }

  if (debug) {
    return NextResponse.json({
      ...diag,
      calendars: calDiags,
      note: "eventsThisWeek = all events found; eventsKept = evening (5pm+) or all-day 'out' events shown in the app",
    });
  }

  return NextResponse.json(events, {
    headers: { "Cache-Control": "no-store" },
  });
}
