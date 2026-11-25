# GMD Co-living PMS — NOC Department One-Page User Guide

**Role:** NOC Officer (`noc`)  
**Scope:** Verify prospect bookings, inspect client profiles/documents, and update NOC status (`cleared`, `hold`, or `rejected`).

## Step-by-Step Workflow

### 1. Open Your Queue (`/dashboard/tokens`)
- The **Action Needed** banner at the top shows how many bookings are waiting on NOC review.
- Filter by **Pending NOC** or **NOC On Hold** to see bookings requiring verification.

### 2. Verify Client Details (`/dashboard/clients/[id]`)
- Tap any client's name to inspect their full profile: phone numbers, emergency contact, uploaded photo, and Aadhaar verification.
- Clicking **Reveal** on Aadhaar logs your name, role, and timestamp to the permanent audit log.

### 3. Update NOC Decision (`/dashboard/tokens`)
1. Click **Update NOC** on a pending or on-hold token.
2. Choose one of three statuses:
   - **Cleared (`noc_cleared`)**: Passes the booking to Accounts for deposit/first-rent collection and move-in.
   - **Hold (`noc_hold`)**: Pauses move-in while awaiting missing documents or verification. Bed remains `Reserved`.
   - **Rejected (`rejected`)**: Cancels the token pipeline and **automatically frees the bed back to `Vacant`**.
3. Enter clear **Remarks** (required when placing on Hold or Rejecting) so Sales and Accounts know the exact reason.

### Rules & Guardrails
- NOC cannot create bookings, record financial payments, or modify bed pricing.
- Every NOC status change is permanently recorded with your user ID and timestamp.
