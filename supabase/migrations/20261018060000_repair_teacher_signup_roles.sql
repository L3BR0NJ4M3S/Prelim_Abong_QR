update public.profiles p
set role = 'teacher',
    updated_at = now()
from auth.users u
where u.id = p.id
  and p.role = 'student'
  and lower(coalesce(u.raw_user_meta_data ->> 'requested_role', '')) = 'teacher';