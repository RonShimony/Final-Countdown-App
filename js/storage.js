// This module is the ONLY place in the app that talks to localStorage.
// localStorage is a simple key/value store built into the browser: it only
// stores strings, and the data survives even after the browser is closed
// (unlike variables in memory, which disappear on refresh). Since it can
// only hold strings, we save our list of events as one big JSON string.

// The single key we store everything under. Namespacing it with
// "final-countdown:" avoids clashing with other localStorage keys if this
// app ever shares a browser profile/domain with something else.
const STORAGE_KEY = 'final-countdown:events';

// Reads and parses the full list of events from localStorage.
// Returns an array (never throws) so callers never have to null-check.
export function getEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // If nothing has been saved yet, raw is null -> return an empty list.
    // Otherwise turn the JSON string back into a real JS array of objects.
    return raw ? JSON.parse(raw) : [];
  } catch {
    // If the stored value is somehow corrupted (e.g. invalid JSON) or
    // localStorage is unavailable, fail safe with an empty list instead
    // of crashing the whole app.
    return [];
  }
}

// Internal helper: turns the events array back into a JSON string and
// writes it to localStorage. Not exported - other files should only ever
// go through saveEvent/deleteEvent so this module stays the single source
// of truth for how data is written.
function persist(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

// Adds a new event or updates an existing one ("upsert" = update + insert).
// Which one happens depends on whether an event with the same id already
// exists in the array.
export function saveEvent(event) {
  const events = getEvents();
  const index = events.findIndex((e) => e.id === event.id);
  if (index === -1) {
    // No existing event has this id -> this is a brand new event.
    events.push(event);
  } else {
    // Found a match -> overwrite it in place (this is the "edit" case).
    events[index] = event;
  }
  persist(events);
  return events;
}

// Removes the event with the given id, if any, and saves the result.
// Array.filter() builds a new array containing only the events that do
// NOT match the id we want to delete.
export function deleteEvent(id) {
  const events = getEvents().filter((e) => e.id !== id);
  persist(events);
  return events;
}

// Generates a unique id string for a new event.
// crypto.randomUUID() is a built-in browser function that produces a
// random unique id (like "3fa2c1..."), but it's fairly new, so some very
// old browsers/WebViews might not support it. The `||` fallback builds a
// "good enough" unique id by combining the current timestamp with a random
// number, in case crypto.randomUUID is missing.
export function createEventId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
