# Phase 8: Hardening, Security Audit, Backups & Deployment

## 1. Security & Audit Coverage Review
### Migration `00000000000011_phase8_hardening.sql`
- **Fixed `audit_trigger_func()`**: Safely extracts UUID `id` via `to_jsonb(new)->>'id'` so tables without a UUID `id` primary key (such as `app_settings` which uses `key text primary key`) log cleanly to `audit_log` without failing.
- **Completed Audit Trigger Coverage**: Added `trg_audit_electricity_readings` and `trg_audit_electricity_bills` so every table holding business/financial/inventory data logs `INSERT`/`UPDATE`/`DELETE` actions.
- **Delete Policies for Safe Rollback**: Added Admin-only `DELETE` policies on `flats` and `rooms` (protected by `ON DELETE RESTRICT` foreign keys when children exist).
- **Audit Overview View**: Added `public.v_audit_log_overview` with `security_invoker = true`.

### Aadhaar & Secrets Hygiene
- Plaintext Aadhaar is never stored and never logged (`scripts/security-audit.mjs` scans `app/` and `lib/`).
- Decryption occurs server-side only inside `revealAadhaarAction` and logs `aadhaar_reveal` into `audit_log`.
- Secrets stay in `.env.local` (ignored by `.gitignore`); `.env.example` documents required keys.

---

## 2. Error Boundaries & Loading States
- **Loading States**:
  - `app/(dashboard)/loading.tsx`: Instant route-transition shimmer skeleton.
  - `components/page-loader.tsx`: Top navigation progress bar and floating spinner.
- **Error Pages**:
  - `app/not-found.tsx`: 404 screen with navigation back to Dashboard / Login.
  - `app/error.tsx` & `app/global-error.tsx`: Root error boundaries with retry action.
  - `app/(dashboard)/error.tsx`: Dashboard-scoped error boundary preserving layout context.

---

## 3. Admin Security Console (`/dashboard/settings`)
Restricted strictly to `admin`:
- **Audit Log Viewer**: Search/filter by action, table, or actor; inspect `old_data` vs `new_data` JSON diffs.
- **Backups & Recovery**: Instant Master Excel snapshot download + Supabase backup & `AADHAAR_ENCRYPTION_KEY` custody checklist.
- **RLS Role Matrix**: Read-only reference of enforced database permissions across all 6 roles.

---

## 4. Verification & Role Tests
### RLS Role Test Suite (`supabase/tests/rls_role_tests.sql`)
Run inside Supabase SQL Editor. Executes inside `BEGIN; ... ROLLBACK;` impersonating `sales`, `noc`, `accounts`, `electricity`, `maintenance`, and `admin` via `set local role authenticated` and `request.jwt.claim.sub`, verifying:
- Allowed operations succeed per role.
- Forbidden writes (`sales` writing `flats`/`payments`, `noc` writing `clients`/`payments`, `accounts` writing `beds`, `electricity` writing `payments`, `maintenance` writing `electricity_readings`) fail with `insufficient_privilege` (`42501`).

### Static Security Audit (`scripts/security-audit.mjs`)
Run locally with `node scripts/security-audit.mjs`:
- Confirms every `CREATE TABLE` across `supabase/migrations/*.sql` has `ENABLE ROW LEVEL SECURITY`.
- Confirms all error, loading, and env template files exist.
- Confirms zero console logging of Aadhaar across `app/` and `lib/`.

---

## 5. Supabase Backups & Vercel Deployment Guide
1. **Supabase Backups**:
   - In Supabase Dashboard &rarr; **Database &rarr; Backups**, ensure automated daily backups (or PITR on Pro) are enabled.
   - Store `AADHAAR_ENCRYPTION_KEY` securely in a team password manager.
   - Weekly operational backup: Admin downloads **Master Excel Snapshot** from `/dashboard/settings` or `/dashboard/reports`.
2. **Vercel Deployment**:
   - Connect GitHub repository `gmdinternalsoftware-sys/gmd-coliving-pms` (branch `master`).
   - Configure Environment Variables in Vercel:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `AADHAAR_ENCRYPTION_KEY`
   - Ensure Supabase **Authentication &rarr; URL Configuration** includes your Vercel production URL under Site URL and Redirect URLs (`https://<your-domain>/auth/callback`).

---

## 6. Department User Guides
- [Admin Guide](./guides/admin-guide.md)
- [Sales Guide](./guides/sales-guide.md)
- [NOC Guide](./guides/noc-guide.md)
- [Accounts Guide](./guides/accounts-guide.md)
- [Maintenance Guide](./guides/maintenance-guide.md)
- [Electricity Guide](./guides/electricity-guide.md)
