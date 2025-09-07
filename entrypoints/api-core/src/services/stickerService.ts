/**
 * Sticker generation service
 */

import { ImageProcessor } from './imageProcessor.js';

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
   * Generate a sticker from an existing image
   */
  static async generateSticker(
    imageBuffer: ArrayBuffer,
    originalFilename: string,
    r2Bucket: R2Bucket
  ): Promise<StickerGenerationResult> {
    try {
      // Process the image
      const processedImageBuffer = await ImageProcessor.processImageForSticker(imageBuffer);
      
      // Generate output filename
      const outputFilename = this.generateStickerFilename(originalFilename);
      
      // Save to R2 bucket
      await r2Bucket.put(outputFilename, processedImageBuffer, {
        httpMetadata: {
          contentType: 'image/webp'
        }
      });
      
      return {
        success: true,
        message: 'Sticker generated successfully',
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
