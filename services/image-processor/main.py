"""
FastAPI service for image processing - PNG to WebP with background removal
Runs on port 8002
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import Response
from PIL import Image, ImageChops
import io
import uvicorn
from typing import Optional
import logging

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

@app.post("/test-upload")
async def test_upload(file: UploadFile = File(...)):
    """Test endpoint to debug file uploads"""
    try:
        image_data = await file.read()
        return {
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(image_data),
            "first_8_bytes": [hex(b) for b in image_data[:8]] if len(image_data) >= 8 else [],
            "is_png": image_data[:8] == b'\x89PNG\r\n\x1a\n' if len(image_data) >= 8 else False,
            "is_jpeg": image_data[:2] == b'\xff\xd8' if len(image_data) >= 2 else False
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/process-image")
async def process_image(
    file: UploadFile = File(...),
    white_threshold: int = 240,
    output_size: int = 512,
    quality: int = 90
):
    """
    Process PNG image to WebP with white background removal
    
    Args:
        file: PNG image file
        white_threshold: Threshold for white detection (0-255, default: 240)
        output_size: Output image size in pixels (default: 512)
        quality: WebP quality (1-100, default: 90)
    
    Returns:
        WebP image with transparent background
    """
    try:
        # Read image data first
        image_data = await file.read()
        logger.info(f"Processing image: {file.filename}, size: {len(image_data)} bytes")
        logger.info(f"Content type: {file.content_type}")
        
        # Validate file type - be more flexible
        if not file.content_type or not file.content_type.startswith('image/'):
            # Try to detect image type from file signature
            if len(image_data) >= 8:
                # Check PNG signature
                if image_data[:8] == b'\x89PNG\r\n\x1a\n':
                    logger.info("Detected PNG file from signature")
                # Check JPEG signature
                elif image_data[:2] == b'\xff\xd8':
                    logger.info("Detected JPEG file from signature")
                else:
                    logger.warning(f"Unknown file signature: {image_data[:8]}")
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
        
        # Resize to target size (WhatsApp stickers should be 512x512)
        processed_image = processed_image.resize((output_size, output_size), Image.Resampling.LANCZOS)
        
        # Convert to WebP with WhatsApp sticker requirements
        output_buffer = io.BytesIO()
        processed_image.save(
            output_buffer, 
            format='WEBP', 
            quality=quality,
            method=6,  # Best compression
            lossless=False,  # Use lossy compression for smaller file size
            exact=False,  # Allow format conversion
            save_all=False  # Single frame only
        )
        
        output_data = output_buffer.getvalue()
        logger.info(f"Processed image size: {len(output_data)} bytes")
        
        # Return WebP image with proper headers for WhatsApp stickers
        return Response(
            content=output_data,
            media_type="image/webp",
            headers={
                "Content-Disposition": f"inline; filename=sticker-{file.filename or 'image'}.webp",
                "X-Sticker-Type": "whatsapp",  # Custom header to indicate it's a sticker
                "Cache-Control": "public, max-age=31536000"  # Cache for 1 year
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

def remove_white_background(image: Image.Image, threshold: int = 240) -> Image.Image:
    """
    Remove white background from image by making white pixels transparent
    
    Args:
        image: PIL Image in RGBA mode
        threshold: White detection threshold (0-255)
    
    Returns:
        PIL Image with white background removed
    """
    # Convert to numpy array for faster processing
    import numpy as np
    
    # Convert PIL image to numpy array
    img_array = np.array(image)
    
    # Create mask for white pixels
    # White pixels are those where R, G, B are all above threshold
    white_mask = (
        (img_array[:, :, 0] > threshold) &  # Red channel
        (img_array[:, :, 1] > threshold) &  # Green channel
        (img_array[:, :, 2] > threshold)    # Blue channel
    )
    
    # Set alpha channel to 0 for white pixels
    img_array[white_mask, 3] = 0
    
    # Convert back to PIL Image
    return Image.fromarray(img_array, 'RGBA')

@app.post("/process-image-advanced")
async def process_image_advanced(
    file: UploadFile = File(...),
    white_threshold: int = 240,
    output_size: int = 512,
    quality: int = 90,
    use_edge_detection: bool = False
):
    """
    Advanced image processing with optional edge detection for better background removal
    
    Args:
        file: PNG image file
        white_threshold: Threshold for white detection (0-255, default: 240)
        output_size: Output image size in pixels (default: 512)
        quality: WebP quality (1-100, default: 90)
        use_edge_detection: Use edge detection for better background removal
    
    Returns:
        WebP image with transparent background
    """
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read image data
        image_data = await file.read()
        logger.info(f"Advanced processing image: {file.filename}, size: {len(image_data)} bytes")
        
        # Open image with PIL
        try:
            image = Image.open(io.BytesIO(image_data))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
        
        # Convert to RGBA if not already
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        
        logger.info(f"Original image size: {image.size}, mode: {image.mode}")
        
        # Remove white background with advanced method
        if use_edge_detection:
            processed_image = remove_white_background_advanced(image, white_threshold)
        else:
            processed_image = remove_white_background(image, white_threshold)
        
        # Resize to target size (WhatsApp stickers should be 512x512)
        processed_image = processed_image.resize((output_size, output_size), Image.Resampling.LANCZOS)
        
        # Convert to WebP with WhatsApp sticker requirements
        output_buffer = io.BytesIO()
        processed_image.save(
            output_buffer, 
            format='WEBP', 
            quality=quality,
            method=6,  # Best compression
            lossless=False,  # Use lossy compression for smaller file size
            exact=False,  # Allow format conversion
            save_all=False  # Single frame only
        )
        
        output_data = output_buffer.getvalue()
        logger.info(f"Advanced processed image size: {len(output_data)} bytes")
        
        # Return WebP image with proper headers for WhatsApp stickers
        return Response(
            content=output_data,
            media_type="image/webp",
            headers={
                "Content-Disposition": f"inline; filename=sticker-advanced-{file.filename or 'image'}.webp",
                "X-Sticker-Type": "whatsapp",  # Custom header to indicate it's a sticker
                "Cache-Control": "public, max-age=31536000"  # Cache for 1 year
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in advanced processing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

def remove_white_background_advanced(image: Image.Image, threshold: int = 240) -> Image.Image:
    """
    Advanced white background removal using edge detection and morphological operations
    
    Args:
        image: PIL Image in RGBA mode
        threshold: White detection threshold (0-255)
    
    Returns:
        PIL Image with white background removed
    """
    try:
        import cv2
        import numpy as np
        
        # Convert PIL to OpenCV format
        img_array = np.array(image)
        img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGRA)
        
        # Create mask for white pixels
        white_mask = (
            (img_cv[:, :, 0] > threshold) &  # Blue channel
            (img_cv[:, :, 1] > threshold) &  # Green channel
            (img_cv[:, :, 2] > threshold)    # Red channel
        )
        
        # Use morphological operations to clean up the mask
        kernel = np.ones((3, 3), np.uint8)
        white_mask = cv2.morphologyEx(white_mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel)
        white_mask = cv2.morphologyEx(white_mask, cv2.MORPH_OPEN, kernel)
        
        # Apply mask to alpha channel
        img_cv[:, :, 3] = np.where(white_mask, 0, img_cv[:, :, 3])
        
        # Convert back to PIL
        img_rgba = cv2.cvtColor(img_cv, cv2.COLOR_BGRA2RGBA)
        return Image.fromarray(img_rgba, 'RGBA')
        
    except ImportError:
        logger.warning("OpenCV not available, falling back to basic method")
        return remove_white_background(image, threshold)
    except Exception as e:
        logger.error(f"Error in advanced processing: {str(e)}")
        return remove_white_background(image, threshold)

@app.post("/create-whatsapp-sticker")
async def create_whatsapp_sticker(
    file: UploadFile = File(...),
    white_threshold: int = 240,
    format_type: str = "webp"  # "webp" or "png"
):
    """
    Create a WhatsApp-compatible sticker
    
    WhatsApp sticker requirements:
    - Size: 512x512 pixels
    - Format: WebP
    - File size: < 100KB (recommended)
    - Transparent background
    - Square aspect ratio
    """
    try:
        # Read image data first
        image_data = await file.read()
        logger.info(f"Creating WhatsApp sticker: {file.filename}, size: {len(image_data)} bytes")
        
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
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
        
        # Return WebP image with WhatsApp-specific headers
        return Response(
            content=output_data,
            media_type="image/webp",
            headers={
                "Content-Disposition": f"attachment; filename=sticker-{file.filename or 'image'}.webp",
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
