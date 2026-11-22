-- =============================================================================
-- GMD Co-living PMS: Phase 3 — Storage Buckets, Aadhaar Audit & Rich Sample Data
-- =============================================================================

-- 1. STORAGE BUCKET: client-documents (Private)
-- Create bucket if storage schema exists (Supabase standard)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents',
  'client-documents',
  false,
  5242880, -- 5 MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Storage RLS Policies
-- Active employees can read/download via signed URLs
drop policy if exists "Active employees can read client documents" on storage.objects;
create policy "Active employees can read client documents"
  on storage.objects for select
  using (
    bucket_id = 'client-documents'
    and (select public.is_active_profile())
  );

-- Admin and authorized employees can upload client documents
drop policy if exists "Employees can upload client documents" on storage.objects;
create policy "Employees can upload client documents"
  on storage.objects for insert
  with check (
    bucket_id = 'client-documents'
    and (select public.is_active_profile())
  );

-- 2. SECURE AADHAAR REVEAL AUDIT FUNCTION
-- Logs every single full Aadhaar reveal attempt into audit_log
create or replace function public.log_aadhaar_reveal(p_client_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not (select public.is_active_profile()) then
    raise exception 'Unauthorized: Only active employees can access client documents.';
  end if;

  insert into public.audit_log (
    actor_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    auth.uid(),
    'aadhaar_reveal',
    'clients',
    p_client_id,
    jsonb_build_object(
      'revealed_at', now(),
      'actor_role', public.get_my_role()
    )
  );

  return true;
end;
$$;

-- 3. RICH SAMPLE DATA FOR PHASE 3
-- Sample Clients, Bookings, and Payment History for testing
do $$
declare
  v_admin_id uuid;
  v_client1_id uuid := 'c0000000-0000-0000-0000-000000000001';
  v_client2_id uuid := 'c0000000-0000-0000-0000-000000000002';
  v_client3_id uuid := 'c0000000-0000-0000-0000-000000000003';
  v_client4_id uuid := 'c0000000-0000-0000-0000-000000000004';
  v_booking1_id uuid := 'd0000000-0000-0000-0000-000000000001';
  v_booking2_id uuid := 'd0000000-0000-0000-0000-000000000002';
  v_booking3_id uuid := 'd0000000-0000-0000-0000-000000000003';
  v_booking4_id uuid := 'd0000000-0000-0000-0000-000000000004';
  v_bed_r1_a uuid;
  v_bed_r1_b uuid;
  v_bed_r2_a uuid;
  v_bed_lake_a uuid;
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;

  -- Locate beds from seed
  select id into v_bed_r1_a from public.beds where room_id = 'b0000000-0000-0000-0000-000000000001' and bed_label = 'A';
  select id into v_bed_r1_b from public.beds where room_id = 'b0000000-0000-0000-0000-000000000001' and bed_label = 'B';
  select id into v_bed_r2_a from public.beds where room_id = 'b0000000-0000-0000-0000-000000000002' and bed_label = 'A';
  select id into v_bed_lake_a from public.beds where room_id = 'b0000000-0000-0000-0000-000000000004' and bed_label = 'A';

  -- Client 1: Complete profile, occupied bed
  insert into public.clients (
    id, full_name, aadhaar_last4, aadhaar_hash, phone1, phone2,
    emergency_contact_name, emergency_contact_phone, photo_path, created_by
  ) values (
    v_client1_id, 'Rahul Sharma', '4589', 'hash_sample_4589', '9876543210', '9876543211',
    'Ramesh Sharma (Father)', '9876543212', 'sample-avatar-1.png', v_admin_id
  ) on conflict (id) do nothing;

  -- Client 2: Complete profile, occupied bed
  insert into public.clients (
    id, full_name, aadhaar_last4, aadhaar_hash, phone1, phone2,
    emergency_contact_name, emergency_contact_phone, photo_path, created_by
  ) values (
    v_client2_id, 'Priya Patel', '8912', 'hash_sample_8912', '9811122233', '9811122234',
    'Sunita Patel (Mother)', '9811122235', 'sample-avatar-2.png', v_admin_id
  ) on conflict (id) do nothing;

  -- Client 3: Incomplete profile (missing phone2 and photo)
  insert into public.clients (
    id, full_name, aadhaar_last4, aadhaar_hash, phone1, phone2,
    emergency_contact_name, emergency_contact_phone, photo_path, created_by
  ) values (
    v_client3_id, 'Vikram Malhotra', '1234', 'hash_sample_1234', '9899887766', null,
    'Suresh Malhotra (Brother)', '9899887765', null, v_admin_id
  ) on conflict (id) do nothing;

  -- Client 4: Incomplete profile (missing Aadhaar)
  insert into public.clients (
    id, full_name, aadhaar_last4, aadhaar_hash, phone1, phone2,
    emergency_contact_name, emergency_contact_phone, photo_path, created_by
  ) values (
    v_client4_id, 'Ananya Sen', null, null, '9844332211', '9844332212',
    'Debabrata Sen (Father)', '9844332213', null, v_admin_id
  ) on conflict (id) do nothing;

  -- Bookings for clients
  if v_bed_r1_a is not null then
    insert into public.bookings (
      id, client_id, bed_id, source, status, agreed_rent, deposit_amount,
      move_in_date, next_rent_due, created_by
    ) values (
      v_booking1_id, v_client1_id, v_bed_r1_a, 'existing', 'active', 7500.00, 15000.00,
      '2026-10-01', '2026-12-01', v_admin_id
    ) on conflict (id) do nothing;

    update public.beds set status = 'occupied' where id = v_bed_r1_a;
  end if;

  if v_bed_r1_b is not null then
    insert into public.bookings (
      id, client_id, bed_id, source, status, agreed_rent, deposit_amount,
      move_in_date, next_rent_due, created_by
    ) values (
      v_booking2_id, v_client2_id, v_bed_r1_b, 'existing', 'active', 7500.00, 15000.00,
      '2026-10-15', '2026-12-15', v_admin_id
    ) on conflict (id) do nothing;

    update public.beds set status = 'occupied' where id = v_bed_r1_b;
  end if;

  if v_bed_r2_a is not null then
    insert into public.bookings (
      id, client_id, bed_id, source, status, agreed_rent, deposit_amount,
      move_in_date, next_rent_due, created_by
    ) values (
      v_booking3_id, v_client3_id, v_bed_r2_a, 'existing', 'active', 9000.00, 18000.00,
      '2026-11-01', '2026-12-01', v_admin_id
    ) on conflict (id) do nothing;

    update public.beds set status = 'occupied' where id = v_bed_r2_a;
  end if;

  -- Payment history for Rahul Sharma (Client 1)
  insert into public.payments (booking_id, type, amount, mode, for_month, paid_on, reference, notes)
  values
    (v_booking1_id, 'deposit', 15000.00, 'upi', null, '2026-10-01', 'UPI/261001/99441', 'Security deposit 2 months'),
    (v_booking1_id, 'rent', 7500.00, 'upi', '2026-10-01', '2026-10-01', 'UPI/261001/99442', 'Rent for October 2026'),
    (v_booking1_id, 'rent', 7500.00, 'bank_transfer', '2026-11-01', '2026-11-02', 'NEFT/HDFC/88319', 'Rent for November 2026')
  on conflict do nothing;

  -- Payment history for Priya Patel (Client 2)
  insert into public.payments (booking_id, type, amount, mode, for_month, paid_on, reference, notes)
  values
    (v_booking2_id, 'deposit', 15000.00, 'bank_transfer', null, '2026-10-15', 'IMPS/SBIN/55412', 'Security deposit'),
    (v_booking2_id, 'rent', 7500.00, 'upi', '2026-10-01', '2026-10-15', 'UPI/261015/11223', 'Rent October (prorated)')
  on conflict do nothing;

  -- Payment history for Vikram Malhotra (Client 3)
  insert into public.payments (booking_id, type, amount, mode, for_month, paid_on, reference, notes)
  values
    (v_booking3_id, 'deposit', 18000.00, 'cash', null, '2026-11-01', 'CASH-REC-104', 'Cash receipt signed by Accounts'),
    (v_booking3_id, 'rent', 9000.00, 'upi', '2026-11-01', '2026-11-01', 'UPI/261101/77889', 'Rent for November 2026')
  on conflict do nothing;

end $$;
