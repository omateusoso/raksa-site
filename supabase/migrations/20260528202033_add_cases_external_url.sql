alter table public.cases
  add column if not exists external_url text not null default '';
