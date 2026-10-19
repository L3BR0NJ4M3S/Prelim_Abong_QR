begin;

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles must exist before applying this migration.';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
  ) then
    raise exception 'public.profiles.id is required and was not changed.';
  end if;
end;
$$;

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists role text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.profiles p
set email = coalesce(u.email, '')
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

update public.profiles
set email = ''
where email is null;

update public.profiles
set role = 'student'
where role is null;

update public.profiles
set created_at = now()
where created_at is null;

update public.profiles
set updated_at = now()
where updated_at is null;

alter table public.profiles
  alter column email set not null,
  alter column role set default 'student',
  alter column role set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));

alter table public.profiles enable row level security;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_is_admin() to authenticated;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  loop
    execute format(
      'drop policy if exists %I on public.profiles',
      existing_policy.policyname
    );
  end loop;
end;
$$;

create policy "Profiles are viewable by owner"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Admins can read all profiles"
  on public.profiles for select to authenticated
  using ((select public.current_user_is_admin()));

create policy "Teachers can view profiles of their attendees"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1
      from public.attendance a
      join public.events e on e.id = a.event_id
      where a.student_id = profiles.id
        and e.created_by = (select auth.uid())
    )
  );

create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (
    id = (select auth.uid())
    and (
      role = 'student'
      or (
        role = 'teacher'
        and ((select auth.jwt()) -> 'user_metadata' ->> 'requested_role') = 'teacher'
      )
    )
  );

revoke all on table public.profiles from public, anon, authenticated;
grant select, insert on table public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'requested_role', 'student');
  assigned_role text := 'student';
begin
  if requested_role = 'teacher' then
    assigned_role := 'teacher';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    assigned_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  case
    when u.raw_user_meta_data ->> 'requested_role' = 'teacher' then 'teacher'
    else 'student'
  end
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
on conflict (id) do nothing;

update public.profiles p
set role = 'teacher', updated_at = now()
from auth.users u
where u.id = p.id
  and p.role = 'student'
  and lower(coalesce(u.raw_user_meta_data ->> 'requested_role', '')) = 'teacher';

commit;