# PLAN.md: GMD Co-living PG Management System

## 1. Goals
- Track every **bed** (not just flats): vacant / reserved / occupied.
- Sales creates **tokens**; NOC, Accounts, Maintenance, Electricity see and act on them in a pipeline.
- Everyone can **view** all tokens and clients. Only the right role can **edit**.
- Admin can add **existing tenants** (single or Excel import) and manually correct data.
- Excel export of occupied / vacant beds. Rent and electricity tracking.

## 2. Roles and permissions

| Action | Admin | Sales | NOC | Accounts | Maint. | Electricity |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| View tokens, clients, beds, flats | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| See full Aadhaar (logged) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create employees, flats, rooms, beds | ✅ | | | | | |
| Add existing tenant / bulk import / manual fix | ✅ | | | | | |
| Create token | ✅ | ✅ | | | | |
| Set NOC status + remarks | ✅ | | ✅ | | | |
| Record token/deposit/rent payments, confirm move-in | ✅ | | | ✅ | | |
| Enter electricity readings/bills | ✅ | | | ✅ | | ✅ |
| Export Excel | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## 3. Booking pipeline
```
Sales: Token created (bed -> reserved)
  -> NOC: cleared | hold | rejected (rejected frees the bed)
  -> Accounts: collects deposit + first rent, confirms move-in
  -> Booking active, bed -> occupied
Later: notice -> move-out -> deposit refund -> bed vacant
```
Existing tenants skip the pipeline: Admin creates booking with `source='existing'`, bed goes straight to occupied.

## 4. Database schema (starting point; agent must review and refine)

```sql
create extension if not exists pgcrypto;

create type app_role as enum ('admin','sales','noc','accounts','maintenance','electricity');
create type bed_status as enum ('vacant','reserved','occupied','notice','blocked');
create type booking_status as enum ('token','noc_hold','noc_cleared','active','rejected','cancelled','moved_out');
create type booking_source as enum ('token','existing');
create type noc_status as enum ('pending','cleared','hold','rejected');
create type payment_type as enum ('token','deposit','rent','electricity','opening_balance','refund','other');
create type payment_mode as enum ('cash','upi','bank_transfer','card','other');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  email text not null unique,
  role app_role not null,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table flats (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  owner_name text,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references flats on delete restrict,
  room_no text not null,
  sharing_type smallint not null check (sharing_type between 1 and 10), -- beds in room
  unique (flat_id, room_no)
);

create table beds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms on delete restrict,
  bed_label text not null,                 -- e.g. A, B or 1, 2
  base_price numeric(12,2) not null,       -- listed monthly rent
  status bed_status not null default 'vacant',
  unique (room_id, bed_label)
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  aadhaar_encrypted bytea,
  aadhaar_last4 char(4),
  aadhaar_hash text unique,                -- hash for duplicate detection
  phone1 text not null,
  phone2 text,
  emergency_contact_name text,
  emergency_contact_phone text,
  photo_path text,                         -- private storage path
  aadhaar_doc_path text,
  profile_complete boolean generated always as
    (aadhaar_last4 is not null and photo_path is not null and phone2 is not null) stored,
  created_by uuid references profiles,
  created_at timestamptz default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients,
  bed_id uuid not null references beds,
  source booking_source not null default 'token',
  status booking_status not null default 'token',
  token_amount numeric(12,2) default 0,
  agreed_rent numeric(12,2) not null,
  deposit_amount numeric(12,2) default 0,
  move_in_date date,
  move_out_date date,
  next_rent_due date,
  created_by uuid references profiles,
  created_at timestamptz default now()
);
-- one live booking per bed (prevents double tokens)
create unique index one_live_booking_per_bed on bookings(bed_id)
  where status in ('token','noc_hold','noc_cleared','active');

create table noc_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings on delete cascade,
  status noc_status not null default 'pending',
  remarks text,
  done_by uuid references profiles,
  updated_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings,
  type payment_type not null,
  amount numeric(12,2) not null,
  mode payment_mode,
  for_month date,                          -- first day of month for rent
  paid_on date not null default current_date,
  reference text,
  received_by uuid references profiles,
  notes text,
  created_at timestamptz default now()
);

create table electricity_readings (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references flats,
  reading_date date not null,
  meter_value numeric(12,2) not null,
  entered_by uuid references profiles
);

create table electricity_bills (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references flats,
  period_start date, period_end date,
  units numeric(12,2), rate numeric(8,2), total_amount numeric(12,2),
  split_method text default 'per_bed',     -- per_bed | per_room (decide)
  created_at timestamptz default now()
);

create table audit_log (
  id bigserial primary key,
  actor_id uuid references profiles,
  action text not null,                    -- insert/update/delete/aadhaar_reveal/login
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);
```

**RLS pattern:** `select` for any active profile; `insert/update/delete` gated by a helper `current_role()`. Aadhaar reveal and "add existing tenant" run as server-side functions that check role and write `audit_log`.

## 5. Phases (checklist)
- [x] **Phase 0** Foundation: repo, Supabase, schema, auth, roles, `.env.example`, layout shell
- [x] **Phase 1** Admin and inventory: create employees, flats/rooms/beds, bed inventory view with filters
- [x] **Phase 2** Existing tenants (Admin only): add form, Excel/CSV bulk import with validation, incomplete-profile filter, admin manual edit
- [x] **Phase 3** Client profiles: searchable list, profile page (flat/bed, rent paid, phones, photo, masked Aadhaar), photo upload
- [x] **Phase 4** Token workflow: sales token form, NOC queue, Accounts collection and move-in, status badges, "everyone can view" token list
- [ ] **Phase 5** Payments and dues: monthly rent generation, pending/overdue list, receipts (PDF), deposit refund on move-out
- [ ] **Phase 6** Electricity: readings, bill calc, split, payment tracking
- [ ] **Phase 7** Reports and Excel export: dashboard, export sheets (All Beds, Occupied, Vacant, Dues)
- [ ] **Phase 8** Hardening: audit review, role tests, backups, mobile QA, deploy, training

## 6. Open decisions (defaults used until you answer)
| Question | Default |
|---|---|
| Rent due date | Per tenant's move-in date (store `next_rent_due`) |
| Token expiry | Flag after 7 days pending; no auto-release |
| Electricity split | Equal per occupied bed |
| Move-out/notice in v1 | Basic: notice date, move-out date, refund entry |
| Language | English only |
| Aadhaar visibility | For all Accounts (logged) |
