// REQ: R14 — Generic IndexedDB repository CRUD + index queries

import { describe, it, expect, beforeEach } from 'vitest'
import { BaseRepository } from '@/services/base-repository'
import { DB_NAME } from '@/models/constants'

interface Widget {
  widgetId: string
  roomId: string
  value: number
}

class WidgetRepo extends BaseRepository<Widget, string> {
  protected readonly storeName = 'rooms' // reuse an existing store schema for the widget shape
}

async function resetDb() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

describe('BaseRepository (CRUD on rooms store)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('put + getById roundtrips a single record', async () => {
    const repo = new WidgetRepo()
    const item: any = {
      roomId: 'r1',
      name: 'Room One',
      description: '',
      hostProfileId: 'p1',
      pairingCode: 'XXXX-XXXX',
      settings: { requireApproval: false, enableSecondReviewer: false },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    await repo.put(item as any)
    const got = await repo.getById('r1')
    expect(got).toBeDefined()
    expect((got as any).roomId).toBe('r1')
  })

  it('getById returns undefined for missing records', async () => {
    const repo = new WidgetRepo()
    expect(await repo.getById('missing')).toBeUndefined()
  })

  it('getAll returns every stored record', async () => {
    const repo = new WidgetRepo()
    for (const id of ['a', 'b', 'c']) {
      await repo.put({
        roomId: id,
        name: id,
        description: '',
        hostProfileId: 'p1',
        pairingCode: 'AAAA-BBBB',
        settings: { requireApproval: false, enableSecondReviewer: false },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as any)
    }
    const all = await repo.getAll()
    expect(all.map((r: any) => r.roomId).sort()).toEqual(['a', 'b', 'c'])
  })

  it('delete removes a record', async () => {
    const repo = new WidgetRepo()
    await repo.put({
      roomId: 'del',
      name: 'del',
      description: '',
      hostProfileId: 'p1',
      pairingCode: 'AAAA-BBBB',
      settings: { requireApproval: false, enableSecondReviewer: false },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as any)
    await repo.delete('del')
    expect(await repo.getById('del')).toBeUndefined()
  })

  it('count without an index returns total row count', async () => {
    const repo = new WidgetRepo()
    expect(await repo.count()).toBe(0)
    await repo.put({
      roomId: 'c1',
      name: 'c1',
      description: '',
      hostProfileId: 'p1',
      pairingCode: 'AAAA-BBBB',
      settings: { requireApproval: false, enableSecondReviewer: false },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as any)
    expect(await repo.count()).toBe(1)
  })

  it('clear empties the store', async () => {
    const repo = new WidgetRepo()
    await repo.put({
      roomId: 'k1',
      name: 'k1',
      description: '',
      hostProfileId: 'p1',
      pairingCode: 'AAAA-BBBB',
      settings: { requireApproval: false, enableSecondReviewer: false },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as any)
    await repo.clear()
    expect(await repo.getAll()).toEqual([])
  })

  it('put overwrites on the same primary key', async () => {
    const repo = new WidgetRepo()
    const base: any = {
      roomId: 'same',
      name: 'first',
      description: '',
      hostProfileId: 'p1',
      pairingCode: 'AAAA-BBBB',
      settings: { requireApproval: false, enableSecondReviewer: false },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    await repo.put(base)
    await repo.put({ ...base, name: 'second' })
    const got = (await repo.getById('same')) as any
    expect(got.name).toBe('second')
  })
})
