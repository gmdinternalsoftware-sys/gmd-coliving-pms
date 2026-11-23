# Phase 7: Reports, Analytics & Excel Export

## 1. Overview
Phase 7 provides business analytics, live dashboard metrics, and comprehensive Excel `.xlsx` exports powered by `exceljs`. It equips management, accounts, and sales teams with real-time operational visibility and downloadable reports with property filtering.

---

## 2. Main Dashboard Metrics (`/dashboard`)
The primary landing dashboard now features:
- **Occupancy Rate (%)**: Real-time ratio of occupied/notice beds over total beds, with visual progress bars per property.
- **Vacant Beds Inventory**: Current count of ready-to-sell beds.
- **Collections This Month (₹)**: Financial collections ledger (rent, security deposits, tokens, and electricity payments) received in the current calendar month.
- **Total Overdue (₹)**: Sum of all unpaid rent and electricity dues exceeding their payment deadlines, with tenant count.
- **Tokens This Month**: Number of client token advances booked in the current month with total token advance value.
- **Property Breakdown**: Property-level cards showing rooms, beds, occupancy percentage, and occupied monthly revenue.
- **Quick Shortcuts**: One-click actions for Sales, Accounts, Electricity, and Reports.

---

## 3. Reports & Excel Export Center (`/dashboard/reports`)
1. **Property Filter**:
   - Filter all reports and exports by specific flat or consolidated across all properties.
2. **Interactive Preview Tabs**:
   - **Property Occupancy**: Summary cards with occupancy rate %, room count, bed inventory, potential revenue, and active revenue.
   - **All Beds**: Filter by status (`occupied`, `vacant`, `reserved`, `notice`, `blocked`) with live search.
   - **Occupied Residents**: Tenant roster with phone, room/bed, move-in date, rent, deposit, and next rent due date.
   - **Vacant Beds**: Pipeline for sales team with sharing type and base pricing.
   - **Dues & Overdue**: Combined rent and electricity dues ledger showing total due, paid amount, remaining balance, and days overdue.
3. **Excel Workbook Generator (`exceljs`)**:
   - Route: `/api/reports/export?flat_id={id}&type={type}`
   - **Master Excel Download**: Combines all 5 sheets into one workbook with branded headers (`#2563EB`), auto column width calculation, currency formats, and borders:
     1. `Property Occupancy`
     2. `All Beds Inventory`
     3. `Occupied Residents`
     4. `Vacant Inventory`
     5. `Dues & Overdue`
   - **Single-Sheet Quick Exports**:
     - Export All Beds (`.xlsx`)
     - Export Occupied Residents (`.xlsx`)
     - Export Vacant Beds (`.xlsx`)
     - Export Dues & Overdue (`.xlsx`)

---

## 4. Database View (`00000000000009_phase7_reports.sql`)
- Added `public.v_flat_occupancy_report` with `security_invoker = true` to allow active employees to query occupancy aggregation by property.

---

## 5. How to Test
1. Run migration `00000000000009_phase7_reports.sql` in the Supabase SQL Editor.
2. Visit `/dashboard` to view live occupancy rates, collections, and overdue metrics.
3. Navigate to **Reports** in the sidebar (`/dashboard/reports`).
4. Select a property from the dropdown (or "All Properties").
5. Click **Download Master Excel (All Sheets)** or any quick export button.
6. Open the downloaded `.xlsx` file to verify all columns, formulas, and formatting.
