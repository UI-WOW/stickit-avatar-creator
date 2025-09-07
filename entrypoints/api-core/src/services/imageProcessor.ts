/**
 * Image processing utilities for sticker generation
 */

export interface ProcessImageOptions {
  width?: number;
  height?: number;
  whiteThreshold?: number;
  outputFormat?: 'webp' | 'png';
  quality?: number;
}

export class ImageProcessor {
  private static readonly DEFAULT_OPTIONS: Required<ProcessImageOptions> = {
    width: 512,
    height: 512,
    whiteThreshold: 240,
    outputFormat: 'webp',
    quality: 0.9
  };

  /**
   * Process image to remove white background and resize
   */
  static async processImageForSticker(
    imageBuffer: ArrayBuffer,
    options: ProcessImageOptions = {}
  ): Promise<ArrayBuffer> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    try {
      // Create a new Image object
      const img = new Image();
      
      // Convert ArrayBuffer to base64 data URL
      const base64 = this.arrayBufferToBase64(imageBuffer);
      const dataUrl = `data:image/png;base64,${base64}`;
      
      return new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = new OffscreenCanvas(opts.width, opts.height);
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('Could not get canvas context'));
              return;
            }
            
            // Draw and scale image
            ctx.drawImage(img, 0, 0, opts.width, opts.height);
            
            // Get image data for processing
            const imageData = ctx.getImageData(0, 0, opts.width, opts.height);
            const data = imageData.data;
            
            // Remove white background
            this.removeWhiteBackground(data, opts.whiteThreshold);
            
            // Put modified data back
            ctx.putImageData(imageData, 0, 0);
            
            // Convert to desired format
            const mimeType = opts.outputFormat === 'webp' ? 'image/webp' : 'image/png';
            canvas.convertToBlob({ 
              type: mimeType, 
              quality: opts.quality 
            })
              .then(blob => {
                blob.arrayBuffer().then(resolve).catch(reject);
              })
              .catch(reject);
            
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        img.src = dataUrl;
      });
      
    } catch (error) {
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Remove white background by setting alpha to 0 for white pixels
   */
  private static removeWhiteBackground(
    data: Uint8ClampedArray, 
    threshold: number
  ): void {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      
      // Check if pixel is white (or very close to white)
      if (r > threshold && g > threshold && b > threshold) {
        data[i + 3] = 0; // Set alpha to 0 (transparent)
      }
    }
  }
}
