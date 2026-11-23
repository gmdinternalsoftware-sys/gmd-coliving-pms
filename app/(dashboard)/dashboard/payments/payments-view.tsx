"use client";

import { useState, useMemo } from "react";
import type { DueOverviewItem, AppRole, Flat, PaymentMode, PaymentType } from "@/lib/types/database";
import { formatINR } from "@/lib/utils";
import {
  recordPaymentAction,
  generateMonthlyRentAction,
  setNoticeAction,
  processMoveOutAction,
} from "@/lib/actions/payments";
import Link from "next/link";
import {
  Receipt,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  CreditCard,
  Plus,
  Search,
  Filter,
  Printer,
  LogOut,
  Bell,
  ArrowRight,
  User,
  Building,
  Info,
} from "lucide-react";

export interface RecentPaymentItem {
  id: string;
  booking_id: string;
  type: PaymentType;
  amount: number;
  mode: PaymentMode | null;
  for_month: string | null;
  paid_on: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  flat_name: string;
  room_no: string;
  bed_label: string;
}

export interface ActiveTenantBooking {
  id: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  bed_id: string;
  bed_label: string;
  room_no: string;
  flat_name: string;
  agreed_rent: number;
  deposit_amount: number;
  move_in_date: string | null;
  next_rent_due: string | null;
  notice_date: string | null;
  move_out_date: string | null;
  bed_status: string;
}

interface PaymentsViewProps {
  initialDues: DueOverviewItem[];
  recentPayments: RecentPaymentItem[];
  activeBookings: ActiveTenantBooking[];
  flats: Flat[];
  userRole: AppRole;
}

export function PaymentsView({
  initialDues,
  recentPayments,
  activeBookings,
  flats,
  userRole,
}: PaymentsViewProps) {
  const [activeTab, setActiveTab] = useState<"dues" | "ledger" | "notice">("dues");
  const [search, setSearch] = useState("");
  const [flatFilter, setFlatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [moveOutBooking, setMoveOutBooking] = useState<ActiveTenantBooking | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<RecentPaymentItem | null>(null);

  // Record Payment form
  const [payBookingId, setPayBookingId] = useState("");
  const [payRentDueId, setPayRentDueId] = useState<string | undefined>(undefined);
  const [payType, setPayType] = useState<PaymentType>("rent");
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState<PaymentMode>("upi");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payForMonth, setPayForMonth] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Generate Rent form
  const [genMonth, setGenMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Notice form
  const [noticeBookingId, setNoticeBookingId] = useState("");
  const [noticeDate, setNoticeDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedMoveOut, setExpectedMoveOut] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  });
  const [noticeNotes, setNoticeNotes] = useState("");
  const [noticeLoading, setNoticeLoading] = useState(false);
  const [noticeError, setNoticeError] = useState<string | null>(null);

  // Move-Out Settlement form
  const [actualMoveOutDate, setActualMoveOutDate] = useState(new Date().toISOString().split("T")[0]);
  const [deductionsAmount, setDeductionsAmount] = useState<number>(0);
  const [deductionsReason, setDeductionsReason] = useState("");
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundMode, setRefundMode] = useState<PaymentMode>("upi");
  const [refundRef, setRefundRef] = useState("");
  const [moveOutNotes, setMoveOutNotes] = useState("");
  const [moveOutLoading, setMoveOutLoading] = useState(false);
  const [moveOutError, setMoveOutError] = useState<string | null>(null);

  const canManagePayments = userRole === "admin" || userRole === "accounts";

  // Quick Action: Pre-fill Record Payment from Due row
  const openPaymentForDue = (due: DueOverviewItem) => {
    setPayBookingId(due.booking_id);
    setPayRentDueId(due.due_id);
    setPayType("rent");
    setPayAmount(due.balance_due);
    setPayForMonth(due.for_month);
    setPayRef("");
    setPayNotes(`Rent payment for ${due.for_month}`);
    setPayError(null);
    setIsRecordOpen(true);
  };

  // Quick Action: Pre-fill Move Out from Booking
  const openMoveOutModal = (booking: ActiveTenantBooking) => {
    setMoveOutBooking(booking);
    setActualMoveOutDate(booking.move_out_date || new Date().toISOString().split("T")[0]);
    setDeductionsAmount(0);
    setDeductionsReason("");
    setRefundAmount(booking.deposit_amount || 0);
    setMoveOutError(null);
  };

  // Recalculate refund whenever deductions change
  const handleDeductionsChange = (val: number) => {
    setDeductionsAmount(val);
    if (moveOutBooking) {
      const net = Math.max(0, (moveOutBooking.deposit_amount || 0) - val);
      setRefundAmount(net);
    }
  };

  // Filtered Dues
  const filteredDues = useMemo(() => {
    return initialDues.filter((d) => {
      if (flatFilter !== "all" && d.flat_id !== flatFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "overdue" && d.calculated_status !== "overdue") return false;
        if (statusFilter === "pending" && d.calculated_status !== "pending") return false;
        if (statusFilter === "paid" && d.calculated_status !== "paid") return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          d.client_name?.toLowerCase().includes(q) ||
          d.client_phone1?.includes(q) ||
          d.flat_name?.toLowerCase().includes(q) ||
          d.bed_label?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [initialDues, flatFilter, statusFilter, search]);

  // Filtered Ledger
  const filteredLedger = useMemo(() => {
    return recentPayments.filter((p) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.client_name?.toLowerCase().includes(q) ||
          p.reference?.toLowerCase().includes(q) ||
          p.flat_name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [recentPayments, search]);

  // Notice Tenants
  const noticeTenants = useMemo(() => {
    return activeBookings.filter((b) => b.notice_date !== null || b.bed_status === "notice");
  }, [activeBookings]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalPendingAmount = initialDues
      .filter((d) => d.calculated_status !== "paid" && d.calculated_status !== "waived")
      .reduce((sum, d) => sum + d.balance_due, 0);

    const overdueCount = initialDues.filter((d) => d.calculated_status === "overdue").length;

    const totalCollectedThisMonth = recentPayments.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalPendingAmount,
      overdueCount,
      totalCollectedThisMonth,
      noticeCount: noticeTenants.length,
    };
  }, [initialDues, recentPayments, noticeTenants]);

  // Handle Record Payment Submit
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayLoading(true);
    setPayError(null);

    const res = await recordPaymentAction({
      booking_id: payBookingId,
      rent_due_id: payRentDueId,
      type: payType,
      amount: payAmount,
      mode: payMode,
      paid_on: payDate,
      for_month: payForMonth || undefined,
      reference: payRef || undefined,
      notes: payNotes || undefined,
    });

    setPayLoading(false);

    if (!res.success) {
      setPayError(res.error || "Failed to record payment.");
      return;
    }

    setIsRecordOpen(false);
    window.location.reload();
  };

  // Handle Monthly Rent Generation Submit
  const handleGenerateRent = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenLoading(true);
    setGenError(null);

    const res = await generateMonthlyRentAction({
      for_month: genMonth,
    });

    setGenLoading(false);

    if (!res.success) {
      setGenError(res.error || "Failed to generate monthly rents.");
      return;
    }

    setIsGenerateOpen(false);
    window.location.reload();
  };

  // Handle Set Notice Submit
  const handleSetNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoticeLoading(true);
    setNoticeError(null);

    const res = await setNoticeAction({
      booking_id: noticeBookingId,
      notice_date: noticeDate,
      expected_move_out_date: expectedMoveOut,
      notes: noticeNotes || undefined,
    });

    setNoticeLoading(false);

    if (!res.success) {
      setNoticeError(res.error || "Failed to put tenant on notice.");
      return;
    }

    setIsNoticeOpen(false);
    window.location.reload();
  };

  // Handle Move Out Settlement Submit
  const handleMoveOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveOutBooking) return;

    setMoveOutLoading(true);
    setMoveOutError(null);

    const res = await processMoveOutAction({
      booking_id: moveOutBooking.id,
      actual_move_out_date: actualMoveOutDate,
      deductions_amount: deductionsAmount,
      deductions_reason: deductionsReason || undefined,
      refund_amount: refundAmount,
      refund_mode: refundMode,
      refund_reference: refundRef || undefined,
      notes: moveOutNotes || undefined,
    });

    setMoveOutLoading(false);

    if (!res.success) {
      setMoveOutError(res.error || "Failed to complete move-out settlement.");
      return;
    }

    setMoveOutBooking(null);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments & Dues</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Rent demand schedules, overdue tracking, payment receipts, and tenant move-out settlement.
          </p>
        </div>

        {canManagePayments && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsGenerateOpen(true);
                setGenError(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border bg-card hover:bg-muted shadow-sm transition-all"
            >
              <Calendar className="w-3.5 h-3.5" /> Generate Rent Demands
            </button>

            <button
              onClick={() => {
                if (activeBookings.length > 0) {
                  setPayBookingId(activeBookings[0].id);
                  setPayAmount(activeBookings[0].agreed_rent);
                }
                setPayRentDueId(undefined);
                setPayType("rent");
                setPayRef("");
                setPayNotes("");
                setPayError(null);
                setIsRecordOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Record Payment
            </button>
          </div>
        )}
      </div>

      {/* Metrics Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Pending Dues Total</p>
          <p className="text-xl sm:text-2xl font-bold mt-1 text-foreground">
            {formatINR(metrics.totalPendingAmount)}
          </p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Overdue Demands
          </p>
          <p className="text-xl sm:text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
            {metrics.overdueCount}
          </p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            Recent Collections
          </p>
          <p className="text-xl sm:text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {formatINR(metrics.totalCollectedThisMonth)}
          </p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
            <Bell className="w-3.5 h-3.5" /> Tenants on Notice
          </p>
          <p className="text-xl sm:text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {metrics.noticeCount}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("dues")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "dues"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Rent Dues & Overdues
        </button>

        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "ledger"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Payment Ledger & Receipts ({recentPayments.length})
        </button>

        <button
          onClick={() => setActiveTab("notice")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "notice"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Notice & Move-Out ({noticeTenants.length})
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tenant, property, bed, reference ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border bg-background"
          />
        </div>

        {activeTab === "dues" && (
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border bg-background"
            >
              <option value="all">All Due Statuses</option>
              <option value="overdue">Overdue Only</option>
              <option value="pending">Pending Only</option>
              <option value="paid">Paid</option>
            </select>

            <select
              value={flatFilter}
              onChange={(e) => setFlatFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border bg-background"
            >
              <option value="all">All Properties</option>
              {flats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: RENT DUES & OVERDUES */}
      {activeTab === "dues" && (
        <div className="space-y-3">
          {filteredDues.length === 0 ? (
            <div className="p-8 text-center border rounded-xl bg-card">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold">No pending rent dues found</p>
              <p className="text-xs text-muted-foreground mt-1">
                All rents are settled, or no monthly demands have been generated for this period.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/60 text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tenant</th>
                    <th className="px-4 py-3 font-semibold">Bed & Flat</th>
                    <th className="px-4 py-3 font-semibold">For Month</th>
                    <th className="px-4 py-3 font-semibold">Due Date</th>
                    <th className="px-4 py-3 font-semibold">Demanded</th>
                    <th className="px-4 py-3 font-semibold">Balance Due</th>
                    <th className="px-4 py-3 font-semibold">Status / Overdue</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {filteredDues.map((item) => (
                    <tr key={item.due_id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/dashboard/clients/${item.client_id}`}
                          className="hover:underline text-primary font-semibold"
                        >
                          {item.client_name}
                        </Link>
                        <span className="text-[11px] text-muted-foreground block">
                          {item.client_phone1}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium">{item.flat_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Room {item.room_no} • Bed {item.bed_label}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-medium">{item.for_month}</td>

                      <td className="px-4 py-3 font-medium">{item.due_date}</td>

                      <td className="px-4 py-3 font-semibold">{formatINR(item.due_amount)}</td>

                      <td className="px-4 py-3 font-bold text-red-600 dark:text-red-400">
                        {formatINR(item.balance_due)}
                      </td>

                      <td className="px-4 py-3">
                        {item.calculated_status === "overdue" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800">
                            <AlertTriangle className="w-3 h-3" /> Overdue ({item.days_overdue}d)
                          </span>
                        ) : item.calculated_status === "paid" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Paid
                          </span>
                        ) : item.calculated_status === "partial" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Partial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {item.calculated_status !== "paid" && canManagePayments && (
                          <button
                            onClick={() => openPaymentForDue(item)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                          >
                            Collect Rent
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PAYMENT LEDGER & RECEIPTS */}
      {activeTab === "ledger" && (
        <div className="space-y-3">
          {filteredLedger.length === 0 ? (
            <div className="p-8 text-center border rounded-xl bg-card">
              <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold">No payment entries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/60 text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Receipt / Date</th>
                    <th className="px-4 py-3 font-semibold">Tenant</th>
                    <th className="px-4 py-3 font-semibold">Property & Bed</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Mode & Ref</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {filteredLedger.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <div className="font-semibold text-foreground">{item.paid_on}</div>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          RCP-{item.id.substring(0, 8).toUpperCase()}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-medium">
                        <div>{item.client_name}</div>
                        <span className="text-[11px] text-muted-foreground">{item.client_phone}</span>
                      </td>

                      <td className="px-4 py-3">
                        <div>{item.flat_name}</div>
                        <span className="text-[11px] text-muted-foreground">
                          Room {item.room_no} • Bed {item.bed_label}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="capitalize font-semibold">{item.type}</span>
                        {item.for_month && (
                          <span className="text-[11px] text-muted-foreground block">
                            Month: {item.for_month}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="uppercase font-semibold">{item.mode || "UPI"}</span>
                        {item.reference && (
                          <span className="text-[11px] text-muted-foreground block truncate max-w-[120px]">
                            {item.reference}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                        {item.type === "refund" ? `-${formatINR(item.amount)}` : formatINR(item.amount)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setReceiptPayment(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border hover:bg-muted transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" /> View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: NOTICE & MOVE-OUT */}
      {activeTab === "notice" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Tenants who have served notice or are scheduled for departure.
            </p>

            {canManagePayments && (
              <button
                onClick={() => {
                  if (activeBookings.length > 0) {
                    setNoticeBookingId(activeBookings[0].id);
                  }
                  setIsNoticeOpen(true);
                  setNoticeError(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border bg-card hover:bg-muted shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" /> Mark Tenant on Notice
              </button>
            )}
          </div>

          {noticeTenants.length === 0 ? (
            <div className="p-8 text-center border rounded-xl bg-card">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold">No tenants currently on notice</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {noticeTenants.map((b) => (
                <div key={b.id} className="p-4 rounded-xl border bg-card shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm">{b.client_name}</h4>
                      <p className="text-xs text-muted-foreground">{b.client_phone}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      On Notice
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/40 text-xs space-y-1">
                    <p>
                      <strong>Property:</strong> {b.flat_name} • Bed {b.bed_label}
                    </p>
                    <p>
                      <strong>Notice Served:</strong> {b.notice_date || "Recorded"}
                    </p>
                    <p>
                      <strong>Expected Departure:</strong> {b.move_out_date || "Pending"}
                    </p>
                    <p>
                      <strong>Deposit Held:</strong> {formatINR(b.deposit_amount)}
                    </p>
                  </div>

                  {canManagePayments && (
                    <button
                      onClick={() => openMoveOutModal(b)}
                      className="w-full py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-sm transition-all"
                    >
                      Process Final Move-Out & Refund
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: RECORD PAYMENT
          ========================================================================= */}
      {isRecordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-card border rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Record Payment</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record rent, deposit or token payment in ledger.
                </p>
              </div>
              <button
                onClick={() => setIsRecordOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-3">
              {payError && (
                <div className="p-2.5 text-xs rounded-lg bg-destructive/15 text-destructive border border-destructive/30">
                  {payError}
                </div>
              )}

              <div>
                <label className="text-xs font-medium block mb-1">Select Tenant / Bed *</label>
                <select
                  required
                  value={payBookingId}
                  onChange={(e) => {
                    setPayBookingId(e.target.value);
                    const chosen = activeBookings.find((b) => b.id === e.target.value);
                    if (chosen) setPayAmount(chosen.agreed_rent);
                  }}
                  className="w-full text-xs p-2 rounded-lg border bg-background"
                >
                  {activeBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.client_name} — {b.flat_name} Bed {b.bed_label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1">Payment Type *</label>
                  <select
                    value={payType}
                    onChange={(e) => setPayType(e.target.value as PaymentType)}
                    className="w-full text-xs p-2 rounded-lg border bg-background"
                  >
                    <option value="rent">Rent</option>
                    <option value="deposit">Deposit</option>
                    <option value="electricity">Electricity</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg border bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1">Payment Mode *</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as PaymentMode)}
                    className="w-full text-xs p-2 rounded-lg border bg-background"
                  >
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Transaction Ref / UTR</label>
                <input
                  type="text"
                  placeholder="e.g. UPI/2026/899120"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Optional remarks"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsRecordOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payLoading}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {payLoading ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: GENERATE MONTHLY RENT
          ========================================================================= */}
      {isGenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-card border rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-bold text-base">Generate Monthly Rents</h3>
              <button
                onClick={() => setIsGenerateOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateRent} className="p-5 space-y-3">
              {genError && (
                <div className="p-2.5 text-xs rounded-lg bg-destructive/15 text-destructive border border-destructive/30">
                  {genError}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                This will automatically generate rent demands for all <strong>active tenants</strong> based on their agreed monthly rent and move-in day.
              </p>

              <div>
                <label className="text-xs font-semibold block mb-1">Billing Month *</label>
                <input
                  type="month"
                  required
                  value={genMonth}
                  onChange={(e) => setGenMonth(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsGenerateOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={genLoading}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {genLoading ? "Generating..." : "Generate Demands"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: SET NOTICE
          ========================================================================= */}
      {isNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-card border rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-bold text-base">Put Tenant on Notice</h3>
              <button
                onClick={() => setIsNoticeOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSetNotice} className="p-5 space-y-3">
              {noticeError && (
                <div className="p-2.5 text-xs rounded-lg bg-destructive/15 text-destructive border border-destructive/30">
                  {noticeError}
                </div>
              )}

              <div>
                <label className="text-xs font-medium block mb-1">Tenant *</label>
                <select
                  required
                  value={noticeBookingId}
                  onChange={(e) => setNoticeBookingId(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-background"
                >
                  {activeBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.client_name} ({b.flat_name} Bed {b.bed_label})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1">Notice Date *</label>
                  <input
                    type="date"
                    required
                    value={noticeDate}
                    onChange={(e) => setNoticeDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Expected Move-Out *</label>
                  <input
                    type="date"
                    required
                    value={expectedMoveOut}
                    onChange={(e) => setExpectedMoveOut(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Reason / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Job relocation"
                  value={noticeNotes}
                  onChange={(e) => setNoticeNotes(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsNoticeOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={noticeLoading}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {noticeLoading ? "Saving..." : "Save Notice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: MOVE-OUT SETTLEMENT
          ========================================================================= */}
      {moveOutBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-card border rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Finalize Move-Out & Deposit Settlement</h3>
                <p className="text-xs text-muted-foreground">
                  Tenant: {moveOutBooking.client_name} ({moveOutBooking.flat_name} Bed {moveOutBooking.bed_label})
                </p>
              </div>
              <button
                onClick={() => setMoveOutBooking(null)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleMoveOutSubmit} className="p-5 space-y-3">
              {moveOutError && (
                <div className="p-2.5 text-xs rounded-lg bg-destructive/15 text-destructive border border-destructive/30">
                  {moveOutError}
                </div>
              )}

              <div className="p-3 rounded-lg bg-muted/40 text-xs space-y-1">
                <p>
                  <strong>Total Deposit Held:</strong> {formatINR(moveOutBooking.deposit_amount)}
                </p>
                <p className="text-muted-foreground">
                  Bed <strong>{moveOutBooking.bed_label}</strong> will immediately return to <strong>Vacant</strong> upon completion.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Actual Move-Out Date *</label>
                <input
                  type="date"
                  required
                  value={actualMoveOutDate}
                  onChange={(e) => setActualMoveOutDate(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1">Deductions (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={deductionsAmount}
                    onChange={(e) => handleDeductionsChange(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg border bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Deductions Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Painting, unpaid electricity"
                    value={deductionsReason}
                    onChange={(e) => setDeductionsReason(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold block mb-1 text-emerald-600 dark:text-emerald-400">
                    Net Deposit Refund (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg border bg-background font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Refund Mode *</label>
                  <select
                    value={refundMode}
                    onChange={(e) => setRefundMode(e.target.value as PaymentMode)}
                    className="w-full text-xs p-2 rounded-lg border bg-background"
                  >
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Refund UTR / Ref</label>
                <input
                  type="text"
                  placeholder="e.g. UPI/REFUND/19920"
                  value={refundRef}
                  onChange={(e) => setRefundRef(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setMoveOutBooking(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={moveOutLoading}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 shadow-sm"
                >
                  {moveOutLoading ? "Finalizing..." : "Confirm Move-Out & Free Bed"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: PRINTABLE RECEIPT
          ========================================================================= */}
      {receiptPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-card border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-base tracking-wide text-primary">
                  GMD CO-LIVING PVT LTD
                </h3>
                <p className="text-[11px] text-muted-foreground">Official Payment Receipt</p>
              </div>
              <button
                onClick={() => setReceiptPayment(null)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Receipt Number:</span>
                <span className="font-mono font-bold">
                  RCP-{receiptPayment.id.substring(0, 8).toUpperCase()}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Date:</span>
                <span className="font-medium">{receiptPayment.paid_on}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Tenant Name:</span>
                <span className="font-bold">{receiptPayment.client_name}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Property & Bed:</span>
                <span className="font-medium">
                  {receiptPayment.flat_name} (Bed {receiptPayment.bed_label})
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Type:</span>
                <span className="capitalize font-semibold">{receiptPayment.type}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Mode:</span>
                <span className="uppercase font-semibold">
                  {receiptPayment.mode || "UPI"}
                </span>
              </div>

              {receiptPayment.reference && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference / UTR:</span>
                  <span className="font-mono">{receiptPayment.reference}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-emerald-800 dark:text-emerald-300">
                <span className="font-bold">Total Amount Paid:</span>
                <span className="text-base font-extrabold">
                  {formatINR(receiptPayment.amount)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" /> Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
