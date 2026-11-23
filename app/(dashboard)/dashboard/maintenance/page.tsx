import { requireAuth } from "@/lib/auth";
import { MaintenanceView } from "./maintenance-view";
import { getMaintenanceSheetsListAction } from "@/lib/actions/maintenance";
import type { AppRole } from "@/lib/types/database";

export default async function MaintenancePage() {
  const { profile } = await requireAuth();
  const userRole = (profile?.role || "sales") as AppRole;

  const res = await getMaintenanceSheetsListAction();

  return (
    <MaintenanceView
      initialSheets={res.sheets}
      userRole={userRole}
    />
  );
}
