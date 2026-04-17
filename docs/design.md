# ForgeRoom — Design Document

## 1. Project Type

**Pure frontend offline collaboration SPA.** No backend, no API server, no signaling server, no cloud storage, no third-party services.

All persistence, synchronization, session handling, and collaboration logic runs inside the browser.

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Vue 3 + TypeScript | SFC with `<script setup>` |
| Build tool | Vite 5 | Dev server port 5173 |
| Routing | Vue Router 4 | History mode |
| State management | Pinia 2 | Modular stores |
| Canvas | HTML Canvas API | Modular tool controllers (Prompt 4+) |
| Heavy persistence | IndexedDB | Room data, elements, chat, blobs, snapshots |
| Light persistence | LocalStorage | Preferences, session flags |
| Multi-tab coordination | BroadcastChannel | Conflict detection, overwrite prevention |
| LAN collaboration | WebRTC DataChannels | Manual pairing, no signaling server |
| Testing | Vitest 2 + Vue Test Utils 2 | jsdom environment |
| Container | Docker (nginx) | Frontend-only, port 5173→80 |
| Node runtime | Node.js 20 LTS | Build and test only |

## 3. Route Map

All 8 routes are implemented. A session guard redirects unauthenticated visitors to `/profile` for the guarded routes.

| Path | Name | Component | Guard |
|---|---|---|---|
| `/` | `home` | `HomePage.vue` | Public |
| `/profile` | `profile-select` | `ProfileSelectPage.vue` | Public |
| `/rooms` | `room-list` | `RoomListPage.vue` | Active session |
| `/rooms/create` | `room-create` | `RoomCreatePage.vue` | Active session |
| `/rooms/join` | `room-join` | `RoomJoinPage.vue` | Active session |
| `/workspace/:roomId` | `workspace` | `WorkspacePage.vue` | Active session |
| `/workspace/:roomId/settings` | `workspace-settings` | `WorkspaceSettingsPage.vue` | Active session |
| `/workspace/:roomId/backup` | `workspace-backup` | `BackupPage.vue` | Active session |

## 4. Module Map

This reflects the real `repo/frontend/src/` tree at the end of Prompt 10.
There is no `composables/` directory — all reactive state lives in Pinia
stores, keeping the composition boundary in one place.

```
repo/frontend/src/
├── main.ts                       # App entry — mounts Pinia + router + BroadcastChannel
├── App.vue                       # Root component — activity tracking, session lifecycle
├── env.d.ts                      # Vite/Vue type declarations
├── router/                       # 2 files
│   ├── index.ts                  # Route table (8 routes)
│   └── guards.ts                 # Session guard (locked / forced / unlocked)
├── stores/                       # 13 Pinia stores
│   ├── index.ts                  # Pinia setup barrel
│   ├── session-store.ts          # Active profile, lock/sign-out state
│   ├── ui-store.ts               # Toasts, banners, confirm modal
│   ├── room-store.ts             # Room list, active room, members
│   ├── element-store.ts          # Whiteboard elements + conflict plumbing
│   ├── comment-store.ts          # Comment threads + mention resolution
│   ├── chat-store.ts             # Chat retention + pin caps
│   ├── presence-store.ts         # Cursors + avatar stack
│   ├── activity-store.ts         # Activity feed + filter
│   ├── snapshot-store.ts         # Snapshot history + rollback
│   ├── preferences-store.ts      # Theme, avatar color, recent rooms
│   ├── import-export-store.ts    # Backup export/import flow state
│   └── peers-store.ts            # WebRTC peers + pairing state
├── pages/                        # 8 route-level pages
│   ├── HomePage.vue
│   ├── ProfileSelectPage.vue
│   ├── RoomListPage.vue
│   ├── RoomCreatePage.vue
│   ├── RoomJoinPage.vue
│   ├── WorkspacePage.vue
│   ├── WorkspaceSettingsPage.vue
│   └── BackupPage.vue
├── layouts/                      # 1 layout
│   └── AppLayout.vue             # Header, role chip, lock button, toast + banner
├── components/                   # 11 shared + 14 workspace = 25
│   ├── AppBanner.vue
│   ├── ConfirmModal.vue
│   ├── ConflictToast.vue
│   ├── CounterChip.vue
│   ├── EmptyState.vue
│   ├── InlineValidation.vue
│   ├── LimitIndicator.vue
│   ├── LoadingSpinner.vue
│   ├── StatusBadge.vue
│   ├── TabFilter.vue
│   ├── ToastContainer.vue
│   └── workspace/
│       ├── ActivityFeedPanel.vue
│       ├── ApprovalQueue.vue
│       ├── AutosaveIndicator.vue
│       ├── CanvasHost.vue
│       ├── ChatPanel.vue
│       ├── CommentDrawer.vue
│       ├── CursorOverlay.vue        # Remote-member cursors with name tags (R9)
│       ├── MemberListSidebar.vue
│       ├── PairingPanel.vue
│       ├── PresenceAvatarStack.vue
│       ├── SnapshotDrawer.vue
│       ├── WorkspaceLayout.vue
│       ├── WorkspaceToolbar.vue
│       └── WorkspaceToolSidebar.vue
├── engine/                       # 10 engines (pure business logic)
│   ├── index.ts
│   ├── room-engine.ts
│   ├── membership-engine.ts
│   ├── element-engine.ts
│   ├── image-engine.ts
│   ├── comment-engine.ts
│   ├── chat-engine.ts
│   ├── presence-engine.ts
│   ├── activity-engine.ts
│   ├── snapshot-engine.ts
│   └── autosave-scheduler.ts
├── services/                     # 21 services (repos + adaptors + publisher)
│   ├── base-repository.ts
│   ├── db-schema.ts
│   ├── profile-repository.ts
│   ├── profile-service.ts        # PBKDF2 key derivation
│   ├── session-service.ts        # Inactivity lock + forced sign-out
│   ├── room-repository.ts
│   ├── member-repository.ts
│   ├── element-repository.ts
│   ├── image-blob-repository.ts
│   ├── comment-thread-repository.ts
│   ├── comment-repository.ts
│   ├── chat-message-repository.ts
│   ├── pinned-message-repository.ts
│   ├── activity-repository.ts
│   ├── snapshot-repository.ts
│   ├── broadcast-channel-service.ts
│   ├── broadcast-adaptor.ts
│   ├── webrtc-peer-service.ts
│   ├── webrtc-adaptor.ts
│   ├── collab-publisher.ts       # Fans writes to BroadcastChannel + WebRTC (R18/R19)
│   └── local-storage-keys.ts
├── models/                       # 14 domain-model files
│   ├── index.ts
│   ├── constants.ts              # All numeric caps / thresholds / intervals
│   ├── profile.ts, room.ts, element.ts, comment.ts, chat.ts,
│   ├── presence.ts, activity.ts, snapshot.ts, backup.ts,
│   ├── broadcast.ts, collaboration.ts, validation.ts
├── validators/                   # 9 validators
│   ├── index.ts
│   ├── room-create-validator.ts, room-validators.ts, join-validator.ts,
│   ├── passphrase-validator.ts, element-validators.ts,
│   ├── comment-validators.ts, chat-validators.ts,
│   ├── import-validators.ts, snapshot-validators.ts
├── serializers/                  # 3 serializers
│   ├── index.ts
│   ├── pairing-codec.ts          # Manual pairing payload encoding
│   ├── backup-serializer.ts      # Export/import envelope
│   └── snapshot-serializer.ts    # Snapshot roundtrip
└── utils/                        # 5 utils
    ├── index.ts
    ├── logger.ts                 # Redacts sensitive keys; dev-only debug
    ├── id-generator.ts           # IDs + pairing + verification codes
    ├── date-utils.ts             # UTC helpers
    └── size-utils.ts             # Byte estimation + human format
```

## 5. Storage Map

### IndexedDB Stores

| Store | Purpose | Key | Indexes | Prompt |
|---|---|---|---|---|
| `profiles` | Local user profiles (display identity only) | `profileId` | `displayName` | 2–3 |
| `passphraseVerifiers` | PBKDF2 salt/verifier records (no plaintext passphrase) | `profileId` | — | 2–3 |
| `rooms` | Room metadata, settings, membership config | `roomId` | `createdAt` | 2 |
| `members` | Room membership records and approval audit | `[roomId, memberId]` | `roomId`, `state` | 2 |
| `elements` | Whiteboard sticky notes, arrows, pen strokes | `elementId` | `roomId`, `type`, `zIndex` | 2 |
| `images` | Image blobs for whiteboard elements | `imageId` | `roomId`, `elementId` | 2 |
| `commentThreads` | Comment thread metadata per element | `threadId` | `roomId`, `elementId` | 2 |
| `comments` | Individual comment rows | `commentId` | `roomId`, `threadId`, `[roomId, elementId]` | 2 |
| `chatMessages` | Chat messages per room | `messageId` | `roomId`, `createdAt` | 2 |
| `pinnedMessages` | Pinned chat messages | `[roomId, messageId]` | `roomId` | 2 |
| `activityFeed` | Activity events (create, edit, delete, etc.) | `eventId` | `roomId`, `type`, `createdAt` | 2 |
| `snapshots` | Room state snapshots for rollback | `snapshotId` | `roomId`, `createdAt` | 2 |
| `importManifests` | Import validation results and error rows | `manifestId` | `roomId`, `createdAt` | 2 |

### LocalStorage Keys

| Key | Purpose | Type | Prompt |
|---|---|---|---|
| `forgeroom:theme` | UI theme preference (light/dark) | `string` | 7 |
| `forgeroom:recentRooms` | Recent room IDs and names | `JSON array` | 5–6 |
| `forgeroom:lastTool` | Last selected whiteboard tool | `string` | 5–6 |
| `forgeroom:avatarColor` | User's chosen avatar color | `string` | 7 |
| `forgeroom:sessionLock` | Inactivity lock timestamp | `string (ISO)` | 3 |
| `forgeroom:signOutAt` | Forced sign-out deadline | `string (ISO)` | 3 |
| `forgeroom:activeProfileId` | Currently active profile ID | `string` | 3 |

## 6. Collaboration Topology

### BroadcastChannel (Multi-Tab Coordination)

```
Tab A ──── BroadcastChannel("forgeroom:sync") ──── Tab B
               │
               ├─ element-change    (element CRUD operations)
               ├─ chat-message      (new messages, pin/unpin)
               ├─ pin-change        (pin/unpin refresh hint)
               ├─ membership-change (join/leave/approval events)
               ├─ conflict-notify   (overwrite detection)
               ├─ session-lock      (lock/unlock propagation)
               ├─ snapshot-created  (new snapshot notification)
               └─ rollback-applied  (rollback notification)
```

**Conflict prevention:** Each tab holds a tab-session ID. Before writing to IndexedDB, a tab checks the BroadcastChannel for conflicting in-flight writes. On conflict, a toast is shown with options to overwrite or discard.

### WebRTC DataChannels (LAN Peer Sync)

```
Device A                              Device B
   │                                     │
   ├── Generate pairing offer ──────────►│
  │   (copy/paste pairing text)         │
   │                                     ├── Generate pairing answer
   │◄──────────────── pairing answer ────┤
  │   (copy/paste pairing text)         │
   │                                     │
   ├──── RTCPeerConnection ─────────────►│
   │     RTCDataChannel("collab")        │
   │                                     │
   ├── element-op                        │
   ├── chat-op                           │
  ├── comment-op                        │
   ├── presence-op                       │
   ├── approval-op                       │
   ├── activity-op                       │
  ├── snapshot-op                       │
   ├── rollback-op                       │
   └── conflict-op                       │
```

**No signaling server.** Pairing text is exchanged manually via copy/paste. Camera scanning is currently not implemented in UI and falls back to copy/paste guidance.

## 7. Requirement-to-Module Traceability

| # | Requirement | Module(s) | Prompt |
|---|---|---|---|
| R1 | Host creates Room, up to 20 participants | `models/room`, `engine/room-engine`, `engine/membership-engine`, `stores/room-store` | 2, 4, 5–6 |
| R2 | Room link + on-screen pairing code join | `serializers/pairing-codec`, `services/webrtc-peer-service`, `pages/RoomJoinPage`, `components/workspace/PairingPanel` | 2, 5–6 |
| R3 | Configurable request→approval→active→leave flow | `models/room`, `validators/room-validators`, `engine/membership-engine`, `stores/room-store` | 2, 4, 6 |
| R4 | Optional second Reviewer approval at 15+ | `validators/room-validators`, `engine/membership-engine`, `components/workspace/ApprovalQueue` | 2, 4, 6 |
| R5 | Canvas whiteboard with sticky notes, arrows, pen, images | `models/element`, `engine/element-engine`, `engine/image-engine`, `components/workspace/CanvasHost` | 2, 4, 5–6 |
| R6 | 2,000 element cap, 5 MB/image, 50 images/room | `validators/element-validators`, `engine/image-engine`, `services/image-blob-repository` | 2, 4 |
| R7 | Threaded comments (200/thread) with @mentions | `models/comment`, `engine/comment-engine`, `stores/comment-store`, `components/workspace/CommentDrawer` | 2, 4, 6 |
| R8 | Chat (5,000 messages, 3 pinned) | `models/chat`, `engine/chat-engine`, `stores/chat-store`, `components/workspace/ChatPanel` | 2, 4, 6 |
| R9 | Presence: avatar stack + cursor/name tags | `models/presence`, `engine/presence-engine`, `stores/presence-store`, `components/workspace/{PresenceAvatarStack,CursorOverlay}` | 2, 4, 6 |
| R10 | Activity feed with filter tabs | `models/activity`, `engine/activity-engine`, `stores/activity-store`, `components/workspace/ActivityFeedPanel` | 2, 4, 6 |
| R11 | Roles as UI personas only | `models/room`, `layouts/AppLayout`, `pages/ProfileSelectPage`, `components/StatusBadge` | 2, 5–6 |
| R12 | Local-only profile + passphrase (min 8 chars) | `models/profile`, `services/profile-service`, `stores/session-store`, `pages/ProfileSelectPage` | 2, 3 |
| R13 | 30-min inactivity lock, 8-hr forced sign-out | `services/session-service`, `stores/session-store`, `router/guards`, `App.vue` | 3 |
| R14 | IndexedDB persistence for room data | `services/db-schema`, `services/base-repository`, typed repositories in `services/*-repository.ts` | 2, 3, 4 |
| R15 | LocalStorage for preferences | `services/local-storage-keys`, `stores/preferences-store`, `stores/session-store` | 3, 7 |
| R16 | Auto-save every 10 seconds | `engine/autosave-scheduler`, `components/workspace/AutosaveIndicator` | 4, 7 |
| R17 | Snapshots every 5 min, keep 48, one-click rollback | `models/snapshot`, `engine/snapshot-engine`, `stores/snapshot-store`, `services/snapshot-repository` | 2, 4, 7 |
| R18 | BroadcastChannel conflict toasts | `services/broadcast-channel-service`, `services/broadcast-adaptor`, `services/collab-publisher`, `components/ConflictToast` | 3, 5, 7 |
| R19 | WebRTC DataChannels (manual pairing, no signaling) | `services/webrtc-peer-service`, `services/webrtc-adaptor`, `services/collab-publisher`, `stores/peers-store` | 2, 5, 7 |
| R20 | Backup export/import (≤200 MB, row validation, 1K cap) | `stores/import-export-store`, `validators/import-validators`, `serializers/backup-serializer`, `pages/BackupPage` | 2, 7 |

## 8. Room Lifecycle State Diagram

```
                    ┌─────────────┐
     join request   │  Requested  │
    ──────────────► │             │
                    └──────┬──────┘
                           │
              ┌────────────┼───────────────┐
              │ (approve)  │               │ (reject)
              ▼            ▼               ▼
    ┌─────────────┐  ┌──────────────┐  ┌──────────┐
    │   Active    │  │  Pending 2nd │  │ Rejected │
    │             │  │  Approval    │  │(terminal)│
    └──────┬──────┘  └──────┬───┬──┘  └──────────┘
           │                │   │
           │ (leave)        │   │ (reject)
           ▼         (2nd   │   └──────► Rejected
    ┌──────────┐   approve) │
    │   Left   │◄───────────┘
    │(terminal)│     ▲
    └──────────┘     │ (not reachable:
                     │  active → left only)

  Dual-approval path activates when:
    - Room has 15+ active members
    - enableSecondReviewer is true
    - First and second approvers must be distinct
```

### Room Lifecycle Events
1. **Host creates Room** → Room record persisted, Host becomes Active member
2. **Joiner submits request** → MemberRecord created in Requested state
3. **Host/Reviewer approves** → If dual-approval: Requested → PendingSecondApproval → Active. Otherwise: Requested → Active
4. **Host/Reviewer rejects** → Requested or PendingSecondApproval → Rejected
5. **Member leaves** → Active → Left (terminal)
6. **Left/Rejected users cannot post** — enforced by `validateMemberCanAct()`

## 9. Collaboration Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                      Browser Tab A                       │
│                                                          │
│  Vue Components ──► Pinia Stores ──► Validators          │
│       │                  │                │               │
│       │                  ▼                ▼               │
│       │           IndexedDB Repos   ValidationResult     │
│       │                  │                                │
│       │                  ▼                                │
│       │           BroadcastChannel ◄──────────────┐      │
│       │                  │                        │      │
└───────┼──────────────────┼────────────────────────┼──────┘
        │                  │                        │
        │          ┌───────▼────────┐        ┌──────┴──────┐
        │          │  Other Tabs    │        │  Other Tabs  │
        │          │  (same device) │        │  (same dev.) │
        │          └────────────────┘        └─────────────┘
        │
        │  WebRTC DataChannel (LAN)
        ▼
┌───────────────────────┐
│   Browser on Device B  │
│   (same room, LAN)     │
└────────────────────────┘
```

**Data flow rules:**
- All mutations go through Pinia stores → validators → IndexedDB repos
- After a successful write, BroadcastChannel announces the change to other tabs
- WebRTC DataChannel sends the change to LAN peers
- Incoming peer messages are validated and applied through the same store → validator → repo path

## 10. Requirement-to-Storage Traceability

| Requirement | IndexedDB Store(s) | LocalStorage Key(s) |
|---|---|---|
| R1 Room + 20 members | `rooms`, `members` | — |
| R2 Pairing code join | `rooms` (pairingCode) | — |
| R3 Membership flow | `members` (state, approvals) | — |
| R4 Second Reviewer | `members` (approvals array) | — |
| R5 Whiteboard elements | `elements`, `images` | — |
| R6 Element/image caps | `elements` (count), `images` (count, size) | — |
| R7 Comments + mentions | `commentThreads`, `comments` | — |
| R8 Chat + pins | `chatMessages`, `pinnedMessages` | — |
| R9 Presence | (in-memory via stores) | — |
| R10 Activity feed | `activityFeed` | — |
| R11 Roles (UI only) | `members` (role field) | — |
| R12 Passphrase | `profiles`, `passphraseVerifiers` | `forgeroom:activeProfileId` |
| R13 Lock/sign-out | — | `forgeroom:sessionLockAt`, `forgeroom:signOutAt` |
| R14 IndexedDB persistence | All stores | — |
| R15 LocalStorage prefs | — | `forgeroom:theme`, `forgeroom:recentRooms`, `forgeroom:lastTool`, `forgeroom:avatarColor` |
| R16 Auto-save | (timer-driven writes to all stores) | — |
| R17 Snapshots/rollback | `snapshots` | — |
| R18 BroadcastChannel | (in-memory channel) | — |
| R19 WebRTC | (in-memory peer connections) | — |
| R20 Backup import/export | `rooms`, `members`, `elements`, `images`, `commentThreads`, `comments`, `chatMessages`, `pinnedMessages`, `activityFeed`, `snapshots`, `importManifests` | — |

## 11. Local Auth and Session Model (Prompt 3)

### Passphrase Verification (Browser-Only)

ForgeRoom uses PBKDF2-HMAC-SHA-256 (100,000 iterations) via the Web Crypto API for all
passphrase-to-verifier derivation. The raw passphrase is **never stored** anywhere.

```
Create profile:
  passphrase ──► PBKDF2(salt=random, iter=100k, hash=SHA-256) ──► verifier (base64)
  Store: { profileId, salt, verifier, iterations } in IndexedDB "passphraseVerifiers"

Unlock:
  passphrase ──► PBKDF2(salt=stored, iter=stored, hash=SHA-256) ──► derived (base64)
  Compare: derived === stored.verifier  →  success / fail
```

**Security note:** This is a local convenience lock, not a server-grade identity boundary.
The passphrase protects the device profile only. If a user clears site data, profiles are
lost and cannot be recovered. Roles (Host, Reviewer, Participant, Guest) remain UI personas
only and are not a security boundary.

### Session Timer Flow

```
Unlock
  │
  ├── writeSessionToStorage(profileId)
  │     forgeroom:activeProfileId = profileId
  │     forgeroom:sessionLockAt   = now + 30 min
  │     forgeroom:signOutAt       = now + 8 hrs
  │
  ├── startSessionTimers(profileId)
  │     inactivityTimer  = setTimeout(→ InactivityLocked,  lockMs)
  │     forcedSignoutTimer = setTimeout(→ ForcedSignOut, signOutMs)
  │
  └── User activity (mousemove / keydown / click / scroll)
        resetInactivityTimer()
          → extend forgeroom:sessionLockAt = now + 30 min
          → restart inactivityTimer

Page reload (app.mounted):
  checkSessionOnLoad()
    forgeroom:signOutAt  in past? → ForcedSignOut (clear storage)
    forgeroom:sessionLockAt in past? → InactivityLocked
    both in future?      → Active  (resumeSessionTimers)
    no activeProfileId?  → NoProfile
```

### Session States

| State | Trigger | UI Behavior |
|---|---|---|
| `NoProfile` | No profile created or stored | Show profile list / create form |
| `Locked` | Manual lock by user | Show unlock form for current profile |
| `Active` | Successful unlock | Full app access |
| `InactivityLocked` | 30 min without activity | Show unlock form with inactivity notice |
| `ForcedSignOut` | 8 hrs since last unlock | Clear session, show sign-out notice |

### Route Guard Logic

```
beforeEach(to):
  if to.name NOT IN {
    'room-list', 'room-create', 'room-join',
    'workspace', 'workspace-settings', 'workspace-backup'
  }  →  allow
  if session.state === Active                       →  allow
  else  →  redirect to /profile?redirect=to.fullPath
```

### Shared Service Infrastructure

| Service | File | Purpose |
|---|---|---|
| `ProfileRepository` | `services/profile-repository.ts` | IndexedDB CRUD for profiles |
| `PassphraseVerifierRepository` | `services/profile-repository.ts` | IndexedDB CRUD for verifiers |
| `BaseRepository<T>` | `services/base-repository.ts` | Generic IDB CRUD pattern |
| `ProfileService` | `services/profile-service.ts` | PBKDF2 create/verify, profile CRUD |
| `SessionService` | `services/session-service.ts` | Timer orchestration, LS timestamps |
| `BroadcastChannelService` | `services/broadcast-channel-service.ts` | Tab-to-tab pub/sub lifecycle |
| `sessionStore` | `stores/session-store.ts` | Pinia session state + profile management |
| `uiStore` | `stores/ui-store.ts` | Toasts, banners, modal confirmations |

### Feedback Primitives

| Component | File | Purpose |
|---|---|---|
| `ToastContainer` | `components/ToastContainer.vue` | Transient auto-dismissing notifications |
| `AppBanner` | `components/AppBanner.vue` | Persistent top-of-page status banners |
| `ConfirmModal` | `components/ConfirmModal.vue` | Promise-based modal confirmation dialog |
| `InlineValidation` | `components/InlineValidation.vue` | Per-field validation error display |

**Disabled/submitting state:** Forms use `isSubmitting` from `sessionStore` or local `ref`
to disable inputs and show progress labels ("Unlocking…", "Creating…") during async operations.

### Validator Extensions (Prompt 3)

| File | Validates |
|---|---|
| `validators/room-create-validator.ts` | Room name (1–100 chars), description (≤500 chars) |
| `validators/join-validator.ts` | Pairing code (XXXX-XXXX format), display name (≤60 chars) |

### Logging

`utils/logger.ts` — structured logging with automatic redaction of sensitive fields
(`passphrase`, `salt`, `verifier`, `key`, `secret`, `token`, `credential`, `pin`).
Debug output is suppressed in production (`import.meta.env.DEV` check).

## 13. Room Engine Layer (Prompt 4)

Prompt 4 introduces the engine layer — the real business logic that enforces room
invariants, emits activity, and persists changes through focused repositories.
Pinia stores stay thin: they call engines and expose reactive state to the UI.

### 13.1 Layering

```
┌────────────────────────────────────────────────────────────┐
│ Pinia Stores (thin harnesses)                              │
│   room-store · element-store · comment-store · chat-store  │
│   presence-store · activity-store · snapshot-store         │
└──────────────────────┬─────────────────────────────────────┘
                       │ calls
┌──────────────────────▼─────────────────────────────────────┐
│ Engines (business logic)                                   │
│   room · membership · element · image · comment · chat     │
│   presence · activity · snapshot · autosave-scheduler      │
└──────────────────────┬─────────────────────────────────────┘
                       │ persists through
┌──────────────────────▼─────────────────────────────────────┐
│ Repositories (storage)                                     │
│   room · member · element · image-blob · comment-thread    │
│   comment · chat-message · pinned-message · activity       │
│   snapshot                                                 │
└──────────────────────┬─────────────────────────────────────┘
                       │ backed by
┌──────────────────────▼─────────────────────────────────────┐
│ IndexedDB (`forgeroom` database)                           │
└────────────────────────────────────────────────────────────┘
```

### 13.2 Membership state machine

```
  ┌─────────────────┐
  │ (new requester) │
  └────────┬────────┘
           │ requestJoin()
           ▼
  ┌─────────────────┐   room.requireApproval = false
  │   Requested     │──────────────────────────────► Active
  └────────┬────────┘
           │ approveJoin()  [count(active) < 15 OR !enableSecondReviewer]
           ▼
  ┌─────────────────┐   approveJoin() second distinct approver
  │ PendingSecond   │──────────────────────────────► Active
  │    Approval     │                                     │
  └────────┬────────┘                                     │
           │ denyJoin()                                   │
           ▼                                              │
  ┌─────────────────┐                                     │ leaveRoom()
  │    Rejected     │                                     ▼
  └─────────────────┘                               ┌──────────┐
                                                    │   Left   │
                                                    └──────────┘
```

- Dual-reviewer path triggers only when `settings.enableSecondReviewer` is true AND
  active-member count is ≥ `SECOND_REVIEWER_THRESHOLD` (15).
- The second approver must be distinct from the first — enforced by
  `validateDistinctApprovers`.
- `MAX_ROOM_MEMBERS` (20) is re-checked before the flip to `Active` to cover the
  race where two approvals complete near the cap.
- Post-`Left` actions are rejected by `assertMemberCanAct`.

### 13.3 Element / image / comment / chat limits

| Limit | Constant | Enforced by |
|---|---|---|
| 2,000 elements per room | `MAX_ELEMENTS_PER_ROOM` | `element-engine.createSticky/Arrow/PenStroke/ImageElement` |
| 50 images per room | `MAX_IMAGES_PER_ROOM` | `image-engine.ingestImageFile` |
| 5 MB per image | `MAX_IMAGE_SIZE_BYTES` | `image-engine.ingestImageFile` |
| 200 comments per thread | `MAX_COMMENTS_PER_THREAD` | `comment-engine.appendComment` |
| 5,000 chat messages retained | `MAX_CHAT_MESSAGES_RETAINED` | `chat-engine.sendMessage` → `deleteOldestExcess` |
| 3 pinned messages per room | `MAX_PINNED_MESSAGES` | `chat-engine.pinMessage` |

### 13.4 Autosave and snapshot cadence

```
  startRoomScheduler(roomId, {onAutoSave, onSnapshot})
     │
     ├──► setInterval(onAutoSave, AUTOSAVE_INTERVAL_MS = 10_000)
     └──► setInterval(onSnapshot, SNAPSHOT_INTERVAL_MS = 300_000)

  stopRoomScheduler(roomId)  — clears both intervals for this room
  stopAll()                  — clears all room intervals
```

The engine does not own `snapshotEngine.captureSnapshot` — callers pass it as
`onSnapshot`, keeping scheduling and persistence separable for testing.

### 13.5 Rollback as new state (Q5)

```
  snapshots: #42 #43 #44 #45
                │
                │ rollbackTo(#42, actor)
                ▼
  snapshots: #42 #43 #44 #45 #46   (#46 is a new snapshot derived from #42)
                                 ▲
                                 └── activity: SnapshotRolledBack
                                       metadata: sourceSnapshotId, sourceSequenceNumber,
                                                 resultingSnapshotId, rolledBackAt, rollbackId
```

- Originals and intermediates are **never deleted** by a rollback.
- The derived snapshot carries a fresh `sequenceNumber` and becomes the head of
  the timeline.
- Retention trim (`MAX_SNAPSHOTS_RETAINED = 48`) is re-applied after rollback.

### 13.6 Activity events

| Event type | Emitted by |
|---|---|
| `RoomCreated` | `room-engine.createRoom` |
| `MemberJoined` / `MemberLeft` | `membership-engine.requestJoin` (auto-active), `leaveRoom`, `approveJoin` (on flip to Active) |
| `MemberApproved` / `MemberRejected` | `membership-engine.approveJoin`, `denyJoin` |
| `ElementCreated` / `ElementUpdated` / `ElementDeleted` | `element-engine.*` |
| `CommentAdded` | `comment-engine.createThread`, `appendComment` |
| `MessagePinned` / `MessageUnpinned` | `chat-engine.pinMessage`, `unpinMessage` |
| `SnapshotRolledBack` | `snapshot-engine.rollbackTo` |

All events flow through `activity-engine.emitActivity` which persists to the
`activityFeed` IDB store via `activityRepository`.

### 13.7 Requirement → engine traceability

| REQ | Description | Primary engine |
|---|---|---|
| R1 | Max 20 active members | `membership-engine` |
| R3 | Join state transitions | `membership-engine` |
| R4 | Optional second Reviewer approval at 15+ | `membership-engine` |
| R5 | Whiteboard element types | `element-engine` |
| R6 | Element / image / size caps | `element-engine`, `image-engine` |
| R7 | Comment threads + mentions | `comment-engine` |
| R8 | Chat retention + pin cap | `chat-engine` |
| R9 | Presence (in-memory) | `presence-engine` |
| R10 | Activity feed | `activity-engine` |
| R16 | Autosave every 10 s | `autosave-scheduler` |
| R17 | Snapshots every 5 min + rollback | `snapshot-engine`, `autosave-scheduler` |

## 14. Current Status

**Historical status (audit iteration 1) — full pass (2026-04-17).** Audit iteration 1 (`.tmp/audit_report-1.md`) returned FAIL with 3 Blockers (B1–B3), 4 Highs (H4–H7), and 3 Mediums (M1–M3). The follow-up fix-check (`.tmp/audit_report_1-fix_check.md`) flagged B3, H4, and H7 as **Partially Fixed** with specific residual gaps. All original findings *and* the three partial-fix residuals were closed in source, tests, and docs for that iteration:

**Audit iteration 2 remediation (2026-04-17).** Static review findings for WebRTC state-application credibility, import-cap enforcement, snapshot/rollback message semantics, and image rendering were addressed by introducing rich collaboration payloads + apply-on-receive helpers, blocking over-cap imports during persistence, splitting `snapshot-op` from `rollback-op`, and rendering blob-backed images in `CanvasHost`.

**Blockers & Highs**
- **B1** — `WorkspacePage.vue` now computes an `ActivityActor` and passes it as a prop to `CanvasHost`, `ChatPanel`, and `CommentDrawer`; `CanvasHost.onDrop` now passes `{ blob, fileName, mimeType, dimensions, ... }` to `imageEngine.ingestImageFile` (matching the engine's `IngestImageInput` contract).
- **B2** — `CanvasHost.vue` declares and emits `open-comments`; the in-canvas Comment action button now triggers that emit, and `WorkspacePage` opens the comment drawer in response.
- **B3** — `WorkspaceToolbar.vue` declares `open-pairing` and renders a visible **Pair** button; five stores (`element`, `chat`, `comment`, `snapshot`, `room`) now fan every successful write through `services/collab-publisher.ts`, which calls both the matching `broadcast*` helper and `broadcastCollabMessage` over WebRTC. **Residual-fix (fix-check):** outbound `presence-op` is now wired too — `services/collab-publisher.ts` exports `publishPresence`, and `WorkspacePage.onCursorMove` publishes every local cursor update to LAN peers alongside the local `presenceStore.updateCursor` call.
- **H4** — Every BroadcastChannel topic now has an active outbound publication site in the stores (see §15.3 wiring table). **Residual-fix (fix-check):** `publishConflict` is no longer dead. `element-store.updateElement` emits `element-overwrite` when the engine reports the target element is gone/stale, and `chat-store.pinMessage` emits `pin-collision` when the 3-pin cap is hit or a duplicate pin is attempted. Both call sites use the new `getLocalTabId()` helper exported from `services/broadcast-channel-service.ts` so the emitted payload carries a stable tab identity.
- **H5** — `import-export-store.exportRoom` now populates `BackupManifest.data.images[]` with base64-encoded blobs via `imageBlobRepository.listByRoom`; `persistImport` restores every image via `imageBlobRepository.put`.
- **H6** — New `components/workspace/CursorOverlay.vue` renders remote-member cursors with name tags; `CanvasHost` emits `cursor-move` on pointer move (rAF-throttled); `WorkspacePage` wires the event to `presenceStore.updateCursor` *and* `publishPresence`.
- **H7** — `WorkspacePage.test.ts` no longer stubs heavy children as `<div />`; it asserts the `actor` prop reaches each consumer and that `open-comments` / `open-pairing` drive the right UI transitions. **Residual-fix (fix-check):** a new integration test file `unit_tests/pages/WorkspacePage.integration.test.ts` mounts the **real** `CanvasHost`, `ChatPanel`, and `CommentDrawer` (only the layout, toolbar, sidebar, and other peripheral components remain stubbed) and asserts (a) all three real components are in the tree, (b) the computed `actor` object is threaded into each child's props, (c) `open-comments` propagates the selected element id to `CommentDrawer`, and (d) `cursor-move` fires both `presenceStore.updateCursor` and `publishPresence`.

**Mediums**
- **M1** — `AUTH_REQUIRED_ROUTES` in `router/guards.ts` now includes all six guarded routes (`room-list`, `room-create`, `room-join`, `workspace`, `workspace-settings`, `workspace-backup`), matching §3.
- **M2** — `RoomListPage.vue` now exposes a **Copy Link** action per room card that writes `${origin}/rooms/join?code=<pairing>` to `navigator.clipboard` with a `window.prompt` fallback.
- **M3** — The README "Current Status" and this §14 have been rebaselined to describe the post-fix-check state. No "final readiness audit passed" claim remains anywhere in the tree.

No parallel sub-agents were used; all remediation ran sequentially in the main agent. `.tmp/audit_report-1.md` and `.tmp/audit_report_1-fix_check.md` are both preserved byte-identically as the historical record.

---

## 15. App Shell & Collaboration Adaptors (Prompt 5)

### 15.1 Route additions

| Route | Name | Component |
|---|---|---|
| `/rooms/create` | `room-create` | `RoomCreatePage.vue` |
| `/rooms/join` | `room-join` | `RoomJoinPage.vue` |
| `/workspace/:roomId/settings` | `workspace-settings` | `WorkspaceSettingsPage.vue` |

Total routes: 8 (home, profile-select, room-list, room-create, room-join, workspace, workspace-settings, workspace-backup). `workspace-backup` added in Prompt 7.

### 15.2 Layout component map

```
WorkspacePage.vue
└── AppLayout
    └── WorkspaceLayout
        ├── slot:toolbar        → WorkspaceToolbar
        │                           └── PresenceAvatarStack
        ├── slot:tool-sidebar   → WorkspaceToolSidebar
        ├── slot:canvas         → CanvasHost
        ├── slot:chat-panel     → ChatPanel
        ├── slot:activity-panel → ActivityFeedPanel
        ├── slot:member-list    → MemberListSidebar
        │                           └── ApprovalQueue
        ├── slot:snapshot-drawer → SnapshotDrawer
        └── slot:comment-drawer  → CommentDrawer
```

`WorkspaceLayout` manages which right panel is visible (chat / activity / members / snapshots) via an internal `activePanel` ref. Comment drawer slides in independently.

### 15.3 BroadcastChannel wiring table

| Event type | Inbound handler | Outbound publisher (post-audit) |
|---|---|---|
| `element-change` | `elementStore.loadElements(roomId)` | `publishElement` — called by `elementStore.{createSticky,createArrow,createPenStroke,ingestImage,updateElement,deleteElement,bringToFront}` and by `commentStore.{createThread,appendComment}` (element-anchored) |
| `chat-message` | `chatStore.loadChat(roomId)` | `publishChat` — called by `chatStore.sendMessage` |
| `pin-change` | `chatStore.loadChat(roomId)` | `publishPin` — called by `chatStore.{pinMessage,unpinMessage}` |
| `membership-change` | `roomStore.refreshMembers()` | `publishMembership` — called by `roomStore.{requestJoin,approveJoin,denyJoin,leave}` |
| `conflict-notify` | `uiStore.addBanner(message, 'warning')` | `publishConflict` — called by `elementStore.updateElement` (emits `element-overwrite` when the target element has disappeared) and by `chatStore.pinMessage` (emits `pin-collision` when the 3-pin cap is hit or a duplicate pin is attempted) |
| `session-lock` (lock) | `sessionStore.lock()` | `sessionStore` / session-service (unchanged by audit) |
| `session-lock` (sign-out) | `sessionStore.signOut()` | same as above |
| `snapshot-created` | `snapshotStore.refresh(roomId)` | `publishSnapshot` — called by `snapshotStore.captureManual` |
| `rollback-applied` | `snapshotStore.refresh(roomId)` + `uiStore.toast.info(...)` | `publishRollback` — called by `snapshotStore.rollback` |

Every `publish*` function also sends the matching `CollabMessage` via `broadcastCollabMessage` (WebRTC DataChannels) with a monotonically increasing `seqNum`, so multi-tab and LAN peers observe the same ordered signal stream. See `services/collab-publisher.ts`.

`publishPresence` is the one publisher with **no** BroadcastChannel counterpart — cursor presence is intentionally LAN-only (each tab is its own user perspective; cross-tab cursor fan-out would produce false ghost cursors for the same user). It is invoked from `WorkspacePage.onCursorMove` every time the real `CanvasHost` emits a `cursor-move` event, and the rAF-throttled emit guarantees at most one publication per animation frame.

All store imports inside the adaptor are deferred (dynamic `await import(...)`) to prevent circular dependencies at module-load time. Cleanup calls each `unsubscribe` function returned by `subscribeBroadcast`.

### 15.4 WebRTC peer lifecycle

```
Host                                   Guest
  │                                      │
  │ createOffer(roomId, localPeerId,     │
  │   displayName)                       │
  │   → RTCPeerConnection                │
  │   → DataChannel                      │
  │   → createOffer() + setLocalDesc     │
  │   → waitForIceGathering (2s max)     │
  │   → encodePairingPayload(offer SDP)  │
  │   → returns encoded string           │
  │                                      │
  │ [user copies encoded offer]          │
  │                              [user pastes offer]
  │                                      │
  │                         addRemoteOffer(encodedOffer,
  │                           localPeerId, displayName)
  │                           → decodePairingPayload
  │                           → verifyChecksum
  │                           → RTCPeerConnection
  │                           → setRemoteDesc (offer)
  │                           → createAnswer
  │                           → setLocalDesc (answer)
  │                           → encodePairingPayload(answer SDP)
  │                           → returns encoded answer
  │                                      │
  │ [user copies answer]                 │
  │                                      │
  │ acceptAnswer(localPeerId, answer)    │
  │   → decodePairingPayload             │
  │   → verifyChecksum                   │
  │   → setRemoteDesc (answer)           │
  │   → DataChannel opens                │
  │   → onCollabMessage handlers fire    │
```

`waitForIceGathering`: resolves on `iceGatheringState === 'complete'` or after 2000 ms (LAN-only, no STUN/TURN servers needed).

### 15.5 New Pinia stores

| Store | Purpose | LS persistence |
|---|---|---|
| `preferences-store` | theme (light/dark) + lastTool | `LS_KEYS.THEME`, `LS_KEYS.LAST_TOOL` |
| `import-export-store` | backup export + import coordination | none (progress in memory) |
| `peers-store` | WebRTC peer list + pairing step FSM | none (in-memory only) |

---

## 16. Primary Workflows (Prompt 6)

### 16.1 Component tree for workspace (Prompt 6 additions)

All workspace-specific components in `src/components/workspace/`:

| Component | Role |
|---|---|
| `WorkspaceLayout` | 3-column shell (tool sidebar, canvas area, right panel) |
| `WorkspaceToolbar` | Tool selector + room info + LimitIndicator + presence stack |
| `WorkspaceToolSidebar` | Left palette: select / sticky / arrow / pen / image |
| `CanvasHost` | Canvas placeholder + SVG/div element overlays + tool FSM |
| `ChatPanel` | Message list + composer + pinned row + retention notice |
| `CommentDrawer` | Slide-in thread list + append form + @mention autocomplete |
| `ActivityFeedPanel` | TabFilter + event rows + 30 s auto-refresh |
| `PresenceAvatarStack` | Up to 5 avatars + +N overflow + idle dimming |
| `MemberListSidebar` | Full member list + ApprovalQueue for Host/Reviewer |
| `ApprovalQueue` | Pending-join rows + approve/deny + dual-reviewer badge |
| `SnapshotDrawer` | Snapshot timeline + Restore button with confirm |
| `PairingPanel` | WebRTC offer/answer exchange UI (host and guest flows) |

### 16.2 Tool interaction model

Tool state is held in `WorkspacePage.vue` as `activeTool: 'select' | 'sticky' | 'arrow' | 'pen' | 'image'`, passed as a prop to `CanvasHost`. The active tool is also persisted to `preferencesStore.lastTool`.

```
CanvasHost tool actions:
  sticky  → dblclick on overlay → inline StickyNoteEditor → elementStore.createSticky
  arrow   → pointerdown (start) + pointerup (end) → elementStore.createArrow
  pen     → pointerdown → pointermove (collect points) → pointerup → elementStore.createPenStroke
  image   → drop file onto overlay → size check (5MB) + cap check (50 images) → elementStore.ingestImage
  select  → click element → show action bar (edit / delete / bring-to-front / comment)
```

Elements render as absolutely-positioned div/SVG overlays, including blob-backed room images. Advanced Canvas API features (viewport transforms, pressure-curve smoothing, zoom/pan ergonomics) are treated as non-blocking enhancements.

### 16.3 Join + approval sequence

```
Guest submits join form (RoomJoinPage)
  → validateJoinPayload
  → roomRepository.listAll → find by pairingCode
  → roomStore.requestJoin
      → membershipEngine.requestJoin
         → validates pairingCode, capacity (< 20), state machine
         → if requireApproval=false: state → Active, navigate to workspace
         → if requireApproval=true: state → Requested, show awaiting screen

Host/Reviewer in ApprovalQueue (MemberListSidebar)
  → roomStore.approveJoin(memberId, actor)
      → membershipEngine.approveJoin
         → if enableSecondReviewer and members ≥ 15: state → PendingSecondApproval
         → else: state → Active
         → second approval from distinct actor: state → Active

  → roomStore.denyJoin(memberId, actor) [after uiStore.confirm]
      → membershipEngine.denyJoin → state → Rejected
```

### 16.4 Mention resolution flow

```
CommentDrawer textarea input
  → /@(\w*)$/ regex on current text
  → commentStore.resolveMentions(query, roomStore.members, historicalIds)
      → filters members matching query (substring, case-insensitive)
      → active members always included and ranked first
      → left/rejected members included only when present in retained history
      → non-active members marked in dropdown via `isActive/state`
  → user clicks suggestion → replaces @query with @DisplayName
```

### 16.5 Stale-state guard

When `presenceStore` detects the local member's state has transitioned to `Left` (watched via `activeMember.state` in `WorkspacePage`):
- `uiStore.addBanner('You have left this room. Actions are read-only.', 'warning', false)` — non-dismissible
- `canAct` computed becomes `false`, propagated as `disabled` prop to `CanvasHost`, `ChatPanel`, `CommentDrawer`
- All write action buttons are disabled; read-only views remain accessible

This mirrors `membershipEngine.assertMemberCanAct` at the UI layer.

## Section 17: Recovery, Import/Export, Conflict Handling (Prompt 7)

### 17.1 Comment repository `listByRoom` fix

`commentRepository.listByRoom(roomId)` was added to resolve Q13 (deferred from Prompt 6). The `comments` IndexedDB store already had a `by-roomId` index. The backup export store now calls this method directly without the conditional fallback.

### 17.2 Autosave indicators

`AutosaveIndicator.vue` (`src/components/workspace/`) displays a colored dot + label reflecting the current autosave cycle state: `idle | saving | saved | failed`. The component is mounted in `WorkspaceToolbar` and receives `autosaveStatus` and `lastSavedAt` props. `WorkspacePage` tracks `autosaveStatus` and `lastSavedAt` via the `onAutoSave` scheduler callback.

### 17.3 Backup export/import UI

`BackupPage.vue` (`src/pages/`) provides:
- **Export section**: triggers `importExportStore.exportRoom(roomId, displayName)` → Blob download; progress bar; post-check 200 MB size guard; error display.
- **Import section**: file picker → `importExportStore.validateImport(file)` → validation result panel with: success/failure header, row-level error list (max 20 shown + overflow count), warnings list, truncation notice when batch cap (1,000) exceeded.
- **Import section**: file picker → `importExportStore.validateImport(file)` → validation result panel with: success/failure header, row-level error list (max 20 shown + overflow count), warnings list, and an explicit blocked-import notice when sticky-note/comment cap (1,000) is exceeded.
- **Manifest preview**: shows room name, export date, exporter, stats (elements / comments / messages / snapshots).
- **Confirm + persist**: `uiStore.confirm()` modal before `importExportStore.persistImport(manifest)`. Partial failure (if persist throws) shows explicit notice that data may be partially saved.

Route: `/workspace/:roomId/backup` → `workspace-backup` (added to router).
WorkspaceToolbar has a "Backup" button that navigates to this route.

### 17.4 Snapshot drawer enhancements

`SnapshotDrawer.vue` now shows:
- **Post-rollback summary banner**: displayed when `snapshotStore.lastRollback` is set, shows source sequence number, initiator display name, and dismissal button.
- **Host-only Restore button**: `v-if="isHost"` — rollback controls hidden for non-hosts.
- Snapshots list remains unchanged (sequence number, date, size).

### 17.5 BroadcastChannel conflict helpers

`broadcast-adaptor.ts` now exports:
- `broadcastConflictNotify(roomId, conflictType, resourceId, conflictingTabId, message)` — sends `conflict-notify` to other tabs; they display a dismissible banner.
- `broadcastSnapshotCreated(roomId, snapshotId, sequenceNumber)` — replaces any manually constructed snapshot-created messages.
- `broadcastRollbackApplied(roomId, snapshotId, initiatorId, resultingSnapshotId)` — replaces manually constructed rollback-applied messages.

The conflict-notify handler in `attachRoomBroadcast` already dispatched banner display; callers (element store mutations, pin operations) should call `broadcastConflictNotify` when a write collision is detected.

### 17.6 WebRTC failure + fallback UX

`PairingPanel.vue` now shows a **fallback guidance panel** when `peersStore.pairingStep === 'failed'`:
- Explains the backup file share workflow as an alternative.
- A "Try Again" button calls `peersStore.resetPairing()` and regenerates `localPeerId`.
- The disclaimer text now references "Backup & Restore" as a fallback.

### 17.7 Preferences settings

`WorkspaceSettingsPage.vue` now includes a **Preferences section** (available to all members, not just the Host):
- Theme toggle (light/dark) — calls `preferencesStore.setTheme()` on save.
- Avatar color picker — 10 preset swatches; persists to `LS_KEYS.AVATAR_COLOR` via `lsSetString`.
- "Save Preferences" button with success toast on confirmation.
