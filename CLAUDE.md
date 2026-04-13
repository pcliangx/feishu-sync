# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**feishu-sync** — Sync Markdown files to Feishu documents with Mermaid diagram rendering.

- Node.js ESM module targeting ES2022
- TypeScript with strict mode
- Entry: `src/index.ts` (CLI) and `src/skill.ts` (core sync logic)

## Commands

```bash
npm run build   # Compile TypeScript → dist/
npm run start   # Run compiled output (node dist/index.js)
npm run dev     # Run directly with tsx (no compile step)
```

**Required env vars:**
- `FEISHU_APP_ID` — Feishu application ID
- `FEISHU_APP_SECRET` — Feishu application secret
- `FEISHU_FOLDER_TOKEN` — optional folder token for document location

## Architecture

```
src/
├── index.ts          # CLI entry point
├── skill.ts          # Core sync orchestration (syncMarkdownToFeishu)
├── config/index.ts   # Environment variable loader
├── feishu/
│   ├── client.ts     # Lark SDK client singleton
│   ├── document.ts   # Create new Feishu documents
│   ├── blocks.ts     # Block type constants and builders
│   └── media.ts      # Upload images to Feishu via drive.media.uploadAll
├── markdown/
│   ├── extractor.ts  # Extract mermaid code blocks and image refs
│   ├── parser.ts     # marked-based markdown parser
│   └── transformer.ts # Convert markdown to Feishu block format
└── diagrams/
    ├── detector.ts   # Detect mermaid blocks in content
    ├── renderer.ts   # Render mermaid → PNG/SVG via mermaid.ink API
    └── uploader.ts   # Render + upload mermaid to Feishu
```

## Key Patterns

**Sync workflow (`src/skill.ts:syncMarkdownToFeishu`):**
1. Read markdown file
2. Create new Feishu document via API
3. Extract `mermaid` code blocks and render each to PNG via `mermaid.ink`
4. Upload rendered PNGs to Feishu, get `fileToken` for each
5. Convert markdown to Feishu blocks (replacing mermaid placeholders with image blocks)
6. Insert blocks in batches of 50 (Feishu API limit)

**Block insertion batching (`src/index.ts:85-107`):** Feishu's docx API accepts ~50 blocks per request. The sync iterates through blocks in `BATCH_SIZE = 50` chunks.

**Mermaid rendering:** Uses `https://mermaid.ink/img/{base64}` API — free, no auth required. The rendered PNG is uploaded to Feishu and replaced in the block tree.

**Image upload:** Uses `client.drive.media.uploadAll()` with `parent_type: 'docx_image'` and `parent_node: documentToken`.

**Feishu API raw requests:** The SDK's typed methods are bypassed in favor of raw `client.request()` calls for document and block creation endpoints (`src/feishu/document.ts:32`, `src/index.ts:89`).