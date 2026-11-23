import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/types/database";

/**
 * Request-scoped cached fetch for current authenticated user and profile.
 * When called multiple times in a single request (e.g. layout + page),
 * it executes only once and shares the result across the render tree.
 */
export const getCurrentUserAndProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null, supabase };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile: (profile as Profile) || null, supabase };
});

/**
 * Require active authentication. If unauthenticated or inactive, redirects to /login.
 */
export async function requireAuth() {
  const { user, profile, supabase } = await getCurrentUserAndProfile();

  if (!user || !profile || !profile.is_active) {
    redirect("/login");
  }

  return { user, profile, supabase };
}
