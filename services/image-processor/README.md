# Image Processor Service

A FastAPI service for processing PNG images to WebP format with white background removal.

## Features

- ✅ PNG to WebP conversion
- ✅ White background removal with configurable threshold
- ✅ Image resizing to target dimensions
- ✅ Advanced processing with edge detection (optional)
- ✅ High-quality WebP output
- ✅ RESTful API endpoints

## Setup

### Option 1: Local Development

1. **Install Python dependencies:**
   ```bash
   cd services/image-processor
   pip install -r requirements.txt
   ```

2. **Run the service:**
   ```bash
   python main.py
   ```

### Option 2: Docker

1. **Build the Docker image:**
   ```bash
   cd services/image-processor
   docker build -t image-processor .
   ```

2. **Run the container:**
   ```bash
   docker run -p 8002:8002 image-processor
   ```

## API Endpoints

### Health Check
```bash
GET http://localhost:8002/
```

### Basic Image Processing
```bash
POST http://localhost:8002/process-image
Content-Type: multipart/form-data

Parameters:
- file: PNG image file
- white_threshold: 0-255 (default: 240)
- output_size: pixels (default: 512)
- quality: 1-100 (default: 90)
```

### Advanced Image Processing
```bash
POST http://localhost:8002/process-image-advanced
Content-Type: multipart/form-data

Parameters:
- file: PNG image file
- white_threshold: 0-255 (default: 240)
- output_size: pixels (default: 512)
- quality: 1-100 (default: 90)
- use_edge_detection: boolean (default: false)
```

## Usage Examples

### cURL Example
```bash
curl -X POST "http://localhost:8002/process-image" \
  -F "file=@your-image.png" \
  -F "white_threshold=240" \
  -F "output_size=512" \
  -F "quality=90" \
  --output processed-image.webp
```

### Python Example
```python
import requests

url = "http://localhost:8002/process-image"
files = {"file": open("your-image.png", "rb")}
data = {
    "white_threshold": 240,
    "output_size": 512,
    "quality": 90
}

response = requests.post(url, files=files, data=data)
with open("processed-image.webp", "wb") as f:
    f.write(response.content)
```

### JavaScript Example
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('white_threshold', '240');
formData.append('output_size', '512');
formData.append('quality', '90');

fetch('http://localhost:8002/process-image', {
    method: 'POST',
    body: formData
})
.then(response => response.blob())
.then(blob => {
    const url = URL.createObjectURL(blob);
    // Use the processed image
});
```

## Integration with Cloudflare Workers

You can now update your Cloudflare Worker to use this Python service:

```typescript
// In your Cloudflare Worker
app.get('/generate-sticker', async (c) => {
  try {
    const filename = c.req.query('filename')
    if (!filename) {
      return c.json({ error: 'filename parameter is required' }, 400)
    }
    
    const image = await c.env.GENERAL_STORAGE_STICKIT_AVATAR_CREATOR.get(filename)
    if (!image) {
      return c.json({ error: 'Image not found', filename }, 404)
    }
    
    const imageBuffer = await image.arrayBuffer()
    
    // Send to Python service
    const formData = new FormData()
    formData.append('file', new Blob([imageBuffer]), filename)
    formData.append('white_threshold', '240')
    formData.append('output_size', '512')
    formData.append('quality', '90')
    
    const response = await fetch('http://localhost:8002/process-image', {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      throw new Error(`Python service error: ${response.status}`)
    }
    
    const processedImageBuffer = await response.arrayBuffer()
    
    return new Response(processedImageBuffer, {
      headers: { 
        'Content-Type': 'image/webp',
        'Content-Disposition': `inline; filename="${filename.replace(/\.[^/.]+$/, '')}-sticker.webp"`
      }
    })
    
  } catch (error) {
    console.error('Error in generate-sticker:', error)
    return c.json({ 
      error: 'Failed to generate sticker', 
      details: error.message
    }, 500)
  }
})
```

## Configuration

### Environment Variables
- `PORT`: Service port (default: 8002)
- `HOST`: Service host (default: 0.0.0.0)

### Processing Parameters
- **white_threshold**: Higher values remove more colors (0-255)
- **output_size**: Target image dimensions in pixels
- **quality**: WebP compression quality (1-100)
- **use_edge_detection**: Advanced processing for better results

## Performance

- Optimized for small to medium images (< 10MB)
- Fast processing with PIL/Pillow
- Optional OpenCV for advanced operations
- Memory-efficient streaming

## Error Handling

The service includes comprehensive error handling:
- File type validation
- Image format validation
- Processing error recovery
- Detailed error messages
- HTTP status codes

## Dependencies

- **FastAPI**: Web framework
- **Pillow**: Image processing
- **OpenCV**: Advanced image operations (optional)
- **NumPy**: Numerical operations
- **Uvicorn**: ASGI server
