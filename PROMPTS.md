# PROMPTS.md: one prompt per agent task

Always start with: "Read AGENTS.md and PLAN.md first. Work only on the phase below. Show me migrations before building UI."

## Phase 0: Foundation
Set up Next.js + TypeScript + Tailwind + shadcn/ui and connect Supabase. Create migrations from the schema in PLAN.md (review and improve it: indexes, constraints, enums). Add RLS policies per the permission matrix, a `current_role()` helper, and an audit trigger. Implement email/password login, a `profiles` table linked to auth, role-based route guards, and a dashboard shell with a mobile-friendly sidebar. Add `.env.example` and `supabase/seed.sql` with one user per role.

## Phase 1: Admin and inventory
Build Admin pages to create/deactivate employees (name, email, department/role, temp password) and to add/edit flats, rooms (sharing type), and beds (label, price). Build a Bed Inventory page: filter by flat, status, sharing type; show colored status badges and the current tenant name on occupied beds. Admin-only for write actions; everyone can view.

## Phase 2: Existing tenants (Admin only)
Build "Add Existing Tenant": client name, Aadhaar (encrypted), phone 1/2, optional photo, flat then bed (only non-occupied beds), actual move-in date, monthly rent, deposit already paid, next rent due date, opening dues. Create client + booking (`source='existing'`, status active) + opening payment, set bed to occupied, all in one transaction. Add Excel/CSV bulk import: downloadable template, upload, row-by-row validation (unknown flat/bed, bed already occupied, duplicate Aadhaar, bad phone), preview errors, and commit only valid rows after confirmation. Add an "Incomplete profile" filter. Add an Admin manual-edit screen for corrections, logged in audit_log.

## Phase 3: Client profiles
Build a searchable client list (name, phone, flat, bed; visible to all employees). Profile page: current flat/bed, rent, deposit, payment history, phone 1/2, photo (signed URL), Aadhaar masked with a "Reveal" button for all that logs to audit_log. Photo upload to a private bucket with size/type limits.

## Phase 4: Token workflow
Sales "Create Token": client details, flat then vacant bed only, price, token amount. Use a transaction so the unique index prevents double-booking and show a friendly error if someone else just took the bed. Create a pending noc_record. NOC queue: set cleared/hold/rejected with remarks (rejected frees the bed). Accounts queue: record deposit and first rent, then confirm move-in (bed occupied). A Tokens page visible to everyone with status badges and filters, plus a "waiting on me" count per role.

## Phase 5: Payments and dues
Monthly rent generation per active booking, payment entry (mode, reference, for_month), pending/overdue list with days overdue, PDF receipt, and a move-out flow (notice date, move-out date, deposit refund entry, bed returns to vacant).

## Phase 6: Electricity
Meter readings per flat, bill calculation (units x rate), split across occupied beds (per PLAN.md decision), per-tenant electricity dues, and payment tracking.

## Phase 7: Reports and Excel export
Dashboard: occupancy %, vacant beds, tokens this month, collections, overdue total. Excel download (exceljs) with sheets: All Beds (with status), Occupied (client, rent, move-in), Vacant, Dues. Filters by flat before export.

## Phase 8: Hardening
Write RLS tests for each role (forbidden writes must fail). Review audit log coverage, set up Supabase backups, test on a 375px phone, add error pages and loading states, deploy to Vercel, and write a one-page user guide per department.
