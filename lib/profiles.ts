import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';
export type RoleLandingPath = '/(tabs)' | '/(tabs)/teacher' | '/admin';

export function getRoleLandingPath(role: Role): RoleLandingPath {
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/(tabs)/teacher';
  return '/(tabs)';
}

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

export type AdminProfile = Profile & { created_at: string };

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    const { data: authUser, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser.user || authUser.user.id !== userId) {
      return null;
    }

    const fallbackProfile: Profile = {
      id: authUser.user.id,
      email: authUser.user.email ?? '',
      full_name: authUser.user.user_metadata?.full_name ?? null,
      role: authUser.user.user_metadata?.requested_role === 'teacher'
        ? 'teacher'
        : 'student',
    };

    const { error: insertError } = await supabase.from('profiles').insert(fallbackProfile);

    if (insertError) {
      return null;
    }

    return fallbackProfile;
  }

  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: { full_name?: string }
): Promise<{ error: string | null }> {
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user?.id !== userId) {
    return { error: 'You can only update your own profile.' };
  }

  const { error } = await supabase.rpc('update_own_profile_name', {
    p_full_name: updates.full_name ?? '',
  });

  return { error: error?.message ?? null };
}

export async function getAdminProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await supabase.rpc('admin_list_profiles');
  if (error) throw error;
  return (data ?? []) as AdminProfile[];
}

export async function updateProfileRole(userId: string, role: Role): Promise<void> {
  const { error } = await supabase.rpc('admin_update_profile_role', {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}
