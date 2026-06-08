create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default '',
  description text not null default '',
  base_price numeric(12, 2) not null default 0,
  estimated_hours numeric(10, 2) not null default 0,
  default_markup numeric(7, 4) not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.substrates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default '',
  unit text not null default 'un',
  unit_cost numeric(12, 2) not null default 0,
  notes text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.budgets_budget_number_seq start with 1001;

alter table public.budgets add column if not exists budget_number bigint;
alter table public.budgets add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.budgets add column if not exists resolved boolean not null default false;
alter table public.budgets alter column budget_number set default nextval('public.budgets_budget_number_seq');

update public.budgets
set budget_number = nextval('public.budgets_budget_number_seq')
where budget_number is null;

select setval(
  'public.budgets_budget_number_seq',
  greatest(coalesce((select max(budget_number) from public.budgets), 1000), 1000),
  true
);

alter table public.budgets alter column budget_number set not null;
alter sequence public.budgets_budget_number_seq owned by public.budgets.budget_number;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and conname = 'products_status_check'
  ) then
    alter table public.products
      add constraint products_status_check
      check (status in ('active', 'inactive'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and conname = 'products_amounts_nonnegative_check'
  ) then
    alter table public.products
      add constraint products_amounts_nonnegative_check
      check (base_price >= 0 and estimated_hours >= 0 and default_markup >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.substrates'::regclass and conname = 'substrates_status_check'
  ) then
    alter table public.substrates
      add constraint substrates_status_check
      check (status in ('active', 'inactive'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.substrates'::regclass and conname = 'substrates_unit_cost_nonnegative_check'
  ) then
    alter table public.substrates
      add constraint substrates_unit_cost_nonnegative_check
      check (unit_cost >= 0);
  end if;
end $$;

create index if not exists products_status_idx on public.products (status);
create index if not exists products_category_idx on public.products (category);
create index if not exists substrates_status_idx on public.substrates (status);
create index if not exists substrates_kind_idx on public.substrates (kind);
create unique index if not exists budgets_budget_number_key on public.budgets (budget_number);
create index if not exists budgets_contact_id_idx on public.budgets (contact_id);

alter table public.products enable row level security;
alter table public.substrates enable row level security;

drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "Admins can manage substrates" on public.substrates;

create policy "Admins can manage products"
  on public.products for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can manage substrates"
  on public.substrates for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all privileges on table public.products, public.substrates from anon, authenticated;
grant usage, select on sequence public.budgets_budget_number_seq to authenticated;
grant select, insert, update, delete on table public.products, public.substrates to authenticated;
