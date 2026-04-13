/**
 * Markdown parser using marked
 */

import { marked } from 'marked';
import { extractAndReplaceMermaid, MermaidBlock } from './extractor.js';

export interface ParsedContent {
  html: string;
  mermaidBlocks: MermaidBlock[];
}

/**
 * Parse markdown with mermaid block extraction
 */
export function parseMarkdown(markdown: string): ParsedContent {
  // Extract mermaid blocks first
  const { modifiedMarkdown, mermaidBlocks } = extractAndReplaceMermaid(markdown);

  // Simple marked configuration
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  const html = marked.parse(modifiedMarkdown) as string;

  return {
    html,
    mermaidBlocks,
  };
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
