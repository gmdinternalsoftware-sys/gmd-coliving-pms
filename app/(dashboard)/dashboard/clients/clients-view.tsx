"use client";

import { useState, useMemo } from "react";
import type { Client } from "@/lib/types/database";
import { updateClientManualAction } from "@/lib/actions/tenants";
import { formatDateIST } from "@/lib/utils";
import {
  Users,
  Search,
  AlertCircle,
  CheckCircle2,
  Phone,
  Shield,
  Edit2,
  X,
  Loader2,
  Building,
  BedDouble,
  UserCheck,
} from "lucide-react";
import Link from "next/link";

export interface ClientWithBooking extends Client {
  flat_name?: string | null;
  room_no?: string | null;
  bed_label?: string | null;
  booking_status?: string | null;
}

interface ClientsViewProps {
  initialClients: ClientWithBooking[];
  isAdmin: boolean;
}

export function ClientsView({ initialClients, isAdmin }: ClientsViewProps) {
  const [clients, setClients] = useState<ClientWithBooking[]>(initialClients);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "incomplete">("all");

  // Edit Modal State
  const [editingClient, setEditingClient] = useState<ClientWithBooking | null>(
    null
  );
  const [editName, setEditName] = useState("");
  const [editPhone1, setEditPhone1] = useState("");
  const [editPhone2, setEditPhone2] = useState("");
  const [editEmergencyName, setEditEmergencyName] = useState("");
  const [editEmergencyPhone, setEditEmergencyPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Counts
  const incompleteCount = useMemo(() => {
    return clients.filter((c) => !c.profile_complete).length;
  }, [clients]);

  // Filtered Clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      // Tab filter
      if (activeTab === "incomplete" && c.profile_complete) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.full_name.toLowerCase().includes(q);
        const matchesPhone1 = c.phone1.includes(q);
        const matchesPhone2 = c.phone2?.includes(q) || false;
        const matchesFlat = c.flat_name?.toLowerCase().includes(q) || false;
        const matchesBed = c.bed_label?.toLowerCase().includes(q) || false;
        if (
          !matchesName &&
          !matchesPhone1 &&
          !matchesPhone2 &&
          !matchesFlat &&
          !matchesBed
        ) {
          return false;
        }
      }
      return true;
    });
  }, [clients, activeTab, searchQuery]);

  function openEditModal(c: ClientWithBooking) {
    setEditingClient(c);
    setEditName(c.full_name);
    setEditPhone1(c.phone1);
    setEditPhone2(c.phone2 || "");
    setEditEmergencyName(c.emergency_contact_name || "");
    setEditEmergencyPhone(c.emergency_contact_phone || "");
    setError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClient) return;

    setLoading(true);
    setError(null);

    const res = await updateClientManualAction({
      id: editingClient.id,
      full_name: editName,
      phone1: editPhone1,
      phone2: editPhone2 || undefined,
      emergency_contact_name: editEmergencyName || undefined,
      emergency_contact_phone: editEmergencyPhone || undefined,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Failed to update client.");
    } else {
      setClients((prev) =>
        prev.map((c) =>
          c.id === editingClient.id
            ? {
              ...c,
              full_name: editName,
              phone1: editPhone1,
              phone2: editPhone2 || null,
              emergency_contact_name: editEmergencyName || null,
              emergency_contact_phone: editEmergencyPhone || null,
            }
            : c
        )
      );
      setEditingClient(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients Directory</h1>
          <p className="text-sm text-muted-foreground">
            Complete records of all registered tenants, assigned beds, and
            profile statuses.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <a
              href="/dashboard/tenants/add"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
            >
              + Onboard Existing Tenant
            </a>
            <a
              href="/dashboard/tenants/import"
              className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:bg-muted"
            >
              Bulk Import (Excel)
            </a>
          </div>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b sm:border-b-0 pb-2 sm:pb-0">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
              }`}
          >
            All Clients ({clients.length})
          </button>
          <button
            onClick={() => setActiveTab("incomplete")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === "incomplete"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted"
              }`}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Incomplete Profiles ({incompleteCount})
          </button>
        </div>

        <div className="relative sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, phone, flat…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Directory Table / Cards */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-semibold">No client records found.</p>
            <p className="text-xs">
              {activeTab === "incomplete"
                ? "All registered clients have complete profiles!"
                : "Add existing tenants or import from Excel to populate records."}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="divide-y md:hidden">
              {filteredClients.map((client) => (
                <div key={client.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="font-semibold text-base text-foreground hover:text-primary hover:underline block truncate"
                      >
                        {client.full_name}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">
                        {client.phone1}
                        {client.phone2 ? ` • Alt: ${client.phone2}` : ""}
                      </p>
                    </div>
                    {client.profile_complete ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold shrink-0">
                        <CheckCircle2 className="h-3 w-3" /> COMPLETE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold shrink-0">
                        <AlertCircle className="h-3 w-3" /> INCOMPLETE
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Assigned Bed</span>
                      {client.flat_name ? (
                        <span className="font-medium text-foreground">
                          {client.flat_name} • Rm {client.room_no} ({client.bed_label})
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">No active bed</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Aadhaar</span>
                      {client.aadhaar_last4 ? (
                        <span className="inline-flex items-center gap-1 font-mono font-medium text-foreground">
                          <Shield className="h-3 w-3 text-emerald-600 shrink-0" />
                          •••• {client.aadhaar_last4}
                        </span>
                      ) : (
                        <span className="text-destructive font-medium">Missing</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-muted-foreground">
                      Onboarded {formatDateIST(client.created_at)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="rounded border px-2.5 py-1 font-semibold text-primary hover:bg-primary/10"
                      >
                        View Profile
                      </Link>
                      {isAdmin && (
                        <button
                          onClick={() => openEditModal(client)}
                          className="inline-flex items-center gap-1 rounded border px-2.5 py-1 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Edit2 className="h-3 w-3" /> Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40 uppercase font-semibold text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Phone Numbers</th>
                  <th className="px-5 py-3">Assigned Bed</th>
                  <th className="px-5 py-3">Aadhaar (Last 4)</th>
                  <th className="px-5 py-3">Profile Status</th>
                  <th className="px-5 py-3">Onboarded</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="font-semibold text-sm text-foreground hover:text-primary hover:underline transition-colors block"
                      >
                        {client.full_name}
                      </Link>
                      {client.emergency_contact_name && (
                        <div className="text-[11px] text-muted-foreground">
                          Emg: {client.emergency_contact_name} (
                          {client.emergency_contact_phone || "—"})
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 space-y-0.5">
                      <div className="font-mono text-foreground font-medium">
                        {client.phone1}
                      </div>
                      {client.phone2 ? (
                        <div className="font-mono text-[11px] text-muted-foreground">
                          Alt: {client.phone2}
                        </div>
                      ) : (
                        <span className="text-[10px] text-amber-600 font-medium">
                          No alt phone
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {client.flat_name ? (
                        <div className="space-y-0.5">
                          <span className="font-medium text-foreground">
                            {client.flat_name}
                          </span>
                          <div className="text-muted-foreground text-[11px]">
                            Room {client.room_no} • Bed {client.bed_label}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">
                          No active bed
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {client.aadhaar_last4 ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs bg-muted px-2 py-0.5 rounded border">
                          <Shield className="h-3 w-3 text-emerald-600" />
                          •••• •••• {client.aadhaar_last4}
                        </span>
                      ) : (
                        <span className="text-[11px] text-destructive font-medium">
                          Missing
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {client.profile_complete ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-0.5 text-[10px] font-bold">
                          <CheckCircle2 className="h-3 w-3" /> COMPLETE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 px-2.5 py-0.5 text-[10px] font-bold">
                          <AlertCircle className="h-3 w-3" /> INCOMPLETE
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-muted-foreground text-[11px]">
                      {formatDateIST(client.created_at)}
                    </td>

                    <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                      >
                        View Profile
                      </Link>
                      {isAdmin && (
                        <button
                          onClick={() => openEditModal(client)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Edit2 className="h-3 w-3" /> Correct Data
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {/* Manual Data Correction Modal (Admin only, logged to audit_log) */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h2 className="text-base font-bold">Correct Client Data</h2>
                <p className="text-[11px] text-muted-foreground">
                  All changes are permanently recorded in the system audit log.
                </p>
              </div>
              <button
                onClick={() => setEditingClient(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium">Primary Phone *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={editPhone1}
                  onChange={(e) =>
                    setEditPhone1(e.target.value.replace(/\D/g, ""))
                  }
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium">Secondary Phone</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editPhone2}
                  onChange={(e) =>
                    setEditPhone2(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Optional 10 digits"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  value={editEmergencyName}
                  onChange={(e) => setEditEmergencyName(e.target.value)}
                  placeholder="e.g. Father, Mother"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editEmergencyPhone}
                  onChange={(e) =>
                    setEditEmergencyPhone(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="10-digit phone"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                  {loading ? "Saving…" : "Save Correction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
