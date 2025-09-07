export class StickerService {
  /**
   * Process image for sticker generation by passing a public URL to Python service
   */
  static async processImageFromUrl(
    imageUrl: string,
    pythonServiceUrl: string
  ): Promise<Response> {
    try {
      console.log(`Calling Python service (URL) at: ${pythonServiceUrl}/create-whatsapp-sticker`);
      console.log(`Image URL: ${imageUrl}`);

      const formData = new FormData();
      formData.append('image_url', imageUrl);

      const response = await fetch(`${pythonServiceUrl}/create-whatsapp-sticker`, {
        method: 'POST',
        body: formData
      });

      console.log(`Python service (URL) response status: ${response.status}`);
      console.log(`Python service (URL) response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Python service (URL) error response: ${errorText}`);
        throw new Error(`Python service error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error in processImageFromUrl: ${errorMessage}`);
      throw new Error(`Failed to process image URL with Python service: ${errorMessage}`);
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
