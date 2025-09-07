# API Core Structure

This directory contains the refactored API core with improved organization and separation of concerns.

## File Structure

```
src/
├── index.ts                    # Main application entry point (now only 25 lines!)
├── bindings.ts                 # TypeScript bindings for Cloudflare Workers
├── middleware/
│   ├── index.ts               # Middleware setup (CORS, auth, providers, error handling)
│   └── requestLogger.ts       # Request logging middleware
├── routes/
│   ├── index.ts               # Route setup coordinator
│   ├── health.ts              # Health check endpoints
│   ├── stickerGroups.ts       # Sticker group CRUD operations
│   ├── imageGeneration.ts     # Gemini image generation endpoints
│   ├── stickerProcessing.ts   # Python service integration for sticker processing
│   └── referenceImages.ts     # Reference image upload/retrieval/deletion
└── services/
    ├── index.ts               # Service exports
    ├── stickerService.ts      # Sticker processing service
    ├── userKV.ts              # User data storage service
    └── types.ts               # Type definitions
```

## Benefits of This Structure

1. **Separation of Concerns**: Each file has a single responsibility
2. **Maintainability**: Easier to find and modify specific functionality
3. **Testability**: Individual modules can be tested in isolation
4. **Readability**: Main index.ts is now clean and shows the high-level structure
5. **Scalability**: Easy to add new routes or middleware without cluttering the main file

## Route Organization

- **Health Routes**: Basic health checks and service monitoring
- **Sticker Groups**: User sticker collection management
- **Image Generation**: AI-powered image creation using Gemini
- **Sticker Processing**: Integration with Python service for sticker conversion
- **Reference Images**: User-uploaded reference image management

## Middleware Organization

- **CORS**: Cross-origin request handling
- **Authentication**: User session management via cookies
- **Providers**: Service injection (Gemini, KV storage)
- **Logging**: Request/response logging
- **Error Handling**: Global error management
