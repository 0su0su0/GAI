/**
 * Brain Storage Interface
 * Abstract interface for storing navigation graph data
 */

import type { NavigationGraph, Node, NodeId, Path } from '../types.js';

/**
 * Interface for brain storage implementations
 */
export interface BrainStorage {
  /**
   * Load the entire navigation graph
   */
  load(): Promise<NavigationGraph>;

  /**
   * Save the entire navigation graph
   */
  save(graph: NavigationGraph): Promise<void>;

  /**
   * Add a new node to the graph
   */
  addNode(node: Node): Promise<void>;

  /**
   * Get a node by its ID
   */
  getNode(id: NodeId): Promise<Node | undefined>;

  /**
   * Update an existing node
   */
  updateNode(node: Node): Promise<void>;

  /**
   * Add a new path to the graph
   */
  addPath(path: Path): Promise<void>;

  /**
   * Get all paths from a specific node
   */
  getPathsFrom(nodeId: NodeId): Promise<Path[]>;

  /**
   * Get a specific path between two nodes
   */
  getPath(fromNodeId: NodeId, toNodeId: NodeId): Promise<Path | undefined>;

  /**
   * Update an existing path
   */
  updatePath(path: Path): Promise<void>;

  /**
   * Delete a path
   */
  deletePath(pathId: string): Promise<void>;

  /**
   * Clear all data
   */
  clear(): Promise<void>;
}
