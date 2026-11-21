-- =============================================================================
-- GMD Co-living PMS: Complete Database Setup Script
-- Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =============================================================================

-- 1. EXTENSIONS
create extension if not exists pgcrypto;

-- 2. ENUMS
do $$ begin
  create type app_role as enum ('admin','sales','noc','accounts','maintenance','electricity');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bed_status as enum ('vacant','reserved','occupied','notice','blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('token','noc_hold','noc_cleared','active','rejected','cancelled','moved_out');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_source as enum ('token','existing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type noc_status as enum ('pending','cleared','hold','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_type as enum ('token','deposit','rent','electricity','opening_balance','refund','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_mode as enum ('cash','upi','bank_transfer','card','other');
exception when duplicate_object then null; end $$;

-- 3. TABLES
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  email text not null unique,
  role app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists flats (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  owner_name text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references flats on delete restrict,
  room_no text not null,
  sharing_type smallint not null check (sharing_type between 1 and 10),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flat_id, room_no)
);

create table if not exists beds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms on delete restrict,
  bed_label text not null,
  base_price numeric(12,2) not null check (base_price >= 0),
  status bed_status not null default 'vacant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, bed_label)
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  aadhaar_encrypted bytea,
  aadhaar_last4 char(4),
  aadhaar_hash text unique,
  phone1 text not null check (phone1 ~ '^\d{10}$'),
  phone2 text check (phone2 is null or phone2 ~ '^\d{10}$'),
  emergency_contact_name text,
  emergency_contact_phone text check (emergency_contact_phone is null or emergency_contact_phone ~ '^\d{10}$'),
  photo_path text,
  aadhaar_doc_path text,
  profile_complete boolean generated always as (
    aadhaar_last4 is not null and photo_path is not null and phone2 is not null
  ) stored,
  created_by uuid references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients,
  bed_id uuid not null references beds,
  source booking_source not null default 'token',
  status booking_status not null default 'token',
  token_amount numeric(12,2) not null default 0 check (token_amount >= 0),
  agreed_rent numeric(12,2) not null check (agreed_rent >= 0),
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  move_in_date date,
  move_out_date date,
  next_rent_due date,
  created_by uuid references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_live_booking_per_bed on bookings(bed_id)
  where status in ('token','noc_hold','noc_cleared','active');

create table if not exists noc_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings on delete cascade,
  status noc_status not null default 'pending',
  remarks text,
  done_by uuid references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings,
  type payment_type not null,
  amount numeric(12,2) not null check (amount > 0),
  mode payment_mode,
  for_month date,
  paid_on date not null default current_date,
  reference text,
  received_by uuid references profiles,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists electricity_readings (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references flats,
  reading_date date not null,
  meter_value numeric(12,2) not null check (meter_value >= 0),
  entered_by uuid references profiles,
  created_at timestamptz not null default now()
);

create table if not exists electricity_bills (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references flats,
  period_start date,
  period_end date,
  units numeric(12,2) check (units >= 0),
  rate numeric(8,2) check (rate >= 0),
  total_amount numeric(12,2) check (total_amount >= 0),
  split_method text not null default 'per_bed' check (split_method in ('per_bed','per_room')),
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  actor_id uuid references profiles,
  action text not null,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

-- 4. HELPER FUNCTIONS
create or replace function public.get_my_role()
returns public.app_role language sql stable security definer
set search_path = public, auth
as $$
  select role from public.profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.is_active_profile()
returns boolean language sql stable security definer
set search_path = public, auth
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active = true);
$$;

create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 5. UPDATED_AT TRIGGERS
drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles for each row execute function update_updated_at();

drop trigger if exists trg_flats_updated_at on flats;
create trigger trg_flats_updated_at before update on flats for each row execute function update_updated_at();

drop trigger if exists trg_rooms_updated_at on rooms;
create trigger trg_rooms_updated_at before update on rooms for each row execute function update_updated_at();

drop trigger if exists trg_beds_updated_at on beds;
create trigger trg_beds_updated_at before update on beds for each row execute function update_updated_at();

drop trigger if exists trg_clients_updated_at on clients;
create trigger trg_clients_updated_at before update on clients for each row execute function update_updated_at();

drop trigger if exists trg_bookings_updated_at on bookings;
create trigger trg_bookings_updated_at before update on bookings for each row execute function update_updated_at();

drop trigger if exists trg_noc_records_updated_at on noc_records;
create trigger trg_noc_records_updated_at before update on noc_records for each row execute function update_updated_at();

-- 6. AUTOMATED USER REGISTRATION TRIGGER
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, auth
as $$
declare
  user_full_name text;
  user_role public.app_role;
begin
  user_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  -- If first user ever, make admin; otherwise default to metadata or sales
  if not exists (select 1 from public.profiles limit 1) then
    user_role := 'admin'::public.app_role;
  else
    user_role := coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'sales'::public.app_role);
  end if;

  insert into public.profiles (id, full_name, email, role, is_active)
  values (new.id, user_full_name, new.email, user_role, true)
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. AUDIT TRIGGER
create or replace function public.audit_trigger_func()
returns trigger language plpgsql security definer
set search_path = public, auth
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_log(actor_id, action, table_name, record_id, new_data)
    values (auth.uid(), 'insert', tg_table_name, new.id, to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_log(actor_id, action, table_name, record_id, old_data, new_data)
    values (auth.uid(), 'update', tg_table_name, new.id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_log(actor_id, action, table_name, record_id, old_data)
    values (auth.uid(), 'delete', tg_table_name, old.id, to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_bookings on bookings;
create trigger trg_audit_bookings after insert or update or delete on bookings for each row execute function audit_trigger_func();

drop trigger if exists trg_audit_payments on payments;
create trigger trg_audit_payments after insert or update or delete on payments for each row execute function audit_trigger_func();

drop trigger if exists trg_audit_beds on beds;
create trigger trg_audit_beds after insert or update or delete on beds for each row execute function audit_trigger_func();

drop trigger if exists trg_audit_clients on clients;
create trigger trg_audit_clients after insert or update or delete on clients for each row execute function audit_trigger_func();

drop trigger if exists trg_audit_flats on flats;
create trigger trg_audit_flats after insert or update or delete on flats for each row execute function audit_trigger_func();

drop trigger if exists trg_audit_rooms on rooms;
create trigger trg_audit_rooms after insert or update or delete on rooms for each row execute function audit_trigger_func();

drop trigger if exists trg_audit_profiles on profiles;
create trigger trg_audit_profiles after insert or update or delete on profiles for each row execute function audit_trigger_func();

-- 8. ROW LEVEL SECURITY POLICIES
alter table profiles enable row level security;
drop policy if exists "Active profiles can read all profiles" on profiles;
create policy "Active profiles can read all profiles" on profiles for select using (is_active_profile());
drop policy if exists "Admin can insert profiles" on profiles;
create policy "Admin can insert profiles" on profiles for insert with check (get_my_role() = 'admin');
drop policy if exists "Admin can update profiles" on profiles;
create policy "Admin can update profiles" on profiles for update using (get_my_role() = 'admin');

alter table flats enable row level security;
drop policy if exists "Active profiles can read flats" on flats;
create policy "Active profiles can read flats" on flats for select using (is_active_profile());
drop policy if exists "Admin can insert flats" on flats;
create policy "Admin can insert flats" on flats for insert with check (get_my_role() = 'admin');
drop policy if exists "Admin can update flats" on flats;
create policy "Admin can update flats" on flats for update using (get_my_role() = 'admin');

alter table rooms enable row level security;
drop policy if exists "Active profiles can read rooms" on rooms;
create policy "Active profiles can read rooms" on rooms for select using (is_active_profile());
drop policy if exists "Admin can insert rooms" on rooms;
create policy "Admin can insert rooms" on rooms for insert with check (get_my_role() = 'admin');
drop policy if exists "Admin can update rooms" on rooms;
create policy "Admin can update rooms" on rooms for update using (get_my_role() = 'admin');

alter table beds enable row level security;
drop policy if exists "Active profiles can read beds" on beds;
create policy "Active profiles can read beds" on beds for select using (is_active_profile());
drop policy if exists "Admin can insert beds" on beds;
create policy "Admin can insert beds" on beds for insert with check (get_my_role() = 'admin');
drop policy if exists "Admin can update beds" on beds;
create policy "Admin can update beds" on beds for update using (get_my_role() = 'admin');

alter table clients enable row level security;
drop policy if exists "Active profiles can read clients" on clients;
create policy "Active profiles can read clients" on clients for select using (is_active_profile());
drop policy if exists "Admin and sales can insert clients" on clients;
create policy "Admin and sales can insert clients" on clients for insert with check (get_my_role() in ('admin','sales'));
drop policy if exists "Admin can update clients" on clients;
create policy "Admin can update clients" on clients for update using (get_my_role() = 'admin');

alter table bookings enable row level security;
drop policy if exists "Active profiles can read bookings" on bookings;
create policy "Active profiles can read bookings" on bookings for select using (is_active_profile());
drop policy if exists "Admin and sales can insert bookings" on bookings;
create policy "Admin and sales can insert bookings" on bookings for insert with check (get_my_role() in ('admin','sales'));
drop policy if exists "Authorized roles can update bookings" on bookings;
create policy "Authorized roles can update bookings" on bookings for update using (get_my_role() in ('admin','sales','noc','accounts'));

alter table noc_records enable row level security;
drop policy if exists "Active profiles can read noc_records" on noc_records;
create policy "Active profiles can read noc_records" on noc_records for select using (is_active_profile());
drop policy if exists "Admin and noc can insert noc_records" on noc_records;
create policy "Admin and noc can insert noc_records" on noc_records for insert with check (get_my_role() in ('admin','noc'));
drop policy if exists "Admin and noc can update noc_records" on noc_records;
create policy "Admin and noc can update noc_records" on noc_records for update using (get_my_role() in ('admin','noc'));

alter table payments enable row level security;
drop policy if exists "Active profiles can read payments" on payments;
create policy "Active profiles can read payments" on payments for select using (is_active_profile());
drop policy if exists "Admin and accounts can insert payments" on payments;
create policy "Admin and accounts can insert payments" on payments for insert with check (get_my_role() in ('admin','accounts'));

alter table electricity_readings enable row level security;
drop policy if exists "Active profiles can read electricity_readings" on electricity_readings;
create policy "Active profiles can read electricity_readings" on electricity_readings for select using (is_active_profile());
drop policy if exists "Admin, accounts, electricity can insert readings" on electricity_readings;
create policy "Admin, accounts, electricity can insert readings" on electricity_readings for insert with check (get_my_role() in ('admin','accounts','electricity'));
drop policy if exists "Admin, accounts, electricity can update readings" on electricity_readings;
create policy "Admin, accounts, electricity can update readings" on electricity_readings for update using (get_my_role() in ('admin','accounts','electricity'));

alter table electricity_bills enable row level security;
drop policy if exists "Active profiles can read electricity_bills" on electricity_bills;
create policy "Active profiles can read electricity_bills" on electricity_bills for select using (is_active_profile());
drop policy if exists "Admin, accounts, electricity can insert bills" on electricity_bills;
create policy "Admin, accounts, electricity can insert bills" on electricity_bills for insert with check (get_my_role() in ('admin','accounts','electricity'));
drop policy if exists "Admin, accounts, electricity can update bills" on electricity_bills;
create policy "Admin, accounts, electricity can update bills" on electricity_bills for update using (get_my_role() in ('admin','accounts','electricity'));

alter table audit_log enable row level security;
drop policy if exists "Admin can read audit_log" on audit_log;
create policy "Admin can read audit_log" on audit_log for select using (get_my_role() = 'admin');

-- 9. INVENTORY VIEW
create or replace view v_bed_inventory with (security_invoker = true) as
select 
  b.id as bed_id,
  b.bed_label,
  b.base_price,
  b.status as bed_status,
  b.created_at as bed_created_at,
  r.id as room_id,
  r.room_no,
  r.sharing_type,
  r.is_active as room_active,
  f.id as flat_id,
  f.name as flat_name,
  f.address as flat_address,
  f.is_active as flat_active,
  bk.id as booking_id,
  bk.status as booking_status,
  c.id as client_id,
  c.full_name as client_name,
  c.phone1 as client_phone
from beds b
join rooms r on b.room_id = r.id
join flats f on r.flat_id = f.id
left join bookings bk on bk.bed_id = b.id and bk.status in ('token', 'noc_hold', 'noc_cleared', 'active')
left join clients c on bk.client_id = c.id;

-- 10. SAMPLE PROPERTIES & BEDS SEED DATA
insert into flats (id, name, address, owner_name, notes) values
  ('a0000000-0000-0000-0000-000000000001', 'Sunrise Villa', '123 MG Road, Bangalore', 'Ramesh Kumar', 'Ground floor, 3BHK'),
  ('a0000000-0000-0000-0000-000000000002', 'Lake View Apartment', '456 BTM Layout, Bangalore', 'Suresh Patel', '2nd floor, 2BHK')
on conflict (id) do nothing;

insert into rooms (id, flat_id, room_no, sharing_type) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'R1', 3),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'R2', 2),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'R3', 1),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'R1', 4),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'R2', 2)
on conflict (id) do nothing;

insert into beds (room_id, bed_label, base_price, status) values
  ('b0000000-0000-0000-0000-000000000001', 'A', 7500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000001', 'B', 7500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000001', 'C', 7500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000002', 'A', 9000.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000002', 'B', 9000.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000003', 'A', 12000.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000004', 'A', 6500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000004', 'B', 6500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000004', 'C', 6500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000004', 'D', 6500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000005', 'A', 8500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000005', 'B', 8500.00, 'vacant')
on conflict do nothing;

-- 11. ATOMIC STORED PROCEDURE: ADD EXISTING TENANT
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
