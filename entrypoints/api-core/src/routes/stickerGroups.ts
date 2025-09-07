import { Hono } from 'hono'
import type { GroupConfigInput } from '../services/index.js'
import type { honoContext } from '../index.js'

export function setupStickerGroupRoutes(app: Hono<honoContext>) {
  // Simple KV-backed user collections and configs using session cookie as user id

  app.get('/sticker-groups', async (c) => {
    const userId = c.get('userId') as string | undefined
    if (!userId) return c.json({ error: 'missing session cookie sticket-sid' }, 400)
    const uid = userId as string
    const items = await c.get('userKV').listGroups(uid)
    console.log('[GET /sticker-groups]', { userId, count: items.length })
    c.header('X-Session-Id', uid)
    return c.json({ items })
  })

  app.post('/sticker-groups', async (c) => {
    const userId = c.get('userId') as string | undefined
    if (!userId) return c.json({ error: 'missing session cookie sticket-sid' }, 400)
    const uid = userId as string
    const body = await c.req.json().catch(() => ({}))
    const name = body?.name || 'Untitled'
    const item = await c.get('userKV').addGroup(uid, name)
    console.log('[POST /sticker-groups]', { userId: uid, item })
    c.header('X-Session-Id', uid)
    return c.json(item, 201)
  })

  app.get('/sticker-groups/:id', async (c) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const userId = c.get('userId') as string | undefined
    if (!userId) return c.json({ error: 'missing session cookie sticket-sid' }, 400)
    const uid = userId as string
    const groupId = c.req.param('id')
    const { group, configs } = await c.get('userKV').getGroupWithConfigs(uid, groupId)
    if (!group) return c.json({ error: 'not found' }, 404)
    const latest = Array.isArray(configs) ? configs[0] : undefined
    return c.json({ id: group.id, name: group.name, createdAt: group.createdAt, input: latest?.input || {} })
  })

  app.post('/sticker-groups/:id', async (c) => {
    const userId = c.get('userId') as string | undefined
    if (!userId) return c.json({ error: 'missing session cookie sticket-sid' }, 400)
    const uid = userId as string
    const groupId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const name: string | undefined = body?.name
    const input: GroupConfigInput | undefined = body?.input
    const imageUrls: string[] | undefined = Array.isArray(body?.imageUrls) ? body.imageUrls : undefined

    let updated: any = null
    if (typeof name === 'string' && name.length > 0) {
      updated = await c.get('userKV').updateGroupName(uid, groupId, name)
      if (!updated) return c.json({ error: 'not found' }, 404)
    } else {
      updated = await c.get('userKV').getGroupById(uid, groupId)
      if (!updated) return c.json({ error: 'not found' }, 404)
    }

    // If input or imageUrls present, overwrite latest config (single-version)
    if (input || imageUrls) {
      await c.get('userKV').addConfig(uid, groupId, (input ?? {}), imageUrls)
    }

    const { group, configs } = await c.get('userKV').getGroupWithConfigs(uid, groupId)
    const latest = Array.isArray(configs) ? configs[0] : undefined
    return c.json({ id: group!.id, name: group!.name, createdAt: group!.createdAt, input: latest?.input || {} })
  })

  // Deprecated: configs endpoints removed; use GET/POST /sticker-groups/:id instead

  app.delete('/sticker-groups/:id', async (c) => {
    const userId = c.get('userId') as string | undefined
    if (!userId) return c.json({ error: 'missing session cookie sticket-sid' }, 400)
    const uid = userId as string
    const groupId = c.req.param('id')
    const deleted = await c.get('userKV').deleteGroup(uid, groupId)
    if (!deleted) return c.json({ success: false, message: 'not found' }, 404)
    return c.json({ success: true })
  })
}
