/**
 * macOS permissions management using node-mac-permissions
 */

import permissions from 'node-mac-permissions';
import { isMacOS } from '../platform.js';

export type PermissionStatus = 'authorized' | 'denied' | 'restricted' | 'not determined';

/**
 * macOS permissions manager
 */
export class MacPermissions {
  /**
   * Check Accessibility permission status
   */
  static checkAccessibility(): PermissionStatus {
    if (!isMacOS()) {
      return 'not determined';
    }

    return permissions.getAuthStatus('accessibility') as PermissionStatus;
  }

  /**
   * Request Accessibility permission
   * This will open System Preferences
   */
  static requestAccessibility(): void {
    if (!isMacOS()) {
      console.warn('Accessibility permissions are only required on macOS');
      return;
    }

    if (this.checkAccessibility() !== 'authorized') {
      permissions.askForAccessibilityAccess();
      console.log('Please grant Accessibility permission in System Preferences');
    }
  }

  /**
   * Check Screen Recording permission status
   */
  static checkScreenRecording(): PermissionStatus {
    if (!isMacOS()) {
      return 'not determined';
    }

    return permissions.getAuthStatus('screen') as PermissionStatus;
  }

  /**
   * Request Screen Recording permission
   * Note: This requires an actual screen capture attempt to trigger the permission dialog
   */
  static requestScreenRecording(): void {
    if (!isMacOS()) {
      console.warn('Screen Recording permissions are only required on macOS');
      return;
    }

    console.log('Screen Recording permission will be requested on first screen capture');
    console.log('Please grant Screen Recording permission when prompted');
  }

  /**
   * Check if all required permissions are granted
   */
  static checkAllPermissions(): {
    accessibility: PermissionStatus;
    screenRecording: PermissionStatus;
    allGranted: boolean;
  } {
    const accessibility = this.checkAccessibility();
    const screenRecording = this.checkScreenRecording();

    return {
      accessibility,
      screenRecording,
      allGranted: accessibility === 'authorized' && screenRecording === 'authorized',
    };
  }

  /**
   * Request all required permissions
   */
  static requestAllPermissions(): void {
    if (!isMacOS()) {
      console.warn('Permissions are only required on macOS');
      return;
    }

    console.log('\n=== macOS Permissions Required ===');
    console.log('This application needs the following permissions:');
    console.log('1. Accessibility - to control mouse and keyboard');
    console.log('2. Screen Recording - to capture screen');
    console.log('==================================\n');

    this.requestAccessibility();
    this.requestScreenRecording();
  }
}
