import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const KEY = "shopping:checked";

export async function GET() {
  const checked = (await kv.get<Record<string, boolean>>(KEY)) ?? {};
  return NextResponse.json(checked);
}

export async function POST(request: Request) {
  const checked: Record<string, boolean> = await request.json();
  await kv.set(KEY, checked);
  return NextResponse.json({ ok: true });
}
