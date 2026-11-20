# AGENTS.md: Rules for every agent working on this repo

Project: **GMD Co-living PMS**, an internal web app for GMD Co-living Pvt Ltd (PG business, bed-based inventory).
Read `PLAN.md` before starting any task. Work on ONE phase at a time (see `PROMPTS.md`).

## Stack
- Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui
- Supabase: Postgres, Auth, Storage, RLS
- `exceljs` for Excel export/import, `zod` for validation, `react-hook-form` for forms
- Mobile-first UI (sales team uses phones)

## Hard rules
1. **Schema first.** All DB changes go in `supabase/migrations/` as numbered SQL files. Never edit the DB by hand. Show the migration for review before building UI on it.
2. **RLS on every table.** Read = any active employee. Write = role-based (see matrix in PLAN.md). Never rely on UI hiding alone.
3. **Aadhaar is sensitive.**
   - Store encrypted + `aadhaar_last4` + `aadhaar_hash` (for duplicate check). Never store plain text.
   - Never log Aadhaar in console, errors, or analytics.
4. **One active booking per bed**, enforced by a DB partial unique index (not just app code).
5. **Money** is stored as integer paise or `numeric(12,2)`. Never floats.
6. **Audit log** every create/update/delete on bookings, payments, beds, clients, and every Aadhaar reveal.
7. **Files** (photo, Aadhaar scan) go in private Storage buckets, served by signed URLs only.
8. **Admin-only actions:** create employees, add/edit flats/rooms/beds, add existing tenants, bulk import, manual data corrections.
9. Validate all input with zod on client AND server. Indian phone = 10 digits; Aadhaar = 12 digits.
10. No secrets in the repo. Use `.env.local` and provide `.env.example`.

## Conventions
- Folder layout: `app/(auth)`, `app/(dashboard)/<module>`, `components/`, `lib/supabase/`, `lib/validators/`, `supabase/migrations/`, `supabase/seed.sql`
- Dates stored UTC; displayed in IST (Asia/Kolkata). Currency shown as ₹ with Indian grouping (1,25,000).
- Small commits, one feature per commit. Update `PLAN.md` checkboxes when a phase is done.

## Definition of done (per phase)
- Migrations applied and reviewed
- Works for each role (test as admin, sales, noc, accounts, maintenance, electricity)
- Forbidden actions are blocked by RLS (test it)
- Works on a 375px-wide phone screen
- Seed data lets a human test the full flow
- Short `docs/phase-N.md` note: what was built, how to test
