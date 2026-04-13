/**
 * Upload rendered diagrams to Feishu
 */

import { uploadImage } from '../feishu/media.js';
import { renderMermaidToSvg, getSvgDimensions } from './renderer.js';

export interface DiagramUploadResult {
  fileToken: string;
  width: number;
  height: number;
}

/**
 * Render and upload a mermaid diagram to Feishu
 */
export async function renderAndUploadMermaid(
  code: string,
  documentToken: string,
  index: number
): Promise<DiagramUploadResult> {
  // Render mermaid to SVG
  const svg = await renderMermaidToSvg(code);
  const dimensions = getSvgDimensions(svg);

  // Convert SVG to buffer (Feishu may prefer PNG, but we try SVG first)
  const buffer = Buffer.from(svg);

  // Upload to Feishu
  const filename = `mermaid_diagram_${index}_${Date.now()}.svg`;
  const { fileToken } = await uploadImage(buffer, filename, 'image/svg+xml', documentToken);

  return {
    fileToken,
    width: dimensions.width,
    height: dimensions.height,
  };
}
