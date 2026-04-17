# Requirement-to-Test Traceability

This document maps each ForgeRoom requirement label (R1–R20) to the module(s)
that implement it and the test file(s) that cover it. Every test file in
`repo/frontend/unit_tests/` begins with a `// REQ: R<n> — <label>` comment so
the link from requirement → test can also be grepped directly.

> ForgeRoom is a pure-frontend offline SPA — there are no backend tests and no
> API tests. All coverage lives under `repo/frontend/unit_tests/`.

---

## R1–R20 Coverage Table

| REQ | Description | Implementing Modules | Test Files | Key `it()` Assertions |
|---|---|---|---|---|
| R1  | Host creates a Room; up to 20 active members (`MAX_ROOM_MEMBERS`)                             | `engine/room-engine`, `engine/membership-engine`, `validators/room-validators`, `validators/room-create-validator`, `pages/RoomCreatePage`, `stores/room-store`                                                                      | `engine/room-engine.test.ts`, `engine/membership-engine.test.ts`, `validators/room-validators.test.ts`, `validators/room-create-validator.test.ts`, `pages/RoomCreatePage.test.ts`, `stores/room-store.test.ts`         | "creates a room with a pairing code", "rejects 21st active member", "enforces 20-member cap", "calls createRoom with correct payload"                                         |
| R2  | Room link + on-screen pairing code join                                                       | `engine/room-engine`, `serializers/pairing-codec`, `validators/join-validator`, `pages/RoomJoinPage`                                                                                                                                  | `engine/room-engine.test.ts`, `serializers/pairing-codec.test.ts`, `validators/join-validator.test.ts`, `pages/RoomJoinPage.test.ts`                                                                                   | "generates pairing code in AAAA-BBBB format", "decodes room link back to roomId", "rejects malformed codes"                                                                   |
| R3  | Request → approval → active → leave state machine                                             | `validators/room-validators` (`VALID_MEMBERSHIP_TRANSITIONS`), `engine/membership-engine`, `stores/room-store`, `components/workspace/ApprovalQueue`                                                                                  | `validators/room-validators.test.ts`, `engine/membership-engine.test.ts`, `components/ApprovalQueue.test.ts`, `stores/room-store.test.ts`                                                                              | "terminal Left cannot transition", "approve moves Requested → Active", "deny triggers confirm modal"                                                                           |
| R4  | Optional second Reviewer approval at 15+ members (`SECOND_REVIEWER_THRESHOLD`)                | `engine/membership-engine`, `validators/room-validators`, `components/workspace/ApprovalQueue`                                                                                                                                        | `engine/membership-engine.test.ts`, `components/ApprovalQueue.test.ts`                                                                                                                                                | "routes to PendingSecondApproval at threshold", "dual-reviewer badge rendered", "second reviewer approves to Active"                                                          |
| R5  | Canvas elements (sticky, arrow, pen, image) with tool selector                                | `engine/element-engine`, `components/workspace/CanvasHost`, `components/workspace/WorkspaceToolSidebar`, `components/workspace/WorkspaceToolbar`                                                                                      | `engine/element-engine.test.ts`, `components/CanvasHost.test.ts`, `components/workspace/WorkspaceToolSidebar.test.ts`, `components/workspace/WorkspaceToolbar.test.ts`                                                | "renders 5 tool buttons", "emits tool-selected", "disables non-select at element cap", "emits open-comments with selected element id", "ingestImage receives blob/fileName/mimeType/dimensions shape" |
| R6  | Element caps — 2,000 elements/room, 5 MB/image, 50 images/room                                | `engine/image-engine`, `validators/element-validators`, `services/image-blob-repository`, `services/element-repository`                                                                                                              | `engine/image-engine.test.ts`, `validators/element-validators.test.ts`, `services/image-blob-repository.test.ts`, `services/element-repository.test.ts`                                                               | "rejects images > MAX_IMAGE_SIZE_BYTES", "rejects 51st image in a room", "countByRoom via by-roomId index"                                                                     |
| R7  | Threaded comments, 200 per thread (`MAX_COMMENTS_PER_THREAD`), @mentions                      | `engine/comment-engine`, `validators/comment-validators`, `services/comment-thread-repository`, `services/comment-repository`, `stores/comment-store`, `components/workspace/CommentDrawer`                                          | `engine/comment-engine.test.ts`, `validators/comment-validators.test.ts`, `services/comment-thread-repository.test.ts`, `services/comment-repository.test.ts`, `stores/comment-store.test.ts`, `components/CommentDrawer.test.ts` | "rejects 201st comment", "mention dropdown ranks active-first", "listByThread returns thread-scoped list"                                                                     |
| R8  | Chat — 5,000 retained messages (`MAX_CHAT_MESSAGES_RETAINED`), 3 pinned (`MAX_PINNED_MESSAGES`) | `engine/chat-engine`, `validators/chat-validators`, `services/chat-message-repository`, `services/pinned-message-repository`, `stores/chat-store`, `components/workspace/ChatPanel`                                                  | `engine/chat-engine.test.ts`, `validators/chat-validators.test.ts`, `services/chat-message-repository.test.ts`, `services/pinned-message-repository.test.ts`, `stores/chat-store.test.ts`, `components/ChatPanel.test.ts` | "deleteOldestExcess trims above cap", "pin button disabled at 3", "retention notice near cap"                                                                                  |
| R9  | Presence — avatar stack + cursor/name tags                                                    | `engine/presence-engine`, `stores/presence-store`, `components/workspace/PresenceAvatarStack`, `components/workspace/CursorOverlay`                                                                                                   | `engine/presence-engine.test.ts`, `stores/presence-store.test.ts`, `components/PresenceAvatarStack.test.ts`, `components/CursorOverlay.test.ts`                                                                      | "attach(roomId) populates cursors", "idle transition on activity timeout", "detach cleans state", "renders one cursor dot per remote member", "excludes self cursor by selfMemberId" |
| R10 | Activity feed (recent room events with filter)                                                | `engine/activity-engine`, `services/activity-repository`, `stores/activity-store`, `components/workspace/ActivityFeedPanel`                                                                                                           | `engine/activity-engine.test.ts`, `services/activity-repository.test.ts`, `stores/activity-store.test.ts`, `components/ActivityFeedPanel.test.ts`                                                                      | "filter tab change calls setFilter+refresh", "newest-first listing", "clears interval on unmount"                                                                              |
| R11 | Roles (Host, Reviewer, Participant, Guest) are **UI personas only**, not a security boundary | `models/room` (`RoomRole`), `layouts/AppLayout` (role chip), `pages/ProfileSelectPage` (disclosure), `components/StatusBadge`                                                                                                         | `models/room.test.ts`, `layouts/AppLayout.test.ts`, `pages/ProfileSelectPage.test.ts`, `components/StatusBadge.test.ts`                                                                                               | "role chip has UI-personas title", "ProfileSelectPage discloses personas-only", "StatusBadge renders role-agnostic labels"                                                     |
| R12 | Local-only profile select + passphrase unlock (≥8 chars)                                      | `services/profile-service` (PBKDF2), `services/profile-repository`, `services/session-service`, `stores/session-store`, `validators/passphrase-validator`, `pages/ProfileSelectPage`, `router/guards`                                 | `services/profile-service.test.ts`, `services/profile-repository.test.ts`, `services/session-service.test.ts`, `stores/session-store.test.ts`, `validators/passphrase-validator.test.ts`, `pages/ProfileSelectPage.test.ts`, `router/guards.test.ts` | "rejects <8 char passphrase", "unlock success navigates", "wrong passphrase shows error", "no plaintext stored", "room-create / room-join / workspace-settings / workspace-backup require active session" |
| R13 | 30-min inactivity lock, 8-hour forced sign-out                                                | `services/session-service`, `stores/session-store`, `router/guards`, `pages/ProfileSelectPage`, `App.vue` (activity tracking)                                                                                                         | `services/session-service.test.ts`, `stores/session-store.test.ts`, `router/guards.test.ts`, `pages/ProfileSelectPage.test.ts`                                                                                        | "surfaces inactivity-lock banner", "forced-sign-out after 8 h", "redirects to /profile when locked"                                                                           |
| R14 | IndexedDB persistence boundary for room/workspace data                                         | `services/db-schema`, `services/base-repository`, all typed repositories in `services/*-repository.ts`                                                                                                                              | `services/base-repository.test.ts`, `services/room-repository.test.ts`, `services/member-repository.test.ts`, `services/element-repository.test.ts`, `services/comment-repository.test.ts`, `services/snapshot-repository.test.ts` | "creates stores/indexes and CRUD surface", "query helpers honor room-scoped indexes", "retention helpers trim bounded stores" |
| R15 | LocalStorage for lightweight preferences and session flags                                     | `services/local-storage-keys`, `stores/preferences-store`, `stores/session-store`, `pages/WorkspaceSettingsPage`                                                                                                                   | `services/local-storage-keys.test.ts`, `stores/preferences-store.test.ts`, `stores/session-store.test.ts`, `pages/WorkspaceSettingsPage.test.ts`                                                                    | "theme/avatar/last-tool/recent-rooms persist", "session timers serialize lock/sign-out flags", "settings page writes preference updates" |
| R16 | Auto-save every 10 s (`AUTOSAVE_INTERVAL_MS`)                                                 | `engine/autosave-scheduler`, `components/workspace/AutosaveIndicator`                                                                                                                                                                | `engine/autosave-scheduler.test.ts`, `components/AutosaveIndicator.test.ts`                                                                                                                                          | "invokes onAutoSave every 10 s", "multi-room isolation", "survives async rejection"                                                                                           |
| R17 | Snapshots every 5 min, retain 48 (`MAX_SNAPSHOTS_RETAINED`), one-click rollback              | `engine/snapshot-engine`, `engine/autosave-scheduler` (snapshot cadence), `services/snapshot-repository`, `stores/snapshot-store`, `components/workspace/SnapshotDrawer`, `serializers/snapshot-serializer`                          | `engine/snapshot-engine.test.ts`, `engine/autosave-scheduler.test.ts`, `services/snapshot-repository.test.ts`, `stores/snapshot-store.test.ts`, `components/SnapshotDrawer.test.ts`, `serializers/snapshot-serializer.test.ts` | "trims above 48 retained", "rollback preserves history", "sorted by sequenceNumber", "snapshot-created and rollback notifications are distinct" |
| R18 | BroadcastChannel multi-tab coordination + conflict toasts                                      | `services/broadcast-channel-service`, `services/broadcast-adaptor`, `services/collab-publisher`, `components/ConflictToast`                                                                                                        | `services/broadcast-channel-service.test.ts`, `services/broadcast-adaptor.test.ts`, `services/broadcast-conflict.test.ts`, `services/collab-publisher.test.ts`, `components/ConflictToast.test.ts`                   | "BC envelopes route to stores", "conflict notifications surface warning UI", "publishConflict fans to BC + WebRTC" |
| R19 | WebRTC DataChannels with manual offer/answer pairing (no signaling server)                   | `services/webrtc-peer-service`, `services/webrtc-adaptor`, `services/collab-publisher`, `stores/peers-store`, `components/workspace/PairingPanel`, apply helpers in `engine/{element,chat,comment,membership}-engine`             | `services/webrtc-peer-service.test.ts`, `services/webrtc-adaptor.test.ts`, `services/collab-publisher.test.ts`, `stores/peers-store.test.ts`, `components/workspace/PairingPanel.test.ts`, `engine/element-engine.test.ts`, `engine/chat-engine.test.ts`, `engine/comment-engine.test.ts`, `engine/membership-engine.test.ts` | "manual pairing offer/answer handshake", "rich payload envelopes published", "inbound adaptor applies payloads to local IndexedDB before refresh" |
| R20 | Backup export/import (≤200 MB, row validation, 1,000-row bulk cap)                           | `serializers/backup-serializer`, `validators/import-validators`, `stores/import-export-store`, `pages/BackupPage`, `utils/size-utils`                                                                                               | `serializers/backup-serializer.test.ts`, `validators/import-validators.test.ts`, `stores/import-export-store.test.ts`, `pages/BackupPage.test.ts`, `utils/size-utils.test.ts`                                         | "rejects exports > MAX_BACKUP_SIZE_BYTES", "surfaces row-level cap errors", "blocks persist when sticky+comment cap is exceeded" |

---

## Cross-cutting Infrastructure Tests

| Concern | Test File |
|---|---|
| Router + route map (8 routes)                           | `router.test.ts`                             |
| Router guards (locked / forced / unlocked)              | `router/guards.test.ts`                      |
| BroadcastChannel multi-tab sync                         | `services/broadcast-channel-service.test.ts`, `services/broadcast-adaptor.test.ts` |
| BaseRepository CRUD + query indexes (fake-indexeddb)    | `services/base-repository.test.ts`           |
| LocalStorage typed keys                                 | `services/local-storage-keys.test.ts`        |
| UUID + pairing-code + verification-code generators      | `utils/id-generator.test.ts`                 |
| Byte size estimator + human formatter                   | `utils/size-utils.test.ts`                   |
| Date utilities (UTC, staleness)                         | `utils/date-utils.test.ts`                   |
| Logger wrapper                                          | `utils/logger.test.ts`                       |
| UI store (toasts, banners, confirm modal)               | `stores/ui-store.test.ts`                    |
| App shell (header, banner, toast, confirm, lock button) | `layouts/AppLayout.test.ts`                  |

---

## Interaction-State Coverage

Every user-visible state from CLAUDE.md §7 "Error and UI States" is covered
by at least one test. The table below maps state → files that assert it.

| State        | Covered In                                                                                                                                                                                     |
|---|---|
| loading      | `pages/RoomListPage.test.ts`, `pages/WorkspacePage.test.ts`, `components/CommentDrawer.test.ts`, `components/SnapshotDrawer.test.ts`, `pages/ProfileSelectPage.test.ts`, `pages/BackupPage.test.ts`, `components/workspace/MemberListSidebar.test.ts` |
| empty        | `components/ActivityFeedPanel.test.ts`, `components/workspace/MemberListSidebar.test.ts`, `components/CommentDrawer.test.ts`, `components/SnapshotDrawer.test.ts`, `pages/RoomListPage.test.ts`, `components/ChatPanel.test.ts`, `components/EmptyState.test.ts` |
| submitting   | `pages/RoomCreatePage.test.ts`, `pages/RoomJoinPage.test.ts`, `pages/BackupPage.test.ts`, `pages/ProfileSelectPage.test.ts`                                                                   |
| disabled     | `components/ChatPanel.test.ts`, `components/ApprovalQueue.test.ts`, `components/workspace/WorkspaceToolbar.test.ts`, `components/workspace/WorkspaceToolSidebar.test.ts`, `pages/RoomCreatePage.test.ts`, `pages/ProfileSelectPage.test.ts` |
| success      | `pages/RoomCreatePage.test.ts`, `pages/ProfileSelectPage.test.ts`, `pages/BackupPage.test.ts`, `engine/image-engine.test.ts`, `components/workspace/PairingPanel.test.ts`                      |
| error        | `stores/room-store.test.ts`, `stores/import-export-store.test.ts`, `stores/chat-store.test.ts`, `pages/BackupPage.test.ts`, `pages/ProfileSelectPage.test.ts`, `pages/WorkspacePage.test.ts`, `pages/RoomListPage.test.ts`, `components/ChatPanel.test.ts`, `components/workspace/PairingPanel.test.ts` |
| conflict     | `components/ConflictToast.test.ts`, `services/broadcast-conflict.test.ts`, `services/broadcast-adaptor.test.ts`                                                                             |
| invalid-transition | `validators/room-validators.test.ts` (VALID_MEMBERSHIP_TRANSITIONS), `engine/membership-engine.test.ts` (terminal Left cannot transition), `components/ApprovalQueue.test.ts` (deny path + 20-cap disable), `pages/WorkspacePage.test.ts` (stale-state banner when local member is Left) |

---

## Data-limit Enforcement

All numeric limits are imported from `@/models/constants` in tests — no bare
literals on the right-hand side of assertions. The following limits have
dedicated boundary tests (at-cap, one-over-cap, and cross-room isolation):

| Constant                    | Value      | Primary test file                                      |
|---|---|---|
| `MAX_ROOM_MEMBERS`          | 20         | `engine/membership-engine.test.ts`, `stores/room-store.test.ts` |
| `SECOND_REVIEWER_THRESHOLD` | 15         | `engine/membership-engine.test.ts`                              |
| `MAX_ELEMENTS_PER_ROOM`     | 2,000      | `validators/element-validators.test.ts`, `components/workspace/WorkspaceToolbar.test.ts` |
| `MAX_IMAGES_PER_ROOM`       | 50         | `engine/image-engine.test.ts`                                   |
| `MAX_IMAGE_SIZE_BYTES`      | 5 MB       | `engine/image-engine.test.ts`                                   |
| `MAX_CHAT_MESSAGES_RETAINED`| 5,000      | `services/chat-message-repository.test.ts`, `components/ChatPanel.test.ts` |
| `MAX_PINNED_MESSAGES`       | 3          | `components/ChatPanel.test.ts`, `stores/chat-store.test.ts`     |
| `MAX_COMMENTS_PER_THREAD`   | 200        | `validators/comment-validators.test.ts`, `engine/comment-engine.test.ts` |
| `MAX_SNAPSHOTS_RETAINED`    | 48         | `validators/snapshot-validators.test.ts`, `engine/snapshot-engine.test.ts` |
| `MAX_BACKUP_SIZE_BYTES`     | 200 MB     | `validators/import-validators.test.ts`, `utils/size-utils.test.ts`, `stores/import-export-store.test.ts` |
| `MAX_BULK_IMPORT_ITEMS`     | 1,000      | `validators/import-validators.test.ts`, `stores/import-export-store.test.ts` |

---

## How to run the tests

Scripts live in `repo/frontend/package.json`. All tests run in Vitest (jsdom).

```bash
# Docker-first (matches CI):
bash repo/run_tests.sh              # one-shot suite
bash repo/run_tests.sh --coverage   # V8 coverage (>=90% lines/statements/functions, >=80% branches)

# Local (requires npm install in repo/frontend first):
npm test                    # run once
npm run test:watch          # watch mode
npm run test:coverage       # V8 coverage
```

Coverage thresholds are declared in `repo/frontend/vitest.config.ts` and enforced
by the V8 provider. `src/models/**`, barrel `index.ts` files, `main.ts`, and
`env.d.ts` are excluded because they are pure type/enum/entry files with no
meaningful runtime branches.

---

## Historical static audit log (Prompt 10)

This section is retained as historical context for the Prompt 10 checkpoint.
It is superseded by later static audits (including `.tmp/audit_report-2.md`)
and subsequent remediation work.

The final static readiness audit verified the following without running anything:

- **R1–R20 coverage** — each requirement resolves to ≥1 implementing module and
  ≥1 test file in the table above. No gaps found.
- **Repo structure** — `docs/`, `repo/`, `repo/frontend/src/`, and
  `repo/frontend/unit_tests/` match the contract. `sessions/` is untouched.
  There are no root-level `unit_tests/` or `API_tests/` folders.
- **Interaction states** — all 8 states audited by Prompt 10 (loading, empty,
  submitting, disabled, success, error, conflict, invalid-transition) are
  covered.
- **Delivery-risk checks** — no raw `console.*` calls outside
  `src/utils/logger.ts`; no hidden debug toggles; passphrase is PBKDF2-derived
  only (never stored in plaintext); roles are disclosed as UI personas in the
  README, `ProfileSelectPage`, and the role chip in `AppLayout`.
- **Docker / README / config** — Vite dev port 5173; `docker-compose.yml` maps
  host 5173 → nginx container 80; `Dockerfile` exposes 80; `nginx.conf` listens
  on 80; `run_tests.sh` uses `node:20-alpine`; `npm run test` / `test:watch` /
  `test:coverage` match README and package.json exactly; no `.env` files; no
  `VITE_*` identifiers in source.
- **Assumptions** — `docs/questions.md` retains the previously logged
  implementation-shaping assumptions (entries #1–#14) in ascending numeric
  order. No new entries were required by the audit.

---

## Audit-iteration-1 remediation log (2026-04-17)

The static audit at `.tmp/audit_report-1.md` returned FAIL with 3 Blockers,
4 Highs, and 3 Mediums. Every finding was closed in source + tests + docs on
2026-04-17 (see `docs/questions.md` entry #15 for the prose summary). The
mapping below shows which finding each newly-added or expanded test covers.

| Finding | Severity | Test(s) added or expanded |
|---|---|---|
| B1 — Missing `actor` prop on CanvasHost / ChatPanel / CommentDrawer; wrong ingestImage shape | Blocker | `pages/WorkspacePage.test.ts` ("passes actor prop to CanvasHost, ChatPanel, CommentDrawer"), `components/CanvasHost.test.ts` ("drop of a valid image calls ingestImage with blob/fileName/mimeType/dimensions shape"), `components/ChatPanel.test.ts` ("sendMessage call includes actor.memberId as authorId"), `components/CommentDrawer.test.ts` ("appendComment includes actor.memberId/displayName") |
| B2 — CanvasHost did not declare `open-comments` emit | Blocker | `components/CanvasHost.test.ts` ("emits open-comments when the Comment action button is clicked while an element is selected"), `pages/WorkspacePage.test.ts` ("opens the comment drawer when CanvasHost emits open-comments") |
| B3 — WorkspaceToolbar had no `open-pairing` emit; stores never called `broadcastCollabMessage` | Blocker | `components/workspace/WorkspaceToolbar.test.ts` ("emits open-pairing when the Pair button is clicked"), `pages/WorkspacePage.test.ts` ("opens the pairing panel when WorkspaceToolbar emits open-pairing"), `services/collab-publisher.test.ts` (every publish* calls `broadcastCollabMessage`), store publish tests below |
| H4 — `broadcast*` adaptors were defined but never invoked | High | `stores/element-store.test.ts` (create/update/delete publishes), `stores/chat-store.test.ts` (sendMessage/pinMessage/unpinMessage publishes), `stores/snapshot-store.test.ts` (captureManual/rollback publishes), `stores/room-store.test.ts` (approveJoin/denyJoin/leave publishes), `stores/import-export-store.test.ts` image roundtrip |
| H5 — Backup export hardcoded `images: []`; persistImport skipped images | High | `stores/import-export-store.test.ts` ("exportRoom populates data.images with base64Data for every image in the room", "persistImport writes every image via imageBlobRepository.put") |
| H6 — Cursor overlay + pointer-to-cursor wiring missing | High | `components/CursorOverlay.test.ts` (5 tests: render per cursor, exclude self, avatar color dot, CSS translate position, empty cursors), plus `pages/WorkspacePage.test.ts` mounting `<CursorOverlay>` via the richer canvas slot stub |
| H7 — Integration tests stubbed children to `<div/>`, hid contract gaps | High | `pages/WorkspacePage.test.ts` full rewrite (richer stubs that expose props + emits), `components/CanvasHost.test.ts` root-selector rewrite (removed the `if (overlay.exists())` short-circuit), `components/ChatPanel.test.ts` / `CommentDrawer.test.ts` now pass real `actor` prop |
| M1 — Route guard set too narrow | Medium | `router/guards.test.ts` ("room-create / room-join / workspace-settings / workspace-backup require active session" — 4 has-tests + 4 redirect tests) |
| M2 — No copy-link UI on RoomListPage | Medium | `pages/RoomListPage.test.ts` ("clicking Copy Link writes the /rooms/join?code=… URL to clipboard", "Copy Link click does not trigger card navigation") |
| M3 — Stale "final static readiness audit passed" claim | Medium | No new test — documentation-only correction (`docs/design.md` §14, `repo/README.md` Current Status) |

### Fix-check follow-up (`.tmp/audit_report_1-fix_check.md`, 2026-04-17)

The fix-check audit flagged B3, H4, and H7 as Partially Fixed. Each residual is now closed by the additional tests below (see `docs/questions.md` entry #16).

| Residual | Test(s) added |
|---|---|
| B3 residual — outbound `presence-op` publication missing | `services/collab-publisher.test.ts` ("publishPresence sends a WebRTC presence-op carrying the cursor and member identity (no BroadcastChannel fan-out)"), plus the new `pages/WorkspacePage.integration.test.ts` ("updates the presence store and publishes presence when the real CanvasHost emits cursor-move") |
| H4 residual — `publishConflict` never invoked | `stores/element-store.test.ts` ("publishes element-overwrite conflict when updateElement targets an element that already disappeared", "does not publish conflict when update succeeds"), `stores/chat-store.test.ts` ("publishes pin-collision conflict when pin cap is exceeded", "publishes pin-collision conflict when message is already pinned (duplicate)", "does not publish conflict when pinMessage succeeds") |
| H7 residual — WorkspacePage test still stubs major children | New `pages/WorkspacePage.integration.test.ts` mounts real `CanvasHost` + `ChatPanel` + `CommentDrawer` and asserts actor-prop threading, `open-comments` propagation, and `cursor-move` side effects |
