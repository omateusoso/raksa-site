alter table public.profiles add column if not exists internal_notes text not null default '';

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'inactive', 'suspended', 'pending'));

create index if not exists profiles_email_idx on public.profiles (email);

create or replace function private.can_manage_users()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_super_admin()
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

revoke all on function private.can_manage_users() from public, anon;
grant execute on function private.can_manage_users() to authenticated;

create or replace function public.can_manage_users()
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.can_manage_users();
$$;

revoke all on function public.can_manage_users() from public, anon;
grant execute on function public.can_manage_users() to authenticated;

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

  if public.can_manage_users() then
    if lower(old.email) in ('davidraksa@live.com', 'omateusosos@gmail.com')
      and (
        old.role is distinct from new.role
        or old.hierarchy_level is distinct from new.hierarchy_level
        or old.access_level is distinct from new.access_level
        or old.status is distinct from new.status
      ) then
      raise exception 'Somente super_admin pode alterar o acesso raiz deste usuário.';
    end if;

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
    or old.internal_notes is distinct from new.internal_notes
    or old.created_at is distinct from new.created_at
    or old.created_by is distinct from new.created_by
    or old.updated_by is distinct from new.updated_by then
    raise exception 'Apenas usuários autorizados podem alterar hierarquia, cargo, permissões ou custos internos.';
  end if;

  return new;
end;
$$;

drop policy if exists "Users can read own profile and super admins read all profiles" on public.profiles;
drop policy if exists "Super admins can create profiles" on public.profiles;
drop policy if exists "Users can update own basic profile and super admins update all profiles" on public.profiles;
drop policy if exists "Super admins can delete profiles" on public.profiles;
drop policy if exists "Users can read own profile and managers read all profiles" on public.profiles;
drop policy if exists "Managers can create profiles" on public.profiles;
drop policy if exists "Users can update own basic profile and managers update profiles" on public.profiles;
drop policy if exists "Managers can delete profiles" on public.profiles;

create policy "Users can read own profile and managers read all profiles"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = auth_user_id or public.can_manage_users());

create policy "Managers can create profiles"
  on public.profiles for insert to authenticated
  with check (public.can_manage_users());

create policy "Users can update own basic profile and managers update profiles"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = auth_user_id or public.can_manage_users())
  with check ((select auth.uid()) = auth_user_id or public.can_manage_users());

grant execute on function public.can_manage_users() to authenticated;
revoke delete on table public.profiles from authenticated;
grant select, insert, update on table public.profiles to authenticated;
