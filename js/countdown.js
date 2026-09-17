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
const MS_PER_COMMON_YEAR = MS_PER_DAY * 365; // a "common year" is exactly 365 days (no leap-year averaging)

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

// Used by the detail view's "% of common year" row. Expresses the span as
// a percentage of a 365-day common year (e.g. exactly 6 months is ~half of
// 365 days, so this returns "50.00"). Returned as a string (not a number)
// so trailing zeros are never dropped - toFixed(2) always gives exactly
// two decimal places, which Math.round wouldn't guarantee (e.g. 50 vs 50.00).
export function getYearPercentage(totalMs) {
  const abs = Math.abs(totalMs);
  return ((abs / MS_PER_COMMON_YEAR) * 100).toFixed(2);
}

// Adds N whole months to a date, preserving day-of-month where possible and
// clamping to the last valid day of the target month when it doesn't exist
// there (e.g. Jan 31 + 1 month -> Feb 28/29, never an overflowed March
// date). N may be negative (going backwards). Internal helper for
// addToDate() below - callers should always go through addToDate with an
// explicit unit rather than calling this directly.
function addMonths(date, n) {
  const result = new Date(date.getTime());
  const originalDay = result.getDate();

  // Jump to the 1st of the month BEFORE changing the month. If we were
  // still sitting on e.g. the 31st when setMonth() runs, and the target
  // month is shorter than 31 days, setMonth() would silently overflow into
  // the following month (the classic "Jan 31 + 1 month = March 3" bug).
  // Starting from day 1 sidesteps that entirely.
  result.setDate(1);
  result.setMonth(result.getMonth() + n);

  // Clamp the day back to whatever the target month can actually hold.
  // `new Date(year, month + 1, 0)` is a standard trick: day 0 of the
  // following month is the last day of the target month.
  const daysInTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, daysInTargetMonth));

  return result;
}

// Adds (or subtracts, if `amount` is negative) a quantity of a given unit
// to a date, returning a NEW Date - `date` itself is never mutated. Used by
// the add/subtract calculator page.
//
// Years and months are calendar-correct (see addMonths above) rather than
// using the fixed-average MS_PER_YEAR/MS_PER_MONTH constants above - those
// are right for describing the SIZE of a span (getUnitBreakdown), but wrong
// for arithmetic on one specific calendar date. Weeks/days/hours/minutes
// are unambiguous spans of milliseconds, so those are added directly and
// exactly (2.5 days really is exactly 60 hours) - no calendar ambiguity to
// resolve there, unlike years/months.
//
// There's no separate "subtract" mode: callers negate `amount` themselves
// for subtraction, keeping this function's job to just one thing - add a
// (possibly negative) quantity.
export function addToDate(date, amount, unit) {
  switch (unit) {
    case 'years':
      return addMonths(date, amount * 12);
    case 'months':
      return addMonths(date, amount);
    case 'weeks':
      return new Date(date.getTime() + amount * MS_PER_WEEK);
    case 'days':
      return new Date(date.getTime() + amount * MS_PER_DAY);
    case 'hours':
      return new Date(date.getTime() + amount * MS_PER_HOUR);
    case 'minutes':
      return new Date(date.getTime() + amount * MS_PER_MINUTE);
    default:
      throw new Error(`addToDate: unknown unit "${unit}"`);
  }
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

// Formats a Date as "DD/MM/YYYY HH:MM:SS" - used by the add/subtract
// calculator's result. Built by hand (rather than date.toLocaleString(),
// which follows the browser's locale and can come out MM/DD/YYYY) so the
// date order is always DD/MM/YYYY no matter which browser/OS this runs on.
export function formatDateTime(date) {
  const datePart = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${datePart} ${timePart}`;
}
