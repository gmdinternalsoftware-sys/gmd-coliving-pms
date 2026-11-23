import { requireAuth } from "@/lib/auth";
import { InventoryView } from "./inventory-view";
import type { InventoryBedItem, Flat, Room } from "@/lib/types/database";

export default async function BedsPage() {
  const { profile, supabase } = await requireAuth();
  const isAdmin = profile?.role === "admin";

  // Fetch flats, rooms, and beds concurrently in parallel
  const [flatsRes, roomsRes, bedsRes] = await Promise.all([
    supabase
      .from("flats")
      .select("*")
      .order("name", { ascending: true }),
    supabase
      .from("rooms")
      .select("*, flats(name)")
      .order("room_no", { ascending: true }),
    supabase
      .from("beds")
      .select(`
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
      `)
      .order("bed_label", { ascending: true }),
  ]);

  const flats: Flat[] = flatsRes.data || [];

  const rooms: (Room & { flat_name?: string })[] = (roomsRes.data || []).map(
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

  const inventoryItems: InventoryBedItem[] = (bedsRes.data || []).map((b: any) => {
    const room = b.rooms;
    const flat = room?.flats;

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
