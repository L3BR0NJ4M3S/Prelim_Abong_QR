import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import type { Role } from './profiles';
import type { Session, User } from '@supabase/supabase-js';

export type SignUpProfile = {
  full_name: string;
  role: Role;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let authState: AuthState = {
  session: null,
  user: null,
  loading: true,
};
const listeners = new Set<() => void>();
let hydrationPromise: Promise<void> | null = null;
const AUTH_SESSION_TIMEOUT_MS = 10_000;

function notify() {
  listeners.forEach((listener) => listener());
}

export function setAuth(session: Session | null) {
  authState = {
    session,
    user: session?.user ?? null,
    loading: false,
  };
  notify();
}

function hydrateAuth(): Promise<void> {
  if (hydrationPromise) {
    return hydrationPromise;
  }

  authState = { ...authState, loading: true };
  notify();

  hydrationPromise = (async () => {
    const timeout = setTimeout(() => {
      console.error('Timed out while restoring the auth session.');
      setAuth(null);
    }, AUTH_SESSION_TIMEOUT_MS);

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Failed to restore the auth session:', error);
      }
      setAuth(error ? null : data.session);
    } catch (error) {
      console.error('Failed to restore the auth session:', error);
      setAuth(null);
    } finally {
      clearTimeout(timeout);
    }
  })();

  return hydrationPromise;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuth(): AuthState {
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session);
    });
    void hydrateAuth();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return useSyncExternalStore(subscribe, () => authState, () => authState);
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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: profile?.full_name ?? '',
        requested_role: profile?.role ?? 'student',
      },
    },
  });

  if (!error) {
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
