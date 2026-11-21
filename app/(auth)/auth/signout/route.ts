import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete("gmd_demo_user");

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {}

  const url = new URL("/login", request.url);
  return NextResponse.redirect(url);
}
