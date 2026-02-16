/**
 * OCR Factory - creates the appropriate OCR provider based on platform
 */

import type { OCRProvider } from './OCRProvider.js';
import { MacOCRProvider } from './MacOCRProvider.js';
import { getPlatform } from '../platform.js';

/**
 * Create an OCR provider for the current platform
 * Returns null if no OCR provider is available
 */
export class OCRFactory {
  /**
   * Create an appropriate OCR provider for the current platform
   */
  static create(): OCRProvider | null {
    const platform = getPlatform();

    if (platform === 'macos') {
      return new MacOCRProvider();
    }

    // TODO: Add WindowsOCRProvider when Windows support is added
    // if (platform === 'windows') {
    //   return new WindowsOCRProvider();
    // }

    // No OCR provider available for this platform
    console.warn(`No OCR provider available for platform: ${platform}`);
    return null;
  }

  /**
   * Check if OCR is supported on the current platform
   */
  static isSupported(): boolean {
    const platform = getPlatform();
    return platform === 'macos'; // || platform === 'windows' (future)
  }
}
