"use client";

import { useState } from "react";
import type { Client, Booking, Payment } from "@/lib/types/database";
import { formatINR, formatDateIST } from "@/lib/utils";
import {
  revealAadhaarAction,
  uploadClientPhotoAction,
} from "@/lib/actions/client-profile";
import {
  User,
  Phone,
  Shield,
  ShieldAlert,
  Eye,
  EyeOff,
  Upload,
  Calendar,
  IndianRupee,
  BedDouble,
  Building,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  ArrowLeft,
  Loader2,
  Camera,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface BookingWithBed extends Booking {
  flat_name?: string;
  room_no?: string;
  bed_label?: string;
  sharing_type?: number;
}

interface ProfileClientProps {
  client: Client;
  activeBooking: BookingWithBed | null;
  previousBookings: BookingWithBed[];
  payments: Payment[];
  initialSignedPhotoUrl: string | null;
  currentRole: string;
}

export function ProfileClient({
  client,
  activeBooking,
  previousBookings,
  payments,
  initialSignedPhotoUrl,
  currentRole,
}: ProfileClientProps) {
  // Aadhaar Reveal State
  const [revealedAadhaar, setRevealedAadhaar] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  // Photo Upload State
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialSignedPhotoUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Active Tab
  const [tab, setTab] = useState<"overview" | "payments" | "history">("overview");

  async function handleToggleAadhaar() {
    if (revealedAadhaar) {
      setRevealedAadhaar(null);
      return;
    }

    setRevealing(true);
    setRevealError(null);

    const res = await revealAadhaarAction(client.id);
    setRevealing(false);

    if (!res.success) {
      setRevealError(res.error || "Failed to reveal Aadhaar.");
    } else {
      setRevealedAadhaar(res.aadhaar || null);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("photo", file);

    const res = await uploadClientPhotoAction(client.id, formData);
    setUploading(false);

    if (!res.success) {
      setUploadError(res.error || "Failed to upload photo.");
    } else {
      // Create local preview URL immediately
      setPhotoUrl(URL.createObjectURL(file));
    }
  }

  const totalPaymentsMade = payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/clients"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Clients Directory
        </Link>
        <span className="text-xs text-muted-foreground capitalize">
          Viewing as {currentRole}
        </span>
      </div>

      {/* Profile Header Card */}
      <div className="rounded-lg border bg-card p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {/* Avatar / Photo with Signed URL & Upload Trigger */}
          <div className="relative group">
            <div className="h-20 w-20 rounded-full border-2 border-border overflow-hidden bg-muted flex items-center justify-center shadow-inner">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={client.full_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-10 w-10 text-muted-foreground" />
              )}
            </div>

            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-primary text-primary-foreground shadow flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-transform active:scale-95"
              title="Upload photo"
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">
                {client.full_name}
              </h1>
              {client.profile_complete ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete Profile
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 px-2.5 py-0.5 text-xs font-semibold">
                  <AlertCircle className="h-3.5 w-3.5" /> Incomplete Profile
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {client.phone1}
              </span>
              {client.phone2 && <span>Alt: {client.phone2}</span>}
              <span>Joined: {formatDateIST(client.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Current Bed Chip */}
        {activeBooking ? (
          <div className="rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 p-3 text-right">
            <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
              Active Tenancy
            </span>
            <p className="text-base font-bold text-foreground mt-0.5">
              {activeBooking.flat_name}
            </p>
            <p className="text-xs text-muted-foreground">
              Room {activeBooking.room_no} • Bed {activeBooking.bed_label}
            </p>
          </div>
        ) : (
          <div className="rounded-md bg-muted px-4 py-3 text-right">
            <span className="text-xs text-muted-foreground italic">
              No active bed assigned
            </span>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20">
          {uploadError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b text-sm font-medium">
        <button
          onClick={() => setTab("overview")}
          className={`pb-3 px-4 border-b-2 transition-colors ${
            tab === "overview"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Profile & Tenancy
        </button>
        <button
          onClick={() => setTab("payments")}
          className={`pb-3 px-4 border-b-2 transition-colors ${
            tab === "payments"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Payment History ({payments.length})
        </button>
        {previousBookings.length > 0 && (
          <button
            onClick={() => setTab("history")}
            className={`pb-3 px-4 border-b-2 transition-colors ${
              tab === "history"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Booking History ({previousBookings.length})
          </button>
        )}
      </div>

      {/* TAB 1: OVERVIEW */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Identity & Aadhaar Card (with Audited Reveal) */}
          <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2 border-b pb-3">
              <Shield className="h-5 w-5 text-primary" /> Identity & Aadhaar Verification
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium uppercase">
                  Aadhaar Number
                </label>
                <div className="mt-1 flex items-center justify-between p-3 rounded-md bg-muted/50 border">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    <span className="font-mono text-sm font-semibold tracking-wider">
                      {revealedAadhaar ? (
                        <span className="text-primary">{revealedAadhaar}</span>
                      ) : client.aadhaar_last4 ? (
                        `•••• •••• ${client.aadhaar_last4}`
                      ) : (
                        <span className="text-muted-foreground italic text-xs">
                          Not provided
                        </span>
                      )}
                    </span>
                  </div>

                  {(client.aadhaar_last4 || client.aadhaar_encrypted) && (
                    <button
                      onClick={handleToggleAadhaar}
                      disabled={revealing}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded border bg-card hover:bg-muted transition-colors shadow-sm"
                    >
                      {revealing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : revealedAadhaar ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5 text-primary" /> Reveal
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Security Audit Notice */}
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 p-3 text-[11px] text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <p>
                  <strong>Audited Action:</strong> In compliance with security
                  rules, clicking "Reveal" decrypts the Aadhaar and logs your
                  employee ID, timestamp, and role permanently in the system
                  audit log.
                </p>
              </div>

              {revealError && (
                <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
                  {revealError}
                </div>
              )}
            </div>

            {/* Emergency Contact */}
            <div className="pt-2 border-t space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase">
                Emergency Contact
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-semibold text-foreground">
                    {client.emergency_contact_name || "Not provided"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-mono font-semibold text-foreground">
                    {client.emergency_contact_phone || "Not provided"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tenancy & Financial Details */}
          <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2 border-b pb-3">
              <Building className="h-5 w-5 text-primary" /> Tenancy & Billing Terms
            </h2>

            {activeBooking ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">Monthly Rent:</span>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {formatINR(activeBooking.agreed_rent)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Security Deposit:</span>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {formatINR(activeBooking.deposit_amount)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <span className="text-muted-foreground">Move-in Date:</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      {activeBooking.move_in_date
                        ? formatDateIST(activeBooking.move_in_date)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Next Rent Due:</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      {activeBooking.next_rent_due
                        ? formatDateIST(activeBooking.next_rent_due)
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">Booking Source:</span>
                  <p className="font-medium capitalize text-foreground mt-0.5">
                    {activeBooking.source === "existing"
                      ? "Direct Existing Tenant Onboarding"
                      : "Sales Token Pipeline"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-xs italic">
                Client does not currently have an active booking.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENTS */}
      {tab === "payments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-card shadow-sm">
            <div>
              <span className="text-xs text-muted-foreground">
                Total Collections
              </span>
              <p className="text-xl font-bold text-foreground">
                {formatINR(totalPaymentsMade)}
              </p>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {payments.length} Recorded Payment{payments.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            {payments.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-xs">
                No payment receipts found for this client.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 uppercase font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Paid On</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Payment Mode</th>
                      <th className="px-5 py-3">Reference / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="px-5 py-3.5 font-medium">
                          {formatDateIST(p.paid_on)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-muted uppercase">
                            {p.type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-foreground">
                          {formatINR(Number(p.amount))}
                        </td>
                        <td className="px-5 py-3.5 uppercase font-mono text-[11px] text-muted-foreground">
                          {p.mode || "—"}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {p.reference && (
                            <span className="font-mono text-[11px] font-semibold text-foreground block">
                              {p.reference}
                            </span>
                          )}
                          <span>{p.notes || "—"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BOOKING HISTORY */}
      {tab === "history" && (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40 uppercase font-semibold text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Property & Bed</th>
                <th className="px-5 py-3">Move-In</th>
                <th className="px-5 py-3">Move-Out</th>
                <th className="px-5 py-3">Rent / Mo</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {previousBookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-5 py-3.5 font-medium">
                    {b.flat_name} • Room {b.room_no} • Bed {b.bed_label}
                  </td>
                  <td className="px-5 py-3.5">
                    {b.move_in_date ? formatDateIST(b.move_in_date) : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    {b.move_out_date ? formatDateIST(b.move_out_date) : "—"}
                  </td>
                  <td className="px-5 py-3.5 font-semibold">
                    {formatINR(b.agreed_rent)}
                  </td>
                  <td className="px-5 py-3.5 uppercase font-semibold text-[11px]">
                    {b.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
