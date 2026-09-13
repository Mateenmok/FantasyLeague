update public.flash_family_draft_rooms
set scheduled_at = null,
    revision = revision + 1,
    updated_at = now()
where room_key = 'main';
