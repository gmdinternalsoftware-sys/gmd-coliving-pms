import { requireAuth } from "@/lib/auth";
import { ReportsView } from "./reports-view";
import { getDashboardStatsAction, getReportsDataAction } from "@/lib/actions/reports";
import type { Flat } from "@/lib/types/database";

export default async function ReportsPage() {
  const { supabase } = await requireAuth();

  // Concurrently fetch flats, aggregated occupancy stats, and full detailed datasets
  const [flatsRes, statsRes, reportsRes] = await Promise.all([
    supabase
      .from("flats")
      .select("id, name, address, owner_name, notes, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    getDashboardStatsAction(),
    getReportsDataAction("all"),
  ]);

  const flats = (flatsRes.data as Flat[]) || [];
  const flatsOccupancy = statsRes.data?.flatsOccupancy || [];
  const allBeds = reportsRes.data?.allBeds || [];
  const occupiedBeds = reportsRes.data?.occupiedBeds || [];
  const vacantBeds = reportsRes.data?.vacantBeds || [];
  const dues = reportsRes.data?.dues || [];

  return (
    <ReportsView
      flats={flats}
      flatsOccupancy={flatsOccupancy}
      initialAllBeds={allBeds}
      initialOccupiedBeds={occupiedBeds}
      initialVacantBeds={vacantBeds}
      initialDues={dues}
    />
  );
}
