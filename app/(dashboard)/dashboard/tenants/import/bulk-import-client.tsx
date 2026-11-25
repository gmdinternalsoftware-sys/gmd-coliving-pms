"use client";

import { useState } from "react";
import ExcelJS from "exceljs";
import { bulkImportTenantsAction } from "@/lib/actions/tenants";
import type { ExistingTenantInput } from "@/lib/validators";
import { formatINR } from "@/lib/utils";
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface FlatRef {
  id: string;
  name: string;
}

interface RoomRef {
  id: string;
  flat_id: string;
  room_no: string;
}

interface BedRef {
  id: string;
  room_id: string;
  bed_label: string;
  base_price: number;
  status: string;
}

interface BulkImportClientProps {
  flats: FlatRef[];
  rooms: RoomRef[];
  beds: BedRef[];
}

interface ParsedRow {
  rowNumber: number;
  flat_name: string;
  room_no: string;
  bed_label: string;
  full_name: string;
  aadhaar: string;
  phone1: string;
  phone2: string;
  move_in_date: string;
  agreed_rent: number;
  deposit_amount: number;
  next_rent_due: string;
  opening_dues: number;
  matchedBedId?: string;
  isValid: boolean;
  errors: string[];
}

export function BulkImportClient({
  flats,
  rooms,
  beds,
}: BulkImportClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    totalCount: number;
    successCount: number;
    failureCount: number;
    details?: any[];
  } | null>(null);

  // Parse uploaded Excel/CSV file
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setParsing(true);
    setResult(null);

    try {
      const buffer = await selected.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        alert("The selected workbook contains no worksheets.");
        setParsing(false);
        return;
      }

      const parsed: ParsedRow[] = [];
      const seenAadhaars = new Set<string>();

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const flat_name = String(row.getCell(1).value || "").trim();
        const room_no = String(row.getCell(2).value || "").trim();
        const bed_label = String(row.getCell(3).value || "").trim();
        const full_name = String(row.getCell(4).value || "").trim();
        const aadhaar = String(row.getCell(5).value || "").replace(/\D/g, "");
        const phone1 = String(row.getCell(6).value || "").replace(/\D/g, "");
        const phone2 = String(row.getCell(7).value || "").replace(/\D/g, "");

        // Dates
        let move_in_date = "";
        const rawMoveIn = row.getCell(8).value;
        if (rawMoveIn instanceof Date) {
          move_in_date = rawMoveIn.toISOString().split("T")[0];
        } else {
          move_in_date = String(rawMoveIn || "").trim();
        }

        const agreed_rent = Number(row.getCell(9).value) || 0;
        const deposit_amount = Number(row.getCell(10).value) || 0;

        let next_rent_due = "";
        const rawNextRent = row.getCell(11).value;
        if (rawNextRent instanceof Date) {
          next_rent_due = rawNextRent.toISOString().split("T")[0];
        } else {
          next_rent_due = String(rawNextRent || "").trim();
        }

        const opening_dues = Number(row.getCell(12).value) || 0;

        // Skip completely empty rows
        if (!flat_name && !full_name && !phone1) return;

        // Row Validation
        const rowErrors: string[] = [];

        // 1. Validate Flat
        const matchedFlat = flats.find(
          (f) => f.name.toLowerCase() === flat_name.toLowerCase()
        );
        if (!matchedFlat) {
          rowErrors.push(`Flat "${flat_name}" not found.`);
        }

        // 2. Validate Room
        const matchedRoom = matchedFlat
          ? rooms.find(
              (r) =>
                r.flat_id === matchedFlat.id &&
                r.room_no.toLowerCase() === room_no.toLowerCase()
            )
          : null;
        if (matchedFlat && !matchedRoom) {
          rowErrors.push(
            `Room "${room_no}" not found in Flat "${flat_name}".`
          );
        }

        // 3. Validate Bed
        let matchedBedId: string | undefined;
        if (matchedRoom) {
          const matchedBed = beds.find(
            (b) =>
              b.room_id === matchedRoom.id &&
              b.bed_label.toLowerCase() === bed_label.toLowerCase()
          );

          if (!matchedBed) {
            rowErrors.push(
              `Bed "${bed_label}" not found in Room "${room_no}".`
            );
          } else if (
            matchedBed.status === "occupied" ||
            matchedBed.status === "reserved"
          ) {
            rowErrors.push(
              `Bed "${bed_label}" is already ${matchedBed.status.toUpperCase()}.`
            );
          } else {
            matchedBedId = matchedBed.id;
          }
        }

        // 4. Validate Tenant Details
        if (!full_name || full_name.length < 2) {
          rowErrors.push("Tenant Name must be at least 2 characters.");
        }

        if (!/^\d{10}$/.test(phone1)) {
          rowErrors.push(`Phone 1 must be 10 digits (got "${phone1}").`);
        }

        if (phone2 && !/^\d{10}$/.test(phone2)) {
          rowErrors.push(`Phone 2 must be 10 digits (got "${phone2}").`);
        }

        if (aadhaar) {
          if (!/^\d{12}$/.test(aadhaar)) {
            rowErrors.push(`Aadhaar must be 12 digits (got "${aadhaar}").`);
          } else if (seenAadhaars.has(aadhaar)) {
            rowErrors.push("Duplicate Aadhaar found in sheet.");
          } else {
            seenAadhaars.add(aadhaar);
          }
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(move_in_date)) {
          rowErrors.push(`Move-in date must be YYYY-MM-DD.`);
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(next_rent_due)) {
          rowErrors.push(`Next rent due must be YYYY-MM-DD.`);
        }

        parsed.push({
          rowNumber,
          flat_name,
          room_no,
          bed_label,
          full_name,
          aadhaar,
          phone1,
          phone2,
          move_in_date,
          agreed_rent,
          deposit_amount,
          next_rent_due,
          opening_dues,
          matchedBedId,
          isValid: rowErrors.length === 0,
          errors: rowErrors,
        });
      });

      setRows(parsed);
    } catch (err: any) {
      alert("Failed to parse Excel file: " + err.message);
    } finally {
      setParsing(false);
    }
  }

  // Commit valid rows
  async function handleCommit() {
    const validRows = rows.filter((r) => r.isValid && r.matchedBedId);
    if (validRows.length === 0) return;

    setImporting(true);

    const payload: ExistingTenantInput[] = validRows.map((r) => ({
      full_name: r.full_name,
      aadhaar: r.aadhaar || undefined,
      phone1: r.phone1,
      phone2: r.phone2 || undefined,
      bed_id: r.matchedBedId!,
      move_in_date: r.move_in_date,
      agreed_rent: r.agreed_rent,
      deposit_amount: r.deposit_amount,
      next_rent_due: r.next_rent_due,
      opening_dues: r.opening_dues,
    }));

    try {
      const res = await bulkImportTenantsAction(payload);
      if (res.success) {
        setResult({
          totalCount: res.totalCount || 0,
          successCount: res.successCount || 0,
          failureCount: res.failureCount || 0,
          details: res.details,
        });
      } else {
        alert(res.error || "Bulk import failed.");
      }
    } catch (err: any) {
      alert("Import error: " + err.message);
    } finally {
      setImporting(false);
    }
  }

  const validCount = rows.filter((r) => r.isValid).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bulk Import Existing Tenants
          </h1>
          <p className="text-sm text-muted-foreground">
            Onboard multiple existing tenants at once via an Excel (.xlsx) file
            with row-by-row pre-validation.
          </p>
        </div>

        <a
          href="/api/templates/tenants-import"
          download="GMD_Tenants_Import_Template.xlsx"
          className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm font-semibold shadow-sm hover:bg-muted transition-colors text-primary"
        >
          <Download className="h-4 w-4" /> Download Excel Template
        </a>
      </div>

      {/* Upload Box */}
      {!result && (
        <div className="rounded-lg border-2 border-dashed bg-card p-8 text-center space-y-4 hover:border-primary/50 transition-colors">
          <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground" />
          <div>
            <label
              htmlFor="excel-upload"
              className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              <Upload className="h-4 w-4" /> Select Excel File (.xlsx)
            </label>
            <input
              id="excel-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Supported formats: Excel (.xlsx, .xls) and CSV. Maximum 200 rows per
            batch.
          </p>
        </div>
      )}

      {/* Parsing Spinner */}
      {parsing && (
        <div className="rounded-lg border bg-card p-8 text-center space-y-2">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">
            Reading and validating rows against property inventory…
          </p>
        </div>
      )}

      {/* Result Confirmation Banner */}
      {result && (
        <div className="rounded-lg border bg-card p-8 text-center space-y-4 shadow-sm animate-in fade-in">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h2 className="text-2xl font-bold">Bulk Import Complete!</h2>
          <p className="text-sm text-muted-foreground">
            Successfully committed{" "}
            <strong className="text-foreground">
              {result.successCount} tenants
            </strong>{" "}
            into the system and updated their respective beds to Occupied.
          </p>
          {result.failureCount > 0 && (
            <p className="text-xs text-destructive">
              {result.failureCount} rows failed to import due to database
              constraints.
            </p>
          )}
          <div className="pt-4 flex justify-center gap-3">
            <Link
              href="/dashboard/beds"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              View Bed Inventory <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => {
                setFile(null);
                setRows([]);
                setResult(null);
              }}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" /> Import Another File
            </button>
          </div>
        </div>
      )}

      {/* Validation Preview Table */}
      {!result && rows.length > 0 && (
        <div className="space-y-4 animate-in fade-in">
          {/* Summary Chips & Commit Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 sm:p-6 rounded-lg border bg-card shadow-sm">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold">
                Total Rows: {rows.length}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-semibold">
                <CheckCircle2 className="h-3 w-3" /> {validCount} Valid
              </span>
              {invalidCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 px-2.5 py-0.5 text-xs font-semibold">
                  <XCircle className="h-3 w-3" /> {invalidCount} Invalid
                </span>
              )}
            </div>

            <button
              onClick={handleCommit}
              disabled={importing || validCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              {importing
                ? "Committing…"
                : `Commit ${validCount} Valid ${
                    validCount === 1 ? "Tenant" : "Tenants"
                  }`}
            </button>
          </div>

          {/* Table */}
          <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40 uppercase font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tenant Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Target Bed</th>
                  <th className="px-4 py-3">Rent</th>
                  <th className="px-4 py-3">Move-In</th>
                  <th className="px-4 py-3">Validation Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr
                    key={r.rowNumber}
                    className={`hover:bg-muted/20 ${
                      !r.isValid ? "bg-rose-50/30 dark:bg-rose-950/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-medium">
                      #{r.rowNumber}
                    </td>
                    <td className="px-4 py-3">
                      {r.isValid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                          <XCircle className="h-3.5 w-3.5" /> Error
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {r.full_name || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono">{r.phone1 || "—"}</td>
                    <td className="px-4 py-3">
                      {r.flat_name} • Rm {r.room_no} • Bed {r.bed_label}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {formatINR(r.agreed_rent)}
                    </td>
                    <td className="px-4 py-3 font-mono">{r.move_in_date}</td>
                    <td className="px-4 py-3">
                      {r.errors.length > 0 ? (
                        <ul className="list-disc list-inside text-rose-600 space-y-0.5">
                          {r.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground italic">
                          None
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
