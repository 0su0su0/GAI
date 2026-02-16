/**
 * VLM Analyzer
 * Wrapper for Vision LLM analysis
 */

import type { LLMManager } from '../../llm/LLMManager.js';
import type { UIElement } from '../types.js';
import type { OCRAnalysis } from '../../core/types.js';

/**
 * Analyzes screens using Vision LLM
 */
export class VLMAnalyzer {
  constructor(private llmManager: LLMManager) {}

  /**
   * Extract program name from screen
   */
  async extractProgramName(screenshot: string, ocrData?: OCRAnalysis): Promise<string> {
    const ocrContext = ocrData
      ? `\nOCR found these texts: ${ocrData.elements.slice(0, 20).map((el) => el.text).join(', ')}`
      : '';

    const response = await this.llmManager.sendWithMode('vision', [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Identify the program/application name from this screen. Look for window titles, app names, or identifying UI elements.${ocrContext}\n\nRespond with ONLY the program name, nothing else. Examples: "Finder", "Chrome", "Terminal", "VSCode"`,
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              data: screenshot,
              media_type: 'image/png',
            },
          },
        ],
      },
    ]);

    // Extract program name from response
    const programName = response.content.trim().replace(/['"]/g, '');
    return programName || 'Unknown';
  }

  /**
   * Identify UI elements on screen
   */
  async identifyUIElements(
    screenshot: string,
    ocrData?: OCRAnalysis
  ): Promise<{ elements: UIElement[]; description: string }> {
    const ocrContext = ocrData
      ? `\n\nOCR Results:\n${JSON.stringify(ocrData.elements.slice(0, 50), null, 2)}`
      : '';

    const response = await this.llmManager.sendWithMode('vision', [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this screen and identify all UI elements. For each element, provide:
1. type: button, input, text, image, link, menu, or other
2. text: visible text on the element
3. position: approximate bounding box {x, y, width, height} if visible

Return a JSON object with:
{
  "elements": [
    {"type": "button", "text": "Submit", "position": {"x": 450, "y": 320, "width": 80, "height": 30}},
    ...
  ],
  "description": "Brief description of what this screen shows"
}${ocrContext}`,
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              data: screenshot,
              media_type: 'image/png',
            },
          },
        ],
      },
    ]);

    try {
      // Try to parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          elements: parsed.elements || [],
          description: parsed.description || '',
        };
      }
    } catch (error) {
      console.warn('Failed to parse VLM response as JSON:', error);
    }

    // Fallback: use OCR data if available
    if (ocrData) {
      return {
        elements: ocrData.elements.map((el) => ({
          type: 'text' as const,
          text: el.text,
          position: el.bbox,
          confidence: el.confidence,
        })),
        description: 'Extracted from OCR',
      };
    }

    return {
      elements: [],
      description: 'Could not analyze screen',
    };
  }

  /**
   * Learn navigation path between two screens
   */
  async learnNavigationPath(
    fromScreenshot: string,
    toDescription: string,
    fromOCR?: OCRAnalysis
  ): Promise<{
    actions: Array<{
      type: string;
      data: unknown;
      description: string;
    }>;
    confidence: number;
  }> {
    const ocrContext = fromOCR
      ? `\n\nAvailable UI elements from OCR:\n${JSON.stringify(fromOCR.elements.slice(0, 30).map((el) => ({ text: el.text, bbox: el.bbox })), null, 2)}`
      : '';

    const response = await this.llmManager.sendWithMode('vision', [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You need to navigate from the current screen to: "${toDescription}"

Analyze the current screen and provide a sequence of actions to reach the target.${ocrContext}

Available action types:
- click: {type: "click", text: "button text"} or {type: "click", x: 100, y: 200}
- type: {type: "type", text: "text to type", pressEnter: true/false}
- hotkey: {type: "hotkey", key: "c", modifiers: ["command"]}
- spotlight: {type: "spotlight", query: "Terminal", pressEnter: true}
- wait: {type: "wait", milliseconds: 500}

Return a JSON object with:
{
  "actions": [
    {
      "type": "click",
      "data": {"text": "Settings"},
      "description": "Click Settings button"
    },
    ...
  ],
  "confidence": 0.85
}

Confidence: 0-1 scale of how sure you are this will work.`,
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              data: fromScreenshot,
              media_type: 'image/png',
            },
          },
        ],
      },
    ]);

    try {
      // Try to parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          actions: parsed.actions || [],
          confidence: parsed.confidence || 0.5,
        };
      }
    } catch (error) {
      console.warn('Failed to parse VLM navigation response:', error);
    }

    return {
      actions: [],
      confidence: 0,
    };
  }

  /**
   * Verify if we've reached the expected screen
   */
  async verifyScreenState(
    screenshot: string,
    expectedElements: UIElement[],
    expectedTexts?: string[]
  ): Promise<{ match: boolean; confidence: number; reason: string }> {
    const expectedContext = `
Expected UI elements: ${JSON.stringify(expectedElements.slice(0, 10), null, 2)}
${expectedTexts ? `Expected texts: ${expectedTexts.join(', ')}` : ''}`;

    const response = await this.llmManager.sendWithMode('vision', [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Verify if this screen matches the expected state.${expectedContext}

Return JSON:
{
  "match": true/false,
  "confidence": 0-1,
  "reason": "explanation"
}`,
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              data: screenshot,
              media_type: 'image/png',
            },
          },
        ],
      },
    ]);

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          match: parsed.match || false,
          confidence: parsed.confidence || 0,
          reason: parsed.reason || '',
        };
      }
    } catch (error) {
      console.warn('Failed to parse VLM verification response:', error);
    }

    return {
      match: false,
      confidence: 0,
      reason: 'Failed to verify',
    };
  }
}
