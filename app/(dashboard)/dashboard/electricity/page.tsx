import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ElectricityView } from "./electricity-view";
import type { AppRole, Flat, ElectricityDueOverview, ElectricityBill } from "@/lib/types/database";

export interface ElectricityPaymentItem {
  id: string;
  booking_id: string;
  amount: number;
  mode: string | null;
  paid_on: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  client_name: string;
  client_phone: string;
  flat_name: string;
  room_no: string;
  bed_label: string;
}

export default async function ElectricityPage() {
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
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = (profile?.role || "electricity") as AppRole;

  // 1. Fetch Tenant Electricity Dues (try view first, fallback to table join)
  let duesList: ElectricityDueOverview[] = [];

  const { data: viewDues, error: viewError } = await supabase
    .from("v_electricity_dues_overview")
    .select("*")
    .order("created_at", { ascending: false });

  if (!viewError && viewDues) {
    duesList = viewDues as ElectricityDueOverview[];
  } else {
    // Fallback if view not yet applied in Supabase
    const { data: rawDues } = await supabase
      .from("tenant_electricity_dues")
      .select(`
        id,
        bill_id,
        booking_id,
        client_id,
        room_id,
        room_units,
        room_share_count,
        room_amount,
        common_units,
        common_share_count,
        common_amount,
        total_due,
        paid_amount,
        status,
        created_at,
        clients (
          full_name,
          phone1
        ),
        rooms (
          room_no,
          flats (
            id,
            name
          )
        ),
        electricity_bills (
          period_start,
          period_end,
          rate,
          total_amount
        )
      `)
      .order("created_at", { ascending: false });

    if (rawDues) {
      duesList = rawDues.map((d: any) => ({
        due_id: d.id,
        bill_id: d.bill_id,
        booking_id: d.booking_id,
        client_id: d.client_id,
        room_id: d.room_id,
        room_units: Number(d.room_units || 0),
        room_share_count: Number(d.room_share_count || 1),
        room_amount: Number(d.room_amount || 0),
        common_units: Number(d.common_units || 0),
        common_share_count: Number(d.common_share_count || 1),
        common_amount: Number(d.common_amount || 0),
        total_due: Number(d.total_due || 0),
        paid_amount: Number(d.paid_amount || 0),
        balance_due: Number(d.total_due || 0) - Number(d.paid_amount || 0),
        status: d.status,
        created_at: d.created_at,
        client_name: d.clients?.full_name || "Unknown Client",
        client_phone: d.clients?.phone1 || "-",
        room_no: d.rooms?.room_no || "-",
        flat_id: d.rooms?.flats?.id || "",
        flat_name: d.rooms?.flats?.name || "Unknown Flat",
        period_start: d.electricity_bills?.period_start || "",
        period_end: d.electricity_bills?.period_end || "",
        rate_per_unit: Number(d.electricity_bills?.rate || 0),
        bill_total_amount: Number(d.electricity_bills?.total_amount || 0),
      }));
    }
  }

  // 2. Fetch Master Electricity Bills
  const { data: rawBills } = await supabase
    .from("electricity_bills")
    .select(`
      id,
      flat_id,
      period_start,
      period_end,
      rate,
      units,
      total_amount,
      common_units,
      common_amount,
      rooms_total_units,
      rooms_total_amount,
      total_occupied_beds,
      status,
      created_by,
      created_at,
      flats (
        name
      )
    `)
    .order("period_end", { ascending: false });

  const billsList: ElectricityBill[] = (rawBills || []).map((b: any) => ({
    id: b.id,
    flat_id: b.flat_id,
    period_start: b.period_start,
    period_end: b.period_end,
    rate: Number(b.rate || 0),
    units: Number(b.units || 0),
    total_amount: Number(b.total_amount || 0),
    common_units: Number(b.common_units || 0),
    common_amount: Number(b.common_amount || 0),
    rooms_total_units: Number(b.rooms_total_units || 0),
    rooms_total_amount: Number(b.rooms_total_amount || 0),
    total_occupied_beds: Number(b.total_occupied_beds || 1),
    status: b.status || "generated",
    created_by: b.created_by,
    created_at: b.created_at,
    flat_name: b.flats?.name || "Unknown Flat",
  }));

  // 3. Fetch Recent Electricity Payments
  const { data: rawPayments } = await supabase
    .from("payments")
    .select(`
      id,
      booking_id,
      amount,
      mode,
      paid_on,
      reference,
      notes,
      created_at,
      bookings (
        clients (
          full_name,
          phone1
        ),
        beds (
          bed_label,
          rooms (
            room_no,
            flats (
              name
            )
          )
        )
      )
    `)
    .eq("type", "electricity")
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  const paymentsList: ElectricityPaymentItem[] = (rawPayments || []).map((p: any) => ({
    id: p.id,
    booking_id: p.booking_id,
    amount: Number(p.amount || 0),
    mode: p.mode,
    paid_on: p.paid_on,
    reference: p.reference,
    notes: p.notes,
    created_at: p.created_at,
    client_name: p.bookings?.clients?.full_name || "Unknown Client",
    client_phone: p.bookings?.clients?.phone1 || "-",
    flat_name: p.bookings?.beds?.rooms?.flats?.name || "Unknown Flat",
    room_no: p.bookings?.beds?.rooms?.room_no || "-",
    bed_label: p.bookings?.beds?.bed_label || "-",
  }));

  // 4. Fetch Active Flats
  const { data: flats } = await supabase
    .from("flats")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <ElectricityView
      initialDues={duesList}
      bills={billsList}
      payments={paymentsList}
      flats={(flats as Flat[]) || []}
      userRole={userRole}
    />
  );
}
