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
    where conrelid = 'public.time_entries'::regclass
      and conname in ('time_entries_minutes_check', 'time_entries_minutes_positive_check')
  ) then
    alter table public.time_entries
      add constraint time_entries_minutes_positive_check
      check (minutes > 0);
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

drop policy if exists "Anyone can insert metrics events" on public.metrics_events;

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

revoke all privileges on table
  public.admin_users,
  public.cases,
  public.clients,
  public.contacts,
  public.projects,
  public.budgets,
  public.service_orders,
  public.time_entries,
  public.site_settings,
  public.metrics_events
from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant select on table public.admin_users to anon, authenticated;
grant select on table public.cases to anon, authenticated;
grant insert, update, delete on table public.cases to authenticated;
grant select on table public.site_settings to anon, authenticated;
grant insert (event_name, path, metadata) on table public.metrics_events to anon, authenticated;
grant select on table public.metrics_events to authenticated;
grant select, insert, update, delete on table
  public.clients,
  public.contacts,
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
