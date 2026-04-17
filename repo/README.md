# ForgeRoom — Offline Collaboration Workspace

Pure frontend Vue 3 + TypeScript SPA for small-team collaboration in offline/LAN environments.
No backend, no cloud services, no signaling servers.

## Project Type

**web**

ForgeRoom is a frontend-only web SPA.

## Current Status

ForgeRoom is production-ready for a frontend-only deployment path.

- Startup is Docker-first and deterministic.
- Tests run in Docker with enforced coverage thresholds.
- R1-R20 requirement-to-test traceability is documented in [`docs/requirements-to-test.md`](../docs/requirements-to-test.md).

## Prerequisites

- Docker (with Docker Compose support)

## Startup

```bash
cd repo
docker compose up --build
```

## Access Method

Open **http://localhost:5173** in your browser.

Expected result:
- Home page renders with links for profile setup and rooms.
- No backend service is required.

## System Verification

After startup, verify the system with this end-to-end user flow:

1. Open `http://localhost:5173`.
2. Click **Select Profile**.
3. Create a new profile with a passphrase of at least 8 characters.
4. Unlock that profile and confirm redirect to `/rooms`.
5. Create a room and confirm redirect to `/workspace/:roomId`.
6. Add a sticky note on the canvas and confirm it appears.
7. Send a chat message and confirm it appears in chat history.
8. Open the comment drawer for an element and add a comment.
9. Lock the session and confirm redirect to `/profile`.
10. Unlock again and confirm workspace access is restored.

## Demo Credentials

Profiles are local browser records, not server accounts.
Use these demo identities for validation across role personas:

| Role | Profile Name | Passphrase |
|---|---|---|
| Host | alice-host | Password123! |
| Reviewer | bob-reviewer | Password456! |
| Participant | charlie-participant | Password789! |
| Guest | diana-guest | Password000! |

Notes:
- These are demo values for local testing only.
- All profile data is stored in IndexedDB on the local browser.
- Clearing site data removes profiles and session state.

## Testing (Docker-Only)

```bash
bash repo/run_tests.sh               # frontend unit/integration suite
bash repo/run_tests.sh --coverage    # unit/integration + V8 coverage reports
bash repo/run_tests.sh --e2e         # Playwright browser journey suite
bash repo/run_tests.sh --all         # coverage suite + Playwright e2e suite
```

Coverage thresholds:
- 90% lines
- 90% statements
- 90% functions
- 80% branches

E2E notes:
- E2E runs through Docker Compose profile `e2e` via Playwright.
- The browser suite targets route accessibility and guard behavior from a real browser context.

## Project Structure

```
repo/
├── README.md
├── docker-compose.yml
├── run_tests.sh
└── frontend/
    ├── playwright.config.ts
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── e2e_tests/
    ├── src/
    └── unit_tests/
```

## Routes

| Path | Purpose | Guard |
|---|---|---|
| `/` | Landing page | Public |
| `/profile` | Profile selection / creation / unlock | Public |
| `/rooms` | Room list | Requires active session |
| `/rooms/create` | Create room | Requires active session |
| `/rooms/join` | Join via pairing code | Requires active session |
| `/workspace/:roomId` | Main collaboration workspace | Requires active session |
| `/workspace/:roomId/settings` | Workspace settings | Requires active session |
| `/workspace/:roomId/backup` | Backup import/export | Requires active session |

## Auth Model (Local-Only)

- No server-side login exists.
- Passphrases use PBKDF2-HMAC-SHA-256 derivation (100,000 iterations).
- Raw passphrases are never stored.
- Session policy: 30-minute inactivity lock + 8-hour forced sign-out.
- Roles (Host, Reviewer, Participant, Guest) are UI personas only, not a security boundary.

## Environment Variables

No custom environment variables are required.

## Browser Requirements

- Web Crypto API
- IndexedDB
- LocalStorage
- BroadcastChannel
- Canvas API
- WebRTC DataChannels

## Limitations

- No backend or cloud sync.
- Collaboration is LAN-first via WebRTC and local persistence.
- Pairing flow is manual copy/paste text exchange.
- Forgot passphrase cannot be recovered; create a new profile.
