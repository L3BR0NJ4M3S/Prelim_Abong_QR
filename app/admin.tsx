import Ionicons from '@expo/vector-icons/Ionicons';
import { File, Paths } from 'expo-file-system';
import { useFocusEffect, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import MotionView from '@/components/MotionView';
import { COLORS } from '@/constants/colors';
import {
  deleteAdminAttendance,
  deleteAdminEvent,
  getAdminAttendance,
  getAdminEvents,
  updateAdminAttendanceTime,
  updateAdminEvent,
  type AdminAttendance,
  type AdminEvent,
} from '@/lib/admin';
import { signOut, useAuth } from '@/lib/auth';
import {
  getAdminProfiles,
  updateProfileRole,
  type AdminProfile,
  type Role,
} from '@/lib/profiles';

const ROLES: Role[] = ['student', 'teacher', 'admin'];

export default function AdminScreen() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [attendance, setAttendance] = useState<AdminAttendance[]>([]);
  const [eventDrafts, setEventDrafts] = useState<Record<string, { title: string; location: string }>>({});
  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<string, string>>({});
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [savingRecordId, setSavingRecordId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProfiles, nextEvents, nextAttendance] = await Promise.all([
        getAdminProfiles(),
        getAdminEvents(),
        getAdminAttendance(),
      ]);
      setProfiles(nextProfiles);
      setEvents(nextEvents);
      setAttendance(nextAttendance);
    } catch (loadError) {
      console.error('Failed to load admin user list:', loadError);
      setError('Admin access is required to manage accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfiles();
    }, [loadProfiles])
  );

  const handleRoleChange = async (profile: AdminProfile, role: Role) => {
    if (savingUserId || profile.role === role) return;
    setSavingUserId(profile.id);
    setError(null);
    setMessage(null);
    try {
      await updateProfileRole(profile.id, role);
      setProfiles((current) =>
        current.map((item) => item.id === profile.id ? { ...item, role } : item)
      );
      setMessage(`${profile.email} is now ${roleLabel(role)}.`);
    } catch (updateError) {
      console.error('Failed to update account role:', updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Could not update this account role.'
      );
    } finally {
      setSavingUserId(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const handleSaveEvent = async (event: AdminEvent) => {
    const draft = eventDrafts[event.id] ?? { title: event.title, location: event.location ?? '' };
    setSavingRecordId(event.id);
    setError(null);
    try {
      await updateAdminEvent({ ...event, ...draft });
      setEvents((current) => current.map((item) => item.id === event.id
        ? { ...item, title: draft.title.trim(), location: draft.location.trim() || null }
        : item));
      setEditingEventId(null);
      setMessage('Event details updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update this event.');
    } finally {
      setSavingRecordId(null);
    }
  };

  const handleToggleEvent = async (event: AdminEvent) => {
    setSavingRecordId(event.id);
    setError(null);
    try {
      await updateAdminEvent({ ...event, is_active: !event.is_active });
      setEvents((current) => current.map((item) => item.id === event.id
        ? { ...item, is_active: !item.is_active }
        : item));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update event status.');
    } finally {
      setSavingRecordId(null);
    }
  };

  const handleDeleteEvent = async (event: AdminEvent) => {
    setSavingRecordId(event.id);
    setError(null);
    try {
      await deleteAdminEvent(event.id);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      setAttendance((current) => current.filter((item) => item.event_id !== event.id));
      setPendingDelete(null);
      setMessage('Event and its attendance records were removed.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this event.');
    } finally {
      setSavingRecordId(null);
    }
  };

  const handleSaveAttendanceTime = async (record: AdminAttendance) => {
    const value = attendanceDrafts[record.id] ?? record.scanned_at;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      setError('Enter a valid date and time for the attendance record.');
      return;
    }
    setSavingRecordId(record.id);
    setError(null);
    try {
      const scannedAt = parsed.toISOString();
      await updateAdminAttendanceTime(record.id, scannedAt);
      setAttendance((current) => current.map((item) => item.id === record.id
        ? { ...item, scanned_at: scannedAt }
        : item));
      setAttendanceDrafts((current) => ({ ...current, [record.id]: scannedAt }));
      setMessage('Attendance time corrected.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not correct this record.');
    } finally {
      setSavingRecordId(null);
    }
  };

  const handleDeleteAttendance = async (record: AdminAttendance) => {
    setSavingRecordId(record.id);
    setError(null);
    try {
      await deleteAdminAttendance(record.id);
      setAttendance((current) => current.filter((item) => item.id !== record.id));
      setEvents((current) => current.map((item) => item.id === record.event_id
        ? { ...item, attendee_count: Math.max(0, item.attendee_count - 1) }
        : item));
      setPendingDelete(null);
      setMessage('Attendance record removed.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not remove this record.');
    } finally {
      setSavingRecordId(null);
    }
  };

  const handleExportReport = async () => {
    if (exporting || attendance.length === 0) return;
    setExporting(true);
    setError(null);
    try {
      const csv = [
        ['System Attendance Report', new Date().toISOString()],
        ['Total events', String(events.length)],
        ['Total check-ins', String(attendance.length)],
        [],
        ['Event', 'Event Code', 'Student Name', 'Student Email', 'Student ID', 'Checked In At'],
        ...attendance.map((record) => [
          record.event_title,
          record.event_code,
          record.student_name,
          record.student_email,
          record.student_id,
          record.scanned_at,
        ]),
      ].map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
      const filename = `system-attendance-${new Date().toISOString().slice(0, 10)}.csv`;
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.cache, filename);
        file.write(csv);
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export system attendance report',
          UTI: 'public.comma-separated-values-text',
        });
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Could not export the report.');
    } finally {
      setExporting(false);
    }
  };

  const adminCount = profiles.filter((profile) => profile.role === 'admin').length;
  const teacherCount = profiles.filter((profile) => profile.role === 'teacher').length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <MotionView style={styles.header} duration={360}>
          <View>
            <Text style={styles.eyebrow}>QR-ATT / CONTROL ROOM</Text>
            <Text style={styles.title}>User Management</Text>
            <Text style={styles.subtitle}>Accounts and access roles</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh user list"
            disabled={loading}
            onPress={() => void loadProfiles()}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={20} color={COLORS.primary} />
            )}
          </Pressable>
        </MotionView>

        <View style={styles.summaryRow}>
          <Summary label="Accounts" value={profiles.length} />
          <Summary label="Teachers" value={teacherCount} />
          <Summary label="Admins" value={adminCount} />
        </View>

        <View style={styles.summaryRow}>
          <Summary label="Events" value={events.length} />
          <Summary label="Active" value={events.filter((event) => event.is_active).length} />
          <Summary label="Check-ins" value={attendance.length} />
        </View>

        {error && (
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        )}
        {message && <Text style={styles.message}>{message}</Text>}

        {loading && profiles.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.emptyText}>Loading accounts...</Text>
          </View>
        ) : profiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={28} color={COLORS.workflowMuted} />
            <Text style={styles.emptyText}>No accounts found.</Text>
          </View>
        ) : (
          profiles.map((profile, index) => (
            <MotionView key={profile.id} delay={Math.min(index * 45, 270)} offset={8}>
              <View style={styles.userRow}>
                <View style={styles.userHeading}>
                  <View style={styles.avatar}>
                    <Ionicons name="person-outline" size={18} color={COLORS.workflowAccent} />
                  </View>
                  <View style={styles.identity}>
                    <Text style={styles.name} numberOfLines={1}>
                      {profile.full_name || 'Unnamed account'}
                    </Text>
                    <Text style={styles.email} numberOfLines={1}>{profile.email}</Text>
                  </View>
                </View>
                <View style={styles.roleRow}>
                  {ROLES.map((role) => {
                    const selected = profile.role === role;
                    const disabled = Boolean(savingUserId) || savingUserId === profile.id;
                    return (
                      <Pressable
                        key={role}
                        accessibilityRole="button"
                        accessibilityLabel={`${roleLabel(role)} role for ${profile.email}`}
                        accessibilityState={{ selected, disabled }}
                        disabled={disabled || selected}
                        onPress={() => void handleRoleChange(profile, role)}
                        style={[
                          styles.roleButton,
                          selected && styles.roleButtonSelected,
                          disabled && !selected && styles.disabled,
                        ]}
                      >
                        <Text style={[styles.roleText, selected && styles.roleTextSelected]}>
                          {roleLabel(role)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {savingUserId === profile.id && (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  )}
                </View>
                {profile.id === user?.id && (
                  <Text style={styles.currentUser}>CURRENT ACCOUNT</Text>
                )}
              </View>
            </MotionView>
          ))
        )}

        <Text style={styles.sectionTitle}>Event Management</Text>
        {events.length === 0 ? (
          <Text style={styles.sectionEmpty}>No events found.</Text>
        ) : events.map((event) => {
          const draft = eventDrafts[event.id] ?? { title: event.title, location: event.location ?? '' };
          const editing = editingEventId === event.id;
          const deleting = pendingDelete === `event:${event.id}`;
          return (
            <View key={event.id} style={styles.recordRow}>
              {editing ? (
                <>
                  <TextInput
                    accessibilityLabel="Event title"
                    value={draft.title}
                    onChangeText={(title) => setEventDrafts((current) => ({
                      ...current, [event.id]: { ...draft, title },
                    }))}
                    placeholder="Event title"
                    style={styles.recordInput}
                  />
                  <TextInput
                    accessibilityLabel="Event location"
                    value={draft.location}
                    onChangeText={(location) => setEventDrafts((current) => ({
                      ...current, [event.id]: { ...draft, location },
                    }))}
                    placeholder="Location"
                    style={styles.recordInput}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.recordTitle}>{event.title}</Text>
                  <Text style={styles.recordMeta}>{event.event_code}  /  {event.location || 'No location'}</Text>
                  <Text style={styles.recordMeta}>{event.attendee_count} check-ins  /  {event.is_active ? 'Active' : 'Inactive'}</Text>
                </>
              )}
              <View style={styles.actionRow}>
                {editing ? (
                  <ActionButton label="Save" disabled={Boolean(savingRecordId)} onPress={() => void handleSaveEvent(event)} />
                ) : (
                  <ActionButton label="Edit" disabled={Boolean(savingRecordId)} onPress={() => setEditingEventId(event.id)} />
                )}
                <ActionButton
                  label={event.is_active ? 'Deactivate' : 'Activate'}
                  disabled={Boolean(savingRecordId) || editing}
                  onPress={() => void handleToggleEvent(event)}
                />
                {deleting ? (
                  <ActionButton label="Confirm delete" disabled={Boolean(savingRecordId)} danger onPress={() => void handleDeleteEvent(event)} />
                ) : (
                  <ActionButton label="Delete" disabled={Boolean(savingRecordId)} danger onPress={() => setPendingDelete(`event:${event.id}`)} />
                )}
                {deleting && <ActionButton label="Cancel" disabled={Boolean(savingRecordId)} onPress={() => setPendingDelete(null)} />}
              </View>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Attendance Records</Text>
        {attendance.length === 0 ? (
          <Text style={styles.sectionEmpty}>No check-ins recorded.</Text>
        ) : attendance.map((record) => {
          const deleting = pendingDelete === `attendance:${record.id}`;
          return (
            <View key={record.id} style={styles.recordRow}>
              <Text style={styles.recordTitle}>{record.student_name}</Text>
              <Text style={styles.recordMeta}>{record.student_email}</Text>
              <Text style={styles.recordMeta}>{record.event_title}  /  {record.event_code}</Text>
              <TextInput
                accessibilityLabel={`Check-in time for ${record.student_name}`}
                value={attendanceDrafts[record.id] ?? record.scanned_at}
                onChangeText={(scannedAt) => setAttendanceDrafts((current) => ({ ...current, [record.id]: scannedAt }))}
                autoCapitalize="none"
                style={styles.recordInput}
              />
              <View style={styles.actionRow}>
                <ActionButton label="Save time" disabled={Boolean(savingRecordId)} onPress={() => void handleSaveAttendanceTime(record)} />
                {deleting ? (
                  <ActionButton label="Confirm remove" disabled={Boolean(savingRecordId)} danger onPress={() => void handleDeleteAttendance(record)} />
                ) : (
                  <ActionButton label="Remove" disabled={Boolean(savingRecordId)} danger onPress={() => setPendingDelete(`attendance:${record.id}`)} />
                )}
                {deleting && <ActionButton label="Cancel" disabled={Boolean(savingRecordId)} onPress={() => setPendingDelete(null)} />}
              </View>
            </View>
          );
        })}

        <AppButton
          title={exporting ? 'Preparing Report...' : 'Export System Report'}
          icon="download-outline"
          disabled={exporting || attendance.length === 0}
          onPress={() => void handleExportReport()}
        />

        <AppButton
          title="Sign Out"
          icon="log-out-outline"
          onPress={() => void handleSignOut()}
        />
      </ScrollView>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, danger && styles.actionButtonDanger, disabled && styles.disabled]}
    >
      <Text style={[styles.actionText, danger && styles.actionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function roleLabel(role: Role) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function escapeCsvField(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  eyebrow: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 7,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 5,
  },
  refreshButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.card,
  },
  pressed: {
    opacity: 0.7,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
  },
  sectionEmpty: {
    color: COLORS.textSecondary,
    fontSize: 13,
    paddingVertical: 12,
  },
  recordRow: {
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 8,
    backgroundColor: COLORS.workflowSurface,
  },
  recordTitle: {
    color: COLORS.workflowText,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  recordMeta: {
    color: COLORS.workflowMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  recordInput: {
    minHeight: 40,
    marginTop: 7,
    marginBottom: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 6,
    color: COLORS.workflowText,
    backgroundColor: COLORS.card,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 8,
  },
  actionButton: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 6,
    backgroundColor: COLORS.workflowSurfaceRaised,
  },
  actionButtonDanger: {
    borderColor: COLORS.danger,
  },
  actionText: {
    color: COLORS.workflowAccent,
    fontSize: 11,
    fontWeight: '700',
  },
  actionTextDanger: {
    color: COLORS.danger,
  },
  summaryItem: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 8,
    backgroundColor: COLORS.workflowSurface,
  },
  summaryValue: {
    color: COLORS.workflowText,
    fontSize: 20,
    fontWeight: '700',
  },
  summaryLabel: {
    color: COLORS.workflowMuted,
    fontSize: 11,
    marginTop: 3,
  },
  userRow: {
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 8,
    backgroundColor: COLORS.workflowSurface,
  },
  userHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderRadius: 18,
    backgroundColor: COLORS.workflowSurfaceRaised,
  },
  identity: {
    flex: 1,
  },
  name: {
    color: COLORS.workflowText,
    fontSize: 14,
    fontWeight: '700',
  },
  email: {
    color: COLORS.workflowMuted,
    fontSize: 12,
    marginTop: 3,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleButton: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 6,
    backgroundColor: COLORS.workflowSurfaceRaised,
  },
  roleButtonSelected: {
    borderColor: COLORS.workflowAccent,
    backgroundColor: '#EEE5D3',
  },
  roleText: {
    color: COLORS.workflowMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  roleTextSelected: {
    color: COLORS.workflowAccent,
  },
  disabled: {
    opacity: 0.5,
  },
  currentUser: {
    color: COLORS.workflowAccent,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 9,
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
    marginBottom: 10,
  },
  message: {
    color: COLORS.workflowSuccess,
    fontSize: 13,
    marginBottom: 10,
  },
  emptyState: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
});