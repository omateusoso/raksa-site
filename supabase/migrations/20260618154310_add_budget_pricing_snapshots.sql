alter table public.budgets add column if not exists quantity numeric(12, 2) not null default 0;
alter table public.budgets add column if not exists pricing_snapshot jsonb not null default '{}'::jsonb;
alter table public.budgets add column if not exists hourly_rate_snapshot numeric(12, 2) not null default 0;
alter table public.budgets add column if not exists markup_percent_snapshot numeric(7, 4) not null default 0;
alter table public.budgets add column if not exists tax_percent_snapshot numeric(7, 4) not null default 0;
alter table public.budgets add column if not exists labor_hours_snapshot numeric(12, 2) not null default 0;
alter table public.budgets add column if not exists labor_cost_snapshot numeric(12, 2) not null default 0;
alter table public.budgets add column if not exists substrate_cost_snapshot numeric(12, 2) not null default 0;
alter table public.budgets add column if not exists subtotal_snapshot numeric(12, 2) not null default 0;
alter table public.budgets add column if not exists markup_amount_snapshot numeric(12, 2) not null default 0;
alter table public.budgets add column if not exists tax_amount_snapshot numeric(12, 2) not null default 0;
alter table public.budgets add column if not exists total_snapshot numeric(12, 2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.budgets'::regclass and conname = 'budgets_pricing_snapshot_object_check'
  ) then
    alter table public.budgets
      add constraint budgets_pricing_snapshot_object_check
      check (jsonb_typeof(pricing_snapshot) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.budgets'::regclass and conname = 'budgets_pricing_snapshots_nonnegative_check'
  ) then
    alter table public.budgets
      add constraint budgets_pricing_snapshots_nonnegative_check
      check (
        quantity >= 0
        and hourly_rate_snapshot >= 0
        and markup_percent_snapshot >= 0
        and tax_percent_snapshot >= 0
        and labor_hours_snapshot >= 0
        and labor_cost_snapshot >= 0
        and substrate_cost_snapshot >= 0
        and subtotal_snapshot >= 0
        and markup_amount_snapshot >= 0
        and tax_amount_snapshot >= 0
        and total_snapshot >= 0
      );
  end if;
end $$;
