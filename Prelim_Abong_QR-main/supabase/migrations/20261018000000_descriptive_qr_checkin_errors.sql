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
  v_is_active boolean;
  v_start_time timestamptz;
  v_end_time timestamptz;
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

  select e.title, e.is_active, e.start_time, e.end_time
    into v_title, v_is_active, v_start_time, v_end_time
  from public.events e
  join public.event_qr_secrets s on s.event_id = e.id
  where e.id = p_event_id
    and s.token = p_token
  for update of e;

  if not found then
    return query select false, null::text, 'This QR code is invalid.'::text;
    return;
  end if;

  if not v_is_active then
    return query select false, v_title, 'This event is closed.'::text;
    return;
  end if;

  if v_start_time > now() then
    return query select false, v_title, 'This event has not started yet.'::text;
    return;
  end if;

  if v_end_time < now() then
    return query select false, v_title, 'This event has expired.'::text;
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
