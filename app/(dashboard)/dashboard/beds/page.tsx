import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InventoryView } from "./inventory-view";
import type { InventoryBedItem, Flat, Room } from "@/lib/types/database";

export default async function BedsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get current user profile for role check
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // Fetch flats
  const { data: flatsData } = await supabase
    .from("flats")
    .select("*")
    .order("name", { ascending: true });

  const flats: Flat[] = flatsData || [];

  // Fetch rooms with flat name
  const { data: roomsData } = await supabase
    .from("rooms")
    .select("*, flats(name)")
    .order("room_no", { ascending: true });

  const rooms: (Room & { flat_name?: string })[] = (roomsData || []).map(
    (r: any) => ({
      id: r.id,
      flat_id: r.flat_id,
      room_no: r.room_no,
      sharing_type: r.sharing_type,
      is_active: r.is_active,
      created_at: r.created_at,
      updated_at: r.updated_at,
      flat_name: r.flats?.name,
    })
  );

  // Fetch beds with room, flat, and live booking/client details
  const { data: bedsData } = await supabase
    .from("beds")
    .select(
      `
      id,
      bed_label,
      base_price,
      status,
      room_id,
      rooms (
        id,
        room_no,
        sharing_type,
        flats (
          id,
          name,
          address
        )
      ),
      bookings (
        id,
        status,
        clients (
          id,
          full_name,
          phone1
        )
      )
    `
    )
    .order("bed_label", { ascending: true });

  // Map to unified InventoryBedItem[]
  const inventoryItems: InventoryBedItem[] = (bedsData || []).map((b: any) => {
    const room = b.rooms;
    const flat = room?.flats;

    // Find live booking (active or token or noc)
    const liveBooking = (b.bookings || []).find((bk: any) =>
      ["token", "noc_hold", "noc_cleared", "active"].includes(bk.status)
    );
    const client = liveBooking?.clients;

    return {
      id: b.id,
      bed_label: b.bed_label,
      base_price: Number(b.base_price),
      status: b.status,
      room_id: room?.id || b.room_id,
      room_no: room?.room_no || "—",
      sharing_type: room?.sharing_type || 1,
      flat_id: flat?.id || "",
      flat_name: flat?.name || "Unassigned",
      flat_address: flat?.address || null,
      tenant_name: client?.full_name || null,
      tenant_phone: client?.phone1 || null,
      booking_status: liveBooking?.status || null,
    };
  });

  return (
    <div className="space-y-6">
      <InventoryView
        initialBeds={inventoryItems}
        flats={flats}
        rooms={rooms}
        isAdmin={isAdmin}
      />
    </div>
  );
}
