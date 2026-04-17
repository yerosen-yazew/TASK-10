// REQ: All numeric limits as named constants for the ForgeRoom collaboration workspace.
// These constants are the single source of truth for all validators and UI cap checks.

/** Maximum number of active (non-left) members in a room, including the Host. */
export const MAX_ROOM_MEMBERS = 20

/** Room population threshold at which a second Reviewer approval is required for new joiners. */
export const SECOND_REVIEWER_THRESHOLD = 15

/** Maximum number of whiteboard elements (sticky notes, arrows, pen strokes, images) per room. */
export const MAX_ELEMENTS_PER_ROOM = 2_000

/** Maximum file size for a single image in bytes (5 MB). */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

/** Maximum number of images allowed per room. */
export const MAX_IMAGES_PER_ROOM = 50

/** Maximum number of comments in a single comment thread. */
export const MAX_COMMENTS_PER_THREAD = 200

/** Maximum number of chat messages retained per room (most recent kept). */
export const MAX_CHAT_MESSAGES_RETAINED = 5_000

/** Maximum number of pinned chat messages per room. */
export const MAX_PINNED_MESSAGES = 3

/** Auto-save interval in milliseconds (10 seconds). */
export const AUTOSAVE_INTERVAL_MS = 10_000

/** Snapshot creation interval in milliseconds (5 minutes). */
export const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1_000

/** Maximum number of snapshots retained per room. */
export const MAX_SNAPSHOTS_RETAINED = 48

/** Maximum backup export file size in bytes (200 MB). */
export const MAX_BACKUP_SIZE_BYTES = 200 * 1024 * 1024

/** Maximum number of sticky notes + comments allowed per bulk import batch. */
export const MAX_BULK_IMPORT_ITEMS = 1_000

/** Minimum passphrase length in characters. */
export const MIN_PASSPHRASE_LENGTH = 8

/** Inactivity lock timeout in milliseconds (30 minutes). */
export const INACTIVITY_LOCK_MS = 30 * 60 * 1_000

/** Forced sign-out timeout in milliseconds (8 hours). */
export const FORCED_SIGNOUT_MS = 8 * 60 * 60 * 1_000

/** IndexedDB database name. */
export const DB_NAME = 'forgeroom'

/** IndexedDB database version. */
export const DB_VERSION = 1

/** BroadcastChannel name for multi-tab sync. */
export const BROADCAST_CHANNEL_NAME = 'forgeroom:sync'

/** WebRTC DataChannel label for collaboration messages. */
export const DATA_CHANNEL_LABEL = 'collab'

/** LocalStorage key prefix. */
export const LS_PREFIX = 'forgeroom:'

/** Backup file format identifier. */
export const BACKUP_FORMAT = 'forgeroom-backup-v1' as const

/** Protocol version for pairing envelopes. */
export const PAIRING_PROTOCOL_VERSION = 1
