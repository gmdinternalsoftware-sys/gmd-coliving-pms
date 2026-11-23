"use client";

import { useState, useMemo } from "react";
import type { Caretaker, Flat } from "@/lib/types/database";
import { addCaretakerAction, deleteCaretakerAction } from "@/lib/actions/caretakers";
import {
  UserCog,
  Plus,
  Search,
  Filter,
  Phone,
  Building,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";

interface CaretakersViewProps {
  initialCaretakers: Caretaker[];
  flats: Flat[];
  isAdmin: boolean;
}

export function CaretakersView({
  initialCaretakers,
  flats,
  isAdmin,
}: CaretakersViewProps) {
  const [caretakers, setCaretakers] = useState<Caretaker[]>(initialCaretakers);
  const [search, setSearch] = useState("");
  const [flatFilter, setFlatFilter] = useState("all");

  // Add Caretaker Modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedFlatId, setSelectedFlatId] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAltPhone, setNewAltPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filtered Caretakers
  const filteredCaretakers = useMemo(() => {
    return caretakers.filter((c) => {
      if (flatFilter !== "all" && c.flat_id !== flatFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.name?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.alternate_phone?.includes(q) ||
          c.flat_name?.toLowerCase().includes(q) ||
          c.notes?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [caretakers, flatFilter, search]);

  // Handle Add Caretaker Submit
  const handleAddCaretaker = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);

    const res = await addCaretakerAction({
      name: newName,
      flat_id: selectedFlatId,
      phone: newPhone,
      alternate_phone: newAltPhone || undefined,
      notes: newNotes || undefined,
    });

    setAddLoading(false);

    if (!res.success) {
      setAddError(res.error || "Failed to add caretaker.");
      return;
    }

    setIsAddOpen(false);
    window.location.reload();
  };

  // Handle Delete Caretaker Submit
  const handleDeleteCaretaker = async (id: string) => {
    if (!confirm("Are you sure you want to remove this caretaker?")) {
      return;
    }

    setDeletingId(id);
    setDeleteError(null);

    const res = await deleteCaretakerAction(id);
    setDeletingId(null);

    if (!res.success) {
      alert(res.error || "Failed to delete caretaker.");
      return;
    }

    setCaretakers((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Property Caretakers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Directory of property caretakers, on-site personnel, and contact details.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              if (flats.length > 0) setSelectedFlatId(flats[0].id);
              setNewName("");
              setNewPhone("");
              setNewAltPhone("");
              setNewNotes("");
              setAddError(null);
              setIsAddOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Add Caretaker
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search caretaker name, phone, flat name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border bg-background"
          />
        </div>

        <div className="flex gap-2">
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
      </div>

      {/* Caretakers Content */}
      {filteredCaretakers.length === 0 ? (
        <div className="p-8 text-center border rounded-xl bg-card">
          <UserCog className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold">No caretakers found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {isAdmin
              ? "Click 'Add Caretaker' to assign a caretaker to a property."
              : "No caretakers have been added for this property filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile Cards (Phone Screen) */}
          <div className="grid grid-cols-1 md:hidden gap-3">
            {filteredCaretakers.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl border bg-card shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-foreground">{c.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Building className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-foreground">{c.flat_name}</span>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteCaretaker(c.id)}
                      disabled={deletingId === c.id}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                      title="Delete Caretaker"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-muted/40 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Primary Contact:</span>
                    <a
                      href={`tel:${c.phone}`}
                      className="font-bold text-primary flex items-center gap-1 hover:underline"
                    >
                      <Phone className="w-3 h-3" /> {c.phone}
                    </a>
                  </div>

                  {c.alternate_phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Alternate:</span>
                      <a
                        href={`tel:${c.alternate_phone}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {c.alternate_phone}
                      </a>
                    </div>
                  )}

                  {c.notes && (
                    <div className="pt-1 border-t border-border/60 text-muted-foreground">
                      <span className="font-semibold text-foreground">Notes:</span> {c.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/60 text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-3 font-semibold">Caretaker Name</th>
                  <th className="px-4 py-3 font-semibold">Assigned Property</th>
                  <th className="px-4 py-3 font-semibold">Primary Phone</th>
                  <th className="px-4 py-3 font-semibold">Alternate Phone</th>
                  <th className="px-4 py-3 font-semibold">Responsibilities / Notes</th>
                  {isAdmin && <th className="px-4 py-3 font-semibold text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {filteredCaretakers.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {c.name.charAt(0)}
                        </div>
                        {c.name}
                      </div>
                    </td>

                    <td className="px-4 py-3 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-muted-foreground" />
                        {c.flat_name}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <a
                        href={`tel:${c.phone}`}
                        className="font-bold text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" /> {c.phone}
                      </a>
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      {c.alternate_phone ? (
                        <a href={`tel:${c.alternate_phone}`} className="hover:underline">
                          {c.alternate_phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground max-w-xs">
                      {c.notes || <span className="italic text-muted-foreground/60">No notes</span>}
                    </td>

                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteCaretaker(c.id)}
                          disabled={deletingId === c.id}
                          className="px-2.5 py-1 text-xs font-semibold rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD CARETAKER (ADMIN ONLY)
          ========================================================================= */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-card border rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Add Property Caretaker</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Assign a caretaker to an active flat with direct contact numbers.
                </p>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCaretaker} className="p-5 space-y-3">
              {addError && (
                <div className="p-2.5 text-xs rounded-lg bg-destructive/15 text-destructive border border-destructive/30">
                  {addError}
                </div>
              )}

              <div>
                <label className="text-xs font-medium block mb-1">Caretaker Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Gowda"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Assigned Property / Flat *</label>
                <select
                  required
                  value={selectedFlatId}
                  onChange={(e) => setSelectedFlatId(e.target.value)}
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1">Primary Phone (10 digits) *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ""))}
                    className="w-full text-xs p-2 rounded-lg border bg-background"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1">Alternate Phone</label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="Optional"
                    value={newAltPhone}
                    onChange={(e) => setNewAltPhone(e.target.value.replace(/\D/g, ""))}
                    className="w-full text-xs p-2 rounded-lg border bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Responsibilities / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Day shift, holds keys, water pump management"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading || !selectedFlatId || newPhone.length !== 10}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {addLoading ? "Saving..." : "Add Caretaker"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
