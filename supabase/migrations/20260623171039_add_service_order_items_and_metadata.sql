alter table public.service_orders add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.service_orders add column if not exists created_by_email text not null default '';
alter table public.service_orders add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.service_orders add column if not exists updated_by_email text not null default '';
alter table public.service_orders add column if not exists source text not null default 'manual';
alter table public.service_orders add column if not exists origin_budget_id uuid references public.budgets(id) on delete set null;
alter table public.service_orders add column if not exists confirmation_status text not null default 'pending';
alter table public.service_orders add column if not exists confirmed_at timestamptz;

create table if not exists public.service_order_items (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  budget_id uuid references public.budgets(id) on delete set null,
  budget_item_index integer,
  position integer not null default 1,
  name text not null,
  description text not null default '',
  quantity numeric(12, 2) not null default 1,
  estimated_hours numeric(12, 2) not null default 0,
  unit_price numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  notes text not null default '',
  source_item jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_orders'::regclass and conname = 'service_orders_source_check'
  ) then
    alter table public.service_orders
      add constraint service_orders_source_check
      check (source in ('manual', 'budget'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_orders'::regclass and conname = 'service_orders_confirmation_status_check'
  ) then
    alter table public.service_orders
      add constraint service_orders_confirmation_status_check
      check (confirmation_status in ('pending', 'confirmed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_order_items'::regclass and conname = 'service_order_items_amounts_nonnegative_check'
  ) then
    alter table public.service_order_items
      add constraint service_order_items_amounts_nonnegative_check
      check (quantity >= 0 and estimated_hours >= 0 and unit_price >= 0 and total >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_order_items'::regclass and conname = 'service_order_items_source_item_object_check'
  ) then
    alter table public.service_order_items
      add constraint service_order_items_source_item_object_check
      check (jsonb_typeof(source_item) = 'object');
  end if;
end $$;

create index if not exists service_orders_source_idx on public.service_orders (source);
create index if not exists service_orders_origin_budget_id_idx on public.service_orders (origin_budget_id);
create index if not exists service_order_items_service_order_id_idx on public.service_order_items (service_order_id);
create index if not exists service_order_items_budget_id_idx on public.service_order_items (budget_id);

create or replace function public.touch_service_order_items_updated_at()
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

drop trigger if exists service_order_items_touch_updated_at on public.service_order_items;
create trigger service_order_items_touch_updated_at
  before update on public.service_order_items
  for each row
  execute function public.touch_service_order_items_updated_at();

alter table public.service_order_items enable row level security;

drop policy if exists "Admins can manage service order items" on public.service_order_items;
create policy "Admins can manage service order items"
  on public.service_order_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on table public.service_order_items to authenticated;
