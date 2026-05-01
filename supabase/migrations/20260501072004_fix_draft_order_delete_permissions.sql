grant select, insert, update, delete on public.league_draft_order to authenticated;
grant usage, select on sequence public.league_draft_order_id_seq to authenticated;

drop policy if exists "Authenticated users can read draft order" on public.league_draft_order;
drop policy if exists "Authenticated users can create draft order" on public.league_draft_order;
drop policy if exists "Authenticated users can update draft order" on public.league_draft_order;
drop policy if exists "Authenticated users can delete draft order" on public.league_draft_order;

create policy "Authenticated users can read draft order"
on public.league_draft_order
for select
to authenticated
using (true);

create policy "Authenticated users can create draft order"
on public.league_draft_order
for insert
to authenticated
with check (true);

create policy "Authenticated users can update draft order"
on public.league_draft_order
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete draft order"
on public.league_draft_order
for delete
to authenticated
using (true);
