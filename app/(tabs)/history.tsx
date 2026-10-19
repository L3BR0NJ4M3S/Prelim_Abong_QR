import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';
import SwipeArchiveRow from '@/components/SwipeArchiveRow';
import MotionView from '@/components/MotionView';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  archiveAttendance,
  getArchivedAttendanceIds,
  restoreAttendance,
} from '@/lib/attendanceArchive';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  getTeacherEventSummary,
  type AttendanceRecord,
  type TeacherEventAttendance,
  deleteAttendanceRecord,
} from '@/lib/attendance';
import { getProfile, type Role } from '@/lib/profiles';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    if (!user) {
      setRecords([]);
      setArchivedIds([]);
      setTeacherEvents([]);
      setLoading(false);
      return;
    }

    try {
      const profile = await getProfile(user.id);
      const currentRole = profile?.role ?? 'student';
      setRole(currentRole);

      if (currentRole === 'teacher') {
        const [events, summaries] = await Promise.all([
          getTeacherEventAttendance(user.id),
          getTeacherEventSummary(user.id),
        ]);

        const summaryMap = new Map(
          summaries.map((summary) => [summary.eventId, summary.attendeeCount])
        );

        setTeacherEvents(
          events.map((event) => ({
            ...event,
            attendeeCount: summaryMap.get(event.eventId) ?? event.attendeeCount,
          }))
        );
        setRecords([]);
        setLoading(false);
        return;
      }

      const [rows, archived] = await Promise.all([
        getAttendanceHistory(user.id),
        getArchivedAttendanceIds(user.id),
      ]);
      setRecords(rows);
      setArchivedIds(archived);
      setTeacherEvents([]);
      setArchiveError(null);
    } catch (error) {
      console.error('Failed to load attendance history:', error);
      setArchiveError('Could not load attendance history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.subtitle}>Loading records...</Text>
      </View>
    );
  }

  if (role === 'teacher') {
    return (
      <View style={styles.container}>
        <MotionView duration={340}>
          <Text style={styles.title}>Event Attendance</Text>
        </MotionView>

        {teacherEvents.length === 0 ? (
          <Text style={styles.subtitle}>
            No events yet. Create an event from the Teacher tab.
          </Text>
        ) : (
          <FlatList
            data={teacherEvents}
            keyExtractor={(item) => item.eventId}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <MotionView delay={Math.min(index * 60, 300)}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.eventTitle}>{item.title}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{item.attendeeCount}</Text>
                  </View>
                </View>

                <Text style={styles.eventMeta}>Code: {item.eventCode}</Text>
                {item.startTime && (
                  <Text style={styles.eventMeta}>Starts: {formatDate(item.startTime)}</Text>
                )}
                {item.endTime && (
                  <Text style={styles.eventMeta}>Ends: {formatDate(item.endTime)}</Text>
                )}

                {item.attendees.length === 0 ? (
                  <Text style={styles.emptyAttendee}>No attendees yet.</Text>
                ) : (
                  <View style={styles.attendeeList}>
                    {item.attendees.map((attendee, index) => (
                      <View key={`${item.eventId}-${index}`} style={styles.attendeeRow}>
                        <Text style={styles.attendeeId}>{shortId(attendee.studentId)}</Text>
                        <Text style={styles.eventMeta}>{formatDate(attendee.scannedAt)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              </MotionView>
            )}
          />
        )}
      </View>
    );
  }

  const visibleRecords = records.filter((record) =>
    archivedIds.includes(record.id) === showArchive
  );

  const handleArchiveChange = async (recordId: string, archive: boolean) => {
    if (!user) {
      return;
    }

    setArchiveError(null);
    try {
      if (archive) {
        await archiveAttendance(user.id, recordId);
        setArchivedIds((current) =>
          current.includes(recordId) ? current : [...current, recordId]
        );
      } else {
        await restoreAttendance(user.id, recordId);
        setArchivedIds((current) => current.filter((id) => id !== recordId));
      }
    } catch (error) {
      console.error('Failed to update the attendance archive:', error);
      setArchiveError('Could not update this record. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!user || !recordToDelete || deleting) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAttendanceRecord(user.id, recordToDelete.id);
      await restoreAttendance(user.id, recordToDelete.id);
      setRecords((current) => current.filter((record) => record.id !== recordToDelete.id));
      setArchivedIds((current) => current.filter((id) => id !== recordToDelete.id));
      setRecordToDelete(null);
    } catch (error) {
      console.error('Failed to delete attendance record:', error);
      setDeleteError(
        error instanceof Error
          ? error.message
          : 'Could not delete this record. Please try again.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.historyHeader}>
        <Text style={styles.title}>
          {showArchive ? 'Archived Attendance' : 'Attendance History'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showArchive ? 'Return to attendance history' : 'View archived attendance'}
          onPress={() => {
            setShowArchive((current) => !current);
            setArchiveError(null);
          }}
          style={({ pressed }) => [styles.archiveButton, pressed && styles.archiveButtonPressed]}
        >
          <Ionicons
            name={showArchive ? 'arrow-back-outline' : 'archive-outline'}
            size={17}
            color={COLORS.primary}
          />
          <Text style={styles.archiveButtonText}>
            {showArchive ? 'History' : `Archive${archivedIds.length ? ` (${archivedIds.length})` : ''}`}
          </Text>
        </Pressable>
      </View>

      {archiveError && <Text style={styles.error}>{archiveError}</Text>}

      <Modal
        visible={recordToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) {
            setRecordToDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          {recordToDelete && <MotionView style={styles.confirmationCard} offset={0} scaleFrom={0.96} duration={240}>
            <Text style={styles.confirmationTitle}>Delete attendance record?</Text>
            <Text style={styles.confirmationText}>
              This permanently removes your attendance record from history and event reports.
              This action cannot be undone.
            </Text>
            {deleteError && <Text style={styles.error}>{deleteError}</Text>}
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => {
                  setRecordToDelete(null);
                  setDeleteError(null);
                }}
                style={[styles.confirmationButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => void handleDelete()}
                style={[styles.confirmationButton, styles.deleteButton]}
              >
                <Text style={styles.deleteButtonText}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          </MotionView>}
        </View>
      </Modal>

      {visibleRecords.length === 0 ? (
        <MotionView duration={320}>
        <Text style={styles.subtitle}>
          {showArchive
            ? 'No archived attendance yet. Swipe a record left and tap Archive to move it here.'
            : 'No records yet. Scan a QR code to register your attendance.'}
        </Text>
        </MotionView>
      ) : (
        <FlatList
          data={visibleRecords}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <SwipeArchiveRow
              actionLabel={showArchive ? 'Restore' : 'Archive'}
              onAction={() => void handleArchiveChange(item.id, !showArchive)}
              onDelete={() => {
                setDeleteError(null);
                setRecordToDelete(item);
              }}
            >
              <MotionView delay={Math.min(index * 55, 275)}>
              <View style={styles.card}>
                <Text style={styles.eventTitle}>{item.eventTitle}</Text>
                <Text style={styles.eventMeta}>{item.eventId}</Text>
                <Text style={styles.eventMeta}>{formatDate(item.scannedAt)}</Text>
              </View>
              </MotionView>
            </SwipeArchiveRow>
          )}
        />
      )}
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function shortId(id: string) {
  return id ? `…${id.slice(-8)}` : 'unknown';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  confirmationCard: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    backgroundColor: COLORS.workflowSurface,
  },
  confirmationTitle: {
    color: COLORS.workflowText,
    fontSize: 18,
    fontWeight: '700',
  },
  confirmationText: {
    color: COLORS.workflowMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  confirmationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  confirmationButton: {
    minHeight: 42,
    minWidth: 92,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    backgroundColor: COLORS.workflowSurfaceRaised,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
  },
  cancelButtonText: {
    color: COLORS.workflowText,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButtonText: {
    color: COLORS.workflowSurface,
    fontSize: 14,
    fontWeight: '700',
  },
  archiveButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    marginTop: -8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.card,
  },
  archiveButtonPressed: {
    backgroundColor: COLORS.surface,
  },
  archiveButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 32,
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: COLORS.workflowSurface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.workflowText,
    flex: 1,
    marginRight: 12,
  },
  eventMeta: {
    fontSize: 13,
    color: COLORS.workflowMuted,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: 'rgba(135, 147, 106, 0.16)',
    borderRadius: 999,
    minWidth: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: {
    color: COLORS.workflowSuccess,
    fontWeight: '700',
    fontSize: 12,
  },
  attendeeList: {
    marginTop: 12,
    gap: 6,
  },
  attendeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.workflowBorder,
    paddingTop: 8,
  },
  attendeeId: {
    fontSize: 12,
    color: COLORS.workflowText,
    fontWeight: '600',
  },
  emptyAttendee: {
    fontSize: 13,
    color: COLORS.workflowMuted,
    marginTop: 10,
    fontStyle: 'italic',
  },
});
