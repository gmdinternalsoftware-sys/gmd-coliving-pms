"use server";

import { requireAuth } from "@/lib/auth";
import type { DashboardStats, FlatOccupancyReport } from "@/lib/types/database";

export interface ReportBedItem {
  id: string;
  bed_label: string;
  base_price: number;
  status: string;
  room_no: string;
  sharing_type: number;
  flat_id: string;
  flat_name: string;
  flat_address: string | null;
  tenant_name: string | null;
  tenant_phone: string | null;
  move_in_date: string | null;
  agreed_rent: number | null;
  deposit_amount: number | null;
  next_rent_due: string | null;
  notice_date: string | null;
}

export interface ReportDueItem {
  id: string;
  type: "Rent" | "Electricity";
  client_name: string;
  client_phone: string;
  flat_name: string;
  room_no: string;
  bed_label: string;
  for_period: string;
  due_date: string;
  due_amount: number;
  paid_amount: number;
  balance_due: number;
  days_overdue: number;
  status: string;
}

/**
 * Fetch all high-level dashboard metrics and property occupancy breakdown
 */
export async function getDashboardStatsAction(): Promise<{
  success: boolean;
  data?: DashboardStats;
  error?: string;
}> {
  try {
    const { supabase } = await requireAuth();

    // Current month bounds (UTC/IST)
    const now = new Date();
    const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const lastDayMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];
    const today = now.toISOString().split("T")[0];

    // Concurrently fetch beds, payments this month, tokens this month, and dues
    const [bedsRes, paymentsRes, tokensRes, rentDuesRes, elecDuesRes, flatsRes] =
      await Promise.all([
        supabase.from("beds").select(`
          id,
          status,
          base_price,
          room_id,
          rooms (
            id,
            room_no,
            sharing_type,
            flat_id,
            flats (
              id,
              name,
              address
            )
          )
        `),
        supabase
          .from("payments")
          .select("amount, paid_on, type")
          .gte("paid_on", firstDayMonth)
          .lte("paid_on", lastDayMonth),
        supabase
          .from("bookings")
          .select("id, token_amount, created_at, source")
          .gte("created_at", `${firstDayMonth}T00:00:00Z`)
          .lte("created_at", `${lastDayMonth}T23:59:59Z`),
        supabase
          .from("rent_dues")
          .select("id, amount, paid_amount, due_date, status, booking_id")
          .in("status", ["pending", "partial"]),
        supabase
          .from("tenant_electricity_dues")
          .select("id, total_due, paid_amount, status")
          .in("status", ["pending", "partial"]),
        supabase
          .from("flats")
          .select("id, name, address, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

    const beds = bedsRes.data || [];
    const payments = paymentsRes.data || [];
    const tokens = tokensRes.data || [];
    const rentDues = rentDuesRes.data || [];
    const elecDues = elecDuesRes.data || [];
    const flats = flatsRes.data || [];

    // Bed status counts
    let totalBeds = beds.length;
    let occupiedBeds = 0;
    let vacantBeds = 0;
    let reservedBeds = 0;
    let noticeBeds = 0;
    let blockedBeds = 0;

    // Per-flat occupancy tracking
    const flatStatsMap: Record<string, FlatOccupancyReport> = {};
    flats.forEach((f) => {
      flatStatsMap[f.id] = {
        flat_id: f.id,
        flat_name: f.name,
        flat_address: f.address,
        is_active: f.is_active,
        total_rooms: 0,
        total_beds: 0,
        occupied_beds: 0,
        vacant_beds: 0,
        reserved_beds: 0,
        notice_beds: 0,
        blocked_beds: 0,
        occupancy_rate: 0,
        potential_revenue: 0,
        current_occupied_revenue: 0,
      };
    });

    const flatRoomsSet: Record<string, Set<string>> = {};

    beds.forEach((b: any) => {
      const status = b.status;
      const price = Number(b.base_price || 0);
      const flat = b.rooms?.flats;
      const flatId = flat?.id;
      const roomId = b.room_id;

      if (status === "occupied") occupiedBeds++;
      else if (status === "vacant") vacantBeds++;
      else if (status === "reserved") reservedBeds++;
      else if (status === "notice") {
        noticeBeds++;
        occupiedBeds++; // notice is still occupied
      } else if (status === "blocked") blockedBeds++;

      if (flatId && flatStatsMap[flatId]) {
        if (!flatRoomsSet[flatId]) flatRoomsSet[flatId] = new Set();
        if (roomId) flatRoomsSet[flatId].add(roomId);

        const fs = flatStatsMap[flatId];
        fs.total_beds++;
        fs.potential_revenue += price;

        if (status === "occupied" || status === "notice") {
          fs.occupied_beds++;
          fs.current_occupied_revenue += price;
        } else if (status === "vacant") {
          fs.vacant_beds++;
        } else if (status === "reserved") {
          fs.reserved_beds++;
        } else if (status === "blocked") {
          fs.blocked_beds++;
        }
        if (status === "notice") {
          fs.notice_beds++;
        }
      }
    });

    // Calculate per-flat room counts and occupancy %
    const flatsOccupancy: FlatOccupancyReport[] = Object.values(flatStatsMap).map(
      (fs) => {
        fs.total_rooms = flatRoomsSet[fs.flat_id]?.size || 0;
        fs.occupancy_rate =
          fs.total_beds > 0
            ? Math.round((fs.occupied_beds / fs.total_beds) * 1000) / 10
            : 0;
        return fs;
      }
    );

    const occupancyRate =
      totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0;

    // Tokens this month
    const tokensThisMonthCount = tokens.length;
    let tokensThisMonthAmount = 0;
    tokens.forEach((t) => {
      tokensThisMonthAmount += Number(t.token_amount || 0);
    });

    // Collections this month
    let collectionsThisMonth = 0;
    payments.forEach((p) => {
      collectionsThisMonth += Number(p.amount || 0);
    });

    // Total Overdue (Rent + Electricity)
    let totalOverdueAmount = 0;
    const overdueBookings = new Set<string>();

    rentDues.forEach((rd) => {
      const bal = Number(rd.amount) - Number(rd.paid_amount || 0);
      if (bal > 0 && rd.due_date < today) {
        totalOverdueAmount += bal;
        if (rd.booking_id) overdueBookings.add(rd.booking_id);
      }
    });

    elecDues.forEach((ed) => {
      const bal = Number(ed.total_due) - Number(ed.paid_amount || 0);
      if (bal > 0) {
        totalOverdueAmount += bal;
      }
    });

    return {
      success: true,
      data: {
        totalBeds,
        occupiedBeds,
        vacantBeds,
        reservedBeds,
        noticeBeds,
        blockedBeds,
        occupancyRate,
        tokensThisMonthCount,
        tokensThisMonthAmount,
        collectionsThisMonth,
        totalOverdueAmount,
        overdueTenantsCount: overdueBookings.size,
        flatsOccupancy,
      },
    };
  } catch (err: any) {
    console.error("Error fetching dashboard stats:", err);
    return { success: false, error: err.message || "Failed to load dashboard metrics" };
  }
}

/**
 * Fetch detailed beds and dues data for Reports page and exports
 */
export async function getReportsDataAction(flatId?: string): Promise<{
  success: boolean;
  data?: {
    allBeds: ReportBedItem[];
    occupiedBeds: ReportBedItem[];
    vacantBeds: ReportBedItem[];
    dues: ReportDueItem[];
  };
  error?: string;
}> {
  try {
    const { supabase } = await requireAuth();
    const today = new Date().toISOString().split("T")[0];

    // 1. Fetch beds with room, flat, and live booking/client details
    let bedQuery = supabase.from("beds").select(`
      id,
      bed_label,
      base_price,
      status,
      room_id,
      rooms (
        id,
        room_no,
        sharing_type,
        flat_id,
        flats (
          id,
          name,
          address
        )
      ),
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
        )
      )
    `);

    // 2. Fetch rent dues
    let rentDuesQuery = supabase.from("rent_dues").select(`
      id,
      booking_id,
      for_month,
      due_date,
      amount,
      paid_amount,
      status,
      bookings (
        id,
        clients (
          full_name,
          phone1
        ),
        beds (
          bed_label,
          rooms (
            room_no,
            flat_id,
            flats (
              id,
              name
            )
          )
        )
      )
    `).in("status", ["pending", "partial"]);

    // 3. Fetch electricity dues
    let elecDuesQuery = supabase.from("tenant_electricity_dues").select(`
      id,
      bill_id,
      booking_id,
      total_due,
      paid_amount,
      status,
      clients (
        full_name,
        phone1
      ),
      rooms (
        room_no,
        flat_id,
        flats (
          id,
          name
        )
      ),
      electricity_bills (
        period_start,
        period_end
      )
    `).in("status", ["pending", "partial"]);

    const [bedsRes, rentDuesRes, elecDuesRes] = await Promise.all([
      bedQuery.order("bed_label", { ascending: true }),
      rentDuesQuery.order("due_date", { ascending: true }),
      elecDuesQuery.order("created_at", { ascending: false }),
    ]);

    // Filter beds by flat if selected
    let rawBeds = bedsRes.data || [];
    if (flatId && flatId !== "all") {
      rawBeds = rawBeds.filter((b: any) => b.rooms?.flat_id === flatId);
    }

    const allBeds: ReportBedItem[] = rawBeds.map((b: any) => {
      const room = b.rooms;
      const flat = room?.flats;
      const liveBooking = (b.bookings || []).find((bk: any) =>
        ["token", "noc_hold", "noc_cleared", "active"].includes(bk.status)
      );
      const client = liveBooking?.clients;

      return {
        id: b.id,
        bed_label: b.bed_label,
        base_price: Number(b.base_price || 0),
        status: b.status,
        room_no: room?.room_no || "—",
        sharing_type: room?.sharing_type || 1,
        flat_id: flat?.id || "",
        flat_name: flat?.name || "Unassigned",
        flat_address: flat?.address || null,
        tenant_name: client?.full_name || null,
        tenant_phone: client?.phone1 || null,
        move_in_date: liveBooking?.move_in_date || null,
        agreed_rent: liveBooking?.agreed_rent ? Number(liveBooking.agreed_rent) : null,
        deposit_amount: liveBooking?.deposit_amount ? Number(liveBooking.deposit_amount) : null,
        next_rent_due: liveBooking?.next_rent_due || null,
        notice_date: liveBooking?.notice_date || null,
      };
    });

    const occupiedBeds = allBeds.filter(
      (b) => b.status === "occupied" || b.status === "notice"
    );
    const vacantBeds = allBeds.filter((b) => b.status === "vacant");

    // Dues compilation
    const dues: ReportDueItem[] = [];

    (rentDuesRes.data || []).forEach((rd: any) => {
      const flat = rd.bookings?.beds?.rooms?.flats;
      if (flatId && flatId !== "all" && flat?.id !== flatId) return;

      const dueAmt = Number(rd.amount || 0);
      const paidAmt = Number(rd.paid_amount || 0);
      const bal = dueAmt - paidAmt;
      const daysOverdue = Math.max(
        0,
        Math.floor((Date.now() - new Date(rd.due_date).getTime()) / (1000 * 60 * 60 * 24))
      );

      dues.push({
        id: rd.id,
        type: "Rent",
        client_name: rd.bookings?.clients?.full_name || "Unknown",
        client_phone: rd.bookings?.clients?.phone1 || "—",
        flat_name: flat?.name || "Unknown",
        room_no: rd.bookings?.beds?.rooms?.room_no || "—",
        bed_label: rd.bookings?.beds?.bed_label || "—",
        for_period: rd.for_month || "Current Month",
        due_date: rd.due_date,
        due_amount: dueAmt,
        paid_amount: paidAmt,
        balance_due: bal,
        days_overdue: rd.due_date < today ? daysOverdue : 0,
        status: rd.due_date < today ? "overdue" : rd.status,
      });
    });

    (elecDuesRes.data || []).forEach((ed: any) => {
      const flat = ed.rooms?.flats;
      if (flatId && flatId !== "all" && flat?.id !== flatId) return;

      const dueAmt = Number(ed.total_due || 0);
      const paidAmt = Number(ed.paid_amount || 0);
      const bal = dueAmt - paidAmt;

      dues.push({
        id: ed.id,
        type: "Electricity",
        client_name: ed.clients?.full_name || "Unknown",
        client_phone: ed.clients?.phone1 || "—",
        flat_name: flat?.name || "Unknown",
        room_no: ed.rooms?.room_no || "—",
        bed_label: "—",
        for_period: `${ed.electricity_bills?.period_start || ""} to ${ed.electricity_bills?.period_end || ""}`,
        due_date: ed.electricity_bills?.period_end || today,
        due_amount: dueAmt,
        paid_amount: paidAmt,
        balance_due: bal,
        days_overdue: 0,
        status: ed.status,
      });
    });

    return {
      success: true,
      data: {
        allBeds,
        occupiedBeds,
        vacantBeds,
        dues,
      },
    };
  } catch (err: any) {
    console.error("Error fetching reports data:", err);
    return { success: false, error: err.message || "Failed to load reports data" };
  }
}
