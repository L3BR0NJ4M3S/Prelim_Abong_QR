-- Add role-scoped profile RPCs. Public clients cannot update profile roles.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));

drop policy if exists "Users can update their own profile" on public.profiles;
drop trigger if exists prevent_profile_role_self_assignment on public.profiles;

create or replace function public.update_own_profile_name(p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  update public.profiles
  set full_name = nullif(trim(p_full_name), ''), updated_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.admin_list_profiles()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz
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
    select p.id, p.email, p.full_name, p.role, p.created_at
    from public.profiles p
    order by p.created_at desc;
end;
$$;

create or replace function public.admin_update_profile_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_current_role text;
  v_admin_count integer;
begin
  if v_admin_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_admin_id and p.role = 'admin'
  ) then
    raise exception 'Administrator access required.';
  end if;

  if p_role not in ('student', 'teacher', 'admin') then
    raise exception 'Invalid profile role.';
  end if;

  if p_user_id = v_admin_id and p_role <> 'admin' then
    raise exception 'You cannot remove your own administrator access.';
  end if;

  perform p.id
  from public.profiles p
  where p.role = 'admin'
  order by p.id
  for update;

  select p.role into v_current_role
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'User profile not found.';
  end if;

  if v_current_role = 'admin' and p_role <> 'admin' then
    select count(*) into v_admin_count
    from public.profiles p
    where p.role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'At least one administrator must remain.';
    end if;
  end if;

  update public.profiles p
  set role = p_role, updated_at = now()
  where p.id = p_user_id;
end;
$$;

revoke all on function public.update_own_profile_name(text) from public, anon;
grant execute on function public.update_own_profile_name(text) to authenticated;

revoke all on function public.admin_list_profiles() from public, anon;
grant execute on function public.admin_list_profiles() to authenticated;

revoke all on function public.admin_update_profile_role(uuid, text)
  from public, anon;
grant execute on function public.admin_update_profile_role(uuid, text)
  to authenticated;