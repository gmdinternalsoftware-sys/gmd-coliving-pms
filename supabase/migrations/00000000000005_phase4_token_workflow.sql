-- =============================================================================
-- GMD Co-living PMS: Phase 4 — Token Workflow, NOC Queue & Accounts Move-In
-- =============================================================================

-- 1. Helper View for Tokens Workflow with all joined details
create or replace view public.v_tokens_workflow
with (security_invoker = true)
as
select 
  bk.id as booking_id,
  bk.source,
  bk.status as booking_status,
  bk.token_amount,
  bk.agreed_rent,
  bk.deposit_amount,
  bk.move_in_date,
  bk.next_rent_due,
  bk.created_at as token_created_at,
  bk.updated_at as booking_updated_at,
  -- Client info
  c.id as client_id,
  c.full_name as client_name,
  c.phone1 as client_phone1,
  c.phone2 as client_phone2,
  c.aadhaar_last4,
  c.photo_path,
  -- Bed info
  b.id as bed_id,
  b.bed_label,
  b.base_price as bed_base_price,
  b.status as bed_status,
  -- Room info
  r.id as room_id,
  r.room_no,
  r.sharing_type,
  -- Flat info
  f.id as flat_id,
  f.name as flat_name,
  -- NOC info
  nr.id as noc_id,
  nr.status as noc_status,
  nr.remarks as noc_remarks,
  nr.updated_at as noc_updated_at,
  p_noc.full_name as noc_done_by_name,
  -- Sales creator
  p_sales.full_name as created_by_name
from public.bookings bk
join public.clients c on bk.client_id = c.id
join public.beds b on bk.bed_id = b.id
join public.rooms r on b.room_id = r.id
join public.flats f on r.flat_id = f.id
left join public.noc_records nr on nr.booking_id = bk.id
left join public.profiles p_noc on nr.done_by = p_noc.id
left join public.profiles p_sales on bk.created_by = p_sales.id
where bk.source = 'token' or bk.status in ('token', 'noc_hold', 'noc_cleared', 'rejected');

-- 2. Stored Procedure: Create Token Booking Atomically
create or replace function public.create_token_booking_atomic(
  p_full_name text,
  p_phone1 text,
  p_phone2 text default null,
  p_emergency_name text default null,
  p_emergency_phone text default null,
  p_aadhaar_encrypted bytea default null,
  p_aadhaar_last4 char(4) default null,
  p_aadhaar_hash text default null,
  p_bed_id uuid default null,
  p_agreed_rent numeric default 0,
  p_token_amount numeric default 0,
  p_move_in_date date default null,
  p_payment_mode public.payment_mode default 'upi',
  p_payment_reference text default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_role public.app_role;
  v_bed_status public.bed_status;
  v_client_id uuid;
  v_booking_id uuid;
  v_existing_booking_id uuid;
begin
  -- 1. Authorization Check (Admin or Sales)
  v_caller_role := public.get_my_role();
  if v_caller_role not in ('admin', 'sales') then
    raise exception 'Unauthorized: Only Admin or Sales can create tokens.';
  end if;

  -- 2. Validate & Lock Bed
  if p_bed_id is null then
    raise exception 'A valid bed must be selected.';
  end if;

  select status into v_bed_status
  from public.beds
  where id = p_bed_id
  for update;

  if not found then
    raise exception 'Selected bed not found.';
  end if;

  if v_bed_status != 'vacant' then
    raise exception 'Bed is no longer vacant (current status: %). It was just reserved or occupied by someone else.', v_bed_status;
  end if;

  -- Check live booking conflict
  select id into v_existing_booking_id
  from public.bookings
  where bed_id = p_bed_id
    and status in ('token', 'noc_hold', 'noc_cleared', 'active')
  limit 1;

  if v_existing_booking_id is not null then
    raise exception 'Bed already has an active or reserved booking.';
  end if;

  -- 3. Find or Create Client
  if p_aadhaar_hash is not null then
    select id into v_client_id from public.clients where aadhaar_hash = p_aadhaar_hash limit 1;
  end if;

  if v_client_id is null and p_phone1 is not null then
    select id into v_client_id from public.clients where phone1 = p_phone1 limit 1;
  end if;

  if v_client_id is not null then
    -- Update optional contacts if missing
    update public.clients
    set 
      phone2 = coalesce(phone2, p_phone2),
      emergency_contact_name = coalesce(emergency_contact_name, p_emergency_name),
      emergency_contact_phone = coalesce(emergency_contact_phone, p_emergency_phone),
      aadhaar_encrypted = coalesce(aadhaar_encrypted, p_aadhaar_encrypted),
      aadhaar_last4 = coalesce(aadhaar_last4, p_aadhaar_last4),
      aadhaar_hash = coalesce(aadhaar_hash, p_aadhaar_hash),
      updated_at = now()
    where id = v_client_id;
  else
    insert into public.clients (
      full_name, phone1, phone2,
      emergency_contact_name, emergency_contact_phone,
      aadhaar_encrypted, aadhaar_last4, aadhaar_hash,
      created_by
    ) values (
      p_full_name, p_phone1, p_phone2,
      p_emergency_name, p_emergency_phone,
      p_aadhaar_encrypted, p_aadhaar_last4, p_aadhaar_hash,
      auth.uid()
    ) returning id into v_client_id;
  end if;

  -- 4. Create Booking in 'token' status
  insert into public.bookings (
    client_id,
    bed_id,
    source,
    status,
    token_amount,
    agreed_rent,
    move_in_date,
    created_by
  ) values (
    v_client_id,
    p_bed_id,
    'token',
    'token',
    p_token_amount,
    p_agreed_rent,
    p_move_in_date,
    auth.uid()
  ) returning id into v_booking_id;

  -- 5. Mark Bed as 'reserved'
  update public.beds
  set status = 'reserved', updated_at = now()
  where id = p_bed_id;

  -- 6. Create Initial Pending NOC Record
  insert into public.noc_records (
    booking_id,
    status,
    remarks,
    created_at,
    updated_at
  ) values (
    v_booking_id,
    'pending',
    coalesce(p_notes, 'Token created by sales. Pending NOC verification.'),
    now(),
    now()
  );

  -- 7. Record Token Payment if amount > 0
  if p_token_amount > 0 then
    insert into public.payments (
      booking_id,
      type,
      amount,
      mode,
      paid_on,
      reference,
      received_by,
      notes
    ) values (
      v_booking_id,
      'token',
      p_token_amount,
      p_payment_mode,
      current_date,
      p_payment_reference,
      auth.uid(),
      'Initial token advance'
    );
  end if;

  -- 8. Audit Log
  insert into public.audit_log (
    actor_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    auth.uid(),
    'create_token',
    'bookings',
    v_booking_id,
    jsonb_build_object(
      'client_id', v_client_id,
      'bed_id', p_bed_id,
      'token_amount', p_token_amount,
      'agreed_rent', p_agreed_rent,
      'move_in_date', p_move_in_date
    )
  );

  return json_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'client_id', v_client_id
  );
end;
$$;

-- 3. Stored Procedure: Update NOC Status Atomically
create or replace function public.update_noc_status_atomic(
  p_booking_id uuid,
  p_status public.noc_status,
  p_remarks text default null
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_role public.app_role;
  v_booking_status public.booking_status;
  v_bed_id uuid;
  v_target_booking_status public.booking_status;
begin
  -- 1. Role verification (Admin or NOC)
  v_caller_role := public.get_my_role();
  if v_caller_role not in ('admin', 'noc') then
    raise exception 'Unauthorized: Only Admin or NOC can update NOC status.';
  end if;

  -- 2. Lock & inspect booking
  select status, bed_id into v_booking_status, v_bed_id
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if v_booking_status in ('active', 'cancelled', 'moved_out') then
    raise exception 'Cannot change NOC status for a booking with status %.', v_booking_status;
  end if;

  -- 3. Map NOC status to Booking status
  if p_status = 'cleared' then
    v_target_booking_status := 'noc_cleared';
  elsif p_status = 'hold' then
    v_target_booking_status := 'noc_hold';
  elsif p_status = 'rejected' then
    v_target_booking_status := 'rejected';
  else
    v_target_booking_status := 'token';
  end if;

  -- 4. Update or Insert NOC Record
  update public.noc_records
  set 
    status = p_status,
    remarks = p_remarks,
    done_by = auth.uid(),
    updated_at = now()
  where booking_id = p_booking_id;

  if not found then
    insert into public.noc_records (booking_id, status, remarks, done_by, updated_at)
    values (p_booking_id, p_status, p_remarks, auth.uid(), now());
  end if;

  -- 5. Update Booking status
  update public.bookings
  set status = v_target_booking_status, updated_at = now()
  where id = p_booking_id;

  -- 6. If Rejected: Free the bed back to vacant!
  if p_status = 'rejected' then
    update public.beds
    set status = 'vacant', updated_at = now()
    where id = v_bed_id;
  end if;

  -- 7. Audit Log
  insert into public.audit_log (
    actor_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    auth.uid(),
    'update_noc_status',
    'noc_records',
    p_booking_id,
    jsonb_build_object(
      'noc_status', p_status,
      'booking_status', v_target_booking_status,
      'remarks', p_remarks,
      'bed_freed', (p_status = 'rejected')
    )
  );

  return json_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'booking_status', v_target_booking_status,
    'noc_status', p_status
  );
end;
$$;

-- 4. Stored Procedure: Confirm Move-in & Record Deposit/Rent (Accounts)
create or replace function public.confirm_accounts_move_in_atomic(
  p_booking_id uuid,
  p_actual_move_in_date date,
  p_deposit_amount numeric,
  p_deposit_mode public.payment_mode default 'upi',
  p_deposit_reference text default null,
  p_rent_amount numeric default 0,
  p_rent_mode public.payment_mode default 'upi',
  p_rent_reference text default null,
  p_next_rent_due date default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_role public.app_role;
  v_booking record;
  v_bed_id uuid;
  v_calculated_due date;
begin
  -- 1. Role Check (Admin or Accounts)
  v_caller_role := public.get_my_role();
  if v_caller_role not in ('admin', 'accounts') then
    raise exception 'Unauthorized: Only Admin or Accounts can confirm move-in.';
  end if;

  -- 2. Lock & inspect booking
  select id, bed_id, status, client_id, agreed_rent, token_amount
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status not in ('noc_cleared', 'token') then
    raise exception 'Booking status must be NOC Cleared before confirming move-in (current status: %).', v_booking.status;
  end if;

  v_bed_id := v_booking.bed_id;

  -- Next rent due defaults to 1 month after move-in if not provided
  v_calculated_due := coalesce(p_next_rent_due, (p_actual_move_in_date + interval '1 month')::date);

  -- 3. Update Booking to 'active'
  update public.bookings
  set 
    status = 'active',
    move_in_date = p_actual_move_in_date,
    deposit_amount = p_deposit_amount,
    next_rent_due = v_calculated_due,
    updated_at = now()
  where id = p_booking_id;

  -- 4. Mark Bed as 'occupied'
  update public.beds
  set status = 'occupied', updated_at = now()
  where id = v_bed_id;

  -- 5. Insert Deposit Payment
  if p_deposit_amount > 0 then
    insert into public.payments (
      booking_id,
      type,
      amount,
      mode,
      paid_on,
      reference,
      received_by,
      notes
    ) values (
      p_booking_id,
      'deposit',
      p_deposit_amount,
      p_deposit_mode,
      p_actual_move_in_date,
      p_deposit_reference,
      auth.uid(),
      coalesce(p_notes, 'Security deposit collected on move-in')
    );
  end if;

  -- 6. Insert First Rent Payment if received
  if p_rent_amount > 0 then
    insert into public.payments (
      booking_id,
      type,
      amount,
      mode,
      for_month,
      paid_on,
      reference,
      received_by,
      notes
    ) values (
      p_booking_id,
      'rent',
      p_rent_amount,
      p_rent_mode,
      date_trunc('month', p_actual_move_in_date)::date,
      p_actual_move_in_date,
      p_rent_reference,
      auth.uid(),
      'First month rent collected on move-in'
    );
  end if;

  -- 7. Audit Log
  insert into public.audit_log (
    actor_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    auth.uid(),
    'confirm_move_in',
    'bookings',
    p_booking_id,
    jsonb_build_object(
      'actual_move_in_date', p_actual_move_in_date,
      'deposit_collected', p_deposit_amount,
      'rent_collected', p_rent_amount,
      'bed_id', v_bed_id
    )
  );

  return json_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'bed_id', v_bed_id,
    'status', 'active'
  );
end;
$$;

-- =============================================================================
-- 5. RICH SAMPLE DATA FOR PHASE 4
-- =============================================================================
do $$
declare
  v_admin_id uuid;
  v_bed_r1_c uuid;
  v_bed_r2_b uuid;
  v_bed_r3_a uuid;
  v_bed_lake_b uuid;
  
  v_token1_client uuid := 'c1000000-0000-0000-0000-000000000001';
  v_token2_client uuid := 'c1000000-0000-0000-0000-000000000002';
  v_token3_client uuid := 'c1000000-0000-0000-0000-000000000003';
  v_token4_client uuid := 'c1000000-0000-0000-0000-000000000004';

  v_b1_id uuid := 'b1000000-0000-0000-0000-000000000001';
  v_b2_id uuid := 'b1000000-0000-0000-0000-000000000002';
  v_b3_id uuid := 'b1000000-0000-0000-0000-000000000003';
  v_b4_id uuid := 'b1000000-0000-0000-0000-000000000004';
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;

  -- Beds
  select id into v_bed_r1_c from public.beds where room_id = 'b0000000-0000-0000-0000-000000000001' and bed_label = 'C';
  select id into v_bed_r2_b from public.beds where room_id = 'b0000000-0000-0000-0000-000000000002' and bed_label = 'B';
  select id into v_bed_r3_a from public.beds where room_id = 'b0000000-0000-0000-0000-000000000003' and bed_label = 'A';
  select id into v_bed_lake_b from public.beds where room_id = 'b0000000-0000-0000-0000-000000000004' and bed_label = 'B';

  -- 1. Client 1: Karan Verma (Pending NOC Review)
  insert into public.clients (
    id, full_name, aadhaar_last4, aadhaar_hash, phone1, phone2,
    emergency_contact_name, emergency_contact_phone, created_by
  ) values (
    v_token1_client, 'Karan Verma', '7788', 'hash_sample_7788', '9812345678', '9812345679',
    'Rajesh Verma (Father)', '9812345670', v_admin_id
  ) on conflict (id) do nothing;

  if v_bed_r1_c is not null then
    insert into public.bookings (
      id, client_id, bed_id, source, status, token_amount, agreed_rent,
      move_in_date, created_by
    ) values (
      v_b1_id, v_token1_client, v_bed_r1_c, 'token', 'token', 5000.00, 7500.00,
      '2026-12-01', v_admin_id
    ) on conflict (id) do nothing;

    update public.beds set status = 'reserved' where id = v_bed_r1_c;

    insert into public.noc_records (booking_id, status, remarks, created_at, updated_at)
    values (v_b1_id, 'pending', 'Sales advance token recorded. Pending NOC document review.', now(), now())
    on conflict (id) do nothing;

    insert into public.payments (booking_id, type, amount, mode, paid_on, reference, received_by, notes)
    values (v_b1_id, 'token', 5000.00, 'upi', current_date, 'UPI/KV/99281', v_admin_id, 'Token advance')
    on conflict (id) do nothing;
  end if;

  -- 2. Client 2: Neha Gupta (NOC Hold)
  insert into public.clients (
    id, full_name, aadhaar_last4, aadhaar_hash, phone1, phone2,
    emergency_contact_name, emergency_contact_phone, created_by
  ) values (
    v_token2_client, 'Neha Gupta', '4411', 'hash_sample_4411', '9822334455', '9822334456',
    'Sushma Gupta (Mother)', '9822334457', v_admin_id
  ) on conflict (id) do nothing;

  if v_bed_r2_b is not null then
    insert into public.bookings (
      id, client_id, bed_id, source, status, token_amount, agreed_rent,
      move_in_date, created_by
    ) values (
      v_b2_id, v_token2_client, v_bed_r2_b, 'token', 'noc_hold', 5000.00, 9000.00,
      '2026-12-05', v_admin_id
    ) on conflict (id) do nothing;

    update public.beds set status = 'reserved' where id = v_bed_r2_b;

    insert into public.noc_records (booking_id, status, remarks, done_by, created_at, updated_at)
    values (v_b2_id, 'hold', 'Aadhaar address does not match company ID card. Clarification requested from tenant.', v_admin_id, now(), now())
    on conflict (id) do nothing;

    insert into public.payments (booking_id, type, amount, mode, paid_on, reference, received_by, notes)
    values (v_b2_id, 'token', 5000.00, 'bank_transfer', current_date - 2, 'NEFT-550921', v_admin_id, 'Token advance')
    on conflict (id) do nothing;
  end if;

  -- 3. Client 3: Amit Saxena (NOC Cleared -> Waiting for Accounts move-in)
  insert into public.clients (
    id, full_name, aadhaar_last4, aadhaar_hash, phone1, phone2,
    emergency_contact_name, emergency_contact_phone, created_by
  ) values (
    v_token3_client, 'Amit Saxena', '9933', 'hash_sample_9933', '9833445566', null,
    'Deepak Saxena (Brother)', '9833445567', v_admin_id
  ) on conflict (id) do nothing;

  if v_bed_r3_a is not null then
    insert into public.bookings (
      id, client_id, bed_id, source, status, token_amount, agreed_rent,
      move_in_date, created_by
    ) values (
      v_b3_id, v_token3_client, v_bed_r3_a, 'token', 'noc_cleared', 6000.00, 12000.00,
      '2026-11-25', v_admin_id
    ) on conflict (id) do nothing;

    update public.beds set status = 'reserved' where id = v_bed_r3_a;

    insert into public.noc_records (booking_id, status, remarks, done_by, created_at, updated_at)
    values (v_b3_id, 'cleared', 'ID proof, company offer letter and police verification cleared. Ready for move-in.', v_admin_id, now(), now())
    on conflict (id) do nothing;

    insert into public.payments (booking_id, type, amount, mode, paid_on, reference, received_by, notes)
    values (v_b3_id, 'token', 6000.00, 'upi', current_date - 4, 'UPI/AS/88214', v_admin_id, 'Token advance')
    on conflict (id) do nothing;
  end if;

  -- 4. Client 4: Suresh Raina (Rejected -> Bed freed to Vacant)
  insert into public.clients (
    id, full_name, aadhaar_last4, aadhaar_hash, phone1, phone2,
    emergency_contact_name, emergency_contact_phone, created_by
  ) values (
    v_token4_client, 'Suresh Raina', '1155', 'hash_sample_1155', '9855667788', null,
    'Ajay Raina (Father)', '9855667789', v_admin_id
  ) on conflict (id) do nothing;

  if v_bed_lake_b is not null then
    insert into public.bookings (
      id, client_id, bed_id, source, status, token_amount, agreed_rent,
      move_in_date, created_by
    ) values (
      v_b4_id, v_token4_client, v_bed_lake_b, 'token', 'rejected', 4000.00, 6500.00,
      '2026-11-20', v_admin_id
    ) on conflict (id) do nothing;

    -- Bed was released back to vacant
    update public.beds set status = 'vacant' where id = v_bed_lake_b;

    insert into public.noc_records (booking_id, status, remarks, done_by, created_at, updated_at)
    values (v_b4_id, 'rejected', 'Failed background check. Tenant requested cancellation and refund.', v_admin_id, now(), now())
    on conflict (id) do nothing;

    insert into public.payments (booking_id, type, amount, mode, paid_on, reference, received_by, notes)
    values (v_b4_id, 'token', 4000.00, 'cash', current_date - 7, 'CASH-RECEIPT-01', v_admin_id, 'Token payment')
    on conflict (id) do nothing;
  end if;

end $$;
