alter table public.time_entries
  add column if not exists hourly_rate numeric(12, 2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.time_entries'::regclass
      and conname = 'time_entries_hourly_rate_nonnegative_check'
  ) then
    alter table public.time_entries
      add constraint time_entries_hourly_rate_nonnegative_check
      check (hourly_rate >= 0);
  end if;
end $$;
