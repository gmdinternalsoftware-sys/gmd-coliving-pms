-- =============================================================================
-- GMD Co-living PMS: Phase 5 — Payments, Dues, Rent Generation & Move-Out Flow
-- =============================================================================

-- 1. Alterations to existing tables
alter table public.bookings 
  add column if not exists notice_date date;

-- 2. Rent Dues / Demands Table
create table if not exists public.rent_dues (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings on delete cascade,
  for_month date not null,                                   -- 1st day of the billing month (e.g. 2026-11-01)
  due_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid', 'overdue', 'waived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, for_month)
);

-- Link payments to rent_dues if applicable
alter table public.payments 
  add column if not exists rent_due_id uuid references public.rent_dues on delete set null;

-- Audit trigger on rent_dues
create trigger trg_audit_rent_dues after insert or update or delete on public.rent_dues
  for each row execute function public.audit_trigger_func();

-- 3. Row Level Security for rent_dues
alter table public.rent_dues enable row level security;

create policy "Active profiles can read rent_dues"
  on public.rent_dues for select
  using (public.is_active_profile());

create policy "Admin and accounts can insert rent_dues"
  on public.rent_dues for insert
  with check (public.get_my_role() in ('admin', 'accounts'));

create policy "Admin and accounts can update rent_dues"
  on public.rent_dues for update
  using (public.get_my_role() in ('admin', 'accounts'));

-- 4. Helper View: v_dues_overview with Overdue Calculations
create or replace view public.v_dues_overview
with (security_invoker = true)
as
select 
  rd.id as due_id,
  rd.booking_id,
  rd.for_month,
  rd.due_date,
  rd.amount as due_amount,
  rd.paid_amount,
  (rd.amount - rd.paid_amount) as balance_due,
  case 
    when rd.status = 'paid' then 'paid'
    when rd.status = 'waived' then 'waived'
    when current_date > rd.due_date then 'overdue'
    when rd.paid_amount > 0 then 'partial'
    else 'pending'
  end as calculated_status,
  case 
    when current_date > rd.due_date and rd.status != 'paid' and rd.status != 'waived'
    then (current_date - rd.due_date)
    else 0
  end as days_overdue,
  rd.created_at as demand_generated_at,
  -- Client info
  c.id as client_id,
  c.full_name as client_name,
  c.phone1 as client_phone1,
  -- Bed info
  b.id as bed_id,
  b.bed_label,
  b.status as bed_status,
  -- Room & Flat info
  r.id as room_id,
  r.room_no,
  f.id as flat_id,
  f.name as flat_name,
  -- Booking info
  bk.status as booking_status,
  bk.agreed_rent,
  bk.deposit_amount,
  bk.move_in_date,
  bk.next_rent_due,
  bk.notice_date
from public.rent_dues rd
join public.bookings bk on rd.booking_id = bk.id
join public.clients c on bk.client_id = c.id
join public.beds b on bk.bed_id = b.id
join public.rooms r on b.room_id = r.id
join public.flats f on r.flat_id = f.id;

-- 5. Stored Procedure: Monthly Rent Generation for Active Bookings
create or replace function public.generate_monthly_rents_atomic(p_for_month date)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_role public.app_role;
  v_first_day date;
  v_booking record;
  v_due_date date;
  v_generated_count integer := 0;
begin
  v_caller_role := public.get_my_role();
  if v_caller_role not in ('admin', 'accounts') then
    raise exception 'Unauthorized: Only Admin or Accounts can generate monthly rents.';
  end if;

  v_first_day := date_trunc('month', p_for_month)::date;

  for v_booking in
    select id, agreed_rent, move_in_date, next_rent_due
    from public.bookings
    where status = 'active'
  loop
    -- Determine due date: use the day of move_in_date or 1st of month
    if v_booking.move_in_date is not null then
      v_due_date := (v_first_day + (extract(day from v_booking.move_in_date)::integer - 1) * interval '1 day')::date;
    else
      v_due_date := (v_first_day + interval '4 days')::date; -- default 5th
    end if;

    insert into public.rent_dues (
      booking_id,
      for_month,
      due_date,
      amount,
      paid_amount,
      status
    ) values (
      v_booking.id,
      v_first_day,
      v_due_date,
      v_booking.agreed_rent,
      0,
      case when current_date > v_due_date then 'overdue' else 'pending' end
    )
    on conflict (booking_id, for_month) do nothing;

    if found then
      v_generated_count := v_generated_count + 1;
    end if;
  end loop;

  -- Audit log
  insert into public.audit_log (
    actor_id,
    action,
    table_name,
    new_data
  ) values (
    auth.uid(),
    'generate_monthly_rent',
    'rent_dues',
    jsonb_build_object(
      'for_month', v_first_day,
      'demands_generated', v_generated_count
    )
  );

  return json_build_object(
    'success', true,
    'for_month', v_first_day,
    'demands_generated', v_generated_count
  );
end;
$$;

-- 6. Stored Procedure: Record Payment Atomically
create or replace function public.record_payment_atomic(
  p_booking_id uuid,
  p_rent_due_id uuid default null,
  p_type public.payment_type default 'rent',
  p_amount numeric default 0,
  p_mode public.payment_mode default 'upi',
  p_paid_on date default current_date,
  p_for_month date default null,
  p_reference text default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_role public.app_role;
  v_payment_id uuid;
  v_due record;
  v_new_paid numeric;
  v_new_status text;
  v_next_due date;
begin
  v_caller_role := public.get_my_role();
  if v_caller_role not in ('admin', 'accounts') then
    raise exception 'Unauthorized: Only Admin or Accounts can record payments.';
  end if;

  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than 0.';
  end if;

  -- 1. Insert Payment
  insert into public.payments (
    booking_id,
    rent_due_id,
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
    p_rent_due_id,
    p_type,
    p_amount,
    p_mode,
    p_for_month,
    p_paid_on,
    p_reference,
    auth.uid(),
    p_notes
  ) returning id into v_payment_id;

  -- 2. Settle Rent Due if provided
  if p_rent_due_id is not null then
    select id, amount, paid_amount into v_due
    from public.rent_dues
    where id = p_rent_due_id
    for update;

    if found then
      v_new_paid := v_due.paid_amount + p_amount;
      if v_new_paid >= v_due.amount then
        v_new_status := 'paid';
      else
        v_new_status := 'partial';
      end if;

      update public.rent_dues
      set 
        paid_amount = v_new_paid,
        status = v_new_status,
        updated_at = now()
      where id = p_rent_due_id;

      -- Advance next_rent_due on booking if paid in full
      if v_new_status = 'paid' then
        select next_rent_due into v_next_due from public.bookings where id = p_booking_id;
        if v_next_due is not null then
          update public.bookings
          set next_rent_due = (v_next_due + interval '1 month')::date, updated_at = now()
          where id = p_booking_id;
        end if;
      end if;
    end if;
  end if;

  -- 3. Audit Log
  insert into public.audit_log (
    actor_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    auth.uid(),
    'record_payment',
    'payments',
    v_payment_id,
    jsonb_build_object(
      'booking_id', p_booking_id,
      'rent_due_id', p_rent_due_id,
      'amount', p_amount,
      'type', p_type,
      'mode', p_mode,
      'reference', p_reference
    )
  );

  return json_build_object(
    'success', true,
    'payment_id', v_payment_id
  );
end;
$$;

-- 7. Stored Procedure: Put Tenant on Notice
create or replace function public.set_tenant_notice_atomic(
  p_booking_id uuid,
  p_notice_date date,
  p_expected_move_out_date date,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_role public.app_role;
  v_bed_id uuid;
begin
  v_caller_role := public.get_my_role();
  if v_caller_role not in ('admin', 'accounts') then
    raise exception 'Unauthorized: Only Admin or Accounts can mark notice.';
  end if;

  select bed_id into v_bed_id
  from public.bookings
  where id = p_booking_id and status = 'active'
  for update;

  if not found then
    raise exception 'Active booking not found.';
  end if;

  -- Update booking
  update public.bookings
  set 
    notice_date = p_notice_date,
    move_out_date = p_expected_move_out_date,
    updated_at = now()
  where id = p_booking_id;

  -- Update bed status to 'notice'
  update public.beds
  set status = 'notice', updated_at = now()
  where id = v_bed_id;

  -- Audit log
  insert into public.audit_log (
    actor_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    auth.uid(),
    'tenant_notice',
    'bookings',
    p_booking_id,
    jsonb_build_object(
      'notice_date', p_notice_date,
      'expected_move_out_date', p_expected_move_out_date,
      'notes', p_notes
    )
  );

  return json_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'bed_id', v_bed_id
  );
end;
$$;

-- 8. Stored Procedure: Settle Move-Out & Free Bed Atomically
create or replace function public.process_move_out_atomic(
  p_booking_id uuid,
  p_actual_move_out_date date,
  p_deductions_amount numeric default 0,
  p_deductions_reason text default null,
  p_refund_amount numeric default 0,
  p_refund_mode public.payment_mode default 'upi',
  p_refund_reference text default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_role public.app_role;
  v_bed_id uuid;
  v_booking record;
begin
  v_caller_role := public.get_my_role();
  if v_caller_role not in ('admin', 'accounts') then
    raise exception 'Unauthorized: Only Admin or Accounts can finalize move-out.';
  end if;

  select id, bed_id, status, deposit_amount into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status not in ('active', 'token', 'noc_cleared') then
    raise exception 'Cannot move out booking with status %.', v_booking.status;
  end if;

  v_bed_id := v_booking.bed_id;

  -- Record deposit refund in payments if refund > 0
  if p_refund_amount > 0 then
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
      'refund',
      p_refund_amount,
      p_refund_mode,
      p_actual_move_out_date,
      p_refund_reference,
      auth.uid(),
      coalesce(p_notes, 'Security deposit settlement refund')
    );
  end if;

  -- Update booking to moved_out
  update public.bookings
  set 
    status = 'moved_out',
    move_out_date = p_actual_move_out_date,
    updated_at = now()
  where id = p_booking_id;

  -- Free the bed back to vacant
  update public.beds
  set status = 'vacant', updated_at = now()
  where id = v_bed_id;

  -- Audit log
  insert into public.audit_log (
    actor_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    auth.uid(),
    'process_move_out',
    'bookings',
    p_booking_id,
    jsonb_build_object(
      'actual_move_out_date', p_actual_move_out_date,
      'deductions', p_deductions_amount,
      'deductions_reason', p_deductions_reason,
      'refund_paid', p_refund_amount,
      'bed_freed', v_bed_id
    )
  );

  return json_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'bed_id', v_bed_id,
    'status', 'moved_out'
  );
end;
$$;

-- =============================================================================
-- 9. RICH SAMPLE DATA FOR PHASE 5
-- =============================================================================
do $$
declare
  v_admin_id uuid;
  v_booking1_id uuid := 'd0000000-0000-0000-0000-000000000001'; -- Rahul Sharma
  v_booking2_id uuid := 'd0000000-0000-0000-0000-000000000002'; -- Priya Patel
  v_booking3_id uuid := 'd0000000-0000-0000-0000-000000000003'; -- Vikram Malhotra
  v_due1_id uuid := 'e0000000-0000-0000-0000-000000000001';
  v_due2_id uuid := 'e0000000-0000-0000-0000-000000000002';
  v_due3_id uuid := 'e0000000-0000-0000-0000-000000000003';
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;

  -- Demand 1: Rahul Sharma (Paid)
  insert into public.rent_dues (id, booking_id, for_month, due_date, amount, paid_amount, status)
  values (v_due1_id, v_booking1_id, '2026-11-01', '2026-11-05', 7500.00, 7500.00, 'paid')
  on conflict (id) do nothing;

  -- Demand 2: Priya Patel (Overdue by ~15 days)
  insert into public.rent_dues (id, booking_id, for_month, due_date, amount, paid_amount, status)
  values (v_due2_id, v_booking2_id, '2026-11-01', '2026-11-07', 7500.00, 0.00, 'overdue')
  on conflict (id) do nothing;

  -- Demand 3: Vikram Malhotra (Pending, due in a few days)
  insert into public.rent_dues (id, booking_id, for_month, due_date, amount, paid_amount, status)
  values (v_due3_id, v_booking3_id, '2026-11-01', current_date + 4, 9000.00, 0.00, 'pending')
  on conflict (id) do nothing;

  -- Put Rahul Sharma's bed on notice as an example notice scenario
  update public.bookings
  set notice_date = current_date - 10, move_out_date = current_date + 20
  where id = v_booking1_id;

  update public.beds
  set status = 'notice'
  where id = (select bed_id from public.bookings where id = v_booking1_id);

end $$;
