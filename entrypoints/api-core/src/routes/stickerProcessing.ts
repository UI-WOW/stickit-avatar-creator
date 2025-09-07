import { Hono } from 'hono'
import { StickerService } from '../services/index.js'
import type { honoContext } from '../index.js'

export function setupStickerProcessingRoutes(app: Hono<honoContext>) {
  app.get('/generate-sticker', async (c) => {
    try {
      const imageUrl = c.req.query('imageUrl')
      if (!imageUrl) {
        return c.json({ error: 'imageUrl parameter is required' }, 400)
      }
      
      // Check if Python service URL is configured
      const pythonServiceUrl = c.env.PNG_TO_STICKER_URL
      if (!pythonServiceUrl) {
        return c.json({ 
          error: 'Python service URL not configured', 
          details: 'PNG_TO_STICKER_URL environment variable is missing'
        }, 500)
      }
      
      // Process the image using Python service by URL and proxy the response directly
      const pythonResponse = await StickerService.processImageFromUrl(
        imageUrl,
        pythonServiceUrl
      )
      
      return pythonResponse
      
    } catch (error) {
      console.error('Error in generate-sticker:', error)
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      return c.json({ 
        error: 'Failed to generate sticker', 
        details: errorMessage
      }, 500)
    }
  })

  // Route to get the generated sticker
  app.get('/get-sticker', async (c) => {
    try {
      const filename = c.req.query('filename')
      
      if (!filename) {
        return c.json({ error: 'filename parameter is required' }, 400)
      }
      
      return await StickerService.getSticker(filename, c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR)
      
    } catch (error) {
      console.error('Error in get-sticker:', error)
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      return c.json({ 
        error: 'Failed to get sticker', 
        details: errorMessage
      }, 404)
    }
  })
}
