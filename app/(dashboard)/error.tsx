"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error:", error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-2 text-center">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 sm:p-8 shadow-sm space-y-5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Unable to load this section
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {error.message || "An unexpected server or database error occurred."}
          </p>
          {error.digest && (
            <p className="font-mono text-[11px] text-muted-foreground">
              Error Ref: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Loading
          </button>
          <Link
            href="/dashboard"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2 text-xs sm:text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
