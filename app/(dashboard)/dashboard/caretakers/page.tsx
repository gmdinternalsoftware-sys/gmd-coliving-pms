import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CaretakersView } from "./caretakers-view";
import type { Caretaker, AppRole } from "@/lib/types/database";

export default async function CaretakersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = (profile?.role || "sales") as AppRole;
  const isAdmin = userRole === "admin";

  // Fetch all caretakers with their assigned flat details
  const { data: rawCaretakers } = await supabase
    .from("caretakers")
    .select(
      `
      id,
      flat_id,
      name,
      phone,
      alternate_phone,
      notes,
      is_active,
      created_at,
      updated_at,
      flats (
        id,
        name,
        address
      )
    `
    )
    .order("created_at", { ascending: false });

  const caretakers: Caretaker[] = (rawCaretakers || []).map((c: any) => ({
    id: c.id,
    flat_id: c.flat_id,
    name: c.name,
    phone: c.phone,
    alternate_phone: c.alternate_phone,
    notes: c.notes,
    is_active: c.is_active,
    created_at: c.created_at,
    updated_at: c.updated_at,
    flat_name: c.flats?.name || "Unknown Property",
    flat_address: c.flats?.address || null,
  }));

  // Fetch active flats for the Add Caretaker form
  const { data: flats } = await supabase
    .from("flats")
    .select("id, name, address, owner_name, notes, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <CaretakersView
        initialCaretakers={caretakers}
        flats={flats || []}
        isAdmin={isAdmin}
      />
    </div>
  );
}
