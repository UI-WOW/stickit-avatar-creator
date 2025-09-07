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

export class UserKV {
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

  static async getGroupById(kv: KVNamespace, userId: string, groupId: string): Promise<StickerGroup | null> {
    const list = await this.listGroups(kv, userId)
    return list.find(g => g.id === groupId) ?? null
  }

  static async updateGroupName(kv: KVNamespace, userId: string, groupId: string, name: string): Promise<StickerGroup | null> {
    const list = await this.listGroups(kv, userId)
    let updated: StickerGroup | null = null
    const next = list.map(item => {
      if (item.id === groupId) {
        updated = { ...item, name }
        return updated
      }
      return item
    })
    if (!updated) return null
    await kv.put(this.userGroupsKey(userId), JSON.stringify(next))
    return updated
  }

  static async getGroupWithConfigs(
    kv: KVNamespace,
    userId: string,
    groupId: string
  ): Promise<{ group: StickerGroup | null, configs: GroupConfig[] }> {
    const group = await this.getGroupById(kv, userId, groupId)
    const configs = await this.listConfigs(kv, userId, groupId)
    return { group, configs }
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
    await kv.delete(this.groupConfigsKey(userId, groupId))
    return changed
  }
}

export class UserKVProvider {
  private kv: KVNamespace

  constructor(kv: KVNamespace) {
    this.kv = kv
  }

  listGroups(userId: string) {
    return UserKV.listGroups(this.kv, userId)
  }

  addGroup(userId: string, name: string) {
    return UserKV.addGroup(this.kv, userId, name)
  }

  listConfigs(userId: string, groupId: string) {
    return UserKV.listConfigs(this.kv, userId, groupId)
  }

  addConfig(userId: string, groupId: string, input: Record<string, unknown>, imageUrls?: string[]) {
    return UserKV.addConfig(this.kv, userId, groupId, input, imageUrls)
  }

  deleteGroup(userId: string, groupId: string) {
    return UserKV.deleteGroup(this.kv, userId, groupId)
  }

  getGroupWithConfigs(userId: string, groupId: string) {
    return UserKV.getGroupWithConfigs(this.kv, userId, groupId)
  }

  getGroupById(userId: string, groupId: string) {
    return UserKV.getGroupById(this.kv, userId, groupId)
  }

  updateGroupName(userId: string, groupId: string, name: string) {
    return UserKV.updateGroupName(this.kv, userId, groupId, name)
  }
}


