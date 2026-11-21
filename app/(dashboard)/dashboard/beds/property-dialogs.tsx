"use client";

import { useState } from "react";
import type { Flat, Room, Bed, BedStatus } from "@/lib/types/database";
import {
  createFlatAction,
  createRoomAction,
  createBedAction,
  updateBedAction,
} from "@/lib/actions/inventory";
import { X, Loader2, Building, DoorOpen, BedDouble, Edit3 } from "lucide-react";

interface PropertyDialogsProps {
  flats: Flat[];
  rooms: (Room & { flat_name?: string })[];
  onSuccess: () => void;
  activeDialog: "flat" | "room" | "bed" | "edit-bed" | null;
  editingBed: Bed | null;
  onClose: () => void;
}

export function PropertyDialogs({
  flats,
  rooms,
  onSuccess,
  activeDialog,
  editingBed,
  onClose,
}: PropertyDialogsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flat Form State
  const [flatName, setFlatName] = useState("");
  const [flatAddress, setFlatAddress] = useState("");
  const [flatOwner, setFlatOwner] = useState("");
  const [flatNotes, setFlatNotes] = useState("");

  // Room Form State
  const [roomFlatId, setRoomFlatId] = useState(flats[0]?.id || "");
  const [roomNo, setRoomNo] = useState("");
  const [roomSharing, setRoomSharing] = useState<number>(2);

  // Bed Form State
  const [bedRoomId, setBedRoomId] = useState(rooms[0]?.id || "");
  const [bedLabel, setBedLabel] = useState("");
  const [bedPrice, setBedPrice] = useState<number>(8000);
  const [bedStatus, setBedStatus] = useState<BedStatus>("vacant");

  // Edit Bed Form State
  const [editBedLabel, setEditBedLabel] = useState(editingBed?.bed_label || "");
  const [editBedPrice, setEditBedPrice] = useState<number>(
    editingBed?.base_price || 0
  );
  const [editBedStatus, setEditBedStatus] = useState<BedStatus>(
    editingBed?.status || "vacant"
  );

  async function handleCreateFlat(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createFlatAction({
      name: flatName,
      address: flatAddress,
      owner_name: flatOwner,
      notes: flatNotes,
      is_active: true,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to create flat.");
    } else {
      setFlatName("");
      setFlatAddress("");
      setFlatOwner("");
      setFlatNotes("");
      onSuccess();
      onClose();
    }
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createRoomAction({
      flat_id: roomFlatId,
      room_no: roomNo,
      sharing_type: Number(roomSharing),
      is_active: true,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to create room.");
    } else {
      setRoomNo("");
      setRoomSharing(2);
      onSuccess();
      onClose();
    }
  }

  async function handleCreateBed(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createBedAction({
      room_id: bedRoomId,
      bed_label: bedLabel,
      base_price: Number(bedPrice),
      status: bedStatus,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to create bed.");
    } else {
      setBedLabel("");
      setBedPrice(8000);
      setBedStatus("vacant");
      onSuccess();
      onClose();
    }
  }

  async function handleEditBed(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBed) return;
    setLoading(true);
    setError(null);

    const res = await updateBedAction(editingBed.id, {
      bed_label: editBedLabel,
      base_price: Number(editBedPrice),
      status: editBedStatus,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to update bed.");
    } else {
      onSuccess();
      onClose();
    }
  }

  if (!activeDialog) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {activeDialog === "flat" && (
              <>
                <Building className="h-5 w-5 text-primary" /> Add New Flat
              </>
            )}
            {activeDialog === "room" && (
              <>
                <DoorOpen className="h-5 w-5 text-primary" /> Add Room to Flat
              </>
            )}
            {activeDialog === "bed" && (
              <>
                <BedDouble className="h-5 w-5 text-primary" /> Add Bed to Room
              </>
            )}
            {activeDialog === "edit-bed" && (
              <>
                <Edit3 className="h-5 w-5 text-primary" /> Edit Bed Details
              </>
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* 1. ADD FLAT FORM */}
        {activeDialog === "flat" && (
          <form onSubmit={handleCreateFlat} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium">Flat / Property Name *</label>
              <input
                type="text"
                required
                value={flatName}
                onChange={(e) => setFlatName(e.target.value)}
                placeholder="e.g. Sunrise Villa 101"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Address</label>
              <input
                type="text"
                value={flatAddress}
                onChange={(e) => setFlatAddress(e.target.value)}
                placeholder="e.g. #42 5th Cross, Koramangala"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Owner Name</label>
              <input
                type="text"
                value={flatOwner}
                onChange={(e) => setFlatOwner(e.target.value)}
                placeholder="e.g. Suresh Kumar"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Notes / Landmark</label>
              <textarea
                value={flatNotes}
                onChange={(e) => setFlatNotes(e.target.value)}
                placeholder="e.g. 3BHK on 2nd floor, lift available"
                rows={2}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Adding…" : "Save Flat"}
              </button>
            </div>
          </form>
        )}

        {/* 2. ADD ROOM FORM */}
        {activeDialog === "room" && (
          <form onSubmit={handleCreateRoom} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium">Select Flat *</label>
              <select
                required
                value={roomFlatId}
                onChange={(e) => setRoomFlatId(e.target.value)}
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
              <label className="block text-sm font-medium">Room Number / Name *</label>
              <input
                type="text"
                required
                value={roomNo}
                onChange={(e) => setRoomNo(e.target.value)}
                placeholder="e.g. Room 1 or Master Bed"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Sharing Capacity (Beds) *</label>
              <select
                value={roomSharing}
                onChange={(e) => setRoomSharing(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
                  <option key={num} value={num}>
                    {num === 1 ? "1 (Private Single)" : `${num} Sharing`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Adding…" : "Save Room"}
              </button>
            </div>
          </form>
        )}

        {/* 3. ADD BED FORM */}
        {activeDialog === "bed" && (
          <form onSubmit={handleCreateBed} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium">Select Room *</label>
              <select
                required
                value={bedRoomId}
                onChange={(e) => setBedRoomId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.flat_name ? `${r.flat_name} — ` : ""}Room {r.room_no} ({r.sharing_type}-sharing)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Bed Label *</label>
              <input
                type="text"
                required
                value={bedLabel}
                onChange={(e) => setBedLabel(e.target.value)}
                placeholder="e.g. A, B, C or 1, 2"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Listed Monthly Rent (₹) *</label>
              <input
                type="number"
                required
                min={0}
                step={100}
                value={bedPrice}
                onChange={(e) => setBedPrice(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Initial Status</label>
              <select
                value={bedStatus}
                onChange={(e) => setBedStatus(e.target.value as BedStatus)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="vacant">Vacant</option>
                <option value="blocked">Blocked (Under Maintenance)</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Adding…" : "Save Bed"}
              </button>
            </div>
          </form>
        )}

        {/* 4. EDIT BED FORM */}
        {activeDialog === "edit-bed" && editingBed && (
          <form onSubmit={handleEditBed} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium">Bed Label *</label>
              <input
                type="text"
                required
                value={editBedLabel}
                onChange={(e) => setEditBedLabel(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Listed Monthly Rent (₹) *</label>
              <input
                type="number"
                required
                min={0}
                step={100}
                value={editBedPrice}
                onChange={(e) => setEditBedPrice(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Bed Status</label>
              <select
                value={editBedStatus}
                onChange={(e) => setEditBedStatus(e.target.value as BedStatus)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="vacant">Vacant</option>
                <option value="reserved">Reserved (Token)</option>
                <option value="occupied">Occupied</option>
                <option value="notice">On Notice</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Saving…" : "Update Bed"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
