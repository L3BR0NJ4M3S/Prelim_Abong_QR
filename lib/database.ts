import * as SQLite from 'expo-sqlite';

const DB_NAME = 'attendance.db';
const TABLE_NAME = 'attendance';

export type AttendanceRecord = {
  id: number;
  studentId: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

const db = SQLite.openDatabaseSync(DB_NAME);

async function ensureTableSchema(): Promise<void> {
  const tables = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = ?;`,
    [TABLE_NAME]
  );

  if (tables.length === 0) {
    await db.runAsync(
      `CREATE TABLE ${TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        studentId TEXT NOT NULL,
        eventId TEXT NOT NULL,
        eventTitle TEXT NOT NULL,
        scannedAt TEXT NOT NULL,
        UNIQUE(studentId, eventId)
      );`,
      []
    );
    return;
  }

  const columns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${TABLE_NAME});`,
    []
  );
  const columnNames = columns.map((column) => column.name);

  if (!columnNames.includes('eventId')) {
    await db.runAsync(
      `ALTER TABLE ${TABLE_NAME} ADD COLUMN eventId TEXT NOT NULL DEFAULT '';`,
      []
    );
  }

  if (!columnNames.includes('studentId')) {
    await db.runAsync(
      `ALTER TABLE ${TABLE_NAME} ADD COLUMN studentId TEXT NOT NULL DEFAULT '';`,
      []
    );
  }

  if (!columnNames.includes('eventTitle')) {
    await db.runAsync(
      `ALTER TABLE ${TABLE_NAME} ADD COLUMN eventTitle TEXT NOT NULL DEFAULT '';`,
      []
    );
  }

  if (!columnNames.includes('scannedAt')) {
    await db.runAsync(
      `ALTER TABLE ${TABLE_NAME} ADD COLUMN scannedAt TEXT NOT NULL DEFAULT '';`,
      []
    );
  }

  await db.runAsync(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_student_event ON ${TABLE_NAME}(studentId, eventId);`,
    []
  );
}

export async function registerAttendance(
  rawData: string,
  studentId: string
): Promise<{ success: boolean; message: string }> {
  await ensureTableSchema();

  let payload: { v?: number; event?: { id?: string; title?: string; end?: string } } = {};

  try {
    payload = JSON.parse(rawData);
  } catch {
    return { success: false, message: 'Invalid QR code.' };
  }

  if (payload.v !== 1 || !payload.event?.id || !payload.event?.title) {
    return { success: false, message: 'Invalid QR code.' };
  }

  const now = new Date();
  const eventEnd = payload.event.end ? new Date(payload.event.end) : null;

  if (eventEnd && eventEnd.getTime() < now.getTime()) {
    return { success: false, message: 'Event has already ended.' };
  }

  try {
    await db.runAsync(
      `INSERT INTO ${TABLE_NAME} (studentId, eventId, eventTitle, scannedAt) VALUES (?, ?, ?, ?);`,
      [studentId, payload.event.id, payload.event.title, now.toISOString()]
    );

    return { success: true, message: 'Attendance recorded!' };
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message)
        : 'Unable to save attendance.';

    if (message.includes('UNIQUE') || message.includes('constraint failed')) {
      return { success: false, message: 'Event has already been registered.' };
    }

    return { success: false, message: 'Unable to save attendance.' };
  }
}

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  await ensureTableSchema();

  const records = await db.getAllAsync<AttendanceRecord>(
    `SELECT id, studentId, eventId, eventTitle, scannedAt FROM ${TABLE_NAME} WHERE studentId = ? ORDER BY scannedAt DESC;`,
    [studentId]
  );

  return records;
}
