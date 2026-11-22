import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { ProfileClient } from "./profile-client";
import { getClientPhotoSignedUrl } from "@/lib/actions/client-profile";

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get employee profile for role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Fetch client details
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) {
    notFound();
  }

  // Fetch all bookings for this client with bed, room, flat details
  const { data: bookingsData } = await supabase
    .from("bookings")
    .select(
      `
      *,
      beds (
        id,
        bed_label,
        rooms (
          id,
          room_no,
          sharing_type,
          flats (
            id,
            name
          )
        )
      )
    `
    )
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  const bookings = (bookingsData || []).map((b: any) => ({
    ...b,
    flat_name: b.beds?.rooms?.flats?.name,
    room_no: b.beds?.rooms?.room_no,
    bed_label: b.beds?.bed_label,
    sharing_type: b.beds?.rooms?.sharing_type,
  }));

  const activeBooking =
    bookings.find((b: any) =>
      ["token", "noc_hold", "noc_cleared", "active"].includes(b.status)
    ) || null;

  const previousBookings = bookings.filter(
    (b: any) => !["token", "noc_hold", "noc_cleared", "active"].includes(b.status)
  );

  // Fetch payment history for all bookings of this client
  const bookingIds = bookings.map((b: any) => b.id);
  let payments: any[] = [];

  if (bookingIds.length > 0) {
    const { data: paymentsData } = await supabase
      .from("payments")
      .select("*")
      .in("booking_id", bookingIds)
      .order("paid_on", { ascending: false });

    payments = paymentsData || [];
  }

  // Get signed URL for photo if present
  let signedPhotoUrl: string | null = null;
  if (client.photo_path) {
    signedPhotoUrl = await getClientPhotoSignedUrl(client.photo_path);
  }

  return (
    <ProfileClient
      client={client}
      activeBooking={activeBooking}
      previousBookings={previousBookings}
      payments={payments}
      initialSignedPhotoUrl={signedPhotoUrl}
      currentRole={profile?.role || "employee"}
    />
  );
}
