import { requireAuth } from "@/lib/auth";
import { ClientsView, type ClientWithBooking } from "./clients-view";

export default async function ClientsPage() {
  const { profile, supabase } = await requireAuth();
  const isAdmin = profile?.role === "admin";

  // Fetch all clients with their active/current bookings
  const { data: clientsData } = await supabase
    .from("clients")
    .select(`
      *,
      bookings (
        id,
        status,
        beds (
          id,
          bed_label,
          rooms (
            id,
            room_no,
            flats (
              id,
              name
            )
          )
        )
      )
    `)
    .order("created_at", { ascending: false });

  // Map to ClientWithBooking format
  const clients: ClientWithBooking[] = (clientsData || []).map((c: any) => {
    // Find active booking
    const activeBooking = (c.bookings || []).find((b: any) =>
      ["token", "noc_hold", "noc_cleared", "active"].includes(b.status)
    );

    const bed = activeBooking?.beds;
    const room = bed?.rooms;
    const flat = room?.flats;

    return {
      id: c.id,
      full_name: c.full_name,
      aadhaar_encrypted: c.aadhaar_encrypted,
      aadhaar_last4: c.aadhaar_last4,
      aadhaar_hash: c.aadhaar_hash,
      phone1: c.phone1,
      phone2: c.phone2,
      emergency_contact_name: c.emergency_contact_name,
      emergency_contact_phone: c.emergency_contact_phone,
      photo_path: c.photo_path,
      aadhaar_doc_path: c.aadhaar_doc_path,
      profile_complete: c.profile_complete,
      created_by: c.created_by,
      created_at: c.created_at,
      updated_at: c.updated_at,
      active_flat_name: flat?.name || null,
      active_room_no: room?.room_no || null,
      active_bed_label: bed?.bed_label || null,
      booking_status: activeBooking?.status || null,
    };
  });

  return (
    <div className="space-y-6">
      <ClientsView initialClients={clients} isAdmin={isAdmin} />
    </div>
  );
}
