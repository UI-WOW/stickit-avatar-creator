import { Hono } from 'hono'
import type { honoContext } from '../index.js'

export function setupReferenceImageRoutes(app: Hono<honoContext>) {
  app.post('/reference-images', async (c) => {
    try {
      const userId = c.get('userId') as string | undefined
      if (!userId) return c.json({ error: 'missing session cookie sticket-sid' }, 400)
      
      const formData = await c.req.formData()
      const file = formData.get('image') as File
      
      if (!file) {
        return c.json({ error: 'No image file provided' }, 400)
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml']
      if (!allowedTypes.includes(file.type)) {
        return c.json({ error: 'Invalid file type. Only JPG, PNG, and SVG are allowed' }, 400)
      }
      
      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        return c.json({ error: 'File too large. Maximum size is 10MB' }, 400)
      }
      
      // Generate unique filename
      const timestamp = Date.now()
      const fileExtension = file.name.split('.').pop() || 'jpg'
      const filename = `ref-images/${userId}/${timestamp}-${Math.random().toString(36).substring(2)}.${fileExtension}`
      
      // Upload to R2
      const arrayBuffer = await file.arrayBuffer()
      await c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR.put(filename, arrayBuffer, {
        httpMetadata: {
          contentType: file.type
        }
      })
      
      // Get public URL - point directly to API server with query parameter
      const publicUrl = `https://stickit-avatar-creator-api.ui-wow-enabler-account.workers.dev/reference-images?filePath=${encodeURIComponent(filename)}`
      
      return c.json({
        success: true,
        filename,
        url: publicUrl,
        size: file.size,
        type: file.type
      })
      
    } catch (error) {
      console.error('Error uploading reference image:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return c.json({ 
        error: 'Failed to upload image', 
        details: errorMessage
      }, 500)
    }
  })

  app.get('/reference-images', async (c) => {
    try {
      const filePath = c.req.query('filePath')
      
      console.log('Image request filePath:', filePath)
      console.log('Full URL:', c.req.url)
      
      if (!filePath) {
        return c.json({ error: 'filePath parameter is required' }, 400)
      }
      
      const image = await c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR.get(filePath)
      if (!image) {
        return c.json({ error: 'Image not found' }, 404)
      }
      
      const arrayBuffer = await image.arrayBuffer()
      const contentType = image.httpMetadata?.contentType || 'image/jpeg'
      
      return new Response(arrayBuffer, {
        headers: { 
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${filePath.split('/').pop()}"`,
          'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
        }
      })
      
    } catch (error) {
      console.error('Error retrieving reference image:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return c.json({ 
        error: 'Failed to retrieve image', 
        details: errorMessage
      }, 500)
    }
  })

  app.delete('/reference-images', async (c) => {
    try {
      const userId = c.get('userId') as string | undefined
      if (!userId) return c.json({ error: 'missing session cookie sticket-sid' }, 400)
      
      const filePath = c.req.query('filePath')
      
      if (!filePath) {
        return c.json({ error: 'filePath parameter is required' }, 400)
      }
      
      // Verify the file belongs to the user (security check)
      if (!filePath.startsWith(`ref-images/${userId}/`)) {
        return c.json({ error: 'Unauthorized to delete this image' }, 403)
      }
      
      await c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR.delete(filePath)
      
      return c.json({ success: true, message: 'Image deleted successfully' })
      
    } catch (error) {
      console.error('Error deleting reference image:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return c.json({ 
        error: 'Failed to delete image', 
        details: errorMessage
      }, 500)
    }
  })
}
