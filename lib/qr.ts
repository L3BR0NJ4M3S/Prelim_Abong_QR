export type QRPayload = {
  v: 2;
  eventId: string;
  token: string;
};

export type ParseQRResult =
  | { ok: true; payload: QRPayload }
  | { ok: false; message: string };

export function buildQRPayload(event: {
  eventId: string;
  token: string;
}): string {
  return JSON.stringify({
    v: 2,
    eventId: event.eventId,
    token: event.token,
  });
}

export function parseQRPayload(raw: string): ParseQRResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'Invalid QR code.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, message: 'Not an attendance QR code.' };
  }

  const value = parsed as Record<string, unknown>;
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    value.v !== 2 ||
    typeof value.eventId !== 'string' ||
    !uuidPattern.test(value.eventId) ||
    typeof value.token !== 'string' ||
    !uuidPattern.test(value.token)
  ) {
    return { ok: false, message: 'Not a valid secure attendance QR code.' };
  }

  return {
    ok: true,
    payload: {
      v: 2,
      eventId: value.eventId,
      token: value.token,
    },
  };
}
