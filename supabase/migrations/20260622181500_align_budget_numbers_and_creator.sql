alter table public.budgets add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.budgets add column if not exists created_by_email text not null default '';

create sequence if not exists public.budgets_budget_number_seq start with 210;
alter table public.budgets alter column budget_number set default nextval('public.budgets_budget_number_seq');

update public.budgets
set budget_number = -budget_number
where budget_number >= 1001;

with numbered as (
  select id, row_number() over (order by created_at, id) + 209 as next_budget_number
  from public.budgets
  where budget_number < 0
)
update public.budgets
set budget_number = numbered.next_budget_number
from numbered
where public.budgets.id = numbered.id;

update public.budgets
set budget_number = nextval('public.budgets_budget_number_seq')
where budget_number is null;

alter table public.budgets alter column budget_number set not null;

create unique index if not exists budgets_budget_number_key on public.budgets (budget_number);

select setval(
  'public.budgets_budget_number_seq',
  greatest(coalesce((select max(budget_number) from public.budgets), 209), 209),
  true
);

alter sequence public.budgets_budget_number_seq owned by public.budgets.budget_number;
grant usage, select on sequence public.budgets_budget_number_seq to authenticated;

update public.budgets
set discount = round((discount / nullif(subtotal + tax, 0)) * 100, 4)
where discount > 0
  and subtotal + tax > 0;

alter table public.budgets drop constraint if exists budgets_amounts_nonnegative_check;
alter table public.budgets
  add constraint budgets_amounts_nonnegative_check
  check (subtotal >= 0 and discount >= 0 and discount <= 100 and tax >= 0 and total >= 0);

alter table public.budgets drop constraint if exists budgets_total_matches_parts_check;
alter table public.budgets
  add constraint budgets_total_matches_parts_check
  check (total = round((subtotal + tax) - ((subtotal + tax) * (discount / 100.0)), 2));
