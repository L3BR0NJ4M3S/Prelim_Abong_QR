import { supabase } from './supabase';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
  description: string;
  location: string;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
};

export type CreatedEvent = {
  id: string;
  event_code: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  qr_token: string;
};

export async function createEvent(
  event: Event
): Promise<CreatedEvent> {
  const { data, error } = await supabase.rpc('create_teacher_event', {
    p_event_code: event.eventId,
    p_title: event.title,
    p_description: event.description || null,
    p_location: event.location || null,
    p_start_time: event.start,
    p_end_time: event.end,
  });

  if (error) throw error;

  const created = Array.isArray(data) ? data[0] : data;
  if (!created) {
    throw new Error('The event was not returned after it was created.');
  }

  return created as CreatedEvent;
}

export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as CloudEvent[];
}

export async function getEventByCode(code: string): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CloudEvent;
}
