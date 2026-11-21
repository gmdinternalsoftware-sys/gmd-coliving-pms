"use server";

import { createClient } from "@/lib/supabase/server";
import {
  flatSchema,
  roomSchema,
  bedSchema,
  type FlatInput,
  type RoomInput,
  type BedInput,
} from "@/lib/validators";
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

// =============================================================================
// FLATS
// =============================================================================
export async function createFlatAction(input: FlatInput) {
  const { supabase } = await verifyAdmin();
  const validated = flatSchema.safeParse(input);

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { error } = await supabase.from("flats").insert({
    name: validated.data.name.trim(),
    address: validated.data.address?.trim() || null,
    owner_name: validated.data.owner_name?.trim() || null,
    notes: validated.data.notes?.trim() || null,
    is_active: validated.data.is_active,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/beds");
  return { success: true };
}

export async function updateFlatAction(id: string, input: FlatInput) {
  const { supabase } = await verifyAdmin();
  const validated = flatSchema.safeParse(input);

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { error } = await supabase
    .from("flats")
    .update({
      name: validated.data.name.trim(),
      address: validated.data.address?.trim() || null,
      owner_name: validated.data.owner_name?.trim() || null,
      notes: validated.data.notes?.trim() || null,
      is_active: validated.data.is_active,
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/beds");
  return { success: true };
}

// =============================================================================
// ROOMS
// =============================================================================
export async function createRoomAction(input: RoomInput) {
  const { supabase } = await verifyAdmin();
  const validated = roomSchema.safeParse(input);

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { error } = await supabase.from("rooms").insert({
    flat_id: validated.data.flat_id,
    room_no: validated.data.room_no.trim(),
    sharing_type: validated.data.sharing_type,
    is_active: validated.data.is_active,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/beds");
  return { success: true };
}

export async function updateRoomAction(id: string, input: Partial<RoomInput>) {
  const { supabase } = await verifyAdmin();

  const { error } = await supabase
    .from("rooms")
    .update({
      ...(input.room_no && { room_no: input.room_no.trim() }),
      ...(input.sharing_type !== undefined && { sharing_type: input.sharing_type }),
      ...(input.is_active !== undefined && { is_active: input.is_active }),
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/beds");
  return { success: true };
}

// =============================================================================
// BEDS
// =============================================================================
export async function createBedAction(input: BedInput) {
  const { supabase } = await verifyAdmin();
  const validated = bedSchema.safeParse(input);

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { error } = await supabase.from("beds").insert({
    room_id: validated.data.room_id,
    bed_label: validated.data.bed_label.trim(),
    base_price: validated.data.base_price,
    status: validated.data.status,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/beds");
  return { success: true };
}

export async function updateBedAction(
  id: string,
  input: {
    bed_label?: string;
    base_price?: number;
    status?: BedInput["status"];
  }
) {
  const { supabase } = await verifyAdmin();

  const { error } = await supabase
    .from("beds")
    .update({
      ...(input.bed_label && { bed_label: input.bed_label.trim() }),
      ...(input.base_price !== undefined && { base_price: input.base_price }),
      ...(input.status && { status: input.status }),
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/beds");
  return { success: true };
}
