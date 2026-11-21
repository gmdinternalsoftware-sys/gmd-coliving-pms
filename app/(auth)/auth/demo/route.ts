import { NextResponse } from "next/server";
import { DEMO_USERS, isDemoMode } from "@/lib/auth/demo-auth";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo mode is not enabled" }, { status: 400 });
  }

  const { email } = await request.json();
  const demoAccount = DEMO_USERS[email?.toLowerCase()];

  if (!demoAccount) {
    return NextResponse.json({ error: "Invalid demo user email" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set("gmd_demo_user", JSON.stringify(demoAccount.profile), {
    path: "/",
    httpOnly: false, // Accessible for client-side display if needed
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return NextResponse.json({ success: true, profile: demoAccount.profile });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("gmd_demo_user");
  return NextResponse.json({ success: true });
}
