import { Hono } from 'hono'
import type { honoContext } from '../index.js'

export function setupImageGenerationRoutes(app: Hono<honoContext>) {

  // Route to generate avatar based on user preferences
  app.post('/generate-avatar', async (c) => {
    const startTime = Date.now();
    console.log('🎨 Starting avatar generation request...');
    
    try {
      const body = await c.req.json()
      const { brandIdentity, avatarCreation, groupId } = body
      
      console.log('📋 Request data received:', {
        groupId,
        hasBrandIdentity: !!brandIdentity,
        hasAvatarCreation: !!avatarCreation,
        brandIdentityKeys: brandIdentity ? Object.keys(brandIdentity) : [],
        avatarCreationKeys: avatarCreation ? Object.keys(avatarCreation) : []
      });
      
      if (!brandIdentity || !avatarCreation) {
        console.error('❌ Missing required data');
        return c.json({ error: 'Missing required data: brandIdentity and avatarCreation are required' }, 400)
      }

      // Build comprehensive prompt from user preferences
      console.log('🔨 Building avatar generation prompt...');
      let prompt = `Create a kawaii-style sticker avatar based on the following specifications:\n\n`
      
      // Add brand identity information
      if (brandIdentity.avatarType) {
        prompt += `Avatar Type: ${brandIdentity.avatarType}\n`
        console.log(`  ✓ Avatar Type: ${brandIdentity.avatarType}`)
      }
      
      if (brandIdentity.avatarDescription) {
        prompt += `Purpose: ${brandIdentity.avatarDescription}\n`
        console.log(`  ✓ Purpose: ${brandIdentity.avatarDescription.substring(0, 50)}...`)
      }
      
      if (brandIdentity.personalityTraits && brandIdentity.personalityTraits.length > 0) {
        prompt += `Personality Traits: ${brandIdentity.personalityTraits.join(', ')}\n`
        console.log(`  ✓ Personality Traits: ${brandIdentity.personalityTraits.join(', ')}`)
      }
      
      // Add avatar creation details
      if (avatarCreation.description) {
        prompt += `Visual Description: ${avatarCreation.description}\n`
        console.log(`  ✓ Visual Description: ${avatarCreation.description.substring(0, 50)}...`)
      }
      
      if (avatarCreation.selectedStyle && avatarCreation.selectedStyle !== 'No specific style') {
        prompt += `Style Preference: ${avatarCreation.selectedStyle}\n`
        console.log(`  ✓ Style Preference: ${avatarCreation.selectedStyle}`)
      }
      
      if (avatarCreation.colorPalette) {
        const colors = Object.entries(avatarCreation.colorPalette)
          .filter(([_, value]) => value)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ')
        if (colors) {
          prompt += `Color Palette: ${colors}\n`
          console.log(`  ✓ Color Palette: ${colors}`)
        }
      }
      
      // Add technical specifications for sticker format
      prompt += `\nTechnical Requirements:
- Kawaii-style design with thick black outlines (5-6 pixels wide)
- Bold, clean lines with simple cel-shading
- Strong silhouette with prominent black borders around all edges
- Expressive and friendly appearance
- White background
- High contrast and vibrant colors
- Optimized for sticker format (clear, recognizable at small sizes)
- Professional yet approachable design`
      
      // Add reference to uploaded images if any
      if (avatarCreation.referenceImages && avatarCreation.referenceImages.length > 0) {
        prompt += `\n\nNote: The user has uploaded ${avatarCreation.referenceImages.length} reference image(s) for style inspiration.`
        console.log(`  ✓ Reference Images: ${avatarCreation.referenceImages.length} uploaded`)
      }
      
      console.log('📝 Generated prompt length:', prompt.length, 'characters');
      console.log('🤖 Calling Gemini API for image generation...');
      
      // Get Gemini instance from context
      const gemini = c.get('gemini');
      
      if (!gemini) {
        console.error('❌ Gemini instance not found in context');
        return c.json({ error: 'AI service not available' }, 500);
      }
      
      // Generate image using Gemini 2.5 Flash Image
      const geminiStartTime = Date.now();
      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: prompt,
      });
      const geminiEndTime = Date.now();
      
      console.log(`⏱️ Gemini API call completed in ${geminiEndTime - geminiStartTime}ms`);

      let imageData: ArrayBuffer | null = null;
      const filename = `avatar-${groupId || 'temp'}-${Date.now()}.png`;
      console.log('📁 Generated filename:', filename);

      // Extract image data from response
      console.log('🔍 Extracting image data from Gemini response...');
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
            console.log('✅ Image data extracted successfully, size:', imageData.byteLength, 'bytes');
            break;
          }
        }
      }

      if (!imageData) {
        console.error('❌ Failed to extract image data from Gemini response');
        return c.json({ error: 'Failed to generate avatar from Gemini' }, 500);
      }
      
      // Save to R2 bucket
      console.log('💾 Saving image to R2 storage...');
      const saveStartTime = Date.now();
      await c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR.put(filename, imageData, {
        httpMetadata: {
          contentType: 'image/png'
        }
      });
      const saveEndTime = Date.now();
      console.log(`✅ Image saved to R2 in ${saveEndTime - saveStartTime}ms`);

      // Generate public URL for the image
      const url = new URL(c.req.url);
      const baseUrl = `${url.protocol}//${url.host}`;
      const imageUrl = `${baseUrl}/get-avatar-image?filename=${encodeURIComponent(filename)}`;
      console.log('🔗 Generated image URL:', imageUrl);

      const totalTime = Date.now() - startTime;
      console.log(`🎉 Avatar generation completed successfully in ${totalTime}ms`);

      return c.json({ 
        success: true, 
        message: 'Avatar generated successfully',
        filename: filename,
        url: imageUrl,
        size: imageData.byteLength,
        generationTime: totalTime,
        prompt: prompt
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ Avatar generation failed after ${totalTime}ms:`, error)
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      return c.json({ 
        error: 'Avatar generation failed', 
        details: errorMessage,
        generationTime: totalTime
      }, 500);
    }
  })

  // Route to get generated avatar images
  app.get('/get-avatar-image', async (c) => {
    const startTime = Date.now();
    console.log('🖼️ Avatar image request received');
    
    try {
      const filename = c.req.query('filename')
      
      if (!filename) {
        console.error('❌ No filename provided');
        return c.json({ error: 'filename parameter is required' }, 400)
      }
      
      console.log('📁 Requesting avatar image:', filename)
      
      const image = await c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR.get(filename)
      if (!image) {
        console.error('❌ Avatar image not found in R2 storage:', filename)
        return c.json({ error: 'Avatar image not found', filename }, 404)
      }
      
      console.log('✅ Avatar image found in R2 storage');
      const arrayBuffer = await image.arrayBuffer()
      const contentType = image.httpMetadata?.contentType || 'image/png'
      
      const responseTime = Date.now() - startTime;
      console.log(`🎉 Avatar image served successfully in ${responseTime}ms (${arrayBuffer.byteLength} bytes)`);
      
      return new Response(arrayBuffer, {
        headers: { 
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${filename}"`,
          'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
        }
      })
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`❌ Error retrieving avatar image after ${responseTime}ms:`, error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      return c.json({ 
        error: 'Failed to retrieve avatar image', 
        details: errorMessage
      }, 500);
    }
  })

  // Route to generate individual sticker
  app.post('/generate-sticker', async (c) => {
    const startTime = Date.now();
    console.log('🎨 Starting individual sticker generation request...');
    
    try {
      const body = await c.req.json()
      const { stickerData, brandIdentity, avatarCreation, groupId } = body
      
      console.log('📋 Sticker generation request received:', {
        groupId,
        stickerName: stickerData?.name,
        stickerScenario: stickerData?.scenario,
        hasBrandIdentity: !!brandIdentity,
        hasAvatarCreation: !!avatarCreation
      });
      
      if (!stickerData || !brandIdentity || !avatarCreation) {
        console.error('❌ Missing required data for sticker generation');
        return c.json({ error: 'Missing required data: stickerData, brandIdentity, and avatarCreation are required' }, 400)
      }

      // Build comprehensive prompt for sticker generation
      console.log('🔨 Building sticker generation prompt...');
      let prompt = `Create a kawaii-style sticker based on the following specifications:\n\n`
      
      // Add sticker-specific information
      prompt += `Sticker Name: ${stickerData.name}\n`
      prompt += `Usage Scenario: ${stickerData.scenario}\n`
      if (stickerData.description) {
        prompt += `Description: ${stickerData.description}\n`
      }
      if (stickerData.notes) {
        prompt += `Additional Notes: ${stickerData.notes}\n`
      }
      
      // Add brand identity information
      if (brandIdentity.avatarType) {
        prompt += `\nAvatar Type: ${brandIdentity.avatarType}\n`
      }
      
      if (brandIdentity.avatarDescription) {
        prompt += `Avatar Purpose: ${brandIdentity.avatarDescription}\n`
      }
      
      if (brandIdentity.personalityTraits && brandIdentity.personalityTraits.length > 0) {
        prompt += `Personality Traits: ${brandIdentity.personalityTraits.join(', ')}\n`
      }
      
      // Add avatar creation details
      if (avatarCreation.description) {
        prompt += `Avatar Visual Description: ${avatarCreation.description}\n`
      }
      
      if (avatarCreation.selectedStyle && avatarCreation.selectedStyle !== 'No specific style') {
        prompt += `Style Preference: ${avatarCreation.selectedStyle}\n`
      }
      
      if (avatarCreation.colorPalette) {
        const colors = Object.entries(avatarCreation.colorPalette)
          .filter(([_, value]) => value)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ')
        if (colors) {
          prompt += `Color Palette: ${colors}\n`
        }
      }
      
      // Add technical specifications for sticker format
      prompt += `\nTechnical Requirements:
- Kawaii-style design with thick black outlines (5-6 pixels wide)
- Bold, clean lines with simple cel-shading
- Strong silhouette with prominent black borders around all edges
- Expressive and appropriate for the scenario described
- White background
- High contrast and vibrant colors
- Optimized for sticker format (clear, recognizable at small sizes)
- Professional yet approachable design
- Should match the avatar's personality and style`
      
      console.log('📝 Generated sticker prompt length:', prompt.length, 'characters');
      console.log('🤖 Calling Gemini API for sticker generation...');
      
      // Get Gemini instance from context
      const gemini = c.get('gemini');
      
      if (!gemini) {
        console.error('❌ Gemini instance not found in context');
        return c.json({ error: 'AI service not available' }, 500);
      }
      
      // Generate image using Gemini 2.5 Flash Image
      const geminiStartTime = Date.now();
      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: prompt,
      });
      const geminiEndTime = Date.now();
      
      console.log(`⏱️ Gemini API call completed in ${geminiEndTime - geminiStartTime}ms`);

      let imageData: ArrayBuffer | null = null;
      const filename = `sticker-${groupId || 'temp'}-${Date.now()}-${Math.random().toString(36).substring(2)}.png`;
      console.log('📁 Generated sticker filename:', filename);

      // Extract image data from response
      console.log('🔍 Extracting sticker image data from Gemini response...');
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
            console.log('✅ Sticker image data extracted successfully, size:', imageData.byteLength, 'bytes');
            break;
          }
        }
      }

      if (!imageData) {
        console.error('❌ Failed to extract sticker image data from Gemini response');
        return c.json({ error: 'Failed to generate sticker from Gemini' }, 500);
      }
      
      // Save to R2 bucket
      console.log('💾 Saving sticker image to R2 storage...');
      const saveStartTime = Date.now();
      await c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR.put(filename, imageData, {
        httpMetadata: {
          contentType: 'image/png'
        }
      });
      const saveEndTime = Date.now();
      console.log(`✅ Sticker image saved to R2 in ${saveEndTime - saveStartTime}ms`);

      // Generate public URL for the image
      const url = new URL(c.req.url);
      const baseUrl = `${url.protocol}//${url.host}`;
      const imageUrl = `${baseUrl}/get-avatar-image?filename=${encodeURIComponent(filename)}`;
      console.log('🔗 Generated sticker image URL:', imageUrl);

      const totalTime = Date.now() - startTime;
      console.log(`🎉 Sticker generation completed successfully in ${totalTime}ms`);

      // Return sticker data with image info
      const stickerResult = {
        id: Date.now().toString(),
        name: stickerData.name,
        scenario: stickerData.scenario,
        description: stickerData.description || '',
        notes: stickerData.notes || '',
        filename: filename,
        url: imageUrl,
        size: imageData.byteLength,
        generationTime: totalTime,
        generatedAt: new Date().toISOString()
      };

      return c.json({ 
        success: true, 
        message: 'Sticker generated successfully',
        sticker: stickerResult
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ Sticker generation failed after ${totalTime}ms:`, error)
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      return c.json({ 
        error: 'Sticker generation failed', 
        details: errorMessage,
        generationTime: totalTime
      }, 500);
    }
  })
}
