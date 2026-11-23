import { requireAuth } from "@/lib/auth";
import { CaretakersView } from "./caretakers-view";
import type { Caretaker, AppRole } from "@/lib/types/database";

export default async function CaretakersPage() {
  const { profile, supabase } = await requireAuth();

  const userRole = (profile?.role || "sales") as AppRole;
  const isAdmin = userRole === "admin";

  // Fetch caretakers and flats concurrently
  const [caretakersRes, flatsRes] = await Promise.all([
    supabase
      .from("caretakers")
      .select(`
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
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("flats")
      .select("id, name, address, owner_name, notes, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const caretakers: Caretaker[] = (caretakersRes.data || []).map((c: any) => ({
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

  return (
    <div className="space-y-6">
      <CaretakersView
        initialCaretakers={caretakers}
        flats={flatsRes.data || []}
        isAdmin={isAdmin}
      />
    </div>
  );
}
