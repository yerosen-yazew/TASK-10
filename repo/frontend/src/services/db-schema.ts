// REQ: R14 — IndexedDB persistence for room data
// Defines all object stores, key paths, indexes, and the upgrade handler.

import { DB_NAME, DB_VERSION } from '@/models/constants'

let dbPromise: Promise<IDBDatabase> | null = null

/** Object store definitions for the ForgeRoom IndexedDB database. */
export interface StoreDefinition {
  name: string
  keyPath: string | string[]
  autoIncrement?: boolean
  indexes: Array<{
    name: string
    keyPath: string | string[]
    options?: IDBIndexParameters
  }>
}

export const STORE_DEFINITIONS: StoreDefinition[] = [
  {
    name: 'profiles',
    keyPath: 'profileId',
    indexes: [
      { name: 'by-displayName', keyPath: 'displayName' },
    ],
  },
  {
    name: 'passphraseVerifiers',
    keyPath: 'profileId',
    indexes: [],
  },
  {
    name: 'rooms',
    keyPath: 'roomId',
    indexes: [
      { name: 'by-createdAt', keyPath: 'createdAt' },
    ],
  },
  {
    name: 'members',
    keyPath: ['roomId', 'memberId'],
    indexes: [
      { name: 'by-roomId', keyPath: 'roomId' },
      { name: 'by-state', keyPath: 'state' },
      { name: 'by-roomId-state', keyPath: ['roomId', 'state'] },
    ],
  },
  {
    name: 'elements',
    keyPath: 'elementId',
    indexes: [
      { name: 'by-roomId', keyPath: 'roomId' },
      { name: 'by-type', keyPath: 'type' },
      { name: 'by-roomId-type', keyPath: ['roomId', 'type'] },
      { name: 'by-zIndex', keyPath: 'zIndex' },
    ],
  },
  {
    name: 'images',
    keyPath: 'imageId',
    indexes: [
      { name: 'by-roomId', keyPath: 'roomId' },
      { name: 'by-elementId', keyPath: 'elementId' },
    ],
  },
  {
    name: 'commentThreads',
    keyPath: 'threadId',
    indexes: [
      { name: 'by-roomId', keyPath: 'roomId' },
      { name: 'by-elementId', keyPath: 'elementId' },
      { name: 'by-roomId-elementId', keyPath: ['roomId', 'elementId'] },
    ],
  },
  {
    name: 'comments',
    keyPath: 'commentId',
    indexes: [
      { name: 'by-threadId', keyPath: 'threadId' },
      { name: 'by-roomId', keyPath: 'roomId' },
      { name: 'by-roomId-elementId', keyPath: ['roomId', 'elementId'] },
    ],
  },
  {
    name: 'chatMessages',
    keyPath: 'messageId',
    indexes: [
      { name: 'by-roomId', keyPath: 'roomId' },
      { name: 'by-createdAt', keyPath: 'createdAt' },
      { name: 'by-roomId-createdAt', keyPath: ['roomId', 'createdAt'] },
    ],
  },
  {
    name: 'pinnedMessages',
    keyPath: ['roomId', 'messageId'],
    indexes: [
      { name: 'by-roomId', keyPath: 'roomId' },
    ],
  },
  {
    name: 'activityFeed',
    keyPath: 'eventId',
    indexes: [
      { name: 'by-roomId', keyPath: 'roomId' },
      { name: 'by-type', keyPath: 'type' },
      { name: 'by-createdAt', keyPath: 'createdAt' },
      { name: 'by-roomId-createdAt', keyPath: ['roomId', 'createdAt'] },
    ],
  },
  {
    name: 'snapshots',
    keyPath: 'snapshotId',
    indexes: [
      { name: 'by-roomId', keyPath: 'roomId' },
      { name: 'by-createdAt', keyPath: 'createdAt' },
      { name: 'by-roomId-createdAt', keyPath: ['roomId', 'createdAt'] },
      { name: 'by-sequenceNumber', keyPath: 'sequenceNumber' },
    ],
  },
  {
    name: 'importManifests',
    keyPath: 'manifestId',
    indexes: [
      { name: 'by-roomId', keyPath: 'roomId' },
      { name: 'by-createdAt', keyPath: 'createdAt' },
    ],
  },
]

/**
 * Open (or create/upgrade) the ForgeRoom IndexedDB database.
 * Returns a promise that resolves to the database instance.
 */
export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      for (const storeDef of STORE_DEFINITIONS) {
        if (!db.objectStoreNames.contains(storeDef.name)) {
          const store = db.createObjectStore(storeDef.name, {
            keyPath: storeDef.keyPath,
            autoIncrement: storeDef.autoIncrement,
          })

          for (const indexDef of storeDef.indexes) {
            store.createIndex(indexDef.name, indexDef.keyPath, indexDef.options)
          }
        }
      }
    }

    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }
  })

  return dbPromise
}

/**
 * Close the currently open IndexedDB connection, if any.
 * Primarily used by tests before deleteDatabase().
 */
export async function closeDatabaseConnection(): Promise<void> {
  if (!dbPromise) return
  try {
    const db = await dbPromise
    db.close()
  } finally {
    dbPromise = null
  }
}
