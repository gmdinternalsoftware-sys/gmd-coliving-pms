-- =============================================================================
-- GMD Co-living PMS: Phase 0 — RLS Policies, Helper Functions, Audit Triggers
-- =============================================================================

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get the current user's role (avoids clash with built-in current_role)
create or replace function public.get_my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select role from public.profiles where id = auth.uid() and is_active = true;
$$;

-- Check if the current user is active
create or replace function public.is_active_profile()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active = true);
$$;

-- Auto-update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- updated_at TRIGGERS
-- =============================================================================

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function public.update_updated_at();

create trigger trg_flats_updated_at before update on flats
  for each row execute function public.update_updated_at();

create trigger trg_rooms_updated_at before update on rooms
  for each row execute function public.update_updated_at();

create trigger trg_beds_updated_at before update on beds
  for each row execute function public.update_updated_at();

create trigger trg_clients_updated_at before update on clients
  for each row execute function public.update_updated_at();

create trigger trg_bookings_updated_at before update on bookings
  for each row execute function public.update_updated_at();

create trigger trg_noc_records_updated_at before update on noc_records
  for each row execute function public.update_updated_at();

-- =============================================================================
-- AUDIT TRIGGER
-- =============================================================================

create or replace function public.audit_trigger_func()
returns trigger
language plpgsql
security definer
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

-- Audit triggers on key tables
create trigger trg_audit_bookings after insert or update or delete on bookings
  for each row execute function audit_trigger_func();

create trigger trg_audit_payments after insert or update or delete on payments
  for each row execute function audit_trigger_func();

create trigger trg_audit_beds after insert or update or delete on beds
  for each row execute function audit_trigger_func();

create trigger trg_audit_clients after insert or update or delete on clients
  for each row execute function audit_trigger_func();

create trigger trg_audit_flats after insert or update or delete on flats
  for each row execute function audit_trigger_func();

create trigger trg_audit_rooms after insert or update or delete on rooms
  for each row execute function audit_trigger_func();

create trigger trg_audit_profiles after insert or update or delete on profiles
  for each row execute function audit_trigger_func();

create trigger trg_audit_noc_records after insert or update or delete on noc_records
  for each row execute function audit_trigger_func();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- ---- profiles ----
alter table profiles enable row level security;

create policy "Active profiles can read all profiles"
  on profiles for select
  using (is_active_profile());

create policy "Admin can insert profiles"
  on profiles for insert
  with check (get_my_role() = 'admin');

create policy "Admin can update profiles"
  on profiles for update
  using (get_my_role() = 'admin');

-- ---- flats ----
alter table flats enable row level security;

create policy "Active profiles can read flats"
  on flats for select
  using (is_active_profile());

create policy "Admin can insert flats"
  on flats for insert
  with check (get_my_role() = 'admin');

create policy "Admin can update flats"
  on flats for update
  using (get_my_role() = 'admin');

-- ---- rooms ----
alter table rooms enable row level security;

create policy "Active profiles can read rooms"
  on rooms for select
  using (is_active_profile());

create policy "Admin can insert rooms"
  on rooms for insert
  with check (get_my_role() = 'admin');

create policy "Admin can update rooms"
  on rooms for update
  using (get_my_role() = 'admin');

-- ---- beds ----
alter table beds enable row level security;

create policy "Active profiles can read beds"
  on beds for select
  using (is_active_profile());

create policy "Admin can insert beds"
  on beds for insert
  with check (get_my_role() = 'admin');

create policy "Admin can update beds"
  on beds for update
  using (get_my_role() = 'admin');

-- ---- clients ----
alter table clients enable row level security;

create policy "Active profiles can read clients"
  on clients for select
  using (is_active_profile());

create policy "Admin and sales can insert clients"
  on clients for insert
  with check (get_my_role() in ('admin','sales'));

create policy "Admin can update clients"
  on clients for update
  using (get_my_role() = 'admin');

-- ---- bookings ----
alter table bookings enable row level security;

create policy "Active profiles can read bookings"
  on bookings for select
  using (is_active_profile());

create policy "Admin and sales can insert bookings"
  on bookings for insert
  with check (get_my_role() in ('admin','sales'));

create policy "Authorized roles can update bookings"
  on bookings for update
  using (get_my_role() in ('admin','sales','noc','accounts'));

-- ---- noc_records ----
alter table noc_records enable row level security;

create policy "Active profiles can read noc_records"
  on noc_records for select
  using (is_active_profile());

create policy "Admin and noc can insert noc_records"
  on noc_records for insert
  with check (get_my_role() in ('admin','noc'));

create policy "Admin and noc can update noc_records"
  on noc_records for update
  using (get_my_role() in ('admin','noc'));

-- ---- payments ----
alter table payments enable row level security;

create policy "Active profiles can read payments"
  on payments for select
  using (is_active_profile());

create policy "Admin and accounts can insert payments"
  on payments for insert
  with check (get_my_role() in ('admin','accounts'));

-- No update/delete on payments (immutable financial records)

-- ---- electricity_readings ----
alter table electricity_readings enable row level security;

create policy "Active profiles can read electricity_readings"
  on electricity_readings for select
  using (is_active_profile());

create policy "Admin, accounts, electricity can insert readings"
  on electricity_readings for insert
  with check (get_my_role() in ('admin','accounts','electricity'));

create policy "Admin, accounts, electricity can update readings"
  on electricity_readings for update
  using (get_my_role() in ('admin','accounts','electricity'));

-- ---- electricity_bills ----
alter table electricity_bills enable row level security;

create policy "Active profiles can read electricity_bills"
  on electricity_bills for select
  using (is_active_profile());

create policy "Admin, accounts, electricity can insert bills"
  on electricity_bills for insert
  with check (get_my_role() in ('admin','accounts','electricity'));

create policy "Admin, accounts, electricity can update bills"
  on electricity_bills for update
  using (get_my_role() in ('admin','accounts','electricity'));

-- ---- audit_log ----
alter table audit_log enable row level security;

create policy "Admin can read audit_log"
  on audit_log for select
  using (get_my_role() = 'admin');

-- No insert/update/delete policies: audit_log is written by triggers (security definer)
-- The trigger function runs as the function owner, bypassing RLS
