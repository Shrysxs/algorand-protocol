-- Create storage bucket for ad creatives (videos, images)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ad-creatives',
  'ad-creatives',
  true,
  52428800, -- 50MB max
  array['video/mp4', 'video/webm', 'video/quicktime', 'image/png', 'image/jpeg', 'image/gif']
)
on conflict (id) do nothing;

-- Allow public read access
create policy "Public read ad creatives"
  on storage.objects for select
  using (bucket_id = 'ad-creatives');

-- Allow authenticated/service uploads
create policy "Service upload ad creatives"
  on storage.objects for insert
  with check (bucket_id = 'ad-creatives');

create policy "Service update ad creatives"
  on storage.objects for update
  using (bucket_id = 'ad-creatives');

create policy "Service delete ad creatives"
  on storage.objects for delete
  using (bucket_id = 'ad-creatives');
