/**
 * Feishu Block builders
 */

export interface TextRun {
  content: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: { url: string };
}

export interface Block {
  block_type: number;
  [key: string]: unknown;
}

/**
 * Block type constants (from Feishu API)
 */
export const BlockType = {
  Paragraph: 2,
  Heading1: 3,
  Heading2: 4,
  Heading3: 5,
  Code: 14,
  Image: 27,
  Table: 31,
  OrderedList: 12,
  UnorderedList: 13,
  ListItem: 9,
  Quote: 10,
  Divider: 22,
} as const;

/**
 * Build a text block (paragraph or heading)
 */
export function buildTextBlock(
  text: string,
  blockType: number = BlockType.Paragraph,
  style?: { bold?: boolean; italic?: boolean }
): Block {
  const elements = [
    {
      text_run: {
        content: text,
        ...(style?.bold && { bold: true }),
        ...(style?.italic && { italic: true }),
      },
    },
  ];

  return {
    block_type: blockType,
    ...(blockType === BlockType.Paragraph && { paragraph: { elements } }),
    ...(blockType === BlockType.Heading1 && { heading1: { elements } }),
    ...(blockType === BlockType.Heading2 && { heading2: { elements } }),
    ...(blockType === BlockType.Heading3 && { heading3: { elements } }),
  };
}

/**
 * Build a code block
 */
export function buildCodeBlock(code: string, language?: string): Block {
  return {
    block_type: BlockType.Code,
    code: {
      elements: [
        {
          text_run: { content: code },
        },
      ],
      property: {
        language: language || 'plaintext',
      },
    },
  };
}

/**
 * Build an image block
 */
export function buildImageBlock(fileToken: string, width?: number, height?: number): Block {
  return {
    block_type: BlockType.Image,
    image: {
      file_token: fileToken,
      width: width || 600,
      height: height || 400,
    },
  };
}

/**
 * Build a divider block
 */
export function buildDividerBlock(): Block {
  return {
    block_type: BlockType.Divider,
    divider: {},
  };
}
