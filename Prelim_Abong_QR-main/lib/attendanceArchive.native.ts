import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

let databasePromise: Promise<SQLiteDatabase> | null = null;

function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync('qr-attendance-archive.db')
      .then(async (database) => {
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS archived_attendance (
            user_id TEXT NOT NULL,
            attendance_id TEXT NOT NULL,
            archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, attendance_id)
          );
        `);
        return database;
      })
      .catch((error: unknown) => {
        databasePromise = null;
        throw error;
      });
  }

  return databasePromise;
}

export async function getArchivedAttendanceIds(userId: string): Promise<string[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ attendance_id: string }>(
    'SELECT attendance_id FROM archived_attendance WHERE user_id = ?',
    userId,
  );
  return rows.map((row) => row.attendance_id);
}

export async function archiveAttendance(userId: string, attendanceId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT OR IGNORE INTO archived_attendance (user_id, attendance_id) VALUES (?, ?)',
    userId,
    attendanceId,
  );
}

export async function restoreAttendance(userId: string, attendanceId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'DELETE FROM archived_attendance WHERE user_id = ? AND attendance_id = ?',
    userId,
    attendanceId,
  );
}
