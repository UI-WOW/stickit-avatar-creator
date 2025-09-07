export type StickerCollection = {
  id: string
  name: string
  createdAt: string
}

export type CollectionConfig = {
  id: string
  collectionId: string
  input: Record<string, unknown>
  imageUrls?: string[]
  createdAt: string
}

export class KvService {
  static userCollectionsKey(userId: string) {
    return `user:${userId}:collections`
  }

  static collectionConfigsKey(userId: string, collectionId: string) {
    return `user:${userId}:collection:${collectionId}:configs`
  }

  static async listCollections(kv: KVNamespace, userId: string): Promise<StickerCollection[]> {
    const raw = await kv.get(this.userCollectionsKey(userId))
    if (!raw) return []
    try { return JSON.parse(raw) as StickerCollection[] } catch { return [] }
  }

  static async addCollection(kv: KVNamespace, userId: string, name: string): Promise<StickerCollection> {
    const list = await this.listCollections(kv, userId)
    const id = crypto.randomUUID()
    const item: StickerCollection = { id, name, createdAt: new Date().toISOString() }
    await kv.put(this.userCollectionsKey(userId), JSON.stringify([item, ...list]))
    return item
  }

  static async listConfigs(kv: KVNamespace, userId: string, collectionId: string): Promise<CollectionConfig[]> {
    const raw = await kv.get(this.collectionConfigsKey(userId, collectionId))
    if (!raw) return []
    try { return JSON.parse(raw) as CollectionConfig[] } catch { return [] }
  }

  static async addConfig(
    kv: KVNamespace,
    userId: string,
    collectionId: string,
    input: Record<string, unknown>,
    imageUrls?: string[]
  ): Promise<CollectionConfig> {
    const list = await this.listConfigs(kv, userId, collectionId)
    const id = crypto.randomUUID()
    const item: CollectionConfig = { id, collectionId, input, imageUrls, createdAt: new Date().toISOString() }
    await kv.put(this.collectionConfigsKey(userId, collectionId), JSON.stringify([item, ...list]))
    return item
  }

  static async deleteCollection(kv: KVNamespace, userId: string, collectionId: string): Promise<boolean> {
    const list = await this.listCollections(kv, userId)
    const next = list.filter(c => c.id !== collectionId)
    const changed = next.length !== list.length
    if (changed) {
      await kv.put(this.userCollectionsKey(userId), JSON.stringify(next))
    }
    // also remove its configs key
    await kv.delete(this.collectionConfigsKey(userId, collectionId))
    return changed
  }
}


