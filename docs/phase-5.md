# Phase 5: Payments, Dues, Rent Generation & Move-Out Flow

## Overview
Phase 5 establishes the full accounting lifecycle: recurring monthly rent demand generation, overdue tracking with days overdue, payment ledger, official printable receipts, tenant notice marking, and move-out security deposit settlement with automatic bed release.

## Features Built

### 1. Monthly Rent Generation (`generate_monthly_rents_atomic`)
- Accessible to **Accounts** and **Admin**.
- Iterates over all active bookings and atomically generates rent demands for a given billing month (`rent_dues`).
- Intelligently calculates due dates based on the tenant's actual move-in day.
- Prevents duplicate demands via unique constraint `(booking_id, for_month)`.
- Logs the generation event in `audit_log`.

### 2. Overdue Tracking & Dues (`v_dues_overview`)
- Live calculated status:
  - `pending`: Active demand before due date.
  - `overdue`: Demanded and due date has passed. Shows **exact days overdue** (e.g. 15 days overdue).
  - `partial`: Partially collected rent.
  - `paid`: Rent settled in full.
- Real-time `balance_due` computation.

### 3. Payment Entry & Settlement (`record_payment_atomic`)
- Accessible to **Accounts** and **Admin**.
- Supports Rent, Deposit, Electricity, and Other payment types.
- Multiple payment modes (UPI, Bank Transfer / NEFT, Cash, Card).
- Auto-settles linked `rent_dues` row and advances `bookings.next_rent_due` by one month upon full payment.
- Immutable ledger entry in `payments` table and `audit_log`.

### 4. Printable Receipts
- Modal popup with official **GMD Co-living Pvt Ltd** letterhead styling.
- Displays receipt number (`RCP-XXXXXXXX`), payment date, tenant details, room & bed label, payment mode, reference ID, and formatted currency in ₹ (Indian numeral grouping).
- One-click **"Print / Save PDF"** button using clean print stylesheet.

### 5. Notice & Move-Out Settlement (`set_tenant_notice_atomic` & `process_move_out_atomic`)
- **Put on Notice**: Marks notice date and expected departure date; transitions bed status to `'notice'`.
- **Move-Out Settlement**:
  - Displays total security deposit held.
  - Captures itemized deductions (painting, damages, unpaid bills) with reasoning.
  - Calculates net deposit refund and records it as a `'refund'` transaction.
  - Sets booking status to `'moved_out'`.
  - **Atomically releases the bed back to `'vacant'`** so Sales can immediately book it.

## Testing Instructions
1. Run migration `supabase/migrations/00000000000006_phase5_payments_and_dues.sql` in Supabase SQL Editor.
2. Navigate to `/dashboard/payments`.
3. Check the **Rent Dues & Overdues** tab:
   - Notice the overdue demand for Priya Patel (highlighted with exact days overdue).
   - Click **"Collect Rent"** to record a payment and verify the balance clears.
4. Check the **Payment Ledger & Receipts** tab:
   - Click **"View Receipt"** on any row to preview and print the official receipt.
5. Click **"Generate Rent Demands"** to generate new monthly demands.
6. Check the **Notice & Move-Out** tab:
   - Click **"Process Final Move-Out & Refund"** on a notice tenant to finalize deposit deductions, record the refund, and verify the bed becomes vacant on `/dashboard/beds`.
