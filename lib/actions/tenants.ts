"use server";

import { createClient } from "@/lib/supabase/server";
import {
  existingTenantSchema,
  clientCorrectionSchema,
  type ExistingTenantInput,
  type ClientCorrectionInput,
} from "@/lib/validators";
import { processAadhaarForStorage } from "@/lib/crypto/aadhaar";
import { revalidatePath } from "next/cache";

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized: Please sign in.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active || profile.role !== "admin") {
    throw new Error("Forbidden: Only active admins can perform this action.");
  }

  return { adminUser: user, supabase };
}

/**
 * Onboard a single existing tenant atomically.
 */
export async function addExistingTenantAction(input: ExistingTenantInput) {
  const { supabase } = await verifyAdmin();

  const validated = existingTenantSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors.map((e) => e.message).join(", "),
    };
  }

  const data = validated.data;

  // Process Aadhaar encryption & hash if provided
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
      return { success: false, error: err.message || "Aadhaar processing failed." };
    }
  }

  // Call atomic RPC
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "add_existing_tenant_atomic",
    {
      p_full_name: data.full_name,
      p_aadhaar_encrypted: aadhaar_encrypted,
      p_aadhaar_last4: aadhaar_last4,
      p_aadhaar_hash: aadhaar_hash,
      p_phone1: data.phone1,
      p_phone2: data.phone2 || null,
      p_emergency_name: data.emergency_contact_name || null,
      p_emergency_phone: data.emergency_contact_phone || null,
      p_photo_path: data.photo_path || null,
      p_bed_id: data.bed_id,
      p_move_in_date: data.move_in_date,
      p_agreed_rent: data.agreed_rent,
      p_deposit_amount: data.deposit_amount,
      p_next_rent_due: data.next_rent_due,
      p_opening_dues: data.opening_dues || 0,
    }
  );

  if (rpcError) {
    return { success: false, error: rpcError.message };
  }

  revalidatePath("/dashboard/beds");
  revalidatePath("/dashboard/clients");

  return {
    success: true,
    clientId: rpcResult?.client_id,
    bookingId: rpcResult?.booking_id,
  };
}

/**
 * Bulk import multiple existing tenants.
 */
export async function bulkImportTenantsAction(records: ExistingTenantInput[]) {
  const { supabase } = await verifyAdmin();

  if (!records || records.length === 0) {
    return { success: false, error: "No records provided for import." };
  }

  const results: {
    index: number;
    tenant_name: string;
    success: boolean;
    error?: string;
  }[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    try {
      const validated = existingTenantSchema.safeParse(row);
      if (!validated.success) {
        results.push({
          index: i + 1,
          tenant_name: row.full_name || `Row ${i + 1}`,
          success: false,
          error: validated.error.errors.map((e) => e.message).join(", "),
        });
        continue;
      }

      const data = validated.data;
      let aadhaar_encrypted: string | null = null;
      let aadhaar_last4: string | null = null;
      let aadhaar_hash: string | null = null;

      if (data.aadhaar && data.aadhaar.trim().length === 12) {
        const processed = processAadhaarForStorage(data.aadhaar);
        aadhaar_encrypted = processed.aadhaar_encrypted;
        aadhaar_last4 = processed.aadhaar_last4;
        aadhaar_hash = processed.aadhaar_hash;
      }

      const { error: rpcError } = await supabase.rpc(
        "add_existing_tenant_atomic",
        {
          p_full_name: data.full_name,
          p_aadhaar_encrypted: aadhaar_encrypted,
          p_aadhaar_last4: aadhaar_last4,
          p_aadhaar_hash: aadhaar_hash,
          p_phone1: data.phone1,
          p_phone2: data.phone2 || null,
          p_emergency_name: data.emergency_contact_name || null,
          p_emergency_phone: data.emergency_contact_phone || null,
          p_photo_path: data.photo_path || null,
          p_bed_id: data.bed_id,
          p_move_in_date: data.move_in_date,
          p_agreed_rent: data.agreed_rent,
          p_deposit_amount: data.deposit_amount,
          p_next_rent_due: data.next_rent_due,
          p_opening_dues: data.opening_dues || 0,
        }
      );

      if (rpcError) {
        results.push({
          index: i + 1,
          tenant_name: data.full_name,
          success: false,
          error: rpcError.message,
        });
      } else {
        results.push({
          index: i + 1,
          tenant_name: data.full_name,
          success: true,
        });
      }
    } catch (err: any) {
      results.push({
        index: i + 1,
        tenant_name: row.full_name || `Row ${i + 1}`,
        success: false,
        error: err.message || "Unknown error during row import.",
      });
    }
  }

  revalidatePath("/dashboard/beds");
  revalidatePath("/dashboard/clients");

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  return {
    success: true,
    totalCount: records.length,
    successCount,
    failureCount,
    details: results,
  };
}

/**
 * Admin manual correction of client profile details (logged in audit_log via DB trigger).
 */
export async function updateClientManualAction(input: ClientCorrectionInput) {
  const { supabase } = await verifyAdmin();

  const validated = clientCorrectionSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { id, full_name, phone1, phone2, emergency_contact_name, emergency_contact_phone } =
    validated.data;

  const { error } = await supabase
    .from("clients")
    .update({
      full_name: full_name.trim(),
      phone1: phone1.trim(),
      phone2: phone2?.trim() || null,
      emergency_contact_name: emergency_contact_name?.trim() || null,
      emergency_contact_phone: emergency_contact_phone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/clients");
  return { success: true };
}
