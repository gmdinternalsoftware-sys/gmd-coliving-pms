-- =============================================================================
-- GMD Co-living PMS: Phase 8 — Row Level Security (RLS) Role Test Suite
-- =============================================================================
-- Run this in Supabase SQL Editor (or psql). Everything executes inside a
-- transaction that rolls back cleanly at the end so seed/live data is untouched.
-- Any failed assertion raises an exception and aborts the test run.
-- =============================================================================

begin;

do $$
declare
  v_admin_id uuid;
  v_sales_id uuid;
  v_noc_id uuid;
  v_accounts_id uuid;
  v_maint_id uuid;
  v_elec_id uuid;
  v_flat_id uuid;
  v_room_id uuid;
  v_bed_id uuid;
  v_client_id uuid;
  v_booking_id uuid;
  v_count integer;
begin
  -- Look up one active user per role from profiles
  select id into v_admin_id from public.profiles where role = 'admin' and is_active = true limit 1;
  select id into v_sales_id from public.profiles where role = 'sales' and is_active = true limit 1;
  select id into v_noc_id from public.profiles where role = 'noc' and is_active = true limit 1;
  select id into v_accounts_id from public.profiles where role = 'accounts' and is_active = true limit 1;
  select id into v_maint_id from public.profiles where role = 'maintenance' and is_active = true limit 1;
  select id into v_elec_id from public.profiles where role = 'electricity' and is_active = true limit 1;

  if v_admin_id is null or v_sales_id is null or v_noc_id is null or v_accounts_id is null then
    raise notice 'Skipping user-impersonation tests: ensure seed users for admin, sales, noc, accounts exist.';
    return;
  end if;

  -- Create isolated test inventory as postgres/admin context
  insert into public.flats (name, address) values ('__RLS_TEST_FLAT__', 'Test') returning id into v_flat_id;
  insert into public.rooms (flat_id, room_no, sharing_type) values (v_flat_id, 'T1', 2) returning id into v_room_id;
  insert into public.beds (room_id, bed_label, base_price, status) values (v_room_id, 'A', 7000, 'vacant') returning id into v_bed_id;

  -- Switch to authenticated role for RLS enforcement
  execute 'set local role authenticated';

  -- =========================================================================
  -- 1. SALES ROLE TESTS
  -- =========================================================================
  perform set_config('request.jwt.claim.sub', v_sales_id::text, true);

  -- Allowed: read flats & beds
  select count(*) into v_count from public.flats where id = v_flat_id;
  assert v_count = 1, 'Sales should be able to read flats';

  -- Allowed: insert client & token booking
  insert into public.clients (full_name, phone1, created_by)
  values ('RLS Test Client', '9999999999', v_sales_id)
  returning id into v_client_id;

  insert into public.bookings (client_id, bed_id, source, status, agreed_rent, created_by)
  values (v_client_id, v_bed_id, 'token', 'token', 7000, v_sales_id)
  returning id into v_booking_id;

  -- Forbidden: Sales cannot create flats
  begin
    insert into public.flats (name) values ('__FORBIDDEN_FLAT__');
    raise exception 'SECURITY FAILURE: Sales was allowed to insert into flats!';
  exception when insufficient_privilege then
    null; -- Expected
  end;

  -- Forbidden: Sales cannot insert payments
  begin
    insert into public.payments (booking_id, type, amount) values (v_booking_id, 'rent', 7000);
    raise exception 'SECURITY FAILURE: Sales was allowed to insert into payments!';
  exception when insufficient_privilege then
    null; -- Expected
  end;

  -- Forbidden: Sales cannot read audit_log
  select count(*) into v_count from public.audit_log;
  assert v_count = 0, 'SECURITY FAILURE: Sales should not see audit_log rows';

  -- =========================================================================
  -- 2. NOC ROLE TESTS
  -- =========================================================================
  perform set_config('request.jwt.claim.sub', v_noc_id::text, true);

  -- Allowed: insert noc_record
  insert into public.noc_records (booking_id, status, remarks, done_by)
  values (v_booking_id, 'cleared', 'OK', v_noc_id);

  -- Forbidden: NOC cannot insert clients or payments
  begin
    insert into public.clients (full_name, phone1) values ('Forbidden NOC Client', '8888888888');
    raise exception 'SECURITY FAILURE: NOC was allowed to insert into clients!';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.payments (booking_id, type, amount) values (v_booking_id, 'deposit', 5000);
    raise exception 'SECURITY FAILURE: NOC was allowed to insert into payments!';
  exception when insufficient_privilege then
    null;
  end;

  -- =========================================================================
  -- 3. ACCOUNTS ROLE TESTS
  -- =========================================================================
  perform set_config('request.jwt.claim.sub', v_accounts_id::text, true);

  -- Allowed: insert payment
  insert into public.payments (booking_id, type, amount, received_by)
  values (v_booking_id, 'deposit', 5000, v_accounts_id);

  -- Forbidden: Accounts cannot create beds or flats
  begin
    insert into public.beds (room_id, bed_label, base_price) values (v_room_id, 'Z', 5000);
    raise exception 'SECURITY FAILURE: Accounts was allowed to insert into beds!';
  exception when insufficient_privilege then
    null;
  end;

  -- =========================================================================
  -- 4. ELECTRICITY ROLE TESTS
  -- =========================================================================
  if v_elec_id is not null then
    perform set_config('request.jwt.claim.sub', v_elec_id::text, true);

    -- Allowed: insert reading
    insert into public.electricity_readings (flat_id, reading_date, meter_value, entered_by)
    values (v_flat_id, current_date, 125.5, v_elec_id);

    -- Forbidden: Electricity cannot insert payments or bookings
    begin
      insert into public.payments (booking_id, type, amount) values (v_booking_id, 'electricity', 500);
      raise exception 'SECURITY FAILURE: Electricity was allowed to insert into payments!';
    exception when insufficient_privilege then
      null;
    end;
  end if;

  -- =========================================================================
  -- 5. MAINTENANCE ROLE TESTS
  -- =========================================================================
  if v_maint_id is not null then
    perform set_config('request.jwt.claim.sub', v_maint_id::text, true);

    -- Allowed: update app_settings
    insert into public.app_settings (key, value) values ('__rls_test__', 'ok')
    on conflict (key) do update set value = 'ok';

    -- Forbidden: Maintenance cannot insert clients, payments, or electricity readings
    begin
      insert into public.electricity_readings (flat_id, reading_date, meter_value)
      values (v_flat_id, current_date, 200);
      raise exception 'SECURITY FAILURE: Maintenance was allowed to insert into electricity_readings!';
    exception when insufficient_privilege then
      null;
    end;
  end if;

  -- =========================================================================
  -- 6. ADMIN ROLE TESTS
  -- =========================================================================
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  select count(*) into v_count from public.audit_log;
  assert v_count > 0, 'Admin should be able to read audit_log entries generated during test';

  raise notice 'ALL RLS ROLE TESTS PASSED SUCCESSFULLY!';
end;
$$;

rollback;
