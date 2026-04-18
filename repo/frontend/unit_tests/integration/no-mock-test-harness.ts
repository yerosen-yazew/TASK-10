import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '@/router'
import { DB_NAME } from '@/models/constants'
import { closeAll } from '@/services/webrtc-peer-service'
import { closeBroadcastChannel } from '@/services/broadcast-channel-service'
import { createProfile } from '@/services/profile-service'
import { createRoom } from '@/engine/room-engine'
import { useSessionStore } from '@/stores/session-store'
import { RoomRole } from '@/models/room'

export async function resetDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

export async function setupNoMockTestEnv(): Promise<void> {
  setActivePinia(createPinia())
  closeAll()
  closeBroadcastChannel()
  localStorage.clear()
  await resetDb()
}

export function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  })
}

export async function seedActiveSessionProfile(overrides?: {
  displayName?: string
  avatarColor?: string
  passphrase?: string
}) {
  const profile = await createProfile(
    overrides?.displayName ?? 'NoMock User',
    overrides?.avatarColor ?? '#0ea5e9',
    overrides?.passphrase ?? 'Password123!'
  )

  const session = useSessionStore()
  session.activeProfileId = profile.profileId
  session.sessionState = 'active' as any
  session.profiles = [profile] as any

  return profile
}

export async function seedActiveHostRoom(overrides?: {
  name?: string
  description?: string
  requireApproval?: boolean
  enableSecondReviewer?: boolean
  hostName?: string
  hostColor?: string
  passphrase?: string
}) {
  const host = await createProfile(
    overrides?.hostName ?? 'NoMock Host',
    overrides?.hostColor ?? '#2563eb',
    overrides?.passphrase ?? 'Password123!'
  )

  const createResult = await createRoom({
    name: overrides?.name ?? 'NoMock Room',
    description: overrides?.description ?? 'NoMock integration room',
    hostProfileId: host.profileId,
    hostDisplayName: host.displayName,
    hostAvatarColor: host.avatarColor,
    settings: {
      requireApproval: overrides?.requireApproval ?? false,
      enableSecondReviewer: overrides?.enableSecondReviewer ?? false,
    },
  })

  if (!createResult.room) {
    throw new Error('Failed to seed room in no-mock harness.')
  }

  const session = useSessionStore()
  session.activeProfileId = host.profileId
  session.sessionState = 'active' as any
  session.profiles = [host] as any

  return {
    room: createResult.room,
    host,
    actor: {
      memberId: host.profileId,
      displayName: host.displayName,
      role: RoomRole.Host,
    },
  }
}
