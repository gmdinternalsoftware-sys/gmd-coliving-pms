# Phase 2: Existing Tenants (Admin Only)

## What was built

### 1. Database & Atomic Transaction
- **Stored Procedure `public.add_existing_tenant_atomic(...)`** (`supabase/migrations/00000000000003_phase2_existing_tenants.sql`):
  - Admin authorization check (`get_my_role() = 'admin'`).
  - Row-level lock on the target bed (`FOR UPDATE`) preventing double-assignment concurrency bugs.
  - Unique Aadhaar duplicate check via `aadhaar_hash`.
  - Creates client record (`public.clients`).
  - Creates active booking record with `source = 'existing'` and `status = 'active'` (`public.bookings`).
  - Creates opening deposit payment entry and opening balance dues payment entry (`public.payments`).
  - Marks target bed as `'occupied'` (`public.beds`).
  - All executed in a single atomic transaction; any constraint violation safely rolls back.

### 2. Aadhaar Encryption & Security (`lib/crypto/aadhaar.ts`)
- **AES-256-GCM** authenticated encryption with unique 12-byte random IV.
- Generates:
  - `aadhaar_encrypted`: Encrypted payload stored in PostgreSQL `bytea` column.
  - `aadhaar_last4`: Stored for fast UI masking (`•••• •••• 1234`).
  - `aadhaar_hash`: Deterministic HMAC-SHA256 for duplicate checks without plaintext exposure.
- Enforces strict AGENTS.md rule: Plaintext Aadhaar is **never logged** and **never stored**.

### 3. Single Tenant Onboarding Form (`/dashboard/tenants/add`)
- Admin-only access guard.
- Cascading dynamic selector: Property/Flat $\to$ Room $\to$ Vacant Bed (occupied and reserved beds are automatically filtered out).
- Pre-fills listed rent from the selected bed's base price.
- Inputs for full name, 12-digit Aadhaar, primary phone, secondary phone, emergency contact details, move-in date, agreed rent, deposit paid, next rent due date, and opening dues.
- Full validation via Zod on client and server (`lib/validators/index.ts`).

### 4. Bulk Excel / CSV Import (`/dashboard/tenants/import`)
- Downloadable Excel template generated dynamically with `exceljs` via `GET /api/templates/tenants-import`.
- In-browser file parser supporting `.xlsx`, `.xls`, and `.csv`.
- Row-by-row pre-validation:
  - Validates flat name against existing active properties.
  - Validates room number inside the specified flat.
  - Validates bed label inside the room and verifies the bed is not already occupied or reserved.
  - Validates phone format (10 digits) and Aadhaar format (12 digits).
  - Checks for duplicate Aadhaar numbers across rows within the sheet.
- Interactive preview table showing row status (`Ready` vs `Error`) with detailed error callouts.
- Single-click commit for valid rows via `bulkImportTenantsAction`.

### 5. Client Directory & Incomplete Profiles Filter (`/dashboard/clients`)
- Search by client name, phone numbers, flat, or bed label.
- **Incomplete Profiles Filter Tab**: One-click filter isolating profiles missing Aadhaar, secondary phone, or photo (`profile_complete = false`).
- Displays masked Aadhaar (`•••• •••• 1234`), assigned bed, and contact numbers.
- **Admin Manual Edit Modal**: Admin can correct client names, phone numbers, and emergency contacts. All corrections trigger automatic auditing into `public.audit_log`.

---

## How to test

### Prerequisites
Run `supabase/migrations/00000000000003_phase2_existing_tenants.sql` in your Supabase SQL editor (already applied).

### 1. Test Single Tenant Onboarding (as Admin)
1. Sign in as `gmdinternalsoftware@gmail.com` at `/login`.
2. Go to **Add Tenant** (`/dashboard/tenants/add`):
   - Select Flat: *Sunrise Villa*.
   - Select Room: *R1 (3-Sharing)*.
   - Select Bed: *Bed A* (shows ₹7,500/mo).
   - Enter Tenant Name: `Rohit Sharma`.
   - Enter Phone 1: `9876501234`.
   - Enter Aadhaar: `123456789012`.
   - Leave Deposit at `15000` and Rent at `7500`.
   - Click **Onboard Tenant & Occupy Bed**.
3. Verify:
   - Green success confirmation appears.
   - Go to **Bed Inventory** (`/dashboard/beds`): Sunrise Villa R1 Bed A is now Purple (**Occupied**) with tenant `Rohit Sharma`.
   - Go to **Clients** (`/dashboard/clients`): `Rohit Sharma` appears with assigned bed and masked Aadhaar `•••• •••• 9012`.

### 2. Test Bulk Excel Import
1. Go to **Bulk Import** (`/dashboard/tenants/import`).
2. Click **Download Excel Template**: Opens `GMD_Tenants_Import_Template.xlsx`.
3. Drag & drop or upload the template file.
4. Verify the preview table parses row #2:
   - Shows Flat, Room, Bed, Tenant Name.
   - Status badge indicates whether the row is valid or flags issues (e.g. if you set a bed that is already occupied).
5. Click **Commit Valid Tenants**: Bed status immediately updates in the database.

### 3. Test Incomplete Profile Filter & Manual Edit
1. Go to **Clients** (`/dashboard/clients`).
2. Click **Incomplete Profiles**: Shows clients who haven't uploaded an Aadhaar or secondary phone.
3. Click **Correct Data** on a client:
   - Update phone number or emergency contact.
   - Click **Save Correction**.
   - Verify the directory immediately reflects the change.

### 4. Non-Admin Security Verification
1. Sign out and sign in with a sales account (or an employee created in Phase 1).
2. Attempt visiting `/dashboard/tenants/add` or `/dashboard/tenants/import`: Access is blocked with "Access Restricted".
3. Check `/dashboard/clients`: Sales can view clients, but the "Correct Data" button and onboarding links are hidden.
