-- Happy Feed Journal schema: profiles, families, members, babies, feedings.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table if not exists public.babies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null,
  birthdate date,
  avatar_emoji text not null default '👶',
  created_at timestamptz not null default now()
);

create table if not exists public.feedings (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  kind text not null check (kind in ('breast', 'formula', 'solid', 'snack')),
  food text not null default '',
  amount numeric,
  unit text not null default '',
  fed_at timestamptz not null default now(),
  notes text not null default '',
  source text not null default 'manual' check (source in ('voice', 'manual')),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists feedings_baby_fed_at_idx
  on public.feedings (baby_id, fed_at desc);
create index if not exists babies_family_idx on public.babies (family_id);
create index if not exists family_members_user_idx on public.family_members (user_id);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER avoids RLS recursion on family_members)
-- ---------------------------------------------------------------------------
create or replace function public.is_family_member(_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = _family_id and user_id = auth.uid()
  );
$$;

create or replace function public.can_access_baby(_baby_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.babies b
    join public.family_members fm on fm.family_id = b.family_id
    where b.id = _baby_id and fm.user_id = auth.uid()
  );
$$;

-- Atomically create a family and add the caller as owner.
create or replace function public.create_family(_name text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  fam public.families;
begin
  insert into public.families (name, created_by)
  values (_name, auth.uid())
  returning * into fam;

  insert into public.family_members (family_id, user_id, role)
  values (fam.id, auth.uid(), 'owner');

  return fam;
end;
$$;

-- Join an existing family by its id (the id doubles as an invite code).
create or replace function public.join_family(_family_id uuid)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  fam public.families;
begin
  insert into public.family_members (family_id, user_id, role)
  values (_family_id, auth.uid(), 'member')
  on conflict do nothing;

  select * into fam from public.families where id = _family_id;
  return fam;
end;
$$;

-- Create a profile row automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Table privileges (row access is further restricted by RLS below)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.families,
  public.family_members,
  public.babies,
  public.feedings
  to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.babies enable row level security;
alter table public.feedings enable row level security;

-- profiles: any authenticated user can read display names; you manage your own.
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- families: visible to members; created by self; deletable by creator.
create policy "families_select" on public.families
  for select to authenticated using (public.is_family_member(id));
create policy "families_insert" on public.families
  for insert to authenticated with check (created_by = auth.uid());
create policy "families_update" on public.families
  for update to authenticated using (public.is_family_member(id))
  with check (public.is_family_member(id));
create policy "families_delete" on public.families
  for delete to authenticated using (created_by = auth.uid());

-- family_members: see your memberships and co-members; join yourself or add others.
create policy "family_members_select" on public.family_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_family_member(family_id));
create policy "family_members_insert" on public.family_members
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_family_member(family_id));
create policy "family_members_delete" on public.family_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_family_member(family_id));

-- babies: scoped to the family.
create policy "babies_select" on public.babies
  for select to authenticated using (public.is_family_member(family_id));
create policy "babies_insert" on public.babies
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "babies_update" on public.babies
  for update to authenticated using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
create policy "babies_delete" on public.babies
  for delete to authenticated using (public.is_family_member(family_id));

-- feedings: scoped to the baby's family.
create policy "feedings_select" on public.feedings
  for select to authenticated using (public.can_access_baby(baby_id));
create policy "feedings_insert" on public.feedings
  for insert to authenticated
  with check (public.can_access_baby(baby_id) and created_by = auth.uid());
create policy "feedings_update" on public.feedings
  for update to authenticated using (public.can_access_baby(baby_id))
  with check (public.can_access_baby(baby_id));
create policy "feedings_delete" on public.feedings
  for delete to authenticated using (public.can_access_baby(baby_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.feedings;
alter publication supabase_realtime add table public.babies;
