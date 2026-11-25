import { requireAuth } from "@/lib/auth";
import { getDashboardStatsAction } from "@/lib/actions/reports";
import { formatINR } from "@/lib/utils";
import Link from "next/link";
import {
  BedDouble,
  Users,
  Ticket,
  CreditCard,
  AlertTriangle,
  Zap,
  ArrowRight,
  TrendingUp,
  Building,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

export default async function DashboardPage() {
  const { profile } = await requireAuth();
  const statsRes = await getDashboardStatsAction();
  const stats = statsRes.data;

  const totalBeds = stats?.totalBeds || 0;
  const occupiedBeds = stats?.occupiedBeds || 0;
  const vacantBeds = stats?.vacantBeds || 0;
  const occupancyRate = stats?.occupancyRate || 0;
  const collectionsThisMonth = stats?.collectionsThisMonth || 0;
  const tokensCount = stats?.tokensThisMonthCount || 0;
  const tokensAmount = stats?.tokensThisMonthAmount || 0;
  const totalOverdue = stats?.totalOverdueAmount || 0;
  const overdueCount = stats?.overdueTenantsCount || 0;
  const flatsOccupancy = stats?.flatsOccupancy || [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, <span className="font-semibold text-foreground">{profile?.full_name}</span> &bull; Role:{" "}
            <span className="capitalize font-medium text-primary">{profile?.role}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Excel Reports
          </Link>
          <Link
            href="/dashboard/tokens"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Ticket className="h-4 w-4" />
            Tokens Queue
          </Link>
        </div>
      </div>

      {/* High-Level Metric Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4">
        {/* Card 1: Occupancy Rate */}
        <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Occupancy Rate</span>
            <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>
          <div className="my-2">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{occupancyRate}%</div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${occupancyRate}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {occupiedBeds} of {totalBeds} beds occupied
          </p>
        </div>

        {/* Card 2: Vacant Inventory */}
        <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Vacant Beds</span>
            <BedDouble className="h-4 w-4 text-blue-500 shrink-0" />
          </div>
          <div className="my-2">
            <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
              {vacantBeds}
            </div>
          </div>
          <Link
            href="/dashboard/beds"
            className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
          >
            View inventory <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Card 3: Collections This Month */}
        <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Collected This Month</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>
          <div className="my-2">
            <div className="text-lg sm:text-2xl font-bold text-foreground truncate">
              {formatINR(collectionsThisMonth)}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Rent, deposits & electricity
          </p>
        </div>

        {/* Card 4: Total Overdue */}
        <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Overdue</span>
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          </div>
          <div className="my-2">
            <div className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-400 truncate">
              {formatINR(totalOverdue)}
            </div>
          </div>
          <Link
            href="/dashboard/payments"
            className="text-xs text-amber-600 dark:text-amber-400 font-medium hover:underline inline-flex items-center gap-1"
          >
            {overdueCount} tenant{overdueCount === 1 ? "" : "s"} overdue <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Second Row: Tokens This Month & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tokens Highlight Card */}
        <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" />
              Tokens This Month
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              {tokensCount} Bookings
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatINR(tokensAmount)}
          </div>
          <p className="text-xs text-muted-foreground">
            Token advances booked by sales team in current calendar cycle.
          </p>
          <div className="pt-2 border-t">
            <Link
              href="/dashboard/tokens"
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              Go to tokens workflow queue <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Quick Operations Matrix */}
        <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm space-y-3 md:col-span-2">
          <span className="font-semibold text-sm text-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Quick Department Shortcuts
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <Link
              href="/dashboard/tokens"
              className="rounded-lg border p-4 sm:p-4 hover:bg-muted/50 transition-colors text-center space-y-1.5"
            >
              <Ticket className="h-5 w-5 mx-auto text-primary" />
              <div className="font-medium text-xs text-foreground">New Token</div>
              <div className="text-[10px] text-muted-foreground">Sales booking</div>
            </Link>

            <Link
              href="/dashboard/payments"
              className="rounded-lg border p-4 sm:p-4 hover:bg-muted/50 transition-colors text-center space-y-1.5"
            >
              <CreditCard className="h-5 w-5 mx-auto text-emerald-600" />
              <div className="font-medium text-xs text-foreground">Collect Rent</div>
              <div className="text-[10px] text-muted-foreground">Ledger entry</div>
            </Link>

            <Link
              href="/dashboard/electricity"
              className="rounded-lg border p-4 sm:p-4 hover:bg-muted/50 transition-colors text-center space-y-1.5"
            >
              <Zap className="h-5 w-5 mx-auto text-amber-500" />
              <div className="font-medium text-xs text-foreground">Electricity</div>
              <div className="text-[10px] text-muted-foreground">Sub-meter billing</div>
            </Link>

            <Link
              href="/dashboard/reports"
              className="rounded-lg border p-4 sm:p-4 hover:bg-muted/50 transition-colors text-center space-y-1.5"
            >
              <FileSpreadsheet className="h-5 w-5 mx-auto text-blue-600" />
              <div className="font-medium text-xs text-foreground">Excel Export</div>
              <div className="text-[10px] text-muted-foreground">Download sheets</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Property Occupancy Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            Property Occupancy Breakdown
          </h2>
          <Link
            href="/dashboard/reports"
            className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
          >
            Detailed reports <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flatsOccupancy.map((flat) => (
            <div
              key={flat.flat_id}
              className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-sm truncate">
                  {flat.flat_name}
                </span>
                <span className="text-xs font-bold text-foreground">
                  {flat.occupancy_rate}%
                </span>
              </div>

              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${flat.occupancy_rate}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                <span>
                  <strong>{flat.occupied_beds}</strong> occupied &bull;{" "}
                  <strong>{flat.vacant_beds}</strong> vacant
                </span>
                <span className="font-medium text-foreground">
                  {formatINR(flat.current_occupied_revenue)}/mo
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
