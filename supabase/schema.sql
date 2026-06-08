create extension if not exists pgcrypto;

create table if not exists public.cases (
  id text primary key,
  slug text not null unique,
  title text not null,
  tags text[] not null default '{}',
  description text not null default '',
  cover text not null default '',
  images text[] not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'company',
  document text,
  email text,
  phone text,
  website text,
  status text not null default 'active',
  billing_email text,
  address text not null default '',
  referral_source text not null default '',
  commission_rate numeric(5, 2) not null default 0,
  notes text not null default '',
  state_registration text,
  municipal_registration text,
  postal_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  country text,
  billing_postal_code text,
  billing_street text,
  billing_number text,
  billing_complement text,
  billing_neighborhood text,
  billing_city text,
  billing_state text,
  billing_country text,
  billing_same_as_commercial boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default '',
  description text not null default '',
  base_price numeric(12, 2) not null default 0,
  estimated_hours numeric(10, 2) not null default 0,
  default_markup numeric(7, 4) not null default 0,
  pricing_model text not null default 'fixed',
  hourly_rate numeric(12, 2) not null default 0,
  default_substrate_ids jsonb not null default '[]'::jsonb,
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

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  case_id text references public.cases(id) on delete set null,
  name text not null,
  status text not null default 'lead',
  description text not null default '',
  starts_at date,
  due_at date,
  budget_total numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.budgets_budget_number_seq start with 1001;

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  budget_number bigint not null default nextval('public.budgets_budget_number_seq'),
  client_id uuid references public.clients(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  currency text not null default 'BRL',
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  valid_until date,
  resolved boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter sequence public.budgets_budget_number_seq owned by public.budgets.budget_number;

create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  budget_id uuid references public.budgets(id) on delete set null,
  title text not null,
  status text not null default 'open',
  scope jsonb not null default '{}'::jsonb,
  starts_at date,
  due_at date,
  recurrence text not null default 'one_time',
  billing_cycle text not null default '',
  estimated_hours numeric(10, 2) not null default 0,
  hourly_rate numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  service_order_id uuid references public.service_orders(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  work_date date not null default current_date,
  minutes integer not null check (minutes > 0),
  hourly_rate numeric(12, 2) not null default 0,
  description text not null default '',
  billable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.metrics_events (
  id bigint generated by default as identity primary key,
  event_name text not null,
  path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.cases add column if not exists excerpt text not null default '';
alter table public.cases add column if not exists published boolean not null default true;
alter table public.cases add column if not exists featured_on_home boolean not null default false;
alter table public.cases add column if not exists home_order integer not null default 999;
alter table public.cases add column if not exists content_blocks jsonb not null default '[]'::jsonb;
alter table public.cases add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.cases add column if not exists external_url text not null default '';
alter table public.clients add column if not exists billing_email text;
alter table public.clients add column if not exists address text not null default '';
alter table public.clients add column if not exists referral_source text not null default '';
alter table public.clients add column if not exists commission_rate numeric(5, 2) not null default 0;
alter table public.products add column if not exists pricing_model text not null default 'fixed';
alter table public.products add column if not exists hourly_rate numeric(12, 2) not null default 0;
alter table public.products add column if not exists default_substrate_ids jsonb not null default '[]'::jsonb;
alter table public.service_orders add column if not exists recurrence text not null default 'one_time';
alter table public.service_orders add column if not exists billing_cycle text not null default '';
alter table public.service_orders add column if not exists estimated_hours numeric(10, 2) not null default 0;
alter table public.service_orders add column if not exists hourly_rate numeric(12, 2) not null default 0;
alter table public.time_entries add column if not exists hourly_rate numeric(12, 2) not null default 0;
alter table public.budgets add column if not exists budget_number bigint;
alter table public.budgets add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.budgets add column if not exists resolved boolean not null default false;
alter table public.budgets alter column budget_number set default nextval('public.budgets_budget_number_seq');
update public.budgets
set budget_number = nextval('public.budgets_budget_number_seq')
where budget_number is null;
alter table public.budgets alter column budget_number set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.clients'::regclass and conname = 'clients_type_check'
  ) then
    alter table public.clients
      add constraint clients_type_check
      check (type in ('company', 'person'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.clients'::regclass and conname = 'clients_status_check'
  ) then
    alter table public.clients
      add constraint clients_status_check
      check (status in ('active', 'lead', 'inactive'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.clients'::regclass and conname = 'clients_commission_rate_check'
  ) then
    alter table public.clients
      add constraint clients_commission_rate_check
      check (commission_rate >= 0 and commission_rate <= 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.projects'::regclass and conname = 'projects_status_check'
  ) then
    alter table public.projects
      add constraint projects_status_check
      check (status in ('lead', 'proposal', 'active', 'paused', 'done', 'canceled'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.projects'::regclass and conname = 'projects_budget_total_nonnegative_check'
  ) then
    alter table public.projects
      add constraint projects_budget_total_nonnegative_check
      check (budget_total is null or budget_total >= 0);
  end if;

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

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.budgets'::regclass and conname = 'budgets_status_check'
  ) then
    alter table public.budgets
      add constraint budgets_status_check
      check (status in ('draft', 'sent', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.budgets'::regclass and conname = 'budgets_amounts_nonnegative_check'
  ) then
    alter table public.budgets
      add constraint budgets_amounts_nonnegative_check
      check (subtotal >= 0 and discount >= 0 and tax >= 0 and total >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.budgets'::regclass and conname = 'budgets_total_matches_parts_check'
  ) then
    alter table public.budgets
      add constraint budgets_total_matches_parts_check
      check (total = subtotal - discount + tax);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_orders'::regclass and conname = 'service_orders_status_check'
  ) then
    alter table public.service_orders
      add constraint service_orders_status_check
      check (status in ('open', 'in_progress', 'done', 'canceled'));
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

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.time_entries'::regclass
      and conname in ('time_entries_minutes_check', 'time_entries_minutes_positive_check')
  ) then
    alter table public.time_entries
      add constraint time_entries_minutes_positive_check
      check (minutes > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.time_entries'::regclass
      and conname = 'time_entries_hourly_rate_nonnegative_check'
  ) then
    alter table public.time_entries
      add constraint time_entries_hourly_rate_nonnegative_check
      check (hourly_rate >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.metrics_events'::regclass and conname = 'metrics_events_event_name_check'
  ) then
    alter table public.metrics_events
      add constraint metrics_events_event_name_check
      check (event_name in ('page_view', 'whatsapp_click', 'case_click', 'form_submit'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.metrics_events'::regclass and conname = 'metrics_events_path_length_check'
  ) then
    alter table public.metrics_events
      add constraint metrics_events_path_length_check
      check (length(coalesce(path, '')) <= 500);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.metrics_events'::regclass and conname = 'metrics_events_metadata_shape_check'
  ) then
    alter table public.metrics_events
      add constraint metrics_events_metadata_shape_check
      check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4096);
  end if;
end $$;

create index if not exists cases_client_id_idx on public.cases (client_id);
create index if not exists contacts_client_id_idx on public.contacts (client_id);
create index if not exists products_status_idx on public.products (status);
create index if not exists products_category_idx on public.products (category);
create index if not exists substrates_status_idx on public.substrates (status);
create index if not exists substrates_kind_idx on public.substrates (kind);
create index if not exists projects_client_id_idx on public.projects (client_id);
create index if not exists projects_case_id_idx on public.projects (case_id);
create unique index if not exists budgets_budget_number_key on public.budgets (budget_number);
create index if not exists budgets_client_id_idx on public.budgets (client_id);
create index if not exists budgets_contact_id_idx on public.budgets (contact_id);
create index if not exists budgets_project_id_idx on public.budgets (project_id);
create index if not exists service_orders_client_id_idx on public.service_orders (client_id);
create index if not exists service_orders_project_id_idx on public.service_orders (project_id);
create index if not exists service_orders_budget_id_idx on public.service_orders (budget_id);
create index if not exists time_entries_project_id_idx on public.time_entries (project_id);
create index if not exists time_entries_service_order_id_idx on public.time_entries (service_order_id);
create index if not exists time_entries_user_id_idx on public.time_entries (user_id);
create index if not exists cases_public_home_idx on public.cases (published, featured_on_home, home_order, title);

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

alter table public.cases enable row level security;
alter table public.admin_users enable row level security;
alter table public.clients enable row level security;
alter table public.contacts enable row level security;
alter table public.products enable row level security;
alter table public.substrates enable row level security;
alter table public.projects enable row level security;
alter table public.budgets enable row level security;
alter table public.service_orders enable row level security;
alter table public.time_entries enable row level security;
alter table public.site_settings enable row level security;
alter table public.metrics_events enable row level security;

drop policy if exists "Cases are readable by everyone" on public.cases;
drop policy if exists "Admins can insert cases" on public.cases;
drop policy if exists "Admins can update cases" on public.cases;
drop policy if exists "Admins can delete cases" on public.cases;
drop policy if exists "Admins can read own admin status" on public.admin_users;
drop policy if exists "Admins can manage clients" on public.clients;
drop policy if exists "Admins can manage contacts" on public.contacts;
drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "Admins can manage substrates" on public.substrates;
drop policy if exists "Admins can manage projects" on public.projects;
drop policy if exists "Admins can manage budgets" on public.budgets;
drop policy if exists "Admins can manage service orders" on public.service_orders;
drop policy if exists "Admins can manage time entries" on public.time_entries;
drop policy if exists "Site settings are readable by everyone" on public.site_settings;
drop policy if exists "Admins can manage site settings" on public.site_settings;
drop policy if exists "Admins can insert site settings" on public.site_settings;
drop policy if exists "Admins can update site settings" on public.site_settings;
drop policy if exists "Admins can delete site settings" on public.site_settings;
drop policy if exists "Anyone can insert metrics events" on public.metrics_events;
drop policy if exists "Admins can read metrics events" on public.metrics_events;

create policy "Cases are readable by everyone"
  on public.cases for select
  using (published = true or public.is_admin());

create policy "Admins can insert cases"
  on public.cases for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update cases"
  on public.cases for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete cases"
  on public.cases for delete
  to authenticated
  using (public.is_admin());

create policy "Admins can read own admin status"
  on public.admin_users for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Admins can manage clients"
  on public.clients for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can manage contacts"
  on public.contacts for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can manage products"
  on public.products for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can manage substrates"
  on public.substrates for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can manage projects"
  on public.projects for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can manage budgets"
  on public.budgets for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can manage service orders"
  on public.service_orders for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can manage time entries"
  on public.time_entries for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Site settings are readable by everyone"
  on public.site_settings for select
  using (true);

create policy "Admins can insert site settings"
  on public.site_settings for insert to authenticated
  with check (public.is_admin());

create policy "Admins can update site settings"
  on public.site_settings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete site settings"
  on public.site_settings for delete to authenticated
  using (public.is_admin());

create policy "Anyone can insert metrics events"
  on public.metrics_events for insert
  with check (
    event_name in ('page_view', 'whatsapp_click', 'case_click', 'form_submit')
    and length(coalesce(path, '')) <= 500
    and jsonb_typeof(metadata) = 'object'
    and pg_column_size(metadata) <= 4096
    and created_at >= now() - interval '5 minutes'
    and created_at <= now() + interval '5 minutes'
  );

create policy "Admins can read metrics events"
  on public.metrics_events for select to authenticated
  using (public.is_admin());

revoke all privileges on table
  public.admin_users,
  public.cases,
  public.clients,
  public.contacts,
  public.products,
  public.substrates,
  public.projects,
  public.budgets,
  public.service_orders,
  public.time_entries,
  public.site_settings,
  public.metrics_events
from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant usage, select on sequence public.budgets_budget_number_seq to authenticated;
grant select on table public.admin_users to anon, authenticated;
grant select on table public.cases to anon, authenticated;
grant insert, update, delete on table public.cases to authenticated;
grant select on table public.site_settings to anon, authenticated;
grant insert (event_name, path, metadata) on table public.metrics_events to anon, authenticated;
grant select on table public.metrics_events to authenticated;
grant select, insert, update, delete on table
  public.clients,
  public.contacts,
  public.products,
  public.substrates,
  public.projects,
  public.budgets,
  public.service_orders,
  public.time_entries,
  public.site_settings
to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-images',
  'case-images',
  true,
  20971520,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload case images" on storage.objects;
drop policy if exists "Admins can update case images" on storage.objects;
drop policy if exists "Admins can delete case images" on storage.objects;

create policy "Admins can upload case images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'case-images'
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp', 'gif')
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

create policy "Admins can update case images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'case-images'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'case-images'
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp', 'gif')
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

create policy "Admins can delete case images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'case-images'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );
