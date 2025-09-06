import type { Context, Next } from 'hono'

/**
 * Middleware factory to log and save all incoming requests to R2 storage
 * Saves requests organized by path structure
 * 
 * @param r2Binding - The R2 bucket binding to save logs to
 * @returns A Hono middleware function
 * 
 * Usage:
 * ```typescript
 * const requestLoggerMiddleware = createRequestLoggerMiddleware(c.env.MY_R2_BINDING);
 * app.use('*', requestLoggerMiddleware);
 * ```
 */
export function createRequestLoggerMiddleware(r2Binding: R2Bucket) {
  return async function requestLoggerMiddleware(c: Context, next: Next) {
  const startTime = Date.now()
  
  try {
    // Capture request details before processing
    const requestDetails = await captureRequestDetails(c)
    
    // Continue with the request processing
    await next()
    
    // Capture response details after processing
    const responseDetails = captureResponseDetails(c, startTime)
    
    // Combine request and response details
    const logEntry = {
      id: generateShortId(), // Add unique ID for this log entry
      ...requestDetails,
      response: responseDetails
    }
    
    // Save to R2 in background
    c.executionCtx.waitUntil(saveRequestLog(r2Binding, logEntry))
    
  } catch (error) {
    // Even if there's an error, try to log the request
    try {
      const requestDetails = await captureRequestDetails(c)
      const errorDetails = {
        id: generateShortId(), // Add unique ID for this error log entry
        ...requestDetails,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        }
      }
      
      c.executionCtx.waitUntil(saveRequestLog(r2Binding, errorDetails))
    } catch (logError) {
      console.error('Failed to log request after error:', logError)
    }
    
    throw error
  }
  }
}

/**
 * Capture comprehensive request details
 */
async function captureRequestDetails(c: Context) {
  const now = new Date()
  const url = new URL(c.req.url)
  
  // Try to get request body, but handle different content types gracefully
  let requestBody: any = null
  try {
    const contentType = c.req.header('content-type') || ''
    
    if (contentType.includes('application/json')) {
      requestBody = await c.req.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      requestBody = await c.req.parseBody()
    } else if (contentType.includes('text/')) {
      requestBody = await c.req.text()
    } else if (contentType.includes('multipart/form-data')) {
      requestBody = await c.req.parseBody()
    } else {
      // For other content types, try to get as text
      try {
        requestBody = await c.req.text()
      } catch {
        requestBody = '[Binary or unsupported content type]'
      }
    }
  } catch (error) {
    requestBody = `[Error reading body: ${error instanceof Error ? error.message : String(error)}]`
  }
  
  return {
    request: {
      method: c.req.method,
      url: c.req.url,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      body: requestBody,
      timestamp: now.toISOString(),
      userAgent: c.req.header('user-agent'),
      referer: c.req.header('referer'),
      origin: c.req.header('origin'),
      host: c.req.header('host'),
      // Cloudflare-specific data
      cf: c.req.raw.cf,
      ip: c.req.raw.cf?.connectingIp || c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      // Additional useful headers
      accept: c.req.header('accept'),
      acceptLanguage: c.req.header('accept-language'),
      acceptEncoding: c.req.header('accept-encoding'),
      contentType: c.req.header('content-type'),
      contentLength: c.req.header('content-length'),
      authorization: c.req.header('authorization') ? '[REDACTED]' : undefined,
      cookie: c.req.header('cookie') ? '[REDACTED]' : undefined
    }
  }
}

/**
 * Capture response details
 */
function captureResponseDetails(c: Context, startTime: number) {
  const endTime = Date.now()
  const duration = endTime - startTime
  
  return {
    status: c.res.status,
    statusText: c.res.statusText,
    headers: Object.fromEntries(c.res.headers.entries()),
    duration: `${duration}ms`,
    timestamp: new Date().toISOString()
  }
}

/**
 * Generate a short unique ID (8 characters)
 */
function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10)
}

/**
 * Save request log to R2 storage organized by path
 */
async function saveRequestLog(r2Binding: R2Bucket, logEntry: any) {
  try {
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = String(now.getUTCDate()).padStart(2, '0')
    const hour = String(now.getUTCHours()).padStart(2, '0')
    const timestamp = now.toISOString()
    const uuid = logEntry.id // Use the UUID from the log entry
    
    // Create path-based key structure: logs/path/method/year/month/day/hour/timestamp-id.json
    const path = logEntry.request.path.replace(/[^a-zA-Z0-9-_/]/g, '_') // Sanitize path
    const method = logEntry.request.method.toLowerCase()
    const key = `logs/${path}/${method}/${year}/${month}/${day}/${hour}/${timestamp}-${uuid}.json`
    
    await r2Binding.put(key, JSON.stringify(logEntry, null, 2), {
      httpMetadata: {
        contentType: 'application/json'
      },
      customMetadata: {
        method: logEntry.request.method,
        path: logEntry.request.path,
        status: String(logEntry.response?.status || 'unknown'),
        timestamp: timestamp
      }
    })
    
    console.log(`Request logged to R2: ${key}`)
  } catch (error) {
    console.error('Failed to save request log to R2:', error)
  }
}
