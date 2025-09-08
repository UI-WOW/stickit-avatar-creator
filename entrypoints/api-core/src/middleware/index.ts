import { Hono } from 'hono'
import { GoogleGenAI } from "@google/genai";
import { UserKVProvider } from '../services/index.js';
import { createRequestLoggerMiddleware } from './requestLogger.js'
import { cors } from 'hono/cors'
import type { honoContext } from '../index.js'

export function setupMiddleware(app: Hono<honoContext>) {
  // CORS for UI dev server and production
  const allowedOrigins = [
    'http://localhost:8001',
    'https://www.stickit.ui-wow.com',
    'https://stickit.ui-wow.com',
  ]

  app.use('*', cors({
    origin: (origin) => {
      if (!origin) return 'http://localhost:8001'
      return allowedOrigins.includes(origin) ? origin : 'http://localhost:8001'
    },
    credentials: true,
    allowMethods: ['GET','POST','DELETE','OPTIONS'],
    allowHeaders: ['Content-Type']
  }))

  // Middleware: derive userId from cookies and put into context
  app.use('*', async (c, next) => {
    const cookieHeader = c.req.header('cookie') || ''
    const matchNew = cookieHeader.match(/(?:^|;\s*)stickit-user=([^;]+)/)
    const matchLegacy = cookieHeader.match(/(?:^|;\s*)sticket-sid=([^;]+)/)
    const rawId = (matchNew && matchNew[1]) || (matchLegacy && matchLegacy[1]) || null
    const userId = rawId ? decodeURIComponent(rawId) : null
    if (userId) c.set('userId', userId)
    await next()
  })

  // Middleware to log all requests and inject providers
  app.use('*', async (c, next) => {
    const gemini = new GoogleGenAI({
      apiKey: c.env.GEMINI_API_KEY,
    });
    c.set('gemini', gemini);
    c.set('userKV', new UserKVProvider(c.env.APP_KV))
    await next();
  });

  app.use('*', async (c, next) => {
    const requestLoggerMiddleware = createRequestLoggerMiddleware(c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR);
    return requestLoggerMiddleware(c, next);
  });

  // Global error handler
  app.onError((err, c) => {
    console.error('Global Error Handler:', err)
    return c.json({ 
      error: 'Internal server error', 
      details: err.message,
      stack: err.stack 
    }, 500)
  })
}
