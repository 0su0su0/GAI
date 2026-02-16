/**
 * Platform detection utilities
 */

export type Platform = 'macos' | 'windows' | 'linux' | 'unknown';

/**
 * Get the current platform
 */
export function getPlatform(): Platform {
  const platform = process.platform;

  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';

  return 'unknown';
}

/**
 * Check if the current platform supports native OCR
 */
export function isOCRSupported(): boolean {
  const platform = getPlatform();
  return platform === 'macos' || platform === 'windows';
}

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  return getPlatform() === 'macos';
}

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
  return getPlatform() === 'windows';
}

/**
 * Check if running on Linux
 */
export function isLinux(): boolean {
  return getPlatform() === 'linux';
}
