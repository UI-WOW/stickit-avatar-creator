import { Hono } from 'hono'
import { setupStickerGroupRoutes } from './stickerGroups.js'
import { setupImageGenerationRoutes } from './imageGeneration.js'
import { setupStickerProcessingRoutes } from './stickerProcessing.js'
import { setupReferenceImageRoutes } from './referenceImages.js'
import { setupHealthRoutes } from './health.js'
import type { honoContext } from '../index.js'

export function setupAllRoutes(app: Hono<honoContext>) {
  setupHealthRoutes(app)
  setupStickerGroupRoutes(app)
  setupImageGenerationRoutes(app)
  setupStickerProcessingRoutes(app)
  setupReferenceImageRoutes(app)
}
