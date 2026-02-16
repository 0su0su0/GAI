/**
 * macOS OCR Provider using Vision Framework
 */

import macOCR from '@cherrystudio/mac-system-ocr';
import type { OCRProvider } from './OCRProvider.js';
import type { OCRAnalysis, OCRResult } from '../../core/types.js';
import { isMacOS } from '../platform.js';
import { CoordinateConverter } from '../automation/CoordinateConverter.js';

/**
 * macOS OCR provider using the Vision Framework
 */
export class MacOCRProvider implements OCRProvider {
  /**
   * Analyze an image using macOS Vision Framework
   */
  async analyze(imagePath: string): Promise<OCRAnalysis> {
    if (!this.isAvailable()) {
      throw new Error('MacOCRProvider is only available on macOS');
    }

    try {
      // Use MacOCR.recognizeFromPath static method
      const result = await macOCR.recognizeFromPath(imagePath);

      // Extract full text
      const fullText = result.text || '';

      // Convert observations to OCRResult format
      const elements: OCRResult[] = [];

      if (result.observations && Array.isArray(result.observations)) {
        for (const obs of result.observations) {
          elements.push({
            text: obs.text || '',
            confidence: obs.confidence || 0,
            // Vision Framework returns normalized coordinates (0.0-1.0) → convert to pixels
            bbox: CoordinateConverter.normalizedToPixel({
              x: obs.x || 0,
              y: obs.y || 0,
              width: obs.width || 0,
              height: obs.height || 0,
            }),
          });
        }
      }

      return {
        fullText,
        elements,
        platform: 'macos',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`macOS OCR failed: ${message}`);
    }
  }

  /**
   * Analyze an image from Buffer using macOS Vision Framework
   */
  async analyzeBuffer(imageBuffer: Buffer): Promise<OCRAnalysis> {
    if (!this.isAvailable()) {
      throw new Error('MacOCRProvider is only available on macOS');
    }

    try {
      // Use MacOCR.recognizeFromBuffer static method
      const result = await macOCR.recognizeFromBuffer(imageBuffer);

      // Extract full text
      const fullText = result.text || '';

      // Convert observations to OCRResult format
      const elements: OCRResult[] = [];

      if (result.observations && Array.isArray(result.observations)) {
        for (const obs of result.observations) {
          elements.push({
            text: obs.text || '',
            confidence: obs.confidence || 0,
            // Vision Framework returns normalized coordinates (0.0-1.0) → convert to pixels
            bbox: CoordinateConverter.normalizedToPixel({
              x: obs.x || 0,
              y: obs.y || 0,
              width: obs.width || 0,
              height: obs.height || 0,
            }),
          });
        }
      }

      return {
        fullText,
        elements,
        platform: 'macos',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`macOS OCR failed: ${message}`);
    }
  }

  /**
   * Check if macOS Vision Framework is available
   */
  async isAvailable(): Promise<boolean> {
    return isMacOS();
  }

  /**
   * Get the platform this provider supports
   */
  getPlatform(): 'macos' {
    return 'macos';
  }
}
