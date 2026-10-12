import Ionicons from '@expo/vector-icons/Ionicons';
import { File, Paths } from 'expo-file-system';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useRef, useState } from 'react';
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
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getTeacherEventAttendance, type TeacherEventAttendance } from '@/lib/attendance';
import { createEvent, type CreatedEvent } from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';

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

export default function TeacherScreen() {
  const { user } = useAuth();
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
  const analyticsRequestInProgress = useRef(false);

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
      <View style={styles.container}>
        <Text style={styles.title}>Teacher Portal</Text>
        <Text style={styles.subtitle}>Checking your account...</Text>
      </View>
    );
  }

  if (role !== 'teacher') {
    return (
      <View style={styles.container}>
        <TeacherAccessCard />
      </View>
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
    if (analyticsEvents.length === 0 || exportingReport) return;

    setExportingReport(true);
    setAnalyticsError(null);
    try {
      const rows = analyticsEvents.flatMap((event) => {
        if (event.attendees.length === 0) {
          return [[event.title, event.eventCode, event.startTime ?? '', event.endTime ?? '', '', '']];
        }
        return event.attendees.map((attendee) => [
          event.title,
          event.eventCode,
          event.startTime ?? '',
          event.endTime ?? '',
          attendee.studentId,
          attendee.scannedAt,
        ]);
      });
      const csv = [
        ['Event Title', 'Event Code', 'Start Time', 'End Time', 'Student ID', 'Checked In At'],
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

  const totalCheckIns = analyticsEvents.reduce(
    (total, event) => total + event.attendeeCount,
    0
  );
  const recentCheckIns = analyticsEvents
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
      <View style={styles.analyticsSection}>
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
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={21} color={COLORS.primary} />
            <Text style={styles.statValue}>{analyticsEvents.length}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={21} color={COLORS.primary} />
            <Text style={styles.statValue}>{totalCheckIns}</Text>
            <Text style={styles.statLabel}>Check-ins</Text>
          </View>
        </View>

        {analyticsError && <Text style={styles.analyticsError}>{analyticsError}</Text>}

        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Recent Check-ins</Text>
          {analyticsLoading && analyticsEvents.length === 0 ? (
            <Text style={styles.analyticsEmpty}>Loading attendance data...</Text>
          ) : recentCheckIns.length === 0 ? (
            <Text style={styles.analyticsEmpty}>
              {analyticsEvents.length === 0
                ? 'No attendance data yet.'
                : 'No check-ins recorded yet.'}
            </Text>
          ) : (
            recentCheckIns.map((checkIn, index) => (
              <View
                key={`${checkIn.studentId}-${checkIn.scannedAt}-${index}`}
                style={styles.timelineRow}
              >
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
            ))
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={analyticsEvents.length === 0 || exportingReport}
          onPress={() => void handleExportReport()}
          style={({ pressed }) => [
            styles.exportButton,
            pressed && styles.exportButtonPressed,
            (analyticsEvents.length === 0 || exportingReport) && styles.disabledButton,
          ]}
        >
          <Ionicons name="download-outline" size={19} color={COLORS.textOnPrimary} />
          <Text style={styles.exportButtonText}>
            {exportingReport ? 'Preparing report...' : 'Export CSV Report'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Create Event QR</Text>
      <Text style={styles.subtitle}>
        Fill in the event details, then scan the generated QR with the Scan tab.
      </Text>

      <Text style={styles.label}>Event Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Founders Day Assembly"
        placeholderTextColor={COLORS.textSecondary}
        maxLength={150}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={description}
        onChangeText={setDescription}
        placeholder="Event details"
        placeholderTextColor={COLORS.textSecondary}
        multiline
        maxLength={1000}
      />

      <Text style={styles.label}>Venue</Text>
      <TextInput
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        placeholder="e.g. School auditorium"
        placeholderTextColor={COLORS.textSecondary}
        maxLength={200}
      />

      <Text style={styles.label}>Event Code</Text>
      <TextInput
        style={styles.input}
        value={eventId}
        onChangeText={setEventId}
        placeholder="e.g. EVT-2026-0002"
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="characters"
      />

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

      {message && <Text style={styles.message}>{message}</Text>}

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

      {payload && (
        <View style={styles.resultCard}>
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
          <View style={styles.qrBox}>
            <QRCode value={payload} size={200} />
          </View>
        </View>
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
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <Text style={styles.pickerValue}>{value}</Text>
      <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
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
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
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
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  analyticsSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  refreshButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  refreshButtonPressed: {
    backgroundColor: COLORS.background,
  },
  disabledButton: {
    opacity: 0.55,
  },
  analyticsStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    minHeight: 104,
    justifyContent: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    marginTop: 6,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  analyticsError: {
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  timelineCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  timelineTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  analyticsEmpty: {
    color: COLORS.textSecondary,
    fontSize: 13,
    paddingVertical: 8,
  },
  timelineRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  timelineDetails: {
    flex: 1,
    minWidth: 0,
  },
  timelineEvent: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  timelineMeta: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  timelineTime: {
    color: COLORS.textSecondary,
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
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  multilineInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  pickerField: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFieldPressed: {
    backgroundColor: COLORS.surface,
  },
  pickerValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
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
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 12,
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  createdEventTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 5,
  },
  createdEventMeta: {
    color: COLORS.textSecondary,
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
