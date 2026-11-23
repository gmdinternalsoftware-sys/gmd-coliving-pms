import { requireAuth } from "@/lib/auth";
import { EmployeeDirectory } from "./employee-directory";

export default async function EmployeesPage() {
  const { user, profile, supabase } = await requireAuth();

  if (profile.role !== "admin") {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-lg border bg-card p-6 text-center">
        <h2 className="text-xl font-bold text-destructive">Access Restricted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Employee management is restricted to Admin personnel only.
        </p>
      </div>
    );
  }

  const { data: employees } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <EmployeeDirectory
        initialEmployees={employees || []}
        currentUserId={user.id}
      />
    </div>
  );
}
