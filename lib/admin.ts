import { supabase } from './supabase';

export type AdminEvent = {
  id: string;
  event_code: string;
  title: string;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  attendee_count: number;
};

export type AdminAttendance = {
  id: string;
  event_id: string;
  event_title: string;
  event_code: string;
  student_id: string;
  student_name: string;
  student_email: string;
  scanned_at: string;
};

export async function getAdminEvents(): Promise<AdminEvent[]> {
  const { data, error } = await supabase.rpc('admin_list_events');
  if (error) throw error;
  return (data ?? []) as AdminEvent[];
}

export async function updateAdminEvent(
  event: Pick<AdminEvent, 'id' | 'title' | 'location' | 'is_active'>
) {
  const { error } = await supabase.rpc('admin_update_event', {
    p_event_id: event.id,
    p_title: event.title,
    p_location: event.location ?? '',
    p_is_active: event.is_active,
  });
  if (error) throw error;
}

export async function deleteAdminEvent(eventId: string) {
  const { error } = await supabase.rpc('admin_delete_event', { p_event_id: eventId });
  if (error) throw error;
}

export async function getAdminAttendance(): Promise<AdminAttendance[]> {
  const { data, error } = await supabase.rpc('admin_list_attendance');
  if (error) throw error;
  return (data ?? []) as AdminAttendance[];
}

export async function updateAdminAttendanceTime(id: string, scannedAt: string) {
  const { error } = await supabase.rpc('admin_update_attendance_time', {
    p_attendance_id: id,
    p_scanned_at: scannedAt,
  });
  if (error) throw error;
}

export async function deleteAdminAttendance(id: string) {
  const { error } = await supabase.rpc('admin_delete_attendance', {
    p_attendance_id: id,
  });
  if (error) throw error;
}