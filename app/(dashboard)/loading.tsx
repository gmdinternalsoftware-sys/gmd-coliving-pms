export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-muted" />
          <div className="h-4 w-72 rounded bg-muted/60" />
        </div>
        <div className="h-10 w-36 rounded-lg bg-muted" />
      </div>

      {/* 4 Metric Cards Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-4 w-4 rounded-full bg-muted" />
            </div>
            <div className="h-7 w-28 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted/50" />
          </div>
        ))}
      </div>

      {/* Filter / Search Bar Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="h-10 flex-1 rounded-lg bg-muted" />
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-lg bg-muted" />
          <div className="h-10 w-28 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Content Table / List Skeleton */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>

        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between py-3 border-b border-border/40 last:border-0"
          >
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-56 rounded bg-muted/60" />
            </div>
            <div className="space-y-2 text-right">
              <div className="h-4 w-20 rounded bg-muted ml-auto" />
              <div className="h-3 w-16 rounded bg-muted/60 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
