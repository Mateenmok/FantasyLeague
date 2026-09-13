-- Apply the commissioner's corrected season values, including existing pick costs.
-- Lock rooms first, as pick submission does, so totals change between picks.
select room_key from public.flash_family_draft_rooms
where room_key in ('main', 'test') order by room_key for update;

update public.flash_family_draft_pool as pool
set point_value = correction.points,
    default_point_value = correction.points
from (values ('eelektross', 5), ('malamar', 4), ('falinks', 3)) as correction(slug, points)
where pool.pokemon_slug = correction.slug;

update public.flash_family_live_draft_picks as pick
set point_value = pool.point_value
from public.flash_family_draft_pool as pool
where pick.pokemon_slug = pool.pokemon_slug
  and pool.pokemon_slug in ('eelektross', 'malamar', 'falinks');

update public.flash_family_draft_rooms
set revision = revision + 1, updated_at = now()
where room_key in ('main', 'test');
