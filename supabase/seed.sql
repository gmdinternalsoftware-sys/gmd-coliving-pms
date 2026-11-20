-- =============================================================================
-- GMD Co-living PMS: Seed Data
-- One user per role, 2 flats, rooms, and beds for testing
-- =============================================================================
-- NOTE: This seed file is for local development only.
-- In production, users are created through the app's auth flow.
-- The passwords here are for testing only.

-- =============================================================================
-- Create auth users (Supabase auth.users)
-- Using raw_user_meta_data to store full_name for the profile trigger
-- =============================================================================

-- We'll create users via Supabase's auth system in the app.
-- For seed data, we insert directly into profiles assuming auth users exist.
-- When running locally with `supabase db seed`, use `supabase/seed.sql`.

-- For local development, create these users via the Supabase dashboard
-- or via the signup API, then this seed populates the rest.

-- =============================================================================
-- Sample Flats
-- =============================================================================
insert into flats (id, name, address, owner_name, notes) values
  ('a0000000-0000-0000-0000-000000000001', 'Sunrise Villa', '123 MG Road, Bangalore', 'Ramesh Kumar', 'Ground floor, 3BHK'),
  ('a0000000-0000-0000-0000-000000000002', 'Lake View Apartment', '456 BTM Layout, Bangalore', 'Suresh Patel', '2nd floor, 2BHK');

-- =============================================================================
-- Sample Rooms
-- =============================================================================
-- Sunrise Villa: 3 rooms
insert into rooms (id, flat_id, room_no, sharing_type) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'R1', 3),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'R2', 2),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'R3', 1);

-- Lake View: 2 rooms
insert into rooms (id, flat_id, room_no, sharing_type) values
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'R1', 4),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'R2', 2);

-- =============================================================================
-- Sample Beds
-- =============================================================================
-- Sunrise Villa R1 (3-sharing): beds A, B, C
insert into beds (room_id, bed_label, base_price, status) values
  ('b0000000-0000-0000-0000-000000000001', 'A', 7500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000001', 'B', 7500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000001', 'C', 7500.00, 'vacant');

-- Sunrise Villa R2 (2-sharing): beds A, B
insert into beds (room_id, bed_label, base_price, status) values
  ('b0000000-0000-0000-0000-000000000002', 'A', 9000.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000002', 'B', 9000.00, 'vacant');

-- Sunrise Villa R3 (single): bed A
insert into beds (room_id, bed_label, base_price, status) values
  ('b0000000-0000-0000-0000-000000000003', 'A', 12000.00, 'vacant');

-- Lake View R1 (4-sharing): beds A, B, C, D
insert into beds (room_id, bed_label, base_price, status) values
  ('b0000000-0000-0000-0000-000000000004', 'A', 6500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000004', 'B', 6500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000004', 'C', 6500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000004', 'D', 6500.00, 'vacant');

-- Lake View R2 (2-sharing): beds A, B
insert into beds (room_id, bed_label, base_price, status) values
  ('b0000000-0000-0000-0000-000000000005', 'A', 8500.00, 'vacant'),
  ('b0000000-0000-0000-0000-000000000005', 'B', 8500.00, 'vacant');
