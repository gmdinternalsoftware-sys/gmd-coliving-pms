# GMD Co-living PMS — Accounts Department One-Page User Guide

**Role:** Accounts Executive (`accounts`)  
**Scope:** Confirm move-ins (deposit + first rent), generate monthly rent dues, record rent/electricity payments, print receipts, and process move-out settlements.

## Daily Workflow

### 1. Confirm Move-In for NOC-Cleared Tokens (`/dashboard/tokens`)
1. Filter by **NOC Cleared** (highlighted in your **Action Needed** banner).
2. Click **Confirm Move-In**.
3. Record **Security Deposit (`₹`)** and **First Rent (`₹`)** with payment mode (`UPI - Serenity`, `UPI - GMD`, `UPI - Platinum S`, `Cash`, `Bank transfer`) and UTR/reference.
4. Set **Actual Move-in Date** and **Next Rent Due Date**. Submitting activates the booking and marks the bed **Occupied**.

### 2. Monthly Rent Generation & Collection (`/dashboard/payments`)
- Click **Generate Monthly Rent** to create monthly `rent_dues` demands for active tenants.
- Filter **Rent Dues & Overdues** by `Overdue Only` (shows exact days overdue) or `Pending Only`.
- Click **Collect Rent** to record partial or full payment against a demand.
- Switch to **Payment Ledger & Receipts** and click **View Receipt** to print or share an official `RCP-XXXXXXXX` receipt.

### 3. Notice & Move-Out Settlement (`/dashboard/payments` &rarr; *Notice & Move-Out*)
- Click **Mark Notice** when a tenant gives notice (updates bed to `On Notice`).
- On move-out day, click **Process Move-Out**, record deductions (damages/unpaid dues) and **Deposit Refund (`₹`)** with payment mode/reference. The booking closes and the bed returns to **Vacant**.

### 4. Electricity Payments (`/dashboard/electricity`)
- Collect pending tenant electricity bills via **Pay** and print itemized split statements (`RCP-EL-XXXXXXXX`).
