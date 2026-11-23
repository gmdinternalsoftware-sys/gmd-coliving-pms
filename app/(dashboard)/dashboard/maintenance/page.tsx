import { requireAuth } from "@/lib/auth";
import { MaintenanceView } from "./maintenance-view";
import { getMaintenanceSheetUrlAction } from "@/lib/actions/maintenance";
import type { AppRole } from "@/lib/types/database";

export default async function MaintenancePage() {
  const { profile } = await requireAuth();
  const userRole = (profile?.role || "sales") as AppRole;

  const res = await getMaintenanceSheetUrlAction();

  return (
    <MaintenanceView
      initialUrl={res.url}
      userRole={userRole}
      updatedAt={res.updated_at}
    />
  );
}
