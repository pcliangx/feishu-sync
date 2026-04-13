/**
 * Detect diagram blocks in markdown
 */

import type { MermaidBlock } from '../markdown/extractor.js';

/**
 * Check if a code block is a mermaid diagram
 */
export function isMermaidBlock(lang: string | undefined, code: string): boolean {
  if (!lang) return false;

  const lowerLang = lang.toLowerCase();
  return lowerLang === 'mermaid';
}

/**
 * Detect all mermaid blocks from markdown content
 * This is used for pre-processing before sending to Feishu convert API
 */
export function detectMermaidBlocks(content: string): MermaidBlock[] {
  const pattern = /```mermaid\s*([\s\S]*?)```/g;
  const blocks: MermaidBlock[] = [];
  let match;
  let counter = 0;

  while ((match = pattern.exec(content)) !== null) {
    blocks.push({
      code: match[1].trim(),
      index: match.index,
      length: match[0].length,
      placeholderId: `mermaid_${Date.now()}_${++counter}`,
    });
  }

  return blocks;
}
