// REQ: R14 — IndexedDB schema bootstrap creates expected stores/indexes and connection lifecycle

import { beforeEach, describe, expect, it } from 'vitest'
import {
  STORE_DEFINITIONS,
  closeDatabaseConnection,
  openDatabase,
} from '@/services/db-schema'
import { DB_NAME } from '@/models/constants'

async function resetDb() {
  await closeDatabaseConnection()
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

describe('db-schema', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('creates all configured object stores', async () => {
    const db = await openDatabase()
    const actual = Array.from(db.objectStoreNames).sort()
    const expected = STORE_DEFINITIONS.map((d) => d.name).sort()

    expect(actual).toEqual(expected)
  })

  it('creates all configured indexes for each object store', async () => {
    const db = await openDatabase()

    for (const def of STORE_DEFINITIONS) {
      const tx = db.transaction(def.name, 'readonly')
      const store = tx.objectStore(def.name)
      const actualIndexes = Array.from(store.indexNames).sort()
      const expectedIndexes = def.indexes.map((idx) => idx.name).sort()

      expect(actualIndexes).toEqual(expectedIndexes)
    }
  })

  it('reuses the same DB instance while connection remains open', async () => {
    const first = await openDatabase()
    const second = await openDatabase()

    expect(second).toBe(first)
  })

  it('closeDatabaseConnection clears the cached connection so openDatabase can reopen', async () => {
    const first = await openDatabase()

    await closeDatabaseConnection()

    const reopened = await openDatabase()
    expect(reopened).not.toBe(first)
  })
})
