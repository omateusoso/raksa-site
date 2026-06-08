drop policy if exists "Temporary manual cover upload exact paths" on storage.objects;
drop policy if exists "Temporary manual cover update exact paths" on storage.objects;

create policy "Temporary manual cover upload exact paths"
  on storage.objects for insert
  to public
  with check (
    bucket_id = 'case-images'
    and name = any (array[
      'cases/a-primeira-segunda-feira/cover.jpg',
      'cases/candy-dates/cover.jpg',
      'cases/capri-housing/cover.jpg',
      'cases/demip/cover.jpg',
      'cases/leylaw/cover.jpg',
      'cases/lumilab/cover.jpg',
      'cases/voce-marca/cover.jpg'
    ]::text[])
    and lower(storage.extension(name)) in ('jpg', 'jpeg')
  );

create policy "Temporary manual cover update exact paths"
  on storage.objects for update
  to public
  using (
    bucket_id = 'case-images'
    and name = any (array[
      'cases/a-primeira-segunda-feira/cover.jpg',
      'cases/candy-dates/cover.jpg',
      'cases/capri-housing/cover.jpg',
      'cases/demip/cover.jpg',
      'cases/leylaw/cover.jpg',
      'cases/lumilab/cover.jpg',
      'cases/voce-marca/cover.jpg'
    ]::text[])
  )
  with check (
    bucket_id = 'case-images'
    and name = any (array[
      'cases/a-primeira-segunda-feira/cover.jpg',
      'cases/candy-dates/cover.jpg',
      'cases/capri-housing/cover.jpg',
      'cases/demip/cover.jpg',
      'cases/leylaw/cover.jpg',
      'cases/lumilab/cover.jpg',
      'cases/voce-marca/cover.jpg'
    ]::text[])
    and lower(storage.extension(name)) in ('jpg', 'jpeg')
  );
