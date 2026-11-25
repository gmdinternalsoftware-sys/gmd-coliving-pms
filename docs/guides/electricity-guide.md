# GMD Co-living PMS — Electricity Team One-Page User Guide

**Role:** Electricity Personnel (`electricity`)  
**Scope:** Enter flat common meter and room sub-meter readings, generate monthly split electricity bills, and review billing runs.

## Billing Formula Used by the PMS
Every room has an independent sub-meter, and the flat has a common meter:
- **Tenant Room Share:** `(Current Room Reading - Previous Room Reading) × Rate ÷ Active Occupants in that Room`
- **Tenant Common Share:** `(Current Common Reading - Previous Common Reading) × Rate ÷ Total Active Occupants in Flat`
- **Total Tenant Bill:** `Room Share + Common Share`

## Step-by-Step Workflow (`/dashboard/electricity`)

### 1. Generate Flat Electricity Bill
1. Tap **Generate Electricity Bill**.
2. Select the **Property / Flat**. Previous readings for the **Common Meter** and every **Room Sub-Meter** auto-populate from the last recorded billing run.
3. Enter **Billing Period Start/End** and **Rate per Unit (`₹/kWh`)**.
4. Enter **Current Reading** for the Flat Common Meter and each Room Sub-Meter.
5. Verify the **Live Calculation Preview** box at the bottom showing exact units consumed and estimated per-tenant amounts.
6. Click **Generate & Post Dues**. All tenant dues are created atomically and logged to the audit trail.

### 2. Review Bills & Payment Status
- **Tenant Dues & Splits** tab: Filter by property or status (`Pending`, `Partial`, `Paid`) and click **Receipt / Breakdown** to inspect or print any tenant's calculation statement.
- **Flat Billing Runs** tab: Review historical flat totals, common units, and total room units billed.
- *(Note: Recording actual money collected against electricity dues is restricted to Accounts and Admin.)*
