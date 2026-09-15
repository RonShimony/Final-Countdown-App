export function getNextOccurrence(event, now = new Date()) {
  const original = new Date(event.date);
  if (!event.recurring) return original;

  const next = new Date(original);
  next.setFullYear(now.getFullYear());
  if (next.getTime() < now.getTime()) {
    next.setFullYear(now.getFullYear() + 1);
  }
  return next;
}

export function diff(target, now = new Date()) {
  const totalMs = target.getTime() - now.getTime();
  const isFuture = totalMs >= 0;
  const abs = Math.abs(totalMs);

  const days = Math.floor(abs / 86400000);
  const hours = Math.floor(abs / 3600000) % 24;
  const minutes = Math.floor(abs / 60000) % 60;
  const seconds = Math.floor(abs / 1000) % 60;

  return { isFuture, days, hours, minutes, seconds, totalMs };
}

const pad = (n) => String(n).padStart(2, '0');

export function formatClock(d) {
  return `${pad(d.hours)}:${pad(d.minutes)}:${pad(d.seconds)}`;
}

export function formatDaysLabel(d) {
  return d.days === 1 ? 'day' : 'days';
}
