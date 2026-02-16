/**
 * State Hasher
 * Generates unique hash for screen states based on UI elements
 */

import { createHash } from 'crypto';
import type { UIElement } from '../types.js';

/**
 * Generate a hash for the current screen state
 */
export class StateHasher {
  /**
   * Create a hash from UI elements
   */
  static hashElements(elements: UIElement[]): string {
    // Normalize and sort elements for consistent hashing
    const normalized = elements
      .map((element) => ({
        type: element.type,
        text: element.text?.toLowerCase().trim() || '',
        // Quantize position to reduce minor variations
        position: element.position
          ? {
              x: Math.floor(element.position.x / 10) * 10,
              y: Math.floor(element.position.y / 10) * 10,
              width: Math.floor(element.position.width / 10) * 10,
              height: Math.floor(element.position.height / 10) * 10,
            }
          : undefined,
      }))
      // Sort by type, then text, then position
      .sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        if (a.text !== b.text) return a.text.localeCompare(b.text);
        if (!a.position && !b.position) return 0;
        if (!a.position) return -1;
        if (!b.position) return 1;
        return a.position.x - b.position.x || a.position.y - b.position.y;
      });

    // Create a deterministic string representation
    const representation = normalized
      .map(
        (el) =>
          `${el.type}:${el.text}:${el.position ? `${el.position.x},${el.position.y},${el.position.width},${el.position.height}` : 'none'}`
      )
      .join('|');

    // Generate SHA-256 hash
    const hash = createHash('sha256');
    hash.update(representation);
    return hash.digest('hex').substring(0, 16); // Use first 16 chars for readability
  }

  /**
   * Check if two element arrays represent similar states
   * Returns similarity score (0-1)
   */
  static similarity(elements1: UIElement[], elements2: UIElement[]): number {
    const texts1 = new Set(elements1.map((el) => el.text?.toLowerCase().trim()).filter(Boolean));
    const texts2 = new Set(elements2.map((el) => el.text?.toLowerCase().trim()).filter(Boolean));

    if (texts1.size === 0 && texts2.size === 0) return 1;
    if (texts1.size === 0 || texts2.size === 0) return 0;

    // Calculate Jaccard similarity
    const intersection = new Set([...texts1].filter((x) => texts2.has(x)));
    const union = new Set([...texts1, ...texts2]);

    return intersection.size / union.size;
  }

  /**
   * Extract key features from elements for quick comparison
   */
  static extractKeyFeatures(elements: UIElement[]): {
    textCount: number;
    buttonCount: number;
    inputCount: number;
    uniqueTexts: string[];
  } {
    const uniqueTexts = new Set<string>();
    let buttonCount = 0;
    let inputCount = 0;

    for (const element of elements) {
      if (element.text) {
        uniqueTexts.add(element.text.toLowerCase().trim());
      }
      if (element.type === 'button') buttonCount++;
      if (element.type === 'input') inputCount++;
    }

    return {
      textCount: uniqueTexts.size,
      buttonCount,
      inputCount,
      uniqueTexts: Array.from(uniqueTexts).slice(0, 10), // Top 10 texts
    };
  }
}
