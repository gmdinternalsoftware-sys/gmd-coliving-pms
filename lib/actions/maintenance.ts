"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface MaintenanceSheetItem {
  id: string;
  name: string;
  url: string;
}

const DEFAULT_SHEETS: MaintenanceSheetItem[] = [
  {
    id: "default-1",
    name: "Maintenance Complaints",
    url: "https://docs.google.com/spreadsheets/d/157_rS0_yUSHnTWur9qebP9-CDFqI2_IL_YjLCe1YMbI/edit?usp=sharing",
  },
];

/**
 * Get all configured maintenance sheets
 */
export async function getMaintenanceSheetsListAction(): Promise<{
  success: boolean;
  sheets: MaintenanceSheetItem[];
  error?: string;
}> {
  try {
    const { supabase } = await requireAuth();

    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance_sheets_list")
      .maybeSingle();

    if (!error && data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { success: true, sheets: parsed };
        }
      } catch {
        // fallback
      }
    }

    // Fallback: check legacy single URL key
    const { data: legacyData } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance_google_sheet_url")
      .maybeSingle();

    if (legacyData?.value) {
      return {
        success: true,
        sheets: [
          {
            id: "legacy-1",
            name: "Complaints Register",
            url: legacyData.value.trim(),
          },
        ],
      };
    }

    return { success: true, sheets: DEFAULT_SHEETS };
  } catch (err: any) {
    return { success: true, sheets: DEFAULT_SHEETS, error: err.message };
  }
}

/**
 * Save / update the full list of maintenance sheets
 */
export async function saveMaintenanceSheetsListAction(
  sheets: MaintenanceSheetItem[]
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { user, supabase } = await requireAuth();

    if (!Array.isArray(sheets) || sheets.length === 0) {
      return { success: false, error: "At least one sheet is required." };
    }

    // Validate URLs
    for (const s of sheets) {
      const u = s.url?.trim() || "";
      if (!u.startsWith("http://") && !u.startsWith("https://")) {
        return {
          success: false,
          error: `Invalid URL for "${s.name}". URL must start with https://`,
        };
      }
    }

    // 1. Save list
    const { error: listErr } = await supabase.from("app_settings").upsert({
      key: "maintenance_sheets_list",
      value: JSON.stringify(sheets),
      description: "List of Google Sheets for Maintenance Complaints",
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    });

    if (listErr) {
      if (listErr.message?.includes("app_settings")) {
        return {
          success: false,
          error:
            "Table 'app_settings' not found in Supabase. Please run migration 00000000000010_maintenance_and_settings.sql in Supabase SQL Editor.",
        };
      }
      return { success: false, error: listErr.message };
    }

    // 2. Also sync primary single URL for backward compatibility
    await supabase.from("app_settings").upsert({
      key: "maintenance_google_sheet_url",
      value: sheets[0].url.trim(),
      description: "Primary Google Sheet for Maintenance Complaints",
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    });

    revalidatePath("/dashboard/maintenance");
    return { success: true };
  } catch (err: any) {
    console.error("Error saving maintenance sheets list:", err);
    return { success: false, error: err.message || "Failed to save sheets." };
  }
}

/**
 * Update single sheet URL (backward compatibility)
 */
export async function updateMaintenanceSheetUrlAction(newUrl: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return await saveMaintenanceSheetsListAction([
    {
      id: "primary",
      name: "Maintenance Complaints",
      url: newUrl.trim(),
    },
  ]);
}
