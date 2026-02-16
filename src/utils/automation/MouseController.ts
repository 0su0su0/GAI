/**
 * Mouse Controller
 * Wrapper around nut.js mouse API for GUI automation
 */

import { mouse } from '@nut-tree-fork/nut-js';
import { Point, Button } from '@nut-tree-fork/shared';
import type { BoundingBox } from '../../core/types.js';
import { CoordinateConverter } from './CoordinateConverter.js';

/**
 * Controller for mouse operations
 */
export class MouseController {
  /**
   * Convert button type to nut.js Button
   */
  private static toNutButton(button: 'left' | 'right' | 'middle'): Button {
    switch (button) {
      case 'left':
        return Button.LEFT;
      case 'right':
        return Button.RIGHT;
      case 'middle':
        return Button.MIDDLE;
    }
  }

  /**
   * Click at specific coordinates
   */
  static clickAt(
    x: number,
    y: number,
    button: 'left' | 'right' | 'middle' = 'left',
    doubleClick: boolean = false
  ): void {
    const point = new Point(x, y);
    const nutButton = this.toNutButton(button);

    // Move to position and click
    mouse.setPosition(point);

    if (doubleClick) {
      mouse.doubleClick(nutButton);
    } else {
      mouse.click(nutButton);
    }
  }

  /**
   * Click at the center of a bounding box
   */
  static clickBBoxCenter(
    bbox: BoundingBox,
    button: 'left' | 'right' | 'middle' = 'left',
    doubleClick: boolean = false
  ): void {
    // Safety check: ensure coordinates are in pixels, not normalized (0.0-1.0)
    const pixelBBox = CoordinateConverter.ensurePixelCoordinates(bbox);

    const centerX = Math.round(pixelBBox.x + pixelBBox.width / 2);
    const centerY = Math.round(pixelBBox.y + pixelBBox.height / 2);
    this.clickAt(centerX, centerY, button, doubleClick);
  }

  /**
   * Move mouse to coordinates
   */
  static moveTo(x: number, y: number): void {
    const point = new Point(x, y);
    mouse.setPosition(point);
  }

  /**
   * Get current mouse position
   */
  static getPosition(): { x: number; y: number } {
    const position = mouse.getPosition();
    return { x: position.x, y: position.y };
  }

  /**
   * Drag from one position to another
   */
  static drag(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    button: 'left' | 'right' | 'middle' = 'left'
  ): void {
    const fromPoint = new Point(fromX, fromY);
    const toPoint = new Point(toX, toY);
    const nutButton = this.toNutButton(button);

    // Move to start position
    mouse.setPosition(fromPoint);

    // Press button
    mouse.pressButton(nutButton);

    // Move to end position
    mouse.move([toPoint]);

    // Release button
    mouse.releaseButton(nutButton);
  }

  /**
   * Scroll vertically
   */
  static scroll(amount: number, direction: 'up' | 'down' = 'down'): void {
    const scrollAmount = direction === 'down' ? -amount : amount;
    mouse.scrollDown(Math.abs(scrollAmount));
  }
}
