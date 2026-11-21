-- =============================================================================
-- GMD Co-living PMS: Phase 2 — Existing Tenants Atomic Stored Procedure
-- =============================================================================

-- Atomic function to add an existing tenant in a single ACID transaction
create or replace function public.add_existing_tenant_atomic(
  p_full_name text,
  p_aadhaar_encrypted bytea,
  p_aadhaar_last4 char(4),
  p_aadhaar_hash text,
  p_phone1 text,
  p_phone2 text,
  p_emergency_name text,
  p_emergency_phone text,
  p_photo_path text,
  p_bed_id uuid,
  p_move_in_date date,
  p_agreed_rent numeric(12,2),
  p_deposit_amount numeric(12,2),
  p_next_rent_due date,
  p_opening_dues numeric(12,2) default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_role public.app_role;
  v_client_id uuid;
  v_booking_id uuid;
  v_bed_current_status public.bed_status;
begin
  -- 1. Enforce Admin Only
  v_actor_role := public.get_my_role();
  if v_actor_role is distinct from 'admin'::public.app_role then
    raise exception 'Unauthorized: Only administrators can add existing tenants.';
  end if;

  -- 2. Verify Bed Availability
  select status into v_bed_current_status
  from public.beds
  where id = p_bed_id
  for update;

  if not found then
    raise exception 'Bed not found with ID %', p_bed_id;
  end if;

  if v_bed_current_status in ('occupied', 'reserved') then
    raise exception 'Bed is already % and cannot be assigned to another tenant.', v_bed_current_status;
  end if;

  -- 3. Check for Duplicate Aadhaar Hash (if provided)
  if p_aadhaar_hash is not null and exists (
    select 1 from public.clients where aadhaar_hash = p_aadhaar_hash
  ) then
    raise exception 'A client with this Aadhaar number already exists in the system.';
  end if;

  -- 4. Insert Client Record
  insert into public.clients (
    full_name,
    aadhaar_encrypted,
    aadhaar_last4,
    aadhaar_hash,
    phone1,
    phone2,
    emergency_contact_name,
    emergency_contact_phone,
    photo_path,
    created_by
  ) values (
    trim(p_full_name),
    p_aadhaar_encrypted,
    p_aadhaar_last4,
    p_aadhaar_hash,
    trim(p_phone1),
    nullif(trim(p_phone2), ''),
    nullif(trim(p_emergency_name), ''),
    nullif(trim(p_emergency_phone), ''),
    nullif(trim(p_photo_path), ''),
    auth.uid()
  )
  returning id into v_client_id;

  -- 5. Insert Booking Record (source='existing', status='active')
  insert into public.bookings (
    client_id,
    bed_id,
    source,
    status,
    token_amount,
    agreed_rent,
    deposit_amount,
    move_in_date,
    next_rent_due,
    created_by
  ) values (
    v_client_id,
    p_bed_id,
    'existing'::public.booking_source,
    'active'::public.booking_status,
    0,
    p_agreed_rent,
    coalesce(p_deposit_amount, 0),
    p_move_in_date,
    p_next_rent_due,
    auth.uid()
  )
  returning id into v_booking_id;

  -- 6. Record Deposit Payment if deposit > 0
  if coalesce(p_deposit_amount, 0) > 0 then
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
      'deposit'::public.payment_type,
      p_deposit_amount,
      'other'::public.payment_mode,
      p_move_in_date,
      'Opening Deposit Record',
      auth.uid(),
      'Recorded at tenant onboarding'
    );
  end if;

  -- 7. Record Opening Dues / Opening Balance if specified
  if coalesce(p_opening_dues, 0) > 0 then
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
      'opening_balance'::public.payment_type,
      p_opening_dues,
      'other'::public.payment_mode,
      p_move_in_date,
      'Opening Balance Dues',
      auth.uid(),
      'Initial dues carried forward'
    );
  end if;

  -- 8. Set Bed to Occupied
  update public.beds
  set status = 'occupied'::public.bed_status,
      updated_at = now()
  where id = p_bed_id;

  -- Return created identifiers
  return jsonb_build_object(
    'success', true,
    'client_id', v_client_id,
    'booking_id', v_booking_id
  );
end;
$$;
