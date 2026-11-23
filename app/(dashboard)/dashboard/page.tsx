import { requireAuth } from "@/lib/auth";

export default async function DashboardPage() {
  const { profile } = await requireAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile?.full_name}
        </p>
      </div>

      {/* Quick stats — will be populated in Phase 7 */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard title="Total Beds" value="—" />
        <StatCard title="Occupied" value="—" />
        <StatCard title="Vacant" value="—" />
        <StatCard title="Pending Tokens" value="—" />
      </div>

      <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        <p>Dashboard stats will be available after data is populated.</p>
        <p className="mt-1 text-sm">
          Role: <span className="font-medium capitalize">{profile?.role}</span>
        </p>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
