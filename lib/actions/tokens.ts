"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createTokenSchema,
  updateNocSchema,
  confirmMoveInSchema,
  type CreateTokenInput,
  type UpdateNocInput,
  type ConfirmMoveInInput,
} from "@/lib/validators";
import { processAadhaarForStorage } from "@/lib/crypto/aadhaar";
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
 * Create a new Token booking (Sales or Admin).
 */
export async function createTokenAction(input: CreateTokenInput) {
  try {
    const { supabase } = await verifyAuth(["admin", "sales"]);

    const validated = createTokenSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = validated.data;

    // Process Aadhaar if supplied
    let aadhaar_encrypted: string | null = null;
    let aadhaar_last4: string | null = null;
    let aadhaar_hash: string | null = null;

    if (data.aadhaar && data.aadhaar.trim().length === 12) {
      try {
        const processed = processAadhaarForStorage(data.aadhaar);
        aadhaar_encrypted = processed.aadhaar_encrypted;
        aadhaar_last4 = processed.aadhaar_last4;
        aadhaar_hash = processed.aadhaar_hash;
      } catch (err: any) {
        return { success: false, error: err.message || "Failed to process Aadhaar." };
      }
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "create_token_booking_atomic",
      {
        p_full_name: data.full_name.trim(),
        p_phone1: data.phone1.trim(),
        p_phone2: data.phone2?.trim() || null,
        p_emergency_name: data.emergency_name?.trim() || null,
        p_emergency_phone: data.emergency_phone?.trim() || null,
        p_aadhaar_encrypted: aadhaar_encrypted,
        p_aadhaar_last4: aadhaar_last4,
        p_aadhaar_hash: aadhaar_hash,
        p_bed_id: data.bed_id,
        p_agreed_rent: data.agreed_rent,
        p_token_amount: data.token_amount,
        p_move_in_date: data.move_in_date || null,
        p_payment_mode: data.payment_mode,
        p_payment_reference: data.payment_reference?.trim() || null,
        p_notes: data.notes?.trim() || null,
      }
    );

    if (rpcError) {
      console.error("Create token RPC error:", rpcError);
      return { success: false, error: rpcError.message };
    }

    revalidatePath("/dashboard/tokens");
    revalidatePath("/dashboard/beds");
    revalidatePath("/dashboard/clients");

    return { success: true, data: rpcResult };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Update NOC status: cleared, hold, or rejected (NOC or Admin).
 */
export async function updateNocStatusAction(input: UpdateNocInput) {
  try {
    const { supabase } = await verifyAuth(["admin", "noc"]);

    const validated = updateNocSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { booking_id, status, remarks } = validated.data;

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "update_noc_status_atomic",
      {
        p_booking_id: booking_id,
        p_status: status,
        p_remarks: remarks.trim(),
      }
    );

    if (rpcError) {
      console.error("NOC update RPC error:", rpcError);
      return { success: false, error: rpcError.message };
    }

    revalidatePath("/dashboard/tokens");
    revalidatePath("/dashboard/beds");

    return { success: true, data: rpcResult };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update NOC status." };
  }
}

/**
 * Confirm Move-In and record Deposit & First Month Rent (Accounts or Admin).
 */
export async function confirmMoveInAction(input: ConfirmMoveInInput) {
  try {
    const { supabase } = await verifyAuth(["admin", "accounts"]);

    const validated = confirmMoveInSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = validated.data;

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "confirm_accounts_move_in_atomic",
      {
        p_booking_id: data.booking_id,
        p_actual_move_in_date: data.actual_move_in_date,
        p_deposit_amount: data.deposit_amount,
        p_deposit_mode: data.deposit_mode,
        p_deposit_reference: data.deposit_reference?.trim() || null,
        p_rent_amount: data.rent_amount,
        p_rent_mode: data.rent_mode,
        p_rent_reference: data.rent_reference?.trim() || null,
        p_next_rent_due: data.next_rent_due || null,
        p_notes: data.notes?.trim() || null,
      }
    );

    if (rpcError) {
      console.error("Confirm move-in RPC error:", rpcError);
      return { success: false, error: rpcError.message };
    }

    revalidatePath("/dashboard/tokens");
    revalidatePath("/dashboard/beds");
    revalidatePath("/dashboard/clients");

    return { success: true, data: rpcResult };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to confirm move-in." };
  }
}
