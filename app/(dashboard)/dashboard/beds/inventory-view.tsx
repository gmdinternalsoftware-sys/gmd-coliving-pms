"use client";

import { useState, useMemo } from "react";
import type { Flat, Room, Bed, BedStatus, InventoryBedItem } from "@/lib/types/database";
import { formatINR } from "@/lib/utils";
import { PropertyDialogs } from "./property-dialogs";
import {
  BedDouble,
  Building,
  DoorOpen,
  Plus,
  Search,
  Filter,
  User,
  Edit,
  CheckCircle2,
  Clock,
  Home,
  AlertCircle,
  Ban,
} from "lucide-react";

interface InventoryViewProps {
  initialBeds: InventoryBedItem[];
  flats: Flat[];
  rooms: (Room & { flat_name?: string })[];
  isAdmin: boolean;
}

const statusConfig: Record<
  BedStatus,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  vacant: {
    label: "Vacant",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
  },
  reserved: {
    label: "Reserved",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    icon: Clock,
  },
  occupied: {
    label: "Occupied",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
    icon: Home,
  },
  notice: {
    label: "On Notice",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    icon: AlertCircle,
  },
  blocked: {
    label: "Blocked",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-800",
    icon: Ban,
  },
};

export function InventoryView({
  initialBeds,
  flats,
  rooms,
  isAdmin,
}: InventoryViewProps) {
  const [selectedFlat, setSelectedFlat] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedSharing, setSelectedSharing] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog State
  const [activeDialog, setActiveDialog] = useState<
    "flat" | "room" | "bed" | "edit-bed" | null
  >(null);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: initialBeds.length,
      vacant: 0,
      reserved: 0,
      occupied: 0,
      notice: 0,
      blocked: 0,
    };
    initialBeds.forEach((b) => {
      if (counts[b.status] !== undefined) {
        counts[b.status]++;
      }
    });
    return counts;
  }, [initialBeds]);

  // Filtered beds
  const filteredBeds = useMemo(() => {
    return initialBeds.filter((bed) => {
      // Flat filter
      if (selectedFlat !== "all" && bed.flat_id !== selectedFlat) {
        return false;
      }
      // Status filter
      if (selectedStatus !== "all" && bed.status !== selectedStatus) {
        return false;
      }
      // Sharing filter
      if (
        selectedSharing !== "all" &&
        bed.sharing_type !== Number(selectedSharing)
      ) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesFlat = bed.flat_name.toLowerCase().includes(query);
        const matchesRoom = bed.room_no.toLowerCase().includes(query);
        const matchesLabel = bed.bed_label.toLowerCase().includes(query);
        const matchesTenant =
          bed.tenant_name?.toLowerCase().includes(query) || false;
        if (!matchesFlat && !matchesRoom && !matchesLabel && !matchesTenant) {
          return false;
        }
      }
      return true;
    });
  }, [initialBeds, selectedFlat, selectedStatus, selectedSharing, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header & Admin Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bed Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Live overview of all property beds, occupancy, and room types.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveDialog("flat")}
              className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-muted"
            >
              <Building className="h-3.5 w-3.5 text-primary" /> + Flat
            </button>
            <button
              onClick={() => setActiveDialog("room")}
              className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-muted"
            >
              <DoorOpen className="h-3.5 w-3.5 text-primary" /> + Room
            </button>
            <button
              onClick={() => setActiveDialog("bed")}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              <BedDouble className="h-3.5 w-3.5" /> + Bed
            </button>
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="space-y-3 rounded-lg border bg-card p-5 sm:p-6 shadow-sm">
        {/* Status Filter Chips */}
        <div className="flex flex-wrap gap-2 pb-2 border-b">
          {(
            [
              { id: "all", label: "All Beds" },
              { id: "vacant", label: "Vacant" },
              { id: "reserved", label: "Reserved" },
              { id: "occupied", label: "Occupied" },
              { id: "notice", label: "Notice" },
              { id: "blocked", label: "Blocked" },
            ] as const
          ).map((s) => {
            const isSelected = selectedStatus === s.id;
            const count = statusCounts[s.id] || 0;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedStatus(s.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <span>{s.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background text-foreground border"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Flat & Sharing Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search flat, bed, tenant…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Flat Dropdown */}
          <div>
            <select
              value={selectedFlat}
              onChange={(e) => setSelectedFlat(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Properties / Flats</option>
              {flats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sharing Type Dropdown */}
          <div>
            <select
              value={selectedSharing}
              onChange={(e) => setSelectedSharing(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Sharing Types</option>
              <option value="1">1 (Private Single)</option>
              <option value="2">2-Sharing</option>
              <option value="3">3-Sharing</option>
              <option value="4">4-Sharing</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bed Cards Grid */}
      {filteredBeds.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <BedDouble className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold">No beds found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your search criteria or filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBeds.map((bed) => {
            const conf = statusConfig[bed.status] || statusConfig.vacant;
            const StatusIcon = conf.icon;

            return (
              <div
                key={bed.id}
                className={`relative rounded-lg border p-5 sm:p-6 bg-card shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${conf.border}`}
              >
                {/* Header: Bed & Status Badge */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
                        {bed.flat_name}
                      </span>
                      <h3 className="text-lg font-bold flex items-center gap-1.5 mt-0.5">
                        <BedDouble className="h-4 w-4 text-primary" />
                        Room {bed.room_no} • Bed {bed.bed_label}
                      </h3>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${conf.bg} ${conf.text} ${conf.border}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {conf.label}
                    </span>
                  </div>

                  {/* Room Sharing Type & Monthly Rent */}
                  <div className="mt-3 flex items-center justify-between text-xs py-1.5 border-y border-dashed">
                    <span className="text-muted-foreground font-medium">
                      {bed.sharing_type === 1
                        ? "Private Single"
                        : `${bed.sharing_type}-Sharing`}
                    </span>
                    <span className="font-bold text-foreground text-sm">
                      {formatINR(bed.base_price)}{" "}
                      <span className="text-[10px] font-normal text-muted-foreground">
                        / mo
                      </span>
                    </span>
                  </div>

                  {/* Occupant / Tenant Name Display */}
                  <div className="mt-3">
                    {bed.status === "occupied" ? (
                      <div className="flex items-center gap-2 rounded-md bg-purple-50/70 dark:bg-purple-950/20 px-2.5 py-1.5 text-xs text-purple-900 dark:text-purple-300 border border-purple-200 dark:border-purple-900/40">
                        <User className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        <div className="truncate">
                          <p className="font-semibold truncate">
                            {bed.tenant_name || "Active Tenant"}
                          </p>
                          {bed.tenant_phone && (
                            <p className="text-[10px] text-muted-foreground">
                              {bed.tenant_phone}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : bed.status === "reserved" ? (
                      <div className="flex items-center gap-2 rounded-md bg-blue-50/70 dark:bg-blue-950/20 px-2.5 py-1.5 text-xs text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
                        <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <div className="truncate">
                          <p className="font-semibold truncate">
                            {bed.tenant_name || "Token Holder"}
                          </p>
                          <p className="text-[10px] text-blue-600 dark:text-blue-400">
                            Booking In Progress
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic px-1">
                        {bed.status === "vacant"
                          ? "Available for booking"
                          : bed.status === "blocked"
                          ? "Temporarily unavailable"
                          : "Notice period running"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin Edit Action */}
                {isAdmin && (
                  <div className="mt-4 pt-2 border-t flex justify-end">
                    <button
                      onClick={() => {
                        setEditingBed({
                          id: bed.id,
                          room_id: bed.room_id,
                          bed_label: bed.bed_label,
                          base_price: bed.base_price,
                          status: bed.status,
                          created_at: "",
                          updated_at: "",
                        });
                        setActiveDialog("edit-bed");
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors py-1 px-2 rounded hover:bg-muted"
                    >
                      <Edit className="h-3 w-3" /> Edit Bed
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Property & Bed Management Dialogs */}
      <PropertyDialogs
        key={editingBed ? `edit-${editingBed.id}` : activeDialog || "none"}
        flats={flats}
        rooms={rooms}
        onSuccess={() => window.location.reload()}
        activeDialog={activeDialog}
        editingBed={editingBed}
        onClose={() => {
          setActiveDialog(null);
          setEditingBed(null);
        }}
      />
    </div>
  );
}
