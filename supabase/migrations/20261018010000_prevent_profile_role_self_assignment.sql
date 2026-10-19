-- Prevent users from granting themselves a privileged profile role.
create or replace function public.prevent_profile_role_self_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'Profile role changes must be approved by an administrator.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_self_assignment on public.profiles;
create trigger prevent_profile_role_self_assignment
  before update on public.profiles
  for each row execute function public.prevent_profile_role_self_assignment();

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id and role = 'student');