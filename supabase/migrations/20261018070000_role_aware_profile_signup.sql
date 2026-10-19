alter table public.profiles
  add column if not exists email text,
  add column if not exists updated_at timestamptz not null default now();

update public.profiles p
set email = coalesce(u.email, '')
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

alter table public.profiles
  alter column email set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'requested_role', 'student');
begin
  if v_role not in ('student', 'teacher', 'admin') then
    v_role := 'student';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

update public.profiles p
set role = 'teacher', updated_at = now()
from auth.users u
where u.id = p.id
  and p.role = 'student'
  and lower(coalesce(u.raw_user_meta_data ->> 'requested_role', '')) = 'teacher';

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  case
    when u.raw_user_meta_data ->> 'requested_role' in ('student', 'teacher', 'admin')
      then u.raw_user_meta_data ->> 'requested_role'
    else 'student'
  end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;