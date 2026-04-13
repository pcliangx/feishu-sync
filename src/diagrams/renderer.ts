/**
 * Render mermaid diagrams to PNG using external API
 * Uses mermaid.ink or kroki as the rendering service
 */

import https from 'https';
import http from 'http';

/**
 * Render mermaid code to PNG buffer via mermaid.ink API
 * @param code - Mermaid diagram code
 * @returns PNG buffer with dimensions
 */
export async function renderMermaidToPng(code: string): Promise<{ buffer: Buffer; width: number; height: number }> {
  // Encode the mermaid code for URL (mermaid.ink requires base64url encoding)
  const encodedCode = Buffer.from(code).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Use mermaid.ink API - free, no auth needed
  const url = `https://mermaid.ink/img/${encodedCode}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 1000 && buffer.toString().startsWith('<')) {
          // Probably an error HTML response
          reject(new Error(`Mermaid rendering failed: ${buffer.toString().slice(0, 200)}`));
        } else {
          // Parse PNG dimensions from buffer
          const dims = getPngDimensions(buffer);
          resolve({ buffer, ...dims });
        }
      });

      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Get PNG dimensions from buffer
 * PNG header: signature (8 bytes) + IHDR chunk (25 bytes)
 * IHDR data contains width (4 bytes) and height (4 bytes) at bytes 8-15
 */
function getPngDimensions(buffer: Buffer): { width: number; height: number } {
  // Check minimum buffer size
  if (buffer.length < 24) {
    return { width: 600, height: 400 }; // fallback
  }

  // Check PNG signature (89 50 4E 47 0D 0A 1A 0A)
  const pngSig = buffer.slice(0, 8);
  if (pngSig[0] === 0x89 && pngSig[1] === 0x50 && pngSig[2] === 0x4E && pngSig[3] === 0x47) {
    // PNG format - IHDR chunk starts at byte 8
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  // Check JPEG signature (FF D8 FF)
  const jpegSig = buffer.slice(0, 3);
  if (jpegSig[0] === 0xFF && jpegSig[1] === 0xD8 && jpegSig[2] === 0xFF) {
    // JPEG format - need to find SOF marker
    return getJpegDimensions(buffer);
  }

  return { width: 600, height: 400 }; // fallback
}

/**
 * Get JPEG dimensions from buffer
 * JPEG uses markers - SOF0/SOF2 markers contain dimensions
 * After SOI (FF D8), skip length bytes, then SOF marker (FF C0-FF CF except C4,C8,CC)
 * At SOF: FF Cn -> length(2) -> precision(1) -> height(2) -> width(2)
 */
function getJpegDimensions(buffer: Buffer): { width: number; height: number } {
  let i = 2; // Skip SOI marker (FF D8)
  while (i < buffer.length - 1) {
    // Find marker (FF xx)
    if (buffer[i] !== 0xFF) {
      i++;
      continue;
    }
    const marker = buffer[i + 1];
    // SOF markers: SOF0=0xC0, SOF1=0xC1, SOF2=0xC2, etc.
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      // Found SOF marker - dimensions are at i+5 (height) and i+7 (width)
      if (i + 9 <= buffer.length) {
        const height = buffer.readUInt16BE(i + 5);
        const width = buffer.readUInt16BE(i + 7);
        return { width, height };
      }
    }
    // Skip to next marker - read length from bytes i+2, i+3 (length INCLUDES the 2 length bytes)
    if (i + 4 <= buffer.length) {
      const length = buffer.readUInt16BE(i + 2);
      i += length;
    } else {
      break;
    }
  }
  return { width: 600, height: 400 }; // fallback
}

/**
 * Render mermaid code to SVG string via mermaid.ink API
 * @param code - Mermaid diagram code
 * @returns SVG string
 */
export async function renderMermaidToSvg(code: string): Promise<string> {
  // Encode the mermaid code for URL (mermaid.ink requires base64url encoding)
  const encodedCode = Buffer.from(code).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Use mermaid.ink API for SVG
  const url = `https://mermaid.ink/svg/${encodedCode}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const str = buffer.toString('utf-8');
        if (str.startsWith('<')) {
          resolve(str);
        } else {
          reject(new Error(`Mermaid SVG rendering failed: ${str.slice(0, 200)}`));
        }
      });

      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Get SVG dimensions
 */
export function getSvgDimensions(svg: string): { width: number; height: number } {
  const widthMatch = svg.match(/width="(\d+)/);
  const heightMatch = svg.match(/height="(\d+)/);

  return {
    width: widthMatch ? parseInt(widthMatch[1], 10) : 600,
    height: heightMatch ? parseInt(heightMatch[1], 10) : 400,
  };
}
