import { Hono } from 'hono'
import { Bindings } from './bindings.js'
import { GoogleGenAI } from "@google/genai";
import { UserKVProvider } from './services/index.js';
import { setupMiddleware } from './middleware/index.js'
import { setupAllRoutes } from './routes/index.js'

export type Variables = {
  gemini: GoogleGenAI
  userKV: UserKVProvider
  userId?: string
}

export type honoContext = { Bindings: Bindings, Variables: Variables }

const app = new Hono<honoContext>()

// Setup middleware
setupMiddleware(app)

// Setup all routes
setupAllRoutes(app)

export default app

