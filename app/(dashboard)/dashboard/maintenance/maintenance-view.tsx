"use client";

import { useState } from "react";
import type { AppRole } from "@/lib/types/database";
import { updateMaintenanceSheetUrlAction } from "@/lib/actions/maintenance";
import Link from "next/link";
import {
  Wrench,
  ExternalLink,
  Settings,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileSpreadsheet,
  Phone,
  RefreshCw,
} from "lucide-react";

interface MaintenanceViewProps {
  initialUrl: string;
  userRole: AppRole;
  updatedAt?: string;
}

export function MaintenanceView({
  initialUrl,
  userRole,
  updatedAt,
}: MaintenanceViewProps) {
  const [sheetUrl, setSheetUrl] = useState(initialUrl);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const canConfigure = ["admin", "maintenance"].includes(userRole);

  // Format embed URL for optimal iframe display
  const embedUrl = (() => {
    try {
      if (sheetUrl.includes("docs.google.com/spreadsheets")) {
        // If it's already an export/embed or pubhtml link, keep it
        if (sheetUrl.includes("/pubhtml") || sheetUrl.includes("/preview")) {
          return sheetUrl;
        }
        // If it's a standard /edit link, change /edit to /preview?rm=minimal for clean embed
        return sheetUrl.replace(/\/edit.*$/, "/preview?rm=minimal");
      }
      return sheetUrl;
    } catch {
      return sheetUrl;
    }
  })();

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const res = await updateMaintenanceSheetUrlAction(inputUrl);
    setSaving(false);

    if (res.success) {
      setSheetUrl(inputUrl);
      setSaveSuccess(true);
      setIframeKey((k) => k + 1);
      setTimeout(() => {
        setIsConfigOpen(false);
        setSaveSuccess(false);
      }, 1200);
    } else {
      setSaveError(res.error || "Failed to update link");
    }
  }

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-6rem)]">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wrench className="h-6 w-6 text-amber-500" />
            Maintenance & Complaints
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Shared complaints register with live view access for all staff & maintenance teams
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canConfigure && (
            <button
              type="button"
              onClick={() => {
                setInputUrl(sheetUrl);
                setSaveError(null);
                setIsConfigOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted transition-colors"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              Configure Sheet Link
            </button>
          )}

          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in Google Sheets
          </a>
        </div>
      </div>

      {/* Info Strip */}
      <div className="rounded-lg bg-muted/40 border p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <span>
            Complaints logged by caretakers and tenants are tracked here in real-time.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/caretakers"
            className="text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            <Phone className="h-3 w-3" /> Caretakers List
          </Link>
          <button
            type="button"
            onClick={() => setIframeKey((k) => k + 1)}
            className="hover:text-foreground inline-flex items-center gap-1 font-medium"
            title="Reload sheet"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Embedded Google Sheet Container */}
      <div className="flex-1 w-full rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col relative min-h-[500px]">
        <iframe
          key={iframeKey}
          src={embedUrl}
          title="Maintenance Complaints Sheet"
          className="w-full h-full flex-1 border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />

        {/* Floating bottom-right fallback in case browser blocks embeds */}
        <div className="absolute bottom-2 right-2 bg-card/90 backdrop-blur-sm border rounded-lg px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm">
          Having trouble viewing?{" "}
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium hover:underline inline-flex items-center gap-0.5 ml-1"
          >
            Open directly <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>

      {/* Modal: Configure Sheet Link */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-bold text-foreground">
                  Configure Complaints Sheet Link
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                &times;
              </button>
            </div>

            {saveError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-xs text-red-600 dark:text-red-400 border border-red-200">
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 p-3 text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Sheet link updated successfully!
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">
                  Google Sheet / Form View URL *
                </label>
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                  required
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Paste the Google Sheets share link. Make sure the sheet permissions in Google Drive are set to <strong>&ldquo;Anyone with the link can view&rdquo;</strong> so all employees can see it without request access errors.
                </p>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground">How to get view link:</span>
                <ol className="list-decimal pl-4 space-y-0.5">
                  <li>Open your complaints sheet in Google Sheets.</li>
                  <li>Click the blue <strong>Share</strong> button at the top right.</li>
                  <li>Under General access, select <strong>&ldquo;Anyone with the link&rdquo;</strong> and role <strong>&ldquo;Viewer&rdquo;</strong>.</li>
                  <li>Click <strong>Copy link</strong> and paste it above.</li>
                </ol>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {saving ? "Saving..." : "Save Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
