create or replace function public.admin_list_events()
returns table (
  id uuid,
  event_code text,
  title text,
  location text,
  start_time timestamptz,
  end_time timestamptz,
  is_active boolean,
  attendee_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Administrator access required.';
  end if;

  return query
    select e.id, e.event_code, e.title, e.location, e.start_time, e.end_time,
      e.is_active, count(a.id)
    from public.events e
    left join public.attendance a on a.event_id = e.id
    group by e.id
    order by e.created_at desc;
end;
$$;

create or replace function public.admin_update_event(
  p_event_id uuid,
  p_title text,
  p_location text,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Administrator access required.';
  end if;
  if coalesce(length(trim(p_title)), 0) = 0 then
    raise exception 'Event title is required.';
  end if;

  update public.events e
  set title = trim(p_title), location = nullif(trim(p_location), ''),
      is_active = p_is_active
  where e.id = p_event_id;
  if not found then
    raise exception 'Event not found.';
  end if;
end;
$$;

create or replace function public.admin_delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Administrator access required.';
  end if;
  delete from public.events e where e.id = p_event_id;
  if not found then
    raise exception 'Event not found.';
  end if;
end;
$$;

create or replace function public.admin_list_attendance()
returns table (
  id uuid,
  event_id uuid,
  event_title text,
  event_code text,
  student_id uuid,
  student_name text,
  student_email text,
  scanned_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Administrator access required.';
  end if;

  return query
    select a.id, e.id, e.title, e.event_code, p.id,
      coalesce(p.full_name, 'Unnamed account'), p.email, a.scanned_at
    from public.attendance a
    join public.events e on e.id = a.event_id
    join public.profiles p on p.id = a.student_id
    order by a.scanned_at desc;
end;
$$;

create or replace function public.admin_update_attendance_time(
  p_attendance_id uuid,
  p_scanned_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Administrator access required.';
  end if;
  if p_scanned_at is null then
    raise exception 'A valid check-in time is required.';
  end if;

  update public.attendance a set scanned_at = p_scanned_at
  where a.id = p_attendance_id;
  if not found then
    raise exception 'Attendance record not found.';
  end if;
end;
$$;

create or replace function public.admin_delete_attendance(p_attendance_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Administrator access required.';
  end if;
  delete from public.attendance a where a.id = p_attendance_id;
  if not found then
    raise exception 'Attendance record not found.';
  end if;
end;
$$;

revoke all on function public.admin_list_events() from public, anon;
revoke all on function public.admin_update_event(uuid, text, text, boolean) from public, anon;
revoke all on function public.admin_delete_event(uuid) from public, anon;
revoke all on function public.admin_list_attendance() from public, anon;
revoke all on function public.admin_update_attendance_time(uuid, timestamptz) from public, anon;
revoke all on function public.admin_delete_attendance(uuid) from public, anon;
grant execute on function public.admin_list_events() to authenticated;
grant execute on function public.admin_update_event(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_delete_event(uuid) to authenticated;
grant execute on function public.admin_list_attendance() to authenticated;
grant execute on function public.admin_update_attendance_time(uuid, timestamptz) to authenticated;
grant execute on function public.admin_delete_attendance(uuid) to authenticated;