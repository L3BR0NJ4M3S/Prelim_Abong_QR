import { supabase } from './supabase';

export type Role = 'student' | 'teacher';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

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
      role: 'student',
    };

    const { error: insertError } = await supabase
      .from('profiles')
      .upsert(fallbackProfile, { onConflict: 'id' });

    if (insertError) {
      return null;
    }

    return fallbackProfile;
  }

  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: { full_name?: string; role?: Role }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return { error: error?.message ?? null };
}
