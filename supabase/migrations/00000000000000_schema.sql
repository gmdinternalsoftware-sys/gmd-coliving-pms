-- =============================================================================
-- GMD Co-living PMS: Phase 0 — Core Schema
-- =============================================================================

-- Extensions
create extension if not exists pgcrypto;

-- =============================================================================
-- ENUMS
-- =============================================================================
create type app_role as enum ('admin','sales','noc','accounts','maintenance','electricity');
create type bed_status as enum ('vacant','reserved','occupied','notice','blocked');
create type booking_status as enum ('token','noc_hold','noc_cleared','active','rejected','cancelled','moved_out');
create type booking_source as enum ('token','existing');
create type noc_status as enum ('pending','cleared','hold','rejected');
create type payment_type as enum ('token','deposit','rent','electricity','opening_balance','refund','other');
create type payment_mode as enum ('cash','upi','bank_transfer','card','other');

-- =============================================================================
-- TABLES
-- =============================================================================

-- Profiles (linked to auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  email text not null unique,
  role app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Flats (properties)
create table flats (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  owner_name text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rooms (within flats)
create table rooms (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references flats on delete restrict,
  room_no text not null,
  sharing_type smallint not null check (sharing_type between 1 and 10),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flat_id, room_no)
);

-- Beds (within rooms)
create table beds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms on delete restrict,
  bed_label text not null,
  base_price numeric(12,2) not null check (base_price >= 0),
  status bed_status not null default 'vacant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, bed_label)
);

-- Clients (tenants)
create table clients (
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

-- Bookings
create table bookings (
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

-- Enforce one live booking per bed (prevents double-token / double-occupy)
create unique index one_live_booking_per_bed on bookings(bed_id)
  where status in ('token','noc_hold','noc_cleared','active');

-- NOC records
create table noc_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings on delete cascade,
  status noc_status not null default 'pending',
  remarks text,
  done_by uuid references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Payments
create table payments (
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

-- Electricity readings
create table electricity_readings (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references flats,
  reading_date date not null,
  meter_value numeric(12,2) not null check (meter_value >= 0),
  entered_by uuid references profiles,
  created_at timestamptz not null default now()
);

-- Electricity bills
create table electricity_bills (
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

-- Audit log (append-only)
create table audit_log (
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

-- =============================================================================
-- INDEXES (for common queries)
-- =============================================================================

-- FK indexes (Postgres does NOT auto-index FK columns)
create index idx_rooms_flat_id on rooms(flat_id);
create index idx_beds_room_id on beds(room_id);
create index idx_clients_phone1 on clients(phone1);
create index idx_clients_created_by on clients(created_by);
create index idx_bookings_client_id on bookings(client_id);
create index idx_bookings_bed_id on bookings(bed_id);
create index idx_bookings_status on bookings(status);
create index idx_bookings_created_by on bookings(created_by);
create index idx_noc_records_booking_id on noc_records(booking_id);
create index idx_payments_booking_id on payments(booking_id);
create index idx_payments_for_month on payments(for_month);
create index idx_payments_received_by on payments(received_by);
create index idx_electricity_readings_flat_id on electricity_readings(flat_id);
create index idx_electricity_bills_flat_id on electricity_bills(flat_id);
create index idx_audit_log_actor_id on audit_log(actor_id);
create index idx_audit_log_table_record on audit_log(table_name, record_id);
create index idx_audit_log_created_at on audit_log(created_at);

-- Beds status for inventory queries
create index idx_beds_status on beds(status);
