"use client";

import { useState, useEffect } from "react";
import type { Flat, Room, Bed, BedStatus } from "@/lib/types/database";
import {
  createFlatAction,
  createRoomAction,
  createBedAction,
  updateBedAction,
} from "@/lib/actions/inventory";
import {
  X,
  Loader2,
  Building,
  DoorOpen,
  BedDouble,
  Edit3,
  Plus,
  Trash2,
} from "lucide-react";

interface PropertyDialogsProps {
  flats: Flat[];
  rooms: (Room & { flat_name?: string })[];
  onSuccess: () => void;
  activeDialog: "flat" | "room" | "bed" | "edit-bed" | null;
  editingBed: Bed | null;
  onClose: () => void;
}

interface DraftBed {
  id: string;
  bed_label: string;
  base_price: number;
  status: "vacant" | "blocked";
}

interface DraftRoom {
  id: string;
  room_no: string;
  sharing_type: number;
  default_price: number;
  beds: DraftBed[];
}

function buildDefaultBeds(count: number, price: number): DraftBed[] {
  const letters = "ABCDEFGHIJ";
  return Array.from({ length: count }, (_, idx) => ({
    id: `bed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${idx}`,
    bed_label: letters[idx] || String(idx + 1),
    base_price: price,
    status: "vacant",
  }));
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
  const [draftRooms, setDraftRooms] = useState<DraftRoom[]>([]);

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

  // Sync form values whenever a bed is selected for editing
  useEffect(() => {
    if (editingBed) {
      setEditBedLabel(editingBed.bed_label);
      setEditBedPrice(editingBed.base_price);
      setEditBedStatus(editingBed.status);
    }
  }, [editingBed]);

  // Nested Room & Bed helpers for Add Flat
  function handleAddDraftRoom() {
    const nextIdx = draftRooms.length + 1;
    const defaultSharing = 2;
    const defaultPrice = 8000;
    setDraftRooms((prev) => [
      ...prev,
      {
        id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        room_no: `R${nextIdx}`,
        sharing_type: defaultSharing,
        default_price: defaultPrice,
        beds: buildDefaultBeds(defaultSharing, defaultPrice),
      },
    ]);
  }

  function handleRemoveDraftRoom(roomId: string) {
    setDraftRooms((prev) => prev.filter((r) => r.id !== roomId));
  }

  function handleUpdateDraftRoom(
    roomId: string,
    patch: Partial<Pick<DraftRoom, "room_no" | "sharing_type" | "default_price">>
  ) {
    setDraftRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, ...patch } : r))
    );
  }

  function handleSyncBedsToSharing(roomId: string, sharing: number, price: number) {
    setDraftRooms((prev) =>
      prev.map((r) =>
        r.id === roomId ? { ...r, beds: buildDefaultBeds(sharing, price) } : r
      )
    );
  }

  function handleAddDraftBed(roomId: string) {
    setDraftRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r;
        const letters = "ABCDEFGHIJ";
        const nextLabel =
          letters[r.beds.length] || String(r.beds.length + 1);
        return {
          ...r,
          beds: [
            ...r.beds,
            {
              id: `bed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              bed_label: nextLabel,
              base_price: r.default_price,
              status: "vacant",
            },
          ],
        };
      })
    );
  }

  function handleRemoveDraftBed(roomId: string, bedId: string) {
    setDraftRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, beds: r.beds.filter((b) => b.id !== bedId) }
          : r
      )
    );
  }

  function handleUpdateDraftBed(
    roomId: string,
    bedId: string,
    patch: Partial<Pick<DraftBed, "bed_label" | "base_price" | "status">>
  ) {
    setDraftRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? {
              ...r,
              beds: r.beds.map((b) => (b.id === bedId ? { ...b, ...patch } : b)),
            }
          : r
      )
    );
  }

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
      rooms: draftRooms.map((r) => ({
        room_no: r.room_no,
        sharing_type: r.sharing_type,
        is_active: true,
        beds: r.beds.map((b) => ({
          bed_label: b.bed_label,
          base_price: Number(b.base_price),
          status: b.status,
        })),
      })),
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to create flat.");
    } else {
      setFlatName("");
      setFlatAddress("");
      setFlatOwner("");
      setFlatNotes("");
      setDraftRooms([]);
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

  const totalDraftBeds = draftRooms.reduce((acc, r) => acc + r.beds.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5 sm:p-6 overflow-y-auto">
      <div
        className={`w-full ${
          activeDialog === "flat" ? "max-w-2xl" : "max-w-md"
        } rounded-xl border bg-card p-6 sm:p-7 shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto my-auto`}
      >
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
          <div className="mt-4 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* 1. ADD FLAT FORM (with optional Rooms & Beds) */}
        {activeDialog === "flat" && (
          <form onSubmit={handleCreateFlat} className="mt-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">
                  Flat / Property Name *
                </label>
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
                <label className="block text-sm font-medium">Owner Name</label>
                <input
                  type="text"
                  value={flatOwner}
                  onChange={(e) => setFlatOwner(e.target.value)}
                  placeholder="e.g. Suresh Kumar"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
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
              <label className="block text-sm font-medium">Notes / Landmark</label>
              <textarea
                value={flatNotes}
                onChange={(e) => setFlatNotes(e.target.value)}
                placeholder="e.g. 3BHK on 2nd floor, lift available"
                rows={2}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Rooms & Beds Section */}
            <div className="pt-4 border-t space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <DoorOpen className="h-4 w-4 text-primary" />
                    Rooms & Beds (Optional)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Add rooms and beds right now, or skip and add them later.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddDraftRoom}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Room
                </button>
              </div>

              {draftRooms.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 p-5 text-center text-xs text-muted-foreground">
                  No rooms added yet. Click <strong>+ Add Room</strong> above to configure rooms & beds with this flat.
                </div>
              ) : (
                <div className="space-y-4">
                  {draftRooms.map((room, rIdx) => (
                    <div
                      key={room.id}
                      className="rounded-xl border bg-muted/20 p-5 space-y-4"
                    >
                      {/* Room Header */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                          <DoorOpen className="h-3.5 w-3.5" /> Room #{rIdx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftRoom(room.id)}
                          className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove Room
                        </button>
                      </div>

                      {/* Room Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Room No / Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={room.room_no}
                            onChange={(e) =>
                              handleUpdateDraftRoom(room.id, {
                                room_no: e.target.value,
                              })
                            }
                            placeholder="e.g. R1 or 101"
                            className="block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Sharing Capacity *
                          </label>
                          <select
                            value={room.sharing_type}
                            onChange={(e) => {
                              const newSharing = Number(e.target.value);
                              handleUpdateDraftRoom(room.id, {
                                sharing_type: newSharing,
                              });
                              handleSyncBedsToSharing(
                                room.id,
                                newSharing,
                                room.default_price
                              );
                            }}
                            className="block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
                              <option key={num} value={num}>
                                {num === 1 ? "1 (Private Single)" : `${num} Sharing`}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Default Bed Rent (₹)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={room.default_price}
                            onChange={(e) => {
                              const p = Number(e.target.value);
                              handleUpdateDraftRoom(room.id, { default_price: p });
                            }}
                            className="block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>

                      {/* Beds List for this Room */}
                      <div className="space-y-2.5 pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                            <BedDouble className="h-3.5 w-3.5" /> Beds in Room{" "}
                            {room.room_no || `#${rIdx + 1}`} ({room.beds.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddDraftBed(room.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            <Plus className="h-3 w-3" /> Add Bed
                          </button>
                        </div>

                        {room.beds.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">
                            No beds in this room yet.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {room.beds.map((bed) => (
                              <div
                                key={bed.id}
                                className="grid grid-cols-12 gap-2 items-center bg-card rounded-lg border p-2.5"
                              >
                                <div className="col-span-4 sm:col-span-4">
                                  <label className="block text-[10px] text-muted-foreground mb-0.5">
                                    Bed Label *
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={bed.bed_label}
                                    onChange={(e) =>
                                      handleUpdateDraftBed(room.id, bed.id, {
                                        bed_label: e.target.value,
                                      })
                                    }
                                    placeholder="A, B..."
                                    className="w-full rounded border border-input bg-background px-2.5 py-1 text-xs focus:border-primary focus:outline-none"
                                  />
                                </div>

                                <div className="col-span-4 sm:col-span-4">
                                  <label className="block text-[10px] text-muted-foreground mb-0.5">
                                    Rent (₹) *
                                  </label>
                                  <input
                                    type="number"
                                    required
                                    min={0}
                                    step={100}
                                    value={bed.base_price}
                                    onChange={(e) =>
                                      handleUpdateDraftBed(room.id, bed.id, {
                                        base_price: Number(e.target.value),
                                      })
                                    }
                                    className="w-full rounded border border-input bg-background px-2.5 py-1 text-xs focus:border-primary focus:outline-none"
                                  />
                                </div>

                                <div className="col-span-3 sm:col-span-3">
                                  <label className="block text-[10px] text-muted-foreground mb-0.5">
                                    Status
                                  </label>
                                  <select
                                    value={bed.status}
                                    onChange={(e) =>
                                      handleUpdateDraftBed(room.id, bed.id, {
                                        status: e.target.value as "vacant" | "blocked",
                                      })
                                    }
                                    className="w-full rounded border border-input bg-background px-1.5 py-1 text-xs focus:border-primary focus:outline-none"
                                  >
                                    <option value="vacant">Vacant</option>
                                    <option value="blocked">Blocked</option>
                                  </select>
                                </div>

                                <div className="col-span-1 flex justify-end pt-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveDraftBed(room.id, bed.id)
                                    }
                                    className="text-muted-foreground hover:text-destructive p-1"
                                    title="Remove bed"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
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
                {loading
                  ? "Saving…"
                  : draftRooms.length > 0
                  ? `Save Flat (${draftRooms.length} Room${
                      draftRooms.length > 1 ? "s" : ""
                    }, ${totalDraftBeds} Bed${totalDraftBeds !== 1 ? "s" : ""})`
                  : "Save Flat"}
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
