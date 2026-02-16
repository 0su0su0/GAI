/**
 * Get Current Node Tool
 * Returns information about the current screen node
 */

import { ToolBase } from '../../tools/ToolBase.js';
import type { NavigationBrain } from '../NavigationBrain.js';
import type { ToolResult, ToolInput } from '../../core/types.js';

/**
 * Tool for getting current node information
 */
export class GetCurrentNodeTool extends ToolBase {
  readonly name = 'get_current_node';
  readonly description =
    'Get information about the current screen state, including program name, UI elements, and available navigation paths.';

  readonly inputSchema = {
    type: 'object',
    properties: {},
  };

  constructor(private brain: NavigationBrain) {
    super();
  }

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      this.validateInput(input);

      console.log('[GetCurrentNodeTool] Identifying current node...');

      // Identify current node
      const nodeId = await this.brain.identifyCurrentNode();

      // Get available paths from this node
      const paths = await this.brain.getPathsFrom(nodeId);

      // Get all nodes for context
      const allNodes = this.brain.getAllNodes();

      return {
        success: true,
        data: JSON.stringify({
          currentNode: {
            programName: nodeId.programName,
            stateHash: nodeId.stateHash,
            key: `${nodeId.programName}::${nodeId.stateHash}`,
          },
          availablePaths: paths.map((path) => ({
            id: path.id,
            to: `${path.toNodeId.programName}::${path.toNodeId.stateHash}`,
            actions: path.actions.length,
            successRate: path.metadata.successRate,
            usageCount: path.metadata.usageCount,
          })),
          graphStats: {
            totalNodes: allNodes.length,
            totalPaths: paths.length,
          },
        }),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to get current node: ${message}`,
      };
    }
  }
}
