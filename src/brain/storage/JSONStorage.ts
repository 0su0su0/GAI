/**
 * JSON Storage Implementation
 * Stores navigation graph in JSON file
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { BrainStorage } from './BrainStorage.js';
import type {
  NavigationGraph,
  Node,
  NodeId,
  Path,
  SerializableNavigationGraph,
  SerializableNode,
  SerializablePath,
} from '../types.js';
import { nodeIdToKey, keyToNodeId } from '../types.js';

/**
 * JSON file-based storage implementation
 */
export class JSONStorage implements BrainStorage {
  private filePath: string;
  private graph: NavigationGraph | null = null;

  constructor(filePath: string = 'data/brain/navigation.json') {
    this.filePath = filePath;
  }

  /**
   * Load navigation graph from JSON file
   */
  async load(): Promise<NavigationGraph> {
    if (this.graph) {
      return this.graph;
    }

    // Check if file exists
    if (!existsSync(this.filePath)) {
      // Create empty graph
      this.graph = this.createEmptyGraph();
      await this.save(this.graph);
      return this.graph;
    }

    try {
      const data = readFileSync(this.filePath, 'utf-8');
      const serializable: SerializableNavigationGraph = JSON.parse(data);

      // Convert serializable format back to Map
      this.graph = {
        nodes: new Map(
          serializable.nodes.map(([key, node]) => [
            key,
            {
              ...node,
              metadata: {
                ...node.metadata,
                createdAt: new Date(node.metadata.createdAt),
                lastVisitedAt: new Date(node.metadata.lastVisitedAt),
              },
            },
          ])
        ),
        edges: new Map(
          serializable.edges.map(([key, paths]) => [
            key,
            paths.map((path) => ({
              ...path,
              metadata: {
                ...path.metadata,
                lastUsed: new Date(path.metadata.lastUsed),
              },
            })),
          ])
        ),
        currentNodeId: serializable.currentNodeId,
        version: serializable.version,
        createdAt: new Date(serializable.createdAt),
        updatedAt: new Date(serializable.updatedAt),
      };

      return this.graph;
    } catch (error) {
      console.error('Failed to load navigation graph:', error);
      // Return empty graph on error
      this.graph = this.createEmptyGraph();
      return this.graph;
    }
  }

  /**
   * Save navigation graph to JSON file
   */
  async save(graph: NavigationGraph): Promise<void> {
    this.graph = graph;
    this.graph.updatedAt = new Date();

    // Convert Map to serializable format
    const serializable: SerializableNavigationGraph = {
      nodes: Array.from(graph.nodes.entries()).map(([key, node]) => [
        key,
        {
          ...node,
          metadata: {
            ...node.metadata,
            createdAt: node.metadata.createdAt.toISOString(),
            lastVisitedAt: node.metadata.lastVisitedAt.toISOString(),
          },
        },
      ]),
      edges: Array.from(graph.edges.entries()).map(([key, paths]) => [
        key,
        paths.map((path) => ({
          ...path,
          metadata: {
            ...path.metadata,
            lastUsed: path.metadata.lastUsed.toISOString(),
          },
        })),
      ]),
      currentNodeId: graph.currentNodeId,
      version: graph.version,
      createdAt: graph.createdAt.toISOString(),
      updatedAt: graph.updatedAt.toISOString(),
    };

    // Ensure directory exists
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write to file
    writeFileSync(this.filePath, JSON.stringify(serializable, null, 2), 'utf-8');
  }

  /**
   * Add a new node
   */
  async addNode(node: Node): Promise<void> {
    const graph = await this.load();
    const key = nodeIdToKey(node.id);
    graph.nodes.set(key, node);
    await this.save(graph);
  }

  /**
   * Get a node by ID
   */
  async getNode(id: NodeId): Promise<Node | undefined> {
    const graph = await this.load();
    const key = nodeIdToKey(id);
    return graph.nodes.get(key);
  }

  /**
   * Update an existing node
   */
  async updateNode(node: Node): Promise<void> {
    await this.addNode(node);
  }

  /**
   * Add a new path
   */
  async addPath(path: Path): Promise<void> {
    const graph = await this.load();
    const fromKey = nodeIdToKey(path.fromNodeId);

    // Get existing paths or create new array
    const paths = graph.edges.get(fromKey) || [];

    // Check if path already exists
    const existingIndex = paths.findIndex(
      (p) => p.id === path.id || nodeIdToKey(p.toNodeId) === nodeIdToKey(path.toNodeId)
    );

    if (existingIndex >= 0) {
      // Update existing path
      paths[existingIndex] = path;
    } else {
      // Add new path
      paths.push(path);
    }

    graph.edges.set(fromKey, paths);
    await this.save(graph);
  }

  /**
   * Get all paths from a node
   */
  async getPathsFrom(nodeId: NodeId): Promise<Path[]> {
    const graph = await this.load();
    const key = nodeIdToKey(nodeId);
    return graph.edges.get(key) || [];
  }

  /**
   * Get a specific path between two nodes
   */
  async getPath(fromNodeId: NodeId, toNodeId: NodeId): Promise<Path | undefined> {
    const paths = await this.getPathsFrom(fromNodeId);
    const toKey = nodeIdToKey(toNodeId);
    return paths.find((p) => nodeIdToKey(p.toNodeId) === toKey);
  }

  /**
   * Update an existing path
   */
  async updatePath(path: Path): Promise<void> {
    await this.addPath(path);
  }

  /**
   * Delete a path
   */
  async deletePath(pathId: string): Promise<void> {
    const graph = await this.load();

    // Find and remove the path
    for (const [key, paths] of graph.edges.entries()) {
      const filtered = paths.filter((p) => p.id !== pathId);
      if (filtered.length !== paths.length) {
        graph.edges.set(key, filtered);
        await this.save(graph);
        return;
      }
    }
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.graph = this.createEmptyGraph();
    await this.save(this.graph);
  }

  /**
   * Create an empty navigation graph
   */
  private createEmptyGraph(): NavigationGraph {
    return {
      nodes: new Map(),
      edges: new Map(),
      currentNodeId: undefined,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
