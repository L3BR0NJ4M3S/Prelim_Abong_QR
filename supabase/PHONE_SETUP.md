# QR-ATT Phone Setup

## Supabase Setup

The app uses the `create_teacher_event`, `check_in_with_event_qr`, and Admin user-management RPCs, so the base schema alone is not enough.

For a new Supabase project, open SQL Editor and run these files in order:

1. `supabase/schema.sql`
2. `supabase/migrations/20261012000000_secure_event_qr.sql`
3. `supabase/migrations/20261018000000_descriptive_qr_checkin_errors.sql`
4. `supabase/migrations/20261018010000_prevent_profile_role_self_assignment.sql`
5. `supabase/migrations/20261018020000_allow_teacher_signup.sql`
6. `supabase/migrations/20261018030000_admin_dashboard_access.sql`
7. `supabase/migrations/20261018040000_allow_admin_signup.sql`

The base schema creates the tables, indexes, RLS policies, and Student-default signup trigger. The migrations add secure QR storage, server-side create/check-in functions, role-update protection, Admin-only user-management RPCs, and the Student/Teacher/Admin signup choices.

**Security warning:** Selecting Admin during public signup grants full user-management access. Anyone who can register can become an Admin. Do not expose this configuration on a public or production app; remove Admin from `SIGNUP_ROLES` and restrict the signup trigger to Student/Teacher, then provision trusted Admin accounts separately.

New Teacher signups receive the Teacher profile role and can use the Teacher tab. To promote an existing account, verify the address and run this as the project owner in Supabase SQL Editor:

```sql
update public.profiles
set role = 'teacher'
where email = 'teacher@example.com';
```

The Admin section is a separate route with no Student tabs. Teacher accounts see only the Teacher destination; Student accounts keep the Student tabs.

## Expo Go on Android

1. Put the phone and development computer on the same Wi-Fi network. Avoid guest Wi-Fi/client isolation.
2. Confirm `.env` has the Supabase project URL and anon or publishable key. Never put a service-role key in the app.
3. From the project root, run:

   ```powershell
   npx expo start --go --offline
   ```

4. Scan the Expo QR code with Expo Go. Approve camera permission when prompted.

If the LAN address cannot be reached, check Windows Firewall and make sure the phone is not on mobile data/VPN. A development build can instead be installed with `npx expo run:android`, but this computer needs JDK 17 and Android SDK platform/build tools configured. Java 8 cannot build this Expo SDK 54 project.