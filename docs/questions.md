# questions.md

## 1. Local passphrase storage and unlock verification

**The Gap**  
The prompt requires local-only profile selection with a passphrase, but it does not specify how the passphrase should be represented or verified in a browser-only app without storing it in plaintext.

**The Interpretation**  
The app needs a browser-native, frontend-only unlock model that is honest about its limits while still avoiding plaintext storage.

**Resolved in Prompt 3**  
Implemented using PBKDF2-HMAC-SHA-256 (100,000 iterations, 16-byte random salt) via the Web Crypto API. Only the salt and derived verifier are stored in IndexedDB (`passphraseVerifiers` store). The raw passphrase is never persisted. This is documented as local device protection only, not a server-grade security boundary. Passphrase recovery is not possible — users must create a new profile if the passphrase is forgotten.

---

## 2. Manual pairing payload format for WebRTC without signaling servers

**The Gap**  
The prompt requires room-link joining plus on-screen pairing code and manual copy/paste or optional camera-scanned pairing text, but it does not define the payload format or exchange sequence.

**The Interpretation**  
The app needs a deterministic, browser-only signaling substitute that can be exchanged manually between peers and can optionally be rendered as QR-compatible text.

**Proposed Implementation**  
Use a structured pairing envelope that includes room identifier, peer identifier, protocol version, timestamp, short verification code, and compressed SDP/ICE negotiation payloads. Support a two-step manual offer/answer exchange with checksum validation and optional QR rendering/scanning of the same text payload.

---

## 3. Reviewer approval threshold semantics at 15+ people

**The Gap**  
The prompt says the Host can optionally add a second Reviewer approval when the room is at 15+ people, but it does not define exactly which population counts toward that threshold.

**The Interpretation**  
The threshold should be based on currently admitted room population, not historical users who already left.

**Proposed Implementation**  
Count current non-left members in the room, including the Host and any active Reviewers, Guests, and Participants. When that count is 15 or more and approval is enabled with second-reviewer mode active, require two distinct approval actors before a join request becomes active.

---

## 4. People list scope for @mentions

**The Gap**  
The prompt requires @mentions to resolve against the room’s local people list, but it does not define whether that list includes only active members or also known-but-left users.

**The Interpretation**  
Mention suggestions should stay useful for current collaboration while avoiding stale clutter.

**Proposed Implementation**  
Resolve mentions against the room’s locally known membership directory, but rank active members first and visually mark non-active identities. Keep left users searchable only if they still appear in retained activity/comment history for contextual integrity.

**Confirmed in Prompt 4**  
`comment-engine.resolveMentions(query, members, historicalIds?)` always considers active members, only includes `Left` or `Rejected` members when their `memberId` is present in the caller-provided `historicalIds` set, sorts active-first then alphabetical, and returns an `isActive` flag plus the membership `state` so the UI can mark non-active candidates.

---

## 5. Rollback semantics and history preservation

**The Gap**  
The prompt requires one-click rollback with confirmation, but it does not specify whether rollback destroys later history or creates a new state derived from an older snapshot.

**The Interpretation**  
Rollback should remain auditable and should not silently erase the timeline.

**Proposed Implementation**  
Apply rollback as a new committed room state generated from a chosen snapshot. Preserve prior snapshots and activity history, and emit a rollback event that records the source snapshot, actor, timestamp, and resulting state revision.

**Confirmed in Prompt 4**  
`snapshot-engine.rollbackTo(roomId, sourceSnapshotId, actor)` persists a new derived `Snapshot` with the next monotonic `sequenceNumber`, never deletes the source or intermediate snapshots, runs the `MAX_SNAPSHOTS_RETAINED` (48) trim after insertion, and emits a `SnapshotRolledBack` activity event whose metadata carries `sourceSnapshotId`, `sourceSequenceNumber`, `resultingSnapshotId`, `rolledBackAt`, and `rollbackId`.

---

## 6. Bulk-import cap semantics for sticky notes and comments

**The Gap**  
The prompt specifies a bulk-import cap of 1,000 sticky notes/comments per batch, but it does not clarify whether that cap is per type or combined.

**The Interpretation**  
A combined cap is safer and easier to explain in the UI.

**Proposed Implementation**  
Treat the cap as a combined maximum of 1,000 imported sticky-note and comment records per batch file. Validation emits row-level `bulkImportCount` errors and sets `truncated=true`; persistence is blocked when the combined count exceeds the cap.

---

## 7. Resumable uploads in a frontend-only app

**The Gap**  
The prompt mentions resumable uploads of attachments even though the application has no backend and runs fully in the browser.

**The Interpretation**  
“Upload” here should be implemented as resumable local import/persistence of large blobs and peer-share preparation rather than remote server upload.

**Proposed Implementation**  
Model resumable uploads as chunked local file ingestion into IndexedDB with resumable progress metadata. Reuse that mechanism for large image/blob import and for preparing peer-transfer payloads over WebRTC where appropriate. Document this clearly so the app does not imply server-backed upload infrastructure.

---

## 8. Conflict resolution for duplicate check-in style actions in a whiteboard app

**The Gap**  
The prompt requires conflict prompts when the same attendee is checked in twice from different devices, but this collaboration product has no attendee check-in domain. The analogous requirement here is silent overwrite prevention across tabs/devices.

**The Interpretation**  
The product still needs explicit conflict handling, but the conflict domain is concurrent room edits and membership actions rather than check-in records.

**Proposed Implementation**  
Translate the conflict requirement into duplicate or conflicting room operations: concurrent edits to the same element, simultaneous membership-state changes, repeated pin/unpin actions, and overlapping rollback/import actions. Surface these through BroadcastChannel and WebRTC reconciliation prompts instead of backend conflict codes.

---

## 9. Camera-scanned pairing as optional capability

**The Gap**  
The prompt says camera-scanned pairing is optional, but it does not define the fallback behavior when camera permissions or device hardware are unavailable.

**The Interpretation**  
Manual text exchange must remain the primary guaranteed path, with camera scanning as an enhancement only.

**Proposed Implementation**  
Design the pairing flow so copy/paste text entry is always complete on its own. Add QR generation/scanning only as an optional convenience layer with clear capability detection and fallback messaging when camera access is unavailable or denied.

---

## 10. Backup-file size enforcement timing

**The Gap**  
The prompt caps backup export files at 200 MB, but it does not state whether that cap should be enforced before generation, after generation, or both.

**The Interpretation**  
The app should prevent wasted work where possible and still guard the final artifact size.

**Proposed Implementation**  
Estimate payload size before export, block clearly oversized exports early, and perform a final post-serialization size check before Blob download. Apply the same size validation on import before deeper parsing begins.

---

## 11. SVG/div element overlays vs Canvas API (Prompt 6 decision)

**The Gap**  
Full Canvas API rendering (viewport transforms, zoom/pan, pressure-sensitive pen paths) was listed as a goal for the workspace, but implementing it in Prompt 6 alongside layout, adaptors, and all workflows would create an unreasonably large scope.

**Resolution**  
For Prompt 6, `CanvasHost` implements tool interactions using absolutely-positioned `<div>` and `<svg>` overlays for element rendering. A `<canvas>` element is mounted as a placeholder. Full Canvas API rendering (path smoothing, pressure curves, viewport transforms, zoom/pan, hit-testing) is explicitly deferred to a later prompt. This approach makes the workspace statically credible for all workflows while keeping Prompt 6 to a manageable scope.

---

## 12. QR code generation without external dependencies

**The Gap**  
The plan referenced optional QR code generation for sharing pairing codes, but adding an external `qrcode` library was not explicitly approved.

**Resolution**  
QR code generation and camera-based QR scanning are not implemented. The `PairingPanel` and `RoomJoinPage` components use text copy/paste as the guaranteed and only pairing path. No camera permission is requested, no scan button is rendered, and no external QR library is added. Text entry and display are the sole exchange mechanism.

**Updated (2026-04-17 — audit iteration 1 remediation)**  
The prior implementation included a camera scan button in `RoomJoinPage` that requested camera permission and displayed a placeholder message. This was removed entirely: the button, the `requestCameraPermission` function, the `cameraAvailable` ref, and the `onMounted` camera detection block are all absent from the current source. A regression test (`unit_tests/pages/RoomJoinPage.test.ts`) asserts the scan button is not rendered.

---

## 13. commentRepository.listByRoom (RESOLVED — Prompt 7)

**The Gap (Prompt 6)**  
`import-export-store.ts` needed to collect all comments for a room during backup export, but `commentRepository` only exposed `listByThread`.

**Resolution (Prompt 7)**  
`listByRoom(roomId)` was added to `CommentRepository` using the existing `by-roomId` IndexedDB index. The `import-export-store` now calls it directly without any conditional fallback. Backup exports now include all comments for a room.

**Confirmed in Prompt 10**  
Static audit re-verified that `listByRoom` is called by `import-export-store.ts` and is covered by `unit_tests/services/comment-repository.test.ts`.

---

## 14. No custom environment variables required (Prompt 9)

**The Assumption**  
ForgeRoom is a pure frontend SPA with no API keys, no remote endpoints, and no server-specific configuration. No `.env` file is needed or expected at build time or runtime.

**Vite built-ins used internally**  
`import.meta.env.DEV` / `import.meta.env.PROD` are used in `utils/logger.ts` to suppress debug output in production builds. These are injected automatically by Vite during `npm run build` and require no user configuration.

**Implication**  
If a future prompt adds a Vite-side env var (e.g., `VITE_FEATURE_FLAG`), it must be documented in `docs/api-spec.md` and in `repo/README.md` under "Environment Variables", and must not be secret (Vite inlines all `VITE_*` vars into the JS bundle).

**Confirmed in Prompt 10**  
Static audit re-verified: no `.env` files exist in `repo/frontend/`; no `VITE_*` identifiers appear in source; `logger.ts` is the only consumer of `import.meta.env`; README documents the zero-env-var posture clearly.


---

## 15. Audit iteration 1 remediation (2026-04-17)

**The Gap**  
Static audit iteration 1 (`.tmp/audit_report-1.md`) flagged ten integration-drift defects — real wiring gaps rather than static-code-level ambiguities. The audit returned FAIL with 3 Blockers (B1/B2/B3), 4 Highs (H4–H7), and 3 Mediums (M1–M3).

**The Resolution**  
All ten findings were closed on 2026-04-17 in source, tests, and docs, with `.tmp/audit_report-1.md` preserved byte-identically as the historical record:

- **B1** `WorkspacePage.vue` now computes an `ActivityActor` and forwards it to `CanvasHost`, `ChatPanel`, `CommentDrawer`; `CanvasHost.onDrop` now passes `{ blob, fileName, mimeType, dimensions }` matching `imageEngine.IngestImageInput`.
- **B2** `CanvasHost` declares `open-comments`; the in-canvas Comment button emits it and `WorkspacePage` opens the drawer in response.
- **B3** `WorkspaceToolbar` declares `open-pairing` with a visible Pair button; five stores now fan writes through the new `services/collab-publisher.ts`, which calls the matching `broadcast*` helper *and* `broadcastCollabMessage` (WebRTC) with a monotonic `seqNum`.
- **H4** Every BroadcastChannel topic now has an active outbound publication site in stores.
- **H5** Backup export now populates `data.images[]` with base64 blobs; `persistImport` restores them via `imageBlobRepository.put`.
- **H6** New `components/workspace/CursorOverlay.vue` is mounted over the canvas; `CanvasHost` emits `cursor-move` (rAF-throttled); `WorkspacePage` wires it to `presenceStore.updateCursor`.
- **H7** Integration tests now assert real prop/event contracts instead of stubbing children as `<div />`.
- **M1** `AUTH_REQUIRED_ROUTES` now contains all six guarded routes (parity with `design.md` §3).
- **M2** `RoomListPage` now exposes a Copy Link button that writes `/rooms/join?code=...` to clipboard.
- **M3** `README.md` + `design.md` §14 now reflect the post-remediation state without claiming a final-audit pass.

**Why this entry exists**  
This log entry is append-only (no renumbering of entries 1–14) so the remediation is discoverable by future audits without requiring archaeology through the git history. Numbered items 1–14 above are untouched.


---

## 16. Audit iteration 1 fix-check residuals — closure (2026-04-17)

**The Gap**  
The fix-check report at `.tmp/audit_report_1-fix_check.md` confirmed B1, B2, H5, H6, and both Mediums as Fully Fixed, but flagged three residual gaps:

- **B3 residual** — outbound `presence-op` over WebRTC was still missing; local cursor updates never reached LAN peers.
- **H4 residual** — `publishConflict` was defined but had zero call sites in real collision-detection paths.
- **H7 residual** — `WorkspacePage.test.ts` continued to stub `CanvasHost`, `ChatPanel`, and `CommentDrawer`, so the full real-component integration contract was never exercised.

**The Resolution**  
All three residuals were closed the same day, in source + tests + docs:

- **B3 residual →** `services/collab-publisher.ts` now exports `publishPresence(roomId, memberId, cursor, displayName, avatarColor, senderId?)`. `WorkspacePage.onCursorMove` calls it immediately after `presenceStore.updateCursor`, so every local pointer move reaches LAN peers as a `presence-op` CollabMessage. Unit-tested in `unit_tests/services/collab-publisher.test.ts`. No BroadcastChannel counterpart is emitted — cross-tab fan-out of the same user's cursor would be a phantom-duplicate bug.
- **H4 residual →** `publishConflict` is now wired into two real detection paths. `element-store.updateElement` emits `element-overwrite` when the engine reports the element is gone or stale; `chat-store.pinMessage` emits `pin-collision` when the 3-pin cap or duplicate-pin rejection fires. Both sites source `tabId` from the newly exported `getLocalTabId()` in `services/broadcast-channel-service.ts`. Unit-tested in `unit_tests/stores/element-store.test.ts` and `unit_tests/stores/chat-store.test.ts`.
- **H7 residual →** `unit_tests/pages/WorkspacePage.integration.test.ts` is a new test file that mounts **real** `CanvasHost`, `ChatPanel`, and `CommentDrawer` inside `WorkspacePage` (only layout/toolbar/sidebar chrome remains stubbed). It asserts: (a) all three real components are present in the tree, (b) the computed `actor` is threaded into each child's props with the right `memberId` / `displayName`, (c) the real `CanvasHost` emitting `open-comments` updates `CommentDrawer.elementId`, and (d) the real `cursor-move` emit triggers both `presenceStore.updateCursor` and `publishPresence`.

**Why this entry exists**  
This is an append-only log of the post-fix-check remediation so future auditors can confirm, from `questions.md` alone, that every partial-fix residual was subsequently closed. Entries 1–15 above are untouched.
