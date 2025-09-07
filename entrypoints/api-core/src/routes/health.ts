import { Hono } from 'hono'
import type { honoContext } from '../index.js'

export function setupHealthRoutes(app: Hono<honoContext>) {
  // Health check
  app.get('/', (c) => {
    return c.text('Hello from the STICKIT AVATAR CREATOR App from Stickit')
  })

  // Health check endpoint for the Python service
  app.get('/python-health', async (c) => {
    try {
      const pythonServiceUrl = c.env.PNG_TO_STICKER_URL
      if (!pythonServiceUrl) {
        return c.json({ 
          error: 'Python service URL not configured', 
          details: 'PNG_TO_STICKER_URL environment variable is missing'
        }, 500)
      }
      
      console.log(`Checking Python service health at: ${pythonServiceUrl}`)
      
      const response = await fetch(`${pythonServiceUrl}/`)
      
      if (!response.ok) {
        return c.json({ 
          status: 'error', 
          message: 'Python service is not responding',
          statusCode: response.status,
          url: pythonServiceUrl
        }, 503)
      }
      
      const data = await response.json()
      return c.json({
        status: 'healthy',
        pythonService: data,
        url: pythonServiceUrl,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      return c.json({ 
        status: 'error', 
        message: 'Cannot connect to Python service',
        url: c.env.PNG_TO_STICKER_URL,
        error: error instanceof Error ? error.message : String(error)
      }, 503)
    }
  })
}
