# GMD Co-living PMS — Admin One-Page User Guide

**Role:** System Administrator (`admin`)  
**Scope:** Full access across all modules, user management, property inventory, existing tenant onboarding, manual corrections, audit logs, and backups.

## Daily & Setup Responsibilities

### 1. Team & Role Management (`/dashboard/employees`)
- Click **Add Employee**, enter full name, email, role (`sales`, `noc`, `accounts`, `maintenance`, `electricity`, `admin`), and temporary password.
- Deactivate departing staff immediately using the **Deactivate** toggle — RLS immediately blocks inactive profiles.

### 2. Properties, Rooms & Beds (`/dashboard/beds`)
- Click **+ Flat** to add a new property. You can also add **Rooms** (1 to 10 sharing) and **Beds** (labels `A`, `B`, rents, status) directly inside the Add Flat dialog.
- Use **+ Room**, **+ Bed**, or **Edit Bed** on any card to adjust base rent or mark beds `blocked` during repairs.
- Manage building caretakers (name, property, phone numbers) in **Caretakers** (`/dashboard/caretakers`).

### 3. Existing Tenants & Bulk Import (`/dashboard/tenants/add` & `/import`)
- Use **Add Tenant** to onboard legacy tenants directly to `occupied` (bypasses token/NOC pipeline).
- Use **Bulk Import**: download the Excel template, fill tenant rows, upload to preview validation errors, and commit valid rows.
- Filter **Clients** (`/dashboard/clients`) by **Incomplete Profiles** to spot missing Aadhaar/photo/secondary phone, and use **Correct Data** for logged manual edits.

### 4. Security, Audit Log & Backups (`/dashboard/settings`)
- Review **Audit Log** for all financial edits, bed updates, and Aadhaar reveals.
- Download **Master Excel Snapshot (`.xlsx`)** under **Backups & Recovery** for offline records.
- Verify Supabase daily automated backups remain active in the Supabase Dashboard.
