import { router, Tabs, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RubberSegment from '@/components/RubberSegment';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';

const NAV_ITEMS = ['Home', 'History', 'Scan', 'Profile', 'Teacher'] as const;
const NAV_PATHS = ['/', '/history', '/scan', '/profile', '/teacher'] as const;

function SegmentTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const currentPath = pathname.replace(/\/$/, '') || '/';
  const matchedIndex = NAV_PATHS.findIndex((path) => path === currentPath);
  const currentIndex = Math.max(0, matchedIndex);

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <RubberSegment
        items={NAV_ITEMS}
        icons={{
          Home: 'home-outline',
          History: 'time-outline',
          Scan: 'scan-outline',
          Profile: 'person-outline',
          Teacher: 'school-outline',
        }}
        value={NAV_ITEMS[currentIndex]}
        onChange={(_value, index) => router.navigate(NAV_PATHS[index])}
        style={styles.segment}
      />
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    if (!user) {
      setRole(null);
      return;
    }

    let active = true;
    void getProfile(user.id).then((profile) => {
      if (active) setRole(profile?.role ?? 'student');
    }).catch((error: unknown) => {
      console.error('Could not load tab access role:', error);
      if (active) setRole('student');
    });

    return () => {
      active = false;
    };
  }, [user]);

  return (
    <Tabs
      tabBar={() => role === 'student' ? <SegmentTabBar /> : null}
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerShadowVisible: false,
        headerTintColor: COLORS.textPrimary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="teacher" options={{ title: 'Teacher' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  segment: {
    height: 48,
    marginBottom: 0,
  },
});
