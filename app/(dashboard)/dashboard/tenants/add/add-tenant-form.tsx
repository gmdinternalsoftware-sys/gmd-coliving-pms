"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { addExistingTenantAction } from "@/lib/actions/tenants";
import { existingTenantSchema } from "@/lib/validators";
import type { Flat, Room, Bed } from "@/lib/types/database";
import { formatINR } from "@/lib/utils";
import {
  UserPlus,
  Building,
  DoorOpen,
  BedDouble,
  Calendar,
  IndianRupee,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface FlatOption {
  id: string;
  name: string;
}

interface RoomOption {
  id: string;
  flat_id: string;
  room_no: string;
  sharing_type: number;
}

interface BedOption {
  id: string;
  room_id: string;
  bed_label: string;
  base_price: number;
  status: string;
}

interface AddTenantFormProps {
  flats: FlatOption[];
  rooms: RoomOption[];
  beds: BedOption[];
}

export function AddTenantForm({ flats, rooms, beds }: AddTenantFormProps) {
  const router = useRouter();

  // Selection cascade
  const [selectedFlatId, setSelectedFlatId] = useState<string>(
    flats[0]?.id || ""
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [selectedBedId, setSelectedBedId] = useState<string>("");

  // Form fields
  const [fullName, setFullName] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];
  const nextMonthStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [moveInDate, setMoveInDate] = useState(todayStr);
  const [agreedRent, setAgreedRent] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [nextRentDue, setNextRentDue] = useState(nextMonthStr);
  const [openingDues, setOpeningDues] = useState<number>(0);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Available rooms for selected flat
  const availableRooms = useMemo(() => {
    return rooms.filter((r) => r.flat_id === selectedFlatId);
  }, [rooms, selectedFlatId]);

  // Available vacant beds for selected room
  const availableBeds = useMemo(() => {
    return beds.filter((b) => b.room_id === selectedRoomId);
  }, [beds, selectedRoomId]);

  // When room changes, pick first bed and pre-populate rent
  function handleRoomChange(roomId: string) {
    setSelectedRoomId(roomId);
    const firstBed = beds.find((b) => b.room_id === roomId);
    if (firstBed) {
      setSelectedBedId(firstBed.id);
      setAgreedRent(Number(firstBed.base_price));
    } else {
      setSelectedBedId("");
    }
  }

  // When bed changes, update rent
  function handleBedChange(bedId: string) {
    setSelectedBedId(bedId);
    const bed = beds.find((b) => b.id === bedId);
    if (bed) {
      setAgreedRent(Number(bed.base_price));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      full_name: fullName.trim(),
      aadhaar: aadhaar.trim() || undefined,
      phone1: phone1.trim(),
      phone2: phone2.trim() || undefined,
      emergency_contact_name: emergencyName.trim() || undefined,
      emergency_contact_phone: emergencyPhone.trim() || undefined,
      bed_id: selectedBedId,
      move_in_date: moveInDate,
      agreed_rent: Number(agreedRent),
      deposit_amount: Number(depositAmount),
      next_rent_due: nextRentDue,
      opening_dues: Number(openingDues),
    };

    const clientValidation = existingTenantSchema.safeParse(payload);
    if (!clientValidation.success) {
      setError(clientValidation.error.errors.map((err) => err.message).join(", "));
      setLoading(false);
      return;
    }

    try {
      const res = await addExistingTenantAction(payload);
      if (!res.success) {
        setError(res.error || "Failed to onboard tenant.");
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center space-y-4 shadow-sm animate-in fade-in duration-200">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h2 className="text-2xl font-bold">Tenant Successfully Onboarded!</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Client <strong className="text-foreground">{fullName}</strong> has been
          registered with an active booking, and the bed has been marked as
          Occupied.
        </p>
        <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard/beds"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            View Bed Inventory <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => {
              setSuccess(false);
              setFullName("");
              setAadhaar("");
              setPhone1("");
              setPhone2("");
              setEmergencyName("");
              setEmergencyPhone("");
              setDepositAmount(0);
              setOpeningDues(0);
            }}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Add Another Tenant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Add Existing Tenant
          </h1>
          <p className="text-sm text-muted-foreground">
            Directly onboard active tenants who have already moved in without
            going through the sales token pipeline.
          </p>
        </div>
        <Link
          href="/dashboard/tenants/import"
          className="inline-flex items-center gap-2 rounded-md border bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:bg-muted"
        >
          Bulk Import (Excel/CSV) <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Bed Selection */}
        <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2 border-b pb-3">
            <BedDouble className="h-5 w-5 text-primary" /> 1. Select Flat & Vacant Bed
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase">
                Property / Flat *
              </label>
              <select
                required
                value={selectedFlatId}
                onChange={(e) => {
                  setSelectedFlatId(e.target.value);
                  setSelectedRoomId("");
                  setSelectedBedId("");
                }}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {flats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase">
                Room *
              </label>
              <select
                required
                value={selectedRoomId}
                onChange={(e) => handleRoomChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- Choose Room --</option>
                {availableRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.room_no} ({r.sharing_type}-Sharing)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase">
                Vacant Bed *
              </label>
              <select
                required
                value={selectedBedId}
                onChange={(e) => handleBedChange(e.target.value)}
                disabled={!selectedRoomId || availableBeds.length === 0}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="">
                  {availableBeds.length === 0
                    ? "(No vacant beds)"
                    : "-- Choose Bed --"}
                </option>
                {availableBeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    Bed {b.bed_label} — {formatINR(b.base_price)}/mo
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Step 2: Tenant Information */}
        <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2 border-b pb-3">
            <UserPlus className="h-5 w-5 text-primary" /> 2. Personal & Contact Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Tenant Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Anand Verma"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                Primary Phone (10 digits) *
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-muted-foreground">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={phone1}
                  onChange={(e) => setPhone1(e.target.value.replace(/\D/g, ""))}
                  placeholder="9876543210"
                  className="block w-full rounded-md border border-input bg-background pl-11 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">
                12-digit Aadhaar Number (Optional)
              </label>
              <div className="mt-1 relative">
                <input
                  type="password"
                  maxLength={12}
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ""))}
                  placeholder="12 digits (Stored AES-256 Encrypted)"
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-600" /> Stored
                encrypted with AES-256-GCM. Plaintext is never stored.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium">
                Secondary Phone (Optional)
              </label>
              <input
                type="tel"
                maxLength={10}
                value={phone2}
                onChange={(e) => setPhone2(e.target.value.replace(/\D/g, ""))}
                placeholder="Optional 10-digit number"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                Emergency Contact Name
              </label>
              <input
                type="text"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="e.g. Father / Mother / Guardian"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                Emergency Contact Phone
              </label>
              <input
                type="tel"
                maxLength={10}
                value={emergencyPhone}
                onChange={(e) =>
                  setEmergencyPhone(e.target.value.replace(/\D/g, ""))
                }
                placeholder="10-digit emergency number"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Tenancy & Financial Details */}
        <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2 border-b pb-3">
            <IndianRupee className="h-5 w-5 text-primary" /> 3. Tenancy & Financial Terms
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium">Actual Move-in Date *</label>
              <input
                type="date"
                required
                value={moveInDate}
                onChange={(e) => setMoveInDate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Agreed Monthly Rent (₹) *</label>
              <input
                type="number"
                required
                min={0}
                step={100}
                value={agreedRent}
                onChange={(e) => setAgreedRent(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                Security Deposit Already Paid (₹)
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Next Rent Due Date *</label>
              <input
                type="date"
                required
                value={nextRentDue}
                onChange={(e) => setNextRentDue(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                Opening Dues / Balance (₹)
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={openingDues}
                onChange={(e) => setOpeningDues(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Any unpaid balance carried forward
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !selectedBedId}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Onboarding…" : "Onboard Tenant & Occupy Bed"}
          </button>
        </div>
      </form>
    </div>
  );
}
