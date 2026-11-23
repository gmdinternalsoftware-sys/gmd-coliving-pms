"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const DEFAULT_URL =
  "https://docs.google.com/spreadsheets/d/157_rS0_yUSHnTWur9qebP9-CDFqI2_IL_YjLCe1YMbI/edit?usp=sharing";

/**
 * Get the configured Google Sheet / complaints URL
 */
export async function getMaintenanceSheetUrlAction(): Promise<{
  success: boolean;
  url: string;
  updated_at?: string;
  error?: string;
}> {
  try {
    const { supabase } = await requireAuth();

    const { data, error } = await supabase
      .from("app_settings")
      .select("value, updated_at")
      .eq("key", "maintenance_google_sheet_url")
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.warn("Could not load maintenance URL from settings:", error.message);
    }

    return {
      success: true,
      url: data?.value?.trim() || DEFAULT_URL,
      updated_at: data?.updated_at,
    };
  } catch (err: any) {
    return {
      success: true,
      url: DEFAULT_URL,
      error: err.message,
    };
  }
}

/**
 * Update the Google Sheet / complaints URL (Admin & Maintenance only)
 */
export async function updateMaintenanceSheetUrlAction(newUrl: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { profile, user, supabase } = await requireAuth();

    if (!["admin", "maintenance"].includes(profile.role)) {
      return {
        success: false,
        error: "Forbidden: Only Admin or Maintenance personnel can update the complaints sheet link.",
      };
    }

    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      return {
        success: false,
        error: "Please enter a valid URL starting with https://",
      };
    }

    const { error } = await supabase.from("app_settings").upsert({
      key: "maintenance_google_sheet_url",
      value: trimmedUrl,
      description: "URL of the shared Google Sheet or Form for Maintenance Complaints tracking",
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    });

    if (error) {
      console.error("Failed to update maintenance sheet URL:", error);
      if (error.message?.includes("app_settings")) {
        return {
          success: false,
          error: "Table 'app_settings' not found in Supabase. Please run migration 00000000000010_maintenance_and_settings.sql in your Supabase SQL Editor.",
        };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/maintenance");
    return { success: true };
  } catch (err: any) {
    console.error("Error updating maintenance sheet URL:", err);
    return { success: false, error: err.message || "Failed to update link." };
  }
}
