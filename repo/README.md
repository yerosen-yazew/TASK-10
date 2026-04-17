# ForgeRoom — Offline Collaboration Workspace

A pure frontend Vue 3 + TypeScript SPA for small-team whiteboard collaboration in offline/LAN environments. No backend, no cloud services, no signaling servers.

## Current Status

**Historical (iteration 1) remediation — full pass.** All Blockers (B1–B3), Highs (H4–H7), and Mediums from `.tmp/audit_report-1.md`, plus the residual gaps surfaced in `.tmp/audit_report_1-fix_check.md` (B3/H4/H7 partial-pass items), were closed in source + tests + docs for that iteration. The repository is ready for independent review and later `docker compose up` / `bash repo/run_tests.sh` verification.

- **Audit iteration 2 remediation (2026-04-17):** static gaps from `.tmp/audit_report-2.md` were addressed in source + tests: WebRTC inbound handlers now apply rich payload mutations to local IndexedDB before store refresh, snapshot-created events use dedicated `snapshot-op` envelopes (separate from `rollback-op`), backup imports are blocked when sticky-note/comment batch cap exceeds 1,000, and `CanvasHost` renders blob-backed room images (with placeholder fallback only when blob lookup fails).

- **Fix-check follow-up (2026-04-17):** (1) outbound `presence-op` over WebRTC is now wired — `WorkspacePage.onCursorMove` calls the new `publishPresence` alongside the local `presenceStore.updateCursor`; (2) `publishConflict` is no longer dead — `element-store.updateElement` emits `element-overwrite` when the target element has disappeared, and `chat-store.pinMessage` emits `pin-collision` when the 3-pin cap or a duplicate-pin is hit; (3) a new `unit_tests/pages/WorkspacePage.integration.test.ts` mounts the real `CanvasHost` + `ChatPanel` + `CommentDrawer` (no stubs) and asserts actor propagation + the `open-comments` / `cursor-move` flows end-to-end.
- **Audit iteration 1 closure (2026-04-17):** actor prop threaded from `WorkspacePage` into `CanvasHost` / `ChatPanel` / `CommentDrawer`; `CanvasHost` now emits `open-comments` + `cursor-move`; `WorkspaceToolbar` exposes a Pair button that emits `open-pairing`; new `services/collab-publisher.ts` fans every write signal into both BroadcastChannel and WebRTC DataChannels, wired from the element / chat / comment / snapshot / room stores; new `components/workspace/CursorOverlay.vue` renders remote-member cursors; backup export/import round-trips images as base64; `router/guards.ts` now gates all six active-session routes; `RoomListPage` has a Copy Link action. See [`docs/questions.md`](../docs/questions.md) entry #15 and [`docs/requirements-to-test.md`](../docs/requirements-to-test.md) "Audit-iteration-1 remediation log" for the per-finding mapping.
- **Prompt 10 sweep:** every R1–R20 requirement traces to real modules and authored tests; `docs/design.md` §4 Module Map refreshed to match the real `src/` tree; all 8 interaction states (loading, empty, submitting, disabled, success, error, conflict, **invalid-transition**) are mapped in [`docs/requirements-to-test.md`](../docs/requirements-to-test.md); `docs/questions.md` entries are in ascending numeric order with no silent renumbering.
- **Prompt 9:** multi-stage `Dockerfile` (node:20-alpine build → nginx:alpine serve) with `.dockerignore`, explicit `nginx.conf`, and `package*.json` layer-cache pattern.
- `docker compose up --build` serves the SPA at **http://localhost:5173**; `bash repo/run_tests.sh [--coverage]` runs the Vitest suite in a clean `node:20-alpine` container.
- All ports, scripts, and docs are consistent: Vite dev server 5173, Docker host port 5173 → nginx port 80, no undocumented env vars.
- **Prompt 8:** test corpus hardened, >90% coverage targeted, `@vitest/coverage-v8` wired (thresholds: 90% lines/statements/functions, 80% branches), R1–R20 traceability published in [`docs/requirements-to-test.md`](../docs/requirements-to-test.md).

Full feature scope: profile lifecycle with PBKDF2 unlock, room create/join with pairing codes, canvas element persistence, chat with pin/retention, threaded comments with mentions, image upload/caps, activity feed, manual-pairing WebRTC collaboration, autosave/snapshot/rollback, backup export/import with row-level validation, and preferences (theme + avatar color).

## Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 + TypeScript |
| Build | Vite 5 |
| Routing | Vue Router 4 |
| State | Pinia 2 |
| Testing | Vitest 2 + Vue Test Utils 2 |
| Container | Docker (nginx) |
| Node runtime | Node.js 20 LTS |

## Prerequisites

- **Node.js 20 LTS** (for local development)
- **Docker** (for containerized builds and tests)

## Project Structure

```
repo/
├── README.md               # This file
├── docker-compose.yml      # Frontend-only Docker Compose
├── run_tests.sh            # Docker-first test runner
└── frontend/
    ├── Dockerfile          # Multi-stage build (node:20-alpine) + serve (nginx:alpine)
    ├── .dockerignore       # Excludes node_modules, dist, coverage from build context
    ├── nginx.conf          # SPA fallback + static-asset cache headers
    ├── package.json        # Dependencies and scripts
    ├── index.html          # SPA entry point
    ├── vite.config.ts      # Vite dev server config
    ├── vitest.config.ts    # Test runner config
    ├── tsconfig.json       # TypeScript config
    ├── tsconfig.node.json  # Node-side TS config
    ├── src/
    │   ├── main.ts         # App entry — mounts session init + BroadcastChannel
    │   ├── App.vue         # Root component — activity tracking, session lifecycle
    │   ├── router/         # Route definitions + session guard
    │   ├── stores/         # Pinia stores (session, ui, room, element, comment, chat, presence, activity, snapshot)
    │   ├── pages/          # Page components (ProfileSelectPage fully implemented)
    │   ├── layouts/        # AppLayout with header, role chip, lock button
    │   ├── components/     # ToastContainer, AppBanner, ConfirmModal, InlineValidation + workspace/CursorOverlay.vue
    │   ├── engine/         # Room state machine, element/comment/chat/image/activity/snapshot/presence/autosave
    │   ├── models/         # Domain models, enums, constants
    │   ├── validators/     # Limit guards, state validators, room/join validators
    │   ├── serializers/    # Pairing codec, backup, snapshot
    │   ├── services/       # IndexedDB repos (10), session service, broadcast channel, collab-publisher (BC + WebRTC fan-out)
    │   └── utils/          # ID gen, size utils, date utils, logger
    ├── public/
    │   └── favicon.ico
    └── unit_tests/         # Frontend tests (see Test layout below)
        ├── setup.ts        # fake-indexeddb, BroadcastChannel/RTCPeerConnection/crypto polyfills
        ├── models/         # Model invariant tests
        ├── validators/     # Room/join/import/element validators, inline validation
        ├── serializers/    # Pairing, backup, snapshot roundtrips
        ├── services/       # IndexedDB repos, session/profile services, broadcast channel, webrtc adaptor, local-storage-keys
        ├── stores/         # All Pinia stores (session, ui, room, element, comment, chat, presence, activity, snapshot, import-export)
        ├── engine/         # Room, membership, element, image, comment, chat, presence, activity, snapshot, autosave engines
        ├── components/     # Shared + workspace components (toasts, banners, modals, canvas host, chat, activity feed, approval queue, pairing)
        ├── pages/          # Home, Profile, RoomList, RoomCreate, RoomJoin, Workspace, Backup, Preferences
        ├── layouts/        # AppLayout shell
        ├── router/         # Route table + session guard
        └── utils/          # id-generator, size-utils, date-utils, logger
```

## Local Development

```bash
cd repo/frontend
npm install
npm run dev
```

The dev server starts on **http://localhost:5173**.

## Build

```bash
cd repo/frontend
npm run build
```

Output is written to `repo/frontend/dist/`.

## Testing

### Docker (recommended)

```bash
bash repo/run_tests.sh              # run the Vitest suite
bash repo/run_tests.sh --coverage   # run with V8 coverage (HTML + lcov reports)
```

Both invocations run inside a clean `node:20-alpine` container (`npm install && npm run test[:coverage]`).

### Local

```bash
cd repo/frontend
npm test                 # one-shot run
npm run test:watch       # watch mode (re-runs on change)
npm run test:coverage    # one-shot with V8 coverage
```

Coverage reports land in `repo/frontend/coverage/`. Thresholds: 90% lines / statements / functions, 80% branches. `src/models/**`, `src/**/index.ts`, `src/main.ts`, and `src/env.d.ts` are excluded — they are type declarations, barrels, or the DOM mount entry.

### Test layout

| Folder | Purpose |
|---|---|
| `unit_tests/setup.ts` | Installs `fake-indexeddb`, `BroadcastChannel`, `RTCPeerConnection`, and Web Crypto polyfills; resets mocks + `localStorage` between tests |
| `unit_tests/models/` | Model invariants, enum shapes, constant checks |
| `unit_tests/validators/` | Room/join/element/import/inline validators |
| `unit_tests/serializers/` | Pairing codec, backup, snapshot roundtrips |
| `unit_tests/services/` | IndexedDB repositories, profile/session services, broadcast-channel, webrtc-adaptor, local-storage-keys |
| `unit_tests/stores/` | All Pinia stores (session, ui, room, element, comment, chat, presence, activity, snapshot, import-export) |
| `unit_tests/engine/` | Room, membership, element, image, comment, chat, presence, activity, snapshot, autosave engines |
| `unit_tests/components/` | Shared components (toasts, banners, modals, validation) + workspace components (canvas host, chat, activity, approval queue, pairing) |
| `unit_tests/pages/` | Home, Profile, RoomList, RoomCreate, RoomJoin, Workspace, Backup, Preferences |
| `unit_tests/layouts/` | `AppLayout` shell — header, role chip, lock button, toasts, banner, confirm modal |
| `unit_tests/router/` | Route table + session guard |
| `unit_tests/utils/` | id-generator, size-utils, date-utils, logger |

### Requirement-to-test traceability

Each requirement label (R1–R20) is mapped to its implementing modules, test files, and key `it()` assertions in [`docs/requirements-to-test.md`](../docs/requirements-to-test.md). Every test file also carries a `// REQ: R<n>` header comment so traceability is visible at the source level.

## Docker

```bash
cd repo
docker compose up --build
```

The app is served at **http://localhost:5173** (docker-compose maps host port 5173 → nginx container port 80).

## Environment Variables

ForgeRoom requires **no custom environment variables**. The build and runtime are entirely self-contained.

Vite's standard built-ins are used internally (`import.meta.env.DEV` / `import.meta.env.PROD`) to suppress debug logging in production builds. No `.env` file is needed. Do not create a `.env` file — any accidentally committed secrets would be compiled into the SPA bundle.

## Routes

| Path | Purpose | Guard |
|---|---|---|
| `/` | Landing page | Public |
| `/profile` | Profile selection, creation, and passphrase unlock | Public |
| `/rooms` | Room list and recent rooms | Requires active session |
| `/rooms/create` | Create a new room | Requires active session |
| `/rooms/join` | Join a room via pairing code (accepts `?code=`) | Requires active session |
| `/workspace/:roomId` | Main collaboration workspace | Requires active session |
| `/workspace/:roomId/settings` | Room settings + preferences (Host settings; preferences for all) | Requires active session |
| `/workspace/:roomId/backup` | Backup export and import | Requires active session |

## Auth Model (Local-Only)

**ForgeRoom uses local-only profile selection — there is no server-side login.**

- Profile passphrases are derived using PBKDF2-HMAC-SHA-256 (100,000 iterations). The raw passphrase is never stored anywhere.
- The session enforces a **30-minute inactivity lock** and an **8-hour forced sign-out** using LocalStorage timestamps that survive page reloads.
- Roles (Host, Reviewer, Participant, Guest) are **UI personas only** — they control menu visibility for convenience and are not a security boundary.

## Browser Requirements

The following browser APIs are required:

- **Web Crypto API** — passphrase key derivation (PBKDF2)
- **IndexedDB** — room data and binary asset persistence
- **LocalStorage** — preferences and session flags
- **BroadcastChannel** — multi-tab coordination (wired in `broadcast-adaptor.ts`)
- **Canvas API** — whiteboard rendering (placeholder `<canvas>` mounted; full rendering deferred)
- **WebRTC DataChannels** — LAN peer-to-peer collaboration via `webrtc-peer-service.ts` (manual copy/paste pairing)

## Limitations

- **No backend.** All data is stored locally in the browser.
- **No cloud sync.** Collaboration is LAN-only via WebRTC.
- **No signaling server.** WebRTC pairing uses manual copy/paste or QR scan.
- **Roles are UI personas only**, not a security boundary.
- **Passphrase is local-only.** Forgetting it means creating a new profile — there is no recovery mechanism.
- **Full Canvas API rendering** (viewport transforms, zoom/pan, pressure-sensitive pen paths) is deferred. Element overlays use SVG/div for UI credibility.
- **QR code generation** is not implemented — pairing uses text copy/paste only.
