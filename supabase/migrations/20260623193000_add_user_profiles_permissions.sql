create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null default '',
  display_name text not null default '',
  avatar_url text not null default '',
  email text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  cpf text not null default '',
  birth_date date,
  address text not null default '',
  city text not null default '',
  state text not null default '',
  zip_code text not null default '',
  role text not null default 'viewer',
  department text not null default '',
  hierarchy_level integer not null default 10,
  access_level text not null default 'viewer',
  employment_type text not null default '',
  status text not null default 'active',
  start_date date,
  end_date date,
  supervisor_id uuid references public.profiles(id) on delete set null,
  weekly_hours numeric(6, 2) not null default 0,
  internal_hourly_rate numeric(12, 2) not null default 0,
  monthly_cost numeric(12, 2) not null default 0,
  productive_hours_goal numeric(8, 2) not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  last_login_at timestamptz
);

alter table public.profiles add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists display_name text not null default '';
alter table public.profiles add column if not exists avatar_url text not null default '';
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists whatsapp text not null default '';
alter table public.profiles add column if not exists cpf text not null default '';
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists address text not null default '';
alter table public.profiles add column if not exists city text not null default '';
alter table public.profiles add column if not exists state text not null default '';
alter table public.profiles add column if not exists zip_code text not null default '';
alter table public.profiles add column if not exists role text not null default 'viewer';
alter table public.profiles add column if not exists department text not null default '';
alter table public.profiles add column if not exists hierarchy_level integer not null default 10;
alter table public.profiles add column if not exists access_level text not null default 'viewer';
alter table public.profiles add column if not exists employment_type text not null default '';
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists start_date date;
alter table public.profiles add column if not exists end_date date;
alter table public.profiles add column if not exists supervisor_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists weekly_hours numeric(6, 2) not null default 0;
alter table public.profiles add column if not exists internal_hourly_rate numeric(12, 2) not null default 0;
alter table public.profiles add column if not exists monthly_cost numeric(12, 2) not null default 0;
alter table public.profiles add column if not exists productive_hours_goal numeric(8, 2) not null default 0;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.profiles add column if not exists last_login_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_auth_user_id_key'
  ) then
    alter table public.profiles
      add constraint profiles_auth_user_id_key unique (auth_user_id);
  end if;
end $$;

update public.profiles
set
  email = lower(email),
  role = case when role = '' then 'viewer' else lower(role) end,
  access_level = case when access_level = '' then 'viewer' else lower(access_level) end,
  status = case when status = '' then 'active' else lower(status) end;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('super_admin', 'admin', 'manager', 'finance', 'commercial', 'production', 'designer', 'viewer'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_access_level_check'
  ) then
    alter table public.profiles
      add constraint profiles_access_level_check
      check (access_level in ('super_admin', 'admin', 'manager', 'finance', 'commercial', 'production', 'designer', 'viewer'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_status_check
      check (status in ('active', 'inactive', 'pending'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_hierarchy_level_check'
  ) then
    alter table public.profiles
      add constraint profiles_hierarchy_level_check
      check (hierarchy_level >= 0 and hierarchy_level <= 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_costs_nonnegative_check'
  ) then
    alter table public.profiles
      add constraint profiles_costs_nonnegative_check
      check (
        weekly_hours >= 0
        and internal_hourly_rate >= 0
        and monthly_cost >= 0
        and productive_hours_goal >= 0
      );
  end if;
end $$;

create index if not exists profiles_auth_user_id_idx on public.profiles (auth_user_id);
create index if not exists profiles_email_lower_idx on public.profiles (lower(email));
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_access_level_idx on public.profiles (access_level);
create index if not exists profiles_hierarchy_level_idx on public.profiles (hierarchy_level);
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_supervisor_id_idx on public.profiles (supervisor_id);

create or replace function public.touch_profiles_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row
  execute function public.touch_profiles_updated_at();

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users
    where users.id = (select auth.uid())
      and lower(users.email) in ('davidraksa@live.com', 'omateusosos@gmail.com')
  )
  or exists (
    select 1
    from public.profiles
    where profiles.auth_user_id = (select auth.uid())
      and profiles.status = 'active'
      and (
        profiles.role = 'super_admin'
        or profiles.access_level = 'super_admin'
        or profiles.hierarchy_level >= 100
      )
  );
$$;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.admin_users where user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.profiles
      where profiles.auth_user_id = (select auth.uid())
        and profiles.status = 'active'
        and (
          profiles.role = 'admin'
          or profiles.access_level = 'admin'
          or profiles.hierarchy_level >= 90
        )
    );
$$;

create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if old.auth_user_id is distinct from new.auth_user_id
    or old.role is distinct from new.role
    or old.department is distinct from new.department
    or old.hierarchy_level is distinct from new.hierarchy_level
    or old.access_level is distinct from new.access_level
    or old.employment_type is distinct from new.employment_type
    or old.status is distinct from new.status
    or old.start_date is distinct from new.start_date
    or old.end_date is distinct from new.end_date
    or old.supervisor_id is distinct from new.supervisor_id
    or old.weekly_hours is distinct from new.weekly_hours
    or old.internal_hourly_rate is distinct from new.internal_hourly_rate
    or old.monthly_cost is distinct from new.monthly_cost
    or old.productive_hours_goal is distinct from new.productive_hours_goal
    or old.created_at is distinct from new.created_at
    or old.created_by is distinct from new.created_by
    or old.updated_by is distinct from new.updated_by then
    raise exception 'Apenas super_admin pode alterar hierarquia, cargo, permissões ou custos internos.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_self_update on public.profiles;
create trigger profiles_guard_self_update
  before update on public.profiles
  for each row
  execute function public.guard_profile_self_update();

insert into public.profiles (
  auth_user_id,
  full_name,
  display_name,
  email,
  role,
  hierarchy_level,
  access_level,
  status,
  created_by,
  updated_by
)
select
  users.id,
  coalesce(users.raw_user_meta_data->>'full_name', users.raw_user_meta_data->>'name', split_part(users.email, '@', 1)),
  coalesce(users.raw_user_meta_data->>'name', users.raw_user_meta_data->>'full_name', split_part(users.email, '@', 1)),
  lower(users.email),
  'super_admin',
  100,
  'super_admin',
  'active',
  users.id,
  users.id
from auth.users
where lower(users.email) in ('davidraksa@live.com', 'omateusosos@gmail.com')
on conflict (auth_user_id) do update
set
  email = excluded.email,
  role = 'super_admin',
  hierarchy_level = 100,
  access_level = 'super_admin',
  status = 'active',
  updated_at = now(),
  updated_by = excluded.updated_by;

insert into public.admin_users (user_id)
select users.id
from auth.users
where lower(users.email) in ('davidraksa@live.com', 'omateusosos@gmail.com')
on conflict (user_id) do nothing;

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile and super admins read all profiles" on public.profiles;
drop policy if exists "Super admins can create profiles" on public.profiles;
drop policy if exists "Users can update own basic profile and super admins update all profiles" on public.profiles;
drop policy if exists "Super admins can delete profiles" on public.profiles;

create policy "Users can read own profile and super admins read all profiles"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = auth_user_id or public.is_super_admin());

create policy "Super admins can create profiles"
  on public.profiles for insert to authenticated
  with check (public.is_super_admin());

create policy "Users can update own basic profile and super admins update all profiles"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = auth_user_id or public.is_super_admin())
  with check ((select auth.uid()) = auth_user_id or public.is_super_admin());

create policy "Super admins can delete profiles"
  on public.profiles for delete to authenticated
  using (public.is_super_admin());

revoke all privileges on table public.profiles from anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
