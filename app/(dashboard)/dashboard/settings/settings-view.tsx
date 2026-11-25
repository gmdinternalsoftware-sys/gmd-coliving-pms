"use client";

import { Fragment, useState, useMemo } from "react";
import { formatDateIST } from "@/lib/utils";
import {
  Shield,
  History,
  Database,
  FileSpreadsheet,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Lock,
  Download,
  AlertCircle,
} from "lucide-react";

export interface AuditLogEntry {
  id: number;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  created_at: string;
}

interface SettingsViewProps {
  initialLogs: AuditLogEntry[];
}

const ROLE_MATRIX = [
  { capability: "View tokens, clients, beds, flats, caretakers", admin: true, sales: true, noc: true, accounts: true, maint: true, elec: true },
  { capability: "Reveal full Aadhaar (logged to audit_log)", admin: true, sales: true, noc: true, accounts: true, maint: true, elec: true },
  { capability: "Create employees, flats, rooms, beds, caretakers", admin: true, sales: false, noc: false, accounts: false, maint: false, elec: false },
  { capability: "Add existing tenant / bulk import / manual fix", admin: true, sales: false, noc: false, accounts: false, maint: false, elec: false },
  { capability: "Create token booking", admin: true, sales: true, noc: false, accounts: false, maint: false, elec: false },
  { capability: "Update NOC status (Cleared / Hold / Rejected)", admin: true, sales: false, noc: true, accounts: false, maint: false, elec: false },
  { capability: "Record payments, confirm move-in, move-out refund", admin: true, sales: false, noc: false, accounts: true, maint: false, elec: false },
  { capability: "Enter electricity readings & generate bills", admin: true, sales: false, noc: false, accounts: true, maint: false, elec: true },
  { capability: "Update Maintenance Google Sheet link", admin: true, sales: false, noc: false, accounts: false, maint: true, elec: false },
  { capability: "View audit log & system settings", admin: true, sales: false, noc: false, accounts: false, maint: false, elec: false },
];

export function SettingsView({ initialLogs }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"audit" | "backups" | "permissions">("audit");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const uniqueActions = useMemo(
    () => Array.from(new Set(initialLogs.map((l) => l.action))).sort(),
    [initialLogs]
  );
  const uniqueTables = useMemo(
    () =>
      Array.from(
        new Set(initialLogs.map((l) => l.table_name).filter(Boolean) as string[])
      ).sort(),
    [initialLogs]
  );

  const filteredLogs = useMemo(() => {
    return initialLogs.filter((l) => {
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (tableFilter !== "all" && l.table_name !== tableFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          (l.actor_name && l.actor_name.toLowerCase().includes(q)) ||
          (l.actor_email && l.actor_email.toLowerCase().includes(q)) ||
          l.action.toLowerCase().includes(q) ||
          (l.table_name && l.table_name.toLowerCase().includes(q)) ||
          (l.record_id && l.record_id.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [initialLogs, actionFilter, tableFilter, search]);

  function getActionBadgeColor(action: string) {
    if (action === "aadhaar_reveal") {
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300";
    }
    if (action === "delete" || action === "reject_token") {
      return "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300";
    }
    if (action === "insert" || action.startsWith("generate")) {
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300";
    }
    return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Admin Security, Audit Log & Backups
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor database audit trails, verify role permissions, and manage data backups.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
            activeTab === "audit"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" />
          Audit Log ({initialLogs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("backups")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
            activeTab === "backups"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Database className="h-4 w-4" />
          Backups & Recovery
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("permissions")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
            activeTab === "permissions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="h-4 w-4" />
          RLS Role Matrix
        </button>
      </div>

      {/* TAB 1: AUDIT LOG */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search actor, table, record ID, action..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full sm:w-auto rounded-lg border bg-background px-3 py-2 text-xs"
              >
                <option value="all">All Actions</option>
                {uniqueActions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>

              <select
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="w-full sm:w-auto rounded-lg border bg-background px-3 py-2 text-xs"
              >
                <option value="all">All Tables</option>
                {uniqueTables.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground text-sm">
              <History className="mx-auto h-8 w-8 opacity-40 mb-2" />
              No audit events match your filters.
            </div>
          ) : (
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              {/* Mobile Cards */}
              <div className="divide-y md:hidden">
                {filteredLogs.map((log) => {
                  const isOpen = expandedId === log.id;
                  return (
                    <div key={log.id} className="p-4 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                          <span className="ml-2 font-mono font-semibold text-foreground">
                            {log.table_name || "system"}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateIST(log.created_at)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>
                          Actor:{" "}
                          <strong className="text-foreground">
                            {log.actor_name || log.actor_id?.slice(0, 8) || "System"}
                          </strong>{" "}
                          {log.actor_role && `(${log.actor_role})`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isOpen ? null : log.id)}
                          className="inline-flex items-center gap-1 text-primary font-medium"
                        >
                          {isOpen ? "Hide" : "Details"}
                          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      </div>

                      {isOpen && (
                        <div className="rounded-lg bg-muted/50 p-3 font-mono text-[10px] overflow-x-auto space-y-2 border">
                          {log.record_id && <div>Record ID: {log.record_id}</div>}
                          {log.old_data && (
                            <div>
                              <span className="font-bold text-red-600">OLD:</span>
                              <pre className="whitespace-pre-wrap break-all">
                                {JSON.stringify(log.old_data, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_data && (
                            <div>
                              <span className="font-bold text-emerald-600">NEW:</span>
                              <pre className="whitespace-pre-wrap break-all">
                                {JSON.stringify(log.new_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/50 uppercase font-semibold text-muted-foreground text-[11px]">
                    <tr>
                      <th className="p-3.5">Timestamp (IST)</th>
                      <th className="p-3.5">Actor</th>
                      <th className="p-3.5">Action</th>
                      <th className="p-3.5">Table</th>
                      <th className="p-3.5">Record ID</th>
                      <th className="p-3.5 text-right">Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredLogs.map((log) => {
                      const isOpen = expandedId === log.id;
                      return (
                        <Fragment key={log.id}>
                          <tr className="hover:bg-muted/20">
                            <td className="p-3.5 whitespace-nowrap text-muted-foreground">
                              {formatDateIST(log.created_at)}
                            </td>
                            <td className="p-3.5">
                              <span className="font-semibold text-foreground">
                                {log.actor_name || "System / Trigger"}
                              </span>
                              {log.actor_role && (
                                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-medium">
                                  {log.actor_role}
                                </span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getActionBadgeColor(
                                  log.action
                                )}`}
                              >
                                {log.action}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono font-medium">
                              {log.table_name || "—"}
                            </td>
                            <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                              {log.record_id ? `${log.record_id.slice(0, 8)}…` : "—"}
                            </td>
                            <td className="p-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => setExpandedId(isOpen ? null : log.id)}
                                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                              >
                                {isOpen ? "Hide Diff" : "View Diff"}
                                {isOpen ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-muted/30">
                              <td colSpan={6} className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                                  <div className="rounded border bg-background p-3 overflow-x-auto">
                                    <div className="font-bold text-red-600 mb-1">
                                      Previous Data (old_data)
                                    </div>
                                    <pre className="whitespace-pre-wrap break-all">
                                      {log.old_data
                                        ? JSON.stringify(log.old_data, null, 2)
                                        : "null"}
                                    </pre>
                                  </div>
                                  <div className="rounded border bg-background p-3 overflow-x-auto">
                                    <div className="font-bold text-emerald-600 mb-1">
                                      New Data (new_data)
                                    </div>
                                    <pre className="whitespace-pre-wrap break-all">
                                      {log.new_data
                                        ? JSON.stringify(log.new_data, null, 2)
                                        : "null"}
                                    </pre>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BACKUPS & RECOVERY */}
      {activeTab === "backups" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 font-bold text-base">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Instant Operational Snapshot (Excel)
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Download an instant Excel workbook containing Property Occupancy, All Beds,
              Occupied Residents, Vacant Inventory, and Outstanding Dues.
            </p>
            <a
              href="/api/reports/export?flat_id=all&type=all"
              download="GMD_Master_Backup.xlsx"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download Master Excel Snapshot (.xlsx)
            </a>
          </div>

          <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 font-bold text-base">
              <Database className="h-5 w-5 text-primary" />
              Supabase Database Backup Checklist
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4">
              <li>
                <strong className="text-foreground">Automated Daily Backups:</strong>{" "}
                Verify Supabase Project Settings &rarr; Database &rarr; Backups is active
                (Pro plan includes daily snapshots + Point-in-Time Recovery).
              </li>
              <li>
                <strong className="text-foreground">Aadhaar Encryption Key Backup:</strong>{" "}
                Store <code className="bg-muted px-1 rounded">AADHAAR_ENCRYPTION_KEY</code>{" "}
                in a secure password vault outside Vercel/GitHub — losing this key makes
                encrypted Aadhaar rows unrecoverable.
              </li>
              <li>
                <strong className="text-foreground">Manual CLI Snapshot:</strong> Run{" "}
                <code className="bg-muted px-1 rounded">supabase db dump -f backup.sql</code>{" "}
                before applying major schema changes.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 3: PERMISSIONS MATRIX */}
      {activeTab === "permissions" && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b bg-muted/30 flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              Enforced at the Postgres database level via Row Level Security (RLS) policies
              and <code className="bg-muted px-1 rounded">SECURITY DEFINER</code> RPC checks, not UI hiding alone.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/50 uppercase font-semibold text-muted-foreground text-[11px]">
                <tr>
                  <th className="p-3.5">Capability / Action</th>
                  <th className="p-3.5 text-center">Admin</th>
                  <th className="p-3.5 text-center">Sales</th>
                  <th className="p-3.5 text-center">NOC</th>
                  <th className="p-3.5 text-center">Accounts</th>
                  <th className="p-3.5 text-center">Maint.</th>
                  <th className="p-3.5 text-center">Elec.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ROLE_MATRIX.map((row) => (
                  <tr key={row.capability} className="hover:bg-muted/20">
                    <td className="p-3.5 font-medium text-foreground">{row.capability}</td>
                    {[row.admin, row.sales, row.noc, row.accounts, row.maint, row.elec].map(
                      (allowed, idx) => (
                        <td key={idx} className="p-3.5 text-center">
                          {allowed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
