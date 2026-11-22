create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create unique index if not exists friend_requests_pending_pair_idx
  on public.friend_requests (sender_id, recipient_id)
  where status = 'pending';
create index if not exists friend_requests_recipient_status_idx
  on public.friend_requests (recipient_id, status, created_at desc);
create index if not exists friend_requests_sender_status_idx
  on public.friend_requests (sender_id, status, created_at desc);

alter table public.friend_requests enable row level security;
drop policy if exists "Participants can read friend requests" on public.friend_requests;
create policy "Participants can read friend requests"
  on public.friend_requests for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "Users can send friend requests" on public.friend_requests;
create policy "Users can send friend requests"
  on public.friend_requests for insert to authenticated
  with check (sender_id = auth.uid() and status = 'pending');
drop policy if exists "Recipients can respond to friend requests" on public.friend_requests;
create policy "Recipients can respond to friend requests"
  on public.friend_requests for update to authenticated
  using (recipient_id = auth.uid() and status = 'pending')
  with check (recipient_id = auth.uid() and status in ('accepted', 'declined'));
drop policy if exists "Senders can cancel friend requests" on public.friend_requests;
create policy "Senders can cancel friend requests"
  on public.friend_requests for update to authenticated
  using (sender_id = auth.uid() and status = 'pending')
  with check (sender_id = auth.uid() and status = 'cancelled');
grant select, insert, update on public.friend_requests to authenticated;

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index if not exists direct_messages_pair_created_idx
  on public.direct_messages (sender_id, recipient_id, created_at desc);
create index if not exists direct_messages_recipient_created_idx
  on public.direct_messages (recipient_id, created_at desc);

alter table public.direct_messages enable row level security;
drop policy if exists "Friends can read direct messages" on public.direct_messages;
create policy "Friends can read direct messages"
  on public.direct_messages for select to authenticated
  using (
    (sender_id = auth.uid() or recipient_id = auth.uid())
    and exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.sender_id = direct_messages.sender_id and fr.recipient_id = direct_messages.recipient_id)
          or (fr.sender_id = direct_messages.recipient_id and fr.recipient_id = direct_messages.sender_id))
    )
  );
drop policy if exists "Friends can send direct messages" on public.direct_messages;
create policy "Friends can send direct messages"
  on public.direct_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and char_length(trim(body)) between 1 and 2000
    and exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.sender_id = direct_messages.sender_id and fr.recipient_id = direct_messages.recipient_id)
          or (fr.sender_id = direct_messages.recipient_id and fr.recipient_id = direct_messages.sender_id))
    )
  );
grant select, insert on public.direct_messages to authenticated;

create table if not exists public.call_rooms (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  call_type text not null check (call_type in ('audio', 'video')),
  room_name text not null unique,
  status text not null default 'ringing'
    check (status in ('ringing', 'active', 'rejected', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (caller_id <> callee_id)
);

-- The project may already contain the earlier call_rooms table created for LiveKit.
alter table public.call_rooms add column if not exists caller_id uuid references auth.users(id) on delete cascade;
alter table public.call_rooms add column if not exists callee_id uuid references auth.users(id) on delete cascade;
do $
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'call_rooms' and column_name = 'created_by') then
    execute 'update public.call_rooms set caller_id = coalesce(caller_id, created_by) where caller_id is null';
  end if;
end
$;

create index if not exists call_rooms_callee_status_idx
  on public.call_rooms (callee_id, status, created_at desc);

alter table public.call_rooms enable row level security;
drop policy if exists "Call participants can read calls" on public.call_rooms;
create policy "Call participants can read calls"
  on public.call_rooms for select to authenticated
  using (caller_id = auth.uid() or callee_id = auth.uid());
drop policy if exists "Friends can start calls" on public.call_rooms;
create policy "Friends can start calls"
  on public.call_rooms for insert to authenticated
  with check (
    caller_id = auth.uid()
    and status = 'ringing'
    and exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.sender_id = call_rooms.caller_id and fr.recipient_id = call_rooms.callee_id)
          or (fr.sender_id = call_rooms.callee_id and fr.recipient_id = call_rooms.caller_id))
    )
  );
drop policy if exists "Callee can answer or reject calls" on public.call_rooms;
create policy "Callee can answer or reject calls"
  on public.call_rooms for update to authenticated
  using (callee_id = auth.uid() and status = 'ringing')
  with check (callee_id = auth.uid() and status in ('active', 'rejected'));
drop policy if exists "Caller can end calls" on public.call_rooms;
drop policy if exists "Participants can end calls" on public.call_rooms;
create policy "Participants can end calls"
  on public.call_rooms for update to authenticated
  using ((caller_id = auth.uid() or callee_id = auth.uid()) and status in ('ringing', 'active'))
  with check ((caller_id = auth.uid() or callee_id = auth.uid()) and status = 'ended');
grant select, insert, update on public.call_rooms to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friend_requests'
  ) then alter publication supabase_realtime add table public.friend_requests; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
  ) then alter publication supabase_realtime add table public.direct_messages; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'call_rooms'
  ) then alter publication supabase_realtime add table public.call_rooms; end if;
end
$$;
