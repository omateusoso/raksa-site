create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_super_admin()
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

revoke all on function private.is_super_admin() from public, anon;
grant execute on function private.is_super_admin() to authenticated;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.is_super_admin();
$$;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

create index if not exists profiles_created_by_idx on public.profiles (created_by);
create index if not exists profiles_updated_by_idx on public.profiles (updated_by);
