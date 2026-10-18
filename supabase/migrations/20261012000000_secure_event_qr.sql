-- Adds secure QR tokens to the existing events/attendance schema.
alter table public.events
  add column if not exists description text,
  add column if not exists location text,
  add column if not exists is_active boolean not null default true;

create table if not exists public.event_qr_secrets (
  event_id uuid primary key references public.events (id) on delete cascade,
  token uuid not null unique default gen_random_uuid()
);

alter table public.event_qr_secrets enable row level security;
revoke all on table public.event_qr_secrets from public, anon, authenticated;

create or replace function public.create_teacher_event(
  p_event_code text,
  p_title text,
  p_description text,
  p_location text,
  p_start_time timestamptz,
  p_end_time timestamptz
)
returns table (
  id uuid,
  event_code text,
  title text,
  description text,
  location text,
  start_time timestamptz,
  end_time timestamptz,
  qr_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_event public.events%rowtype;
  v_qr_token uuid := gen_random_uuid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and lower(p.role) = 'teacher'
  ) then
    raise exception 'Teacher access required';
  end if;

  if coalesce(length(trim(p_event_code)), 0) = 0
     or coalesce(length(trim(p_title)), 0) = 0 then
    raise exception 'Event code and title are required';
  end if;

  if p_end_time is null
     or p_start_time is null
     or p_end_time <= p_start_time then
    raise exception 'Event end time must be after its start time';
  end if;

  insert into public.events (
    event_code,
    title,
    description,
    location,
    start_time,
    end_time,
    created_by
  )
  values (
    trim(p_event_code),
    trim(p_title),
    nullif(trim(p_description), ''),
    nullif(trim(p_location), ''),
    p_start_time,
    p_end_time,
    v_user_id
  )
  returning * into v_event;

  insert into public.event_qr_secrets (event_id, token)
  values (v_event.id, v_qr_token);

  return query
    select
      v_event.id,
      v_event.event_code,
      v_event.title,
      v_event.description,
      v_event.location,
      v_event.start_time,
      v_event.end_time,
      v_qr_token;
end;
$$;

revoke all on function public.create_teacher_event(
  text, text, text, text, timestamptz, timestamptz
) from public, anon;
grant execute on function public.create_teacher_event(
  text, text, text, text, timestamptz, timestamptz
) to authenticated;

create or replace function public.check_in_with_event_qr(
  p_event_id uuid,
  p_token uuid
)
returns table (
  success boolean,
  event_title text,
  message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text;
begin
  if v_user_id is null then
    return query select false, null::text, 'Please sign in before checking in.'::text;
    return;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and lower(p.role) = 'student'
  ) then
    return query select false, null::text, 'Only student accounts can check in.'::text;
    return;
  end if;

  select e.title
    into v_title
  from public.events e
  join public.event_qr_secrets s on s.event_id = e.id
  where e.id = p_event_id
    and s.token = p_token
    and e.is_active = true
    and e.start_time <= now()
    and e.end_time >= now()
  for update;

  if not found then
    return query
      select false, null::text,
        'This QR code is invalid, inactive, or outside the event schedule.'::text;
    return;
  end if;

  if exists (
    select 1
    from public.attendance a
    where a.event_id = p_event_id
      and a.student_id = v_user_id
  ) then
    return query
      select false, v_title, 'Already checked in for this event.'::text;
    return;
  end if;

  insert into public.attendance (student_id, event_id)
  values (v_user_id, p_event_id);

  return query select true, v_title, 'Attendance recorded!'::text;
end;
$$;

revoke all on function public.check_in_with_event_qr(uuid, uuid)
  from public, anon;
grant execute on function public.check_in_with_event_qr(uuid, uuid)
  to authenticated;

-- All app check-ins must use the validation RPC rather than direct table inserts.
revoke insert on public.attendance from anon, authenticated;
