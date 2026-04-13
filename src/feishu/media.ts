/**
 * Feishu Media upload operations
 */

import { getClient } from './client.js';

export interface UploadResult {
  fileToken: string;
}

interface MediaUploadResponse {
  code?: number;
  msg?: string;
  file_token?: string;
  data?: {
    file_token?: string;
  };
}

/**
 * Upload an image to Feishu
 * @param buffer - Image buffer (PNG, JPEG, SVG, etc.)
 * @param filename - Name for the file
 * @param mimeType - MIME type (e.g., 'image/png', 'image/svg+xml')
 * @param documentToken - Document token for docx_image parent_type
 */
export async function uploadImage(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  documentToken: string
): Promise<UploadResult> {
  const client = getClient();

  const fileType = mimeToFileType(mimeType);

  const result = await (client.drive.media as any).uploadAll({
    data: {
      file_name: filename,
      file_type: fileType,
      file: buffer,
      parent_type: 'docx_image',
      parent_node: documentToken,
      size: buffer.length,
    },
  }) as MediaUploadResponse;

  // API returns file_token at top level or in data
  const fileToken = result.file_token || result.data?.file_token;
  if (!fileToken) {
    throw new Error(`Failed to upload image: ${JSON.stringify(result)}`);
  }

  return { fileToken };
}

function mimeToFileType(mimeType: string): string {
  const mapping: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  };

  return mapping[mimeType] || 'png';
}
