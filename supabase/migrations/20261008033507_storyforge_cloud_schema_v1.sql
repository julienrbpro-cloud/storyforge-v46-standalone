
create table public.storyforge_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Projet',
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index storyforge_projects_owner_updated_idx on public.storyforge_projects(owner_id,updated_at desc);
alter table public.storyforge_projects enable row level security;
revoke all on public.storyforge_projects from public, anon;
grant select, insert, update, delete on public.storyforge_projects to authenticated;
create policy storyforge_projects_select_own on public.storyforge_projects for select to authenticated
using (owner_id = (select auth.uid()) and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false);
create policy storyforge_projects_insert_own on public.storyforge_projects for insert to authenticated
with check (owner_id = (select auth.uid()) and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false);
create policy storyforge_projects_update_own on public.storyforge_projects for update to authenticated
using (owner_id = (select auth.uid()) and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false)
with check (owner_id = (select auth.uid()) and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false);
create policy storyforge_projects_delete_own on public.storyforge_projects for delete to authenticated
using (owner_id = (select auth.uid()) and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false);

create policy storyforge_images_select_own on storage.objects for select to authenticated
using (bucket_id='StoryForge-Image' and (storage.foldername(name))[1] = (select auth.uid())::text and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false);
create policy storyforge_images_insert_own on storage.objects for insert to authenticated
with check (bucket_id='StoryForge-Image' and (storage.foldername(name))[1] = (select auth.uid())::text and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false);
create policy storyforge_images_update_own on storage.objects for update to authenticated
using (bucket_id='StoryForge-Image' and (storage.foldername(name))[1] = (select auth.uid())::text and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false)
with check (bucket_id='StoryForge-Image' and (storage.foldername(name))[1] = (select auth.uid())::text and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false);
create policy storyforge_images_delete_own on storage.objects for delete to authenticated
using (bucket_id='StoryForge-Image' and (storage.foldername(name))[1] = (select auth.uid())::text and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false);
