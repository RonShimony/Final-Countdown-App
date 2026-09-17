// This is the app's entry point - the file index.html loads directly via
// <script type="module">. It doesn't contain business logic itself; its
// job is to "glue together" the other modules: read/write data through
// storage.js, compute/display through render.js, and wire up all the
// button clicks and form handling for the UI.

import { getEvents, saveEvent, deleteEvent, createEventId } from './storage.js';
import { renderEvents, renderDetail, renderDateDiff } from './render.js';
import { addToDate, formatDateTime } from './countdown.js';

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

// --- Nav drawer (hamburger menu) ---
const appHeader = document.getElementById('app-header');
// Every top-level page's header has its own hamburger button (same class,
// all open the same drawer) - see the "menu-btn" class in index.html.
const menuBtns = Array.from(document.querySelectorAll('.menu-btn'));
const drawer = document.getElementById('drawer');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const drawerLinks = document.querySelector('.drawer__links');

// --- Date-to-date calculator page ---
const dateDiffView = document.getElementById('date-diff-view');
const diffFromField = document.getElementById('diff-from');
const diffToField = document.getElementById('diff-to');
const diffOutput = document.getElementById('diff-output');

// --- Add/subtract calculator page ---
const addSubtractView = document.getElementById('add-subtract-view');
const asBaseDateField = document.getElementById('as-base-date');
const asDirectionButtons = Array.from(document.querySelectorAll('#as-direction .toggle-btn'));
const asAmountField = document.getElementById('as-amount');
const asUnitField = document.getElementById('as-unit');
const asResult = document.getElementById('as-result');

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
// 'add' or 'subtract' - which direction the add/subtract calculator is
// currently set to.
let asDirection = 'add';

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

// Shows exactly one of the three top-level pages (event list, date-to-date
// calculator, add/subtract calculator) and hides the other two. This is
// the multi-page generalization of the openDetail/closeDetail toggle above
// - the per-event detail view and the edit sheet stay separate, layered
// overlays regardless of which top-level page is active underneath them.
function showPage(page) {
  appHeader.hidden = page !== 'events';
  list.hidden = page !== 'events';
  dateDiffView.hidden = page !== 'date-diff';
  addSubtractView.hidden = page !== 'add-subtract';
}

function openDrawer() {
  drawerBackdrop.hidden = false;
  drawer.classList.add('is-open');
}

function closeDrawer() {
  drawerBackdrop.hidden = true;
  drawer.classList.remove('is-open');
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

// Recomputes the date-to-date calculator's output from its two date
// fields. Called on every keystroke/change to those fields - there's no
// "Calculate" submit button, and this is deliberately NOT part of the
// setInterval(refresh, 1000) loop below, since the result is fixed once
// both dates are picked (nothing here needs to tick live).
function refreshDateDiff() {
  if (!diffFromField.value || !diffToField.value) {
    diffOutput.innerHTML = '<p class="empty-state">Pick both dates to see the difference.</p>';
    return;
  }
  renderDateDiff(diffOutput, new Date(diffFromField.value), new Date(diffToField.value));
}

// Flips which direction (Add/Subtract) the add/subtract calculator uses.
function setDirection(direction) {
  asDirection = direction;
  asDirectionButtons.forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.direction === direction);
  });
  refreshAddSubtract();
}

// Years/months are calendar-discrete (addToDate in js/countdown.js rolls
// them by whole calendar months), so fractional amounts don't make sense
// for those units - but weeks/days/hours/minutes are plain millisecond
// spans, where a fractional amount (e.g. 2.5 days) is exact. Flip the
// amount field's step to match the selected unit so the browser's numeric
// spinner nudges by the right increment.
function updateAmountStep() {
  const wholeUnitsOnly = asUnitField.value === 'years' || asUnitField.value === 'months';
  asAmountField.step = wholeUnitsOnly ? '1' : 'any';
}

// Recomputes the add/subtract calculator's result date. Same "no live
// ticking, recompute on input" approach as refreshDateDiff above.
function refreshAddSubtract() {
  updateAmountStep();
  const rawAmount = parseFloat(asAmountField.value);
  if (!asBaseDateField.value || Number.isNaN(rawAmount)) {
    asResult.textContent = '';
    return;
  }
  const base = new Date(asBaseDateField.value);
  const signedAmount = asDirection === 'subtract' ? -rawAmount : rawAmount;
  const result = addToDate(base, signedAmount, asUnitField.value);
  asResult.textContent = formatDateTime(result);
}

// --- Event listeners: wiring up user interactions ---

// Every top-level page's hamburger button opens the same drawer.
menuBtns.forEach((btn) => btn.addEventListener('click', openDrawer));
drawerBackdrop.addEventListener('click', closeDrawer);

// Delegated click handling on the drawer's link list, same pattern as the
// event list's card clicks below.
drawerLinks.addEventListener('click', (e) => {
  const link = e.target.closest('.drawer__link');
  if (!link) return;
  showPage(link.dataset.page);
  closeDrawer();
});

diffFromField.addEventListener('input', refreshDateDiff);
diffToField.addEventListener('input', refreshDateDiff);

asDirectionButtons.forEach((btn) => {
  btn.addEventListener('click', () => setDirection(btn.dataset.direction));
});
asBaseDateField.addEventListener('input', refreshAddSubtract);
asAmountField.addEventListener('input', refreshAddSubtract);
asUnitField.addEventListener('change', refreshAddSubtract);

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

// Default the add/subtract calculator's base date to "now".
asBaseDateField.value = toLocalInputValue(new Date());
refreshAddSubtract();

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
