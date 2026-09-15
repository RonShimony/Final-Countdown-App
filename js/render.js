import { getNextOccurrence, diff, formatClock, formatDaysLabel } from './countdown.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function sectionHeader(text) {
  const el = document.createElement('h2');
  el.className = 'section-header';
  el.textContent = text;
  return el;
}

function emptyState() {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = '<p>No events yet.</p><p>Tap + to add your first countdown.</p>';
  return el;
}

function card({ event, d }) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'event-card';
  el.dataset.id = event.id;
  el.style.setProperty('--accent', event.color);

  const emoji = event.emoji
    ? `<span class="event-card__emoji">${escapeHtml(event.emoji)}</span>`
    : '';
  const verb = d.isFuture ? 'remaining' : 'ago';

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

export function renderEvents(container, events, now = new Date()) {
  const decorated = events.map((event) => {
    const target = getNextOccurrence(event, now);
    return { event, d: diff(target, now) };
  });

  const upcoming = decorated
    .filter((x) => x.d.isFuture)
    .sort((a, b) => a.d.totalMs - b.d.totalMs);

  const past = decorated
    .filter((x) => !x.d.isFuture)
    .sort((a, b) => b.d.totalMs - a.d.totalMs);

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
