-- =============================================================================
-- GMD Co-living PMS: Phase 1 — Auth Trigger and Bed Inventory View
-- =============================================================================

-- 1. Automated trigger on auth.users to create profiles on signup/admin-create
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  user_full_name text;
  user_role app_role;
begin
  user_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  user_role := coalesce((new.raw_user_meta_data->>'role')::app_role, 'sales'::app_role);

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

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2. Bed Inventory View with tenant details (security_invoker = true enforces RLS)
create or replace view v_bed_inventory
with (security_invoker = true)
as
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
