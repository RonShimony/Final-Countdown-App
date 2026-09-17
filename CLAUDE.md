# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Final Countdown is a static, no-build, plain HTML/CSS/JS Progressive Web App for tracking countdowns to future events and time-elapsed since past events. It's designed to be installed on an iPhone via Safari's "Add to Home Screen" (standalone display, safe-area-aware layout) since there's no native iOS build available (no Mac/Apple Developer account). All data is stored client-side in `localStorage` — there is no backend, no build tooling, no package manager, and no test suite.

## Running it locally

There is no build step. Files are served as-is; the only requirement is serving over HTTP rather than opening via `file://`, because `index.html` loads `js/app.js` as a native ES module (`<script type="module">`), and browsers block module imports over `file://`.

Start the bundled zero-dependency static server:
```
node serve.js
```
Then open `http://localhost:8123` in a browser. The server (`serve.js`) is a minimal `http` module script with no dependencies — no `npm install` is needed or possible (there is no `package.json`).

To test real iPhone install behavior (Add to Home Screen, standalone mode, offline via the service worker), the app must be served over HTTPS — `localhost` only satisfies the browser's PWA installability requirements on the machine running the server itself, not from another device. Deploy the static files as-is to any static host (GitHub Pages, Netlify, Vercel, etc.) for that.

**Note for Claude Code sessions:** the Bash/PowerShell tool shell can run in an environment isolated from the user's real, visible browser session (a sandbox). If the user reports "can't reach localhost" after `node serve.js` is started via a tool call, don't assume the server is broken — start it with `dangerouslyDisableSandbox: true`, or simpler, have the user open their own PowerShell window (address bar → type `powershell` in File Explorer) and run `node serve.js` themselves, leaving that window open.

## Architecture

Everything is wired together through native ES modules — no bundler, no transpilation:

- **`index.html`** — the entire UI shell in one file: the event list container, two standalone calculator pages (`#date-diff-view`, `#add-subtract-view`), a slide-in nav drawer, a floating "+" action button, and a single add/edit form rendered as a bottom sheet (also reused for editing — see below). Also carries all the PWA/iOS meta tags (`apple-mobile-web-app-*`, `viewport-fit=cover`, manifest link, apple-touch-icon).
- **`js/storage.js`** — the only module that touches `localStorage`. Events are one JSON array under the key `final-countdown:events`. Exposes `getEvents`, `saveEvent` (upsert by `id`), `deleteEvent`, `createEventId`.
- **`js/countdown.js`** — pure date math, no DOM. `getNextOccurrence(event, now)` is the key function: for non-recurring events it just returns the stored date; for `recurring: true` (yearly) events it rolls the stored month/day forward to the next occurrence that is `>= now`. `diff(target, now)` turns two dates into `{ isFuture, days, hours, minutes, seconds, totalMs }`. `formatClock`/`formatDaysLabel` are display helpers built on that. `getUnitBreakdown(totalMs)` returns the whole span expressed as a single decimal number in each of years/months/weeks/days/hours/minutes (e.g. `{ years: 0.6, ... }`), using average unit lengths (365.25-day year, year/12 month) — used by the detail view's unit-only timers, not the card list. `getYearPercentage(totalMs)` is separate from that breakdown: it expresses the span as a percentage of a 365-day *common* year (not the 365.25-day average `getUnitBreakdown` uses elsewhere), returned as a string fixed to 2 decimal places (e.g. `"50.00"`). `addToDate(date, amount, unit)` powers the add/subtract calculator: it shifts a specific calendar date by a whole quantity of a unit, returning a new Date. Unlike `getUnitBreakdown`'s fixed-average constants (right for describing the *size* of a span, wrong for arithmetic on one specific date), years/months here are calendar-correct — an internal `addMonths` helper clamps the day-of-month to whatever the target month can hold (e.g. Jan 31 + 1 month → Feb 28/29, never an overflowed March date). Weeks/days/hours/minutes are just exact millisecond arithmetic. Negative `amount` subtracts. `formatDateTime(date)` formats a Date as `"DD/MM/YYYY HH:MM:SS"` by hand (not `date.toLocaleString()`, which follows the browser's locale and can come out MM/DD/YYYY) — used by the add/subtract calculator's result so the date order is always DD/MM/YYYY regardless of browser/OS locale.
- **`js/render.js`** — pure rendering: `renderEvents(container, events, now)` recomputes each event's next occurrence + diff, splits into "Upcoming" (future, sorted soonest-first) and "Past" (elapsed, sorted most-recent-first) sections, and rebuilds the DOM from scratch each call. `appendTimeBreakdown(container, d, verb)` builds the shared "big countdown" block — classic D/H/M/S timer plus the six `getUnitBreakdown` rows plus a "% of Year" row (from `getYearPercentage`) — used by both `renderDetail(container, event, now)` (the full-screen per-event detail view, `verb` = "remaining"/"ago") and `renderDateDiff(container, fromDate, toDate)` (the date-to-date calculator: always measures from whichever picked date is earlier to whichever is later, so it's always non-negative, and omits `verb` entirely since there's no "now" to be "remaining"/"ago" relative to).
- **`js/app.js`** — the entry point / glue. Wires the add/edit form, delegated click handling on the event list (opens the full-screen detail view, not the edit form directly — see below), color-swatch selection, the nav drawer, both calculator pages, and drives the live-updating UI with `setInterval(refresh, 1000)` — **a full re-render every second**, not an incremental DOM patch. This is intentional given the small expected list size; don't reach for a diffing/virtual-DOM approach here without a reason. The two calculator pages are deliberately *not* part of that interval — they're pure, stateless calculators (see "Navigation: drawer + top-level pages" below) that recompute only on input change, not live-ticking.
- **`sw.js`** — a hand-rolled cache-first service worker precaching a fixed `ASSETS` list. **Any new static file added to the app (new JS module, new icon, etc.) must be added to `ASSETS` in `sw.js` and the cache name (`CACHE_NAME`) bumped, or it won't be picked up for offline use / existing installs won't see the update.** Bumping `CACHE_NAME` alone isn't always enough to see changes immediately in a browser that already has the app open/cached: the still-active old service worker can intercept the new version's own install-time downloads and hand it stale cached files instead of fetching the real ones. When testing a fresh change and it doesn't seem to show up, unregister the service worker and clear Cache Storage (devtools → Application tab, or `(await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister())` + `(await caches.keys()).forEach(k => caches.delete(k))` in the console) rather than assuming the code is wrong. This is a one-time dev-testing wrinkle from having loaded the app in that browser before — see the Status section below for why it won't matter for a single fresh iPhone install done after development is finished.
- **`manifest.webmanifest`** — standalone display, portrait orientation, dark theme colors, icons.
- **`icons/`** — PNG icons at 180/192/512px: a metallic hourglass on a dark starfield. Generated programmatically (vector shapes drawn with .NET `System.Drawing`/GDI+ via a throwaway PowerShell script — gradients for the glass, `PathGradientBrush` glow for the 4 corner stars, rendered at 512px then downscaled) rather than sourced from design assets. There is no source image or design file — to change the icon, either write a similar draw script (rendered at 512 then downscaled to 180/192 for crisp edges) or replace all three PNGs with real artwork of matching dimensions.

### Detail view / edit sheet layering
Tapping an event card opens a full-screen detail view (`#detail-view` in `index.html`, filled by `renderDetail`), not the edit form directly. Its "Edit" button opens the existing add/edit bottom sheet (`#event-form` + `#sheet-backdrop`) layered *on top* of the detail view rather than replacing it — Cancel/Save close just the sheet, returning to the detail view underneath. This relies on explicit `z-index` values in `css/style.css` (`.detail-view` = 5, `.sheet-backdrop` = 10, `.sheet` = 11); keep that ordering if either is restyled.

### Navigation: drawer + top-level pages
There are three mutually-exclusive top-level "pages" — the event list (`#app-header` + `#event-list`), the date-to-date calculator (`#date-diff-view`), and the add/subtract calculator (`#add-subtract-view`) — switched via `showPage(page)` in `js/app.js`, which just toggles `hidden` on whichever containers aren't the target page. This is separate from (and composes with) the existing detail-view/edit-sheet drill-down: `showPage` only ever touches the three top-level containers, never `#detail-view` or the sheet. Each top-level page has its own hamburger button (`.menu-btn`) in its header, opening a shared slide-in `#drawer` (toggled via an `.is-open` class, not `hidden`, since `hidden` sets `display:none` and would prevent the CSS transition from animating — this is the only `transition`/`transform`-animated element in the app). The drawer and its backdrop sit above every other layer (`.drawer-backdrop` = 20, `.drawer` = 21), above the existing `.detail-view`(5)/`.sheet-backdrop`(10)/`.sheet`(11) stack, since it's a global overlay reachable from any top-level page. Both calculator pages deliberately reuse the `.detail-view` CSS class (not new layout rules) so they inherit the same full-bleed layering, safe-area padding, and 480px centered content column as the per-event detail view — including automatically covering the FAB via the existing z-index, with no extra JS needed. Both calculators are pure and stateless: nothing they compute is saved to `localStorage`, and neither is wired into the `setInterval(refresh, 1000)` loop — they only recompute when their inputs change.

### Data model
```js
{
  id: string,          // crypto.randomUUID()
  title: string,
  date: string,         // ISO datetime (UTC) of the first/anchor occurrence
  color: string,        // hex, chosen from the fixed swatch palette in index.html
  emoji: string,        // optional
  recurring: boolean,   // yearly recurrence flag
  createdAt: number
}
```
Dates are always stored as full ISO UTC strings (`Date.prototype.toISOString()`); all diffing is done via epoch milliseconds so timezone handling stays out of the date-math layer entirely. The color palette is currently only defined once, as hardcoded swatch buttons in `index.html` — there's no shared JS constant for it, so if the palette changes it needs to be edited there directly.

## Conventions

- No dependencies, no bundler, no TypeScript — keep additions to plain JS/CSS/HTML that runs unmodified in Safari on iOS.
- Module boundaries matter: date math stays in `countdown.js` (no DOM), storage stays in `storage.js` (no rendering), `render.js` builds DOM but never touches `localStorage` directly. Keep new logic in the module that matches its concern rather than adding cross-cutting code to `app.js`.
- **Comments**: the user is a CS student using this project partly to learn, so comments are intentionally denser than typical production code — this overrides the usual "no comments unless non-obvious" default. That said, keep new-feature comments light/high-level (explain a new file's purpose, or something genuinely non-obvious) rather than commenting every function; don't feel obliged to retrofit that lighter density onto the existing heavily-commented pass.

## Status

Git repo is initialized locally (not yet pushed to any remote). Core app (add/edit/delete events, countdown + count-up display, yearly recurrence, PWA install, offline service worker) is built and working, tested locally via `node serve.js`. The app icon is finalized (hourglass-on-starfield, see `icons/` note above). Every module now has explanatory comments (see Conventions above), and a full-screen per-event detail view has been added (see "Detail view / edit sheet layering" above) with a classic D/H/M/S timer plus years/months/weeks/days/hours/minutes-only decimal timers plus a "% of Year" row, for both upcoming and past events. Two more pages have since been added: a date-to-date calculator and an add/subtract calculator, reachable via a slide-in nav drawer (see "Navigation: drawer + top-level pages" above) — both are stateless, non-persisted, non-live-ticking calculators.

Not yet done / discussed but not started:
- The user is considering whether they want any more features and will decide by the next session — ask what's next rather than assuming; feature work may already be considered done.
- Deploying to a real HTTPS static host so it can actually be installed on the user's iPhone (currently only tested via `localhost` on the dev PC). This is the planned next session's main task, assuming no further features come up first — see the `sw.js` note above on why a single fresh install after development is done avoids the stale-cache dev-testing quirk entirely.
