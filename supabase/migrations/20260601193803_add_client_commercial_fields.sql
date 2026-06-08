alter table public.clients add column if not exists billing_email text;
alter table public.clients add column if not exists address text not null default '';
alter table public.clients add column if not exists referral_source text not null default '';
alter table public.clients add column if not exists commission_rate numeric(5, 2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.clients'::regclass and conname = 'clients_commission_rate_check'
  ) then
    alter table public.clients
      add constraint clients_commission_rate_check
      check (commission_rate >= 0 and commission_rate <= 100);
  end if;
end $$;
