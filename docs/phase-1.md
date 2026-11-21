# Phase 1: Admin and Inventory

## What was built

### 1. Database Schema & Triggers (`supabase/migrations/`)
- **`00000000000002_phase1_auth_and_inventory.sql`**:
  - `handle_new_user()` trigger: Automatically syncs users created via Supabase Auth Admin API into `public.profiles` with specified role and name.
  - `v_bed_inventory` view: Enforces RLS via `security_invoker = true` while joining `beds`, `rooms`, `flats`, active `bookings`, and `clients` for instant inventory queries.

### 2. Employee Management (`/dashboard/employees`)
- **Admin-only access**: Server-side role guard restricts page access to `admin` role; non-admins receive a clear "Access Restricted" alert.
- **Directory view**:
  - Desktop table and mobile responsive card view (tested at 375px).
  - Shows full name, email, role badge (`ADMIN`, `SALES`, `NOC`, `ACCOUNTS`, `MAINTENANCE`, `ELECTRICITY`), active status, and join date in IST.
- **Actions**:
  - "Add Employee" modal with Zod validation on client and server (`lib/validators/index.ts`).
  - Calls `createEmployeeAction` using Supabase admin client to create auth user and profile.
  - Deactivate / Reactivate account toggle with protection preventing an admin from deactivating their own account.

### 3. Bed & Property Inventory (`/dashboard/beds`)
- **Universal Visibility**: All authenticated employees across all roles can view live inventory.
- **Admin Write Controls**: Only `admin` role sees and can trigger "+ Flat", "+ Room", "+ Bed", and "Edit Bed" modal actions (also strictly enforced by server actions and DB RLS).
- **Interactive Filters & Search**:
  - Status filter chips with real-time counts (`All`, `Vacant`, `Reserved`, `Occupied`, `Notice`, `Blocked`).
  - Dropdown filters for Property/Flat and Sharing Capacity (1 to 10 sharing).
  - Search input matching flat name, room number, bed label, or tenant name.
- **Bed Information Cards**:
  - Color-coded status badges: Vacant (Green), Reserved (Blue), Occupied (Purple), Notice (Amber), Blocked (Red).
  - Flat name, Room number, Bed label.
  - Sharing capacity and listed monthly rent in ₹ (formatted with Indian numbering via `formatINR`).
  - Current occupant / tenant name (with phone number) on occupied beds and token holders on reserved beds.

## How to test

### Prerequisites
Apply migration `00000000000002_phase1_auth_and_inventory.sql` to your Supabase SQL editor:
```sql
-- Located at supabase/migrations/00000000000002_phase1_auth_and_inventory.sql
```

### Testing as Admin
1. Sign in with an admin account (`admin@gmd.co.in`).
2. Navigate to **Employees** (`/dashboard/employees`):
   - Click **Add Employee**: Create a new sales user (e.g. `test_sales@gmd.co.in`, temp password `password123`).
   - Verify the new user appears in the directory.
   - Click **Deactivate Account** on an employee and verify their status updates to Inactive.
3. Navigate to **Bed Inventory** (`/dashboard/beds`):
   - Click **+ Flat**: Add a new property (e.g. "Green Valley PG", address, owner).
   - Click **+ Room**: Add a room to the newly created flat.
   - Click **+ Bed**: Add a bed to the room with listed monthly rent.
   - Click **Edit Bed**: Change rent or toggle status to "Blocked", verify the card badge updates.

### Testing as Non-Admin (Sales, NOC, Accounts, etc.)
1. Sign in with a sales account (`sales@gmd.co.in`).
2. Navigate to `/dashboard/employees`:
   - Verify access is blocked with "Access Restricted" message.
3. Navigate to `/dashboard/beds`:
   - Verify you can view all beds, filter by status (Vacant/Occupied), filter by flat, and search.
   - Verify "+ Flat", "+ Room", "+ Bed", and "Edit Bed" buttons are hidden.
   - Verify attempting any direct server action mutation without admin credentials fails with `Forbidden: Only active admins can perform this action.`

### Mobile Viewport Testing (375px)
- Open DevTools, switch to iPhone SE / 375px viewport.
- Check `/dashboard/beds`: Bed cards stack vertically, filter bar wraps neatly, dialogs fit comfortably within the screen with no horizontal scroll.
- Check `/dashboard/employees`: Employee cards format with clean status tags and full-width action buttons.
