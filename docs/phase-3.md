# Phase 3: Client Profiles & History Documentation

## Overview
Phase 3 establishes full, transparent client profile management for all employees while maintaining strict security and audit compliance for sensitive identification data (Aadhaar).

## Features Built
1. **Searchable Client Directory**:
   - Universal search across client names, primary/secondary phone numbers, flat code, and bed label.
   - Profile quick links directly into individual tenant dossiers.
2. **Client Profile View (`/dashboard/clients/[id]`)**:
   - Live Tenancy status: Active flat, room, bed, monthly rent, security deposit, move-in date, and next rent due date.
   - Contact dossier: Primary phone, optional secondary phone, and emergency contact details.
   - Client photo avatar with upload support to Supabase Storage.
3. **Audited Aadhaar Security**:
   - Aadhaar number is masked by default (`•••• •••• ${last4}`).
   - "Reveal" action:
     - Automatically invokes database procedure `log_aadhaar_reveal(client_id)`.
     - Appends an immutable row to `audit_log` recording timestamp, employee `actor_id`, and client ID.
     - Decrypts AES-256-GCM ciphertext in server action (`lib/actions/client-profile.ts`) and displays in IST browser view.
     - "Hide" button to re-mask.
4. **Secure Photo Storage**:
   - Private bucket `client-documents` with 5MB upload limit and image MIME restrictions.
   - Photos served exclusively via short-lived signed URLs (1-hour expiration).
5. **Payment History Ledger**:
   - Table of all historical transactions (Rent, Deposit, Token, Electricity) sorted by payment date.
   - Displays payment mode (UPI, Cash, Bank Transfer), reference IDs, and formatted currency in ₹ (Indian numeric grouping).

## Database & Migrations
- `supabase/migrations/00000000000004_phase3_client_profiles.sql`:
  - Storage bucket `client-documents` and RLS policies for active employees.
  - Stored function `log_aadhaar_reveal(p_client_id uuid)` with `security definer`.
  - Sample test data for 4 clients with active bookings, beds, and payment ledger entries.

## Testing Instructions
1. Navigate to `/dashboard/clients`.
2. Search for any client (e.g. "Rahul", "Priya", or a flat like "101").
3. Click "View Profile" on any row.
4. Verify tenant information, room/bed, emergency contacts, and payment history.
5. Click "Reveal" on Aadhaar: confirm the full 12-digit number is revealed and check `audit_log` in Supabase to see the entry.
6. Click "Upload New Photo" to upload an avatar picture and verify the preview refreshes with a signed URL.
