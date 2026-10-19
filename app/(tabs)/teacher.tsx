import Ionicons from '@expo/vector-icons/Ionicons';
import { File, Paths } from 'expo-file-system';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import MotionShake from '@/components/MotionShake';
import MotionView from '@/components/MotionView';
import { COLORS } from '@/constants/colors';
import { signOut, useAuth } from '@/lib/auth';
import { getTeacherEventAttendance, setTeacherEventActive, type TeacherEventAttendance } from '@/lib/attendance';
import { createEvent, type CreatedEvent } from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';
import { supabase } from '@/lib/supabase';

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${month} ${pad(date.getDate())}, ${date.getFullYear()} at ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const QUICK_TIME_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

type EditTarget = 'start' | 'end';

const WEB_3D_STYLE: ViewStyle & { transformStyle: 'preserve-3d' } = {
  transformStyle: 'preserve-3d',
};

const ANALYTICS_REFRESH_MS = 30_000;
const TIMELINE_LIMIT = 10;
const ANALYTICS_PERIODS = ['Today', 'This week', 'This month', 'Semester', 'All time'] as const;
type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];
type AnalyticsSort = 'newest' | 'checkins' | 'name';

function getAnalyticsPeriodStart(period: AnalyticsPeriod, now: Date): Date | null {
  if (period === 'All time') return null;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'Today') return start;
  if (period === 'This week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return start;
  }
  if (period === 'This month') {
    start.setDate(1);
    return start;
  }
  start.setDate(1);
  start.setMonth(start.getMonth() - 5);
  return start;
}

export default function TeacherScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [payload, setPayload] = useState<string | null>(null);
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [analyticsEvents, setAnalyticsEvents] = useState<TeacherEventAttendance[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [lastAnalyticsUpdate, setLastAnalyticsUpdate] = useState<Date | null>(null);
  const [exportingReport, setExportingReport] = useState(false);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('All time');
  const [analyticsSearch, setAnalyticsSearch] = useState('');
  const [analyticsSort, setAnalyticsSort] = useState<AnalyticsSort>('newest');
  const analyticsRequestInProgress = useRef(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const refreshAnalytics = useCallback(async (showLoading = false) => {
    if (!user || analyticsRequestInProgress.current) return;

    analyticsRequestInProgress.current = true;
    if (showLoading) setAnalyticsLoading(true);

    try {
      const events = await getTeacherEventAttendance(user.id, { throwOnError: true });
      setAnalyticsEvents(events);
      setLastAnalyticsUpdate(new Date());
      setAnalyticsError(null);
    } catch (error) {
      console.error('Failed to refresh teacher analytics:', error);
      setAnalyticsError('Could not refresh attendance analytics. Please try again.');
    } finally {
      analyticsRequestInProgress.current = false;
      setAnalyticsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (role !== 'teacher' || !user) return;

    const channel = supabase
      .channel(`teacher-attendance-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => void refreshAnalytics()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshAnalytics, role, user]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let refreshInterval: ReturnType<typeof setInterval> | undefined;

      if (!user) {
        setRole(null);
        setRoleLoading(false);
        return () => {
          active = false;
          if (refreshInterval) clearInterval(refreshInterval);
        };
      }

      const loadRole = async () => {
        setRoleLoading(true);
        try {
          const profile = await getProfile(user.id);
          if (!active) return;
          const currentRole = profile?.role ?? 'student';
          setRole(currentRole);
          setRoleLoading(false);

          if (currentRole === 'teacher') {
            void refreshAnalytics(true);
            refreshInterval = setInterval(
              () => void refreshAnalytics(),
              ANALYTICS_REFRESH_MS
            );
          }
        } catch (error) {
          console.error('Failed to check teacher access:', error);
          if (!active) return;
          setRole(null);
          setRoleLoading(false);
        }
      };

      void loadRole();

      return () => {
        active = false;
        if (refreshInterval) clearInterval(refreshInterval);
      };
    }, [refreshAnalytics, user])
  );

  const isAndroid = Platform.OS === 'android';

  if (roleLoading) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.accessContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Teacher Portal</Text>
        <Text style={styles.subtitle}>Checking your account...</Text>
      </ScrollView>
    );
  }

  if (role !== 'teacher') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.accessContent}
        showsVerticalScrollIndicator={false}
      >
        <TeacherAccessCard />
      </ScrollView>
    );
  }

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!editTarget) return;
    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current = editTarget === 'start' ? startDate : endDate;
    const next = new Date(current);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (editTarget === 'start') setStartDate(next);
    else setEndDate(next);

    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleQuickStart = (ms: number) => {
    setMessage(null);
    const nextStart = new Date(Date.now() + ms);
    setStartDate(nextStart);
    if (endDate.getTime() <= nextStart.getTime()) {
      setEndDate(new Date(nextStart.getTime() + 60 * 60 * 1000));
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(new Date(startDate.getTime() + ms));
  };

  const handleCreateEvent = async () => {
    if (savingEvent) return;
    const event = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      description: description.trim(),
      location: location.trim(),
    };

    if (!event.eventId || !event.title) {
      setMessage('Event title and code are required.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('End time must be after start time.');
      return;
    }

    setSavingEvent(true);
    setMessage(null);
    setPayload(null);
    setCreatedEvent(null);
    try {
      const createdEvent = await createEvent(event);
      setCreatedEvent(createdEvent);
      setMessage('Event saved! Scan the QR with the Scan tab to test it.');
      setPayload(
        buildQRPayload({
          eventId: createdEvent.id,
          token: createdEvent.qr_token,
        })
      );
      void refreshAnalytics();
    } catch (error) {
      console.error('Failed to create teacher event:', error);
      setMessage(
        error instanceof Error && error.message.includes('duplicate key')
          ? 'That event code is already in use. Choose a different code.'
          : 'Could not save the event. Please check the details and try again.'
      );
    } finally {
      setSavingEvent(false);
    }
  };

  const handleExportReport = async () => {
    if (filteredEvents.length === 0 || exportingReport) return;

    setExportingReport(true);
    setAnalyticsError(null);
    try {
      const rows = filteredEvents.flatMap((event) => {
        if (event.attendees.length === 0) {
          return [[event.title, event.eventCode, event.startTime ?? '', event.endTime ?? '', event.attendeeCount.toString(), '', '']];
        }
        return event.attendees.map((attendee) => [
          event.title,
          event.eventCode,
          event.startTime ?? '',
          event.endTime ?? '',
          event.attendeeCount.toString(),
          attendee.studentId,
          attendee.scannedAt,
        ]);
      });
      const csv = [
        ['Report generated at', new Date().toISOString()],
        ['Report created by', user?.email ?? user?.id ?? 'Authorized teacher'],
        ['Date range', analyticsPeriod],
        [],
        ['Event Title', 'Event Code', 'Start Time', 'End Time', 'Event Check-ins', 'Student ID', 'Checked In At'],
        ...rows,
      ]
        .map((row) => row.map(escapeCsvField).join(','))
        .join('\r\n');
      const filename = `attendance-report-${new Date().toISOString().slice(0, 10)}-${Date.now()}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(downloadUrl);
      } else {
        const file = new File(Paths.cache, filename);
        file.write(csv);
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export attendance report',
          UTI: 'public.comma-separated-values-text',
        });
      }
    } catch (error) {
      console.error('Failed to export attendance report:', error);
      setAnalyticsError('Could not export the report. Please try again.');
    } finally {
      setExportingReport(false);
    }
  };

  const handleToggleEvent = async (event: TeacherEventAttendance) => {
    if (updatingEventId) return;
    setUpdatingEventId(event.eventId);
    setAnalyticsError(null);
    try {
      await setTeacherEventActive(event.eventId, !event.isActive);
      setAnalyticsEvents((current) => current.map((item) => item.eventId === event.eventId
        ? { ...item, isActive: !item.isActive }
        : item));
    } catch (error) {
      console.error('Failed to update teacher event status:', error);
      setAnalyticsError('Could not update this event. Please try again.');
    } finally {
      setUpdatingEventId(null);
    }
  };

  const analyticsNow = Date.now();
  const periodStart = getAnalyticsPeriodStart(analyticsPeriod, new Date(analyticsNow));
  const normalizedSearch = analyticsSearch.trim().toLocaleLowerCase();
  const filteredEvents = analyticsEvents
    .map((event) => {
      const attendees =
        periodStart === null
          ? event.attendees
          : event.attendees.filter(
              (attendee) => {
                const scannedAt = new Date(attendee.scannedAt).getTime();
                return scannedAt >= periodStart.getTime() && scannedAt <= analyticsNow;
              }
            );
      const startedInPeriod =
        periodStart !== null &&
        event.startTime !== null &&
        new Date(event.startTime).getTime() >= periodStart.getTime() &&
        new Date(event.startTime).getTime() <= analyticsNow;

      return { ...event, attendees, attendeeCount: attendees.length, startedInPeriod };
    })
    .filter((event) => {
      const matchesPeriod =
        periodStart === null || event.startedInPeriod || event.attendeeCount > 0;
      const matchesSearch =
        !normalizedSearch ||
        event.title.toLocaleLowerCase().includes(normalizedSearch) ||
        event.eventCode.toLocaleLowerCase().includes(normalizedSearch);
      return matchesPeriod && matchesSearch;
    })
    .sort((left, right) => {
      if (analyticsSort === 'name') return left.title.localeCompare(right.title);
      if (analyticsSort === 'checkins') return right.attendeeCount - left.attendeeCount;
      return (
        new Date(right.startTime ?? 0).getTime() -
        new Date(left.startTime ?? 0).getTime()
      );
    });
  const totalCheckIns = filteredEvents.reduce(
    (total, event) => total + event.attendeeCount,
    0
  );
  const recentCheckIns = filteredEvents
    .flatMap((event) =>
      event.attendees.map((attendee) => ({
        ...attendee,
        eventTitle: event.title,
      }))
    )
    .sort(
      (left, right) =>
        new Date(right.scannedAt).getTime() - new Date(left.scannedAt).getTime()
    )
    .slice(0, TIMELINE_LIMIT);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Teacher Portal</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={() => void handleSignOut()}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutButtonPressed,
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={COLORS.textPrimary} />
          <Text style={styles.signOutLabel}>Sign Out</Text>
        </Pressable>
      </View>
      <MotionView style={styles.analyticsSection} delay={40} duration={380}>
        <View style={styles.analyticsHeader}>
          <View style={styles.analyticsHeading}>
            <Text style={styles.analyticsTitle}>Attendance Analytics</Text>
            <Text style={styles.analyticsSubtitle}>
              {lastAnalyticsUpdate
                ? `Updated ${lastAnalyticsUpdate.toLocaleTimeString()} · refreshes every 30 seconds`
                : 'Updates every 30 seconds'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh attendance analytics"
            disabled={analyticsLoading}
            onPress={() => void refreshAnalytics(true)}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.refreshButtonPressed,
              analyticsLoading && styles.disabledButton,
            ]}
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color={COLORS.primary}
            />
          </Pressable>
        </View>

        <View style={styles.analyticsStats}>
          <MotionView style={styles.statCard} delay={70}>
            <Ionicons name="calendar-outline" size={21} color={COLORS.workflowAccent} />
            <Text style={styles.statValue}>{filteredEvents.length}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </MotionView>
          <MotionView style={styles.statCard} delay={125}>
            <Ionicons name="people-outline" size={21} color={COLORS.workflowAccent} />
            <Text style={styles.statValue}>{totalCheckIns}</Text>
            <Text style={styles.statLabel}>Present check-ins</Text>
          </MotionView>
        </View>
        <Text style={styles.analyticsNote}>
          Totals reflect recorded check-ins. Attendance rates and absences are not shown
          because event-eligible student rosters are not configured.
        </Text>

        <Text style={styles.filterLabel}>Date range</Text>
        <View style={styles.filterRow}>
          {ANALYTICS_PERIODS.map((period) => (
            <Pressable
              key={period}
              accessibilityRole="button"
              accessibilityState={{ selected: analyticsPeriod === period }}
              onPress={() => setAnalyticsPeriod(period)}
              style={[
                styles.filterChip,
                analyticsPeriod === period && styles.filterChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  analyticsPeriod === period && styles.filterChipTextSelected,
                ]}
              >
                {period}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          accessibilityLabel="Search event reports"
          style={styles.analyticsSearch}
          value={analyticsSearch}
          onChangeText={setAnalyticsSearch}
          placeholder="Search event title or code"
          placeholderTextColor={COLORS.workflowMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.sortRow}>
          <Text style={styles.filterLabel}>Compare events by</Text>
          {([
            ['newest', 'Date'],
            ['checkins', 'Check-ins'],
            ['name', 'Name'],
          ] as const).map(([sort, label]) => (
            <Pressable
              key={sort}
              accessibilityRole="button"
              accessibilityState={{ selected: analyticsSort === sort }}
              onPress={() => setAnalyticsSort(sort)}
              style={[
                styles.sortButton,
                analyticsSort === sort && styles.sortButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.sortButtonText,
                  analyticsSort === sort && styles.sortButtonTextSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.comparisonCard}>
          <Text style={styles.timelineTitle}>Attendance by Event</Text>
          {filteredEvents.length === 0 ? (
            <Text style={styles.analyticsEmpty}>No events match this date range or search.</Text>
          ) : (
            filteredEvents.map((event, index) => (
              <MotionView key={event.eventId} delay={Math.min(index * 55, 220)} offset={8}>
              <View style={styles.comparisonRow}>
                <View style={styles.timelineDetails}>
                  <Text style={styles.timelineEvent} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <Text style={styles.timelineMeta}>
                    {event.eventCode} · {event.startTime
                      ? new Date(event.startTime).toLocaleDateString()
                      : 'Date unavailable'}
                  </Text>
                </View>
                <Text style={styles.comparisonCount}>
                  {event.attendeeCount} {event.attendeeCount === 1 ? 'check-in' : 'check-ins'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${event.isActive ? 'Deactivate' : 'Activate'} ${event.title}`}
                  disabled={Boolean(updatingEventId)}
                  onPress={() => void handleToggleEvent(event)}
                  style={[styles.eventStatusButton, updatingEventId === event.eventId && styles.disabledButton]}
                >
                  <Text style={styles.eventStatusButtonText}>
                    {event.isActive ? 'Pause' : 'Activate'}
                  </Text>
                </Pressable>
              </View>
              </MotionView>
            ))
          )}
        </View>

        {analyticsError && <Text style={styles.analyticsError}>{analyticsError}</Text>}

        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Recent Check-ins</Text>
          {analyticsLoading && analyticsEvents.length === 0 ? (
            <Text style={styles.analyticsEmpty}>Loading attendance data...</Text>
          ) : recentCheckIns.length === 0 ? (
            <Text style={styles.analyticsEmpty}>
              {filteredEvents.length === 0
                ? 'No attendance data yet.'
                : 'No check-ins recorded yet.'}
            </Text>
          ) : (
            recentCheckIns.map((checkIn) => (
              <MotionView
                key={`${checkIn.studentId}-${checkIn.scannedAt}-${checkIn.eventTitle}`}
                delay={65}
                offset={8}
              >
              <View style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineDetails}>
                  <Text style={styles.timelineEvent} numberOfLines={1}>
                    {checkIn.eventTitle}
                  </Text>
                  <Text style={styles.timelineMeta}>
                    Student …{checkIn.studentId.slice(-8)}
                  </Text>
                </View>
                <Text style={styles.timelineTime}>
                  {new Date(checkIn.scannedAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              </MotionView>
            ))
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={filteredEvents.length === 0 || exportingReport}
          onPress={() => void handleExportReport()}
          style={({ pressed }) => [
            styles.exportButton,
            pressed && styles.exportButtonPressed,
            (filteredEvents.length === 0 || exportingReport) && styles.disabledButton,
          ]}
        >
          <Ionicons name="download-outline" size={19} color={COLORS.textOnPrimary} />
          <Text style={styles.exportButtonText}>
            {exportingReport ? 'Preparing report...' : 'Export CSV Report'}
          </Text>
        </Pressable>
      </MotionView>

      <MotionView style={styles.eventForm} delay={120} duration={380}>
        <Text style={styles.eventFormTitle}>Create Event QR</Text>
        <Text style={styles.eventFormSubtitle}>
          Fill in the event details, then scan the generated QR with the Scan tab.
        </Text>

        <MotionView delay={70}>
        <Text style={styles.label}>Event Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Founders Day Assembly"
          placeholderTextColor={COLORS.workflowMuted}
          maxLength={150}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="Event details"
          placeholderTextColor={COLORS.workflowMuted}
          multiline
          maxLength={1000}
        />
        </MotionView>

        <MotionView delay={130}>
        <Text style={styles.label}>Venue</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. School auditorium"
          placeholderTextColor={COLORS.workflowMuted}
          maxLength={200}
        />

        <Text style={styles.label}>Event Code</Text>
        <TextInput
          style={styles.input}
          value={eventId}
          onChangeText={setEventId}
          placeholder="e.g. EVT-2026-0002"
          placeholderTextColor={COLORS.workflowMuted}
          autoCapitalize="characters"
        />
        </MotionView>

        <MotionView delay={190}>
        <Text style={styles.label}>Starts</Text>
        <PickerField
          value={formatDateTime(startDate)}
          icon="sunny-outline"
          onPress={() => openPicker('start')}
        />
        <View style={styles.chipRow}>
          {QUICK_TIME_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              style={styles.chip}
              onPress={() => handleQuickStart(option.ms)}
            >
              <Text style={styles.chipText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Ends</Text>
        <PickerField
          value={formatDateTime(endDate)}
          icon="moon-outline"
          onPress={() => openPicker('end')}
        />
        <View style={styles.chipRow}>
          {QUICK_TIME_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              style={styles.chip}
              onPress={() => handleQuickEnd(option.ms)}
            >
              <Text style={styles.chipText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        </MotionView>

        {message && (
          <MotionShake
            trigger={
              message.includes('required') || message.includes('after start time')
                ? message
                : null
            }
          >
            <Text
              style={[
                styles.message,
                (message.includes('required') || message.includes('after start time')) &&
                  styles.messageError,
              ]}
            >
              {message}
            </Text>
          </MotionShake>
        )}

        <AppButton
          theme="primary"
          title={savingEvent ? 'Creating Event...' : 'Create Event'}
          icon="add-circle-outline"
          onPress={handleCreateEvent}
          disabled={savingEvent}
        />

        {editTarget && (
          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={editTarget === 'start' ? startDate : endDate}
              mode={isAndroid ? editingPart : 'datetime'}
              display={isAndroid ? 'default' : 'spinner'}
              onChange={onPickerChange}
            />
          </View>
        )}
      </MotionView>

      {payload && (
        <MotionView key={payload} style={styles.resultCard} offset={0} scaleFrom={0.94} duration={280}>
          <Text style={styles.createdEventTitle}>{createdEvent?.title}</Text>
          <Text style={styles.createdEventMeta}>
            {createdEvent?.location || 'Venue not specified'}
          </Text>
          <Text style={styles.createdEventMeta}>
            {createdEvent &&
              `${formatDateTime(new Date(createdEvent.start_time))} – ${formatDateTime(
                new Date(createdEvent.end_time)
              )}`}
          </Text>
          <Text style={styles.resultTitle}>
            Scan this secure QR code during the event:
          </Text>
          <MotionView delay={80} offset={0} scaleFrom={0.88} duration={260}>
            <View style={styles.qrBox}>
              <QRCode value={payload} size={200} />
            </View>
          </MotionView>
        </MotionView>
      )}
    </ScrollView>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({ value, icon, onPress }: PickerFieldProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pickerField, pressed && styles.pickerFieldPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={COLORS.workflowAccent} />
      <Text style={styles.pickerValue}>{value}</Text>
      <Ionicons name="calendar-outline" size={18} color={COLORS.workflowMuted} />
    </Pressable>
  );
}

function escapeCsvField(value: string) {
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function TeacherAccessCard() {
  const [flipped, setFlipped] = useState(false);
  const flipValue = useRef(new Animated.Value(0)).current;
  const rotation = flipValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const flipCard = () => {
    const nextFlipped = !flipped;
    setFlipped(nextFlipped);
    Animated.spring(flipValue, {
      toValue: nextFlipped ? 1 : 0,
      friction: 8,
      tension: 50,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={flipped ? 'Teacher access details' : 'Teachers only'}
      accessibilityHint="Double-tap to flip the card and read more"
      accessibilityState={{ expanded: flipped }}
      onPress={flipCard}
      style={styles.lockCardContainer}
    >
      <Animated.View
        style={[
          styles.lockCardRotor,
          Platform.OS === 'web' && WEB_3D_STYLE,
          { transform: [{ perspective: 1000 }, { rotateY: rotation }] },
        ]}
      >
        <View style={[styles.lockCardFace, styles.lockCardFront]}>
          <Ionicons name="lock-closed-outline" size={42} color={COLORS.primary} />
          <Text style={styles.lockTitle}>Teachers Only</Text>
          <Text style={styles.lockHint}>TAP TO TURN OVER</Text>
        </View>
        <View style={[styles.lockCardFace, styles.lockCardBack]}>
          <Ionicons name="school-outline" size={38} color={COLORS.primary} />
          <Text style={styles.lockTitle}>Teacher Access</Text>
          <Text style={styles.lockText}>
            This Section is a secure dashboard exclusively for authorized
            teachers to create attendance events and generate unique QR codes
            for classes, seminars, meetings, and school activities. Teachers
            can manage event schedules, activate or close attendance sessions,
            monitor student check-ins, and view or export attendance reports.
            The system includes role-based access control to prevent students
            from creating events, generating QR codes, or modifying attendance
            records. Students can only scan valid QR codes to record their
            attendance. The interface should be user-friendly, responsive,
            secure, and accessible across devices, ensuring accurate and
            efficient attendance management.
          </Text>
          <Text style={styles.lockHint}>TAP TO RETURN</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pageTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 10,
    backgroundColor: COLORS.workflowSurface,
  },
  signOutButtonPressed: {
    opacity: 0.72,
  },
  signOutLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  accessContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  analyticsSection: {
    padding: 16,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    backgroundColor: COLORS.workflowSurface,
  },
  eventForm: {
    padding: 18,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    backgroundColor: COLORS.workflowSurface,
  },
  eventFormTitle: {
    color: COLORS.workflowText,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventFormSubtitle: {
    color: COLORS.workflowMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  analyticsHeading: {
    flex: 1,
    marginRight: 12,
  },
  analyticsTitle: {
    color: COLORS.workflowText,
    fontSize: 18,
    fontWeight: '700',
  },
  analyticsSubtitle: {
    color: COLORS.workflowMuted,
    fontSize: 11,
    marginTop: 4,
  },
  refreshButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 12,
    backgroundColor: COLORS.workflowSurfaceRaised,
  },
  refreshButtonPressed: {
    backgroundColor: COLORS.workflowSurfaceRaised,
  },
  disabledButton: {
    opacity: 0.55,
  },
  analyticsStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  analyticsNote: {
    color: COLORS.workflowMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: -6,
    marginBottom: 14,
  },
  filterLabel: {
    color: COLORS.workflowMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: COLORS.workflowSurfaceRaised,
  },
  filterChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    color: COLORS.workflowMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: COLORS.textOnPrimary,
  },
  analyticsSearch: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 10,
    backgroundColor: COLORS.workflowSurfaceRaised,
    color: COLORS.workflowText,
    fontSize: 13,
    marginBottom: 12,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  sortButton: {
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  sortButtonSelected: {
    borderColor: COLORS.primary,
  },
  sortButtonText: {
    color: COLORS.workflowMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  sortButtonTextSelected: {
    color: COLORS.workflowAccent,
  },
  comparisonCard: {
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 12,
    backgroundColor: COLORS.workflowSurfaceRaised,
  },
  comparisonRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.workflowBorder,
  },
  comparisonCount: {
    flexShrink: 1,
    color: COLORS.workflowAccent,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  eventStatusButton: {
    minWidth: 64,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 6,
    backgroundColor: COLORS.workflowSurface,
  },
  eventStatusButtonText: {
    color: COLORS.workflowAccent,
    fontSize: 11,
    fontWeight: '700',
  },
  statCard: {
    flex: 1,
    minHeight: 104,
    justifyContent: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 12,
    backgroundColor: COLORS.workflowSurfaceRaised,
  },
  statValue: {
    color: COLORS.workflowText,
    fontSize: 26,
    fontWeight: '700',
    marginTop: 6,
  },
  statLabel: {
    color: COLORS.workflowMuted,
    fontSize: 12,
    marginTop: 1,
  },
  analyticsError: {
    color: COLORS.workflowDanger,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  timelineCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 12,
    backgroundColor: COLORS.workflowSurfaceRaised,
  },
  timelineTitle: {
    color: COLORS.workflowText,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  analyticsEmpty: {
    color: COLORS.workflowMuted,
    fontSize: 13,
    paddingVertical: 8,
  },
  timelineRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.workflowBorder,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.workflowAccent,
  },
  timelineDetails: {
    flex: 1,
    minWidth: 0,
  },
  timelineEvent: {
    color: COLORS.workflowText,
    fontSize: 13,
    fontWeight: '600',
  },
  timelineMeta: {
    color: COLORS.workflowMuted,
    fontSize: 11,
    marginTop: 3,
  },
  timelineTime: {
    color: COLORS.workflowMuted,
    fontSize: 11,
  },
  exportButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  exportButtonPressed: {
    backgroundColor: '#B18D4E',
  },
  exportButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.workflowText,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.workflowSurfaceRaised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.workflowText,
  },
  multilineInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  pickerField: {
    backgroundColor: COLORS.workflowSurfaceRaised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFieldPressed: {
    backgroundColor: COLORS.workflowSurface,
    borderColor: COLORS.workflowAccent,
  },
  pickerValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.workflowText,
    marginHorizontal: 10,
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  chip: {
    backgroundColor: COLORS.workflowSurfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.workflowAccent,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  lockCardContainer: {
    height: 500,
    margin: 24,
  },
  lockCardRotor: {
    flex: 1,
  },
  lockCardFace: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  lockCardFront: {
    transform: [{ rotateY: '0deg' }],
  },
  lockCardBack: {
    transform: [{ rotateY: '180deg' }],
    backgroundColor: COLORS.surface,
  },
  lockTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  lockText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  lockHint: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: 20,
  },
  pickerContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  message: {
    fontSize: 14,
    color: COLORS.workflowAccent,
    textAlign: 'center',
    marginTop: 12,
  },
  messageError: {
    color: COLORS.workflowDanger,
  },
  resultCard: {
    backgroundColor: COLORS.workflowSurface,
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.workflowText,
    textAlign: 'center',
    marginBottom: 12,
  },
  createdEventTitle: {
    color: COLORS.workflowText,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 5,
  },
  createdEventMeta: {
    color: COLORS.workflowMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 5,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
});
