import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AddTenantForm } from "./add-tenant-form";

export default async function AddTenantPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Admin-only check
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-lg border bg-card p-6 text-center">
        <h2 className="text-xl font-bold text-destructive">Access Restricted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Onboarding existing tenants is restricted to Admin personnel only.
        </p>
      </div>
    );
  }

  // Fetch active flats
  const { data: flats } = await supabase
    .from("flats")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  // Fetch all rooms
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, flat_id, room_no, sharing_type, is_active")
    .eq("is_active", true)
    .order("room_no", { ascending: true });

  // Fetch only non-occupied beds (vacant or blocked)
  const { data: beds } = await supabase
    .from("beds")
    .select("id, room_id, bed_label, base_price, status")
    .in("status", ["vacant", "blocked"])
    .order("bed_label", { ascending: true });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <AddTenantForm
        flats={flats || []}
        rooms={rooms || []}
        beds={beds || []}
      />
    </div>
  );
}
