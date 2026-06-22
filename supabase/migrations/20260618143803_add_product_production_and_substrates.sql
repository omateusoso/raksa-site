alter table public.products add column if not exists production_unit text not null default 'unidade';
alter table public.products add column if not exists hours_per_unit numeric(10, 2) not null default 0;
alter table public.products add column if not exists default_quantity numeric(10, 2) not null default 1;
alter table public.products add column if not exists updated_at timestamptz not null default now();

update public.products
set
  production_unit = coalesce(nullif(production_unit, ''), 'unidade'),
  hours_per_unit = coalesce(nullif(hours_per_unit, 0), estimated_hours, 0),
  default_quantity = coalesce(nullif(default_quantity, 0), 1)
where true;

alter table public.products drop constraint if exists products_pricing_model_check;
alter table public.products
  add constraint products_pricing_model_check
  check (pricing_model in ('fixed', 'unit', 'hourly', 'hybrid'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and conname = 'products_production_fields_nonnegative_check'
  ) then
    alter table public.products
      add constraint products_production_fields_nonnegative_check
      check (hours_per_unit >= 0 and default_quantity >= 0);
  end if;
end $$;

create table if not exists public.product_substrates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  substrate_id uuid not null references public.substrates(id) on delete restrict,
  quantity numeric(12, 2) not null default 1,
  is_required boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_substrates'::regclass and conname = 'product_substrates_product_substrate_key'
  ) then
    alter table public.product_substrates
      add constraint product_substrates_product_substrate_key
      unique (product_id, substrate_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_substrates'::regclass and conname = 'product_substrates_quantity_check'
  ) then
    alter table public.product_substrates
      add constraint product_substrates_quantity_check
      check (quantity >= 0);
  end if;
end $$;

insert into public.product_substrates (
  product_id,
  substrate_id,
  quantity,
  is_required
)
select
  products.id,
  substrate_ids.value::uuid,
  1,
  true
from public.products
cross join lateral jsonb_array_elements_text(
  case
    when jsonb_typeof(products.default_substrate_ids) = 'array' then products.default_substrate_ids
    else '[]'::jsonb
  end
) as substrate_ids(value)
where substrate_ids.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.substrates
    where substrates.id = substrate_ids.value::uuid
  )
on conflict (product_id, substrate_id) do nothing;

create or replace function public.touch_products_updated_at()
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

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row
  execute function public.touch_products_updated_at();

create or replace function public.touch_product_substrates_updated_at()
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

drop trigger if exists product_substrates_touch_updated_at on public.product_substrates;
create trigger product_substrates_touch_updated_at
  before update on public.product_substrates
  for each row
  execute function public.touch_product_substrates_updated_at();

create index if not exists product_substrates_product_id_idx on public.product_substrates (product_id);
create index if not exists product_substrates_substrate_id_idx on public.product_substrates (substrate_id);

alter table public.product_substrates enable row level security;

drop policy if exists "Admins can manage product substrates" on public.product_substrates;
create policy "Admins can manage product substrates"
  on public.product_substrates for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all privileges on table public.product_substrates from anon, authenticated;
grant select, insert, update, delete on table public.product_substrates to authenticated;
