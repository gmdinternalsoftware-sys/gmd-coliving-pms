# GMD Co-living PMS — Sales Team One-Page User Guide

**Role:** Sales Executive (`sales`)  
**Scope:** View bed availability, create client token bookings, check live token status, and view client/caretaker directories.

## Step-by-Step Workflow (Mobile-Friendly)

### 1. Check Vacant Beds (`/dashboard/beds`)
- Filter by **Property**, **Vacant**, or **Sharing Type** (`1`, `2`, `3`, `4` sharing).
- Each bed card shows the room number, bed label, and listed monthly rent (`₹`).

### 2. Create a Token Booking (`/dashboard/tokens`)
1. Tap **+ Create Token**.
2. Enter client details: **Full Name**, **Primary Phone (10 digits)**, optional secondary phone, emergency contact, and optional 12-digit Aadhaar.
3. Select **Property**, **Room**, and a **Vacant Bed** (only vacant beds appear).
4. Confirm **Agreed Monthly Rent (`₹`)**, **Token Amount (`₹`)**, **Payment Mode** (`UPI - Serenity`, `UPI - GMD`, `UPI - Platinum S`, `Cash`, `Bank transfer`), **Reference/UTR**, and expected **Move-in Date**.
5. Submit. The bed immediately becomes **Reserved**, preventing double-booking by another sales executive.

### 3. Track Your Pipeline (`/dashboard/tokens`)
- **Waiting on Me** banner highlights your bookings.
- Watch status badges progress:
  - `Pending NOC` &rarr; Waiting on NOC clearance
  - `NOC On Hold` &rarr; Follow up with NOC / client on remarks
  - `NOC Cleared` &rarr; Ready for Accounts to collect deposit & confirm move-in
  - `Rejected` &rarr; Bed automatically returns to `Vacant`

### 4. Other Tools
- **Caretakers** (`/dashboard/caretakers`): Quick-tap phone links when visiting properties with prospects.
- **Reports** (`/dashboard/reports`): Export **Vacant Beds (`.xlsx`)** sheet anytime.
