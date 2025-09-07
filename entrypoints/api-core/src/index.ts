import { Hono } from 'hono'
import { Bindings } from './bindings.js'
import { createRequestLoggerMiddleware } from './middleware/requestLogger.js'
import { GoogleGenAI } from "@google/genai";
import { StickerService } from './services/index.js';

export type Variables = {
  gemini: GoogleGenAI
}

export type honoContext = { Bindings: Bindings, Variables: Variables }

const app = new Hono<honoContext>()

// Middleware to log all requests
app.use('*', async (c, next) => {
  const gemini = new GoogleGenAI({
    apiKey: c.env.GEMINI_API_KEY,
  });
  c.set('gemini', gemini);
  await next();
});

app.use('*', async (c, next) => {
  const requestLoggerMiddleware = createRequestLoggerMiddleware(c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR);
  return requestLoggerMiddleware(c, next);
});


// Middleware to inject providers
app.use('*', async (c, next) => {
  await next();
});

app.onError((err, c) => {
  console.error('Global Error Handler:', err)
  return c.json({ 
    error: 'Internal server error', 
    details: err.message,
    stack: err.stack 
  }, 500)
})

// Health check
app.get('/', (c) => {
  return c.text('Hello from the STICKIT AVATAR CREATOR App from Stickit')
})

// Route to generate and save an image using Gemini 2.5 Flash Image
app.get('/save-image-test', async (c) => {
  try {
    const filename = await c.req.query('filename')
    const prompt = await c.req.query('prompt')
    
    // Default prompt if none provided
    const imagePrompt = prompt || `A kawaii-style sticker of an adorable elephant. The elephant has big expressive eyes, a happy smile, and a playful pose with its trunk curled up. The design features extra thick black outlines (5-6 pixels wide), bold clean lines, simple cel-shading, and a vibrant color palette. The character should have a strong silhouette with prominent black borders around all edges. The background must be white.`;
    
    // Get Gemini instance from context
    const gemini = c.get('gemini');
    
    // Generate image using Gemini 2.5 Flash Image
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: imagePrompt,
    });

    let imageData: ArrayBuffer | null = null;
    const finalFilename = filename || `gemini-generated-${Date.now()}.png`;

    // Extract image data from response
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const base64Data = part.inlineData.data;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          imageData = bytes.buffer;
          break;
        }
      }
    }

    if (!imageData) {
      return c.json({ error: 'Failed to generate image from Gemini' }, 500);
    }
    
    // Save to R2 bucket
    await c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR.put(finalFilename, imageData, {
      httpMetadata: {
        contentType: 'image/png'
      }
    });

    return c.json({ 
      success: true, 
      message: 'Image generated and saved successfully using Gemini 2.5 Flash Image',
      filename: finalFilename,
      size: imageData.byteLength,
      prompt: imagePrompt
    });

  } catch (error) {
    console.error('Error in save-image-test:', error)
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({ 
      error: 'Internal server error', 
      details: errorMessage
    }, 500);
  }
});

app.get('/get-image-test', async (c) => {
  const filename = c.req.query('filename')
  
  if (!filename) {
    return c.json({ error: 'filename parameter is required' }, 400)
  }
  
  const image = await c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR.get(filename)
  if (!image) {
    return c.json({ error: 'Image not found', filename }, 404)
  }
  
  const arrayBuffer = await image.arrayBuffer()
  const contentType = image.httpMetadata?.contentType || 'image/png'
  
  return new Response(arrayBuffer, {
    headers: { 
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`
    }
  })
})


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

export default app

