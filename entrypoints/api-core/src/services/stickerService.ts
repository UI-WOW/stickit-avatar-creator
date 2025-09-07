/**
 * Sticker generation service
 */

export interface StickerGenerationResult {
  success: boolean;
  message: string;
  originalFilename: string;
  stickerFilename: string;
  size: number;
}

export interface StickerGenerationError {
  error: string;
  details: string;
}

export class StickerService {
  /**
   * Process image for sticker generation using Python service (returns processed image buffer)
   */
  static async processImageForSticker(
    imageBuffer: ArrayBuffer,
    originalFilename: string,
    pythonServiceUrl: string
  ): Promise<ArrayBuffer> {
    try {
      console.log(`Calling Python service at: ${pythonServiceUrl}/process-image`);
      console.log(`Image buffer size: ${imageBuffer.byteLength} bytes`);
      console.log(`Filename: ${originalFilename}`);
      
      // Debug: Check the first few bytes to verify it's a PNG
      const bytes = new Uint8Array(imageBuffer.slice(0, 8));
      console.log(`First 8 bytes: ${Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
      
      // Prepare form data for Python service
      const formData = new FormData();
      
      // Create a proper file blob with correct MIME type
      const fileBlob = new Blob([imageBuffer], { 
        type: 'image/png' // Set the correct MIME type
      });
      
      formData.append('file', fileBlob, originalFilename);
      formData.append('white_threshold', '240');
      formData.append('output_size', '512');
      formData.append('quality', '90');
      
      // Call Python service
      const response = await fetch(`${pythonServiceUrl}/process-image`, {
        method: 'POST',
        body: formData
      });
      
      console.log(`Python service response status: ${response.status}`);
      console.log(`Python service response headers:`, Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Python service error response: ${errorText}`);
        throw new Error(`Python service error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const processedImageBuffer = await response.arrayBuffer();
      console.log(`Processed image buffer size: ${processedImageBuffer.byteLength} bytes`);
      return processedImageBuffer;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error in processImageForSticker: ${errorMessage}`);
      throw new Error(`Failed to process image with Python service: ${errorMessage}`);
    }
  }

  /**
   * Generate a sticker from an existing image using Python service
   */
  static async generateSticker(
    imageBuffer: ArrayBuffer,
    originalFilename: string,
    r2Bucket: R2Bucket,
    pythonServiceUrl: string
  ): Promise<StickerGenerationResult> {
    try {
      // Process the image using Python service
      const processedImageBuffer = await this.processImageForSticker(
        imageBuffer, 
        originalFilename, 
        pythonServiceUrl
      );
      
      // Generate output filename
      const outputFilename = this.generateStickerFilename(originalFilename);
      
      // Save to R2 bucket as WebP
      await r2Bucket.put(outputFilename, processedImageBuffer, {
        httpMetadata: {
          contentType: 'image/webp'
        }
      });
      
      return {
        success: true,
        message: 'Sticker generated successfully using Python image processing service',
        originalFilename,
        stickerFilename: outputFilename,
        size: processedImageBuffer.byteLength
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate sticker: ${errorMessage}`);
    }
  }

  /**
   * Generate a sticker filename from the original filename
   */
  private static generateStickerFilename(originalFilename: string): string {
    const nameWithoutExtension = originalFilename.replace(/\.[^/.]+$/, '');
    return `${nameWithoutExtension}-sticker.webp`;
  }

  /**
   * Get content type based on file extension
   */
  private static getContentType(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop();
    switch (extension) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      default:
        return 'image/png'; // Default to PNG
    }
  }

  /**
   * Retrieve a sticker from R2 storage
   */
  static async getSticker(filename: string, r2Bucket: R2Bucket): Promise<Response> {
    const sticker = await r2Bucket.get(filename);
    
    if (!sticker) {
      throw new Error(`Sticker not found: ${filename}`);
    }
    
    const arrayBuffer = await sticker.arrayBuffer();
    const contentType = sticker.httpMetadata?.contentType || 'image/webp';
    
    return new Response(arrayBuffer, {
      headers: { 
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`
      }
    });
  }
}
