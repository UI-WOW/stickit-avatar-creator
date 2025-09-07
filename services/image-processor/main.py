"""
Simple FastAPI service for image processing - PNG to WebP with background removal
Runs on port 8003
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import Response
from PIL import Image
import io
import uvicorn
import logging
import numpy as np
import httpx
from typing import Optional
import os
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Image Processor Service",
    description="Convert PNG to WebP with white background removal",
    version="1.0.0"
)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Image Processor Service is running", "port": 8003}

def remove_white_background(image: Image.Image, threshold: int = 240) -> Image.Image:
    """
    Remove only outer white background while preserving white details inside the character.
    Uses border-connected analysis to avoid removing white parts of the character.
    
    Args:
        image: PIL Image in RGBA mode
        threshold: White detection threshold (0-255, default: 240)
    
    Returns:
        PIL Image with outer white background removed
    """
    # Convert PIL image to numpy array
    img_array = np.array(image)
    height, width = img_array.shape[:2]
    
    # Create mask for white/light pixels
    white_mask = (
        (img_array[:, :, 0] > threshold) &  # Red channel
        (img_array[:, :, 1] > threshold) &  # Green channel
        (img_array[:, :, 2] > threshold)    # Blue channel
    )
    
    # If no white pixels found, return original image
    if not np.any(white_mask):
        return image
    
    # Create mask for border-connected white pixels only
    border_white_mask = np.zeros_like(white_mask, dtype=bool)
    
    # Check border pixels and mark them as background if they're white
    # Top border
    for x in range(width):
        if white_mask[0, x]:
            border_white_mask[0, x] = True
    
    # Bottom border
    for x in range(width):
        if white_mask[height-1, x]:
            border_white_mask[height-1, x] = True
    
    # Left border
    for y in range(height):
        if white_mask[y, 0]:
            border_white_mask[y, 0] = True
    
    # Right border
    for y in range(height):
        if white_mask[y, width-1]:
            border_white_mask[y, width-1] = True
    
    # Expand border-connected white regions using simple flood fill
    # This will connect white pixels that touch the border
    for y in range(height):
        for x in range(width):
            if white_mask[y, x] and not border_white_mask[y, x]:
                # Check if this white pixel is adjacent to a border-connected white pixel
                for dy in [-1, 0, 1]:
                    for dx in [-1, 0, 1]:
                        ny, nx = y + dy, x + dx
                        if (0 <= ny < height and 0 <= nx < width and 
                            border_white_mask[ny, nx]):
                            border_white_mask[y, x] = True
                            break
                    if border_white_mask[y, x]:
                        break
    
    # Set alpha channel to 0 only for border-connected white pixels
    img_array[border_white_mask, 3] = 0
    
    logger.info(f"Removed {np.sum(border_white_mask)} border-connected white pixels, "
               f"preserved {np.sum(white_mask & ~border_white_mask)} inner white pixels")
    
    # Convert back to PIL Image
    return Image.fromarray(img_array, 'RGBA')

@app.post("/create-whatsapp-sticker")
async def create_whatsapp_sticker(
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    white_threshold: int = 240
):
    """
    Create a WhatsApp-compatible sticker
    
    WhatsApp sticker requirements:
    - Size: 512x512 pixels
    - Format: WebP
    - File size: < 100KB (recommended)
    - Transparent background
    - Square aspect ratio
    
    Args:
        file: PNG/JPEG image file
        white_threshold: Threshold for white detection (0-255, default: 240 for aggressive removal)
    """
    try:
        # Obtain image data from either uploaded file or provided URL
        image_data: bytes
        src_desc = ""
        if file is not None:
            image_data = await file.read()
            src_desc = f"file={file.filename}"
        elif image_url:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(image_url)
                if resp.status_code != 200:
                    raise HTTPException(status_code=400, detail=f"Failed to fetch image_url: HTTP {resp.status_code}")
                image_data = resp.content
                src_desc = f"url={image_url}"
        else:
            raise HTTPException(status_code=400, detail="Either file or image_url must be provided")

        logger.info(f"Creating WhatsApp sticker from {src_desc}, size: {len(image_data)} bytes")
        
        # Validate file type
        if file is not None and (not file.content_type or not file.content_type.startswith('image/')):
            if len(image_data) >= 8:
                if image_data[:8] == b'\x89PNG\r\n\x1a\n':
                    logger.info("Detected PNG file from signature")
                elif image_data[:2] == b'\xff\xd8':
                    logger.info("Detected JPEG file from signature")
                else:
                    raise HTTPException(status_code=400, detail=f"File must be an image. Content type: {file.content_type}")
            else:
                raise HTTPException(status_code=400, detail=f"File too small to be an image. Content type: {file.content_type}")
        
        # Open image with PIL
        try:
            image = Image.open(io.BytesIO(image_data))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
        
        # Convert to RGBA if not already
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        
        logger.info(f"Original image size: {image.size}, mode: {image.mode}")
        
        # Remove white background
        processed_image = remove_white_background(image, white_threshold)
        logger.info(f"After background removal: size={processed_image.size}, mode={processed_image.mode}")
        
        # Resize to exactly 512x512 (WhatsApp requirement)
        processed_image = processed_image.resize((512, 512), Image.Resampling.LANCZOS)
        logger.info(f"After resize: size={processed_image.size}, mode={processed_image.mode}")
        
        # WhatsApp requires WebP format with transparency
        # Ensure we have proper RGBA mode for transparency
        if processed_image.mode != 'RGBA':
            processed_image = processed_image.convert('RGBA')
        
        # Optimize WebP compression to get under 100KB
        # Use specific WebP parameters that WhatsApp recognizes
        for quality in [90, 80, 70, 60, 50, 40]:
            output_buffer = io.BytesIO()
            processed_image.save(
                output_buffer, 
                format='WEBP', 
                quality=quality,
                method=6,  # Best compression
                lossless=False,
                exact=False,
                save_all=False,
                optimize=True,  # Enable optimization
                minimize_size=True  # Minimize file size
            )
            
            output_data = output_buffer.getvalue()
            logger.info(f"WebP quality {quality}: {len(output_data)} bytes")
            
            # If under 100KB, use this quality
            if len(output_data) < 100 * 1024:  # 100KB
                break
        
        logger.info(f"Final WhatsApp sticker size: {len(output_data)} bytes")
        
        # Derive a safe filename base from file or URL
        if file is not None and getattr(file, 'filename', None):
            base_name = file.filename
        elif image_url:
            base_name = os.path.basename(urlparse(image_url).path) or 'image'
        else:
            base_name = 'image'

        # Return WebP image with WhatsApp-specific headers
        return Response(
            content=output_data,
            media_type="image/webp",
            headers={
                "Content-Disposition": f"attachment; filename=sticker-{base_name}.webp",
                "X-Sticker-Type": "whatsapp",
                "X-Sticker-Size": str(len(output_data)),
                "X-Sticker-Dimensions": "512x512",
                "X-Sticker-Format": "WEBP",
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "public, max-age=31536000"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating WhatsApp sticker: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8003,
        reload=True,
        log_level="info"
    )