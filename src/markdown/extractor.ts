/**
 * Extract mermaid diagrams and images from markdown
 */

export interface MermaidBlock {
  code: string;
  index: number;
  length: number;
  placeholderId: string;
}

export interface ImageRef {
  url: string;
  alt?: string;
  index: number;
}

const MERMAID_PATTERN = /^```mermaid\s*([\s\S]*?)```$/gm;
const IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g;

let placeholderCounter = 0;

/**
 * Generate unique placeholder ID
 */
function generatePlaceholderId(): string {
  return `mermaid_${Date.now()}_${++placeholderCounter}`;
}

/**
 * Extract mermaid code blocks from markdown
 */
export function extractMermaidBlocks(markdown: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  let match;

  while ((match = MERMAID_PATTERN.exec(markdown)) !== null) {
    blocks.push({
      code: match[1].trim(),
      index: match.index,
      length: match[0].length,
      placeholderId: generatePlaceholderId(),
    });
  }

  return blocks;
}

/**
 * Extract image references from markdown
 */
export function extractImageRefs(markdown: string): ImageRef[] {
  const images: ImageRef[] = [];
  let match;

  while ((match = IMAGE_PATTERN.exec(markdown)) !== null) {
    images.push({
      alt: match[1],
      url: match[2],
      index: match.index,
    });
  }

  return images;
}

/**
 * Replace mermaid blocks with placeholder markers
 * Returns the modified markdown and the extracted blocks
 */
export function extractAndReplaceMermaid(
  markdown: string
): { modifiedMarkdown: string; mermaidBlocks: MermaidBlock[] } {
  const mermaidBlocks = extractMermaidBlocks(markdown);
  let modifiedMarkdown = markdown;

  // Sort by index descending to replace from end to beginning
  const sortedBlocks = [...mermaidBlocks].sort((a, b) => b.index - a.index);

  for (const block of sortedBlocks) {
    const placeholder = `<div data-type="mermaid" data-id="${block.placeholderId}"></div>`;
    modifiedMarkdown =
      modifiedMarkdown.slice(0, block.index) +
      placeholder +
      modifiedMarkdown.slice(block.index + block.length);
  }

  return { modifiedMarkdown, mermaidBlocks };
}
