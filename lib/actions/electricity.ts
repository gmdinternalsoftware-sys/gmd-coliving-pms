"use server";

import { createClient } from "@/lib/supabase/server";
import {
  generateElectricityBillSchema,
  recordElectricityPaymentSchema,
  type GenerateElectricityBillInput,
  type RecordElectricityPaymentInput,
} from "@/lib/validators";
import { revalidatePath } from "next/cache";

async function verifyAuth(allowedRoles: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized: Please sign in.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, is_active, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    throw new Error("Forbidden: Account is inactive.");
  }

  if (!allowedRoles.includes(profile.role)) {
    throw new Error(
      `Forbidden: Required roles: [${allowedRoles.join(", ")}], but you have role '${profile.role}'.`
    );
  }

  return { user, profile, supabase };
}

/**
 * Generate electricity bill for a flat with room sub-meters and common meter split
 */
export async function generateFlatElectricityBillAction(input: GenerateElectricityBillInput) {
  try {
    const { supabase } = await verifyAuth(["admin", "accounts", "electricity"]);

    const validated = generateElectricityBillSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = validated.data;

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "generate_flat_electricity_bill_atomic",
      {
        p_flat_id: data.flat_id,
        p_period_start: data.period_start,
        p_period_end: data.period_end,
        p_rate_per_unit: data.rate_per_unit,
        p_common_prev: data.common_prev,
        p_common_curr: data.common_curr,
        p_room_readings: data.room_readings,
      }
    );

    if (rpcError) {
      console.error("Generate electricity bill RPC error:", rpcError);
      return { success: false, error: rpcError.message };
    }

    revalidatePath("/dashboard/electricity");
    revalidatePath("/dashboard/dues");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: rpcResult,
    };
  } catch (err: any) {
    console.error("Generate electricity bill error:", err);
    return { success: false, error: err.message || "Failed to generate electricity bill" };
  }
}

/**
 * Record payment for a tenant's electricity bill
 */
export async function recordElectricityPaymentAction(input: RecordElectricityPaymentInput) {
  try {
    const { supabase } = await verifyAuth(["admin", "accounts"]);

    const validated = recordElectricityPaymentSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = validated.data;

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "record_electricity_payment_atomic",
      {
        p_due_id: data.due_id,
        p_amount: data.amount,
        p_mode: data.mode,
        p_paid_on: data.paid_on,
        p_reference: data.reference?.trim() || null,
        p_notes: data.notes?.trim() || null,
      }
    );

    if (rpcError) {
      console.error("Record electricity payment RPC error:", rpcError);
      return { success: false, error: rpcError.message };
    }

    revalidatePath("/dashboard/electricity");
    revalidatePath("/dashboard/dues");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: rpcResult,
    };
  } catch (err: any) {
    console.error("Record electricity payment error:", err);
    return { success: false, error: err.message || "Failed to record electricity payment" };
  }
}

/**
 * Fetch latest readings for flat common meter and each room's sub-meter to auto-populate previous values
 */
export async function getFlatMeterSetupAction(flatId: string) {
  try {
    const { supabase } = await verifyAuth(["admin", "accounts", "electricity", "sales", "noc", "maintenance"]);

    // 1. Get rooms for this flat with active tenant count
    const { data: rooms, error: roomsErr } = await supabase
      .from("rooms")
      .select(`
        id,
        room_no,
        sharing_type,
        beds (
          id,
          status,
          bookings (
            id,
            status,
            client_id
          )
        )
      `)
      .eq("flat_id", flatId)
      .eq("is_active", true)
      .order("room_no", { ascending: true });

    if (roomsErr) {
      return { success: false, error: roomsErr.message };
    }

    // 2. Get latest common reading for flat
    const { data: latestCommon } = await supabase
      .from("electricity_readings")
      .select("meter_value, reading_date")
      .eq("flat_id", flatId)
      .eq("meter_type", "common")
      .order("reading_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Get latest reading for each room
    const roomDetails = await Promise.all(
      (rooms || []).map(async (room) => {
        const { data: latestRoomReading } = await supabase
          .from("electricity_readings")
          .select("meter_value, reading_date")
          .eq("flat_id", flatId)
          .eq("room_id", room.id)
          .eq("meter_type", "room")
          .order("reading_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // count active occupants
        let activeOccupants = 0;
        if (room.beds) {
          for (const bed of room.beds as any[]) {
            if (bed.bookings) {
              for (const bk of bed.bookings) {
                if (bk.status === "active") {
                  activeOccupants++;
                }
              }
            }
          }
        }

        return {
          room_id: room.id,
          room_no: room.room_no,
          sharing_type: room.sharing_type,
          active_occupants: activeOccupants,
          latest_reading: latestRoomReading ? Number(latestRoomReading.meter_value) : 0,
        };
      })
    );

    return {
      success: true,
      data: {
        common_latest_reading: latestCommon ? Number(latestCommon.meter_value) : 0,
        rooms: roomDetails,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch flat meter setup" };
  }
}
