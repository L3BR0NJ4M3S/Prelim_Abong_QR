import { supabase } from './supabase';

export type StudentDashboardRecord = {
  id: string;
  eventTitle: string;
  scannedAt: string;
};

export type UpcomingEvent = {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
};

export type StudentDashboardData = {
  totalAttended: number;
  recentAttendance: StudentDashboardRecord[];
  monthlyAttendance: { month: string; count: number }[];
  upcomingEvents: UpcomingEvent[];
};

export async function getStudentDashboardData(
  studentId: string
): Promise<StudentDashboardData> {
  const now = new Date();
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const monthStart = firstMonth.toISOString();

  const [totalResult, recentResult, monthlyResult, upcomingResult] =
    await Promise.all([
      supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId),
      supabase
        .from('attendance')
        .select('id, scanned_at, events ( title )')
        .eq('student_id', studentId)
        .order('scanned_at', { ascending: false })
        .limit(5),
      supabase
        .from('attendance')
        .select('scanned_at')
        .eq('student_id', studentId)
        .gte('scanned_at', monthStart)
        .order('scanned_at', { ascending: true }),
      supabase
        .from('events')
        .select('id, title, start_time, end_time')
        .gt('start_time', now.toISOString())
        .order('start_time', { ascending: true })
        .limit(5),
    ]);

  const queryError =
    totalResult.error ??
    recentResult.error ??
    monthlyResult.error ??
    upcomingResult.error;

  if (queryError) {
    throw queryError;
  }

  const monthlyCounts = new Map<string, number>();
  for (let offset = 0; offset < 6; offset += 1) {
    const month = new Date(now.getFullYear(), now.getMonth() - 5 + offset, 1);
    const key = `${month.getFullYear()}-${month.getMonth()}`;
    monthlyCounts.set(key, 0);
  }

  for (const row of monthlyResult.data ?? []) {
    const scannedAt = new Date(row.scanned_at);
    const key = `${scannedAt.getFullYear()}-${scannedAt.getMonth()}`;
    if (monthlyCounts.has(key)) {
      monthlyCounts.set(key, (monthlyCounts.get(key) ?? 0) + 1);
    }
  }

  const monthlyAttendance = Array.from(monthlyCounts.entries()).map(
    ([key, count]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        month: new Date(year, month, 1).toLocaleDateString(undefined, {
          month: 'short',
        }),
        count,
      };
    }
  );

  return {
    totalAttended: totalResult.count ?? 0,
    recentAttendance: (recentResult.data ?? []).map((row) => {
      const event = Array.isArray(row.events) ? row.events[0] : row.events;
      return {
        id: row.id,
        eventTitle: event?.title ?? 'School event',
        scannedAt: row.scanned_at,
      };
    }),
    monthlyAttendance,
    upcomingEvents: (upcomingResult.data ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      startTime: event.start_time as string,
      endTime: event.end_time,
    })),
  };
}
