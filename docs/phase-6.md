# Phase 6: Electricity Management & Independent Sub-meter Splitting

## 1. Overview & Business Rule
In GMD Co-living properties, electricity is billed using an independent room sub-meter plus flat common meter model:
- **Independent Room Sub-meter**: Each room has its own sub-meter. The units consumed by a room are divided equally strictly among the active occupants/tenants staying in that specific room.
  $$\text{Tenant Room Share (₹)} = \frac{(\text{Current Room Reading} - \text{Previous Room Reading}) \times \text{Rate}}{\text{Number of Active Tenants in that Room}}$$
- **Flat Common Meter**: The flat's main common meter covers shared areas (hall, kitchen, common appliances). The common units are divided equally across all active occupants staying in the entire flat.
  $$\text{Tenant Common Share (₹)} = \frac{(\text{Current Common Reading} - \text{Previous Common Reading}) \times \text{Rate}}{\text{Total Active Tenants in the Flat}}$$
- **Total Tenant Bill**:
  $$\text{Total Due (₹)} = \text{Tenant Room Share} + \text{Tenant Common Share}$$

---

## 2. Database Schema & Migration (`00000000000008_phase6_electricity.sql`)
1. **`electricity_readings` table updates**:
   - `room_id`: foreign key to `rooms(id)`
   - `meter_type`: `'room'` or `'common'`
   - `previous_meter_value` and `units_consumed`
2. **`electricity_bills` master table updates**:
   - `common_units`, `common_amount`
   - `rooms_total_units`, `rooms_total_amount`
   - `total_occupied_beds`, `status`
3. **`tenant_electricity_dues` table**:
   - Links `bill_id`, `booking_id`, `client_id`, `room_id`
   - Records breakdown: `room_units`, `room_share_count`, `room_amount`, `common_units`, `common_share_count`, `common_amount`, `total_due`, `paid_amount`, and `status ('pending' | 'partial' | 'paid' | 'waived')`
   - Automatic audit trigger logging changes into `audit_log`
4. **Row Level Security (RLS)**:
   - Any active employee can view dues and billing history.
   - Insert and update restricted to `admin`, `accounts`, and `electricity` roles.
5. **Stored Procedures**:
   - `generate_flat_electricity_bill_atomic(...)`: calculates room and common shares atomically and generates per-tenant dues.
   - `record_electricity_payment_atomic(...)`: settles tenant dues and writes an `'electricity'` entry to the `payments` ledger.
6. **Helper View**: `v_electricity_dues_overview`.

---

## 3. UI Features (`/dashboard/electricity`)
1. **Summary Metrics**:
   - Pending Electricity amount and unpaid tenant count
   - Total Collected amount
   - Total Units Billed (kWh)
   - Billing Runs completed
2. **Interactive Tabs**:
   - **Tenant Dues & Splits**: Search by tenant, filter by property/flat and payment status. Shows itemized breakdown of room share vs common share, balance due, and quick actions.
   - **Flat Billing Runs**: Overview of monthly billing runs per property with unit totals and tenant counts.
   - **Payment Receipts**: Full history of collected electricity payments with printable receipts.
3. **Generate Electricity Bill Modal**:
   - Property selector automatically pre-populates previous meter readings for common meter and all rooms using `getFlatMeterSetupAction`.
   - Real-time live calculation preview showing exact room and common splits before submitting.
4. **Payment Modal**:
   - Allowed for Admin and Accounts roles.
   - Supports modes: `"UPI - Serenity"`, `"UPI - GMD"`, `"UPI - Platinum S"`, `"Cash"`, `"Bank transfer"`.
5. **Printable Statements & Receipts**:
   - Itemized bill statement modal with breakdown formula.
   - Official payment receipt modal (`RCP-EL-XXXXX`) formatted for instant printing.

---

## 4. How to Test
1. Run migration `00000000000008_phase6_electricity.sql` in the Supabase SQL Editor.
2. Sign in as Admin (`admin@gmdcoliving.com`) or Accounts (`accounts@gmdcoliving.com`).
3. Navigate to **Electricity** in the sidebar.
4. Verify the pre-seeded Sunrise Villa bills (Rahul Sharma, Priya Patel, and Vikram Malhotra).
5. Click **Generate Electricity Bill**, pick a flat, enter current meter values, check the live preview, and submit.
6. Click **Pay** on any pending tenant due, enter the amount, select payment mode, and submit.
7. Click **Receipt / Breakdown** to view and print the itemized statement.
