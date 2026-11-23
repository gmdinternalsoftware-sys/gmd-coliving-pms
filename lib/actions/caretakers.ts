"use server";

import { createClient } from "@/lib/supabase/server";
import { caretakerSchema, type CaretakerInput } from "@/lib/validators";
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
 * Add a new caretaker (Admin only).
 */
export async function addCaretakerAction(input: CaretakerInput) {
  try {
    const { supabase } = await verifyAuth(["admin"]);

    const validated = caretakerSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = validated.data;

    const { data: inserted, error: insertError } = await supabase
      .from("caretakers")
      .insert({
        flat_id: data.flat_id,
        name: data.name.trim(),
        phone: data.phone.trim(),
        alternate_phone: data.alternate_phone?.trim() || null,
        notes: data.notes?.trim() || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Add caretaker error:", insertError);
      return { success: false, error: insertError.message };
    }

    revalidatePath("/dashboard/caretakers");

    return { success: true, data: inserted };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to add caretaker." };
  }
}

/**
 * Delete a caretaker (Admin only).
 */
export async function deleteCaretakerAction(id: string) {
  try {
    const { supabase } = await verifyAuth(["admin"]);

    if (!id) {
      return { success: false, error: "Invalid caretaker ID." };
    }

    const { error: deleteError } = await supabase
      .from("caretakers")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete caretaker error:", deleteError);
      return { success: false, error: deleteError.message };
    }

    revalidatePath("/dashboard/caretakers");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete caretaker." };
  }
}
