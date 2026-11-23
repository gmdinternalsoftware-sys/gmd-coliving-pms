-- =============================================================================
-- GMD Co-living PMS: Phase 7 — Reports, Analytics & Excel Export Views
-- =============================================================================

-- 1. Helper View: v_flat_occupancy_report
create or replace view public.v_flat_occupancy_report
with (security_invoker = true)
as
select 
  f.id as flat_id,
  f.name as flat_name,
  f.address as flat_address,
  f.is_active,
  count(distinct r.id) as total_rooms,
  count(b.id) as total_beds,
  count(b.id) filter (where b.status = 'occupied') as occupied_beds,
  count(b.id) filter (where b.status = 'vacant') as vacant_beds,
  count(b.id) filter (where b.status = 'reserved') as reserved_beds,
  count(b.id) filter (where b.status = 'notice') as notice_beds,
  count(b.id) filter (where b.status = 'blocked') as blocked_beds,
  case 
    when count(b.id) > 0 then round((count(b.id) filter (where b.status = 'occupied')::numeric / count(b.id)::numeric) * 100, 1)
    else 0
  end as occupancy_rate,
  coalesce(sum(b.base_price), 0) as potential_revenue,
  coalesce(sum(b.base_price) filter (where b.status = 'occupied'), 0) as current_occupied_revenue
from public.flats f
left join public.rooms r on f.id = r.flat_id and r.is_active = true
left join public.beds b on r.id = b.room_id
where f.is_active = true
group by f.id, f.name, f.address, f.is_active;

-- Grant permissions to authenticated
grant select on public.v_flat_occupancy_report to authenticated;

-- 2. Audit trigger logging for report downloads
comment on view public.v_flat_occupancy_report is 'Aggregated occupancy and inventory metrics per property';
