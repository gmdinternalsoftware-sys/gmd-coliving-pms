"use client";

import { useState } from "react";
import type { AppRole } from "@/lib/types/database";
import {
  saveMaintenanceSheetsListAction,
  type MaintenanceSheetItem,
} from "@/lib/actions/maintenance";
import Link from "next/link";
import {
  Wrench,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  Info,
  CheckCircle2,
  FileSpreadsheet,
  Phone,
  RefreshCw,
  Layers,
  ChevronDown,
} from "lucide-react";

interface MaintenanceViewProps {
  initialSheets: MaintenanceSheetItem[];
  userRole: AppRole;
}

export function MaintenanceView({
  initialSheets,
  userRole,
}: MaintenanceViewProps) {
  const [sheets, setSheets] = useState<MaintenanceSheetItem[]>(
    initialSheets.length > 0
      ? initialSheets
      : [
          {
            id: "default-1",
            name: "Maintenance Complaints",
            url: "https://docs.google.com/spreadsheets/d/157_rS0_yUSHnTWur9qebP9-CDFqI2_IL_YjLCe1YMbI/edit?usp=sharing",
          },
        ]
  );
  const [activeSheetId, setActiveSheetId] = useState<string>(sheets[0]?.id || "default-1");

  // Embed display modes:
  // "embedded" = /edit?embedded=true (full Google Sheets tab bar at bottom)
  // "preview" = /preview?widget=true (clean preview with bottom tabs)
  // "pubhtml" = /pubhtml?widget=true (published view)
  const [embedMode, setEmbedMode] = useState<"embedded" | "preview" | "pubhtml">("embedded");

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState<MaintenanceSheetItem | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const activeSheet = sheets.find((s) => s.id === activeSheetId) || sheets[0];

  // Format embed URL based on chosen mode so Google Sheet tabs are visible
  const embedUrl = (() => {
    const raw = activeSheet?.url || "";
    try {
      if (raw.includes("docs.google.com/spreadsheets")) {
        // Strip trailing query parameters
        const base = raw.split("?")[0].replace(/\/edit$/, "").replace(/\/preview$/, "").replace(/\/pubhtml$/, "");

        if (embedMode === "embedded") {
          // Google Sheets edit mode inside iframe with bottom sheet navigation tabs
          return `${base}/edit?embedded=true`;
        } else if (embedMode === "preview") {
          // Google Sheets preview mode with sheet tab bar widget enabled
          return `${base}/preview?widget=true&headers=false`;
        } else if (embedMode === "pubhtml") {
          // Published web view with tabs
          return `${base}/pubhtml?widget=true&headers=false`;
        }
      }
      return raw;
    } catch {
      return raw;
    }
  })();

  // Open modal to add a new sheet
  function openAddModal() {
    setEditingSheet(null);
    setFormName(`Complaints Sheet ${sheets.length + 1}`);
    setFormUrl("");
    setSaveError(null);
    setIsAddOpen(true);
  }

  // Open modal to edit an existing sheet
  function openEditModal(sheet: MaintenanceSheetItem) {
    setEditingSheet(sheet);
    setFormName(sheet.name);
    setFormUrl(sheet.url);
    setSaveError(null);
    setIsAddOpen(true);
  }

  // Delete a sheet
  async function handleDeleteSheet(sheetId: string) {
    if (sheets.length <= 1) {
      alert("You must keep at least one complaints sheet.");
      return;
    }
    if (!confirm("Are you sure you want to remove this sheet from the navigation?")) {
      return;
    }

    const updated = sheets.filter((s) => s.id !== sheetId);
    setSheets(updated);
    if (activeSheetId === sheetId) {
      setActiveSheetId(updated[0]?.id || "");
    }
    await saveMaintenanceSheetsListAction(updated);
  }

  // Handle Save Sheet (Add or Edit)
  async function handleSaveSheet(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUrl = formUrl.trim();
    const trimmedName = formName.trim();

    if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      setSaveError("Please enter a valid URL starting with https://");
      return;
    }

    setSaving(true);
    setSaveError(null);

    let updatedList: MaintenanceSheetItem[];
    if (editingSheet) {
      updatedList = sheets.map((s) =>
        s.id === editingSheet.id ? { ...s, name: trimmedName, url: trimmedUrl } : s
      );
    } else {
      const newSheet: MaintenanceSheetItem = {
        id: `sheet-${Date.now()}`,
        name: trimmedName || `Sheet ${sheets.length + 1}`,
        url: trimmedUrl,
      };
      updatedList = [...sheets, newSheet];
      setActiveSheetId(newSheet.id);
    }

    const res = await saveMaintenanceSheetsListAction(updatedList);
    setSaving(false);

    if (res.success) {
      setSheets(updatedList);
      setIsAddOpen(false);
      setIframeKey((k) => k + 1);
    } else {
      setSaveError(res.error || "Failed to save sheet.");
    }
  }

  return (
    <div className="space-y-3 flex flex-col h-[calc(100vh-5.5rem)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wrench className="h-6 w-6 text-amber-500" />
            Maintenance & Complaints Register
          </h1>
          <p className="text-xs text-muted-foreground">
            Live complaints tracker with tab navigation and view access for all staff
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Embed Mode Switcher */}
          <div className="flex items-center rounded-lg border bg-card p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setEmbedMode("embedded");
                setIframeKey((k) => k + 1);
              }}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                embedMode === "embedded"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Full editor view with bottom tab navigation"
            >
              Interactive Tabs
            </button>
            <button
              type="button"
              onClick={() => {
                setEmbedMode("preview");
                setIframeKey((k) => k + 1);
              }}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                embedMode === "preview"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Clean preview view with bottom tabs"
            >
              Preview Tabs
            </button>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-600" />
            Add Another Sheet
          </button>

          {activeSheet && (
            <a
              href={activeSheet.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Google Sheets
            </a>
          )}
        </div>
      </div>

      {/* Sheet Navigation Tabs Bar (PMS Header) */}
      <div className="flex items-center justify-between border-b border-border bg-card/50 rounded-t-lg px-2 pt-1 overflow-x-auto gap-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 flex-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mr-1 flex items-center gap-1 whitespace-nowrap">
            <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
            Sheets:
          </span>

          {sheets.map((sheet) => {
            const isActive = sheet.id === activeSheetId;
            return (
              <div
                key={sheet.id}
                className={`group flex items-center gap-1.5 rounded-t-lg border-t border-l border-r px-3 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-background text-primary border-border shadow-sm font-semibold"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/80 hover:text-foreground"
                }`}
                onClick={() => {
                  setActiveSheetId(sheet.id);
                  setIframeKey((k) => k + 1);
                }}
              >
                <span>{sheet.name}</span>

                {/* Edit & Delete Quick Icons */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(sheet);
                  }}
                  className="opacity-60 hover:opacity-100 p-0.5 rounded hover:bg-muted"
                  title="Change link or rename"
                >
                  <Edit2 className="h-3 w-3" />
                </button>

                {sheets.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSheet(sheet.id);
                    }}
                    className="opacity-40 hover:opacity-100 hover:text-destructive p-0.5 rounded"
                    title="Remove sheet"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground whitespace-nowrap ml-1"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Sheet</span>
          </button>
        </div>

        {/* Quick Refresh */}
        <div className="flex items-center gap-2 pb-1 text-xs">
          <button
            type="button"
            onClick={() => setIframeKey((k) => k + 1)}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted"
            title="Reload sheet"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Embedded Google Sheet Container */}
      <div className="flex-1 w-full rounded-b-xl border bg-card shadow-sm overflow-hidden flex flex-col relative min-h-[500px]">
        <iframe
          key={`${activeSheetId}-${embedMode}-${iframeKey}`}
          src={embedUrl}
          title={activeSheet?.name || "Maintenance Complaints Sheet"}
          className="w-full h-full flex-1 border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />

        {/* Bottom Helper Bar */}
        <div className="flex items-center justify-between bg-muted/60 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{activeSheet?.name}</span>
            <span>&bull;</span>
            <span>Tabs at bottom of sheet are clickable to switch categories</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/caretakers"
              className="text-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              <Phone className="h-3 w-3" /> Caretakers Directory
            </Link>

            <a
              href={activeSheet?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline inline-flex items-center gap-0.5"
            >
              Open in Google Drive <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Modal: Add or Edit Sheet Link */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-bold text-foreground">
                  {editingSheet ? "Edit Complaints Sheet" : "Add New Complaints Sheet"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
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

            <form onSubmit={handleSaveSheet} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">
                  Sheet Display Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sunrise Villa Complaints, Carpentry Log, etc."
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">
                  Google Sheet / Form Link *
                </label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                  required
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Make sure the Google Sheet permission is set to <strong>&ldquo;Anyone with the link can view&rdquo;</strong> in Google Drive.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {saving ? "Saving..." : editingSheet ? "Update Sheet" : "Add Sheet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
