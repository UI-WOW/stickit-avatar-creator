export type StickerGroup = {
  id: string
  name: string
  createdAt: string
}

export type GroupConfig = {
  id: string
  groupId: string
  input: Record<string, unknown>
  imageUrls?: string[]
  createdAt: string
}

export class KvService {
  static userGroupsKey(userId: string) {
    return `user:${userId}:groups`
  }

  static groupConfigsKey(userId: string, groupId: string) {
    return `user:${userId}:group:${groupId}:configs`
  }

  static async listGroups(kv: KVNamespace, userId: string): Promise<StickerGroup[]> {
    const raw = await kv.get(this.userGroupsKey(userId))
    if (!raw) return []
    try { return JSON.parse(raw) as StickerGroup[] } catch { return [] }
  }

  static async addGroup(kv: KVNamespace, userId: string, name: string): Promise<StickerGroup> {
    const list = await this.listGroups(kv, userId)
    const id = crypto.randomUUID()
    const item: StickerGroup = { id, name, createdAt: new Date().toISOString() }
    await kv.put(this.userGroupsKey(userId), JSON.stringify([item, ...list]))
    return item
  }

  static async listConfigs(kv: KVNamespace, userId: string, groupId: string): Promise<GroupConfig[]> {
    const raw = await kv.get(this.groupConfigsKey(userId, groupId))
    if (!raw) return []
    try { return JSON.parse(raw) as GroupConfig[] } catch { return [] }
  }

  static async addConfig(
    kv: KVNamespace,
    userId: string,
    groupId: string,
    input: Record<string, unknown>,
    imageUrls?: string[]
  ): Promise<GroupConfig> {
    const list = await this.listConfigs(kv, userId, groupId)
    const id = crypto.randomUUID()
    const item: GroupConfig = { id, groupId, input, imageUrls, createdAt: new Date().toISOString() }
    await kv.put(this.groupConfigsKey(userId, groupId), JSON.stringify([item, ...list]))
    return item
  }

  static async deleteGroup(kv: KVNamespace, userId: string, groupId: string): Promise<boolean> {
    const list = await this.listGroups(kv, userId)
    const next = list.filter(c => c.id !== groupId)
    const changed = next.length !== list.length
    if (changed) {
      await kv.put(this.userGroupsKey(userId), JSON.stringify(next))
    }
    // also remove its configs key
    await kv.delete(this.groupConfigsKey(userId, groupId))
    return changed
  }
}


