alter table public.substrates add column if not exists acquisition_type text not null default 'unit_cost';
alter table public.substrates add column if not exists cost_amount numeric(12, 2) not null default 0;
alter table public.substrates add column if not exists cost_unit text not null default 'unidade';
alter table public.substrates add column if not exists pass_through_method text not null default 'none';
alter table public.substrates add column if not exists fixed_pass_through_amount numeric(12, 2) not null default 0;
alter table public.substrates add column if not exists pass_through_percent numeric(7, 4) not null default 0;
alter table public.substrates add column if not exists allocation_quantity numeric(12, 2) not null default 0;
alter table public.substrates add column if not exists updated_at timestamptz not null default now();

update public.substrates
set
  cost_amount = coalesce(nullif(cost_amount, 0), unit_cost, 0),
  cost_unit = coalesce(nullif(cost_unit, ''), nullif(unit, ''), 'unidade'),
  acquisition_type = case
    when acquisition_type in ('monthly_subscription', 'annual_subscription', 'permanent_license', 'one_time_purchase', 'unit_cost', 'free')
      then acquisition_type
    else 'unit_cost'
  end,
  pass_through_method = case
    when pass_through_method in ('none', 'full', 'fixed', 'percent', 'allocated', 'per_unit')
      then pass_through_method
    else 'none'
  end
where true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.substrates'::regclass and conname = 'substrates_acquisition_type_check'
  ) then
    alter table public.substrates
      add constraint substrates_acquisition_type_check
      check (acquisition_type in ('monthly_subscription', 'annual_subscription', 'permanent_license', 'one_time_purchase', 'unit_cost', 'free'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.substrates'::regclass and conname = 'substrates_pass_through_method_check'
  ) then
    alter table public.substrates
      add constraint substrates_pass_through_method_check
      check (pass_through_method in ('none', 'full', 'fixed', 'percent', 'allocated', 'per_unit'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.substrates'::regclass and conname = 'substrates_cost_rules_nonnegative_check'
  ) then
    alter table public.substrates
      add constraint substrates_cost_rules_nonnegative_check
      check (
        cost_amount >= 0
        and fixed_pass_through_amount >= 0
        and pass_through_percent >= 0
        and allocation_quantity >= 0
      );
  end if;
end $$;

create or replace function public.touch_substrates_updated_at()
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

drop trigger if exists substrates_touch_updated_at on public.substrates;
create trigger substrates_touch_updated_at
  before update on public.substrates
  for each row
  execute function public.touch_substrates_updated_at();
