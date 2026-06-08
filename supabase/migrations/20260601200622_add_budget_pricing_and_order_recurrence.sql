alter table public.products add column if not exists pricing_model text not null default 'fixed';
alter table public.products add column if not exists hourly_rate numeric(12, 2) not null default 0;
alter table public.products add column if not exists default_substrate_ids jsonb not null default '[]'::jsonb;

alter table public.service_orders add column if not exists recurrence text not null default 'one_time';
alter table public.service_orders add column if not exists billing_cycle text not null default '';
alter table public.service_orders add column if not exists estimated_hours numeric(10, 2) not null default 0;
alter table public.service_orders add column if not exists hourly_rate numeric(12, 2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and conname = 'products_pricing_model_check'
  ) then
    alter table public.products
      add constraint products_pricing_model_check
      check (pricing_model in ('fixed', 'hourly', 'hybrid'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and conname = 'products_hourly_rate_nonnegative_check'
  ) then
    alter table public.products
      add constraint products_hourly_rate_nonnegative_check
      check (hourly_rate >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and conname = 'products_default_substrate_ids_array_check'
  ) then
    alter table public.products
      add constraint products_default_substrate_ids_array_check
      check (jsonb_typeof(default_substrate_ids) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_orders'::regclass and conname = 'service_orders_recurrence_check'
  ) then
    alter table public.service_orders
      add constraint service_orders_recurrence_check
      check (recurrence in ('one_time', 'biweekly', 'monthly', 'custom'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_orders'::regclass and conname = 'service_orders_estimates_nonnegative_check'
  ) then
    alter table public.service_orders
      add constraint service_orders_estimates_nonnegative_check
      check (estimated_hours >= 0 and hourly_rate >= 0);
  end if;
end $$;

create index if not exists products_pricing_model_idx on public.products (pricing_model);
create index if not exists service_orders_recurrence_idx on public.service_orders (recurrence);
