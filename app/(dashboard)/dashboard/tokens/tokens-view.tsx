"use client";

import { useState, useMemo } from "react";
import type { TokenWorkflowItem, AppRole, Flat, Room, Bed, PaymentMode } from "@/lib/types/database";
import { formatINR } from "@/lib/utils";
import { createTokenAction, updateNocStatusAction, confirmMoveInAction } from "@/lib/actions/tokens";
import Link from "next/link";
import {
  FileCheck2,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Filter,
  UserCheck,
  Building,
  CreditCard,
  Calendar,
  Phone,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Info,
} from "lucide-react";

interface TokensViewProps {
  initialTokens: TokenWorkflowItem[];
  flats: Flat[];
  rooms: Room[];
  vacantBeds: (Bed & { flat_id?: string; flat_name?: string; room_no?: string })[];
  userRole: AppRole;
  userId: string;
}

export function TokensView({
  initialTokens,
  flats,
  rooms,
  vacantBeds,
  userRole,
  userId,
}: TokensViewProps) {
  const [tokens, setTokens] = useState<TokenWorkflowItem[]>(initialTokens);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [flatFilter, setFlatFilter] = useState<string>("all");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [nocModalItem, setNocModalItem] = useState<TokenWorkflowItem | null>(null);
  const [moveInModalItem, setMoveInModalItem] = useState<TokenWorkflowItem | null>(null);

  // Form states for Create Token
  const [newClientName, setNewClientName] = useState("");
  const [newPhone1, setNewPhone1] = useState("");
  const [newPhone2, setNewPhone2] = useState("");
  const [newEmergencyName, setNewEmergencyName] = useState("");
  const [newEmergencyPhone, setNewEmergencyPhone] = useState("");
  const [newAadhaar, setNewAadhaar] = useState("");
  const [selectedFlatId, setSelectedFlatId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedBedId, setSelectedBedId] = useState("");
  const [agreedRent, setAgreedRent] = useState<number>(0);
  const [tokenAmount, setTokenAmount] = useState<number>(5000);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("upi_gmd");
  const [paymentRef, setPaymentRef] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [tokenNotes, setTokenNotes] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form states for NOC Review
  const [nocStatus, setNocStatus] = useState<"cleared" | "hold" | "rejected">("cleared");
  const [nocRemarks, setNocRemarks] = useState("");
  const [nocLoading, setNocLoading] = useState(false);
  const [nocError, setNocError] = useState<string | null>(null);

  // Form states for Move-In
  const [actualMoveInDate, setActualMoveInDate] = useState(new Date().toISOString().split("T")[0]);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositMode, setDepositMode] = useState<PaymentMode>("upi_gmd");
  const [depositRef, setDepositRef] = useState("");
  const [rentAmount, setRentAmount] = useState<number>(0);
  const [rentMode, setRentMode] = useState<PaymentMode>("upi_gmd");
  const [rentRef, setRentRef] = useState("");
  const [nextRentDue, setNextRentDue] = useState("");
  const [moveInNotes, setMoveInNotes] = useState("");
  const [moveInLoading, setMoveInLoading] = useState(false);
  const [moveInError, setMoveInError] = useState<string | null>(null);

  // Filtered rooms & beds for Create Token dialog
  const availableRooms = useMemo(() => {
    if (!selectedFlatId) return [];
    return rooms.filter((r) => r.flat_id === selectedFlatId && r.is_active);
  }, [rooms, selectedFlatId]);

  const availableBeds = useMemo(() => {
    if (!selectedRoomId) return [];
    return vacantBeds.filter((b) => b.room_id === selectedRoomId && b.status === "vacant");
  }, [vacantBeds, selectedRoomId]);

  // When bed changes, prefill rent
  const handleBedSelect = (bedId: string) => {
    setSelectedBedId(bedId);
    const chosen = vacantBeds.find((b) => b.id === bedId);
    if (chosen) {
      setAgreedRent(chosen.base_price || 0);
    }
  };

  // Filtered tokens list
  const filteredTokens = useMemo(() => {
    return tokens.filter((t) => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "pending_noc" && t.booking_status !== "token") return false;
        if (statusFilter === "noc_hold" && t.booking_status !== "noc_hold") return false;
        if (statusFilter === "noc_cleared" && t.booking_status !== "noc_cleared") return false;
        if (statusFilter === "active" && t.booking_status !== "active") return false;
        if (statusFilter === "rejected" && t.booking_status !== "rejected") return false;
      }
      // Flat filter
      if (flatFilter !== "all" && t.flat_id !== flatFilter) {
        return false;
      }
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesClient = t.client_name?.toLowerCase().includes(q);
        const matchesPhone = t.client_phone1?.includes(q) || t.client_phone2?.includes(q);
        const matchesFlat = t.flat_name?.toLowerCase().includes(q);
        const matchesBed = t.bed_label?.toLowerCase().includes(q);
        if (!matchesClient && !matchesPhone && !matchesFlat && !matchesBed) {
          return false;
        }
      }
      return true;
    });
  }, [tokens, statusFilter, flatFilter, search]);

  // Counters
  const counts = useMemo(() => {
    return {
      total: tokens.length,
      pendingNoc: tokens.filter((t) => t.booking_status === "token").length,
      nocHold: tokens.filter((t) => t.booking_status === "noc_hold").length,
      nocCleared: tokens.filter((t) => t.booking_status === "noc_cleared").length,
      active: tokens.filter((t) => t.booking_status === "active").length,
      rejected: tokens.filter((t) => t.booking_status === "rejected").length,
    };
  }, [tokens]);

  // Determine "Waiting On Me" banner message
  const waitingOnMeMessage = useMemo(() => {
    if (userRole === "noc" && counts.pendingNoc > 0) {
      return {
        count: counts.pendingNoc,
        text: `${counts.pendingNoc} token${counts.pendingNoc > 1 ? "s" : ""} pending your NOC review.`,
        actionFilter: "pending_noc",
        color: "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200",
      };
    }
    if (userRole === "accounts" && counts.nocCleared > 0) {
      return {
        count: counts.nocCleared,
        text: `${counts.nocCleared} token${counts.nocCleared > 1 ? "s" : ""} cleared by NOC, awaiting deposit collection & move-in confirmation.`,
        actionFilter: "noc_cleared",
        color: "bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200",
      };
    }
    if (userRole === "sales" && counts.nocHold > 0) {
      return {
        count: counts.nocHold,
        text: `${counts.nocHold} token${counts.nocHold > 1 ? "s" : ""} on NOC Hold. Check remarks to resolve tenant document issues.`,
        actionFilter: "noc_hold",
        color: "bg-orange-500/10 border-orange-500/30 text-orange-900 dark:text-orange-200",
      };
    }
    if (userRole === "admin") {
      const pendingTotal = counts.pendingNoc + counts.nocHold + counts.nocCleared;
      if (pendingTotal > 0) {
        return {
          count: pendingTotal,
          text: `${pendingTotal} active token pipeline items (${counts.pendingNoc} pending NOC, ${counts.nocHold} on hold, ${counts.nocCleared} cleared).`,
          actionFilter: "all",
          color: "bg-primary/10 border-primary/30 text-primary dark:text-primary",
        };
      }
    }
    return null;
  }, [userRole, counts]);

  // Handle Create Token Submit
  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    const res = await createTokenAction({
      full_name: newClientName,
      phone1: newPhone1,
      phone2: newPhone2 || undefined,
      emergency_name: newEmergencyName || undefined,
      emergency_phone: newEmergencyPhone || undefined,
      aadhaar: newAadhaar || undefined,
      bed_id: selectedBedId,
      agreed_rent: agreedRent,
      token_amount: tokenAmount,
      move_in_date: moveInDate || undefined,
      payment_mode: paymentMode,
      payment_reference: paymentRef || undefined,
      notes: tokenNotes || undefined,
    });

    setCreateLoading(false);

    if (!res.success) {
      setCreateError(res.error || "Failed to create token booking.");
      return;
    }

    // Refresh page
    setIsCreateOpen(false);
    window.location.reload();
  };

  // Handle NOC Update Submit
  const handleNocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nocModalItem) return;

    setNocLoading(true);
    setNocError(null);

    const res = await updateNocStatusAction({
      booking_id: nocModalItem.booking_id,
      status: nocStatus,
      remarks: nocRemarks,
    });

    setNocLoading(false);

    if (!res.success) {
      setNocError(res.error || "Failed to update NOC status.");
      return;
    }

    setNocModalItem(null);
    window.location.reload();
  };

  // Open Move-In Modal with defaults
  const openMoveInModal = (item: TokenWorkflowItem) => {
    setMoveInModalItem(item);
    setDepositAmount(item.agreed_rent * 2); // default 2 months rent as deposit
    setRentAmount(item.agreed_rent);
    setActualMoveInDate(item.move_in_date || new Date().toISOString().split("T")[0]);
    // Calculate 1 month later as default next rent due
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    setNextRentDue(nextDate.toISOString().split("T")[0]);
    setMoveInError(null);
  };

  // Handle Move-In Submit
  const handleMoveInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveInModalItem) return;

    setMoveInLoading(true);
    setMoveInError(null);

    const res = await confirmMoveInAction({
      booking_id: moveInModalItem.booking_id,
      actual_move_in_date: actualMoveInDate,
      deposit_amount: depositAmount,
      deposit_mode: depositMode,
      deposit_reference: depositRef || undefined,
      rent_amount: rentAmount,
      rent_mode: rentMode,
      rent_reference: rentRef || undefined,
      next_rent_due: nextRentDue || undefined,
      notes: moveInNotes || undefined,
    });

    setMoveInLoading(false);

    if (!res.success) {
      setMoveInError(res.error || "Failed to confirm move-in.");
      return;
    }

    setMoveInModalItem(null);
    window.location.reload();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "token":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3 h-3" /> Pending NOC
          </span>
        );
      case "noc_hold":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
            <AlertCircle className="w-3 h-3" /> NOC On Hold
          </span>
        );
      case "noc_cleared":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <UserCheck className="w-3 h-3" /> NOC Cleared
          </span>
        );
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Active / Moved In
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & New Token CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Token Workflow</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            End-to-end token reservation, NOC background verification, and Accounts move-in.
          </p>
        </div>

        {(userRole === "admin" || userRole === "sales") && (
          <button
            onClick={() => {
              setIsCreateOpen(true);
              setCreateError(null);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Create New Token
          </button>
        )}
      </div>

      {/* "Waiting On Me" Alert Banner */}
      {waitingOnMeMessage && (
        <div
          className={`flex items-start sm:items-center justify-between p-5 sm:p-6 rounded-xl border ${waitingOnMeMessage.color}`}
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Action Needed</p>
              <p className="text-xs sm:text-sm opacity-90">{waitingOnMeMessage.text}</p>
            </div>
          </div>
          {waitingOnMeMessage.actionFilter !== "all" && (
            <button
              onClick={() => setStatusFilter(waitingOnMeMessage.actionFilter)}
              className="text-xs font-medium underline hover:no-underline flex-shrink-0 ml-3"
            >
              Filter view &rarr;
            </button>
          )}
        </div>
      )}

      {/* Metrics Counter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setStatusFilter("all")}
          className={`p-3 rounded-lg border text-left transition-all ${statusFilter === "all"
              ? "bg-primary/10 border-primary shadow-sm"
              : "bg-card hover:bg-muted/50"
            }`}
        >
          <p className="text-xs text-muted-foreground">All Tokens</p>
          <p className="text-xl font-bold mt-1">{counts.total}</p>
        </button>

        <button
          onClick={() => setStatusFilter("pending_noc")}
          className={`p-3 rounded-lg border text-left transition-all ${statusFilter === "pending_noc"
              ? "bg-amber-500/15 border-amber-500 shadow-sm"
              : "bg-card hover:bg-muted/50"
            }`}
        >
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Pending NOC</p>
          <p className="text-xl font-bold mt-1 text-amber-800 dark:text-amber-300">
            {counts.pendingNoc}
          </p>
        </button>

        <button
          onClick={() => setStatusFilter("noc_hold")}
          className={`p-3 rounded-lg border text-left transition-all ${statusFilter === "noc_hold"
              ? "bg-orange-500/15 border-orange-500 shadow-sm"
              : "bg-card hover:bg-muted/50"
            }`}
        >
          <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">NOC On Hold</p>
          <p className="text-xl font-bold mt-1 text-orange-800 dark:text-orange-300">
            {counts.nocHold}
          </p>
        </button>

        <button
          onClick={() => setStatusFilter("noc_cleared")}
          className={`p-3 rounded-lg border text-left transition-all ${statusFilter === "noc_cleared"
              ? "bg-blue-500/15 border-blue-500 shadow-sm"
              : "bg-card hover:bg-muted/50"
            }`}
        >
          <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">NOC Cleared</p>
          <p className="text-xl font-bold mt-1 text-blue-800 dark:text-blue-300">
            {counts.nocCleared}
          </p>
        </button>

        <button
          onClick={() => setStatusFilter("active")}
          className={`p-3 rounded-lg border text-left transition-all ${statusFilter === "active"
              ? "bg-emerald-500/15 border-emerald-500 shadow-sm"
              : "bg-card hover:bg-muted/50"
            }`}
        >
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Moved In</p>
          <p className="text-xl font-bold mt-1 text-emerald-800 dark:text-emerald-300">
            {counts.active}
          </p>
        </button>

        <button
          onClick={() => setStatusFilter("rejected")}
          className={`p-3 rounded-lg border text-left transition-all ${statusFilter === "rejected"
              ? "bg-red-500/15 border-red-500 shadow-sm"
              : "bg-card hover:bg-muted/50"
            }`}
        >
          <p className="text-xs text-red-700 dark:text-red-400 font-medium">Rejected</p>
          <p className="text-xl font-bold mt-1 text-red-800 dark:text-red-300">
            {counts.rejected}
          </p>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search client name, phone, bed, flat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={flatFilter}
            onChange={(e) => setFlatFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Properties</option>
            {flats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tokens List / Table */}
      {filteredTokens.length === 0 ? (
        <div className="p-8 text-center border rounded-xl bg-card">
          <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-base font-semibold">No tokens found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search query or filter settings.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile Cards (Phone screen) */}
          <div className="block lg:hidden space-y-3">
            {filteredTokens.map((item) => (
              <div
                key={item.booking_id}
                className="p-5 sm:p-6 rounded-xl border bg-card shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-base">{item.client_name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {item.client_phone1}
                    </p>
                  </div>
                  <div>{getStatusBadge(item.booking_status)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-lg bg-muted/40">
                  <div>
                    <span className="text-muted-foreground">Property:</span>
                    <p className="font-medium">{item.flat_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Room & Bed:</span>
                    <p className="font-medium">
                      Room {item.room_no} • Bed {item.bed_label}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Token Advance:</span>
                    <p className="font-medium text-emerald-600 dark:text-emerald-400">
                      {formatINR(item.token_amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Agreed Monthly Rent:</span>
                    <p className="font-medium">{formatINR(item.agreed_rent)}/mo</p>
                  </div>
                  {item.move_in_date && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Expected Move-in:</span>
                      <p className="font-medium">{item.move_in_date}</p>
                    </div>
                  )}
                </div>

                {item.noc_remarks && (
                  <div className="text-xs p-2 rounded border border-border/60 bg-background/50">
                    <span className="font-semibold text-muted-foreground">NOC Remarks:</span>{" "}
                    {item.noc_remarks}
                  </div>
                )}

                {/* Mobile Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                  <Link
                    href={`/dashboard/clients/${item.client_id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline py-1 px-2"
                  >
                    View Dossier <ExternalLink className="w-3 h-3" />
                  </Link>

                  {/* NOC Review Button */}
                  {(userRole === "admin" || userRole === "noc") &&
                    (item.booking_status === "token" || item.booking_status === "noc_hold") && (
                      <button
                        onClick={() => {
                          setNocModalItem(item);
                          setNocStatus("cleared");
                          setNocRemarks(item.noc_remarks || "");
                          setNocError(null);
                        }}
                        className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" /> Review NOC
                      </button>
                    )}

                  {/* Accounts Move-in Button */}
                  {(userRole === "admin" || userRole === "accounts") &&
                    item.booking_status === "noc_cleared" && (
                      <button
                        onClick={() => openMoveInModal(item)}
                        className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Confirm Move-In
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/60 text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Bed / Property</th>
                  <th className="px-4 py-3 font-semibold">Financials</th>
                  <th className="px-4 py-3 font-semibold">Move-In</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">NOC Remarks</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTokens.map((item) => (
                  <tr key={item.booking_id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{item.client_name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {item.client_phone1}
                      </div>
                      {item.aadhaar_last4 && (
                        <div className="text-[11px] text-muted-foreground">
                          Aadhaar: •••• •••• {item.aadhaar_last4}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium">{item.flat_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Room {item.room_no} • Bed {item.bed_label} ({item.bed_status})
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-xs">
                        <span className="text-muted-foreground">Token: </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatINR(item.token_amount)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Rent: {formatINR(item.agreed_rent)}/mo
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs">
                      {item.move_in_date ? (
                        <div className="flex items-center gap-1 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          {item.move_in_date}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unscheduled</span>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        By: {item.created_by_name || "Sales"}
                      </div>
                    </td>

                    <td className="px-4 py-3">{getStatusBadge(item.booking_status)}</td>

                    <td className="px-4 py-3 max-w-xs text-xs">
                      {item.noc_remarks ? (
                        <p className="line-clamp-2 text-muted-foreground" title={item.noc_remarks}>
                          {item.noc_remarks}
                        </p>
                      ) : (
                        <span className="text-muted-foreground/60 italic">No remarks</span>
                      )}
                      {item.noc_done_by_name && (
                        <span className="text-[10px] text-muted-foreground/75 block mt-0.5">
                          — {item.noc_done_by_name}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/clients/${item.client_id}`}
                          className="px-2.5 py-1 text-xs rounded border border-input hover:bg-muted transition-colors font-medium"
                        >
                          Profile
                        </Link>

                        {/* NOC Review Button */}
                        {(userRole === "admin" || userRole === "noc") &&
                          (item.booking_status === "token" || item.booking_status === "noc_hold") && (
                            <button
                              onClick={() => {
                                setNocModalItem(item);
                                setNocStatus("cleared");
                                setNocRemarks(item.noc_remarks || "");
                                setNocError(null);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
                            >
                              Review NOC
                            </button>
                          )}

                        {/* Accounts Move-in Button */}
                        {(userRole === "admin" || userRole === "accounts") &&
                          item.booking_status === "noc_cleared" && (
                            <button
                              onClick={() => openMoveInModal(item)}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                            >
                              Confirm Move-In
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: CREATE NEW TOKEN (SALES & ADMIN)
          ========================================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-card border rounded-2xl shadow-xl overflow-hidden my-8">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Create New Token Reservation</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reserve a vacant bed for an incoming client and initiate NOC review.
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateToken} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 text-xs rounded-lg bg-destructive/15 text-destructive border border-destructive/30 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Bed Selection Cascade */}
              <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  1. Select Vacant Inventory
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Property / Flat *</label>
                    <select
                      required
                      value={selectedFlatId}
                      onChange={(e) => {
                        setSelectedFlatId(e.target.value);
                        setSelectedRoomId("");
                        setSelectedBedId("");
                      }}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    >
                      <option value="">Select Flat</option>
                      {flats.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Room *</label>
                    <select
                      required
                      disabled={!selectedFlatId}
                      value={selectedRoomId}
                      onChange={(e) => {
                        setSelectedRoomId(e.target.value);
                        setSelectedBedId("");
                      }}
                      className="w-full text-xs p-2 rounded-lg border bg-background disabled:opacity-50"
                    >
                      <option value="">Select Room</option>
                      {availableRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          Room {r.room_no} ({r.sharing_type}-sharing)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Vacant Bed *</label>
                    <select
                      required
                      disabled={!selectedRoomId}
                      value={selectedBedId}
                      onChange={(e) => handleBedSelect(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border bg-background disabled:opacity-50"
                    >
                      <option value="">Select Bed</option>
                      {availableBeds.map((b) => (
                        <option key={b.id} value={b.id}>
                          Bed {b.bed_label} — Base ₹{b.base_price}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {availableBeds.length === 0 && selectedRoomId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No vacant beds available in this room. Please select another room.
                  </p>
                )}
              </div>

              {/* Client Information */}
              <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  2. Client Information
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">
                      Primary Phone (10 digits) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="9876543210"
                      value={newPhone1}
                      onChange={(e) => setNewPhone1(e.target.value.replace(/\D/g, ""))}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Secondary Phone</label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="Optional"
                      value={newPhone2}
                      onChange={(e) => setNewPhone2(e.target.value.replace(/\D/g, ""))}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">
                      Aadhaar (12 digits, AES-256 encrypted)
                    </label>
                    <input
                      type="text"
                      maxLength={12}
                      placeholder="Optional at token stage"
                      value={newAadhaar}
                      onChange={(e) => setNewAadhaar(e.target.value.replace(/\D/g, ""))}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Emergency Contact Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Sharma (Father)"
                      value={newEmergencyName}
                      onChange={(e) => setNewEmergencyName(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">
                      Emergency Contact Phone
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit number"
                      value={newEmergencyPhone}
                      onChange={(e) => setNewEmergencyPhone(e.target.value.replace(/\D/g, ""))}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing & Token Advance */}
              <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  3. Pricing & Advance Payment
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Agreed Monthly Rent (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={agreedRent}
                      onChange={(e) => setAgreedRent(Number(e.target.value))}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Token Advance Paid (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={tokenAmount}
                      onChange={(e) => setTokenAmount(Number(e.target.value))}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Payment Mode *</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    >
                      <option value="upi_serenity">UPI - Serenity</option>
                      <option value="upi_gmd">UPI - GMD</option>
                      <option value="upi_platinum_s">UPI - Platinum S</option>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank transfer</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Payment Reference / UTR</label>
                    <input
                      type="text"
                      placeholder="e.g. UPI/2026/99120"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Expected Move-In Date</label>
                    <input
                      type="date"
                      value={moveInDate}
                      onChange={(e) => setMoveInDate(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Notes / Remarks</label>
                    <input
                      type="text"
                      placeholder="Special conditions or discounts"
                      value={tokenNotes}
                      onChange={(e) => setTokenNotes(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !selectedBedId}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {createLoading ? "Creating..." : "Confirm & Create Token"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: NOC REVIEW (NOC & ADMIN)
          ========================================================================= */}
      {nocModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-card border rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">NOC Verification Review</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Client: {nocModalItem.client_name} ({nocModalItem.client_phone1})
                </p>
              </div>
              <button
                onClick={() => setNocModalItem(null)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleNocSubmit} className="p-5 space-y-4">
              {nocError && (
                <div className="p-3 text-xs rounded-lg bg-destructive/15 text-destructive border border-destructive/30">
                  {nocError}
                </div>
              )}

              <div className="p-3 rounded-lg bg-muted/40 text-xs space-y-1">
                <p>
                  <strong>Property:</strong> {nocModalItem.flat_name} — Room {nocModalItem.room_no}, Bed {nocModalItem.bed_label}
                </p>
                <p>
                  <strong>Token Advance:</strong> {formatINR(nocModalItem.token_amount)} •
                  <strong> Agreed Rent:</strong> {formatINR(nocModalItem.agreed_rent)}/mo
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-2">Review Decision *</label>
                <div className="grid grid-cols-3 gap-2">
                  <label
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer text-center transition-all ${nocStatus === "cleared"
                        ? "bg-blue-500/15 border-blue-500 font-bold text-blue-700 dark:text-blue-300"
                        : "hover:bg-muted/50"
                      }`}
                  >
                    <input
                      type="radio"
                      name="noc_status"
                      value="cleared"
                      checked={nocStatus === "cleared"}
                      onChange={() => setNocStatus("cleared")}
                      className="sr-only"
                    />
                    <UserCheck className="w-5 h-5 mb-1" />
                    <span className="text-xs">Clear NOC</span>
                  </label>

                  <label
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer text-center transition-all ${nocStatus === "hold"
                        ? "bg-orange-500/15 border-orange-500 font-bold text-orange-700 dark:text-orange-300"
                        : "hover:bg-muted/50"
                      }`}
                  >
                    <input
                      type="radio"
                      name="noc_status"
                      value="hold"
                      checked={nocStatus === "hold"}
                      onChange={() => setNocStatus("hold")}
                      className="sr-only"
                    />
                    <AlertCircle className="w-5 h-5 mb-1" />
                    <span className="text-xs">Put On Hold</span>
                  </label>

                  <label
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer text-center transition-all ${nocStatus === "rejected"
                        ? "bg-red-500/15 border-red-500 font-bold text-red-700 dark:text-red-300"
                        : "hover:bg-muted/50"
                      }`}
                  >
                    <input
                      type="radio"
                      name="noc_status"
                      value="rejected"
                      checked={nocStatus === "rejected"}
                      onChange={() => setNocStatus("rejected")}
                      className="sr-only"
                    />
                    <XCircle className="w-5 h-5 mb-1" />
                    <span className="text-xs">Reject</span>
                  </label>
                </div>
              </div>

              {nocStatus === "rejected" && (
                <div className="p-3 text-xs rounded-lg bg-red-500/10 border border-red-500/30 text-red-800 dark:text-red-300">
                  ⚠️ <strong>Warning:</strong> Rejecting this booking will immediately release Bed{" "}
                  <strong>{nocModalItem.bed_label}</strong> back to <strong>Vacant</strong> status.
                </div>
              )}

              <div>
                <label className="text-xs font-semibold block mb-1">
                  NOC Remarks / Justification * (Min. 3 characters)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder={
                    nocStatus === "cleared"
                      ? "e.g. Identity verified via Aadhaar and employment letter confirmed."
                      : nocStatus === "hold"
                        ? "e.g. Address proof mismatch. Waiting for revised electricity bill."
                        : "e.g. Failed background check or criminal verification."
                  }
                  value={nocRemarks}
                  onChange={(e) => setNocRemarks(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setNocModalItem(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={nocLoading || nocRemarks.trim().length < 3}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {nocLoading ? "Saving..." : "Save NOC Decision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: ACCOUNTS MOVE-IN CONFIRMATION (ACCOUNTS & ADMIN)
          ========================================================================= */}
      {moveInModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-card border rounded-2xl shadow-xl overflow-hidden my-8">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Confirm Move-In & Collect Dues</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tenant: {moveInModalItem.client_name} • Bed {moveInModalItem.bed_label} ({moveInModalItem.flat_name})
                </p>
              </div>
              <button
                onClick={() => setMoveInModalItem(null)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleMoveInSubmit} className="p-5 space-y-4">
              {moveInError && (
                <div className="p-3 text-xs rounded-lg bg-destructive/15 text-destructive border border-destructive/30">
                  {moveInError}
                </div>
              )}

              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-300">
                ✓ NOC Cleared: <strong>{moveInModalItem.noc_remarks || "Verified"}</strong>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Actual Move-In Date *</label>
                <input
                  type="date"
                  required
                  value={actualMoveInDate}
                  onChange={(e) => setActualMoveInDate(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-background"
                />
              </div>

              {/* Security Deposit Collection */}
              <div className="p-3 rounded-xl border bg-muted/30 space-y-2">
                <p className="text-xs font-bold text-foreground">Security Deposit Collection</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Deposit Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Deposit Mode *</label>
                    <select
                      value={depositMode}
                      onChange={(e) => setDepositMode(e.target.value as PaymentMode)}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    >
                      <option value="upi_serenity">UPI - Serenity</option>
                      <option value="upi_gmd">UPI - GMD</option>
                      <option value="upi_platinum_s">UPI - Platinum S</option>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank transfer</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Deposit Reference / Transaction ID"
                      value={depositRef}
                      onChange={(e) => setDepositRef(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* First Month Rent Collection */}
              <div className="p-3 rounded-xl border bg-muted/30 space-y-2">
                <p className="text-xs font-bold text-foreground">First Month Rent Collection</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Rent Amount (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={rentAmount}
                      onChange={(e) => setRentAmount(Number(e.target.value))}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Rent Mode</label>
                    <select
                      value={rentMode}
                      onChange={(e) => setRentMode(e.target.value as PaymentMode)}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    >
                      <option value="upi_serenity">UPI - Serenity</option>
                      <option value="upi_gmd">UPI - GMD</option>
                      <option value="upi_platinum_s">UPI - Platinum S</option>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank transfer</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Rent Reference / Transaction ID"
                      value={rentRef}
                      onChange={(e) => setRentRef(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border bg-background"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Next Rent Due Date</label>
                <input
                  type="date"
                  value={nextRentDue}
                  onChange={(e) => setNextRentDue(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setMoveInModalItem(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={moveInLoading}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                >
                  {moveInLoading ? "Processing Move-In..." : "Confirm Move-In & Occupy Bed"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
