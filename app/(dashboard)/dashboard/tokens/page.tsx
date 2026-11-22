import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TokensView } from "./tokens-view";
import type { TokenWorkflowItem, AppRole } from "@/lib/types/database";

export default async function TokensPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get current user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, is_active")
    .eq("id", user.id)
    .single();

  const userRole = (profile?.role || "sales") as AppRole;

  // 1. Fetch Tokens: Attempt from v_tokens_workflow, fallback to joined bookings if view not yet applied
  let tokensList: TokenWorkflowItem[] = [];

  const { data: viewData, error: viewError } = await supabase
    .from("v_tokens_workflow")
    .select("*")
    .order("token_created_at", { ascending: false });

  if (!viewError && viewData) {
    tokensList = viewData as TokenWorkflowItem[];
  } else {
    // Fallback direct join
    const { data: bookingsData } = await supabase
      .from("bookings")
      .select(
        `
        id,
        source,
        status,
        token_amount,
        agreed_rent,
        deposit_amount,
        move_in_date,
        next_rent_due,
        created_at,
        updated_at,
        created_by,
        clients (
          id,
          full_name,
          phone1,
          phone2,
          aadhaar_last4,
          photo_path
        ),
        beds (
          id,
          bed_label,
          base_price,
          status,
          rooms (
            id,
            room_no,
            sharing_type,
            flats (
              id,
              name
            )
          )
        ),
        noc_records (
          id,
          status,
          remarks,
          updated_at,
          done_by
        )
      `
      )
      .or("source.eq.token,status.in.(token,noc_hold,noc_cleared,rejected)")
      .order("created_at", { ascending: false });

    if (bookingsData) {
      tokensList = bookingsData.map((b: any) => {
        const noc = Array.isArray(b.noc_records) ? b.noc_records[0] : b.noc_records;
        return {
          booking_id: b.id,
          source: b.source,
          booking_status: b.status,
          token_amount: Number(b.token_amount || 0),
          agreed_rent: Number(b.agreed_rent || 0),
          deposit_amount: Number(b.deposit_amount || 0),
          move_in_date: b.move_in_date,
          next_rent_due: b.next_rent_due,
          token_created_at: b.created_at,
          booking_updated_at: b.updated_at,
          client_id: b.clients?.id || "",
          client_name: b.clients?.full_name || "Unknown",
          client_phone1: b.clients?.phone1 || "",
          client_phone2: b.clients?.phone2 || null,
          aadhaar_last4: b.clients?.aadhaar_last4 || null,
          photo_path: b.clients?.photo_path || null,
          bed_id: b.beds?.id || "",
          bed_label: b.beds?.bed_label || "",
          bed_base_price: Number(b.beds?.base_price || 0),
          bed_status: b.beds?.status || "vacant",
          room_id: b.beds?.rooms?.id || "",
          room_no: b.beds?.rooms?.room_no || "",
          sharing_type: b.beds?.rooms?.sharing_type || 1,
          flat_id: b.beds?.rooms?.flats?.id || "",
          flat_name: b.beds?.rooms?.flats?.name || "",
          noc_id: noc?.id || null,
          noc_status: noc?.status || null,
          noc_remarks: noc?.remarks || null,
          noc_updated_at: noc?.updated_at || null,
          noc_done_by_name: null,
          created_by_name: null,
        };
      });
    }
  }

  // 2. Fetch Active Flats
  const { data: flats } = await supabase
    .from("flats")
    .select("id, name, address, owner_name, notes, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("name", { ascending: true });

  // 3. Fetch Active Rooms
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, flat_id, room_no, sharing_type, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("room_no", { ascending: true });

  // 4. Fetch Vacant Beds
  const { data: beds } = await supabase
    .from("beds")
    .select(
      `
      id,
      room_id,
      bed_label,
      base_price,
      status,
      created_at,
      updated_at,
      rooms (
        id,
        room_no,
        flats (
          id,
          name
        )
      )
    `
    )
    .eq("status", "vacant")
    .order("bed_label", { ascending: true });

  const vacantBeds = (beds || []).map((b: any) => ({
    id: b.id,
    room_id: b.room_id,
    bed_label: b.bed_label,
    base_price: Number(b.base_price),
    status: b.status,
    created_at: b.created_at,
    updated_at: b.updated_at,
    room_no: b.rooms?.room_no,
    flat_id: b.rooms?.flats?.id,
    flat_name: b.rooms?.flats?.name,
  }));

  return (
    <div className="space-y-6">
      <TokensView
        initialTokens={tokensList}
        flats={flats || []}
        rooms={rooms || []}
        vacantBeds={vacantBeds}
        userRole={userRole}
        userId={user.id}
      />
    </div>
  );
}
