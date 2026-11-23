"use server";

import { createClient } from "@/lib/supabase/server";
import {
  recordPaymentSchema,
  generateMonthlyRentSchema,
  setNoticeSchema,
  processMoveOutSchema,
  type RecordPaymentInput,
  type GenerateMonthlyRentInput,
  type SetNoticeInput,
  type ProcessMoveOutInput,
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
 * Record a payment against a booking/rent demand (Accounts or Admin).
 */
export async function recordPaymentAction(input: RecordPaymentInput) {
  try {
    const { supabase } = await verifyAuth(["admin", "accounts"]);

    const validated = recordPaymentSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = validated.data;

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "record_payment_atomic",
      {
        p_booking_id: data.booking_id,
        p_rent_due_id: data.rent_due_id || null,
        p_type: data.type,
        p_amount: data.amount,
        p_mode: data.mode,
        p_paid_on: data.paid_on,
        p_for_month: data.for_month || null,
        p_reference: data.reference?.trim() || null,
        p_notes: data.notes?.trim() || null,
      }
    );

    if (rpcError) {
      console.error("Record payment RPC error:", rpcError);
      return { success: false, error: rpcError.message };
    }

    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/clients");

    return { success: true, data: rpcResult };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record payment." };
  }
}

/**
 * Generate monthly rents for all active bookings (Accounts or Admin).
 */
export async function generateMonthlyRentAction(input: GenerateMonthlyRentInput) {
  try {
    const { supabase } = await verifyAuth(["admin", "accounts"]);

    const validated = generateMonthlyRentSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors.map((e) => e.message).join(", "),
      };
    }

    let forMonth = validated.data.for_month;
    if (forMonth.length === 7) {
      forMonth = `${forMonth}-01`;
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "generate_monthly_rents_atomic",
      {
        p_for_month: forMonth,
      }
    );

    if (rpcError) {
      console.error("Generate rents RPC error:", rpcError);
      return { success: false, error: rpcError.message };
    }

    revalidatePath("/dashboard/payments");

    return { success: true, data: rpcResult };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to generate monthly rents." };
  }
}

/**
 * Put tenant on notice with planned move out date (Accounts or Admin).
 */
export async function setNoticeAction(input: SetNoticeInput) {
  try {
    const { supabase } = await verifyAuth(["admin", "accounts", "sales"]);

    const validated = setNoticeSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = validated.data;

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "set_tenant_notice_atomic",
      {
        p_booking_id: data.booking_id,
        p_notice_date: data.notice_date,
        p_expected_move_out_date: data.expected_move_out_date,
        p_notes: data.notes?.trim() || null,
      }
    );

    if (rpcError) {
      console.error("Set notice RPC error:", rpcError);
      return { success: false, error: rpcError.message };
    }

    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/beds");
    revalidatePath("/dashboard/clients");

    return { success: true, data: rpcResult };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to put tenant on notice." };
  }
}

/**
 * Complete move out settlement and free bed (Accounts or Admin).
 */
export async function processMoveOutAction(input: ProcessMoveOutInput) {
  try {
    const { supabase } = await verifyAuth(["admin", "accounts"]);

    const validated = processMoveOutSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = validated.data;

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "process_move_out_atomic",
      {
        p_booking_id: data.booking_id,
        p_actual_move_out_date: data.actual_move_out_date,
        p_deductions_amount: data.deductions_amount,
        p_deductions_reason: data.deductions_reason?.trim() || null,
        p_refund_amount: data.refund_amount,
        p_refund_mode: data.refund_mode,
        p_refund_reference: data.refund_reference?.trim() || null,
        p_notes: data.notes?.trim() || null,
      }
    );

    if (rpcError) {
      console.error("Process move out RPC error:", rpcError);
      return { success: false, error: rpcError.message };
    }

    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/beds");
    revalidatePath("/dashboard/clients");

    return { success: true, data: rpcResult };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to complete move-out." };
  }
}
