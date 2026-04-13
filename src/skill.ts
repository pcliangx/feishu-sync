/**
 * Main skill orchestration for Feishu Markdown Sync
 */

import { readFile } from 'fs/promises';
import { createDocument } from './feishu/document.js';
import { getClient } from './feishu/client.js';
import { extractMermaidBlocks, extractAndReplaceMermaid } from './markdown/extractor.js';
import { renderMermaidToPng } from './diagrams/renderer.js';
import { uploadImage } from './feishu/media.js';
import { markdownToBlocks, type Block } from './markdown/transformer.js';

export interface SyncOptions {
  markdownFile: string;
  targetDocumentId?: string;
  title?: string;
}

export interface SyncResult {
  success: boolean;
  documentId?: string;
  documentTitle?: string;
  mermaidDiagramsRendered: number;
  error?: string;
}

interface BlockCreateResponse {
  code?: number;
  msg?: string;
}

/**
 * Main sync function
 */
export async function syncMarkdownToFeishu(options: SyncOptions): Promise<SyncResult> {
  const { markdownFile, title } = options;

  try {
    // Read markdown file
    const markdownContent = await readFile(markdownFile, 'utf-8');

    // Extract title from first heading if not provided
    const documentTitle = title || extractTitle(markdownContent) || 'Untitled';

    // Create new document first
    const { documentId } = await createDocument(documentTitle);

    console.log(`Created document: ${documentTitle} (${documentId})`);

    // Extract mermaid blocks and replace with placeholders
    const { modifiedMarkdown, mermaidBlocks } = extractAndReplaceMermaid(markdownContent);
    console.log(`Found ${mermaidBlocks.length} mermaid diagram(s)`);

    // Mermaid data with rendered PNG buffers and dimensions
    interface MermaidData {
      placeholderId: string;
      buffer: Buffer;
      width: number;
      height: number;
    }
    const mermaidDataList: MermaidData[] = [];
    for (let i = 0; i < mermaidBlocks.length; i++) {
      const block = mermaidBlocks[i];
      try {
        console.log(`Rendering mermaid diagram ${i + 1}...`);
        const { buffer, width, height } = await renderMermaidToPng(block.code);
        mermaidDataList.push({
          placeholderId: block.placeholderId,
          buffer,
          width,
          height,
        });
        console.log(`Mermaid ${i + 1} dimensions: ${width}x${height}`);
      } catch (error) {
        console.error(`Failed to render mermaid diagram ${i + 1}:`, error);
      }
    }

    // Convert markdown to Feishu blocks (using modified markdown with placeholders)
    // Image blocks will be created with actual dimensions
    console.log(`Converting markdown to Feishu blocks...`);
    const mermaidPlaceholders = mermaidDataList.map(d => ({
      placeholderId: d.placeholderId,
      width: d.width,
      height: d.height,
    }));
    const blocks = markdownToBlocks(modifiedMarkdown, mermaidPlaceholders);
    console.log(`Generated ${blocks.length} blocks`);
    const imageBlocks = blocks.filter(b => b.block_type === 27);
    console.log(`Image blocks found: ${imageBlocks.length}`);
    const tableBlocks = blocks.filter(b => b.block_type === 31);
    console.log(`Table blocks found: ${tableBlocks.length}`);

    // Upload blocks to document
    const client = getClient() as any;

    // Insert blocks in batches (Feishu API limit is around 50 per request)
    const BATCH_SIZE = 50;
    let insertedBlocks = 0;

    // Collect image block IDs in order (index in blocks array → block_id)
    const imageBlockIdMap: Map<number, string> = new Map();
    let imageBlockCount = 0;

    for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
      const batch = blocks.slice(i, i + BATCH_SIZE);
      const batchStartIdx = i;

      try {
        const result = await client.request({
          url: `/open-apis/docx/v1/documents/${documentId}/blocks/${documentId}/children`,
          method: 'POST',
          data: {
            children: batch,
            index: i,
          },
        }) as any;

        if (result.code !== 0 && result.code !== undefined) {
          console.log(`Batch ${i / BATCH_SIZE + 1} response code: ${result.code}, msg: ${result.msg}`);
        }

        // Collect image block IDs from this batch
        const children = result.data?.children || [];
        children.forEach((child: any, localIdx: number) => {
          if (child.block_type === 27) {
            const globalIdx = batchStartIdx + localIdx;
            imageBlockIdMap.set(globalIdx, child.block_id);
          }
        });

        insertedBlocks += batch.length;
        console.log(`Inserted blocks ${insertedBlocks}/${blocks.length}`);
      } catch (batchError: any) {
        console.error(`Failed to insert batch ${i / BATCH_SIZE + 1}:`, batchError.message);
        if (batchError.response?.data) {
          console.error(`API error details:`, JSON.stringify(batchError.response.data));
        }
      }
    }

    // Now upload mermaid images with block_id as parent and call replace_image
    console.log(`Uploading and associating mermaid images...`);
    let pngIdx = 0;
    for (const [blockIdx, blockId] of imageBlockIdMap) {
      if (pngIdx < mermaidDataList.length && mermaidDataList[pngIdx].buffer.length > 0) {
        const { buffer: pngBuffer } = mermaidDataList[pngIdx];
        try {
          // Upload with block_id as parent_node (required for replace_image to work)
          const { fileToken } = await uploadImage(pngBuffer, `mermaid_${pngIdx + 1}.png`, 'image/png', blockId);

          // Associate the uploaded image with the block via replace_image
          await client.request({
            url: `/open-apis/docx/v1/documents/${documentId}/blocks/${blockId}`,
            method: 'PATCH',
            data: {
              replace_image: {
                token: fileToken,
              },
            },
          });
          console.log(`Associated mermaid diagram ${pngIdx + 1} with block`);
        } catch (err: any) {
          console.error(`Failed to upload/associate mermaid diagram ${pngIdx + 1}:`, err.message);
        }
      }
      pngIdx++;
    }

    // Update table cell contents
    if (tableBlocks.length > 0) {
      console.log(`Updating table cell contents...`);
      for (const tableBlock of tableBlocks) {
        const tableData = tableBlock.table as any;
        const rows = tableData.rows as string[][];
        const rowSize = tableData.property?.row_size || rows.length;
        const columnSize = tableData.property?.column_size || (rows[0]?.length || 0);

        try {
          // Get all document blocks to find our table
          const docBlocks = await client.request({
            url: `/open-apis/docx/v1/documents/${documentId}/blocks/${documentId}/children`,
            method: 'GET',
            params: { page_size: 200 },
          }) as any;

          // Find table blocks
          const tableBlockIds = docBlocks.data?.items
            ?.filter((b: any) => b.block_type === 31)
            ?.map((b: any) => b.block_id) || [];

          for (const tableBlockId of tableBlockIds) {
            // Get table children (cell blocks)
            const cellBlocks = await client.request({
              url: `/open-apis/docx/v1/documents/${documentId}/blocks/${tableBlockId}/children`,
              method: 'GET',
            }) as any;

            const cellIds = cellBlocks.data?.items?.map((c: any) => c.block_id) || [];

            // Update each cell with content
            let cellIndex = 0;
            for (let r = 0; r < rowSize && cellIndex < cellIds.length; r++) {
              for (let c = 0; c < columnSize && cellIndex < cellIds.length; c++) {
                const cellId = cellIds[cellIndex];
                const cellContent = rows[r]?.[c] || '';

                // Get the paragraph block inside the cell
                const cellInfo = await client.request({
                  url: `/open-apis/docx/v1/documents/${documentId}/blocks/${cellId}`,
                  method: 'GET',
                }) as any;

                const paraId = cellInfo.data?.block?.children?.[0];
                if (paraId) {
                  // Update the paragraph with cell content
                  await client.request({
                    url: `/open-apis/docx/v1/documents/${documentId}/blocks/${paraId}`,
                    method: 'PATCH',
                    data: {
                      update_text_elements: {
                        elements: [{ text_run: { content: cellContent } }],
                      },
                    },
                  });
                }
                cellIndex++;
              }
            }
          }
          console.log(`Updated table with ${rowSize} rows x ${columnSize} columns`);
        } catch (tableError: any) {
          console.error(`Failed to update table contents:`, tableError.message);
        }
      }
    }

    console.log(`\nSync completed successfully!`);
    console.log(`Document: ${documentTitle}`);
    console.log(`Document ID: ${documentId}`);
    console.log(`Mermaid diagrams rendered: ${mermaidBlocks.length}`);

    return {
      success: true,
      documentId,
      documentTitle,
      mermaidDiagramsRendered: mermaidBlocks.length,
    };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      success: false,
      mermaidDiagramsRendered: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract title from markdown (first H1 heading)
 */
function extractTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}
