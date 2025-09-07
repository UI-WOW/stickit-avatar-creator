# Services

This directory contains the business logic services for the API.

## ImageProcessor

Handles image processing operations including:
- Background removal (white background detection)
- Image resizing
- Format conversion (WebP, PNG)

### Usage

```typescript
import { ImageProcessor } from './services/index.js';

const processedImage = await ImageProcessor.processImageForSticker(
  imageBuffer,
  {
    width: 512,
    height: 512,
    whiteThreshold: 240,
    outputFormat: 'webp',
    quality: 0.9
  }
);
```

## StickerService

Handles sticker generation and retrieval operations:
- Generate stickers from existing images
- Retrieve stickers from storage
- File naming conventions

### Usage

```typescript
import { StickerService } from './services/index.js';

// Generate a sticker
const result = await StickerService.generateSticker(
  imageBuffer,
  'original-image.png',
  r2Bucket
);

// Retrieve a sticker
const response = await StickerService.getSticker('sticker.webp', r2Bucket);
```

## API Endpoints

- `GET /generate-sticker?filename=image.png` - Generate a sticker from an existing image
- `GET /get-sticker?filename=sticker.webp` - Retrieve a generated sticker
