export function getArchivedAttendanceIds(userId: string): Promise<string[]>;
export function archiveAttendance(userId: string, attendanceId: string): Promise<void>;
export function restoreAttendance(userId: string, attendanceId: string): Promise<void>;
