/**
 * Feishu Document operations
 */

import { getClient } from './client.js';
import { loadConfig } from '../config/index.js';

export interface CreateDocumentResult {
  documentId: string;
  title: string;
}

interface DocumentCreateResponse {
  code?: number;
  msg?: string;
  data?: {
    document?: {
      document_id?: string;
      title?: string;
    };
  };
}

/**
 * Create a new Feishu document
 */
export async function createDocument(title: string): Promise<CreateDocumentResult> {
  const client = getClient();
  const config = loadConfig();

  // Use the SDK's request method for document creation
  const result = await (client as any).request({
    url: '/open-apis/docx/v1/documents',
    method: 'POST',
    data: {
      title,
      folder_token: config.folderToken,
    },
  }) as DocumentCreateResponse;

  const documentId = result.data?.document?.document_id;
  if (!documentId) {
    throw new Error('Failed to create document: no document_id returned');
  }

  return {
    documentId,
    title,
  };
}
