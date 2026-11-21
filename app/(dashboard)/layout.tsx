import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { isDemoMode } from "@/lib/auth/demo-auth";
import { cookies } from "next/headers";
import type { Profile } from "@/lib/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let profile: Profile | null = null;

  // In demo mode, load user profile from demo cookie
  if (isDemoMode()) {
    const cookieStore = await cookies();
    const demoCookie = cookieStore.get("gmd_demo_user");
    if (demoCookie?.value) {
      try {
        profile = JSON.parse(demoCookie.value);
      } catch {
        profile = null;
      }
    }
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: dbProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      profile = dbProfile;
    }
  }

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-y-auto bg-muted/30 p-4 md:p-6">
        {isDemoMode() && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <span>
              <strong>Local Preview Mode:</strong> Logged in as <strong>{profile.full_name}</strong> ({profile.role}). Connect Supabase in <code>.env.local</code> for cloud persistence.
            </span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
