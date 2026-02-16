/**
 * Navigation Brain
 * Core logic for GUI navigation learning and execution
 */

import { randomUUID } from "crypto";
import type { BrainStorage } from "./storage/BrainStorage.js";
import type { LLMManager } from "../llm/LLMManager.js";
import { StateHasher } from "./utils/StateHasher.js";
import { VLMAnalyzer } from "./utils/VLMAnalyzer.js";
import { OCRFactory } from "../utils/ocr/OCRFactory.js";
import { MouseController } from "../utils/automation/MouseController.js";
import { KeyboardController } from "../utils/automation/KeyboardController.js";
import type { OCRAnalysis } from "../core/types.js";
import type {
  NodeId,
  Node,
  Path,
  PathVerification,
  Action,
  ActionData,
  NavigationGraph,
  ShadowDOM,
} from "./types.js";
import { nodeIdToKey } from "./types.js";
import { Monitor } from "node-screenshots";
import { delay } from "../utils/delay.js";

/**
 * Main brain class for GUI navigation
 */
export class NavigationBrain {
  private graph: NavigationGraph | null = null;
  private vlmAnalyzer: VLMAnalyzer;

  /** Current screen state (runtime only, not persisted) */
  private shadowDOM: ShadowDOM | null = null;

  constructor(
    private storage: BrainStorage,
    private llmManager: LLMManager,
  ) {
    this.vlmAnalyzer = new VLMAnalyzer(llmManager);
  }

  /**
   * Capture screen as PNG buffer
   */
  private captureScreenBuffer(): Buffer {
    const monitors = Monitor.all();
    const primaryMonitor = monitors[0];
    const image = primaryMonitor.captureImageSync();
    return image.toPngSync();
  }

  /**
   * Initialize the brain (load graph from storage)
   */
  async initialize(): Promise<boolean> {
    try {
      this.graph = await this.storage.load();

      // Initialize Spotlight as a default node if it doesn't exist
      await this.initializeSpotlightNode();

      console.log(
        `[Brain] Initialized with ${this.graph.nodes.size} nodes and ${this.graph.edges.size} edges`,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Brain] Failed to initialize: ${message}`);
      return false;
    }
  }

  /**
   * Initialize Spotlight as a default system node
   */
  private async initializeSpotlightNode(): Promise<void> {
    try {
      const spotlightNodeId: NodeId = {
        programName: "Spotlight",
        stateHash: "default",
      };

      // Check if Spotlight node already exists
      const existing = await this.storage.getNode(spotlightNodeId);
      if (existing) {
        return;
      }

      // Create default Spotlight node
      const spotlightNode: Node = {
        id: spotlightNodeId,
        metadata: {
          title: "macOS Spotlight Search",
          description: "Default system search interface accessible via Cmd+Space",
          uiElements: [
            {
              type: "input",
              text: "Spotlight Search",
            },
          ],
          createdAt: new Date(),
          lastVisitedAt: new Date(),
          visitCount: 0,
        },
        childrenIds: [],
      };

      await this.storage.addNode(spotlightNode);
      if (this.graph) {
        this.graph.nodes.set(nodeIdToKey(spotlightNodeId), spotlightNode);
      }

      console.log("[Brain] Initialized Spotlight default node");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Brain] Failed to initialize Spotlight node: ${message}`);
      throw error;
    }
  }


  /**
   * Close current application (Cmd+Q)
   */
  async closeCurrentApp(): Promise<void> {
    KeyboardController.pressKey("q", ["command"]);
    await delay(500);
    console.log("[Brain] Closed current application");
  }

  /**
   * Identify the current screen node
   */
  async identifyCurrentNode(): Promise<NodeId | null> {
    try {
      // Capture screen
      const pngBuffer = this.captureScreenBuffer();
      const base64Image = pngBuffer.toString("base64");

      // Perform OCR if supported
      let ocrData: OCRAnalysis | undefined = undefined;

      if (OCRFactory.isSupported()) {
        try {
          const ocrProvider = OCRFactory.create();
          if (ocrProvider) {
            ocrData = await ocrProvider.analyzeBuffer(pngBuffer);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.warn(`[Brain] OCR failed: ${message}`);
          // Continue without OCR data
        }
      }

      // Use VLM to extract program name and UI elements
      const programName = await this.vlmAnalyzer.extractProgramName(
        base64Image,
        ocrData,
      );
      const { elements, description } =
        await this.vlmAnalyzer.identifyUIElements(base64Image, ocrData);

      // Generate state hash
      const stateHash = StateHasher.hashElements(elements);

      const nodeId: NodeId = {
        programName,
        stateHash,
      };

      console.log(
        `[Brain] Current node: ${programName}::${stateHash} (${elements.length} elements)`,
      );
      console.log(`[Brain] Description: ${description}`);

      // Update ShadowDOM after identifying node
      await this.updateShadowDOM(nodeId);

      return nodeId;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Brain] Failed to identify current node: ${message}`);
      return null;
    }
  }

  /**
   * Update ShadowDOM with current screen state
   * Called after: node navigation complete, each action execution
   */
  private async updateShadowDOM(nodeId: NodeId): Promise<void> {
    console.log('[Brain] Updating ShadowDOM...');

    try {
      // 1. Capture screen
      const pngBuffer = this.captureScreenBuffer();
      const base64Screenshot = pngBuffer.toString('base64');

      // 2. OCR analysis
      let ocrResult: OCRAnalysis | undefined;
      if (OCRFactory.isSupported()) {
        try {
          const ocrProvider = OCRFactory.create();
          if (ocrProvider) {
            ocrResult = await ocrProvider.analyzeBuffer(pngBuffer);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[Brain] OCR failed during ShadowDOM update: ${message}`);
        }
      }

      // 3. VLM analysis for UI elements
      const { elements, description } = await this.vlmAnalyzer.identifyUIElements(
        base64Screenshot,
        ocrResult,
      );

      // 4. Generate instance hash (different from Node.stateHash)
      // Instance hash includes OCR text + element positions for uniqueness
      const instanceHash = StateHasher.hashElements(elements);

      // 5. Create ShadowDOM
      this.shadowDOM = {
        nodeId,
        capturedAt: new Date(),
        screenshot: base64Screenshot,
        uiElements: elements,
        ocrResult,
        vlmDescription: description,
        instanceHash,
      };

      console.log(
        `[Brain] ShadowDOM updated: ${elements.length} elements, instance: ${instanceHash.substring(0, 8)}...`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Brain] Failed to update ShadowDOM: ${message}`);
      this.shadowDOM = null;
    }
  }

  /**
   * Get current ShadowDOM (read-only access)
   */
  getShadowDOM(): ShadowDOM | null {
    return this.shadowDOM;
  }

  /**
   * Add a new node to the graph
   */
  async addNode(
    nodeId: NodeId,
    metadata?: Partial<Node["metadata"]>,
  ): Promise<Node | null> {
    if (!this.graph) {
      console.error("[Brain] Brain not initialized");
      return null;
    }

    try {
      // Check if node already exists
      const existing = await this.storage.getNode(nodeId);
      if (existing) {
        // Update visit count and timestamp
        existing.metadata.lastVisitedAt = new Date();
        existing.metadata.visitCount++;
        await this.storage.updateNode(existing);
        this.graph.currentNodeId = nodeId;
        return existing;
      }

      // Create new node
      const node: Node = {
        id: nodeId,
        metadata: {
          title: metadata?.title,
          screenshot: metadata?.screenshot,
          uiElements: metadata?.uiElements || [],
          description: metadata?.description,
          createdAt: new Date(),
          lastVisitedAt: new Date(),
          visitCount: 1,
        },
        childrenIds: [],
      };

      await this.storage.addNode(node);
      this.graph.nodes.set(nodeIdToKey(nodeId), node);
      this.graph.currentNodeId = nodeId;

      console.log(
        `[Brain] Added new node: ${nodeId.programName}::${nodeId.stateHash}`,
      );

      return node;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Brain] Failed to add node: ${message}`);
      return null;
    }
  }

  /**
   * Learn a path from current node to target description
   */
  async learnPath(targetDescription: string): Promise<Path | null> {
    if (!this.graph || !this.graph.currentNodeId) {
      console.error("[Brain] No current node");
      return null;
    }

    try {
      const fromNodeId = this.graph.currentNodeId;

      // Capture current screen
      const pngBuffer = this.captureScreenBuffer();
      const base64Image = pngBuffer.toString("base64");

      // Get OCR data
      let ocrData: OCRAnalysis | undefined = undefined;

      if (OCRFactory.isSupported()) {
        try {
          const ocrProvider = OCRFactory.create();
          if (ocrProvider) {
            ocrData = await ocrProvider.analyzeBuffer(pngBuffer);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.warn(`[Brain] OCR failed: ${message}`);
          // Continue without OCR data
        }
      }

      // Ask VLM how to navigate
      console.log(`[Brain] Learning path to: ${targetDescription}`);
      const { actions, confidence } =
        await this.vlmAnalyzer.learnNavigationPath(
          base64Image,
          targetDescription,
          ocrData,
        );

      if (actions.length === 0 || confidence < 0.3) {
        console.error("[Brain] VLM could not determine navigation path");
        return null;
      }

      // Convert VLM actions to our Action format
      const pathActions: Action[] = actions.map((action) => ({
        id: randomUUID(),
        data: action.data as ActionData,
        description: action.description,
        retryOnFailure: true,
      }));

      // We don't know the target node yet, so we'll use a placeholder
      // After execution, we'll update with the actual target node
      const path: Path = {
        id: randomUUID(),
        fromNodeId,
        toNodeId: { programName: "Unknown", stateHash: "pending" },
        actions: pathActions,
        validation: {
          expectedElements: [],
          timeout: 30000,
        },
        metadata: {
          successRate: 0,
          lastUsed: new Date(),
          usageCount: 0,
          averageDuration: 0,
          learnedBy: "vlm",
        },
      };

      console.log(
        `[Brain] Learned path with ${pathActions.length} actions (confidence: ${confidence})`,
      );

      return path;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Brain] Failed to learn path: ${message}`);
      return null;
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: Action): Promise<boolean> {
    try {
      console.log(
        `[Brain] Executing: ${action.data.type} - ${action.description || ""}`,
      );

      switch (action.data.type) {
        case "click": {
          const clickData = action.data;
          if (clickData.x !== undefined && clickData.y !== undefined) {
            MouseController.clickAt(
              clickData.x,
              clickData.y,
              clickData.button,
              clickData.doubleClick,
            );
          } else if (clickData.text) {
            // OCR-based click
            const pngBuffer = this.captureScreenBuffer();

            const ocrProvider = OCRFactory.create();
            if (!ocrProvider) {
              console.error("[Brain] OCR not available");
              return false;
            }

            const ocrResult = await ocrProvider.analyzeBuffer(pngBuffer);

            const matches = ocrResult.elements.filter((el) =>
              el.text.toLowerCase().includes(clickData.text!.toLowerCase()),
            );

            if (matches.length === 0) {
              console.error(`[Brain] Text "${clickData.text}" not found`);
              return false;
            }

            const bestMatch = matches.sort(
              (a, b) => b.confidence - a.confidence,
            )[0];
            if (bestMatch.bbox) {
              MouseController.clickBBoxCenter(
                bestMatch.bbox,
                clickData.button,
                clickData.doubleClick,
              );
            }
          }
          await delay(200);
          break;
        }

        case "type": {
          const typeData = action.data;
          KeyboardController.typeText(typeData.text, typeData.delay);
          if (typeData.pressEnter) {
            await delay(100);
            KeyboardController.pressEnter();
          }
          await delay(200);
          break;
        }

        case "hotkey": {
          const hotkeyData = action.data;
          KeyboardController.pressKey(hotkeyData.key, hotkeyData.modifiers);
          await delay(200);
          break;
        }


        case "wait": {
          const waitData = action.data;
          await delay(waitData.milliseconds);
          break;
        }

        case "scroll": {
          const scrollData = action.data;
          MouseController.scroll(scrollData.amount, scrollData.direction);
          await delay(200);
          break;
        }

        default:
          console.error(
            `[Brain] Unknown action type: ${(action.data as { type: string }).type}`,
          );
          return false;
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Brain] Action execution failed: ${message}`);
      return false;
    }
  }

  /**
   * Execute a path
   */
  async executePath(path: Path): Promise<boolean> {
    console.log(
      `[Brain] Executing path with ${path.actions.length} actions (success rate: ${path.metadata.successRate})`,
    );

    const startTime = Date.now();
    let success = true;

    // 검증 이력 초기화
    if (!path.verificationHistory) {
      path.verificationHistory = [];
    }

    for (let i = 0; i < path.actions.length; i++) {
      const action = path.actions[i];
      const actionSuccess = await this.executeAction(action);

      if (!actionSuccess) {
        success = false;

        // 검증 실패 기록
        path.verificationHistory.push({
          timestamp: new Date(),
          success: false,
          actionIndex: i,
          failureReason: 'Action execution failed',
        });

        if (action.retryOnFailure) {
          console.log("[Brain] Retrying action...");
          await delay(1000);
          const retrySuccess = await this.executeAction(action);

          if (retrySuccess) {
            success = true;
            continue;
          }
        }

        console.error(
          "[Brain] Path execution failed at action:",
          action.description,
        );
        break;
      }

      // 액션 성공 후 ShadowDOM 업데이트 및 화면 검증
      await delay(500); // Wait for UI to stabilize
      const currentNodeId = this.graph?.currentNodeId || path.toNodeId;
      await this.updateShadowDOM(currentNodeId);

      // Verify using existing ShadowDOM (no redundant capture)
      const verification = await this.verifyActionResult(path, i);

      path.verificationHistory.push(verification);

      if (!verification.success) {
        console.error(
          `[Brain] Verification failed after action ${i}: ${verification.failureReason}`,
        );
        success = false;
        break;
      }
    }

    // Update path metadata
    const duration = Date.now() - startTime;
    path.metadata.usageCount++;
    path.metadata.lastUsed = new Date();

    if (success) {
      path.metadata.successRate =
        (path.metadata.successRate * (path.metadata.usageCount - 1) + 1) /
        path.metadata.usageCount;
    } else {
      path.metadata.successRate =
        (path.metadata.successRate * (path.metadata.usageCount - 1)) /
        path.metadata.usageCount;
    }

    path.metadata.averageDuration =
      (path.metadata.averageDuration * (path.metadata.usageCount - 1) +
        duration) /
      path.metadata.usageCount;

    try {
      await this.storage.updatePath(path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Brain] Failed to update path metadata: ${message}`);
    }

    console.log(
      `[Brain] Path execution ${success ? "succeeded" : "failed"} (${duration}ms, success rate: ${path.metadata.successRate})`,
    );

    return success;
  }

  /**
   * Verify screen state after action execution
   * Uses existing ShadowDOM instead of re-capturing
   */
  private async verifyActionResult(
    path: Path,
    actionIndex: number,
  ): Promise<PathVerification> {
    const verification: PathVerification = {
      timestamp: new Date(),
      success: false,
      actionIndex,
    };

    try {
      // Use existing ShadowDOM instead of re-capturing
      if (!this.shadowDOM) {
        verification.failureReason = 'ShadowDOM not available for verification';
        return verification;
      }

      // Use ShadowDOM's OCR result
      if (this.shadowDOM.ocrResult) {
        verification.ocrResult = {
          fullText: this.shadowDOM.ocrResult.fullText,
          elementsFound: this.shadowDOM.ocrResult.elements.length,
        };

        // expectedText 검증
        if (path.validation.expectedText && path.validation.expectedText.length > 0) {
          const hasExpectedText = path.validation.expectedText.some((expectedText) =>
            this.shadowDOM!.ocrResult!.elements.some((el: { text: string }) =>
              el.text.toLowerCase().includes(expectedText.toLowerCase()),
            ),
          );

          if (!hasExpectedText) {
            verification.success = false;
            verification.failureReason = `Expected text not found: ${path.validation.expectedText.join(', ')}`;
            return verification;
          }
        }
      }

      // VLM 검증 (expectedElements가 있을 경우)
      if (path.validation.expectedElements.length > 0) {
        // Use ShadowDOM's screenshot
        const vlmResult = await this.vlmAnalyzer.verifyScreenState(
          this.shadowDOM.screenshot,
          path.validation.expectedElements,
          path.validation.expectedText,
        );

        verification.vlmResult = vlmResult;

        if (!vlmResult.match || vlmResult.confidence < 0.5) {
          verification.success = false;
          verification.failureReason = vlmResult.reason;
          return verification;
        }
      }

      verification.success = true;
      return verification;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      verification.success = false;
      verification.failureReason = `Verification error: ${message}`;
      return verification;
    }
  }

  /**
   * Navigate to a target node
   */
  async navigateTo(targetDescription: string): Promise<boolean> {
    if (!this.graph) {
      console.error("[Brain] Brain not initialized");
      return false;
    }

    try {
      // First, try to learn the path
      const path = await this.learnPath(targetDescription);

      if (!path) {
        console.error("[Brain] Could not learn path");
        return false;
      }

      // Execute the path (ShadowDOM updated after each action)
      const success = await this.executePath(path);

      if (success) {
        // Identify the new node (ShadowDOM updated automatically)
        await delay(1000);
        const newNodeId = await this.identifyCurrentNode();

        if (!newNodeId) {
          console.error("[Brain] Could not identify new node");
          return false;
        }

        // Update the path with the actual target node
        path.toNodeId = newNodeId;
        await this.storage.addPath(path);

        // Add the new node if it doesn't exist
        const node = await this.addNode(newNodeId);
        if (!node) {
          console.error("[Brain] Could not add new node");
          return false;
        }

        console.log("[Brain] Navigation successful!");
        return true;
      }

      console.error('[Brain] Navigation failed');
      if (path.verificationHistory && path.verificationHistory.length > 0) {
        const lastVerification = path.verificationHistory[path.verificationHistory.length - 1];
        console.error('[Brain] Last verification failure:', lastVerification.failureReason);
        console.error('[Brain] Failed at action index:', lastVerification.actionIndex);
      }
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Brain] Navigation failed: ${message}`);
      return false;
    }
  }

  /**
   * Get current node
   */
  getCurrentNodeId(): NodeId | undefined {
    return this.graph?.currentNodeId;
  }

  /**
   * Get all nodes
   */
  getAllNodes(): Node[] {
    if (!this.graph) return [];
    return Array.from(this.graph.nodes.values());
  }

  /**
   * Get all paths from a node
   */
  async getPathsFrom(nodeId: NodeId): Promise<Path[]> {
    return await this.storage.getPathsFrom(nodeId);
  }
}
