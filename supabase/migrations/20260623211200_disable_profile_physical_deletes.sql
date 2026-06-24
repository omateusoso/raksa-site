drop policy if exists "Super admins can delete profiles" on public.profiles;
drop policy if exists "Managers can delete profiles" on public.profiles;

revoke delete on table public.profiles from authenticated;
