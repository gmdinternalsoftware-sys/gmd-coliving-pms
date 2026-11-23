-- =============================================================================
-- GMD Co-living PMS: Caretakers Table & Updated Payment Modes
-- =============================================================================

-- 1. Extend Payment Mode Enum with Specific Company Accounts
-- Options requested: "UPI - Serenity", "UPI - GMD", "UPI - Platinum S", "Cash", "Bank transfer"
alter type public.payment_mode add value if not exists 'upi_serenity';
alter type public.payment_mode add value if not exists 'upi_gmd';
alter type public.payment_mode add value if not exists 'upi_platinum_s';

-- 2. Caretakers Table
create table if not exists public.caretakers (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references public.flats(id) on delete cascade,
  name text not null,
  phone text not null check (phone ~ '^\d{10}$'),
  alternate_phone text check (alternate_phone is null or alternate_phone ~ '^\d{10}$'),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger for audit logging
drop trigger if exists trg_audit_caretakers on public.caretakers;
create trigger trg_audit_caretakers after insert or update or delete on public.caretakers
  for each row execute function public.audit_trigger_func();

-- 3. Row Level Security for Caretakers
alter table public.caretakers enable row level security;

drop policy if exists "Active profiles can read caretakers" on public.caretakers;
create policy "Active profiles can read caretakers"
  on public.caretakers for select
  using (public.is_active_profile());

drop policy if exists "Admin can insert caretakers" on public.caretakers;
create policy "Admin can insert caretakers"
  on public.caretakers for insert
  with check (public.get_my_role() = 'admin');

drop policy if exists "Admin can update caretakers" on public.caretakers;
create policy "Admin can update caretakers"
  on public.caretakers for update
  using (public.get_my_role() = 'admin');

drop policy if exists "Admin can delete caretakers" on public.caretakers;
create policy "Admin can delete caretakers"
  on public.caretakers for delete
  using (public.get_my_role() = 'admin');

-- 4. Sample Caretakers Data
do $$
declare
  v_flat1_id uuid;
  v_flat2_id uuid;
begin
  select id into v_flat1_id from public.flats where name = 'Sunrise Villa' limit 1;
  select id into v_flat2_id from public.flats where name = 'Lake View Apartment' limit 1;

  if v_flat1_id is not null then
    insert into public.caretakers (flat_id, name, phone, alternate_phone, notes)
    values (v_flat1_id, 'Ramesh Gowda', '9845012345', '9845012346', 'Day shift caretaker, in charge of keys and water supply')
    on conflict do nothing;
  end if;

  if v_flat2_id is not null then
    insert into public.caretakers (flat_id, name, phone, alternate_phone, notes)
    values (v_flat2_id, 'Manjunath K', '9886098765', null, 'Full-time residential caretaker for Lake View')
    on conflict do nothing;
  end if;
end $$;
