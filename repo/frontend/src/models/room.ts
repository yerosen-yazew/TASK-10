// REQ: R1 — Host creates Room, up to 20 participants
// REQ: R3 — Configurable request→approval→active→leave flow
// REQ: R4 — Optional second Reviewer approval at 15+
// REQ: R11 — Roles as UI personas only (not a security boundary)

/**
 * Room roles are UI personas that change visible actions and menus.
 * They are NOT a security boundary — all enforcement is convenience-only.
 */
export enum RoomRole {
  Host = 'host',
  Reviewer = 'reviewer',
  Participant = 'participant',
  Guest = 'guest',
}

/** Membership state machine states. */
export enum MembershipState {
  /** Join request submitted, awaiting approval. */
  Requested = 'requested',
  /** First approval granted; awaiting second reviewer (only when room is at 15+ and dual-approval enabled). */
  PendingSecondApproval = 'pending_second_approval',
  /** Fully approved and active in the room. */
  Active = 'active',
  /** Member has left the room. */
  Left = 'left',
  /** Join request was rejected. */
  Rejected = 'rejected',
}

/**
 * Valid state transitions for the membership state machine.
 * Key: current state. Value: set of allowed next states.
 */
export const VALID_MEMBERSHIP_TRANSITIONS: Record<MembershipState, MembershipState[]> = {
  [MembershipState.Requested]: [
    MembershipState.Active,                  // direct approval (no dual-approval)
    MembershipState.PendingSecondApproval,   // first approval when dual-approval is active
    MembershipState.Rejected,                // host/reviewer rejects
  ],
  [MembershipState.PendingSecondApproval]: [
    MembershipState.Active,                  // second reviewer approves
    MembershipState.Rejected,                // second reviewer rejects
  ],
  [MembershipState.Active]: [
    MembershipState.Left,                    // member leaves
  ],
  [MembershipState.Left]: [],                // terminal — no transitions from left
  [MembershipState.Rejected]: [],            // terminal — no transitions from rejected
}

/** Room configuration and settings. */
export interface RoomSettings {
  /** Whether new joiners require Host approval. */
  requireApproval: boolean
  /** Whether a second Reviewer approval is required when room has 15+ members. */
  enableSecondReviewer: boolean
}

/** A collaboration room. */
export interface Room {
  roomId: string
  name: string
  description: string
  hostProfileId: string
  pairingCode: string         // short code for joining (e.g., "FORGE-A1B2")
  settings: RoomSettings
  createdAt: string           // ISO 8601
  updatedAt: string           // ISO 8601
}

/** A member's record within a room. */
export interface MemberRecord {
  roomId: string
  memberId: string            // matches profileId
  displayName: string
  avatarColor: string
  role: RoomRole
  state: MembershipState
  joinedAt: string            // ISO 8601 — when request was submitted
  stateChangedAt: string      // ISO 8601 — last state transition
  approvals: ApprovalRecord[]
}

/** A join request (the initial submission before approval). */
export interface JoinRequest {
  roomId: string
  requesterId: string
  displayName: string
  avatarColor: string
  requestedRole: RoomRole
  requestedAt: string         // ISO 8601
  pairingCode: string         // the code used to join
}

/** An approval action record for audit. */
export interface ApprovalRecord {
  approverId: string
  approverDisplayName: string
  approverRole: RoomRole
  action: 'approve' | 'reject'
  timestamp: string           // ISO 8601
  isSecondApproval: boolean
}
