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

-- 12. STORAGE BUCKET: client-documents (Private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents',
  'client-documents',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

drop policy if exists "Active employees can read client documents" on storage.objects;
create policy "Active employees can read client documents"
  on storage.objects for select
  using (bucket_id = 'client-documents' and (select public.is_active_profile()));

drop policy if exists "Employees can upload client documents" on storage.objects;
create policy "Employees can upload client documents"
  on storage.objects for insert
  with check (bucket_id = 'client-documents' and (select public.is_active_profile()));

-- 13. AADHAAR REVEAL AUDIT FUNCTION
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


-- =============================================================================
-- 14. PHASE 4: TOKEN WORKFLOW & PROCEDURES
-- =============================================================================

-- View for tokens workflow
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
  c.id as client_id,
  c.full_name as client_name,
  c.phone1 as client_phone1,
  c.phone2 as client_phone2,
  c.aadhaar_last4,
  c.photo_path,
  b.id as bed_id,
  b.bed_label,
  b.base_price as bed_base_price,
  b.status as bed_status,
  r.id as room_id,
  r.room_no,
  r.sharing_type,
  f.id as flat_id,
  f.name as flat_name,
  nr.id as noc_id,
  nr.status as noc_status,
  nr.remarks as noc_remarks,
  nr.updated_at as noc_updated_at,
  p_noc.full_name as noc_done_by_name,
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
  v_caller_role := public.get_my_role();
  if v_caller_role not in ('admin', 'sales') then
    raise exception 'Unauthorized: Only Admin or Sales can create tokens.';
  end if;

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

  select id into v_existing_booking_id
  from public.bookings
  where bed_id = p_bed_id
    and status in ('token', 'noc_hold', 'noc_cleared', 'active')
  limit 1;

  if v_existing_booking_id is not null then
    raise exception 'Bed already has an active or reserved booking.';
  end if;

  if p_aadhaar_hash is not null then
    select id into v_client_id from public.clients where aadhaar_hash = p_aadhaar_hash limit 1;
  end if;

  if v_client_id is null and p_phone1 is not null then
    select id into v_client_id from public.clients where phone1 = p_phone1 limit 1;
  end if;

  if v_client_id is not null then
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

  update public.beds
  set status = 'reserved', updated_at = now()
  where id = p_bed_id;

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
  v_caller_role := public.get_my_role();
  if v_caller_role not in ('admin', 'noc') then
    raise exception 'Unauthorized: Only Admin or NOC can update NOC status.';
  end if;

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

  if p_status = 'cleared' then
    v_target_booking_status := 'noc_cleared';
  elsif p_status = 'hold' then
    v_target_booking_status := 'noc_hold';
  elsif p_status = 'rejected' then
    v_target_booking_status := 'rejected';
  else
    v_target_booking_status := 'token';
  end if;

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

  update public.bookings
  set status = v_target_booking_status, updated_at = now()
  where id = p_booking_id;

  if p_status = 'rejected' then
    update public.beds
    set status = 'vacant', updated_at = now()
    where id = v_bed_id;
  end if;

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
  v_caller_role := public.get_my_role();
  if v_caller_role not in ('admin', 'accounts') then
    raise exception 'Unauthorized: Only Admin or Accounts can confirm move-in.';
  end if;

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
  v_calculated_due := coalesce(p_next_rent_due, (p_actual_move_in_date + interval '1 month')::date);

  update public.bookings
  set 
    status = 'active',
    move_in_date = p_actual_move_in_date,
    deposit_amount = p_deposit_amount,
    next_rent_due = v_calculated_due,
    updated_at = now()
  where id = p_booking_id;

  update public.beds
  set status = 'occupied', updated_at = now()
  where id = v_bed_id;

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
-- 15. PHASE 5: PAYMENTS, DUES, RENT GENERATION & MOVE-OUT
-- =============================================================================

alter table public.bookings 
  add column if not exists notice_date date;

create table if not exists public.rent_dues (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings on delete cascade,
  for_month date not null,
  due_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid', 'overdue', 'waived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, for_month)
);

alter table public.payments 
  add column if not exists rent_due_id uuid references public.rent_dues on delete set null;

drop trigger if exists trg_audit_rent_dues on public.rent_dues;
create trigger trg_audit_rent_dues after insert or update or delete on public.rent_dues
  for each row execute function public.audit_trigger_func();

alter table public.rent_dues enable row level security;

drop policy if exists "Active profiles can read rent_dues" on public.rent_dues;
create policy "Active profiles can read rent_dues"
  on public.rent_dues for select
  using (public.is_active_profile());

drop policy if exists "Admin and accounts can insert rent_dues" on public.rent_dues;
create policy "Admin and accounts can insert rent_dues"
  on public.rent_dues for insert
  with check (public.get_my_role() in ('admin', 'accounts'));

drop policy if exists "Admin and accounts can update rent_dues" on public.rent_dues;
create policy "Admin and accounts can update rent_dues"
  on public.rent_dues for update
  using (public.get_my_role() in ('admin', 'accounts'));

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
  c.id as client_id,
  c.full_name as client_name,
  c.phone1 as client_phone1,
  b.id as bed_id,
  b.bed_label,
  b.status as bed_status,
  r.id as room_id,
  r.room_no,
  f.id as flat_id,
  f.name as flat_name,
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
    if v_booking.move_in_date is not null then
      v_due_date := (v_first_day + (extract(day from v_booking.move_in_date)::integer - 1) * interval '1 day')::date;
    else
      v_due_date := (v_first_day + interval '4 days')::date;
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

  update public.bookings
  set 
    notice_date = p_notice_date,
    move_out_date = p_expected_move_out_date,
    updated_at = now()
  where id = p_booking_id;

  update public.beds
  set status = 'notice', updated_at = now()
  where id = v_bed_id;

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

  update public.bookings
  set 
    status = 'moved_out',
    move_out_date = p_actual_move_out_date,
    updated_at = now()
  where id = p_booking_id;

  update public.beds
  set status = 'vacant', updated_at = now()
  where id = v_bed_id;

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
