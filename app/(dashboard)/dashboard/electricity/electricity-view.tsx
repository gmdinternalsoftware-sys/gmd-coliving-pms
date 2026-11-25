"use client";

import { useState, useMemo, useEffect } from "react";
import type {
  AppRole,
  Flat,
  ElectricityDueOverview,
  ElectricityBill,
  PaymentMode,
} from "@/lib/types/database";
import { PAYMENT_MODE_LABELS } from "@/lib/types/database";
import { formatINR } from "@/lib/utils";
import {
  generateFlatElectricityBillAction,
  recordElectricityPaymentAction,
  getFlatMeterSetupAction,
} from "@/lib/actions/electricity";
import type { ElectricityPaymentItem } from "./page";
import {
  Zap,
  Receipt,
  Search,
  Filter,
  Plus,
  Printer,
  CreditCard,
  Building,
  User,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Calculator,
  Calendar,
  Info,
} from "lucide-react";

interface ElectricityViewProps {
  initialDues: ElectricityDueOverview[];
  bills: ElectricityBill[];
  payments: ElectricityPaymentItem[];
  flats: Flat[];
  userRole: AppRole;
}

interface RoomReadingState {
  room_id: string;
  room_no: string;
  sharing_type: number;
  active_occupants: number;
  prev: number;
  curr: number;
}

export function ElectricityView({
  initialDues,
  bills,
  payments,
  flats,
  userRole,
}: ElectricityViewProps) {
  const [activeTab, setActiveTab] = useState<"dues" | "bills" | "payments">("dues");
  const [search, setSearch] = useState("");
  const [flatFilter, setFlatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [receiptDue, setReceiptDue] = useState<ElectricityDueOverview | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<ElectricityPaymentItem | null>(null);

  // Generate Bill Form State
  const [genFlatId, setGenFlatId] = useState(flats[0]?.id || "");
  const [genPeriodStart, setGenPeriodStart] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [genPeriodEnd, setGenPeriodEnd] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split("T")[0]
  );
  const [genRate, setGenRate] = useState<number>(9.5);
  const [genCommonPrev, setGenCommonPrev] = useState<number>(0);
  const [genCommonCurr, setGenCommonCurr] = useState<number>(0);
  const [roomReadings, setRoomReadings] = useState<RoomReadingState[]>([]);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [genSubmitting, setGenSubmitting] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Record Payment Form State
  const [selectedDue, setSelectedDue] = useState<ElectricityDueOverview | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState<PaymentMode>("upi_gmd");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [payReference, setPayReference] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const canManage = ["admin", "accounts", "electricity"].includes(userRole);
  const canRecordPayment = ["admin", "accounts"].includes(userRole);

  // Fetch room meter setup when flat changes
  useEffect(() => {
    if (!genFlatId) return;

    let mounted = true;
    async function loadSetup() {
      setLoadingSetup(true);
      setGenError(null);
      const res = await getFlatMeterSetupAction(genFlatId);
      if (!mounted) return;
      setLoadingSetup(false);

      if (res.success && res.data) {
        setGenCommonPrev(res.data.common_latest_reading);
        setGenCommonCurr(res.data.common_latest_reading);
        setRoomReadings(
          res.data.rooms.map((r: any) => ({
            room_id: r.room_id,
            room_no: r.room_no,
            sharing_type: r.sharing_type,
            active_occupants: r.active_occupants,
            prev: r.latest_reading,
            curr: r.latest_reading,
          }))
        );
      } else {
        setGenError(res.error || "Failed to load rooms for this flat");
      }
    }

    loadSetup();
    return () => {
      mounted = false;
    };
  }, [genFlatId]);

  // Live calculation preview
  const liveCalc = useMemo(() => {
    const commonUnits = Math.max(0, genCommonCurr - genCommonPrev);
    const commonAmount = commonUnits * genRate;

    let totalOccupants = 0;
    roomReadings.forEach((r) => {
      totalOccupants += r.active_occupants;
    });
    if (totalOccupants <= 0) totalOccupants = 1;

    const commonPerClient = commonAmount / totalOccupants;

    let roomsUnitsTotal = 0;
    let roomsAmountTotal = 0;

    const roomSplits = roomReadings.map((r) => {
      const u = Math.max(0, r.curr - r.prev);
      const amt = u * genRate;
      roomsUnitsTotal += u;
      roomsAmountTotal += amt;
      const perClient = r.active_occupants > 0 ? amt / r.active_occupants : amt;
      return {
        room_no: r.room_no,
        units: u,
        amount: amt,
        occupants: r.active_occupants,
        perClient,
        totalPerClient: perClient + commonPerClient,
      };
    });

    return {
      commonUnits,
      commonAmount,
      totalOccupants,
      commonPerClient,
      roomsUnitsTotal,
      roomsAmountTotal,
      grandTotalUnits: commonUnits + roomsUnitsTotal,
      grandTotalAmount: commonAmount + roomsAmountTotal,
      roomSplits,
    };
  }, [genCommonPrev, genCommonCurr, genRate, roomReadings]);

  // Filtered Dues
  const filteredDues = useMemo(() => {
    return initialDues.filter((due) => {
      const matchSearch =
        search === "" ||
        due.client_name.toLowerCase().includes(search.toLowerCase()) ||
        due.client_phone.includes(search) ||
        due.flat_name.toLowerCase().includes(search.toLowerCase()) ||
        due.room_no.toLowerCase().includes(search.toLowerCase());

      const matchFlat = flatFilter === "all" || due.flat_id === flatFilter;
      const matchStatus = statusFilter === "all" || due.status === statusFilter;

      return matchSearch && matchFlat && matchStatus;
    });
  }, [initialDues, search, flatFilter, statusFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let pendingAmount = 0;
    let pendingCount = 0;
    let collectedTotal = 0;
    let totalUnits = 0;

    initialDues.forEach((d) => {
      if (d.status === "pending" || d.status === "partial") {
        pendingAmount += d.balance_due;
        pendingCount += 1;
      }
      collectedTotal += d.paid_amount;
    });

    bills.forEach((b) => {
      totalUnits += b.units;
    });

    return { pendingAmount, pendingCount, collectedTotal, totalUnits };
  }, [initialDues, bills]);

  // Handle Generate Bill Submit
  async function handleGenerateBillSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!genFlatId) {
      setGenError("Please select a flat.");
      return;
    }
    if (genCommonCurr < genCommonPrev) {
      setGenError("Current common meter reading cannot be less than previous reading.");
      return;
    }
    for (const r of roomReadings) {
      if (r.curr < r.prev) {
        setGenError(`Current reading for Room ${r.room_no} cannot be less than previous reading.`);
        return;
      }
    }

    setGenSubmitting(true);
    setGenError(null);

    const res = await generateFlatElectricityBillAction({
      flat_id: genFlatId,
      period_start: genPeriodStart,
      period_end: genPeriodEnd,
      rate_per_unit: genRate,
      common_prev: genCommonPrev,
      common_curr: genCommonCurr,
      room_readings: roomReadings.map((r) => ({
        room_id: r.room_id,
        prev: r.prev,
        curr: r.curr,
      })),
    });

    setGenSubmitting(false);

    if (res.success) {
      setIsGenerateOpen(false);
      window.location.reload();
    } else {
      setGenError(res.error || "Failed to generate electricity bill.");
    }
  }

  // Handle Record Payment Submit
  async function handleRecordPaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDue) return;

    if (payAmount <= 0) {
      setPayError("Payment amount must be greater than 0.");
      return;
    }

    setPaySubmitting(true);
    setPayError(null);

    const res = await recordElectricityPaymentAction({
      due_id: selectedDue.due_id,
      amount: payAmount,
      mode: payMode,
      paid_on: payDate,
      reference: payReference,
      notes: payNotes,
    });

    setPaySubmitting(false);

    if (res.success) {
      setIsRecordOpen(false);
      window.location.reload();
    } else {
      setPayError(res.error || "Failed to record payment.");
    }
  }

  function openPaymentModal(due: ElectricityDueOverview) {
    setSelectedDue(due);
    setPayAmount(due.balance_due);
    setPayMode("upi_gmd");
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayReference("");
    setPayNotes("");
    setPayError(null);
    setIsRecordOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500 fill-amber-500" />
            Electricity Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Sub-meter readings, room-level occupant split, common meter division, and billing ledger
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsGenerateOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Generate Electricity Bill
          </button>
        )}
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Pending Electricity</span>
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-bold text-foreground truncate">
            {formatINR(metrics.pendingAmount)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.pendingCount} unpaid / partial tenant bill{metrics.pendingCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Collected</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 truncate">
            {formatINR(metrics.collectedTotal)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Received in ledger</p>
        </div>

        <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Units Billed</span>
            <Zap className="h-4 w-4 text-blue-500 shrink-0" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-bold text-foreground truncate">
            {metrics.totalUnits.toFixed(1)} kWh
          </div>
          <p className="text-xs text-muted-foreground mt-1">Across all properties</p>
        </div>

        <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Billing Runs</span>
            <Calculator className="h-4 w-4 text-purple-500 shrink-0" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-bold text-foreground">{bills.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Properties billed</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("dues")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "dues"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-4 w-4" />
          Tenant Dues & Splits ({initialDues.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("bills")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "bills"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building className="h-4 w-4" />
          Flat Billing Runs ({bills.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "payments"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Receipt className="h-4 w-4" />
          Payment Receipts ({payments.length})
        </button>
      </div>

      {/* Tab 1: Tenant Dues */}
      {activeTab === "dues" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tenant name, phone, flat or room..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
              <select
                value={flatFilter}
                onChange={(e) => setFlatFilter(e.target.value)}
                className="w-full sm:w-auto rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All Properties</option>
                {flats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          {/* Dues List / Table */}
          {filteredDues.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
              <Zap className="mx-auto h-8 w-8 opacity-40 mb-2" />
              <p className="font-medium">No electricity dues found</p>
              <p className="text-xs mt-1">Generate a bill for a flat to produce tenant dues.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDues.map((due) => {
                const isPaid = due.status === "paid";
                const isPartial = due.status === "partial";

                return (
                  <div
                    key={due.due_id}
                    className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm hover:border-primary/40 transition-colors"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {/* Left: Tenant & Location */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-base">
                            {due.client_name}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                              isPaid
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : isPartial
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            }`}
                          >
                            {due.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Building className="h-3.5 w-3.5 text-muted-foreground" />
                            {due.flat_name} &bull; Room {due.room_no}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            {due.client_phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            Period: {due.period_start} to {due.period_end}
                          </span>
                        </div>
                      </div>

                      {/* Right: Amounts & Actions */}
                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4 border-t pt-3 sm:border-t-0 sm:pt-0">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Total Bill Due</div>
                          <div className="text-lg font-bold text-foreground">
                            {formatINR(due.total_due)}
                          </div>
                          {due.balance_due > 0 ? (
                            <div className="text-xs font-medium text-amber-600 dark:text-amber-400">
                              Bal: {formatINR(due.balance_due)}
                            </div>
                          ) : (
                            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              Fully Settled
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReceiptDue(due)}
                            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                          >
                            <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                            Receipt / Breakdown
                          </button>

                          {canRecordPayment && due.balance_due > 0 && (
                            <button
                              type="button"
                              onClick={() => openPaymentModal(due)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Pay
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Calculation breakdown strip */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground border border-border/50">
                      <div className="flex items-center justify-between">
                        <span>
                          <strong className="text-foreground">Room Sub-meter:</strong> {due.room_units} units &divide; {due.room_share_count} tenant{due.room_share_count > 1 ? "s" : ""}
                        </span>
                        <span className="font-semibold text-foreground">{formatINR(due.room_amount)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>
                          <strong className="text-foreground">Common Split:</strong> {due.common_units} units &divide; {due.common_share_count} flat occupant{due.common_share_count > 1 ? "s" : ""}
                        </span>
                        <span className="font-semibold text-foreground">{formatINR(due.common_amount)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Flat Billing Runs */}
      {activeTab === "bills" && (
        <div className="space-y-4">
          {bills.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
              <Building className="mx-auto h-8 w-8 opacity-40 mb-2" />
              <p className="font-medium">No flat billing runs recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bills.map((bill) => (
                <div key={bill.id} className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-base">
                          {bill.flat_name}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-950 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase">
                          {bill.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>
                          Billing Period: <strong>{bill.period_start}</strong> to <strong>{bill.period_end}</strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Rate: <strong>₹{bill.rate}/unit</strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Occupants Billed: <strong>{bill.total_occupied_beds}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Total Flat Bill</div>
                      <div className="text-lg font-bold text-foreground">
                        {formatINR(bill.total_amount)}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">
                        {bill.units.toFixed(1)} kWh total
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Flat Common Meter:</span>{" "}
                      <strong className="text-foreground">{bill.common_units} units ({formatINR(bill.common_amount)})</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rooms Sub-meters Total:</span>{" "}
                      <strong className="text-foreground">{bill.rooms_total_units} units ({formatINR(bill.rooms_total_amount)})</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Payment Receipts */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          {payments.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
              <Receipt className="mx-auto h-8 w-8 opacity-40 mb-2" />
              <p className="font-medium">No electricity payments recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{p.client_name}</span>
                      <span className="text-xs text-muted-foreground">({p.client_phone})</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.flat_name} &bull; Room {p.room_no} &bull; Bed {p.bed_label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Paid on: <strong>{p.paid_on}</strong> via{" "}
                      <strong className="capitalize">
                        {PAYMENT_MODE_LABELS[p.mode || ""] || p.mode || "UPI"}
                      </strong>
                      {p.reference && <span> &bull; Ref: {p.reference}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t pt-2 sm:border-t-0 sm:pt-0">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Amount Paid</div>
                      <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {formatINR(p.amount)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setReceiptPayment(p)}
                      className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                      Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GENERATE ELECTRICITY BILL                                           */}
      {/* ========================================================================= */}
      {isGenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
                <h2 className="text-lg font-bold text-foreground">
                  Generate Flat Electricity Bill
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerateOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                &times; Close
              </button>
            </div>

            {genError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                {genError}
              </div>
            )}

            <form onSubmit={handleGenerateBillSubmit} className="space-y-6">
              {/* Step 1: Flat & Rates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Select Property / Flat *
                  </label>
                  <select
                    value={genFlatId}
                    onChange={(e) => setGenFlatId(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  >
                    {flats.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Rate per Unit (₹/kWh) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={genRate}
                    onChange={(e) => setGenRate(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Billing Period Start *
                  </label>
                  <input
                    type="date"
                    value={genPeriodStart}
                    onChange={(e) => setGenPeriodStart(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Billing Period End *
                  </label>
                  <input
                    type="date"
                    value={genPeriodEnd}
                    onChange={(e) => setGenPeriodEnd(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
              </div>

              {/* Step 2: Flat Common Meter */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-primary" />
                    Flat Common Meter Reading
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Divided equally among all active flat occupants ({liveCalc.totalOccupants})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Previous Reading
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={genCommonPrev}
                      onChange={(e) => setGenCommonPrev(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Current Reading
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={genCommonPrev}
                      value={genCommonCurr}
                      onChange={(e) => setGenCommonCurr(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>
                </div>

                <div className="text-xs text-muted-foreground flex justify-between pt-1 border-t border-border/50">
                  <span>
                    Consumed: <strong>{liveCalc.commonUnits.toFixed(1)} units</strong> &bull; Total:{" "}
                    <strong>{formatINR(liveCalc.commonAmount)}</strong>
                  </span>
                  <span className="text-primary font-semibold">
                    Each occupant pays: {formatINR(liveCalc.commonPerClient)}
                  </span>
                </div>
              </div>

              {/* Step 3: Room Sub-meters */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Independent Room Sub-Meters
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Divided strictly among occupants of that specific room
                  </span>
                </div>

                {loadingSetup ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    Loading room meters...
                  </div>
                ) : roomReadings.length === 0 ? (
                  <div className="rounded-lg border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                    No active rooms found in this property.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {roomReadings.map((r, idx) => {
                      const units = Math.max(0, r.curr - r.prev);
                      const amt = units * genRate;
                      const perTenant = r.active_occupants > 0 ? amt / r.active_occupants : amt;

                      return (
                        <div
                          key={r.room_id}
                          className="rounded-xl border bg-card p-3 shadow-sm space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-xs text-foreground">
                              Room {r.room_no} &bull; Occupants: {r.active_occupants} active
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {units.toFixed(1)} units = {formatINR(amt)} ({formatINR(perTenant)}/tenant)
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-muted-foreground mb-1">
                                Prev Reading
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={r.prev}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setRoomReadings((curr) =>
                                    curr.map((item, i) => (i === idx ? { ...item, prev: val } : item))
                                  );
                                }}
                                className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-muted-foreground mb-1">
                                Curr Reading
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min={r.prev}
                                value={r.curr}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setRoomReadings((curr) =>
                                    curr.map((item, i) => (i === idx ? { ...item, curr: val } : item))
                                  );
                                }}
                                className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                                required
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 4: Live Summary Box */}
              <div className="rounded-xl border bg-primary/5 p-4 space-y-2 border-primary/20">
                <div className="font-semibold text-xs text-foreground flex items-center justify-between">
                  <span>Grand Total Bill for Flat</span>
                  <span className="text-base font-bold text-primary">
                    {formatINR(liveCalc.grandTotalAmount)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>Total Units (Common + Rooms):</span>
                  <span>{liveCalc.grandTotalUnits.toFixed(1)} kWh</span>
                </div>

                <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground space-y-1">
                  <div className="font-medium text-foreground">Estimated tenant split:</div>
                  {liveCalc.roomSplits.map((rs) => (
                    <div key={rs.room_no} className="flex justify-between">
                      <span>
                        Room {rs.room_no} ({rs.occupants} occupant{rs.occupants === 1 ? "" : "s"}):
                      </span>
                      <span>
                        Room share {formatINR(rs.perClient)} + Common {formatINR(liveCalc.commonPerClient)} ={" "}
                        <strong className="text-foreground">{formatINR(rs.totalPerClient)}</strong> / occupant
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsGenerateOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={genSubmitting || loadingSetup}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {genSubmitting ? "Generating..." : "Generate & Post Dues"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD ELECTRICITY PAYMENT                                          */}
      {/* ========================================================================= */}
      {isRecordOpen && selectedDue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-bold text-foreground">
                  Record Electricity Payment
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                &times;
              </button>
            </div>

            {payError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-xs text-red-600 dark:text-red-400 border border-red-200">
                {payError}
              </div>
            )}

            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
              <div className="font-semibold text-foreground">{selectedDue.client_name}</div>
              <div className="text-muted-foreground">
                {selectedDue.flat_name} &bull; Room {selectedDue.room_no}
              </div>
              <div className="flex justify-between pt-1">
                <span>Total Due: {formatINR(selectedDue.total_due)}</span>
                <span className="font-bold text-foreground">
                  Balance: {formatINR(selectedDue.balance_due)}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={selectedDue.balance_due}
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">
                  Payment Mode *
                </label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as PaymentMode)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                >
                  <option value="upi_serenity">UPI - Serenity</option>
                  <option value="upi_gmd">UPI - GMD</option>
                  <option value="upi_platinum_s">UPI - Platinum S</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">
                  Reference / Transaction UTR
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR / Cheque / Slip No."
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">
                  Notes / Remarks
                </label>
                <input
                  type="text"
                  placeholder="Optional remarks"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsRecordOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {paySubmitting ? "Recording..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRINTABLE ELECTRICITY DUE BREAKDOWN                                  */}
      {/* ========================================================================= */}
      {receiptDue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl space-y-6 my-8">
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <div className="text-xl font-bold tracking-tight text-foreground">
                  GMD Co-living Pvt Ltd
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Electricity Consumption & Split Statement
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary uppercase">
                  Statement
                </span>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Generated: {new Date(receiptDue.created_at).toLocaleDateString("en-IN")}
                </div>
              </div>
            </div>

            {/* Tenant details */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Billed To:</span>
                <div className="font-bold text-foreground text-sm">{receiptDue.client_name}</div>
                <div className="text-muted-foreground">Ph: {receiptDue.client_phone}</div>
              </div>

              <div className="text-right">
                <span className="text-muted-foreground">Location:</span>
                <div className="font-bold text-foreground">{receiptDue.flat_name}</div>
                <div className="text-muted-foreground">Room No: {receiptDue.room_no}</div>
              </div>
            </div>

            {/* Statement Period & Rate */}
            <div className="rounded-lg bg-muted/40 p-3 text-xs flex justify-between items-center">
              <div>
                <span className="text-muted-foreground">Billing Period:</span>{" "}
                <strong>{receiptDue.period_start}</strong> to <strong>{receiptDue.period_end}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Rate:</span>{" "}
                <strong>₹{receiptDue.rate_per_unit}/unit</strong>
              </div>
            </div>

            {/* Split breakdown table */}
            <div className="space-y-2 text-xs">
              <div className="font-semibold text-foreground">Itemized Share Breakdown:</div>
              <div className="rounded-lg border divide-y overflow-hidden">
                <div className="p-3 space-y-1">
                  <div className="flex justify-between font-medium text-foreground">
                    <span>1. Independent Room Sub-meter Share</span>
                    <span>{formatINR(receiptDue.room_amount)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Room consumed {receiptDue.room_units} units &divide; {receiptDue.room_share_count} occupant{receiptDue.room_share_count > 1 ? "s" : ""}
                  </div>
                </div>

                <div className="p-3 space-y-1">
                  <div className="flex justify-between font-medium text-foreground">
                    <span>2. Flat Common Meter Share</span>
                    <span>{formatINR(receiptDue.common_amount)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Common consumed {receiptDue.common_units} units &divide; {receiptDue.common_share_count} flat occupant{receiptDue.common_share_count > 1 ? "s" : ""}
                  </div>
                </div>

                <div className="p-3 bg-muted/20 flex justify-between items-center font-bold text-sm">
                  <span>Total Electricity Due:</span>
                  <span className="text-primary">{formatINR(receiptDue.total_due)}</span>
                </div>
              </div>
            </div>

            {/* Settlement Status */}
            <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {formatINR(receiptDue.paid_amount)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-foreground">
                <span>Remaining Balance Due:</span>
                <span className={receiptDue.balance_due > 0 ? "text-amber-600" : "text-emerald-600"}>
                  {formatINR(receiptDue.balance_due)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                <span>Status:</span>
                <span className="uppercase font-semibold">{receiptDue.status}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <button
                type="button"
                onClick={() => setReceiptDue(null)}
                className="rounded-lg border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRINTABLE PAYMENT RECEIPT                                          */}
      {/* ========================================================================= */}
      {receiptPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <div className="text-base font-bold text-foreground">GMD Co-living Pvt Ltd</div>
                <div className="text-xs text-muted-foreground">Official Electricity Payment Receipt</div>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  PAID
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receipt No:</span>
                <strong className="text-foreground">RCP-EL-{receiptPayment.id.slice(0, 8).toUpperCase()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Date:</span>
                <strong>{receiptPayment.paid_on}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tenant Name:</span>
                <strong className="text-foreground">{receiptPayment.client_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Property & Room:</span>
                <span>{receiptPayment.flat_name} &bull; Room {receiptPayment.room_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Mode:</span>
                <strong className="capitalize">
                  {PAYMENT_MODE_LABELS[receiptPayment.mode || ""] || receiptPayment.mode || "UPI"}
                </strong>
              </div>
              {receiptPayment.reference && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ref / UTR:</span>
                  <span>{receiptPayment.reference}</span>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-4 text-center border border-emerald-200 dark:border-emerald-800">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">Amount Received</span>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                {formatINR(receiptPayment.amount)}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <button
                type="button"
                onClick={() => setReceiptPayment(null)}
                className="rounded-lg border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
