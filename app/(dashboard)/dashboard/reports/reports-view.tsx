"use client";

import { useState, useMemo } from "react";
import type { Flat, FlatOccupancyReport } from "@/lib/types/database";
import type { ReportBedItem, ReportDueItem } from "@/lib/actions/reports";
import { formatINR } from "@/lib/utils";
import {
  FileSpreadsheet,
  Download,
  Building,
  BedDouble,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  BarChart3,
  Calendar,
  Phone,
  Layers,
  ArrowUpRight,
} from "lucide-react";

interface ReportsViewProps {
  flats: Flat[];
  flatsOccupancy: FlatOccupancyReport[];
  initialAllBeds: ReportBedItem[];
  initialOccupiedBeds: ReportBedItem[];
  initialVacantBeds: ReportBedItem[];
  initialDues: ReportDueItem[];
}

export function ReportsView({
  flats,
  flatsOccupancy,
  initialAllBeds,
  initialOccupiedBeds,
  initialVacantBeds,
  initialDues,
}: ReportsViewProps) {
  const [selectedFlat, setSelectedFlat] = useState("all");
  const [activeTab, setActiveTab] = useState<
    "overview" | "all" | "occupied" | "vacant" | "dues"
  >("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [exporting, setExporting] = useState(false);

  // Filtered datasets based on selected property & search
  const filteredBeds = useMemo(() => {
    return initialAllBeds.filter((b) => {
      const matchFlat = selectedFlat === "all" || b.flat_id === selectedFlat;
      const matchStatus = statusFilter === "all" || b.status === statusFilter;
      const matchSearch =
        search === "" ||
        b.flat_name.toLowerCase().includes(search.toLowerCase()) ||
        b.room_no.toLowerCase().includes(search.toLowerCase()) ||
        b.bed_label.toLowerCase().includes(search.toLowerCase()) ||
        (b.tenant_name && b.tenant_name.toLowerCase().includes(search.toLowerCase())) ||
        (b.tenant_phone && b.tenant_phone.includes(search));

      return matchFlat && matchStatus && matchSearch;
    });
  }, [initialAllBeds, selectedFlat, statusFilter, search]);

  const filteredOccupied = useMemo(() => {
    return initialOccupiedBeds.filter((b) => {
      const matchFlat = selectedFlat === "all" || b.flat_id === selectedFlat;
      const matchSearch =
        search === "" ||
        b.flat_name.toLowerCase().includes(search.toLowerCase()) ||
        b.room_no.toLowerCase().includes(search.toLowerCase()) ||
        (b.tenant_name && b.tenant_name.toLowerCase().includes(search.toLowerCase())) ||
        (b.tenant_phone && b.tenant_phone.includes(search));

      return matchFlat && matchSearch;
    });
  }, [initialOccupiedBeds, selectedFlat, search]);

  const filteredVacant = useMemo(() => {
    return initialVacantBeds.filter((b) => {
      const matchFlat = selectedFlat === "all" || b.flat_id === selectedFlat;
      const matchSearch =
        search === "" ||
        b.flat_name.toLowerCase().includes(search.toLowerCase()) ||
        b.room_no.toLowerCase().includes(search.toLowerCase()) ||
        b.bed_label.toLowerCase().includes(search.toLowerCase());

      return matchFlat && matchSearch;
    });
  }, [initialVacantBeds, selectedFlat, search]);

  const filteredDues = useMemo(() => {
    return initialDues.filter((d) => {
      const matchFlat =
        selectedFlat === "all" ||
        d.flat_name.toLowerCase() ===
          flats.find((f) => f.id === selectedFlat)?.name.toLowerCase();
      const matchSearch =
        search === "" ||
        d.client_name.toLowerCase().includes(search.toLowerCase()) ||
        d.client_phone.includes(search) ||
        d.flat_name.toLowerCase().includes(search.toLowerCase());

      return matchFlat && matchSearch;
    });
  }, [initialDues, selectedFlat, flats, search]);

  // Trigger Excel file download
  function triggerExport(type: "all" | "beds" | "occupied" | "vacant" | "dues") {
    setExporting(true);
    const url = `/api/reports/export?flat_id=${selectedFlat}&type=${type}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `GMD_${type.toUpperCase()}_Report.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setExporting(false), 1000);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Reports & Excel Exports
          </h1>
          <p className="text-sm text-muted-foreground">
            Inventory occupancy, active resident rosters, vacant bed pipeline, and overdue ledgers
          </p>
        </div>

        {/* Master Export Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => triggerExport("all")}
            disabled={exporting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {exporting ? "Generating Excel..." : "Download Master Excel (All Sheets)"}
          </button>
        </div>
      </div>

      {/* Property Filter & Quick Export Ribbon */}
      <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filter by Property:</span>
          <select
            value={selectedFlat}
            onChange={(e) => setSelectedFlat(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Properties (Consolidated)</option>
            {flats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Individual Sheet Export Actions */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium mr-1">Quick Export:</span>
          <button
            type="button"
            onClick={() => triggerExport("beds")}
            className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 font-medium text-foreground hover:bg-muted"
          >
            <Download className="h-3 w-3 text-muted-foreground" /> All Beds
          </button>
          <button
            type="button"
            onClick={() => triggerExport("occupied")}
            className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 font-medium text-foreground hover:bg-muted"
          >
            <Download className="h-3 w-3 text-muted-foreground" /> Occupied
          </button>
          <button
            type="button"
            onClick={() => triggerExport("vacant")}
            className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 font-medium text-foreground hover:bg-muted"
          >
            <Download className="h-3 w-3 text-muted-foreground" /> Vacant
          </button>
          <button
            type="button"
            onClick={() => triggerExport("dues")}
            className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 font-medium text-foreground hover:bg-muted"
          >
            <Download className="h-3 w-3 text-muted-foreground" /> Dues
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-4 w-4" />
          Property Occupancy ({flatsOccupancy.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "all"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BedDouble className="h-4 w-4" />
          All Beds ({filteredBeds.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("occupied")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "occupied"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Occupied Residents ({filteredOccupied.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("vacant")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "vacant"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Vacant Beds ({filteredVacant.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("dues")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "dues"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Dues & Overdue ({filteredDues.length})
        </button>
      </div>

      {/* Search Bar for tab views */}
      {activeTab !== "overview" && (
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by resident name, phone, flat or room..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {activeTab === "all" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Bed Statuses</option>
              <option value="occupied">Occupied</option>
              <option value="vacant">Vacant</option>
              <option value="reserved">Reserved</option>
              <option value="notice">Notice</option>
              <option value="blocked">Blocked</option>
            </select>
          )}
        </div>
      )}

      {/* Tab 1: Property Occupancy Overview */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {flatsOccupancy.map((flat) => (
              <div
                key={flat.flat_id}
                className="rounded-xl border bg-card p-5 shadow-sm space-y-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-foreground text-base">
                      {flat.flat_name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {flat.flat_address || "No address specified"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      flat.occupancy_rate >= 80
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : flat.occupancy_rate >= 50
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {flat.occupancy_rate}% Occupied
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${flat.occupancy_rate}%` }}
                  />
                </div>

                {/* Breakdown metrics */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t text-xs">
                  <div>
                    <span className="text-muted-foreground">Total Beds</span>
                    <div className="font-bold text-foreground text-sm mt-0.5">
                      {flat.total_beds}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Occupied</span>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                      {flat.occupied_beds}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vacant</span>
                    <div className="font-bold text-blue-600 dark:text-blue-400 text-sm mt-0.5">
                      {flat.vacant_beds}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t text-muted-foreground">
                  <span>Occupied Revenue:</span>
                  <span className="font-bold text-foreground">
                    {formatINR(flat.current_occupied_revenue)} / mo
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: All Beds */}
      {activeTab === "all" && (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px]">
                <tr>
                  <th className="p-3">Property</th>
                  <th className="p-3">Room & Bed</th>
                  <th className="p-3">Sharing</th>
                  <th className="p-3">Base Price</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Current Resident</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Move-in Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredBeds.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      No beds match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredBeds.map((bed) => (
                    <tr key={bed.id} className="hover:bg-muted/30">
                      <td className="p-3 font-medium text-foreground">{bed.flat_name}</td>
                      <td className="p-3">
                        Room {bed.room_no} &bull; Bed <strong>{bed.bed_label}</strong>
                      </td>
                      <td className="p-3">{bed.sharing_type}-Sharing</td>
                      <td className="p-3 font-semibold">{formatINR(bed.base_price)}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            bed.status === "occupied"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : bed.status === "vacant"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : bed.status === "reserved"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                              : bed.status === "notice"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {bed.status}
                        </span>
                      </td>
                      <td className="p-3 text-foreground font-medium">
                        {bed.tenant_name || "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">{bed.tenant_phone || "—"}</td>
                      <td className="p-3 text-muted-foreground">{bed.move_in_date || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Occupied Residents */}
      {activeTab === "occupied" && (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px]">
                <tr>
                  <th className="p-3">Resident Name</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Property</th>
                  <th className="p-3">Room & Bed</th>
                  <th className="p-3">Move-in Date</th>
                  <th className="p-3">Agreed Rent</th>
                  <th className="p-3">Deposit Paid</th>
                  <th className="p-3">Next Rent Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredOccupied.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      No active residents found.
                    </td>
                  </tr>
                ) : (
                  filteredOccupied.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="p-3 font-bold text-foreground">
                        {b.tenant_name}
                      </td>
                      <td className="p-3 text-muted-foreground">{b.tenant_phone}</td>
                      <td className="p-3 font-medium">{b.flat_name}</td>
                      <td className="p-3">
                        Room {b.room_no} &bull; Bed {b.bed_label}
                      </td>
                      <td className="p-3 text-muted-foreground">{b.move_in_date}</td>
                      <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">
                        {formatINR(b.agreed_rent || 0)}
                      </td>
                      <td className="p-3 text-foreground font-medium">
                        {formatINR(b.deposit_amount || 0)}
                      </td>
                      <td className="p-3 text-muted-foreground font-medium">
                        {b.next_rent_due || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Vacant Inventory */}
      {activeTab === "vacant" && (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px]">
                <tr>
                  <th className="p-3">Property</th>
                  <th className="p-3">Address</th>
                  <th className="p-3">Room</th>
                  <th className="p-3">Bed Label</th>
                  <th className="p-3">Sharing Type</th>
                  <th className="p-3">Base Price</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredVacant.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No vacant beds currently available.
                    </td>
                  </tr>
                ) : (
                  filteredVacant.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="p-3 font-bold text-foreground">{b.flat_name}</td>
                      <td className="p-3 text-muted-foreground">{b.flat_address || "—"}</td>
                      <td className="p-3 font-medium">Room {b.room_no}</td>
                      <td className="p-3 font-bold text-foreground">Bed {b.bed_label}</td>
                      <td className="p-3">{b.sharing_type}-Sharing</td>
                      <td className="p-3 font-bold text-primary">{formatINR(b.base_price)}</td>
                      <td className="p-3">
                        <span className="rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-0.5 text-[10px] font-bold">
                          AVAILABLE
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Dues & Overdue */}
      {activeTab === "dues" && (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px]">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Resident</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Period / Month</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Total Due</th>
                  <th className="p-3">Paid</th>
                  <th className="p-3">Balance Due</th>
                  <th className="p-3">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredDues.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-muted-foreground">
                      No outstanding dues recorded.
                    </td>
                  </tr>
                ) : (
                  filteredDues.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            d.type === "Rent"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {d.type}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-foreground">{d.client_name}</td>
                      <td className="p-3 text-muted-foreground">{d.client_phone}</td>
                      <td className="p-3">
                        {d.flat_name} &bull; Room {d.room_no}
                      </td>
                      <td className="p-3 text-muted-foreground">{d.for_period}</td>
                      <td className="p-3 text-muted-foreground">{d.due_date}</td>
                      <td className="p-3 font-medium">{formatINR(d.due_amount)}</td>
                      <td className="p-3 text-emerald-600 font-medium">
                        {formatINR(d.paid_amount)}
                      </td>
                      <td className="p-3 font-bold text-amber-600 dark:text-amber-400">
                        {formatINR(d.balance_due)}
                      </td>
                      <td className="p-3">
                        {d.days_overdue > 0 ? (
                          <span className="rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 text-[10px] font-bold">
                            {d.days_overdue}d Overdue
                          </span>
                        ) : (
                          <span className="text-muted-foreground">On Time</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
