"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight">
                Critical Application Error
              </h1>
              <p className="text-sm text-gray-600">
                Please reload the application. If the problem persists, contact an administrator.
              </p>
              {error.digest && (
                <p className="font-mono text-xs text-gray-500">
                  Reference: {error.digest}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
