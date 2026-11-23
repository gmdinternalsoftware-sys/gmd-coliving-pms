-- =============================================================================
-- GMD Co-living PMS: Maintenance Complaints & System Settings
-- =============================================================================

create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- Audit logging trigger
drop trigger if exists trg_audit_app_settings on public.app_settings;
create trigger trg_audit_app_settings
  after insert or update or delete on public.app_settings
  for each row execute function public.audit_trigger_func();

-- RLS
alter table public.app_settings enable row level security;

-- All active employees can view settings (e.g. maintenance complaints sheet URL)
drop policy if exists "Active profiles can read app_settings" on public.app_settings;
create policy "Active profiles can read app_settings"
  on public.app_settings for select
  using (public.is_active_profile());

-- Only admin and maintenance personnel can update or insert settings
drop policy if exists "Admin and maintenance can insert app_settings" on public.app_settings;
create policy "Admin and maintenance can insert app_settings"
  on public.app_settings for insert
  with check (public.get_my_role() in ('admin', 'maintenance'));

drop policy if exists "Admin and maintenance can update app_settings" on public.app_settings;
create policy "Admin and maintenance can update app_settings"
  on public.app_settings for update
  using (public.get_my_role() in ('admin', 'maintenance'));

-- Default setting for maintenance Google Sheet / Form
insert into public.app_settings (key, value, description)
values (
  'maintenance_google_sheet_url',
  'https://docs.google.com/spreadsheets/d/157_rS0_yUSHnTWur9qebP9-CDFqI2_IL_YjLCe1YMbI/edit?usp=sharing',
  'URL of the shared Google Sheet or Form for Maintenance Complaints tracking'
)
on conflict (key) do nothing;
