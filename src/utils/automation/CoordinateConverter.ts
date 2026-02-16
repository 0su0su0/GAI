/**
 * Coordinate Converter
 * Converts normalized coordinates (0.0-1.0) to pixel coordinates
 */

import robot from 'robotjs';
import type { BoundingBox } from '../../core/types.js';

/**
 * Controller for coordinate conversion
 */
export class CoordinateConverter {
  /**
   * Cached screen size to avoid repeated system calls
   */
  private static cachedScreenSize: { width: number; height: number } | null = null;

  /**
   * Get screen resolution (cached)
   */
  static getScreenSize(): { width: number; height: number } {
    if (!this.cachedScreenSize) {
      this.cachedScreenSize = robot.getScreenSize();
    }
    return this.cachedScreenSize;
  }

  /**
   * Convert normalized coordinates (0.0-1.0) to pixel coordinates
   */
  static normalizedToPixel(normalizedBBox: BoundingBox): BoundingBox {
    const screen = this.getScreenSize();

    return {
      x: Math.round(normalizedBBox.x * screen.width),
      y: Math.round(normalizedBBox.y * screen.height),
      width: Math.round(normalizedBBox.width * screen.width),
      height: Math.round(normalizedBBox.height * screen.height),
    };
  }

  /**
   * Check if bbox appears to be normalized (all values 0-1)
   */
  static isNormalized(bbox: BoundingBox): boolean {
    return (
      bbox.x >= 0 &&
      bbox.x <= 1 &&
      bbox.y >= 0 &&
      bbox.y <= 1 &&
      bbox.width >= 0 &&
      bbox.width <= 1 &&
      bbox.height >= 0 &&
      bbox.height <= 1
    );
  }

  /**
   * Auto-detect and convert if needed
   */
  static ensurePixelCoordinates(bbox: BoundingBox): BoundingBox {
    if (this.isNormalized(bbox)) {
      return this.normalizedToPixel(bbox);
    }
    return bbox;
  }
}
