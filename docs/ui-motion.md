# CSM Online interaction motion

The motion layer is shared by Light and Dark mode and follows actual app state.
It uses native Web Animations with no extra animation library. Login/logout
also use native view transitions where available, with an entrance fallback.

## Interaction coverage

- Login/logout: a short whole-surface transition; logout immediately revokes
  the session, stops tracking/camera, closes dialogs, and clears the password.
- Navigation: page entrance, bounded card stagger, immediate breadcrumb update,
  and progress tied to each page's real loading promise.
- Search/detail/confirm/QR/password/scanner: distinct panel entrance and exit,
  cancellation on reopen, keyboard focus containment and return to the trigger.
- Entry: expanding/collapsing rows, selected-product reveal, edit-mode reveal,
  native validation feedback, and success feedback after successful writes.
- Master forms and ticket contents: measured-height disclosures; rapid toggles
  cancel old callbacks. Table rows themselves are never transformed.
- Charts: initial bar growth, doughnut sweeps and progressive lines; subsequent
  month changes retain Chart instances and dataset objects and morph from their
  current geometry. Identical SWR data and theme/resize updates stay instant.
- Buttons, menus, cards and images: brief press, hover and focus feedback.
- Requests: indeterminate progress and busy state. There are no invented
  completion percentages, data points or simulated save-success states.

Travel is usually 4–18 pixels; interface entrances last 240–460 ms, exits
150–240 ms, and chart entrances finish within 820 ms. Staggers are bounded.
Reduced motion removes interaction travel and chart animation. The previously
requested autoplay product float on login remains controlled by login.css.
Springs settle in 560–850 ms with restrained overshoot; chart morphs last 680 ms.

## Ten motion-design patterns

| Pattern | Behavior tied to the real interface |
| --- | --- |
| Micro-interactions | Button press, menu marker, focus, product hover and calendar-day signal. |
| Transition | Login/logout surface changes, page entrances, distinct popup/drawer exits. |
| Loading & progress | Independently released request tokens, delayed loader, month-loading ring and actual scroll progress. |
| Feedback animation | Validation shake and success feedback only after successful writes. |
| Storytelling / scroll | Below-fold sections reveal when scrolled into view, with segmented page progress. |
| Physics-based | Damped spring positions and velocity carry through an interruption; subtle fine-pointer card tilt. |
| Particle effects | Six finite pieces at a completed month change; eight after save success, at most one burst. |
| State transition | Month loading/ready/error, entry edit/disclosures and busy/available controls. |
| Text animation | Real month labels and changed numbers roll by glyph; unchanged values remain stable. |
| Morphing | Existing chart geometry updates, calendar-date FLIP, status pill shape, circle-to-check SVG. |

Month arrows and the month picker share `period-motion.js`. It captures at most
five visible outgoing canvases, applies only the newest requested period, and
repositions calendar cells using their actual date geometry. Rapid month changes,
logout, navigation, failure and hidden-tab events dispose old snapshots. Calendar
months with 28, 29, 30 or 31 days use their real dates and transaction totals.

Text's real final content is available immediately to assistive technology. Its
temporary glyphs, ballistic particles and morph overlays are inert, aria-hidden,
bounded to under 900 ms, and clear on scroll, resize or navigation. Springs use
the damped oscillator equation; decoration never changes data or save results.

## Lifecycle details

`assets/motion.js` owns cancellation through element version tokens. Async
actions retain their original return value and semantic disabled state; pending
calls are deduplicated, and busy indicators use independently released tokens.
Removing an entry item updates form data before its visual row exits, so an
immediate save cannot include that item. Older detail fetches and popup-close
callbacks cannot overwrite a newer dialog. A hidden scanner is excluded from
the focus loop by actual display state rather than matching the word `flex`.

The production Supabase endpoints and table shapes are unchanged. Browser
checks use only `/preview` and `/preview/login`, whose API calls are intercepted
by synthetic in-memory fixtures; those fixtures are absent from production.

## Verification

- `node scripts/check-ui-motion.mjs`: cancellation, focus, hidden scanner,
  reduced motion, busy overlap, duplicate submits, semantic button state,
  removal before submit, loading and surface transition races.
- `node scripts/check-chart-motion.mjs`: large datasets, callback/data
  preservation, identical data redraws, changed months and reduced motion.
- `node scripts/check-period-motion.mjs`: seven scenarios execute the real
  period controller and dashboard loader, covering latest-month ownership, async
  response/session races, failure, hidden pages and bounded snapshot cleanup.
- The 21 UI motion groups also cover independent physics integration, interrupt
  momentum, text integrity, ballistic paths, SVG morph geometry and native
  view-transition resize aborts without unhandled rejection.
- `node scripts/check-story-motion.mjs`: actual-scroll reveals, 0–100% progress,
  bounded card tilt, logout/reduced cleanup and back-forward cache restoration.
- Existing frontend, dashboard aggregation and photo-catalog checks pass.
- Browser: login, logout cancel/accept, repeated login, fast navigation,
  entry add/remove/save/edit, product search/detail/QR/Escape, disclosures,
  Light/Dark theme and mobile overflow checks.

For devices requesting reduced motion, `/preview?motion=full` is an explicit
fixture-only full-motion test override for both JS and CSS. Normal preview and
production keep device preferences. The fixture override is never loaded by
production `index.html` and still intercepts all Supabase calls with synthetic
in-memory data.

No deployment or production database writes are part of this change. Camera
teardown is checked with a deferred scanner stub; live camera permission is not
requested for the design preview.
