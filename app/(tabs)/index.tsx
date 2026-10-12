import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import {
  getStudentDashboardData,
  type StudentDashboardData,
} from '@/lib/attendanceDashboard';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!user) {
      setDashboard(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const result = await getStudentDashboardData(user.id);
      setDashboard(result);
      setError(null);
    } catch (loadError) {
      console.error('Failed to load student attendance dashboard:', loadError);
      setError('Could not load your attendance overview. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard])
  );

  const maxMonthlyCount = Math.max(
    1,
    ...(dashboard?.monthlyAttendance.map((month) => month.count) ?? [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Header title="QR Attendance" />
        </View>

        <View style={styles.headingRow}>
          <View>
            <Text style={styles.mainTitle}>Attendance Overview</Text>
            <Text style={styles.subtitle}>Your participation at a glance.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh attendance overview"
            onPress={() => void loadDashboard()}
            disabled={loading}
            style={styles.refreshButton}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={21} color={COLORS.primary} />
            )}
          </Pressable>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadDashboard()}
              disabled={loading}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {loading && !dashboard ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.stateText}>Loading your attendance...</Text>
          </View>
        ) : dashboard ? (
          <>
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Events attended</Text>
                <Text style={styles.metricValue}>{dashboard.totalAttended}</Text>
                <Text style={styles.metricHint}>All recorded check-ins</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>This month</Text>
                <Text style={styles.metricValue}>
                  {dashboard.monthlyAttendance.at(-1)?.count ?? 0}
                </Text>
                <Text style={styles.metricHint}>Recorded check-ins</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Monthly attendance</Text>
                <Ionicons
                  name="bar-chart-outline"
                  size={19}
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.chart}>
                {dashboard.monthlyAttendance.map((month, index) => (
                  <View key={`${month.month}-${index}`} style={styles.chartColumn}>
                    <Text style={styles.chartCount}>{month.count || ''}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${Math.max(
                              6,
                              (month.count / maxMonthlyCount) * 100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.chartLabel}>{month.month}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Upcoming events</Text>
                <Ionicons
                  name="calendar-outline"
                  size={19}
                  color={COLORS.primary}
                />
              </View>
              {dashboard.upcomingEvents.length === 0 ? (
                <Text style={styles.emptyText}>No upcoming events available.</Text>
              ) : (
                dashboard.upcomingEvents.map((event) => (
                  <View key={event.id} style={styles.eventRow}>
                    <View style={styles.eventIcon}>
                      <Ionicons
                        name="calendar"
                        size={17}
                        color={COLORS.primary}
                      />
                    </View>
                    <View style={styles.eventDetails}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <Text style={styles.eventTime}>
                        {formatDateTime(event.startTime)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Recent attendance</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/history')}
                >
                  <Text style={styles.linkText}>View history</Text>
                </Pressable>
              </View>
              {dashboard.recentAttendance.length === 0 ? (
                <Text style={styles.emptyText}>
                  Your recorded check-ins will appear here.
                </Text>
              ) : (
                dashboard.recentAttendance.map((record) => (
                  <View key={record.id} style={styles.attendanceRow}>
                    <View style={styles.checkIcon}>
                      <Ionicons
                        name="checkmark"
                        size={15}
                        color={COLORS.success}
                      />
                    </View>
                    <View style={styles.eventDetails}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {record.eventTitle}
                      </Text>
                      <Text style={styles.eventTime}>
                        {formatDateTime(record.scannedAt)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : !loading && !error ? (
          <View style={styles.emptyDashboard}>
            <Text style={styles.emptyText}>Sign in to view your attendance overview.</Text>
          </View>
        ) : null}

        <View style={styles.footerContainer}>
          <AppButton
            theme="primary"
            title="Scan QR Code"
            icon="qr-code-outline"
            onPress={() => router.push('/scan')}
          />
          <AppButton
            title="Attendance History"
            icon="time-outline"
            onPress={() => router.push('/history')}
          />
          <AppButton
            title="Profile"
            icon="person-outline"
            onPress={() => router.push('/profile')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerContainer: { justifyContent: 'center' },
  headingRow: {
    width: '100%',
    maxWidth: 600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: { fontSize: 14, color: COLORS.textSecondary },
  refreshButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  errorBanner: {
    width: '100%',
    maxWidth: 600,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderColor: COLORS.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { flex: 1, color: COLORS.textPrimary, fontSize: 13, marginRight: 8 },
  retryText: { color: COLORS.primary, fontWeight: '700' },
  loadingState: {
    minHeight: 180,
    width: '100%',
    maxWidth: 600,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateText: { color: COLORS.textSecondary, fontSize: 14 },
  metricsRow: {
    width: '100%',
    maxWidth: 600,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    minHeight: 116,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  metricLabel: { color: COLORS.textSecondary, fontSize: 13 },
  metricValue: {
    color: COLORS.primary,
    fontSize: 30,
    fontWeight: '700',
    marginTop: 5,
  },
  metricHint: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  sectionCard: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  chart: {
    height: 132,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  chartColumn: { flex: 1, height: '100%', alignItems: 'center' },
  chartCount: { color: COLORS.textSecondary, fontSize: 11, height: 18 },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 5,
    overflow: 'hidden',
  },
  bar: {
    width: '70%',
    minHeight: 4,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  chartLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 6 },
  emptyText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  eventIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    marginRight: 11,
  },
  eventDetails: { flex: 1 },
  eventTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  eventTime: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  linkText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  checkIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    marginRight: 12,
  },
  emptyDashboard: {
    width: '100%',
    maxWidth: 600,
    minHeight: 120,
    justifyContent: 'center',
  },
  footerContainer: {
    alignItems: 'center',
    paddingHorizontal: 4,
    width: '100%',
    maxWidth: 600,
    marginTop: 4,
  },
});
