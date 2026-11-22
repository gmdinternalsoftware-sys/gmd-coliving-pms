"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptAadhaar } from "@/lib/crypto/aadhaar";
import { revalidatePath } from "next/cache";

async function verifyActiveEmployee() {
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

  if (!profile || !profile.is_active) {
    throw new Error("Forbidden: Account is inactive or unauthorized.");
  }

  return { user, profile, supabase };
}

/**
 * Reveal full Aadhaar number.
 * Enforces Hard Rule #6: Every Aadhaar reveal is audited in audit_log.
 * Plaintext Aadhaar is NEVER logged to console or errors.
 */
export async function revealAadhaarAction(clientId: string): Promise<{
  success: boolean;
  aadhaar?: string;
  error?: string;
}> {
  try {
    const { supabase } = await verifyActiveEmployee();

    // 1. Audit log the reveal via stored procedure
    const { error: auditError } = await supabase.rpc("log_aadhaar_reveal", {
      p_client_id: clientId,
    });

    if (auditError) {
      return { success: false, error: "Failed to record audit entry." };
    }

    // 2. Retrieve encrypted Aadhaar
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("aadhaar_encrypted, aadhaar_last4")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return { success: false, error: "Client record not found." };
    }

    if (!client.aadhaar_encrypted) {
      // Fallback for seed/sample client without ciphertext
      if (client.aadhaar_last4) {
        return {
          success: true,
          aadhaar: `XXXX XXXX ${client.aadhaar_last4}`,
        };
      }
      return { success: false, error: "No Aadhaar number on file for this client." };
    }

    // 3. Decrypt ciphertext
    const decrypted = decryptAadhaar(client.aadhaar_encrypted);
    const formatted = `${decrypted.slice(0, 4)} ${decrypted.slice(4, 8)} ${decrypted.slice(8, 12)}`;

    return { success: true, aadhaar: formatted };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to decrypt Aadhaar.",
    };
  }
}

/**
 * Upload client photo to private bucket 'client-documents'
 * Generates signed URL and updates client.photo_path
 */
export async function uploadClientPhotoAction(
  clientId: string,
  formData: FormData
): Promise<{ success: boolean; photoPath?: string; error?: string }> {
  try {
    const { supabase } = await verifyActiveEmployee();

    const file = formData.get("photo") as File | null;
    if (!file) {
      return { success: false, error: "No image file provided." };
    }

    // Validate size (max 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: "Photo must be less than 5 MB." };
    }

    // Validate mime type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: "Invalid file format. Please upload JPG, PNG, or WebP.",
      };
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `photos/${clientId}-${Date.now()}.${ext}`;

    const adminClient = createAdminClient();

    // Upload to private bucket
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await adminClient.storage
      .from("client-documents")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // Update client record
    const { error: updateError } = await supabase
      .from("clients")
      .update({ photo_path: filePath, updated_at: new Date().toISOString() })
      .eq("id", clientId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath(`/dashboard/clients/${clientId}`);
    revalidatePath("/dashboard/clients");

    return { success: true, photoPath: filePath };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to upload photo." };
  }
}

/**
 * Generate temporary signed URL (1 hour) for private storage photos
 */
export async function getClientPhotoSignedUrl(
  photoPath: string
): Promise<string | null> {
  if (!photoPath) return null;

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.storage
      .from("client-documents")
      .createSignedUrl(photoPath, 3600); // 1 hour

    if (error || !data) {
      return null;
    }

    return data.signedUrl;
  } catch {
    return null;
  }
}
