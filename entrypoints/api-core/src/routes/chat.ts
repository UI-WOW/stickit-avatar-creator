import { Hono } from 'hono'
import type { honoContext } from '../index.js'
import type { StickerDefinitionInput } from '../services/types.js'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  stickerIds?: string[]
}

export interface ChatRequest {
  message: string
  groupId: string
  conversationHistory?: ChatMessage[]
}

export interface ChatResponse {
  message: string
  stickerIds: string[]
  conversationHistory: ChatMessage[]
}

export function setupChatRoutes(app: Hono<honoContext>) {
  app.post('/chat', async (c) => {
    try {
      const userId = c.get('userId') as string | undefined
      if (!userId) {
        return c.json({ error: 'missing session cookie sticket-sid' }, 400)
      }

      const body = await c.req.json().catch(() => ({})) as ChatRequest
      const { message, groupId, conversationHistory = [] } = body

      if (!message || !groupId) {
        return c.json({ error: 'message and groupId are required' }, 400)
      }

      // Get the sticker group data
      const { group, configs } = await c.get('userKV').getGroupWithConfigs(userId, groupId)
      if (!group) {
        return c.json({ error: 'sticker group not found' }, 404)
      }

      const latestConfig = Array.isArray(configs) ? configs[0] : undefined
      if (!latestConfig) {
        return c.json({ error: 'no sticker configuration found' }, 404)
      }

      // Extract sticker data from the configuration
      const stickers = latestConfig.input.stickerGeneration?.stickers || []
      if (stickers.length === 0) {
        return c.json({ error: 'no stickers found in this group' }, 404)
      }

      // Get brand identity for context
      const brandIdentity = latestConfig.input.brandIdentity || {}
      const avatarCreation = latestConfig.input.avatarCreation || {}

      // Prepare sticker context for Gemini
      const stickerContext = stickers.map((sticker, index) => ({
        id: sticker.id || `sticker-${index}`,
        name: sticker.name,
        scenario: sticker.scenario,
        description: sticker.description || '',
        notes: sticker.notes || '',
        imageUrl: sticker.url || sticker.imageUrl || ''
      }))

      // Create conversation context for Gemini
      const conversationContext = `
You are an AI assistant with a personalized sticker collection. Your personality and responses should reflect the brand identity and avatar characteristics.

Brand Identity:
- Collection Name: ${brandIdentity.stickerGroupName || 'Tech Assistant'}
- Avatar Type: ${brandIdentity.avatarType || 'friendly robot'}
- Avatar Description: ${brandIdentity.avatarDescription || 'A helpful AI assistant'}
- Personality Traits: ${brandIdentity.personalityTraits?.join(', ') || 'helpful, friendly, knowledgeable'}

Avatar Details:
- Description: ${avatarCreation.description || 'A modern, friendly AI assistant'}
- Style: ${avatarCreation.selectedStyle || 'modern'}

Available Stickers:
${stickerContext.map(sticker => 
  `ID: ${sticker.id}
Name: ${sticker.name}
Scenario: ${sticker.scenario}
Description: ${sticker.description}
Notes: ${sticker.notes}`
).join('\n\n')}

Instructions:
1. Respond naturally to the user's message
2. Use stickers frequently to enhance your responses
3. Choose stickers that match the conversation context and your personality
4. Use ONLY ONE sticker per response (select the most appropriate one)
5. Always include the sticker ID in your response
6. Be engaging and use the stickers to make conversations more fun and expressive

Current conversation history:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

User message: ${message}

Respond with a JSON object containing:
{
  "message": "your response text",
  "stickerIds": ["single_sticker_id"],
  "reasoning": "brief explanation of why you chose this sticker"
}
`

      // Call Gemini AI
      const gemini = c.get('gemini')
      
      if (!gemini) {
        console.error('[POST /chat] Gemini instance not found in context');
        return c.json({ error: 'AI service not available' }, 500);
      }
      
      console.log('[POST /chat] Calling Gemini with context length:', conversationContext.length)
      console.log('[POST /chat] Sticker context:', stickerContext.length, 'stickers')
      
      const response = await gemini.models.generateContent({
        model: "gemini-1.5-flash",
        contents: conversationContext,
      });
      
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
      
      console.log('[POST /chat] Gemini raw response:', text)

      // Parse Gemini's response
      let parsedResponse
      try {
        // Try to extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          console.log('[POST /chat] Extracted JSON:', jsonMatch[0])
          parsedResponse = JSON.parse(jsonMatch[0])
          console.log('[POST /chat] Parsed response:', parsedResponse)
        } else {
          throw new Error('No JSON found in response')
        }
      } catch (parseError) {
        console.error('[POST /chat] Failed to parse Gemini response:', parseError)
        console.error('[POST /chat] Raw text that failed to parse:', text)
        // Fallback: create a simple response with a random sticker
        const randomSticker = stickerContext.length > 0 ? stickerContext[Math.floor(Math.random() * stickerContext.length)] : null
        parsedResponse = {
          message: text || "I'm here to help! Let me show you something cool:",
          stickerIds: randomSticker ? [randomSticker.id] : [],
          reasoning: "Using fallback due to parsing error"
        }
        console.log('[POST /chat] Using fallback response:', parsedResponse)
      }

      // Validate sticker IDs exist and limit to one sticker
      const validStickerIds = parsedResponse.stickerIds?.filter((id: string) => 
        stickerContext.some(sticker => sticker.id === id)
      ) || []

      // Limit to only one sticker (take the first valid one)
      const singleStickerId = validStickerIds.slice(0, 1)

      // If no valid stickers, add a random one
      if (singleStickerId.length === 0 && stickerContext.length > 0) {
        const randomSticker = stickerContext[Math.floor(Math.random() * stickerContext.length)]
        if (randomSticker) {
          singleStickerId.push(randomSticker.id)
        }
      }

      // Update conversation history
      const newConversationHistory = [
        ...conversationHistory,
        { role: 'user' as const, content: message },
        { 
          role: 'assistant' as const, 
          content: parsedResponse.message,
          stickerIds: singleStickerId
        }
      ]

      const chatResponse: ChatResponse = {
        message: parsedResponse.message,
        stickerIds: singleStickerId,
        conversationHistory: newConversationHistory
      }

      console.log('[POST /chat] Final response:', chatResponse)
      console.log('[POST /chat] Summary:', { 
        userId, 
        groupId, 
        messageLength: message.length,
        stickerCount: singleStickerId.length,
        reasoning: parsedResponse.reasoning
      })

      return c.json(chatResponse)

    } catch (error) {
      console.error('Error in chat endpoint:', error)
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      return c.json({ 
        error: 'Failed to process chat message', 
        details: errorMessage
      }, 500)
    }
  })

  // Get available stickers for a group (for frontend reference)
  app.get('/chat/stickers/:groupId', async (c) => {
    try {
      const userId = c.get('userId') as string | undefined
      if (!userId) {
        return c.json({ error: 'missing session cookie sticket-sid' }, 400)
      }

      const groupId = c.req.param('groupId')
      const { group, configs } = await c.get('userKV').getGroupWithConfigs(userId, groupId)
      
      if (!group) {
        return c.json({ error: 'sticker group not found' }, 404)
      }

      const latestConfig = Array.isArray(configs) ? configs[0] : undefined
      if (!latestConfig) {
        return c.json({ error: 'no sticker configuration found' }, 404)
      }

      const stickers = latestConfig.input.stickerGeneration?.stickers || []
      const stickerData = stickers.map((sticker, index) => ({
        id: sticker.id || `sticker-${index}`,
        name: sticker.name,
        scenario: sticker.scenario,
        description: sticker.description || '',
        notes: sticker.notes || '',
        imageUrl: sticker.url || sticker.imageUrl || ''
      }))

      return c.json({
        groupId,
        groupName: group.name,
        stickers: stickerData
      })

    } catch (error) {
      console.error('Error getting stickers:', error)
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      return c.json({ 
        error: 'Failed to get stickers', 
        details: errorMessage
      }, 500)
    }
  })
}
