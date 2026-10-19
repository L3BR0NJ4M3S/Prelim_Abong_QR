import { Stack, useRouter, useSegments } from 'expo-router';
import { usePathname } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const pathname = usePathname().replace(/\/$/, '') || '/';
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const path = segments?.[0];
  const inAuthGroup = path === 'welcome' || path === 'login' || path === 'register';
  const inTabsGroup = segments.includes('(tabs)');
  const inProtectedRoute = inTabsGroup || pathname === '/admin';

  useEffect(() => {
    if (loading) return;
    if (!session) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    let active = true;
    setRoleLoading(true);
    void getProfile(session.user.id)
      .then((profile) => {
        if (active) setRole(profile?.role ?? 'student');
      })
      .catch((error: unknown) => {
        console.error('Could not load account role:', error);
        if (active) setRole('student');
      })
      .finally(() => {
        if (active) setRoleLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loading, session?.user.id]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!session && inProtectedRoute) {
      router.replace('/login');
      return;
    }

    if (!session || roleLoading || !role) return;

    if (role === 'admin' && pathname !== '/admin') {
      router.replace('/admin');
    } else if (role === 'teacher' && pathname !== '/teacher') {
      router.replace('/(tabs)/teacher');
    } else if (role === 'student' && pathname === '/admin') {
      router.replace('/(tabs)');
    } else if (inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [inAuthGroup, inProtectedRoute, loading, pathname, role, roleLoading, router, session]);

  if (session && roleLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
});
