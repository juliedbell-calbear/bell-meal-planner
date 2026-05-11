import { NextResponse } from "next/server";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getMondayOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
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
  if (!data.access_token) throw new Error("Failed to get access token");
  return data.access_token as string;
}

function formatTime(dateTimeStr: string) {
  return new Date(dateTimeStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Los_Angeles",
  });
}

function detectWho(title: string) {
  const t = title.toLowerCase();
  if (t.includes("chris")) return "Chris";
  if (t.includes("julie")) return "Julie";
  if (t.includes("joshua")) return "Joshua";
  if (t.includes("eleanor") || t.includes(" e:") || t.startsWith("e:")) return "Eleanor";
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
type EventMap = Record<string, DayEvent[]>;

const EMPTY: EventMap = {
  Monday: [],
  Tuesday: [],
  Wednesday: [],
  Thursday: [],
  Friday: [],
  Saturday: [],
  Sunday: [],
};

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    console.error("[calendar] Missing env vars");
    return NextResponse.json(EMPTY);
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (e) {
    console.error("[calendar] Token error:", e);
    return NextResponse.json(EMPTY);
  }

  const monday = getMondayOfWeek();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  const calendarIds = (process.env.GOOGLE_CALENDAR_IDS || "primary")
    .split(",")
    .map((s) => s.trim());

  const events: EventMap = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };

  for (const calendarId of calendarIds) {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    );
    url.searchParams.set("timeMin", monday.toISOString());
    url.searchParams.set("timeMax", sunday.toISOString());
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[calendar] Failed to fetch calendar ${calendarId}:`, res.status, err);
      continue;
    }

    const data = await res.json();
    console.log(`[calendar] ${calendarId}: ${data.items?.length ?? 0} events`);

    for (const event of data.items ?? []) {
      if (event.transparency === "transparent") continue;

      const start = event.start?.dateTime || event.start?.date;
      if (!start) continue;

      const isAllDay = !event.start?.dateTime;
      const title: string = event.summary || "";
      if (isAllDay && !detectIsOut(title)) continue;

      const tzOffset = "T12:00:00";
      const date = new Date(start.includes("T") ? start : start + tzOffset);
      const dayName = DAYS[date.getDay()];
      if (!(dayName in events)) continue;

      events[dayName].push({
        time: event.start.dateTime ? formatTime(event.start.dateTime) : "All Day",
        title,
        who: detectWho(title),
        isOut: detectIsOut(title),
      });
    }
  }

  return NextResponse.json(events);
}
