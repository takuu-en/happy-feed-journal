-- Richer feeding records:
--   * formula: brand + scoops
--   * breast: left/right breast durations
--   * solids: multiple food items per meal, each with amount + unit (g/ml)

-- ---------------------------------------------------------------------------
-- Kind-specific columns on feedings
-- ---------------------------------------------------------------------------
alter table public.feedings
  add column if not exists brand text not null default '',
  add column if not exists scoops numeric,
  add column if not exists left_duration_min numeric,
  add column if not exists right_duration_min numeric;

-- ---------------------------------------------------------------------------
-- Per-item rows for a solid/snack meal (e.g. "banana 50g", "rice 30ml")
-- ---------------------------------------------------------------------------
create table if not exists public.feeding_items (
  id uuid primary key default gen_random_uuid(),
  feeding_id uuid not null references public.feedings (id) on delete cascade,
  food text not null default '',
  amount numeric,
  unit text not null default 'g',
  created_at timestamptz not null default now()
);

create index if not exists feeding_items_feeding_idx
  on public.feeding_items (feeding_id);

grant select, insert, update, delete on public.feeding_items to authenticated;

-- ---------------------------------------------------------------------------
-- Access helper + RLS for feeding_items (scoped via the parent feeding's baby)
-- ---------------------------------------------------------------------------
create or replace function public.can_access_feeding(_feeding_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.feedings f
    join public.babies b on b.id = f.baby_id
    join public.family_members fm on fm.family_id = b.family_id
    where f.id = _feeding_id and fm.user_id = auth.uid()
  );
$$;

alter table public.feeding_items enable row level security;

create policy "feeding_items_select" on public.feeding_items
  for select to authenticated using (public.can_access_feeding(feeding_id));
create policy "feeding_items_insert" on public.feeding_items
  for insert to authenticated with check (public.can_access_feeding(feeding_id));
create policy "feeding_items_update" on public.feeding_items
  for update to authenticated using (public.can_access_feeding(feeding_id))
  with check (public.can_access_feeding(feeding_id));
create policy "feeding_items_delete" on public.feeding_items
  for delete to authenticated using (public.can_access_feeding(feeding_id));

-- ---------------------------------------------------------------------------
-- Atomically create a feeding plus its items, enforcing access + ownership.
-- ---------------------------------------------------------------------------
create or replace function public.create_feeding(
  _baby_id uuid,
  _kind text,
  _food text default '',
  _amount numeric default null,
  _unit text default '',
  _notes text default '',
  _source text default 'manual',
  _brand text default '',
  _scoops numeric default null,
  _left_duration_min numeric default null,
  _right_duration_min numeric default null,
  _fed_at timestamptz default null,
  _items jsonb default '[]'::jsonb
)
returns public.feedings
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.feedings;
  itm jsonb;
begin
  if not public.can_access_baby(_baby_id) then
    raise exception 'Not allowed to add feedings for this baby';
  end if;

  insert into public.feedings (
    baby_id, kind, food, amount, unit, notes, source,
    brand, scoops, left_duration_min, right_duration_min, fed_at, created_by
  )
  values (
    _baby_id, _kind, _food, _amount, _unit, _notes, _source,
    _brand, _scoops, _left_duration_min, _right_duration_min,
    coalesce(_fed_at, now()), auth.uid()
  )
  returning * into f;

  for itm in select * from jsonb_array_elements(coalesce(_items, '[]'::jsonb))
  loop
    insert into public.feeding_items (feeding_id, food, amount, unit)
    values (
      f.id,
      coalesce(itm ->> 'food', ''),
      nullif(itm ->> 'amount', '')::numeric,
      coalesce(nullif(itm ->> 'unit', ''), 'g')
    );
  end loop;

  return f;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.feeding_items;
