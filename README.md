# stickit-avatar-creator - Turborepo

## About the Application

As AI assistants become increasingly prevalent in our daily lives, they often lack the personal touch and emotional connection that makes interactions feel more human and engaging. StickIt Avatar Creator addresses part of this gap by enabling users to create personalized avatar and sticker collections that bring personality and warmth to AI interactions.

The platform allows users to design custom avatars with specific personalities, upload reference images for visual inspiration, and generate contextual stickers for various scenarios. By creating cohesive sticker packs that maintain character consistency while adapting to different use cases, StickIt transforms cold, text-based AI interactions into more relatable and emotionally engaging experiences.

## Project Structure

- **Frontend Base**: `entrypoints/UI-creator`
- **API core**: `entrypoints/API-core`

## Gemini 2.5 Flash Image Integration

This application leverages **Gemini 2.5 Flash Image Preview** as its core AI engine for generating personalized avatar and sticker collections. The model's multimodal capabilities are central to the application's functionality:

**Key Features Utilized:**
- **Multimodal Input Processing**: Accepts both text prompts and reference images simultaneously, allowing users to upload visual inspiration for more accurate avatar generation
- **Reference Image Integration**: Users can upload up to 3 reference images that are processed as base64-encoded inline data, providing visual context for character design
- **Consistent Character Generation**: The generated avatar image becomes the primary reference for all subsequent sticker generation, maintaining visual consistency across the entire sticker collection
- **Contextual Sticker Generation**: Creates scenario-specific stickers while preserving the core character design and personality traits

## Useful commands:
- pnpm dev