import { parseQRPayload } from './qr';
import { supabase } from './supabase';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;
  attendees: {
    studentId: string;
    scannedAt: string;
  }[];
};

export async function registerAttendance(
  rawPayload: string
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);

  if (!parsed.ok) {
    return { success: false, message: parsed.message };
  }

  const { data, error } = await supabase.rpc('check_in_with_event_qr', {
    p_event_id: parsed.payload.eventId,
    p_token: parsed.payload.token,
  });

  if (error) {
    console.error('Attendance verification failed:', error);
    return {
      success: false,
      message: 'Could not verify this QR code. Please try again.',
    };
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.success !== 'boolean') {
    return {
      success: false,
      message: 'The attendance verification service returned an invalid response.',
    };
  }

  return {
    success: result.success,
    message: result.message,
    eventTitle: result.event_title ?? undefined,
  };
}

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, events ( event_code, title )')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => {
    const event = Array.isArray(row.events) ? row.events[0] : row.events;

    return {
      id: row.id,
      eventId: event?.event_code ?? '',
      eventTitle: event?.title ?? '',
      scannedAt: row.scanned_at,
    };
  });
}

export async function deleteAttendanceRecord(
  studentId: string,
  attendanceId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', attendanceId)
    .eq('student_id', studentId)
    .select('id');

  if (error) {
    throw error;
  }

  if (!data?.length) {
    throw new Error('The attendance record could not be deleted.');
  }
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events) {
    return [];
  }

  const eventIds = events.map((event: any) => event.id);
  if (eventIds.length === 0) return [];

  const { data: attRows, error: attError } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError || !attRows) {
    return events.map((event: any) => ({
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      attendeeCount: 0,
    }));
  }

  const counts: Record<string, number> = {};
  attRows.forEach((row: any) => {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  });

  return events.map((event: any) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    attendeeCount: counts[event.id] ?? 0,
  }));
}

export async function getTeacherEventAttendance(
  teacherId: string,
  options: { throwOnError?: boolean } = {}
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, created_at')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events) {
    if (options.throwOnError) {
      throw eventError ?? new Error('Could not load teacher events.');
    }
    return [];
  }

  const eventIds = events.map((event: any) => event.id);
  if (eventIds.length === 0) return [];

  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .select('student_id, scanned_at, event_id')
    .in('event_id', eventIds)
    .order('scanned_at', { ascending: false });

  if (attError || !attendance) {
    if (options.throwOnError) {
      throw attError ?? new Error('Could not load attendance check-ins.');
    }
    return events.map((event: any) => ({
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      attendeeCount: 0,
      attendees: [],
    }));
  }

  return events.map((event: any) => {
    const rows = attendance.filter((entry: any) => entry.event_id === event.id);

    return {
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      attendeeCount: rows.length,
      attendees: rows.map((entry: any) => ({
        studentId: entry.student_id,
        scannedAt: entry.scanned_at,
      })),
    };
  });
}
