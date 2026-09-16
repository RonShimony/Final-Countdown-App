// This module does all the DATE MATH for the app. It has no idea about the
// DOM (no document.querySelector, no HTML) and no idea about localStorage -
// it just takes dates in and returns numbers/objects out. Keeping it "pure"
// like this makes it easy to reason about and test in isolation.

const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;
const MS_PER_WEEK = MS_PER_DAY * 7;
const MS_PER_YEAR = MS_PER_DAY * 365.25; // 365.25 averages in leap years
const MS_PER_MONTH = MS_PER_YEAR / 12;

// Given an event, figures out the next date/time it should count down (or
// up) to. `now` defaults to the current moment, but can be passed in
// explicitly (handy for testing with a fixed date instead of the real clock).
export function getNextOccurrence(event, now = new Date()) {
  const original = new Date(event.date);

  // Non-recurring (one-time) events always count towards their original
  // stored date, whether that's in the future or the past.
  if (!event.recurring) return original;

  // For a yearly recurring event (like a birthday), we want the NEXT
  // upcoming occurrence, not the original year it was created in.
  // Strategy: take the original month/day, but swap in the current year.
  const next = new Date(original);
  next.setFullYear(now.getFullYear());

  // If that date has already passed this year (e.g. today is in November
  // but the event's month/day is in March), roll it forward to next year.
  if (next.getTime() < now.getTime()) {
    next.setFullYear(now.getFullYear() + 1);
  }
  return next;
}

// Computes the difference between a target date and "now", broken down
// into days/hours/minutes/seconds, plus whether the target is in the
// future or the past.
//
// Internally everything is compared using epoch milliseconds
// (Date.getTime() - the number of milliseconds since Jan 1, 1970 UTC).
// Working in raw milliseconds instead of Date objects sidesteps timezone
// and calendar edge cases entirely - subtraction just works.
export function diff(target, now = new Date()) {
  const totalMs = target.getTime() - now.getTime();
  const isFuture = totalMs >= 0; // true = counting down, false = counting up (elapsed)
  const abs = Math.abs(totalMs); // work with a positive number either way

  // Break the total milliseconds down into whole days/hours/minutes/seconds.
  // Each line divides by the size of that unit (in ms), then `% <unit>`
  // strips off whole multiples of the NEXT bigger unit so hours resets at
  // 24, minutes/seconds reset at 60, etc. (classic "convert seconds to
  // h:m:s" arithmetic).
  const days = Math.floor(abs / MS_PER_DAY);
  const hours = Math.floor(abs / MS_PER_HOUR) % 24;
  const minutes = Math.floor(abs / MS_PER_MINUTE) % 60;
  const seconds = Math.floor(abs / 1000) % 60;

  return { isFuture, days, hours, minutes, seconds, totalMs };
}

// Used by the event detail view's "years/months/weeks/days/hours/minutes
// only" timers - each is the whole span expressed as a single decimal
// number in that unit (e.g. 0.6 years), rather than the broken-down
// remainder style diff() above uses for the classic D/H/M/S timer.
export function getUnitBreakdown(totalMs) {
  const abs = Math.abs(totalMs);
  const round1 = (n) => Math.round(n * 10) / 10;
  return {
    years: round1(abs / MS_PER_YEAR),
    months: round1(abs / MS_PER_MONTH),
    weeks: round1(abs / MS_PER_WEEK),
    days: round1(abs / MS_PER_DAY),
    hours: round1(abs / MS_PER_HOUR),
    minutes: round1(abs / MS_PER_MINUTE),
  };
}

// Pads a single number to 2 digits with a leading zero (5 -> "05").
// Used so the clock always looks like "03:07:09" instead of "3:7:9".
const pad = (n) => String(n).padStart(2, '0');

// Formats the hours/minutes/seconds part of a diff() result as "HH:MM:SS".
export function formatClock(d) {
  return `${pad(d.hours)}:${pad(d.minutes)}:${pad(d.seconds)}`;
}

// Returns "day" or "days" depending on the count, for correct English
// grammar (e.g. "1 day" vs "2 days").
export function formatDaysLabel(d) {
  return d.days === 1 ? 'day' : 'days';
}
