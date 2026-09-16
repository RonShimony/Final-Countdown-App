// This is the app's entry point - the file index.html loads directly via
// <script type="module">. It doesn't contain business logic itself; its
// job is to "glue together" the other modules: read/write data through
// storage.js, compute/display through render.js, and wire up all the
// button clicks and form handling for the UI.

import { getEvents, saveEvent, deleteEvent, createEventId } from './storage.js';
import { renderEvents, renderDetail } from './render.js';

// Grab references to all the DOM elements we'll need to interact with.
// Doing this once at the top (instead of re-querying the DOM every time)
// is both faster and keeps all the element wiring in one visible place.
const list = document.getElementById('event-list');
const addBtn = document.getElementById('add-btn');
const backdrop = document.getElementById('sheet-backdrop');
const form = document.getElementById('event-form');
const sheetTitle = document.getElementById('sheet-title');
const titleField = document.getElementById('field-title');
const dateField = document.getElementById('field-date');
const emojiField = document.getElementById('field-emoji');
const recurringField = document.getElementById('field-recurring');
const swatches = Array.from(document.querySelectorAll('.swatch'));
const deleteBtn = document.getElementById('delete-btn');
const cancelBtn = document.getElementById('cancel-btn');
const detailView = document.getElementById('detail-view');
const detailContent = document.getElementById('detail-content');
const detailBackBtn = document.getElementById('detail-back-btn');
const detailEditBtn = document.getElementById('detail-edit-btn');

// Fall back to the first swatch's color if, for some reason, no swatches
// exist in the DOM (defensive default, shouldn't normally happen).
const DEFAULT_COLOR = swatches[0]?.dataset.color || '#4dabf7';

// --- Simple module-level state for the add/edit form ("sheet") ---
// editingId: null while adding a new event; set to an event's id while
// editing an existing one, so submit/delete know which record to touch.
let editingId = null;
// selectedColor: tracks which color swatch is currently chosen, since
// that isn't naturally readable from a single form field like the others.
let selectedColor = DEFAULT_COLOR;
// id of the event currently shown in the detail view, or null when closed.
let detailEventId = null;

// Pads a single number to 2 digits with a leading zero (5 -> "05").
function pad(n) {
  return String(n).padStart(2, '0');
}

// Converts a Date object into the string format the
// <input type="datetime-local"> field expects: "YYYY-MM-DDTHH:MM", using
// the browser's LOCAL time (not UTC) so the picker shows what the user
// actually expects to see.
function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Updates which color swatch is visually marked as selected, and records
// the choice in `selectedColor` for when the form is submitted.
function setSelectedColor(color) {
  selectedColor = color;
  swatches.forEach((sw) => sw.classList.toggle('is-selected', sw.dataset.color === color));
}

// Re-reads all events from storage and redraws the whole list (and the
// detail view, if one is open). Called once on startup, once per second
// afterwards (see setInterval below), and any time the data changes
// (save/delete) - this is what keeps every timer on screen live.
function refresh() {
  const events = getEvents();
  renderEvents(list, events);

  if (detailEventId) {
    const event = events.find((ev) => ev.id === detailEventId);
    // The event being viewed may have just been deleted (e.g. from the
    // edit sheet opened on top of it) - close the detail view instead of
    // rendering a stale/missing event.
    if (event) {
      renderDetail(detailContent, event);
    } else {
      closeDetail();
    }
  }
}

// Opens the full-screen detail view for one event.
function openDetail(event) {
  detailEventId = event.id;
  renderDetail(detailContent, event);
  detailView.hidden = false;
}

function closeDetail() {
  detailView.hidden = true;
  detailEventId = null;
}

// Opens the bottom-sheet form, either blank (for a new event, when
// `event` is null) or pre-filled with an existing event's data (to edit
// it). This same form/markup is reused for both add and edit, rather than
// having two separate forms.
function openSheet(event) {
  editingId = event ? event.id : null;
  sheetTitle.textContent = event ? 'Edit event' : 'New event';
  titleField.value = event ? event.title : '';
  dateField.value = toLocalInputValue(event ? new Date(event.date) : new Date());
  emojiField.value = event ? event.emoji || '' : '';
  recurringField.checked = event ? !!event.recurring : false;
  setSelectedColor(event ? event.color : DEFAULT_COLOR);
  // Only show the Delete button when editing an existing event - there's
  // nothing to delete yet when creating a new one.
  deleteBtn.hidden = !event;

  backdrop.hidden = false;
  form.hidden = false;
  // Focus the title field so the user can start typing immediately;
  // preventScroll avoids the page jumping when the on-screen keyboard
  // (on mobile) or focus ring appears.
  titleField.focus({ preventScroll: true });
}

// Hides the sheet and clears which event (if any) was being edited.
function closeSheet() {
  backdrop.hidden = true;
  form.hidden = true;
  editingId = null;
}

// --- Event listeners: wiring up user interactions ---

addBtn.addEventListener('click', () => openSheet(null));
cancelBtn.addEventListener('click', closeSheet);
// Clicking the dimmed backdrop behind the sheet also closes it, like
// tapping outside a modal.
backdrop.addEventListener('click', closeSheet);

swatches.forEach((sw) => {
  sw.addEventListener('click', () => setSelectedColor(sw.dataset.color));
});

// "Event delegation": rather than attaching a click listener to every
// individual event card (which would need re-attaching every time the
// list is redrawn by refresh()), we attach ONE listener to the whole
// list container. Clicks bubble up from whichever card was tapped, and
// e.target.closest('.event-card') finds which card (if any) was the
// actual target of the click.
list.addEventListener('click', (e) => {
  const card = e.target.closest('.event-card');
  if (!card) return;
  const event = getEvents().find((ev) => ev.id === card.dataset.id);
  if (event) openDetail(event);
});

detailBackBtn.addEventListener('click', closeDetail);
// The edit sheet opens layered on top of the detail view (see the z-index
// comment in css/style.css) rather than replacing it, so cancelling the
// edit just returns to the detail view underneath.
detailEditBtn.addEventListener('click', () => {
  const event = getEvents().find((ev) => ev.id === detailEventId);
  if (event) openSheet(event);
});

form.addEventListener('submit', (e) => {
  // Forms normally reload the page on submit; preventDefault stops that
  // since this is a single-page app that handles submission with JS.
  e.preventDefault();
  const title = titleField.value.trim();
  // Bail out silently if required fields are empty (the `required`
  // HTML attribute mostly prevents this, but this is a safety net).
  if (!title || !dateField.value) return;

  // When editing, look up the original event so we can preserve its
  // createdAt timestamp instead of resetting it.
  const existing = editingId ? getEvents().find((ev) => ev.id === editingId) : null;

  saveEvent({
    // Reuse the existing id when editing; generate a fresh one when adding.
    id: editingId || createEventId(),
    title,
    // Convert the datetime-local input's local-time string into a full
    // ISO UTC string for storage, matching the data model documented in
    // CLAUDE.md - keeping storage timezone-agnostic.
    date: new Date(dateField.value).toISOString(),
    emoji: emojiField.value.trim(),
    color: selectedColor,
    recurring: recurringField.checked,
    createdAt: existing ? existing.createdAt : Date.now(),
  });

  refresh();
  closeSheet();
});

deleteBtn.addEventListener('click', () => {
  if (!editingId) return;
  deleteEvent(editingId);
  refresh();
  closeSheet();
});

// Draw the list immediately on page load...
refresh();
// ...then keep it live by fully re-rendering once per second. This is a
// deliberately simple approach (full re-render, not an incremental DOM
// patch) since the app only ever expects a small number of events - see
// CLAUDE.md for why this trade-off is intentional here.
setInterval(refresh, 1000);

// Register the service worker (sw.js) so the app can be installed on the
// iPhone home screen and keep working offline. Guarded by a feature check
// since not every browser supports service workers. Registration happens
// after the page's `load` event so it doesn't compete with the initial
// page load for network/CPU resources.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
