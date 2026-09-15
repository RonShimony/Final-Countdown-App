const STORAGE_KEY = 'final-countdown:events';

export function getEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export function saveEvent(event) {
  const events = getEvents();
  const index = events.findIndex((e) => e.id === event.id);
  if (index === -1) {
    events.push(event);
  } else {
    events[index] = event;
  }
  persist(events);
  return events;
}

export function deleteEvent(id) {
  const events = getEvents().filter((e) => e.id !== id);
  persist(events);
  return events;
}

export function createEventId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
