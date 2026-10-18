function storageKey(userId: string): string {
  return `qr-attendance-archive:${userId}`;
}

function readArchivedIds(userId: string): string[] {
  const value = localStorage.getItem(storageKey(userId));
  if (value === null) {
    return [];
  }

  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
    throw new Error('Saved attendance archive data is invalid.');
  }

  return parsed;
}

function writeArchivedIds(userId: string, ids: string[]): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(ids));
}

export async function getArchivedAttendanceIds(userId: string): Promise<string[]> {
  return readArchivedIds(userId);
}

export async function archiveAttendance(userId: string, attendanceId: string): Promise<void> {
  const ids = readArchivedIds(userId);
  if (!ids.includes(attendanceId)) {
    writeArchivedIds(userId, [...ids, attendanceId]);
  }
}

export async function restoreAttendance(userId: string, attendanceId: string): Promise<void> {
  writeArchivedIds(
    userId,
    readArchivedIds(userId).filter((id) => id !== attendanceId),
  );
}
