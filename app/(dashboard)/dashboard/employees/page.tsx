import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmployeeDirectory } from "./employee-directory";

export default async function EmployeesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!currentProfile || currentProfile.role !== "admin") {
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
