create sequence if not exists public.service_order_number_seq
  as integer
  start with 1000
  increment by 1
  minvalue 1000
  owned by none;

alter table public.service_orders add column if not exists order_number integer;

with numbered as (
  select
    id,
    999 + row_number() over (order by created_at, id) as next_number
  from public.service_orders
  where order_number is null
)
update public.service_orders as service_order
set order_number = numbered.next_number
from numbered
where service_order.id = numbered.id;

select setval(
  'public.service_order_number_seq',
  greatest(1000, coalesce((select max(order_number) from public.service_orders), 1000)),
  coalesce((select max(order_number) from public.service_orders), 0) >= 1000
);

alter table public.service_orders
  alter column order_number set default nextval('public.service_order_number_seq'::regclass);

alter sequence public.service_order_number_seq owned by public.service_orders.order_number;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_orders'::regclass and conname = 'service_orders_order_number_key'
  ) then
    alter table public.service_orders
      add constraint service_orders_order_number_key unique (order_number);
  end if;
end $$;

alter table public.service_orders alter column order_number set not null;

create index if not exists service_orders_order_number_idx on public.service_orders (order_number);

grant usage, select on sequence public.service_order_number_seq to authenticated;
