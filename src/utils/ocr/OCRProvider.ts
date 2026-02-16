/**
 * OCR Provider interface
 */

import type { OCRAnalysis } from '../../core/types.js';

/**
 * Abstract OCR provider interface
 */
export interface OCRProvider {
  /**
   * Analyze an image and extract text with bounding boxes
   * @param imagePath Path to the image file
   */
  analyze(imagePath: string): Promise<OCRAnalysis>;

  /**
   * Analyze an image from Buffer and extract text with bounding boxes
   * @param imageBuffer PNG image buffer
   */
  analyzeBuffer(imageBuffer: Buffer): Promise<OCRAnalysis>;

  /**
   * Check if this OCR provider is available on the current platform
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the platform this provider supports
   */
  getPlatform(): 'macos' | 'windows' | 'unsupported';
}
