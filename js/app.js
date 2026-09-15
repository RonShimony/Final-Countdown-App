import { getEvents, saveEvent, deleteEvent, createEventId } from './storage.js';
import { renderEvents } from './render.js';

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

const DEFAULT_COLOR = swatches[0]?.dataset.color || '#4dabf7';

let editingId = null;
let selectedColor = DEFAULT_COLOR;

function pad(n) {
  return String(n).padStart(2, '0');
}

function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setSelectedColor(color) {
  selectedColor = color;
  swatches.forEach((sw) => sw.classList.toggle('is-selected', sw.dataset.color === color));
}

function refresh() {
  renderEvents(list, getEvents());
}

function openSheet(event) {
  editingId = event ? event.id : null;
  sheetTitle.textContent = event ? 'Edit event' : 'New event';
  titleField.value = event ? event.title : '';
  dateField.value = toLocalInputValue(event ? new Date(event.date) : new Date());
  emojiField.value = event ? event.emoji || '' : '';
  recurringField.checked = event ? !!event.recurring : false;
  setSelectedColor(event ? event.color : DEFAULT_COLOR);
  deleteBtn.hidden = !event;

  backdrop.hidden = false;
  form.hidden = false;
  titleField.focus({ preventScroll: true });
}

function closeSheet() {
  backdrop.hidden = true;
  form.hidden = true;
  editingId = null;
}

addBtn.addEventListener('click', () => openSheet(null));
cancelBtn.addEventListener('click', closeSheet);
backdrop.addEventListener('click', closeSheet);

swatches.forEach((sw) => {
  sw.addEventListener('click', () => setSelectedColor(sw.dataset.color));
});

list.addEventListener('click', (e) => {
  const card = e.target.closest('.event-card');
  if (!card) return;
  const event = getEvents().find((ev) => ev.id === card.dataset.id);
  if (event) openSheet(event);
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleField.value.trim();
  if (!title || !dateField.value) return;

  const existing = editingId ? getEvents().find((ev) => ev.id === editingId) : null;

  saveEvent({
    id: editingId || createEventId(),
    title,
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

refresh();
setInterval(refresh, 1000);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
