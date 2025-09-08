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
        avatarCreationKeys: avatarCreation ? Object.keys(avatarCreation) : [],
        referenceImagesCount: avatarCreation?.referenceImages?.length || 0
      });
      
      if (!brandIdentity || !avatarCreation) {
        console.error('❌ Missing required data');
        return c.json({ error: 'Missing required data: brandIdentity and avatarCreation are required' }, 400)
      }

      // Build comprehensive prompt from user preferences
      console.log('🔨 Building avatar generation prompt...');
      let prompt = `Create a kawaii-style sticker avatar that will be used as the base character for multiple stickers. This avatar should be designed to be consistent across different expressions and scenarios.\n\n`
      
      // PRIORITY 1: Avatar Creation Details (Most Important)
      prompt += `=== AVATAR CHARACTER DESIGN (PRIMARY) ===\n`
      
      if (avatarCreation.description) {
        prompt += `Avatar Description: ${avatarCreation.description}\n`
        console.log(`  ✓ Avatar Description: ${avatarCreation.description.substring(0, 50)}...`)
      }
      
      if (avatarCreation.personality) {
        prompt += `Avatar Personality: ${avatarCreation.personality}\n`
        console.log(`  ✓ Avatar Personality: ${avatarCreation.personality}`)
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
      
      // PRIORITY 2: Brand Identity Context (Supporting)
      prompt += `\n=== BRAND CONTEXT (SUPPORTING) ===\n`
      
      if (brandIdentity.avatarType) {
        prompt += `Avatar Type: ${brandIdentity.avatarType}\n`
        console.log(`  ✓ Avatar Type: ${brandIdentity.avatarType}`)
      }
      
      if (brandIdentity.avatarDescription) {
        prompt += `Purpose: ${brandIdentity.avatarDescription}\n`
        console.log(`  ✓ Purpose: ${brandIdentity.avatarDescription.substring(0, 50)}...`)
      }
      
      
      
      // Add technical specifications for sticker format
      prompt += `\n=== TECHNICAL REQUIREMENTS ===
- Kawaii-style design with thick black outlines (5-6 pixels wide)
- Bold, clean lines with simple cel-shading
- Strong silhouette with prominent black borders around all edges
- Expressive and friendly appearance
- White background
- High contrast and vibrant colors
- Optimized for sticker format (clear, recognizable at small sizes)
- Professional yet approachable design
- Design should be versatile enough to work in multiple expressions and scenarios
- Character should have distinctive features that remain consistent across different stickers

=== WHATSAPP STICKER OPTIMIZATION ===
- NO TEXT: Do not include any text, words, or speech bubbles
- NO DECORATIVE ELEMENTS: Avoid splashes, sparkles, stars, or decorative elements outside the main character
- CLEAN DESIGN: Keep the design simple and focused on the main character only
- WHATSAPP COMPATIBLE: Design should work perfectly when converted to WhatsApp sticker format
- FOCUS ON CHARACTER: The character should be the only visual element, with minimal or no background elements

=== FINAL REMINDER ===
WHATSAPP STICKER FORMAT: This avatar will be used to create WhatsApp stickers. Keep the design clean and simple - focus only on the character. Avoid any text, speech bubbles, decorative elements, or background details that might get removed during WhatsApp conversion. The character should be the only visual element.`
      
      console.log('📝 Generated prompt length:', prompt.length, 'characters');
      
      // Get Gemini instance from context
      const gemini = c.get('gemini');
      
      if (!gemini) {
        console.error('❌ Gemini instance not found in context');
        return c.json({ error: 'AI service not available' }, 500);
      }
      
      // Prepare content for Gemini API call
      const contents: any[] = [prompt];
      
      // Add reference images if any
      if (avatarCreation.referenceImages && avatarCreation.referenceImages.length > 0) {
        console.log(`📸 Processing ${avatarCreation.referenceImages.length} reference images...`);
        console.log('📋 Reference images data:', avatarCreation.referenceImages);
        
        for (const refImage of avatarCreation.referenceImages) {
          try {
            // Extract filename from URL
            const url = new URL(refImage.url);
            const filename = url.searchParams.get('filePath');
            
            if (filename) {
              console.log(`  📥 Fetching reference image: ${filename}`);
              
              // Get the image from R2 storage
              const imageObject = await c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR.get(filename);
              
              if (imageObject) {
                const imageBuffer = await imageObject.arrayBuffer();
                const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
                
                // Add image to contents
                contents.push({
                  inlineData: {
                    mimeType: imageObject.httpMetadata?.contentType || 'image/jpeg',
                    data: base64Image
                  }
                });
                
                console.log(`  ✅ Added reference image: ${filename}`);
              } else {
                console.warn(`  ⚠️ Reference image not found in storage: ${filename}`);
              }
            }
          } catch (error) {
            console.error(`  ❌ Error processing reference image:`, error);
          }
        }
        
        if (contents.length > 1) {
          prompt += `\n\nIMPORTANT: Use the provided reference images as visual inspiration for the avatar design. Analyze the style, colors, and visual elements in these images and incorporate them into the avatar while maintaining the kawaii sticker format.`;
          console.log(`  🎨 Enhanced prompt with ${contents.length - 1} reference images`);
          console.log(`  📊 Total content items for Gemini: ${contents.length} (1 text + ${contents.length - 1} images)`);
        } else {
          console.log(`  ⚠️ No reference images were successfully processed`);
        }
      }
      
      console.log('🤖 Calling Gemini API for image generation...');
      
      // Generate image using Gemini 2.5 Flash Image
      const geminiStartTime = Date.now();
      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: contents,
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
        hasAvatarCreation: !!avatarCreation,
        hasGeneratedAvatar: !!(avatarCreation?.generatedAvatar?.url),
        referenceImagesCount: avatarCreation?.referenceImages?.length || 0
      });
      
      if (!stickerData || !brandIdentity || !avatarCreation) {
        console.error('❌ Missing required data for sticker generation');
        return c.json({ error: 'Missing required data: stickerData, brandIdentity, and avatarCreation are required' }, 400)
      }

      // Build comprehensive prompt for sticker generation
      console.log('🔨 Building sticker generation prompt...');
      let prompt = `Create a kawaii-style sticker featuring the same character/avatar in different scenarios. The avatar should be consistent across all stickers.\n\n`
      
      // PRIORITY 1: Generated Avatar Image (ABSOLUTE PRIMARY REFERENCE)
      prompt += `=== GENERATED AVATAR (ABSOLUTE PRIMARY REFERENCE) ===\n`
      prompt += `CRITICAL: The generated avatar image provided below is the EXACT character that must appear in this sticker. This is the most important reference - everything else is secondary.\n\n`
      
      // PRIORITY 2: Sticker-Specific Information
      prompt += `=== STICKER SPECIFIC DETAILS ===\n`
      prompt += `Sticker Name: ${stickerData.name}\n`
      prompt += `Usage Scenario: ${stickerData.scenario}\n`
      if (stickerData.description) {
        prompt += `Description: ${stickerData.description}\n`
      }
      if (stickerData.notes) {
        prompt += `Additional Notes: ${stickerData.notes}\n`
      }
      
      // PRIORITY 3: Avatar Creation Details (Supporting Context)
      prompt += `\n=== AVATAR CHARACTER DESIGN (SUPPORTING CONTEXT) ===\n`
      
      if (avatarCreation.description) {
        prompt += `Avatar Description: ${avatarCreation.description}\n`
        console.log(`  ✓ Avatar Description: ${avatarCreation.description.substring(0, 50)}...`)
      }
      
      if (avatarCreation.personality) {
        prompt += `Avatar Personality: ${avatarCreation.personality}\n`
        console.log(`  ✓ Avatar Personality: ${avatarCreation.personality}`)
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
      
      // PRIORITY 4: Brand Identity Context (Additional Support)
      prompt += `\n=== BRAND CONTEXT (ADDITIONAL SUPPORT) ===\n`
      
      if (brandIdentity.avatarType) {
        prompt += `Avatar Type: ${brandIdentity.avatarType}\n`
      }
      
      if (brandIdentity.avatarDescription) {
        prompt += `Avatar Purpose: ${brandIdentity.avatarDescription}\n`
      }
      
      
      if (brandIdentity.personalityTraits && brandIdentity.personalityTraits.length > 0) {
        prompt += `Personality Traits: ${brandIdentity.personalityTraits.join(', ')}\n`
      }
      
      // Add technical specifications for sticker format
      prompt += `\n=== TECHNICAL REQUIREMENTS ===
- Kawaii-style design with thick black outlines (5-6 pixels wide)
- Bold, clean lines with simple cel-shading
- Strong silhouette with prominent black borders around all edges
- Expressive and appropriate for the scenario described
- White background
- High contrast and vibrant colors
- Optimized for sticker format (clear, recognizable at small sizes)
- Professional yet approachable design
- ABSOLUTE PRIORITY: The character must be visually identical to the generated avatar image provided
- The generated avatar is the definitive reference - all other descriptions are secondary
- Only the expression, pose, and context should change based on the scenario
- Maintain the exact same visual identity, features, and style as the generated avatar
- If a generated avatar is provided, ignore conflicting descriptions and use the avatar image as the source of truth

=== WHATSAPP STICKER OPTIMIZATION ===
- NO TEXT: Do not include any text, words, or speech bubbles unless explicitly requested in the scenario
- NO DECORATIVE ELEMENTS: Avoid splashes, sparkles, stars, or decorative elements outside the main character
- CLEAN DESIGN: Keep the design simple and focused on the main character only
- WHATSAPP COMPATIBLE: Design should work perfectly when converted to WhatsApp sticker format
- FOCUS ON CHARACTER: The character should be the only visual element, with minimal or no background elements
- EXCEPTION: Only add text if the scenario specifically mentions text, speech, or written content

=== FINAL REMINDER ===
WHATSAPP STICKER FORMAT: This sticker will be used in WhatsApp. Keep the design clean and simple - focus only on the character. Avoid any text, speech bubbles, decorative elements, or background details that might get removed during WhatsApp conversion. The character should be the only visual element.`
      
      console.log('📝 Generated sticker prompt length:', prompt.length, 'characters');
      
      // Get Gemini instance from context
      const gemini = c.get('gemini');
      
      if (!gemini) {
        console.error('❌ Gemini instance not found in context');
        return c.json({ error: 'AI service not available' }, 500);
      }
      
      // Prepare content for Gemini API call
      const contents: any[] = [prompt];
      
      // PRIORITY 1: Add generated avatar image first (MOST IMPORTANT)
      if (avatarCreation.generatedAvatar && avatarCreation.generatedAvatar.url) {
        console.log('🎯 Processing generated avatar image as PRIMARY reference...');
        
        try {
          // Extract filename from the generated avatar URL
          const avatarUrl = new URL(avatarCreation.generatedAvatar.url);
          const avatarFilename = avatarUrl.searchParams.get('filename') || avatarUrl.pathname.split('/').pop();
          
          if (avatarFilename) {
            console.log(`  📥 Fetching generated avatar: ${avatarFilename}`);
            
            // Get the generated avatar from R2 storage
            const avatarObject = await c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR.get(avatarFilename);
            
            if (avatarObject) {
              const avatarBuffer = await avatarObject.arrayBuffer();
              const base64Avatar = btoa(String.fromCharCode(...new Uint8Array(avatarBuffer)));
              
              // Add generated avatar as the first image (highest priority)
              contents.push({
                inlineData: {
                  mimeType: avatarObject.httpMetadata?.contentType || 'image/png',
                  data: base64Avatar
                }
              });
              
              console.log(`  ✅ Generated avatar added as PRIMARY reference: ${avatarFilename}`);
            } else {
              console.warn(`  ⚠️ Generated avatar not found in storage: ${avatarFilename}`);
            }
          }
        } catch (error) {
          console.error(`  ❌ Error processing generated avatar:`, error);
        }
      } else {
        console.log('⚠️ No generated avatar found - stickers will be generated without the primary reference');
      }
      
      // PRIORITY 2: Add reference images if any (SECONDARY)
      if (avatarCreation.referenceImages && avatarCreation.referenceImages.length > 0) {
        console.log(`📸 Processing ${avatarCreation.referenceImages.length} reference images for sticker generation...`);
        console.log('📋 Reference images data for sticker:', avatarCreation.referenceImages);
        
        for (const refImage of avatarCreation.referenceImages) {
          try {
            // Extract filename from URL
            const url = new URL(refImage.url);
            const filename = url.searchParams.get('filePath');
            
            if (filename) {
              console.log(`  📥 Fetching reference image: ${filename}`);
              
              // Get the image from R2 storage
              const imageObject = await c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR.get(filename);
              
              if (imageObject) {
                const imageBuffer = await imageObject.arrayBuffer();
                const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
                
                // Add image to contents
                contents.push({
                  inlineData: {
                    mimeType: imageObject.httpMetadata?.contentType || 'image/jpeg',
                    data: base64Image
                  }
                });
                
                console.log(`  ✅ Added reference image: ${filename}`);
              } else {
                console.warn(`  ⚠️ Reference image not found in storage: ${filename}`);
              }
            }
          } catch (error) {
            console.error(`  ❌ Error processing reference image:`, error);
          }
        }
        
        if (contents.length > 1) {
          const hasGeneratedAvatar = avatarCreation.generatedAvatar && avatarCreation.generatedAvatar.url;
          if (hasGeneratedAvatar) {
            prompt += `\n\nCRITICAL INSTRUCTIONS: The FIRST image provided is the generated avatar - this is the EXACT character that must appear in the sticker. Use this as the primary reference for the character's appearance, style, and features. Any additional reference images are for style inspiration only. The character in the sticker must match the generated avatar exactly, only changing expression, pose, and context based on the scenario.`;
          } else {
            prompt += `\n\nIMPORTANT: Use the provided reference images as visual inspiration for the sticker design. Analyze the style, colors, and visual elements in these images and incorporate them into the sticker while maintaining the kawaii sticker format and character consistency.`;
          }
          console.log(`  🎨 Enhanced sticker prompt with ${contents.length - 1} images (${hasGeneratedAvatar ? 'including generated avatar' : 'reference images only'})`);
          console.log(`  📊 Total content items for Gemini: ${contents.length} (1 text + ${contents.length - 1} images)`);
        } else {
          console.log(`  ⚠️ No images were successfully processed for sticker generation`);
        }
      }
      
      console.log('🤖 Calling Gemini API for sticker generation...');
      
      // Generate image using Gemini 2.5 Flash Image
      const geminiStartTime = Date.now();
      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: contents,
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
