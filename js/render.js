// This module is responsible for turning event data into visible HTML.
// It builds/updates the DOM (the tree of elements the browser actually
// draws), but it never reads or writes localStorage directly - it's only
// given data and a container element to fill in.

import { getNextOccurrence, diff, formatClock, formatDaysLabel, getUnitBreakdown } from './countdown.js';

// Safely inserts user-typed text into HTML without allowing it to be
// interpreted as HTML/script tags (this is what prevents an XSS attack via
// a title like "<script>...</script>"). The trick: setting .textContent on
// a throwaway <div> auto-escapes special characters, and reading back
// .innerHTML gives us that escaped, safe string to drop into a template.
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Creates an <h2> section title, e.g. "Upcoming" or "Past".
function sectionHeader(text) {
  const el = document.createElement('h2');
  el.className = 'section-header';
  el.textContent = text;
  return el;
}

// Creates the "No events yet" placeholder shown when the list is empty.
function emptyState() {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = '<p>No events yet.</p><p>Tap + to add your first countdown.</p>';
  return el;
}

// Builds one clickable event card (a <button>, so it's keyboard/tap
// accessible) showing the emoji, title, day count, and live clock.
// `event` is the raw stored event object; `d` is its precomputed diff()
// result (days/hours/minutes/seconds until or since it happens).
function card({ event, d }) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'event-card';
  // Stashing the event's id on the element itself (as a data-* attribute)
  // lets app.js figure out which event was clicked later, without having
  // to keep a separate lookup table tying DOM elements to data.
  el.dataset.id = event.id;
  // Sets a CSS custom property (--accent) so style.css can use the
  // event's chosen color for this specific card (e.g. its border/glow),
  // without needing a different CSS class per color.
  el.style.setProperty('--accent', event.color);

  const emoji = event.emoji
    ? `<span class="event-card__emoji">${escapeHtml(event.emoji)}</span>`
    : '';
  const verb = d.isFuture ? 'remaining' : 'ago';

  // Building the card's inner HTML as one template string is simpler here
  // than creating each child element one by one with createElement.
  // User-provided text (title, emoji) is passed through escapeHtml first.
  el.innerHTML = `
    <div class="event-card__header">
      ${emoji}
      <span class="event-card__title">${escapeHtml(event.title)}</span>
    </div>
    <div class="event-card__body">
      <span class="event-card__days">${d.days}</span>
      <span class="event-card__unit">${formatDaysLabel(d)} ${verb}</span>
    </div>
    <div class="event-card__clock">${formatClock(d)}</div>
  `;
  return el;
}

// Main entry point for this module: given the container element and the
// full list of stored events, wipes it out and rebuilds it from scratch
// showing "Upcoming" (future) and "Past" (already happened) sections.
//
// Rebuilding everything every call (rather than patching individual
// elements) is simpler to reason about, and is cheap enough for the small
// number of events this app expects - see app.js's setInterval, which
// calls this once per second.
export function renderEvents(container, events, now = new Date()) {
  // For every event, compute its target date and the diff (days/hours/etc.
  // remaining or elapsed) up front, so we can sort and filter using that
  // info without recalculating it repeatedly.
  const decorated = events.map((event) => {
    const target = getNextOccurrence(event, now);
    return { event, d: diff(target, now) };
  });

  // Events still ahead of us, soonest first (smallest totalMs first).
  const upcoming = decorated
    .filter((x) => x.d.isFuture)
    .sort((a, b) => a.d.totalMs - b.d.totalMs);

  // Events already in the past, most recently happened first. totalMs is
  // negative here, so the LARGEST (closest to zero) comes first, which is
  // why this comparator is flipped (b - a) relative to `upcoming`.
  const past = decorated
    .filter((x) => !x.d.isFuture)
    .sort((a, b) => b.d.totalMs - a.d.totalMs);

  // Clear out everything currently in the container before redrawing it.
  container.innerHTML = '';

  if (decorated.length === 0) {
    container.appendChild(emptyState());
    return;
  }

  if (upcoming.length) {
    container.appendChild(sectionHeader('Upcoming'));
    upcoming.forEach((x) => container.appendChild(card(x)));
  }

  if (past.length) {
    container.appendChild(sectionHeader('Past'));
    past.forEach((x) => container.appendChild(card(x)));
  }
}

// One row of the detail view's unit-only timer list, e.g. "Years  0.6 remaining".
function unitRow(label, value, verb) {
  const el = document.createElement('div');
  el.className = 'detail-unit';
  el.innerHTML = `
    <span class="detail-unit__label">${label}</span>
    <span class="detail-unit__value">${value} ${verb}</span>
  `;
  return el;
}

// Fills the event detail view (opened by tapping a card) with the event's
// info plus the classic D/H/M/S timer and the six unit-only timers.
export function renderDetail(container, event, now = new Date()) {
  const target = getNextOccurrence(event, now);
  const d = diff(target, now);
  const units = getUnitBreakdown(d.totalMs);
  const verb = d.isFuture ? 'remaining' : 'ago';

  const emoji = event.emoji
    ? `<span class="detail-emoji">${escapeHtml(event.emoji)}</span>`
    : '';

  container.innerHTML = '';
  container.style.setProperty('--accent', event.color);

  container.insertAdjacentHTML('beforeend', `
    <div class="detail-header">
      ${emoji}
      <h2 class="detail-title">${escapeHtml(event.title)}</h2>
    </div>
    <div class="detail-classic">
      <div class="detail-classic__days">
        <span class="detail-classic__num">${d.days}</span>
        <span class="detail-classic__unit">${formatDaysLabel(d)} ${verb}</span>
      </div>
      <div class="detail-classic__clock">${formatClock(d)}</div>
    </div>
  `);

  const unitsList = document.createElement('div');
  unitsList.className = 'detail-units';
  unitsList.appendChild(unitRow('Years', units.years, verb));
  unitsList.appendChild(unitRow('Months', units.months, verb));
  unitsList.appendChild(unitRow('Weeks', units.weeks, verb));
  unitsList.appendChild(unitRow('Days', units.days, verb));
  unitsList.appendChild(unitRow('Hours', units.hours, verb));
  unitsList.appendChild(unitRow('Minutes', units.minutes, verb));
  container.appendChild(unitsList);
}
