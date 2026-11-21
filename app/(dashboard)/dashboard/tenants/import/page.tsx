import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BulkImportClient } from "./bulk-import-client";

export default async function BulkImportPage() {
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
          Bulk import is restricted to Admin personnel only.
        </p>
      </div>
    );
  }

  // Fetch all flats, rooms, and beds for validation
  const { data: flats } = await supabase
    .from("flats")
    .select("id, name")
    .eq("is_active", true);

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, flat_id, room_no")
    .eq("is_active", true);

  const { data: beds } = await supabase
    .from("beds")
    .select("id, room_id, bed_label, base_price, status");

  return (
    <div className="space-y-6">
      <BulkImportClient
        flats={flats || []}
        rooms={rooms || []}
        beds={beds || []}
      />
    </div>
  );
}
