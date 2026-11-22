# Phase 4: Token Workflow, NOC Verification & Accounts Move-In

## Overview
Phase 4 implements the complete pre-tenancy pipeline: Sales token reservation on vacant beds, NOC compliance background check (Clear / Hold / Reject), and Accounts move-in confirmation with security deposit and initial rent collection.

## Core Features & Workflow

### 1. Sales Token Creation (`create_token_booking_atomic`)
- Accessible to **Sales** and **Admin** personnel.
- Strict inventory integrity:
  - Bed selection cascades dynamically: **Flat $\to$ Room $\to$ Vacant Bed only**.
  - Atomically locks bed row (`for update`) and verifies status is strictly `vacant`.
  - If another employee just took the bed, returns an immediate, friendly error message.
  - Automatically updates bed status to `reserved`.
- Client creation / deduplication:
  - Re-uses client profile if matched by phone or Aadhaar hash, or registers new client.
  - Aadhaar is AES-256-GCM encrypted server-side; plaintext is never stored or logged.
- Booking & Payment:
  - Creates booking in `token` status with agreed rent, token advance, and expected move-in date.
  - Auto-creates an initial pending `noc_records` entry.
  - Inserts initial `payments` record for the token advance amount.
  - Logs the event to `audit_log`.

### 2. NOC Review Queue (`update_noc_status_atomic`)
- Accessible to **NOC** and **Admin** personnel.
- Reviews incoming client identity, address, and verification documents.
- Three decisive actions with mandatory remarks:
  - **Clear NOC**: Sets NOC status to `cleared` and booking status to `noc_cleared`. Ready for Accounts.
  - **Put on Hold**: Sets NOC status to `hold` and booking status to `noc_hold`. Alerts Sales to rectify documentation (e.g. blurred Aadhaar).
  - **Reject**: Sets NOC status to `rejected`, marks booking as `rejected`, and **immediately frees the reserved bed back to `vacant`** so Sales can re-sell it without delay!
- Writes decision and actor ID to `audit_log`.

### 3. Accounts Move-In & Financial Collection (`confirm_accounts_move_in_atomic`)
- Accessible to **Accounts** and **Admin** personnel.
- Gated by NOC clearance (booking must be `noc_cleared`).
- Confirms actual move-in date and captures:
  - Security Deposit amount + payment mode (UPI, NEFT, Cash) + transaction reference.
  - First Month Rent amount + payment mode + transaction reference.
  - Sets calculated `next_rent_due` date (defaults to 1 month from move-in).
- Updates booking status to `active` and bed status to `occupied`.
- Inserts separate immutable transaction entries in `payments` ledger.
- Logs move-in event to `audit_log`.

### 4. Interactive Tokens Dashboard (`/dashboard/tokens`)
- Visible to all employees across every department.
- **"Waiting On Me" Alert Banner**:
  - Highlights specific pending actions based on logged-in role (NOC reviews for NOC team, move-in settlements for Accounts, holds for Sales).
- **Metric Counters**: All Tokens, Pending NOC, NOC On Hold, NOC Cleared, Moved In, Rejected.
- **Search & Filtering**: Filter by property / flat, search by client name, phone number, bed label.
- **Mobile-First Responsive Layout**: Table view for desktops, touch-friendly card views for 375px mobile screens.

## Migrations
- `supabase/migrations/00000000000005_phase4_token_workflow.sql`:
  - View `public.v_tokens_workflow` with security invoker.
  - Functions: `create_token_booking_atomic`, `update_noc_status_atomic`, `confirm_accounts_move_in_atomic`.
  - Realistic sample tokens representing all stages:
    1. *Pending NOC*: Karan Verma (Sunrise Villa R1 Bed C, Token ₹5,000)
    2. *NOC On Hold*: Neha Gupta (Sunrise Villa R2 Bed B, Token ₹5,000, ID mismatch hold)
    3. *NOC Cleared*: Amit Saxena (Sunrise Villa R3 Bed A, Token ₹6,000, ready for Accounts)
    4. *Rejected & Bed Freed*: Suresh Raina (Lake View R1 Bed B, Token ₹4,000, bed returned to vacant)

## How to Test
1. Apply migration `supabase/migrations/00000000000005_phase4_token_workflow.sql` in Supabase SQL Editor.
2. Sign in to `/dashboard/tokens`.
3. View the 4 pre-seeded sample tokens across all stages.
4. Click **"Review NOC"** on the Pending NOC token (Karan Verma) and mark it as "Clear NOC" or "Put on Hold".
5. Click **"Confirm Move-In"** on the NOC Cleared token (Amit Saxena), enter deposit & rent details, and confirm. Verify bed turns `occupied` on `/dashboard/beds`.
6. Click **"Create New Token"**, pick an available vacant bed, fill client info, and create a new reservation.
