import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
};

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = true;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;
  notify();
}

async function hydrateAuth() {
  globalLoading = true;
  notify();

  try {
    const { data, error } = await supabase.auth.getSession();
    setAuth(error ? null : data.session);
  } catch (error) {
    console.error('Failed to restore the auth session:', error);
    setAuth(null);
  }
}

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);

    void hydrateAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session);
    });

    return () => {
      listeners.delete(listener);
      authListener.subscription.unsubscribe();
    };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

async function upsertProfileForUser(
  userId: string,
  email: string,
  profile?: SignUpProfile
) {
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        email: email.trim(),
        full_name: profile?.full_name ?? '',
        role: profile?.role ?? 'student',
      },
      { onConflict: 'id' }
    );

  return { error };
}

async function ensureProfileExists(userId: string, email: string) {
  const { data: existingProfile, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (lookupError) {
    return { error: lookupError };
  }

  if (existingProfile) {
    return { error: null };
  }

  const { error } = await supabase.from('profiles').insert({
    id: userId,
    email: email.trim(),
    full_name: '',
    role: 'student',
  });

  return { error };
}

export async function signUp(email: string, password: string, profile?: SignUpProfile) {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (!error) {
    const user = data.user ?? data.session?.user;

    if (user && profile) {
      await upsertProfileForUser(user.id, user.email ?? email, profile);
    }

    if (data.session) {
      setAuth(data.session);
    }
  }

  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (!error && data.session) {
    setAuth(data.session);
    void ensureProfileExists(data.session.user.id, data.session.user.email ?? email)
      .then(({ error: profileError }) => {
        if (profileError) {
          console.error('Failed to ensure the user profile:', profileError);
        }
      })
      .catch((profileError: unknown) => {
        console.error('Failed to ensure the user profile:', profileError);
      });
  }

  return { data, error };
}

export async function signOut() {
  setAuth(null);
  void supabase.auth.signOut().catch(() => {});
  return { error: null };
}

