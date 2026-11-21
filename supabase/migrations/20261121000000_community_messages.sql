create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists community_messages_created_at_idx
  on public.community_messages (created_at desc);

alter table public.community_messages enable row level security;

drop policy if exists "Authenticated users can read community chat" on public.community_messages;
create policy "Authenticated users can read community chat"
  on public.community_messages for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "Users can send as themselves in community chat" on public.community_messages;
create policy "Users can send as themselves in community chat"
  on public.community_messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and char_length(sender_name) between 1 and 120
    and char_length(trim(body)) between 1 and 2000
  );

grant select, insert on public.community_messages to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_messages'
  ) then
    alter publication supabase_realtime add table public.community_messages;
  end if;
end
$$;
