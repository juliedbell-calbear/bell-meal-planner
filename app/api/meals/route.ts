import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ROW_KEY = "plan";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("shopping_list")
    .select("value")
    .eq("key", ROW_KEY)
    .maybeSingle();

  if (error) return NextResponse.json({}, { status: 500 });
  return NextResponse.json(data?.value ?? {});
}

export async function POST(request: Request) {
  const supabase = getClient();
  const value = await request.json();

  const { error } = await supabase
    .from("shopping_list")
    .upsert({ key: ROW_KEY, value }, { onConflict: "key" });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
