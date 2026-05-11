import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("meals")
    .select("name, ingredients")
    .order("name");

  if (error) return NextResponse.json([], { status: 500 });
  return NextResponse.json(data ?? []);
}
