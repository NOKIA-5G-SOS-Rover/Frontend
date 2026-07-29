# Nokia 5G SOS Rover — Visual Redesign Notes

## Final concept

The redesign combines a cinematic, data-driven rover hero with a restrained editorial interface for daily operations. The visual system uses warm off-white working surfaces, charcoal typography, deep navy cinematic sections, Nokia blue, cool silver, and tightly controlled amber/red emergency accents.

The signature hero visual is a lightweight Canvas point-cloud rover. It remains recognisable at rest and progressively becomes a transmitted data stream as the page scrolls. Pointer interaction subtly moves nearby signal points, while reduced-motion users receive a static, polished fallback.

## Functionality preserved

- Overview, Cameras, and Past Alerts views
- Existing view navigation and state management
- Live event generation and mock event structures
- Event filtering and detection-detail review
- `Unverified`, `Confirmed threat`, and `False alarm` workflow
- Critical alert rail, alert dismissal, and archive navigation
- Critical alert sound and browser notification logic
- One-notification-per-critical-event deduplication via in-memory IDs and `localStorage`
- Camera fullscreen behaviour
- Automatic/manual rover modes
- Keyboard and pointer direction controls
- Speed adjustment and reset
- Past-alert confidence/location/date filters
- Focused-alert navigation, evidence zoom, reset, and fullscreen review
- Existing backend/WebSocket integration points and data contracts

## Files changed

- `public/index.html`
- `public/manifest.json`
- `src/App.js`
- `src/App.css`
- `src/App.test.js`
- `src/index.css`
- `src/setupTests.js`
- `src/fullscreen-viewer.css`
- `src/fullscreen-zoom-styles.css`
- `src/components/HomeView.jsx`
- `src/components/CamerasView.jsx`
- `src/components/LiveEventFeed.jsx`
- `src/components/PastAlertsView.jsx`

## Files created

- `public/favicon.svg`
- `src/components/ParticleRover.jsx`
- `src/styles/tokens.css`
- `src/styles/base.css`
- `src/styles/navigation.css`
- `src/styles/home.css`
- `src/styles/cameras.css`
- `src/styles/events.css`
- `src/styles/alerts.css`
- `src/styles/responsive.css`
- `REDESIGN_NOTES.md`

## Dependencies

No package dependency was added. The particle rover uses the browser Canvas API, `requestAnimationFrame`, `IntersectionObserver`, and `ResizeObserver`. This avoids adding Three.js, React Three Fiber, GSAP, or another overlapping animation library.

`Instrument Serif` and `Inter Tight` are requested through Google Fonts with system fallbacks. The interface remains usable if the font request is unavailable.

## Animation system

- Canvas point-cloud rover with deterministic particles
- Scroll-linked data-transmission/disintegration progression
- Cursor-reactive signal field on capable desktop devices
- Animation pausing when the hero leaves the viewport
- Reduced particle counts on mobile and lower-core devices
- CSS transform/opacity transitions for interface state changes
- Alert pulses reserved for critical states
- Event status, modal, camera, filter, and control transitions
- Full `prefers-reduced-motion` treatment

## Responsive implementation

- Large desktop: cinematic split hero, dense operational grids, persistent detail hierarchy
- Laptop/tablet: simplified columns and reorganised camera/status panels
- Mobile: two-row navigation, stacked camera and alert layouts, reduced particle count, simplified visual metadata, touch-sized controls, and no horizontal dashboard overflow

## Accessibility implementation

- Semantic headings, sections, lists, buttons, labels, and dialogs
- Visible keyboard focus states
- `aria-current`, `aria-expanded`, `aria-pressed`, dialog labels, and status labels
- Keyboard operation for event cards, rover direction, evidence reset, evidence fullscreen, and modal dismissal
- Status text in addition to colour
- Strong critical-alert contrast
- Reduced-motion static fallback
- Decorative Canvas and graphics removed from the accessibility tree

## Verification completed

- Automated React tests: 4 passed
  - Overview and live event feed rendering
  - Cameras navigation, mode switching, speed adjustment, and movement controls
  - Past Alerts navigation, archive filters, and date controls
  - Event verification workflow interaction
- Production build: compiled successfully
- ESLint: completed with zero warnings/errors
- Production build served locally and returned HTTP 200

## Remaining limitations

- The uploaded project does not contain a real camera stream URL, rover hardware connection, or live backend payload. The redesign preserves the current simulated feed and existing integration boundaries rather than inventing an incompatible API.
- A separate official Nokia vector logo was not present in the supplied archive. The navigation therefore uses clean text branding without modifying or fabricating the official logo artwork.
- Browser notification permission, operating-system notification placement, audio autoplay policy, real camera fullscreen, and hardware keyboard behaviour must still be confirmed in the target deployment browser.
- The execution environment allowed build/tests/server verification but blocked automated Chromium access to local URLs, so final visual device checks should be completed once on the target laptop and phone.

## Recommended optional assets

- Official Nokia SVG logo supplied by the project team
- Real rover cut-out or approved 3D/photogrammetry asset for an even more exact particle silhouette
- Real camera/WebRTC endpoint and representative offline/error frames
- Final production telemetry field definitions and alert-zone labels

## Finishing pass

- Removed the homepage rover point cloud and its precomputed model data.
- Replaced it with a lightweight full-hero ambient particle field that animates continuously and reacts to scrolling.
- Re-centred the hero composition and changed the headline to “Meet Sânzi / the 5G SOS Rover.”
- Removed the “Autonomous emergency response platform” kicker.
- Removed the “02 / Operations overview” labels and changed the operations headline to “Navigating urgent data with clarity.”
- Converted the homepage Live Event Feed and detection review modal to the same light editorial system used by Past Alerts.
