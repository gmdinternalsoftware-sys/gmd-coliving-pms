-- =============================================================================
-- GMD Co-living PMS: Phase 6 — Electricity Billing, Sub-meters & Splitting
-- =============================================================================

-- 1. Alter Electricity Readings for Room Sub-meters and Common Meters
alter table public.electricity_readings
  add column if not exists room_id uuid references public.rooms(id) on delete cascade,
  add column if not exists meter_type text not null default 'room' check (meter_type in ('room', 'common')),
  add column if not exists previous_meter_value numeric(12,2) default 0,
  add column if not exists units_consumed numeric(12,2) default 0;

-- 2. Alter Electricity Bills table for master billing runs
alter table public.electricity_bills
  add column if not exists common_units numeric(12,2) default 0,
  add column if not exists common_amount numeric(12,2) default 0,
  add column if not exists rooms_total_units numeric(12,2) default 0,
  add column if not exists rooms_total_amount numeric(12,2) default 0,
  add column if not exists total_occupied_beds integer not null default 1,
  add column if not exists status text not null default 'generated' check (status in ('draft', 'generated', 'finalized')),
  add column if not exists created_by uuid references public.profiles(id);

-- 3. Tenant Electricity Dues Table (Per-Client Bill Items)
create table if not exists public.tenant_electricity_dues (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.electricity_bills(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  -- Room sub-meter split
  room_units numeric(12,2) not null default 0,
  room_share_count integer not null default 1,     -- number of occupants sharing this room
  room_amount numeric(12,2) not null default 0,
  -- Common meter split
  common_units numeric(12,2) not null default 0,
  common_share_count integer not null default 1,   -- total occupants sharing flat common meter
  common_amount numeric(12,2) not null default 0,
  -- Total tenant bill
  total_due numeric(12,2) not null check (total_due >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid', 'waived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bill_id, booking_id)
);

-- Trigger for audit logging on tenant electricity dues
drop trigger if exists trg_audit_tenant_electricity_dues on public.tenant_electricity_dues;
create trigger trg_audit_tenant_electricity_dues after insert or update or delete on public.tenant_electricity_dues
  for each row execute function public.audit_trigger_func();

-- 4. Row Level Security for Tenant Electricity Dues
alter table public.tenant_electricity_dues enable row level security;

drop policy if exists "Active profiles can read tenant_electricity_dues" on public.tenant_electricity_dues;
create policy "Active profiles can read tenant_electricity_dues"
  on public.tenant_electricity_dues for select
  using (public.is_active_profile());

drop policy if exists "Admin, accounts, electricity can insert tenant_electricity_dues" on public.tenant_electricity_dues;
create policy "Admin, accounts, electricity can insert tenant_electricity_dues"
  on public.tenant_electricity_dues for insert
  with check (public.get_my_role() in ('admin', 'accounts', 'electricity'));

drop policy if exists "Admin, accounts, electricity can update tenant_electricity_dues" on public.tenant_electricity_dues;
create policy "Admin, accounts, electricity can update tenant_electricity_dues"
  on public.tenant_electricity_dues for update
  using (public.get_my_role() in ('admin', 'accounts', 'electricity'));

-- 5. Helper View: v_electricity_dues_overview
create or replace view public.v_electricity_dues_overview
with (security_invoker = true)
as
select 
  ted.id as due_id,
  ted.bill_id,
  ted.booking_id,
  ted.client_id,
  ted.room_id,
  ted.room_units,
  ted.room_share_count,
  ted.room_amount,
  ted.common_units,
  ted.common_share_count,
  ted.common_amount,
  ted.total_due,
  ted.paid_amount,
  (ted.total_due - ted.paid_amount) as balance_due,
  ted.status,
  ted.created_at,
  -- Client info
  c.full_name as client_name,
  c.phone1 as client_phone,
  -- Room & Flat info
  r.room_no,
  f.id as flat_id,
  f.name as flat_name,
  -- Bill master info
  eb.period_start,
  eb.period_end,
  eb.rate as rate_per_unit,
  eb.total_amount as bill_total_amount
from public.tenant_electricity_dues ted
join public.electricity_bills eb on ted.bill_id = eb.id
join public.clients c on ted.client_id = c.id
join public.rooms r on ted.room_id = r.id
join public.flats f on eb.flat_id = f.id;

-- 6. Stored Procedure: Calculate & Generate Electricity Bill with Sub-meter & Common Split
create or replace function public.generate_flat_electricity_bill_atomic(
  p_flat_id uuid,
  p_period_start date,
  p_period_end date,
  p_rate_per_unit numeric,
  p_common_prev numeric,
  p_common_curr numeric,
  p_room_readings jsonb -- array of { room_id: uuid, prev: numeric, curr: numeric }
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_role public.app_role;
  v_bill_id uuid;
  v_common_units numeric(12,2);
  v_common_amount numeric(12,2);
  v_rooms_units_total numeric(12,2) := 0;
  v_rooms_amount_total numeric(12,2) := 0;
  v_total_flat_clients integer := 0;
  v_item record;
  v_room_id uuid;
  v_room_prev numeric;
  v_room_curr numeric;
  v_room_units numeric(12,2);
  v_room_amount numeric(12,2);
  v_room_clients_count integer;
  v_room_per_client numeric(12,2);
  v_common_per_client numeric(12,2);
  v_client_total numeric(12,2);
  v_tenant record;
  v_generated_dues_count integer := 0;
begin
  -- 1. Authorization check
  v_caller_role := public.get_my_role();
  if v_caller_role not in ('admin', 'accounts', 'electricity') then
    raise exception 'Unauthorized: Only Admin, Accounts or Electricity personnel can calculate bills.';
  end if;

  if p_rate_per_unit <= 0 then
    raise exception 'Rate per unit must be greater than 0.';
  end if;

  -- 2. Compute Common Meter Consumption
  v_common_units := greatest(0, p_common_curr - p_common_prev);
  v_common_amount := round(v_common_units * p_rate_per_unit, 2);

  -- Record common reading
  insert into public.electricity_readings (
    flat_id, reading_date, meter_type, previous_meter_value, meter_value, units_consumed, entered_by
  ) values (
    p_flat_id, p_period_end, 'common', p_common_prev, p_common_curr, v_common_units, auth.uid()
  );

  -- 3. Count total active clients in this flat
  select count(distinct bk.id) into v_total_flat_clients
  from public.bookings bk
  join public.beds b on bk.bed_id = b.id
  join public.rooms r on b.room_id = r.id
  where r.flat_id = p_flat_id and bk.status = 'active';

  if v_total_flat_clients <= 0 then
    v_total_flat_clients := 1; -- avoid division by zero if empty flat
  end if;

  v_common_per_client := round(v_common_amount / v_total_flat_clients, 2);

  -- 4. Calculate Room Sub-meter Totals
  for v_item in select * from jsonb_to_recordset(p_room_readings) as x(room_id uuid, prev numeric, curr numeric)
  loop
    v_room_units := greatest(0, v_item.curr - v_item.prev);
    v_rooms_units_total := v_rooms_units_total + v_room_units;
    v_rooms_amount_total := v_rooms_amount_total + round(v_room_units * p_rate_per_unit, 2);

    -- Record room sub-meter reading
    insert into public.electricity_readings (
      flat_id, room_id, reading_date, meter_type, previous_meter_value, meter_value, units_consumed, entered_by
    ) values (
      p_flat_id, v_item.room_id, p_period_end, 'room', v_item.prev, v_item.curr, v_room_units, auth.uid()
    );
  end loop;

  -- 5. Create Master Electricity Bill Record
  insert into public.electricity_bills (
    flat_id,
    period_start,
    period_end,
    rate,
    units,
    total_amount,
    common_units,
    common_amount,
    rooms_total_units,
    rooms_total_amount,
    total_occupied_beds,
    status,
    created_by
  ) values (
    p_flat_id,
    p_period_start,
    p_period_end,
    p_rate_per_unit,
    (v_common_units + v_rooms_units_total),
    (v_common_amount + v_rooms_amount_total),
    v_common_units,
    v_common_amount,
    v_rooms_units_total,
    v_rooms_amount_total,
    v_total_flat_clients,
    'generated',
    auth.uid()
  ) returning id into v_bill_id;

  -- 6. Split Room & Common bills per active tenant
  for v_item in select * from jsonb_to_recordset(p_room_readings) as x(room_id uuid, prev numeric, curr numeric)
  loop
    v_room_units := greatest(0, v_item.curr - v_item.prev);
    v_room_amount := round(v_room_units * p_rate_per_unit, 2);

    -- Count active occupants in this specific room
    select count(bk.id) into v_room_clients_count
    from public.bookings bk
    join public.beds b on bk.bed_id = b.id
    where b.room_id = v_item.room_id and bk.status = 'active';

    if v_room_clients_count <= 0 then
      v_room_clients_count := 1;
    end if;

    v_room_per_client := round(v_room_amount / v_room_clients_count, 2);

    -- Generate bill split for each active tenant in this room
    for v_tenant in
      select bk.id as booking_id, bk.client_id
      from public.bookings bk
      join public.beds b on bk.bed_id = b.id
      where b.room_id = v_item.room_id and bk.status = 'active'
    loop
      v_client_total := v_room_per_client + v_common_per_client;

      insert into public.tenant_electricity_dues (
        bill_id,
        booking_id,
        client_id,
        room_id,
        room_units,
        room_share_count,
        room_amount,
        common_units,
        common_share_count,
        common_amount,
        total_due,
        paid_amount,
        status
      ) values (
        v_bill_id,
        v_tenant.booking_id,
        v_tenant.client_id,
        v_item.room_id,
        v_room_units,
        v_room_clients_count,
        v_room_per_client,
        v_common_units,
        v_total_flat_clients,
        v_common_per_client,
        v_client_total,
        0,
        'pending'
      );

      v_generated_dues_count := v_generated_dues_count + 1;
    end loop;
  end loop;

  -- 7. Audit Log
  insert into public.audit_log (
    actor_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    auth.uid(),
    'generate_electricity_bill',
    'electricity_bills',
    v_bill_id,
    jsonb_build_object(
      'flat_id', p_flat_id,
      'common_units', v_common_units,
      'rooms_units', v_rooms_units_total,
      'total_amount', (v_common_amount + v_rooms_amount_total),
      'tenants_billed', v_generated_dues_count
    )
  );

  return json_build_object(
    'success', true,
    'bill_id', v_bill_id,
    'total_amount', (v_common_amount + v_rooms_amount_total),
    'tenants_billed', v_generated_dues_count
  );
end;
$$;

-- 7. Stored Procedure: Record Electricity Payment Atomically
create or replace function public.record_electricity_payment_atomic(
  p_due_id uuid,
  p_amount numeric,
  p_mode public.payment_mode default 'upi_gmd',
  p_paid_on date default current_date,
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
  v_due record;
  v_new_paid numeric;
  v_new_status text;
  v_payment_id uuid;
begin
  v_caller_role := public.get_my_role();
  if v_caller_role not in ('admin', 'accounts') then
    raise exception 'Unauthorized: Only Admin or Accounts can record electricity payments.';
  end if;

  select id, bill_id, booking_id, total_due, paid_amount into v_due
  from public.tenant_electricity_dues
  where id = p_due_id
  for update;

  if not found then
    raise exception 'Electricity due not found.';
  end if;

  v_new_paid := v_due.paid_amount + p_amount;
  if v_new_paid >= v_due.total_due then
    v_new_status := 'paid';
  else
    v_new_status := 'partial';
  end if;

  -- 1. Insert Payment in ledger
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
    v_due.booking_id,
    'electricity',
    p_amount,
    p_mode,
    p_paid_on,
    p_reference,
    auth.uid(),
    coalesce(p_notes, 'Electricity bill payment')
  ) returning id into v_payment_id;

  -- 2. Update tenant electricity due
  update public.tenant_electricity_dues
  set 
    paid_amount = v_new_paid,
    status = v_new_status,
    updated_at = now()
  where id = p_due_id;

  -- 3. Audit log
  insert into public.audit_log (
    actor_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    auth.uid(),
    'record_electricity_payment',
    'tenant_electricity_dues',
    p_due_id,
    jsonb_build_object(
      'amount', p_amount,
      'mode', p_mode,
      'reference', p_reference,
      'status', v_new_status
    )
  );

  return json_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'status', v_new_status
  );
end;
$$;

-- =============================================================================
-- 8. RICH SAMPLE DATA FOR PHASE 6
-- =============================================================================
do $$
declare
  v_admin_id uuid;
  v_flat1_id uuid;
  v_room1_id uuid;
  v_room2_id uuid;
  v_room3_id uuid;
  v_b1_id uuid := 'd0000000-0000-0000-0000-000000000001'; -- Rahul Sharma (Room 1)
  v_b2_id uuid := 'd0000000-0000-0000-0000-000000000002'; -- Priya Patel (Room 1)
  v_b3_id uuid := 'd0000000-0000-0000-0000-000000000003'; -- Vikram Malhotra (Room 2)
  v_bill1_id uuid := 'f0000000-0000-0000-0000-000000000001';
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  select id into v_flat1_id from public.flats where name = 'Sunrise Villa' limit 1;
  select id into v_room1_id from public.rooms where flat_id = v_flat1_id and room_no = 'R1' limit 1;
  select id into v_room2_id from public.rooms where flat_id = v_flat1_id and room_no = 'R2' limit 1;
  select id into v_room3_id from public.rooms where flat_id = v_flat1_id and room_no = 'R3' limit 1;

  if v_flat1_id is not null and v_room1_id is not null and v_room2_id is not null then
    -- Master Bill for Sunrise Villa (Nov 1 to Nov 20, Rate: ₹10/unit)
    -- Common meter: 100 units = ₹1,000 (split among 3 active flatmates = ₹333.33 each)
    -- Room 1 sub-meter: 120 units = ₹1,200 (split between Rahul & Priya = ₹600 each)
    -- Room 2 sub-meter: 80 units = ₹800 (Vikram sole occupant = ₹800)
    -- Total Flat Bill = ₹3,000
    insert into public.electricity_bills (
      id, flat_id, period_start, period_end, rate, units, total_amount,
      common_units, common_amount, rooms_total_units, rooms_total_amount,
      total_occupied_beds, status, created_by
    ) values (
      v_bill1_id, v_flat1_id, '2026-11-01', '2026-11-20', 10.00, 300.00, 3000.00,
      100.00, 1000.00, 200.00, 2000.00, 3, 'generated', v_admin_id
    ) on conflict (id) do nothing;

    -- Tenant 1: Rahul Sharma (Room 1) -> ₹600 (Room 1) + ₹333.33 (Common) = ₹933.33 (Paid)
    insert into public.tenant_electricity_dues (
      bill_id, booking_id, client_id, room_id,
      room_units, room_share_count, room_amount,
      common_units, common_share_count, common_amount,
      total_due, paid_amount, status
    ) values (
      v_bill1_id, v_b1_id, 'c0000000-0000-0000-0000-000000000001', v_room1_id,
      120.00, 2, 600.00, 100.00, 3, 333.33, 933.33, 933.33, 'paid'
    ) on conflict do nothing;

    -- Tenant 2: Priya Patel (Room 1) -> ₹600 (Room 1) + ₹333.33 (Common) = ₹933.33 (Pending)
    insert into public.tenant_electricity_dues (
      bill_id, booking_id, client_id, room_id,
      room_units, room_share_count, room_amount,
      common_units, common_share_count, common_amount,
      total_due, paid_amount, status
    ) values (
      v_bill1_id, v_b2_id, 'c0000000-0000-0000-0000-000000000002', v_room1_id,
      120.00, 2, 600.00, 100.00, 3, 333.33, 933.33, 0.00, 'pending'
    ) on conflict do nothing;

    -- Tenant 3: Vikram Malhotra (Room 2) -> ₹800 (Room 2) + ₹333.33 (Common) = ₹1133.33 (Pending)
    insert into public.tenant_electricity_dues (
      bill_id, booking_id, client_id, room_id,
      room_units, room_share_count, room_amount,
      common_units, common_share_count, common_amount,
      total_due, paid_amount, status
    ) values (
      v_bill1_id, v_b3_id, 'c0000000-0000-0000-0000-000000000003', v_room2_id,
      80.00, 1, 800.00, 100.00, 3, 333.33, 1133.33, 0.00, 'pending'
    ) on conflict do nothing;
  end if;
end $$;
