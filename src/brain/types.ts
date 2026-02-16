/**
 * Brain Types
 * Core types for the Navigation Brain system
 */

import type { BoundingBox } from '../core/types.js';

/**
 * Node identifier in the navigation graph
 */
export interface NodeId {
  programName: string;
  stateHash: string;
}

/**
 * UI element detected on screen
 */
export interface UIElement {
  type: 'button' | 'input' | 'text' | 'image' | 'link' | 'menu' | 'other';
  text?: string;
  position?: BoundingBox;
  confidence?: number;
}

/**
 * Node in the navigation graph representing a screen state
 */
export interface Node {
  id: NodeId;
  metadata: {
    title?: string;
    screenshot?: string; // base64 encoded screenshot
    uiElements: UIElement[];
    description?: string;
    createdAt: Date;
    lastVisitedAt: Date;
    visitCount: number;
  };
  childrenIds: NodeId[];
}

/**
 * Action types for navigation
 */
export type ActionType = 'click' | 'type' | 'hotkey' | 'wait' | 'scroll' | 'spotlight';

/**
 * Action data structures
 */
export interface ClickAction {
  type: 'click';
  x?: number;
  y?: number;
  text?: string;
  button?: 'left' | 'right' | 'middle';
  doubleClick?: boolean;
}

export interface TypeAction {
  type: 'type';
  text: string;
  pressEnter?: boolean;
  delay?: number;
}

export interface HotkeyAction {
  type: 'hotkey';
  key: string | string[];
  modifiers?: Array<'command' | 'ctrl' | 'alt' | 'shift'>;
}

export interface WaitAction {
  type: 'wait';
  milliseconds: number;
}

export interface ScrollAction {
  type: 'scroll';
  amount: number;
  direction: 'up' | 'down';
}

export interface SpotlightAction {
  type: 'spotlight';
  query: string;
  pressEnter?: boolean;
}

/**
 * Union type of all action data
 */
export type ActionData =
  | ClickAction
  | TypeAction
  | HotkeyAction
  | WaitAction
  | ScrollAction
  | SpotlightAction;

/**
 * Action with metadata
 */
export interface Action {
  id: string;
  data: ActionData;
  description?: string;
  retryOnFailure?: boolean;
}

/**
 * Path verification result
 */
export interface PathVerification {
  timestamp: Date;
  success: boolean;
  actionIndex: number; // 어느 액션 후 검증했는지
  ocrResult?: {
    fullText: string;
    elementsFound: number;
  };
  vlmResult?: {
    match: boolean;
    confidence: number;
    reason: string;
  };
  failureReason?: string;
}

/**
 * ShadowDOM - Current screen state snapshot
 * Represents the concrete, dynamic state of the screen RIGHT NOW
 * Unlike Node (which represents a "place"), ShadowDOM captures specific UI elements with positions
 */
export interface ShadowDOM {
  /** Which Node this screen state belongs to */
  nodeId: NodeId;

  /** When this snapshot was captured */
  capturedAt: Date;

  /** Base64 encoded PNG screenshot */
  screenshot: string;

  /** Concrete UI elements with actual positions (bbox in pixels) */
  uiElements: UIElement[];

  /** OCR analysis result */
  ocrResult?: OCRAnalysis;

  /** VLM description of current screen */
  vlmDescription?: string;

  /** Hash of this specific screen instance (different from Node.stateHash) */
  instanceHash?: string;
}

/**
 * Serializable version for potential future persistence
 */
export interface SerializableShadowDOM {
  nodeId: NodeId;
  capturedAt: string;
  screenshot: string;
  uiElements: UIElement[];
  ocrResult?: OCRAnalysis;
  vlmDescription?: string;
  instanceHash?: string;
}

/**
 * Path between two nodes
 */
export interface Path {
  id: string;
  fromNodeId: NodeId;
  toNodeId: NodeId;
  actions: Action[];
  validation: {
    expectedElements: UIElement[];
    expectedText?: string[];
    timeout?: number;
  };
  verificationHistory?: PathVerification[];
  metadata: {
    successRate: number;
    lastUsed: Date;
    usageCount: number;
    averageDuration: number; // milliseconds
    learnedBy: 'vlm' | 'manual' | 'recorded';
  };
}

/**
 * Navigation graph containing all nodes and paths
 */
export interface NavigationGraph {
  nodes: Map<string, Node>;
  edges: Map<string, Path[]>; // fromNodeId -> paths
  currentNodeId?: NodeId;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Serializable version of Node with Date fields as strings
 */
export interface SerializableNode {
  id: NodeId;
  metadata: {
    title?: string;
    screenshot?: string;
    uiElements: UIElement[];
    description?: string;
    createdAt: string;
    lastVisitedAt: string;
    visitCount: number;
  };
  childrenIds: NodeId[];
}

/**
 * Serializable version of Path with Date fields as strings
 */
export interface SerializablePath {
  id: string;
  fromNodeId: NodeId;
  toNodeId: NodeId;
  actions: Action[];
  validation: {
    expectedElements: UIElement[];
    expectedText?: string[];
    timeout?: number;
  };
  verificationHistory?: Array<{
    timestamp: string;
    success: boolean;
    actionIndex: number;
    ocrResult?: { fullText: string; elementsFound: number };
    vlmResult?: { match: boolean; confidence: number; reason: string };
    failureReason?: string;
  }>;
  metadata: {
    successRate: number;
    lastUsed: string;
    usageCount: number;
    averageDuration: number;
    learnedBy: 'vlm' | 'manual' | 'recorded';
  };
}

/**
 * Serializable version of NavigationGraph for JSON storage
 */
export interface SerializableNavigationGraph {
  nodes: Array<[string, SerializableNode]>;
  edges: Array<[string, SerializablePath[]]>;
  currentNodeId?: NodeId;
  version: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Helper function to convert NodeId to string key
 */
export function nodeIdToKey(nodeId: NodeId): string {
  return `${nodeId.programName}::${nodeId.stateHash}`;
}

/**
 * Helper function to convert string key back to NodeId
 */
export function keyToNodeId(key: string): NodeId {
  const [programName, stateHash] = key.split('::');
  return { programName, stateHash };
}
