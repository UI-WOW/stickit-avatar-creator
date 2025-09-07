import { Hono } from 'hono'
import type { honoContext } from '../index.js'

export function setupImageGenerationRoutes(app: Hono<honoContext>) {
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
}
