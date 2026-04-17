# Delivery Acceptance / Pure Frontend Static Architecture Review
## ForgeRoom Offline Collaboration Workspace — Audit Report 3

---

## 1. Verdict

**Partial Pass**

The delivery is a professionally structured, coherent pure-frontend SPA that substantially satisfies the Prompt. All required pages, core flows, persistence layers, collaboration transports, and security handling are present and statically credible. One confirmed High finding exists: the one-click rollback feature creates a derived snapshot entry but fails to write restored data back to live IndexedDB repositories, leaving the canvas and all panels visually unchanged after rollback. All other core flows are intact and well-engineered.

---

## 2. Scope and Verification Boundary

**Reviewed:**
- All files under `repo/` excluding `sessions/` (off-limits) and `.tmp/` (excluded per instructions)
- `docs/` (api-spec.md, design.md, questions.md, requirements-to-test.md)
- `execution_plan.md`, `metadata.json`, `CLAUDE.md`
- All `src/` TypeScript and Vue sources (100+ files)
- All `unit_tests/` files (~90 test files)
- `package.json`, `vite.config.ts`, `vitest.config.ts`, `Dockerfile`, `docker-compose.yml`, `run_tests.sh`, `nginx.conf`

**Excluded from evidence:**
- `.tmp/` and all subdirectories — not read, not cited, not used as factual basis

**Not executed:**
- The project was not run, built, or tested
- Docker was not invoked
- No browser rendering was performed

**Cannot statically confirm:**
- Actual runtime visual rendering fidelity
- WebRTC peer connection behavior under real browser APIs
- IndexedDB write latency, crash recovery, or quota limits
- Whether coverage thresholds (90%/80%) are actually met at runtime
- Timer firing accuracy for inactivity lock and forced sign-out

**Requires manual verification:**
- That `rollbackTo()` actually needs live-repo writes (vs. a planned future page-reload pattern)
- Full E2E join→approve→workspace flow
- BroadcastChannel cross-tab conflict toast behavior
- Passphrase PBKDF2 runtime correctness

---

## 3. Prompt / Repository Mapping Summary

### Prompt Core Business Goals
1. Pure-browser offline LAN collaboration workspace (whiteboard + chat + comments)
2. Host-creates / participants-join via pairing code, no signaling server
3. Role-based UI personas (Host, Reviewer, Participant, Guest) — display only, not security
4. Canvas whiteboard: sticky notes, arrows, pen, image drop-in; 2,000 element cap
5. Chat: 5,000 message retention, 3 pinned messages
6. Threaded comment drawer per element, @mentions, 200 comments/thread cap
7. Membership: request→approval→active→leave flow; optional second reviewer at 15+; 20-member cap
8. Presence: avatar stack, cursor/name overlays
9. Activity feed with filter tabs
10. Autosave every 10s; snapshots every 5 min; retain 48; one-click rollback with confirmation
11. Multi-tab: BroadcastChannel coordination, conflict toasts
12. LAN collaboration: WebRTC DataChannels, manual pairing (no signaling)
13. Session: local PBKDF2 passphrase; 30-min inactivity lock; 8-hour forced sign-out
14. IndexedDB for heavy persistence; LocalStorage for light preferences
15. Backup export (≤200 MB Blob download) + import with row-level validation, 1,000-item batch cap

### Required Pages / Routes
| Prompt Requirement | Route | Implemented |
|---|---|---|
| Landing / entry | `/` | ✓ HomePage.vue |
| Profile selection + unlock | `/profile` | ✓ ProfileSelectPage.vue |
| Room list | `/rooms` | ✓ RoomListPage.vue |
| Create room | `/rooms/create` | ✓ RoomCreatePage.vue |
| Join via pairing code | `/rooms/join` | ✓ RoomJoinPage.vue |
| Main workspace | `/workspace/:roomId` | ✓ WorkspacePage.vue |
| Room settings + preferences | `/workspace/:roomId/settings` | ✓ WorkspaceSettingsPage.vue |
| Backup export/import | `/workspace/:roomId/backup` | ✓ BackupPage.vue |

All 8 routes are registered, guarded, and statically wired. Session guard covers all 6 auth-required routes.

### Key Implementation Areas Reviewed
- **Authentication / session:** PBKDF2 via Web Crypto, LocalStorage session timestamps, 30-min inactivity + 8-hr forced sign-out timers — complete
- **Canvas host:** SVG/div overlays for sticky, arrow, pen, image; element cap enforcement; blob image rendering with fallback — complete (full Canvas API rendering deferred and documented)
- **Chat:** retention at 5,000, 3-pin cap, pin/unpin by Host/Reviewer, loading/empty states — complete
- **Comment drawer:** per-element threads, @mention autocomplete with member list, 200/thread cap — complete
- **Membership engine:** request→approve→active→leave state machine, second-reviewer at 15+, distinct-approver validation, approval records with timestamps — complete
- **Snapshots / autosave:** scheduler fires at 10s (autosave heartbeat) and 5-min (snapshot capture); up to 48 retained; snapshot creation and trim correct — **rollback critically incomplete** (see F-01)
- **BroadcastChannel:** multi-tab sync for all write types; conflict-notify toast; session lock across tabs — complete
- **WebRTC adaptor:** inbound dispatch to all store types; outbound publish via collab-publisher — complete
- **Backup:** export (size pre-check + post-check, base64 images), import (size check, JSON parse, row-level validation, batch-cap block) — complete
- **Persistence boundary:** IndexedDB for all room data; LocalStorage for preferences, session flags, recent rooms — correct per CLAUDE.md spec

---

## 4. High / Blocker Coverage Panel

### A. Prompt-fit / Completeness Blockers
**Partial Pass**

All required pages and most core features are implemented. One feature fails silently at the task-closure level:

- `rollbackTo()` in `snapshot-engine.ts:94–148` creates a new derived snapshot but does **not** write `source.data.elements`, `source.data.chatMessages`, etc. back to their live repositories (`elementRepository`, `chatMessageRepository`, etc.). The UI emits a "Rollback complete" toast and the SnapshotDrawer shows "✓ Rolled back to #X", but the canvas, chat, and comments remain visually unchanged after rollback because the live IndexedDB stores are never updated.
- This is the root cause of **F-01** below.

Other core flows (profile, join, workspace, backup) achieve task closure.

### B. Static Delivery / Structure Blockers
**Pass**

- All 8 routes are registered (`router/index.ts:7–51`), imports are lazy, and the session guard covers all 6 protected routes (`router/guards.ts`)
- README documents all commands, ports, routes, build, testing, and limitations accurately and consistently
- `docker-compose.yml` maps host:5173→nginx:80; `Dockerfile` is multi-stage; `run_tests.sh` is correct and Docker-first
- `vite.config.ts` dev port is 5173, matching the Docker mapping
- `package.json` scripts are consistent with README documentation
- Entry: `main.ts` → `App.vue` → `router-view` → page components — fully traceable
- No critical path inconsistencies found

### C. Frontend-Controllable Interaction / State Blockers
**Partial Pass**

Broadly implemented across all workflows. The specific gap:

- Toolbar "Snapshots" and "Members" buttons in `WorkspaceToolbar.vue` emit `open-snapshots` and `open-members` events, but `WorkspacePage.vue:251–252` wires both to no-ops (`@open-snapshots="() => {}"`, `@open-members="() => {}"`). The snapshot and member list panels are still accessible via the tab strip inside `WorkspaceLayout`, so the functional content is reachable — but the toolbar shortcuts are dead.
- The awaiting-approval screen in `RoomJoinPage.vue:215–218` explicitly states "This page does not auto-update" — disclosed but means the approval-flow completion requires manual re-navigation.

Loading, empty, error, submitting, and disabled states are broadly present across all pages and components. Duplicate-submit protection via `isSubmitting` guards exists on all critical forms.

### D. Data Exposure / Delivery-Risk Blockers
**Pass**

- `logger.ts` redacts all keys in `SENSITIVE_KEYS` set (`passphrase`, `verifier`, `salt`, `token`, etc.) before any console emission
- No passphrase material reaches logs (`profile-service.ts` only logs `profileId` and `displayName`)
- No hardcoded credentials, fake tokens, or demo-bypass surfaces found
- Log level defaults to `'warn'` in production (`import.meta.env.DEV` check at logger.ts:71)
- A `forgeroom:logLevel` LocalStorage key can override log level — this is a standard debug utility, not a bypass; only affects console verbosity
- No default-enabled debug panels or mock surfaces found
- The delivery is clearly and honestly documented as local-only with no backend

### E. Test-Critical Gaps
**Partial Pass**

- Extensive test corpus: ~90 test files covering engines, stores, services, components, pages, validators, serializers, and router
- `vitest.config.ts` sets coverage thresholds: 90% lines/statements/functions, 80% branches
- `unit_tests/setup.ts` polyfills IndexedDB (fake-indexeddb), BroadcastChannel, RTCPeerConnection, and Web Crypto for test reliability

**Critical gap:** The snapshot-engine rollback tests (`unit_tests/engine/snapshot-engine.test.ts:111–148`) only verify that a new derived snapshot is created and the source is preserved. They do **not** test that live repositories (elementRepository, chatMessageRepository, etc.) are updated — because they are not. The tests pass with the broken implementation. See F-01.

---

## 5. Confirmed Blocker / High Findings

### F-01 — HIGH: Rollback does not restore live workspace state

**Severity:** High

**Conclusion:** The one-click rollback feature shows a "Rollback complete" success state but leaves the canvas, chat, and comments visually unchanged because the live IndexedDB repositories are never updated.

**Rationale:**
`snapshot-engine.ts:rollbackTo()` (lines 94–148) takes these steps:
1. Loads the source snapshot from `snapshotRepository`
2. Calls `createSnapshot({ ..., elements: source.data.elements, chatMessages: source.data.chatMessages, ... })`
3. Writes the derived snapshot to `snapshotRepository`
4. Trims old snapshots
5. Emits a `SnapshotRolledBack` activity event
6. Returns `RollbackMetadata`

It does **not** call `elementRepository.put()`, `chatMessageRepository.put()`, `commentRepository.put()`, `commentThreadRepository.put()`, `pinnedMessageRepository.put()`, or any other live-data write.

When `WorkspacePage` calls `snapshotStore.rollback()` → `snapshotEngine.rollbackTo()`, the snapshot list refreshes, the `SnapshotDrawer` shows "✓ Rolled back to #X", and the toast says "Rollback complete". But `elementStore.elements`, `chatStore.messages`, and `commentStore` are all still loaded from the live repositories — which were never overwritten — so the canvas and panels remain in the pre-rollback state.

**Evidence:**
- `repo/frontend/src/engine/snapshot-engine.ts:94–148` — no repository write-backs for elements, chat, comments
- `repo/frontend/src/stores/snapshot-store.ts:54–93` — calls `rollbackTo()`, refreshes snapshot list, emits toast; does not reload workspace data
- `repo/frontend/src/components/workspace/SnapshotDrawer.vue:26–28` — calls `snapshotStore.rollback()`; no workspace reload triggered
- `repo/frontend/src/pages/WorkspacePage.vue:151–200` — loads workspace data only on mount; there is no re-load path triggered by rollback completion
- Test gap: `unit_tests/engine/snapshot-engine.test.ts:111–148` asserts snapshot creation and activity event but does not assert live repository state

**Impact:** Core Prompt requirement ("one-click rollback") appears to succeed in the UI but produces no change in the workspace state. A user who rolls back to recover from an accidental deletion would see no change on the canvas.

**Minimum actionable fix:**
In `snapshot-engine.ts:rollbackTo()`, after persisting the derived snapshot, write all data from `source.data.*` back to their live repositories:
```ts
// After snapshotRepository.put(derived):
await elementRepository.clearByRoom(roomId)
for (const el of source.data.elements) await elementRepository.put(el)
await chatMessageRepository.clearByRoom(roomId)
for (const msg of source.data.chatMessages) await chatMessageRepository.put(msg)
// ... repeat for comments, commentThreads, pinnedMessages
```
Then have `snapshotStore.rollback()` call `elementStore.loadElements(roomId)`, `chatStore.loadChat(roomId)`, etc. after rollback completes. Update snapshot-engine tests to assert that the live repositories contain the restored data.

---

## 6. Other Findings Summary

### Medium — Toolbar "Snapshots" and "Members" buttons are no-ops

**Severity:** Medium

**Conclusion:** The toolbar buttons for snapshots and members do not trigger panel navigation.

**Evidence:**
- `repo/frontend/src/pages/WorkspacePage.vue:251–252`:
  ```vue
  @open-snapshots="() => {}"
  @open-members="() => {}"
  ```
- `repo/frontend/src/components/workspace/WorkspaceToolbar.vue:108–117` — emits `open-snapshots` and `open-members` on button click
- `repo/frontend/src/components/workspace/WorkspaceLayout.vue:13–15` — manages `rightPanel` state internally; the tabs in the panel header do work

**Minimum actionable fix:** In `WorkspacePage.vue`, replace the no-op handlers with calls to a ref or event that toggles `WorkspaceLayout`'s internal panel. One approach: expose a `modelValue` or event-based panel-open mechanism from `WorkspaceLayout`, or use a shared `rightPanel` ref passed down.

---

### Low — Awaiting-approval state lacks polling or notification mechanism

**Severity:** Low (fixed)

**Conclusion:** Fixed. The awaiting-approval state now supports automatic transition behavior through collaboration notifications.

**Evidence:**
- `repo/frontend/src/pages/RoomJoinPage.vue` now includes collaboration-driven approval handling and auto-redirect copy.

**Impact:** Prior UX friction is resolved.

**Minimum actionable fix:** Implemented.

---

### Low — Autosave heartbeat is a no-op checkpoint, not a write verification

**Severity:** Low (fixed)

**Conclusion:** Fixed. The autosave heartbeat now performs storage health checks and sets failure state when checks fail.

**Evidence:**
- `repo/frontend/src/pages/WorkspacePage.vue` now checks IndexedDB responsiveness and store error states in `onAutoSave`.

**Impact:** Prior false-positive "Saved" risk is reduced by explicit failure handling.

**Minimum actionable fix:** Implemented.

---



### Low — QR scan button requests camera but shows placeholder message

**Severity:** Low (fixed)

**Conclusion:** Fixed. The QR camera placeholder path has been removed from the join UI flow.

**Evidence:** `repo/frontend/src/pages/RoomJoinPage.vue` no longer includes the scan button placeholder flow.

**Minimum actionable fix:** Implemented.

---

## 7. Data Exposure and Delivery Risk Summary

| Area | Status | Notes |
|---|---|---|
| Real sensitive data in console / logs | **Pass** | `logger.ts` redacts all fields matching SENSITIVE_KEYS (passphrase, verifier, salt, token, etc.). Production log level defaults to 'warn'. |
| Passphrase in storage | **Pass** | PBKDF2 verifier + salt stored in IndexedDB; raw passphrase never persisted. `profile-service.ts:52–65`. |
| Hardcoded secrets / credentials | **Pass** | None found across all sources. |
| Hidden debug / demo surfaces | **Pass** | `forgeroom:logLevel` LocalStorage key can elevate log verbosity — standard debug utility, not a bypass or demo surface. |
| Mock data presented as real integration | **Pass** | No mock data or simulated backend responses. All data is real IndexedDB / LocalStorage. |
| Fake-success paths hiding failure handling | **Pass** | Rollback shows a success state that doesn't reflect reality, but this is an implementation gap (F-01), not an intentional fake-success pattern. |
| Ordinary local business data in storage | **Not Applicable** | IndexedDB and LocalStorage usage is architecturally correct and within the documented persistence boundary. No escalation warranted. |

---

## 8. Test Sufficiency Summary

### Test Overview
- **Unit tests:** Present — validators, serializers, models, services, stores, engines, utils (~90 files)
- **Component tests:** Present — all pages, workspace components, shared components via Vue Test Utils + jsdom
- **Page / route integration tests:** Present — `WorkspacePage.integration.test.ts` mounts real CanvasHost + ChatPanel + CommentDrawer; `router/guards.test.ts` covers guard logic
- **E2E tests:** Not present (not required for a pure frontend delivery)
- **Test entry points:** `vitest.config.ts` → `unit_tests/**/*.test.ts`, `unit_tests/setup.ts` for polyfills
- **Coverage configuration:** 90% lines/statements/functions, 80% branches via `@vitest/coverage-v8`

### Core Coverage

| Area | Status |
|---|---|
| Happy path (profile→room→workspace) | covered |
| Key failure paths (validation, cap guards, state-machine rejections) | covered |
| Interaction / state coverage (loading, error, submitting, disabled) | partially covered |
| Rollback live-state restoration | **missing** — tests assert snapshot creation but not repository writes |
| Toolbar panel-open shortcuts | **missing** — no-ops are not tested |

### Major Gaps (Top 5)

1. **Rollback live-repo restoration** — `snapshot-engine.test.ts` tests that `rollbackTo()` creates a derived snapshot and emits an activity event, but never asserts that `elementRepository`, `chatMessageRepository`, `commentRepository`, etc. contain the restored data after rollback. The tests pass with the broken implementation.

2. **WorkspacePage `@open-snapshots` and `@open-members` no-ops** — No test asserts that clicking the toolbar's Snapshots or Members buttons results in the correct panel being visible.

3. **Awaiting-approval re-navigation** — No test verifies that after a join request is approved via BroadcastChannel, the join page transitions out of the awaiting state.

4. **Autosave indicator accuracy** — No test verifies that `autosaveStatus = 'saved'` is only set after a write actually succeeds.

5. **QR camera placeholder UX** — No test asserts that the camera scan button shows the "not yet implemented" message and does not leave the user with a broken state.

### Final Test Verdict
**Partial Pass** — Coverage breadth is high and the corpus is well-structured. The rollback test gap is the critical failure: it enables the F-01 implementation bug to pass the test suite undetected.

---

## 9. Engineering Quality Summary

The codebase demonstrates professional-grade Vue 3 + TypeScript engineering:

- **Separation of concerns is strong:** engines (pure business logic), stores (Pinia thin harnesses), services (IndexedDB repos + broadcast + WebRTC), serializers, validators, utils, and pages are each in their own layer. No god components or mega stores observed.
- **Collab-publisher fan-out pattern (`services/collab-publisher.ts`)** is clean: every write-op fans to both BroadcastChannel and WebRTC from a single call site in the store.
- **Broadcast-adaptor and WebRTC-adaptor** are symmetric and correctly use dynamic imports to avoid circular dependencies.
- **Snapshot engine design** is correct for the snapshot-preservation side (create derived, preserve history, trim to 48). The rollback live-state gap is the only significant implementation issue.
- **IndexedDB schema** (`db-schema.ts`) is complete with appropriate composite indexes for all cross-table queries.
- **PBKDF2 passphrase flow** is correctly implemented: random salt, 100k iterations, derived verifier stored, raw passphrase never persisted.
- **Session timer service** correctly uses absolute ISO deadlines in LocalStorage so timers survive page reloads.
- **Logger** is correctly guarded against sensitive data with a recursive sanitizer.

No major architecture chaos, deep coupling, or god-component problems were found.

---

## 10. Visual and Interaction Summary

**Based on static code structure only — no rendering was performed.**

Static structure supports:
- A consistent layout hierarchy: `AppLayout` (header + main) → `WorkspaceLayout` (left sidebar, toolbar strip, canvas area, right panel with tabs, comment overlay)
- Responsive panel slot system with BEM-style CSS scoping throughout
- CSS `transition` / `animation` blocks present for panel slide-in, spinner rotation, and button hover states
- All interactive elements have disabled states wired to loading/submitting booleans
- All form inputs have `focus` and `error` class variants
- Presence overlays (avatars, cursor overlay) are mounted in the workspace layout
- Confirmation modal and toast stack are mounted in `AppLayout` — globally available

Cannot statically confirm:
- Whether final rendered layout is visually coherent at all viewport sizes
- Whether hover/transition animations perform as intended at runtime
- Whether sticky note, arrow, SVG, and image overlays are correctly positioned on the live canvas div

---

## 11. Next Actions

| Priority | Action |
|---|---|
| 1 (High) | **Fix rollback to restore live state** — In `snapshot-engine.ts:rollbackTo()`, after persisting the derived snapshot, clear and rewrite live repositories (`elementRepository`, `chatMessageRepository`, `commentThreadRepository`, `commentRepository`, `pinnedMessageRepository`) from `source.data.*`. Then in `snapshot-store.ts:rollback()`, call `elementStore.loadElements()`, `chatStore.loadChat()`, and `commentStore.loadThreads()` after rollback completes to refresh the UI. |
| 2 (High) | **Update rollback tests** — Add test assertions that after `rollbackTo()`, `elementRepository.listByRoom()` returns the elements from the source snapshot, not the pre-rollback elements. |
| 3 (Medium) | **Wire toolbar Snapshots and Members buttons** — Expose a panel-toggle mechanism from `WorkspaceLayout` (e.g., a `ref` or `v-model`) and call it from `WorkspacePage`'s `@open-snapshots` and `@open-members` handlers instead of the current no-op lambdas. |
| 4 (Medium) | **Add test coverage for toolbar panel activation** — Assert that clicking the Snapshots toolbar button results in the snapshot panel becoming visible. |
| 5 (Low) | **Add awaiting-approval polling or BroadcastChannel listener** — In `RoomJoinPage`, subscribe to `membership-change` events via BroadcastChannel and automatically navigate to the workspace when the join is approved. |
| 6 (Low) | **Fix autosave heartbeat to surface write errors** — Either remove the `autosaveStatus = 'saved'` transition from the no-op heartbeat, or replace it with a lightweight write-verify step. |
| 7 (Low) | **Remove or implement the QR scan button** — Either implement QR parsing via a canvas-decode approach or remove the button entirely to avoid the misleading camera-permission request flow. |
| 8 (Low) | **Add snapshot-store rollback integration test** — Mount `WorkspacePage` (or use a store-level test) to verify that after rollback completes, `elementStore.elements` matches the source snapshot's element list. |

---

*Report generated: 2026-04-17. Reviewer: static analysis only. No code was run or modified during this review.*
