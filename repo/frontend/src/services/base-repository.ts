// REQ: R14 — Generic IndexedDB repository base pattern
// All domain repositories extend this to share consistent CRUD and query operations.

import { openDatabase } from './db-schema'

/**
 * Generic IndexedDB repository.
 * K is the primary key type (string by default, or tuple for compound keys).
 */
export abstract class BaseRepository<T, K = string> {
  protected abstract readonly storeName: string

  /** Open the database (cached by the openDatabase implementation). */
  protected async getDb(): Promise<IDBDatabase> {
    return openDatabase()
  }

  /** Retrieve a single record by primary key. */
  async getById(key: K): Promise<T | undefined> {
    const db = await this.getDb()
    return new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      const req = store.get(key as IDBValidKey)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
  }

  /** Retrieve all records in the store. */
  async getAll(): Promise<T[]> {
    const db = await this.getDb()
    return new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result as T[])
      req.onerror = () => reject(req.error)
    })
  }

  /** Insert or update a record (upsert). */
  async put(item: T): Promise<void> {
    const db = await this.getDb()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const req = store.put(item)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  /** Delete a record by primary key. */
  async delete(key: K): Promise<void> {
    const db = await this.getDb()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const req = store.delete(key as IDBValidKey)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  /** Query records by an index. */
  async query(indexName: string, value: IDBValidKey): Promise<T[]> {
    const db = await this.getDb()
    return new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      const index = store.index(indexName)
      const req = index.getAll(value)
      req.onsuccess = () => resolve(req.result as T[])
      req.onerror = () => reject(req.error)
    })
  }

  /** Count records, optionally filtered by an index value. */
  async count(indexName?: string, value?: IDBValidKey): Promise<number> {
    const db = await this.getDb()
    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      let req: IDBRequest<number>
      if (indexName !== undefined && value !== undefined) {
        req = store.index(indexName).count(value)
      } else {
        req = store.count()
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  /** Clear all records in the store. */
  async clear(): Promise<void> {
    const db = await this.getDb()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}
