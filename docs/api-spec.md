# ForgeRoom — Client-Side API Specification

This document defines the internal contracts for ForgeRoom's pure frontend SPA. There is no backend server or remote API. All "APIs" described here are browser-side service boundaries, storage schemas, protocol envelopes, and validation conventions used between modules within the single-page application.

---

## 1. Route Screen Contracts

Each route targets a page component with defined store dependencies and expected UI states.

### `GET /` — HomePage

| Property | Value |
|---|---|
| Component | `HomePage.vue` |
| Stores required | None |
| States | default (render links to profile and rooms) |
| Auth required | No |

### `GET /profile` — ProfileSelectPage

| Property | Value |
|---|---|
| Component | `ProfileSelectPage.vue` |
| Stores required | `sessionStore` |
| States | loading, profile-list, create-new, unlock-prompt, error |
| Auth required | No (this IS the auth entry) |

### `GET /rooms` — RoomListPage

| Property | Value |
|---|---|
| Component | `RoomListPage.vue` |
| Stores required | `sessionStore`, `roomStore` |
| States | loading, empty, room-list, error |
| Auth required | Yes (profile must be unlocked) |

### `GET /workspace/:roomId` — WorkspacePage

| Property | Value |
|---|---|
| Component | `WorkspacePage.vue` |
| Stores required | `sessionStore`, `roomStore`, `elementStore`, `chatStore`, `commentStore`, `presenceStore`, `activityStore`, `snapshotStore`, `peersStore` |
| States | loading, active, locked, member-left, error |
| Auth required | Yes (profile must be unlocked, must be active room member) |

### Additional Implemented Routes

| Route | Component | Stores | Auth |
|---|---|---|---|
| `/rooms/create` | `RoomCreatePage.vue` | `sessionStore`, `roomStore` | Yes |
| `/rooms/join` | `RoomJoinPage.vue` | `sessionStore`, `roomStore` | Yes |
| `/workspace/:roomId/settings` | `WorkspaceSettingsPage.vue` | `sessionStore`, `roomStore`, `preferencesStore` | Yes |
| `/workspace/:roomId/backup` | `BackupPage.vue` | `sessionStore`, `roomStore`, `importExportStore` | Yes |

### Route Observability and Coverage

Route behavior is validated at two levels:

- Unit/integration router coverage:
  - `repo/frontend/unit_tests/router.test.ts` (route map and path/name resolution)
  - `repo/frontend/unit_tests/router/guards.test.ts` (pure guard matrix)
  - `repo/frontend/unit_tests/router/navigation.integration.test.ts` (real navigation + guard redirects for all 8 paths)
- Browser route journey coverage:
  - `repo/frontend/e2e_tests/routes.e2e.spec.ts` (Playwright, Docker profile `e2e`)

Together, these suites verify both static route mapping and runtime navigation guard outcomes.

---

## 2. Storage Repository Interfaces

### IndexedDB Repository Pattern

Each IndexedDB store is accessed through a typed repository module in `services/`. All repositories follow this interface pattern:

```typescript
interface Repository<T, K = string> {
  getById(key: K): Promise<T | undefined>
  getAll(): Promise<T[]>
  query(index: string, value: IDBValidKey): Promise<T[]>
  put(item: T): Promise<void>
  delete(key: K): Promise<void>
  count(index?: string, value?: IDBValidKey): Promise<number>
  clear(): Promise<void>
}
```

### Repository Modules (implemented)

Every repository below is implemented in `src/services/` and covered by a
matching test file in `unit_tests/services/` (verified by the Prompt 10 audit).
The `importManifests` store is accessed directly from
`stores/import-export-store.ts` rather than through a dedicated repository
class — import/export is a one-shot flow that does not need a reusable CRUD
surface.

| Repository / Access Point | IndexedDB Store | Key | Primary Operations |
|---|---|---|---|
| `ProfileRepository` | `profiles` | `profileId` | CRUD profiles, store passphrase verifier |
| `PassphraseVerifierRepository` | `passphraseVerifiers` | `profileId` | Store PBKDF2 salt + verifier (no plaintext passphrase) |
| `RoomRepository` | `rooms` | `roomId` | CRUD rooms, membership config |
| `MemberRepository` | `members` | `[roomId, memberId]` | Join requests, approvals, state transitions |
| `ElementRepository` | `elements` | `elementId` | CRUD whiteboard elements, enforce 2,000 cap |
| `ImageBlobRepository` | `images` | `imageId` | Store/retrieve image blobs, enforce 50 cap and 5 MB limit |
| `CommentThreadRepository` | `commentThreads` | `threadId` | CRUD threads, lookup by element and room |
| `CommentRepository` | `comments` | `commentId` | CRUD comments, enforce 200/thread cap; `listByRoom` for backup export |
| `ChatMessageRepository` | `chatMessages` | `messageId` | Append messages, enforce 5,000 retention |
| `PinnedMessageRepository` | `pinnedMessages` | `[roomId, messageId]` | Pin/unpin, enforce 3 pin cap |
| `ActivityRepository` | `activityFeed` | `eventId` | Append events, filter by type |
| `SnapshotRepository` | `snapshots` | `snapshotId` | Create snapshots, enforce 48 retention, rollback |
| `import-export-store` (direct access) | `importManifests` | `manifestId` | Store import results and error rows |

### LocalStorage Repository

```typescript
interface LocalPreferences {
  theme: 'light' | 'dark'
  recentRooms: Array<{ roomId: string; name: string; lastAccessed: string }>
  lastTool: string
  avatarColor: string
}

interface SessionFlags {
  activeProfileId: string | null
  sessionLockAt: string | null    // ISO timestamp
  signOutAt: string | null        // ISO timestamp
}
```

All LocalStorage keys are prefixed with `forgeroom:` to avoid collisions.

---

## 3. BroadcastChannel Event Envelopes

Channel name: `forgeroom:sync`

All messages follow this base envelope:

```typescript
interface BroadcastEnvelope<T = unknown> {
  type: BroadcastEventType
  tabId: string             // sender's unique tab session ID
  timestamp: string         // ISO 8601
  roomId?: string           // room context (if applicable)
  payload: T
}

type BroadcastEventType =
  | 'element-change'
  | 'chat-message'
  | 'presence-update'
  | 'membership-change'
  | 'conflict-notify'
  | 'session-lock'
  | 'snapshot-created'
  | 'rollback-applied'
  | 'pin-change'
```

### Event Payloads

```typescript
// Element operations
interface ElementChangePayload {
  operation: 'create' | 'update' | 'delete'
  elementId: string
  elementType?: 'sticky-note' | 'arrow' | 'pen-stroke' | 'image'
  data?: Record<string, unknown>
}

// Chat messages
interface ChatMessagePayload {
  operation: 'new' | 'delete'
  messageId: string
  content?: string
  authorId?: string
}

// Presence updates
interface PresenceUpdatePayload {
  memberId: string
  cursorX?: number
  cursorY?: number
  isActive: boolean
}

// Membership changes
interface MembershipChangePayload {
  operation: 'request' | 'approve' | 'leave' | 'reject'
  memberId: string
  approvedBy?: string
}

// Conflict notifications
interface ConflictNotifyPayload {
  conflictType: 'element-overwrite' | 'pin-collision' | 'membership-race'
  resourceId: string
  conflictingTabId: string
  message: string
}

// Session lock propagation
interface SessionLockPayload {
  action: 'lock' | 'unlock' | 'sign-out'
  profileId: string
}
```

---

## 4. WebRTC Pairing & Collaboration Envelopes

### Pairing Envelope (Manual Exchange)

The pairing text is a base64-encoded JSON payload exchanged via copy/paste.
The payload shape is QR-compatible, but camera scan UI is currently a fallback-to-copy/paste flow.

```typescript
interface PairingOffer {
  version: 1
  type: 'offer'
  roomId: string
  peerId: string
  displayName: string
  timestamp: string           // ISO 8601
  verificationCode: string    // short human-readable code (e.g., "FORGE-8A3F")
  sdp: string                 // SDP offer
  iceCandidates: string[]     // gathered ICE candidates
  checksum: string            // SHA-256 of payload for integrity
}

interface PairingAnswer {
  version: 1
  type: 'answer'
  roomId: string
  peerId: string
  displayName: string
  timestamp: string
  verificationCode: string    // must match offer's code
  sdp: string                 // SDP answer
  iceCandidates: string[]
  checksum: string
}
```

### Collaboration Message Envelope (DataChannel)

Once the RTCDataChannel is open, all messages use this envelope:

```typescript
interface CollabMessage<T = unknown> {
  type: CollabMessageType
  senderId: string
  timestamp: string
  seqNum: number              // monotonic sequence for ordering
  roomId: string
  payload: T
}

type CollabMessageType =
  | 'element-op'
  | 'chat-op'
  | 'comment-op'
  | 'presence-op'
  | 'approval-op'
  | 'activity-op'
  | 'snapshot-op'
  | 'rollback-op'
  | 'conflict-op'
  | 'sync-request'
  | 'sync-response'
```

### Collaboration Payloads

```typescript
interface ElementOpPayload {
  operation: 'create' | 'update' | 'delete'
  elementId: string
  element?: WhiteboardElement
}

interface ChatOpPayload {
  operation: 'new' | 'delete' | 'pin' | 'unpin'
  messageId: string
  message?: ChatMessage
  pinned?: PinnedMessage
}

interface CommentOpPayload {
  operation: 'create-thread' | 'append-comment'
  threadId: string
  elementId: string
  thread?: CommentThread
  comment?: Comment
}

interface PresenceOpPayload {
  memberId: string
  roomId: string
  displayName: string
  avatarColor: string
  isOnline: boolean
  cursor: { x: number; y: number; timestamp: number } | null
  currentTool: string | null
  lastSeenAt: string
}

interface ApprovalOpPayload {
  operation: 'request' | 'approve' | 'reject' | 'leave'
  memberId: string
  member?: MemberRecord
}

interface SnapshotOpPayload {
  operation: 'snapshot-created'
  snapshotId: string
  sequenceNumber: number
  snapshot?: Snapshot
}

interface RollbackOpPayload {
  operation: 'rollback-applied'
  snapshotId: string
  initiatorId: string
  resultingSnapshotId: string
  snapshot?: Snapshot
}

interface SyncRequestPayload {
  lastSeqNum: number
  requestedStores: string[]
}

interface SyncResponsePayload {
  data: Record<string, unknown[]>
  fromSeqNum: number
  toSeqNum: number
}
```

---

## 5. Import/Export File Format

### Backup File Structure

The backup file is a JSON blob downloaded via `Blob` + `URL.createObjectURL`:

```typescript
interface BackupManifest {
  version: 1
  exportedAt: string          // ISO 8601
  exportedBy: string          // profile display name
  roomId: string
  roomName: string
  format: 'forgeroom-backup-v1'
  data: {
    room: RoomMetadata
    members: MemberRecord[]
    elements: WhiteboardElement[]
    images: ImageReference[]   // base64-encoded blobs
    commentThreads: CommentThread[]
    comments: Comment[]
    chatMessages: ChatMessage[]
    pinnedMessages: PinnedMessage[]
    activityFeed: ActivityEvent[]
    snapshots: Snapshot[]
  }
  stats: {
    totalElements: number
    totalImages: number
    totalComments: number
    totalChatMessages: number
    totalSnapshots: number
    fileSizeBytes: number
  }
}
```

**Constraints:**
- Maximum file size: 200 MB (checked before export and on import)
- Bulk import cap: 1,000 sticky notes + comments per batch (validation fails when exceeded)
- Persistence guard: import is blocked when sticky notes + comments exceed cap
- Row-level validation on import

### Import Validation Result

```typescript
interface ImportValidationResult {
  success: boolean
  totalRows: number
  validRows: number
  errorRows: ImportRowError[]
  warnings: string[]
  truncated: boolean           // true when batch cap is exceeded; import must be blocked
}

interface ImportRowError {
  rowIndex: number
  rowType: 'element' | 'comment' | 'chat-message' | 'member' | 'image'
  field?: string
  error: string
  rawValue?: unknown
}
```

---

## 6. Validation & Error Shape Conventions

All validators in the SPA use these shared result types:

```typescript
interface ValidationResult {
  valid: boolean
  errors: FieldError[]
}

interface FieldError {
  field: string
  message: string
  code: ErrorCode
  value?: unknown
}

type ErrorCode =
  | 'required'
  | 'min_length'
  | 'max_length'
  | 'max_count'
  | 'max_size'
  | 'invalid_format'
  | 'invalid_transition'
  | 'duplicate'
  | 'not_found'
  | 'unauthorized'
  | 'conflict'
  | 'cap_exceeded'
```

### Common Validation Rules

| Domain | Rule | Error Code |
|---|---|---|
| Passphrase | Minimum 8 characters | `min_length` |
| Room members | Maximum 20 active members | `max_count` |
| Whiteboard elements | Maximum 2,000 per room | `max_count` |
| Images | Maximum 5 MB per image | `max_size` |
| Images | Maximum 50 per room | `max_count` |
| Comments | Maximum 200 per thread | `max_count` |
| Chat messages | Retain most recent 5,000 | `max_count` |
| Pinned messages | Maximum 3 per room | `max_count` |
| Snapshots | Retain latest 48 | `max_count` |
| Backup file | Maximum 200 MB | `max_size` |
| Bulk import | Maximum 1,000 items per batch | `cap_exceeded` |
| Membership transition | Valid state machine path | `invalid_transition` |

---

## 7. Collaboration Payload Details (WebRTC DataChannel)

These payloads are used inside `CollabMessage<T>` envelopes (see section 4):

```typescript
// Element operation — create/update/delete whiteboard items
interface ElementOpPayload {
  operation: 'create' | 'update' | 'delete'
  elementId: string
  element?: WhiteboardElement
}

// Chat operation — new message, delete, pin, unpin
interface ChatOpPayload {
  operation: 'new' | 'delete' | 'pin' | 'unpin'
  messageId: string
  message?: ChatMessage
  pinned?: PinnedMessage
}

// Threaded comments — create thread or append comment
interface CommentOpPayload {
  operation: 'create-thread' | 'append-comment'
  threadId: string
  elementId: string
  thread?: CommentThread
  comment?: Comment
}

// Presence operation — cursor movement, tool selection
interface PresenceOpPayload {
  memberId: string
  roomId: string
  displayName: string
  avatarColor: string
  isOnline: boolean
  cursor: { x: number; y: number; timestamp: number } | null
  currentTool: string | null
  lastSeenAt: string
}

// Approval operation — membership state changes
interface ApprovalOpPayload {
  operation: 'request' | 'approve' | 'reject' | 'leave'
  memberId: string
  member?: MemberRecord
}

// Snapshot and rollback operations
interface SnapshotOpPayload {
  operation: 'snapshot-created'
  snapshotId: string
  sequenceNumber: number
  snapshot?: Snapshot
}

interface RollbackOpPayload {
  operation: 'rollback-applied'
  snapshotId: string
  initiatorId: string
  resultingSnapshotId: string
  snapshot?: Snapshot
}

// Sync request/response — initial state sync on peer connection
interface SyncRequestPayload {
  lastSeqNum: number
  requestedStores: string[]
}

interface SyncResponsePayload {
  data: Record<string, unknown[]>
  fromSeqNum: number
  toSeqNum: number
}
```

---

---

## 8. Session and Auth Contracts (Prompt 3)

### Session State Machine

```typescript
// src/models/profile.ts
enum SessionState {
  NoProfile         = 'no_profile',
  Locked            = 'locked',
  Active            = 'active',
  InactivityLocked  = 'inactivity_locked',
  ForcedSignOut     = 'forced_sign_out',
}
```

### LocalStorage Session Flags

| Key | Type | Written by | Purpose |
|---|---|---|---|
| `forgeroom:activeProfileId` | `string` | `session-service` | Currently active profile ID |
| `forgeroom:sessionLockAt` | `string (ISO)` | `session-service` | Inactivity lock deadline |
| `forgeroom:signOutAt` | `string (ISO)` | `session-service` | Forced sign-out deadline |

### Profile Service Interface

```typescript
// src/services/profile-service.ts

/** Create a profile + PBKDF2 verifier. Raw passphrase is never stored. */
createProfile(displayName: string, avatarColor: string, passphrase: string): Promise<Profile>

/** Load all stored profiles. */
loadProfiles(): Promise<Profile[]>

/** Verify a passphrase. Returns true/false without throwing on mismatch. */
verifyPassphrase(profileId: string, passphrase: string): Promise<boolean>

/** Update display name or avatar color. */
updateProfile(profileId: string, updates: Partial<Pick<Profile, 'displayName' | 'avatarColor'>>): Promise<Profile>

/** Delete a profile and its verifier record. */
deleteProfile(profileId: string): Promise<void>
```

### Session Service Interface

```typescript
// src/services/session-service.ts

checkSessionOnLoad(): SessionState          // read LS timestamps, infer state
writeSessionToStorage(profileId: string): void
clearSessionStorage(): void
startSessionTimers(profileId: string): void  // sets LS + starts in-memory timers
resumeSessionTimers(): void                  // resumes from stored LS deadlines
resetInactivityTimer(): void                 // extends lock deadline on activity
clearSessionTimers(): void
getRemainingSignOutMs(): number
getRemainingLockMs(): number
onSessionStateChange(cb: (state: SessionState) => void): void
```

### Session Store (`useSessionStore`)

```typescript
// src/stores/session-store.ts

// State
profiles: Profile[]
activeProfileId: string | null
sessionState: SessionState
isLoading: boolean
isSubmitting: boolean
error: string | null

// Computed
activeProfile: Profile | null
isUnlocked: boolean      // sessionState === Active
isLocked: boolean        // Locked | InactivityLocked | ForcedSignOut

// Actions
initialize(): Promise<void>           // call on app mount
createNewProfile(name, color, pass): Promise<Profile>
unlock(profileId, passphrase): Promise<boolean>
lock(): void
signOut(): void
recordActivity(): void                // call on user interaction
clearError(): void
```

### UI Store (`useUiStore`)

```typescript
// src/stores/ui-store.ts

// Toasts
addToast(message, type?, durationMs?): string
removeToast(id): void
clearToasts(): void
toast.info | success | warning | error (msg, ms?)

// Banners
addBanner(message, type?, dismissible?): string
removeBanner(id): void
clearBanners(): void

// Modal Confirmation
confirm(options: ConfirmOptions): Promise<boolean>
resolveConfirm(confirmed: boolean): void

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string   // default 'Confirm'
  cancelLabel?: string    // default 'Cancel'
  danger?: boolean        // styles confirm button red
}
```

### Route Guard API

```typescript
// src/router/guards.ts

AUTH_REQUIRED_ROUTES: Set<string>   // room-list, room-create, room-join, workspace, workspace-settings, workspace-backup

shouldAllowNavigation(
  routeName: string | null | symbol,
  sessionState: SessionState,
  redirectPath?: string
): true | { name: 'profile-select'; query: { redirect: string } }

installSessionGuard(router: Router): void
```

### Room Creation Validator

```typescript
// src/validators/room-create-validator.ts
interface RoomCreatePayload {
  name: string          // required, 1–100 chars
  description: string   // optional, max 500 chars
  settings: { requireApproval: boolean; enableSecondReviewer: boolean }
}

validateRoomCreatePayload(payload: RoomCreatePayload): ValidationResult
validateRoomName(name: string): ValidationResult
validateRoomDescription(description: string): ValidationResult
```

### Join Validator

```typescript
// src/validators/join-validator.ts
interface JoinPayload {
  pairingCode: string   // required, XXXX-XXXX format (safe charset)
  displayName: string   // required, 1–60 chars
}

validateJoinPayload(payload: JoinPayload): ValidationResult
validatePairingCode(code: string): ValidationResult
validateJoinDisplayName(name: string): ValidationResult
```

### BroadcastChannel Service Interface

```typescript
// src/services/broadcast-channel-service.ts
initBroadcastChannel(tabId: string): void
subscribeBroadcast<T>(type: BroadcastEventType, handler: (envelope: BroadcastEnvelope<T>) => void): () => void
broadcastMessage<T>(type: BroadcastEventType, payload: T, roomId?: string): void
closeBroadcastChannel(): void
isBroadcastChannelOpen(): boolean
getLocalTabId(): string
```

---

## 10. Room Engine Contracts (Prompt 4)

All engines import numeric limits from `@/models/constants` and return
`ValidationResult` on any guardable operation.

### Activity Engine

```typescript
// src/engine/activity-engine.ts
interface ActivityActor { memberId: string; displayName: string }

buildActivityEvent(
  roomId: string,
  type: ActivityEventType,
  actor: ActivityActor,
  summary: string,
  target?: { targetId?: string; targetType?: string },
  metadata?: Record<string, unknown>
): ActivityEvent

emitActivity(
  roomId: string,
  type: ActivityEventType,
  actor: ActivityActor,
  summary: string,
  target?: { targetId?: string; targetType?: string },
  metadata?: Record<string, unknown>
): Promise<ActivityEvent>

listActivity(roomId: string): Promise<ActivityEvent[]>

listActivityFiltered(
  roomId: string,
  filter: { filter?: ActivityFilter; actorId?: string; fromISO?: string; toISO?: string }
): Promise<ActivityEvent[]>
```

### Snapshot Engine

```typescript
// src/engine/snapshot-engine.ts
type SnapshotTrigger = 'autosave' | 'manual' | 'rollback'

captureSnapshot(roomId: string, trigger?: SnapshotTrigger): Promise<Snapshot>
listSnapshots(roomId: string): Promise<Snapshot[]>
rollbackTo(roomId: string, sourceSnapshotId: string, actor: ActivityActor): Promise<RollbackMetadata>
```

Rollback contract: preserves source and intermediate snapshots, creates a new
derived snapshot with the next `sequenceNumber`, trims to
`MAX_SNAPSHOTS_RETAINED` (48), and emits a `SnapshotRolledBack` activity with
`sourceSnapshotId`, `sourceSequenceNumber`, `resultingSnapshotId`, `rolledBackAt`,
and `rollbackId` metadata.

### Room Engine

```typescript
// src/engine/room-engine.ts
createRoom(draft: RoomDraft, hostProfileId: string, host: ActivityActor): Promise<RoomResult>
getRoom(roomId: string): Promise<Room | undefined>
updateRoomSettings(roomId: string, settings: Partial<RoomSettings>): Promise<RoomResult>
archiveRoom(roomId: string, actor: ActivityActor): Promise<ValidationResult>
```

### Membership Engine

```typescript
// src/engine/membership-engine.ts
interface ApprovalActor extends ActivityActor { role: RoomRole }

requestJoin(roomId: string, request: JoinRequest): Promise<MembershipResult>
approveJoin(roomId: string, memberId: string, approver: ApprovalActor): Promise<MembershipResult>
denyJoin(roomId: string, memberId: string, approver: ApprovalActor, reason?: string): Promise<MembershipResult>
leaveRoom(roomId: string, memberId: string): Promise<MembershipResult>
assertMemberCanAct(roomId: string, memberId: string): Promise<ValidationResult>
```

State transitions follow `VALID_MEMBERSHIP_TRANSITIONS`. Approval audit records
(`ApprovalRecord`) carry `approverId`, `approverRole`, `timestamp`, `action`
(`'approve' | 'reject'`), `isSecondApproval`, and optional `reason`.

### Element + Image Engines

```typescript
// src/engine/element-engine.ts
createSticky(input): Promise<ElementResult>
createArrow(input): Promise<ElementResult>
createPenStroke(input): Promise<ElementResult>
createImageElement(input): Promise<ElementResult>
updateElement(elementId: string, patch: Partial<WhiteboardElement>, actor: ActivityActor): Promise<ElementResult>
deleteElement(elementId: string, actor: ActivityActor): Promise<ElementResult>
bringToFront(elementId: string, actor: ActivityActor): Promise<ElementResult>
listElements(roomId: string): Promise<WhiteboardElement[]>

// src/engine/image-engine.ts
ingestImageFile(input: {
  roomId: string
  blob: Blob
  fileName: string
  mimeType: string
  position: Point
  dimensions: { width: number; height: number }
  actor: ActivityActor
}): Promise<{ validation: ValidationResult; element?: WhiteboardElement; imageRecord?: ImageRecord }>
```

### Comment Engine

```typescript
// src/engine/comment-engine.ts
createThread(input: CreateThreadInput): Promise<CommentResult>
appendComment(input: AppendCommentInput): Promise<CommentResult>
listComments(threadId: string): Promise<Comment[]>
resolveMentions(query: string, members: MemberRecord[], historicalIds?: ReadonlySet<string>): MentionCandidate[]
```

### Chat Engine

```typescript
// src/engine/chat-engine.ts
sendMessage(input: SendMessageInput): Promise<ChatResult>     // trims to 5,000 after put
listRecent(roomId: string): Promise<ChatMessage[]>
pinMessage(roomId: string, messageId: string, actor: ActivityActor): Promise<PinResult>  // 3-cap
unpinMessage(roomId: string, messageId: string, actor: ActivityActor): Promise<ValidationResult>
listPinned(roomId: string): Promise<PinnedMessage[]>
```

### Presence Engine (in-memory only)

```typescript
// src/engine/presence-engine.ts
setPresence(state: PresenceState): void
updateCursor(roomId: string, memberId: string, cursor: CursorPosition | null): void
setActive(roomId: string, memberId: string): void
setIdle(roomId: string, memberId: string): void
leavePresence(roomId: string, memberId: string): void
listPresent(roomId: string): PresenceState[]
subscribe(roomId: string, handler: (states: PresenceState[]) => void): () => void
resetPresence(roomId?: string): void
```

### Autosave Scheduler

```typescript
// src/engine/autosave-scheduler.ts
interface SchedulerCallbacks {
  onAutoSave: () => void | Promise<void>
  onSnapshot: () => void | Promise<void>
}

startRoomScheduler(roomId: string, callbacks: SchedulerCallbacks): void
stopRoomScheduler(roomId: string): void
stopAll(): void
isRoomSchedulerRunning(roomId: string): boolean
```

Intervals: `AUTOSAVE_INTERVAL_MS = 10_000`, `SNAPSHOT_INTERVAL_MS = 300_000`.

### Repository Query Helpers

| Repository | Helpers |
|---|---|
| `memberRepository` | `find(roomId, memberId)`, `listByRoom`, `listActiveByRoom`, `countActiveByRoom` |
| `elementRepository` | `listByRoom`, `countByRoom`, `maxZIndexByRoom` |
| `imageBlobRepository` | `listByRoom`, `countByRoom`, `sumBytesByRoom` |
| `commentThreadRepository` | `listByRoom`, `findByElement` |
| `commentRepository` | `listByThread`, `countByThread` |
| `chatMessageRepository` | `listByRoom`, `countByRoom`, `deleteOldestExcess(roomId, cap)` |
| `pinnedMessageRepository` | `listByRoom`, `countByRoom`, `find(roomId, messageId)` |
| `activityRepository` | `listByRoom`, `listFiltered` |
| `snapshotRepository` | `listByRoom`, `deleteOldestExcess(roomId, cap)` |

---

## 11. Current Status

**Prompt 6 complete.** Engine layer, repositories, thin Pinia stores, collaboration
adaptors, app shell, and primary user workflows are all implemented. All contracts
in sections 1–12 are backed by actual TypeScript in `src/`.

---

## 12. Collaboration Adaptor Contracts

### 12.1 broadcast-adaptor

```typescript
// src/services/broadcast-adaptor.ts

/** Attach BroadcastChannel subscriptions for a room. Returns cleanup fn. */
attachRoomBroadcast(roomId: string): () => void

// Broadcast helpers (call after successful local mutations):
broadcastElementChange(roomId: string, operation: 'create'|'update'|'delete', elementId: string): void
broadcastChatMessage(roomId: string, operation: 'new'|'delete', messageId: string): void
broadcastMembershipChange(roomId: string, operation: 'request'|'approve'|'reject'|'leave', memberId: string): void
broadcastPinChange(roomId: string, operation: 'pin'|'unpin', messageId: string): void
broadcastSessionLock(profileId: string, action: 'lock'|'unlock'|'sign-out'): void
```

Event dispatch table:

| Event | Store method called |
|---|---|
| `element-change` | `elementStore.loadElements(roomId)` |
| `chat-message` | `chatStore.loadChat(roomId)` |
| `pin-change` | `chatStore.loadChat(roomId)` |
| `membership-change` | `roomStore.refreshMembers()` |
| `conflict-notify` | `uiStore.addBanner(msg, 'warning', true)` |
| `session-lock` (lock) | `sessionStore.lock()` |
| `session-lock` (sign-out) | `sessionStore.signOut()` |
| `snapshot-created` | `snapshotStore.refresh(roomId)` |
| `rollback-applied` | `snapshotStore.refresh(roomId)` + `uiStore.toast.info(...)` |

### 12.2 webrtc-peer-service

```typescript
// src/services/webrtc-peer-service.ts

/** Generate a unique local peer ID. */
generatePeerId(): string

/** Create offer as initiating peer; returns encoded offer string. */
createOffer(roomId: string, localPeerId: string, localDisplayName: string): Promise<string>

/** Apply encoded offer as answering peer; returns encoded answer string. */
addRemoteOffer(encodedOffer: string, localPeerId: string, displayName: string): Promise<string>

/** Apply encoded answer from remote peer to complete connection. */
acceptAnswer(localPeerId: string, encodedAnswer: string): Promise<void>

/** Send a CollabMessage to a single peer. */
sendCollabMessage(peerId: string, msg: CollabMessage): void

/** Broadcast a CollabMessage to all connected peers. */
broadcastCollabMessage(msg: CollabMessage): void

/** Subscribe to inbound CollabMessages; returns unsubscribe fn. */
onCollabMessage(handler: (peerId: string, msg: CollabMessage) => void): () => void

/** Close a single peer connection. */
closePeer(peerId: string): void

/** Close all peer connections. */
closeAll(): void

/** List all registered peer descriptors (for tests/debugging). */
listPeers(): PeerDescriptor[]

/** Get a single peer descriptor by ID. */
getPeer(peerId: string): PeerDescriptor | undefined
```

### 12.3 webrtc-adaptor (CollabMessage dispatch table)

```typescript
// src/services/webrtc-adaptor.ts

/** Attach WebRTC inbound message dispatcher for a room. Returns cleanup fn. */
attachWebRTCAdaptor(roomId: string): () => void
```

| CollabMessage type | Inbound store action | Outbound publisher |
|---|---|---|
| `element-op` | `elementStore.loadElements(roomId)` | `publishElement(roomId, op, elementId, senderId)` |
| `chat-op` | `chatStore.loadChat(roomId)` | `publishChat(roomId, op, messageId, senderId)` / `publishPin(roomId, op, messageId, senderId)` |
| `presence-op` | `presenceStore.setSelf(state)` | `publishPresence(roomId, memberId, cursor, displayName, avatarColor, senderId)` — called by `WorkspacePage.onCursorMove` on every local `cursor-move` event |
| `approval-op` | `roomStore.refreshMembers()` | `publishMembership(roomId, op, memberId, senderId)` |
| `activity-op` | `activityStore.refresh(roomId)` | emitted by activity-engine side-effects |
| `rollback-op` | `snapshotStore.refresh(roomId)` + `elementStore.loadElements(roomId)` + toast | `publishSnapshot(roomId, snapshotId, seq, senderId)` / `publishRollback(roomId, snapshotId, initiatorId, resultingId, senderId)` |
| `conflict-op` | `uiStore.addBanner(msg, 'warning', true)` | `publishConflict(roomId, type, resourceId, tabId, message, senderId)` — called by `elementStore.updateElement` (emits `element-overwrite` when the engine reports the element no longer exists) and by `chatStore.pinMessage` (emits `pin-collision` on pin-cap or duplicate-pin rejection). `tabId` is sourced from `getLocalTabId()` in `services/broadcast-channel-service.ts`. |
| `sync-request` | send `sync-response` with current element list | — |
| `sync-response` | `elementStore.loadElements(roomId)` | — |

### 12.3.1 Collab Publisher (`src/services/collab-publisher.ts`)

Centralized write-fan-out for both multi-tab (BroadcastChannel) and LAN peer (WebRTC DataChannel) transports. Every store-side mutation calls exactly one publisher; the publisher calls both the matching `broadcast*` helper *and* `broadcastCollabMessage` with a module-local `seqNum` counter.

```typescript
publishElement(roomId: string, op: 'create' | 'update' | 'delete', elementId: string, senderId?: string): void
publishChat(roomId: string, op: 'new' | 'delete', messageId: string, senderId?: string): void
publishPin(roomId: string, op: 'pin' | 'unpin', messageId: string, senderId?: string): void
publishMembership(roomId: string, op: 'request' | 'approve' | 'reject' | 'leave', memberId: string, senderId?: string): void
publishSnapshot(roomId: string, snapshotId: string, sequenceNumber: number, senderId?: string): void
publishRollback(roomId: string, snapshotId: string, initiatorId: string, resultingSnapshotId: string, senderId?: string): void
publishConflict(roomId: string, conflictType: 'element-overwrite' | 'pin-collision' | 'membership-race' | 'rollback-collision', resourceId: string, conflictingTabId: string, message: string, senderId?: string): void
publishPresence(roomId: string, memberId: string, cursor: CursorPosition | null, displayName: string, avatarColor: string, senderId?: string): void

/** Test-only: reset the module-local seqNum counter. */
__resetSeqForTests(): void
```

The WebRTC envelope emitted by every publisher is:

```typescript
{
  type: CollabMessageType,
  senderId: string,
  timestamp: string,   // ISO-8601
  seqNum: number,      // monotonic per-tab
  roomId: string,
  payload: { operation?: string, ...resourceRefs },
}
```

Comments currently publish under `element-op` (element-anchored); the frozen `CollabMessageType` and `BroadcastPayload` unions deliberately do not include a separate `comment-op` — subscribers refresh threads via `loadThreads` triggered by the inbound `element-change`.

`publishPresence` is the only publisher with **no** BroadcastChannel counterpart — cursor presence is intentionally LAN-only. Fanning the same user's cursor across local tabs would produce phantom duplicates for the same identity, so cross-tab presence is handled via the presence engine's in-memory roster instead.

### 12.4 PairingPanel + WebRTC flow contracts

```typescript
// Host flow in PairingPanel.vue:
// 1. Click "Generate Offer" → calls createOffer → peersStore.setLocalOffer(encoded)
// 2. User copies offer to clipboard
// 3. User pastes answer → click "Connect" → calls acceptAnswer → peersStore.setPairingStep('connected')

// Guest flow in PairingPanel.vue:
// 1. User pastes host's offer → click "Generate Answer" → calls addRemoteOffer
// 2. peersStore.setLocalAnswer(encoded)
// 3. User copies answer to clipboard → sends to host out-of-band
```

Pairing step FSM (in `peers-store`):
```
idle → generating → awaiting-answer → connecting → connected
                                    ↘              ↘
                                     failed        failed
```

### 12.5 Conflict notification helpers (Prompt 7)

```typescript
// broadcast-adaptor.ts — new exported helpers

/** Notify other tabs of a write collision. */
broadcastConflictNotify(
  roomId: string,
  conflictType: 'element-overwrite' | 'pin-collision' | 'membership-race' | 'rollback-collision',
  resourceId: string,
  conflictingTabId: string,
  message: string
): void

/** Notify other tabs that a new snapshot was created. */
broadcastSnapshotCreated(roomId: string, snapshotId: string, sequenceNumber: number): void

/** Notify other tabs that a rollback was applied. */
broadcastRollbackApplied(
  roomId: string,
  snapshotId: string,
  initiatorId: string,
  resultingSnapshotId: string
): void
```

### 12.6 Backup export/import contracts (Prompt 7)

```typescript
// import-export-store.ts

exportRoom(roomId: string, exportedBy: string): Promise<void>
// Pre-checks estimated size, serializes, post-checks final size, triggers Blob download.
// Sets lastError on size violation or unexpected failure.

validateImport(file: File): Promise<ImportValidationResult | null>
// Size check → JSON parse → validateImportFile(size, parsed).
// Sets lastImportResult. Returns null on unhandled exception.

persistImport(manifest: BackupManifest): Promise<void>
// Iterates all data arrays and calls repository.put() for each row.
// Throws (and sets lastError) on repository failure.

parseManifest(file: File): Promise<BackupManifest | null>
// Reads file text → deserializeBackup(). Returns null on parse failure.

clearError(): void
// Resets lastError to null.
```

### 12.7 AutosaveIndicator status states

| Status | Meaning |
|---|---|
| `idle` | No save cycle running |
| `saving` | Autosave tick in progress (pulsing dot) |
| `saved` | Last tick completed successfully (shows time) |
| `failed` | Last tick threw an error |
