/**
 * Keyboard Controller
 * Wrapper around nut.js keyboard API for GUI automation
 */

import { keyboard, sleep } from "@nut-tree-fork/nut-js";
import { Key } from "@nut-tree-fork/shared";
import { isMacOS } from "../platform.js";

/**
 * Controller for keyboard operations
 */
export class KeyboardController {
  /**
   * Convert string key to nut.js Key
   */
  private static toNutKey(key: string): Key {
    const keyMap: Record<string, Key> = {
      enter: Key.Enter,
      return: Key.Enter,
      backspace: Key.Backspace,
      delete: Key.Delete,
      escape: Key.Escape,
      tab: Key.Tab,
      space: Key.Space,
      command: Key.LeftCmd,
      cmd: Key.LeftCmd,
      control: Key.LeftControl,
      ctrl: Key.LeftControl,
      alt: Key.LeftAlt,
      option: Key.LeftAlt,
      shift: Key.LeftShift,
      a: Key.A,
      b: Key.B,
      c: Key.C,
      d: Key.D,
      e: Key.E,
      f: Key.F,
      g: Key.G,
      h: Key.H,
      i: Key.I,
      j: Key.J,
      k: Key.K,
      l: Key.L,
      m: Key.M,
      n: Key.N,
      o: Key.O,
      p: Key.P,
      q: Key.Q,
      r: Key.R,
      s: Key.S,
      t: Key.T,
      u: Key.U,
      v: Key.V,
      w: Key.W,
      x: Key.X,
      y: Key.Y,
      z: Key.Z,
    };

    return keyMap[key.toLowerCase()] || Key[key as keyof typeof Key];
  }

  /**
   * Type text with optional delay between characters
   */
  static async typeText(text: string, _delay: number = 50): Promise<void> {
    // nut.js의 keyboard.type은 자동으로 텍스트를 입력
    await keyboard.type(text);
  }

  /**
   * Press a single key or key combination
   */
  static async pressKey(
    key: string | string[],
    modifiers?: Array<"command" | "ctrl" | "alt" | "shift">,
  ): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    const normalizedModifiers = this.normalizeModifiers(modifiers || []);

    // Convert to nut.js Keys
    const nutModifiers = normalizedModifiers.map((m) => this.toNutKey(m));
    const nutKeys = keys.map((k) => this.toNutKey(k));

    // 1. Press modifiers
    for (const modifier of nutModifiers) {
      await keyboard.pressKey(modifier);
    }

    // 2. OS가 modifier 키 인식할 시간
    if (nutModifiers.length > 0) {
      await sleep(50);
    }

    // 3. Press and release main keys
    for (const nutKey of nutKeys) {
      await keyboard.pressKey(nutKey);
      await sleep(20);
      await keyboard.releaseKey(nutKey);
    }

    // 4. Release modifiers 전 대기
    if (nutModifiers.length > 0) {
      await sleep(10);
    }

    // 5. Release modifiers
    for (const modifier of nutModifiers) {
      await keyboard.releaseKey(modifier);
    }
  }

  /**
   * Hold a key down
   */
  static async keyDown(key: string): Promise<void> {
    const nutKey = this.toNutKey(key);
    await keyboard.pressKey(nutKey);
  }

  /**
   * Release a key
   */
  static async keyUp(key: string): Promise<void> {
    const nutKey = this.toNutKey(key);
    await keyboard.releaseKey(nutKey);
  }

  /**
   * Press Tab key
   */
  static async pressTab(reverse: boolean = false): Promise<void> {
    if (reverse) {
      await this.pressKey("tab", ["shift"]);
    } else {
      await keyboard.pressKey(Key.Tab);
      await keyboard.releaseKey(Key.Tab);
    }
  }

  /**
   * Press Enter key
   */
  static async pressEnter(): Promise<void> {
    await keyboard.pressKey(Key.Enter);
    await keyboard.releaseKey(Key.Enter);
  }

  /**
   * Press Escape key
   */
  static async pressEscape(): Promise<void> {
    await keyboard.pressKey(Key.Escape);
    await keyboard.releaseKey(Key.Escape);
  }


  /**
   * Normalize modifier keys for cross-platform compatibility
   * On macOS: 'command' is used
   * On Windows/Linux: 'ctrl' is used instead of 'command'
   */
  private static normalizeModifiers(
    modifiers: Array<"command" | "ctrl" | "alt" | "shift">,
  ): string[] {
    return modifiers.map((modifier) => {
      if (modifier === "command") {
        // On macOS, use 'command', on other platforms use 'control'
        return isMacOS() ? "command" : "control";
      }
      if (modifier === "ctrl") {
        return "control";
      }
      return modifier;
    });
  }

  /**
   * Common shortcuts
   */
  static shortcuts = {
    copy: () => KeyboardController.pressKey("c", ["command"]),
    paste: () => KeyboardController.pressKey("v", ["command"]),
    cut: () => KeyboardController.pressKey("x", ["command"]),
    undo: () => KeyboardController.pressKey("z", ["command"]),
    redo: () => KeyboardController.pressKey("z", ["command", "shift"]),
    selectAll: () => KeyboardController.pressKey("a", ["command"]),
    save: () => KeyboardController.pressKey("s", ["command"]),
    find: () => KeyboardController.pressKey("f", ["command"]),
  };
}
