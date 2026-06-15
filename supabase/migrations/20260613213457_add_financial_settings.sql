create table if not exists public.financial_settings (
  id text primary key default 'global',
  hourly_rate numeric(12, 2) not null default 70,
  default_markup_percent numeric(7, 4) not null default 30,
  default_tax_percent numeric(7, 4) not null default 6,
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_settings_singleton_check check (id = 'global'),
  constraint financial_settings_hourly_rate_check check (hourly_rate >= 0),
  constraint financial_settings_markup_check check (default_markup_percent >= 0),
  constraint financial_settings_tax_check check (default_tax_percent >= 0),
  constraint financial_settings_currency_check check (currency = 'BRL')
);

create or replace function public.touch_financial_settings_updated_at()
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

drop trigger if exists financial_settings_touch_updated_at on public.financial_settings;
create trigger financial_settings_touch_updated_at
  before update on public.financial_settings
  for each row
  execute function public.touch_financial_settings_updated_at();

alter table public.financial_settings enable row level security;

drop policy if exists "Admins can read financial settings" on public.financial_settings;
drop policy if exists "Admins can insert financial settings" on public.financial_settings;
drop policy if exists "Admins can update financial settings" on public.financial_settings;
drop policy if exists "Admins can delete financial settings" on public.financial_settings;

create policy "Admins can read financial settings"
  on public.financial_settings for select to authenticated
  using (public.is_admin());

create policy "Admins can insert financial settings"
  on public.financial_settings for insert to authenticated
  with check (public.is_admin());

create policy "Admins can update financial settings"
  on public.financial_settings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete financial settings"
  on public.financial_settings for delete to authenticated
  using (public.is_admin());

revoke all privileges on table public.financial_settings from anon, authenticated;
grant select, insert, update, delete on table public.financial_settings to authenticated;

insert into public.financial_settings (
  id,
  hourly_rate,
  default_markup_percent,
  default_tax_percent,
  currency
)
values (
  'global',
  70,
  30,
  6,
  'BRL'
)
on conflict (id) do nothing;
