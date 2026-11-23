import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PaymentsView, type RecentPaymentItem, type ActiveTenantBooking } from "./payments-view";
import type { DueOverviewItem, AppRole } from "@/lib/types/database";

export default async function PaymentsPage() {
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

  const userRole = (profile?.role || "accounts") as AppRole;

  // 1. Fetch Dues Overview (from v_dues_overview or fallback query)
  let duesList: DueOverviewItem[] = [];

  const { data: viewDues, error: viewError } = await supabase
    .from("v_dues_overview")
    .select("*")
    .order("due_date", { ascending: true });

  if (!viewError && viewDues) {
    duesList = viewDues as DueOverviewItem[];
  } else {
    // Fallback if view not yet applied in Supabase
    const { data: rawDues } = await supabase
      .from("rent_dues")
      .select(
        `
        id,
        booking_id,
        for_month,
        due_date,
        amount,
        paid_amount,
        status,
        created_at,
        bookings (
          id,
          status,
          agreed_rent,
          deposit_amount,
          move_in_date,
          next_rent_due,
          notice_date,
          clients (
            id,
            full_name,
            phone1
          ),
          beds (
            id,
            bed_label,
            status,
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
      `
      )
      .order("due_date", { ascending: true });

    if (rawDues) {
      duesList = rawDues.map((d: any) => {
        const bk = d.bookings;
        const dueAmt = Number(d.amount);
        const paidAmt = Number(d.paid_amount || 0);
        const bal = dueAmt - paidAmt;
        const isOverdue = new Date(d.due_date) < new Date() && d.status !== "paid";
        const daysDiff = Math.max(
          0,
          Math.floor((Date.now() - new Date(d.due_date).getTime()) / (1000 * 60 * 60 * 24))
        );

        return {
          due_id: d.id,
          booking_id: d.booking_id,
          for_month: d.for_month,
          due_date: d.due_date,
          due_amount: dueAmt,
          paid_amount: paidAmt,
          balance_due: bal,
          calculated_status: (d.status === "paid" ? "paid" : isOverdue ? "overdue" : "pending") as any,
          days_overdue: isOverdue ? daysDiff : 0,
          demand_generated_at: d.created_at,
          client_id: bk?.clients?.id || "",
          client_name: bk?.clients?.full_name || "Unknown",
          client_phone1: bk?.clients?.phone1 || "",
          bed_id: bk?.beds?.id || "",
          bed_label: bk?.beds?.bed_label || "",
          bed_status: bk?.beds?.status || "occupied",
          room_id: bk?.beds?.rooms?.id || "",
          room_no: bk?.beds?.rooms?.room_no || "",
          flat_id: bk?.beds?.rooms?.flats?.id || "",
          flat_name: bk?.beds?.rooms?.flats?.name || "",
          booking_status: bk?.status || "active",
          agreed_rent: Number(bk?.agreed_rent || 0),
          deposit_amount: Number(bk?.deposit_amount || 0),
          move_in_date: bk?.move_in_date || null,
          next_rent_due: bk?.next_rent_due || null,
          notice_date: bk?.notice_date || null,
        };
      });
    }
  }

  // 2. Fetch Recent Payments for Ledger
  const { data: paymentsData } = await supabase
    .from("payments")
    .select(
      `
      id,
      booking_id,
      type,
      amount,
      mode,
      for_month,
      paid_on,
      reference,
      notes,
      created_at,
      bookings (
        id,
        clients (
          id,
          full_name,
          phone1
        ),
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
    `
    )
    .order("paid_on", { ascending: false })
    .limit(100);

  const recentPayments: RecentPaymentItem[] = (paymentsData || []).map((p: any) => ({
    id: p.id,
    booking_id: p.booking_id,
    type: p.type,
    amount: Number(p.amount),
    mode: p.mode,
    for_month: p.for_month,
    paid_on: p.paid_on,
    reference: p.reference,
    notes: p.notes,
    created_at: p.created_at,
    client_id: p.bookings?.clients?.id || "",
    client_name: p.bookings?.clients?.full_name || "Unknown",
    client_phone: p.bookings?.clients?.phone1 || "",
    flat_name: p.bookings?.beds?.rooms?.flats?.name || "",
    room_no: p.bookings?.beds?.rooms?.room_no || "",
    bed_label: p.bookings?.beds?.bed_label || "",
  }));

  // 3. Fetch Active Bookings (for recording payments & notice)
  const { data: activeBookingsData } = await supabase
    .from("bookings")
    .select(
      `
      id,
      agreed_rent,
      deposit_amount,
      move_in_date,
      next_rent_due,
      notice_date,
      move_out_date,
      clients (
        id,
        full_name,
        phone1
      ),
      beds (
        id,
        bed_label,
        status,
        rooms (
          id,
          room_no,
          flats (
            id,
            name
          )
        )
      )
    `
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const activeBookings: ActiveTenantBooking[] = (activeBookingsData || []).map((b: any) => ({
    id: b.id,
    client_id: b.clients?.id || "",
    client_name: b.clients?.full_name || "Unknown",
    client_phone: b.clients?.phone1 || "",
    bed_id: b.beds?.id || "",
    bed_label: b.beds?.bed_label || "",
    room_no: b.beds?.rooms?.room_no || "",
    flat_name: b.beds?.rooms?.flats?.name || "",
    agreed_rent: Number(b.agreed_rent),
    deposit_amount: Number(b.deposit_amount || 0),
    move_in_date: b.move_in_date,
    next_rent_due: b.next_rent_due,
    notice_date: b.notice_date,
    move_out_date: b.move_out_date,
    bed_status: b.beds?.status || "occupied",
  }));

  // 4. Fetch Flats
  const { data: flats } = await supabase
    .from("flats")
    .select("id, name, address, owner_name, notes, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <PaymentsView
        initialDues={duesList}
        recentPayments={recentPayments}
        activeBookings={activeBookings}
        flats={flats || []}
        userRole={userRole}
      />
    </div>
  );
}
