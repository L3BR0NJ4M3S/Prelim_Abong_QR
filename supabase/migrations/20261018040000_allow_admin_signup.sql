-- Public signup can request one of the supported roles. Be aware that allowing
-- Admin here makes administrator access self-service for anyone who can sign up.
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