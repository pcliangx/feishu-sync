/**
 * Transform Markdown to Feishu blocks
 */

import { marked, Lexer, Tokens, Token } from 'marked';

export interface TextElement {
  text_run: {
    content: string;
    text_element_style?: {
      bold?: boolean;
      italic?: boolean;
      inline_code?: boolean;
      link?: { url: string };
    };
  };
}

export interface Block {
  block_type: number;
  [key: string]: any;
}

// Block types
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

interface TextRun {
  content: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: { url: string };
}

/**
 * Create a text run element
 */
function createTextRun(content: string, style?: { bold?: boolean; italic?: boolean; code?: boolean; link?: { url: string } }): TextElement {
  const textRun: TextElement['text_run'] = { content };

  if (style?.bold) {
    textRun.text_element_style = { ...textRun.text_element_style, bold: true };
  }
  if (style?.italic) {
    textRun.text_element_style = { ...textRun.text_element_style, italic: true };
  }
  if (style?.code) {
    textRun.text_element_style = { ...textRun.text_element_style, inline_code: true };
  }
  if (style?.link) {
    textRun.text_element_style = { ...textRun.text_element_style, link: style.link };
  }

  return { text_run: textRun };
}

/**
 * Recursively walk marked inline tokens and extract styled text runs
 */
function extractInlineRuns(tokens: Token[]): TextRun[] {
  const runs: TextRun[] = [];

  function processInlineToken(token: Token): void {
    switch (token.type) {
      case 'text': {
        const textToken = token as Tokens.Text;
        if (textToken.tokens && textToken.tokens.length > 0) {
          // Has nested inline tokens - recurse
          for (const child of textToken.tokens) {
            processInlineToken(child);
          }
        } else {
          // Plain text
          runs.push({ content: textToken.text });
        }
        break;
      }

      case 'strong': {
        // Bold - recurse into children with bold flag
        // collectChildRuns already adds to runs, so we just style them
        const startIdx = runs.length;
        collectChildRuns(token.tokens || []);
        for (let i = startIdx; i < runs.length; i++) {
          runs[i].bold = true;
        }
        break;
      }

      case 'em': {
        // Italic - recurse into children with italic flag
        const startIdx = runs.length;
        collectChildRuns(token.tokens || []);
        for (let i = startIdx; i < runs.length; i++) {
          runs[i].italic = true;
        }
        break;
      }

      case 'codespan': {
        runs.push({ content: token.text, code: true });
        break;
      }

      case 'link': {
        // Link - Feishu API doesn't support link in text_element_style
        // So we show the text followed by the URL in parentheses
        const startIdx = runs.length;
        collectChildRuns(token.tokens || []);
        for (let i = startIdx; i < runs.length; i++) {
          // Append URL to the text content
          runs[i].content = `${runs[i].content}（${token.href}）`;
        }
        break;
      }

      case 'image': {
        // Image - push alt text as a run (handled separately as block)
        runs.push({ content: token.text });
        break;
      }

      case 'br': {
        runs.push({ content: '\n' });
        break;
      }

      case 'del': {
        // Strikethrough - just recurse without special style
        // collectChildRuns already adds to runs
        collectChildRuns(token.tokens || []);
        break;
      }

      case 'escape': {
        runs.push({ content: token.text });
        break;
      }

      case 'html': {
        // Raw HTML in markdown - treat as plain text
        runs.push({ content: token.raw });
        break;
      }

      default:
        break;
    }
  }

  function collectChildRuns(childTokens: Token[]): TextRun[] {
    const savedLength = runs.length;
    for (const child of childTokens) {
      processInlineToken(child);
    }
    return runs.slice(savedLength);
  }

  for (const token of tokens) {
    processInlineToken(token);
  }

  return runs;
}

/**
 * Convert TextRun[] to Feishu text elements
 */
function textRunsToElements(runs: TextRun[]): TextElement[] {
  return runs.map(run => createTextRun(run.content, {
    bold: run.bold,
    italic: run.italic,
    code: run.code,
    link: run.link,
  }));
}

/**
 * Build a paragraph block with inline styles
 */
function buildParagraph(elements: TextElement[]): Block {
  return {
    block_type: BlockType.Paragraph,
    text: {
      elements,
    },
  };
}

/**
 * Build a heading block with inline styles
 * Feishu only supports 3 heading levels, so level 4+ are treated as level 3
 */
function buildHeading(text: string, level: 1 | 2 | 3 | 4 | 5 | 6, elements: TextElement[]): Block {
  // Feishu only supports heading1-3, map 4-6 to 3
  const feishuLevel = level <= 3 ? level : 3;
  const blockType = feishuLevel === 1 ? BlockType.Heading1 : feishuLevel === 2 ? BlockType.Heading2 : BlockType.Heading3;
  const key = `heading${feishuLevel}`;

  return {
    block_type: blockType,
    [key]: {
      elements,
    },
  };
}

/**
 * Build a code block
 */
function buildCode(code: string, language?: string): Block {
  return {
    block_type: BlockType.Code,
    code: {
      elements: [createTextRun(code)],
      property: {
        language: mapLanguage(language || 'plaintext'),
      },
    },
  };
}

/**
 * Build an image block (empty - token is set via replace_image after upload)
 */
function buildImage(width = 600, height = 400): Block {
  return {
    block_type: BlockType.Image,
    image: {
      width,
      height,
    },
  };
}

/**
 * Build a divider block
 */
function buildDivider(): Block {
  return {
    block_type: BlockType.Divider,
    divider: {},
  };
}

/**
 * Build a quote block (fallback to paragraph since Feishu API doesn't support quote block type)
 */
function buildQuote(elements: TextElement[]): Block {
  // Feishu API doesn't support quote block (type 10), so we convert to paragraph with a prefix
  const quotePrefix = createTextRun('❝ ');
  return {
    block_type: BlockType.Paragraph,
    text: {
      elements: [quotePrefix, ...elements],
    },
  };
}

/**
 * Build a table block for Feishu API
 * Note: Feishu creates cell blocks automatically, we just need to set row_size and column_size
 * We store rows data inside table.rows for later cell content update
 */
function buildTable(rows: string[][], columnSizes: number[]): Block {
  const rowSize = rows.length;
  const columnSize = rows[0]?.length || 0;

  return {
    block_type: BlockType.Table,
    table: {
      rows, // Store rows data for later cell content update
      property: {
        row_size: rowSize,
        column_size: columnSize,
        column_width: columnSizes.length >= columnSize ? columnSizes.slice(0, columnSize) : Array(columnSize).fill(200),
        header_row: true,
      },
    },
  };
}

/**
 * Build a table block (simplified - text representation)
 */
function buildTableAsText(rows: string[][], columnSizes: number[]): Block {
  // Calculate column widths for ASCII table
  const columnCount = rows[0]?.length || 0;
  const colWidths = columnSizes.length === columnCount
    ? columnSizes
    : rows[0]?.map((cell, i) => {
        const maxLen = Math.max(...rows.map(r => r[i]?.length || 0));
        return Math.max(maxLen, 3);
      }) || [];

  // Build ASCII table string
  const lines: string[] = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const cells = row.map((cell, i) => cell.padEnd(colWidths[i] || 10));

    if (r === 0) {
      lines.push(cells.join(' | '));
      lines.push(colWidths.map(w => '-'.repeat(w)).join('-+-'));
    }
    lines.push(cells.join(' | '));
  }

  return buildParagraph([createTextRun(lines.join('\n'))]);
}

/**
 * Map markdown language to Feishu language code
 */
function mapLanguage(lang: string): number {
  const mapping: Record<string, number> = {
    plaintext: 1,
    abc: 2,
    actionscript: 3,
    ada: 4,
    apache: 5,
    apl: 6,
    applescript: 7,
    arduino: 8,
    armasm: 9,
    ascii: 10,
    aspectj: 11,
    assembly: 12,
    autohotkey: 13,
    autoit: 14,
    avrasm: 15,
    awk: 16,
    basic: 17,
    bison: 18,
    blitzmax: 19,
    boo: 20,
    brainfuck: 21,
    c: 22,
    csharp: 23,
    cpp: 24,
    c_loadrunner: 25,
    coffeescript: 26,
    coldfusion: 27,
    d: 28,
    dart: 29,
    delphi: 30,
    diff: 31,
    div: 32,
    dos: 33,
    e: 34,
    edje: 35,
    eiffel: 36,
    elixir: 37,
    elm: 38,
    erlang: 39,
    euphoria: 40,
    ezh: 41,
    fortran: 42,
    fsharp: 43,
    freebasic: 44,
    gdb: 45,
    genero: 46,
    go: 47,
    gradle: 48,
    groovy: 49,
    gwbasic: 50,
    haskell: 51,
    haxe: 52,
    html: 53,
    idl: 54,
    ini: 55,
    intelxedx86: 56,
    java: 57,
    javascript: 58,
    json: 59,
    julia: 60,
    kotlin: 61,
    latex: 62,
    ldif: 63,
    lisp: 64,
    llvm: 65,
    login: 66,
    lua: 67,
    m68k: 68,
    makefile: 69,
    mapmanage: 70,
    markdown: 71,
    matlab: 72,
    mercury: 73,
    metafont: 74,
    make: 75,
    mumps: 76,
    mysql: 77,
    newlisp: 78,
    nginx: 79,
    nim: 80,
   免责: 81,
    nsis: 82,
    objectivec: 83,
    objeck: 84,
    ocaml: 85,
    octave: 86,
    openscript: 87,
    oracle: 88,
    oxygene: 89,
    doxygen: 90,
    php: 91,
    pike: 92,
    powershell: 94,
    prolog: 95,
    proto: 96,
    purebasic: 97,
    python: 98,
    q: 99,
    qml: 100,
    r: 101,
    racket: 102,
    rails: 103,
    rbasic: 104,
    rebol: 105,
    robots: 106,
    ruby: 107,
    rust: 108,
    sas: 109,
    scala: 110,
    scheme: 111,
    scilab: 112,
    sass: 113,
    bash: 114,
    sql: 115,
    standard: 116,
    swift: 117,
    tcl: 118,
    teraterm: 119,
    tex: 120,
    txt: 121,
    typescript: 122,
    ubot: 123,
    uniface: 124,
    uranium: 125,
    vala: 126,
    vbnet: 127,
    vbscript: 128,
    verilog: 129,
    vhdl: 130,
    vim: 131,
    wlang: 132,
    x86asm: 133,
    xl: 134,
    yaml: 135,
  };

  return mapping[lang.toLowerCase()] || 1;
}

export interface MermaidPlaceholder {
  placeholderId: string;
  width?: number;
  height?: number;
}

/**
 * Transform markdown to Feishu blocks using marked's Lexer
 */
export function markdownToBlocks(
  markdown: string,
  mermaidPlaceholders: MermaidPlaceholder[]
): Block[] {
  const blocks: Block[] = [];
  const placeholderMap = new Map(mermaidPlaceholders.map(p => [p.placeholderId, p]));

  // Use Lexer to get proper token tree
  const tokens = Lexer.lex(markdown);

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const headingToken = token as Tokens.Heading;
        const elements = textRunsToElements(extractInlineRuns(headingToken.tokens));
        blocks.push(buildHeading('', headingToken.depth as 1 | 2 | 3 | 4 | 5 | 6, elements));
        break;
      }

      case 'paragraph': {
        const paraToken = token as Tokens.Paragraph;

        // Check for mermaid placeholder directly in raw text
        const mermaidMatch = paraToken.raw.match(/<div data-type="mermaid" data-id="([^"]+)"><\/div>/);
        if (mermaidMatch) {
          const placeholderId = mermaidMatch[1];
          const placeholder = placeholderMap.get(placeholderId);
          const width = placeholder?.width || 600;
          const height = placeholder?.height || 400;
          blocks.push(buildImage(width, height));
          break;
        }

        const elements = textRunsToElements(extractInlineRuns(paraToken.tokens));
        blocks.push(buildParagraph(elements));
        break;
      }

      case 'code': {
        const codeToken = token as Tokens.Code;
        // Check if it's a mermaid block (shouldn't reach here, but handle it)
        if (codeToken.lang && codeToken.lang.toLowerCase() === 'mermaid') {
          break;
        }
        blocks.push(buildCode(codeToken.text, codeToken.lang));
        break;
      }

      case 'blockquote': {
        const quoteToken = token as Tokens.Blockquote;
        // Collect all inline content from the quote
        const allTokens: Token[] = [];
        for (const child of quoteToken.tokens) {
          if (child.type === 'paragraph') {
            allTokens.push(...(child as Tokens.Paragraph).tokens);
          }
        }
        const elements = textRunsToElements(extractInlineRuns(allTokens));
        blocks.push(buildQuote(elements));
        break;
      }

      case 'hr': {
        blocks.push(buildDivider());
        break;
      }

      case 'table': {
        const tableToken = token as Tokens.Table;
        const rows: string[][] = [];

        // Header row
        if (tableToken.header) {
          const headerRow = tableToken.header.map((cell: Tokens.TableCell) => {
            const cellTokens = cell.tokens ? extractInlineRuns(cell.tokens) : [];
            return cellTokens.map(r => r.content).join('');
          });
          rows.push(headerRow);
        }

        // Body rows
        for (const row of tableToken.rows) {
          const rowData = row.map((cell: Tokens.TableCell) => {
            const cellTokens = cell.tokens ? extractInlineRuns(cell.tokens) : [];
            return cellTokens.map(r => r.content).join('');
          });
          rows.push(rowData);
        }

// Calculate column sizes based on content
        const columnCount = rows[0]?.length || 0;
        const colWidths = rows.reduce((acc: number[], row) => {
          row.forEach((cell, i) => {
            const cellLen = cell.length * 15; // Approximate pixel width
            acc[i] = Math.max(acc[i] || 100, Math.min(cellLen, 400));
          });
          return acc;
        }, []);
        // Ensure minimum width of 100px and fill any missing columns
        const columnSizes = colWidths.map(w => Math.max(w, 100));
        while (columnSizes.length < columnCount) {
          columnSizes.push(100);
        }

        blocks.push(buildTable(rows, columnSizes));
        break;
      }

      case 'list': {
        const listToken = token as Tokens.List;
        listToken.items.forEach((item, idx) => {
          // Extract list item content
          const itemTokens: Token[] = [];
          for (const itemChild of item.tokens) {
            if (itemChild.type === 'paragraph') {
              itemTokens.push(...(itemChild as Tokens.Paragraph).tokens);
            }
          }
          const elements = textRunsToElements(extractInlineRuns(itemTokens));
          const prefix = listToken.ordered ? `${idx + 1}. ` : '• ';
          blocks.push(buildParagraph([createTextRun(prefix), ...elements]));
        });
        break;
      }

      case 'html': {
        const htmlToken = token as Tokens.HTML;
        // Check for mermaid placeholder
        const mermaidMatch = htmlToken.raw.match(/<div data-type="mermaid" data-id="([^"]+)"><\/div>/);
        if (mermaidMatch) {
          const placeholderId = mermaidMatch[1];
          const placeholder = placeholderMap.get(placeholderId);
          const width = placeholder?.width || 600;
          const height = placeholder?.height || 400;
          blocks.push(buildImage(width, height));
          break;
        }
        // Regular HTML - convert to text
        blocks.push(buildParagraph([createTextRun(htmlToken.raw)]));
        break;
      }

      case 'space': {
        // Skip whitespace-only tokens
        break;
      }

      default:
        break;
    }
  }

  return blocks;
}

/**
 * Parse markdown with marked and convert to Feishu blocks (legacy API)
 */
export function parseMarkdownToBlocks(
  markdown: string,
  mermaidPlaceholders: MermaidPlaceholder[]
): Block[] {
  // First extract mermaid blocks from markdown
  const mermaidPattern = /```mermaid\s*([\s\S]*?)```/g;
  let mermaidIndex = 0;

  // Replace mermaid blocks with placeholders
  let processedMarkdown = markdown.replace(mermaidPattern, (match, code) => {
    const placeholderId = `mermaid_${Date.now()}_${++mermaidIndex}`;
    mermaidPlaceholders.push({ placeholderId });
    return `<div data-type="mermaid" data-id="${placeholderId}"></div>`;
  });

  return markdownToBlocks(processedMarkdown, mermaidPlaceholders);
}
