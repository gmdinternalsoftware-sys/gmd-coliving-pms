-- =============================================================================
-- GMD Co-living PMS: Phase 8 — Hardening, Complete Audit Coverage & RLS Fixes
-- =============================================================================

-- 1. Fix audit_trigger_func() so tables without a UUID `id` column (e.g. app_settings)
-- do not fail on `new.id` / `old.id` lookup.
create or replace function public.audit_trigger_func()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row_json jsonb;
  v_record_id_text text;
  v_record_id uuid := null;
begin
  if (tg_op = 'INSERT') then
    v_row_json := to_jsonb(new);
  elsif (tg_op = 'UPDATE') then
    v_row_json := to_jsonb(new);
  elsif (tg_op = 'DELETE') then
    v_row_json := to_jsonb(old);
  end if;

  v_record_id_text := v_row_json->>'id';
  if v_record_id_text is not null and v_record_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_record_id := v_record_id_text::uuid;
  end if;

  if (tg_op = 'INSERT') then
    insert into public.audit_log(actor_id, action, table_name, record_id, new_data)
    values (auth.uid(), 'insert', tg_table_name, v_record_id, to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_log(actor_id, action, table_name, record_id, old_data, new_data)
    values (auth.uid(), 'update', tg_table_name, v_record_id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_log(actor_id, action, table_name, record_id, old_data)
    values (auth.uid(), 'delete', tg_table_name, v_record_id, to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

-- 2. Complete audit trigger coverage on electricity_readings and electricity_bills
drop trigger if exists trg_audit_electricity_readings on public.electricity_readings;
create trigger trg_audit_electricity_readings
  after insert or update or delete on public.electricity_readings
  for each row execute function public.audit_trigger_func();

drop trigger if exists trg_audit_electricity_bills on public.electricity_bills;
create trigger trg_audit_electricity_bills
  after insert or update or delete on public.electricity_bills
  for each row execute function public.audit_trigger_func();

-- 3. Allow Admin delete on empty flats/rooms (FK on delete restrict prevents deleting flats/rooms with children)
drop policy if exists "Admin can delete flats" on public.flats;
create policy "Admin can delete flats"
  on public.flats for delete
  using (public.get_my_role() = 'admin');

drop policy if exists "Admin can delete rooms" on public.rooms;
create policy "Admin can delete rooms"
  on public.rooms for delete
  using (public.get_my_role() = 'admin');

-- 4. Helper View: v_audit_log_overview (respects underlying RLS on audit_log = Admin only)
create or replace view public.v_audit_log_overview
with (security_invoker = true)
as
select
  al.id,
  al.actor_id,
  p.full_name as actor_name,
  p.email as actor_email,
  p.role as actor_role,
  al.action,
  al.table_name,
  al.record_id,
  al.old_data,
  al.new_data,
  al.created_at
from public.audit_log al
left join public.profiles p on al.actor_id = p.id
order by al.created_at desc, al.id desc;

grant select on public.v_audit_log_overview to authenticated;
