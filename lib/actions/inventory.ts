"use server";

import { createClient } from "@/lib/supabase/server";
import {
  flatSchema,
  flatWithRoomsSchema,
  roomSchema,
  bedSchema,
  type FlatInput,
  type FlatWithRoomsInput,
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
export async function createFlatAction(input: FlatInput | FlatWithRoomsInput) {
  const { supabase } = await verifyAdmin();
  const validated = flatWithRoomsSchema.safeParse(input);

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors.map((e) => e.message).join(", "),
    };
  }

  const roomsInput = validated.data.rooms || [];

  // Validate no duplicate room_no within the new flat, and no duplicate bed_label within a room
  const seenRooms = new Set<string>();
  for (const r of roomsInput) {
    const rKey = r.room_no.trim().toLowerCase();
    if (seenRooms.has(rKey)) {
      return {
        success: false,
        error: `Duplicate room number "${r.room_no}" in this flat.`,
      };
    }
    seenRooms.add(rKey);

    const seenBeds = new Set<string>();
    for (const b of r.beds || []) {
      const bKey = b.bed_label.trim().toLowerCase();
      if (seenBeds.has(bKey)) {
        return {
          success: false,
          error: `Duplicate bed label "${b.bed_label}" in Room ${r.room_no}.`,
        };
      }
      seenBeds.add(bKey);
    }
  }

  // 1. Insert Flat
  const { data: createdFlat, error: flatError } = await supabase
    .from("flats")
    .insert({
      name: validated.data.name.trim(),
      address: validated.data.address?.trim() || null,
      owner_name: validated.data.owner_name?.trim() || null,
      notes: validated.data.notes?.trim() || null,
      is_active: validated.data.is_active,
    })
    .select("id")
    .single();

  if (flatError || !createdFlat) {
    return { success: false, error: flatError?.message || "Failed to create flat." };
  }

  // 2. Insert Rooms & Beds if provided
  if (roomsInput.length > 0) {
    const { data: createdRooms, error: roomsError } = await supabase
      .from("rooms")
      .insert(
        roomsInput.map((r) => ({
          flat_id: createdFlat.id,
          room_no: r.room_no.trim(),
          sharing_type: r.sharing_type,
          is_active: r.is_active,
        }))
      )
      .select("id, room_no");

    if (roomsError || !createdRooms) {
      // Rollback flat so no partial orphan flat remains
      await supabase.from("flats").delete().eq("id", createdFlat.id);
      return {
        success: false,
        error: roomsError?.message || "Failed to create rooms for flat.",
      };
    }

    // Map room_no -> created room id
    const roomIdByNo = new Map<string, string>();
    createdRooms.forEach((cr) => {
      roomIdByNo.set(cr.room_no.trim().toLowerCase(), cr.id);
    });

    const bedsToInsert: Array<{
      room_id: string;
      bed_label: string;
      base_price: number;
      status: BedInput["status"];
    }> = [];

    for (const r of roomsInput) {
      const createdRoomId = roomIdByNo.get(r.room_no.trim().toLowerCase());
      if (!createdRoomId) continue;
      for (const b of r.beds || []) {
        bedsToInsert.push({
          room_id: createdRoomId,
          bed_label: b.bed_label.trim(),
          base_price: b.base_price,
          status: b.status || "vacant",
        });
      }
    }

    if (bedsToInsert.length > 0) {
      const { error: bedsError } = await supabase.from("beds").insert(bedsToInsert);
      if (bedsError) {
        // Rollback created rooms and flat
        await supabase.from("rooms").delete().eq("flat_id", createdFlat.id);
        await supabase.from("flats").delete().eq("id", createdFlat.id);
        return {
          success: false,
          error: bedsError.message || "Failed to create beds for flat.",
        };
      }
    }
  }

  revalidatePath("/dashboard/beds");
  revalidatePath("/dashboard");
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
