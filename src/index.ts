/**
 * CLI entry point for Feishu Sync skill
 */

import { syncMarkdownToFeishu } from './skill.js';
import { loadConfig } from './config/index.js';

interface CliArgs {
  markdownFile?: string;
  target?: string;
  title?: string;
  help?: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--target' || arg === '-t') {
      args.target = argv[++i];
    } else if (arg === '--title') {
      args.title = argv[++i];
    } else if (!arg.startsWith('-')) {
      args.markdownFile = arg;
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
feishu-sync - Sync Markdown files to Feishu documents

Usage:
  feishu-sync <markdown-file> [options]

Options:
  --target <document-id>  Target document ID to update (not yet implemented)
  --title <title>         Document title (defaults to first H1 heading)
  --help, -h              Show this help message

Environment Variables:
  FEISHU_APP_ID           Feishu application ID
  FEISHU_APP_SECRET       Feishu application secret
  FEISHU_FOLDER_TOKEN     Optional folder token for document location

Example:
  feishu-sync ./README.md
  `);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.markdownFile) {
    console.error('Error: markdown-file is required');
    printHelp();
    process.exit(1);
  }

  // Validate config
  try {
    loadConfig();
  } catch (error) {
    console.error('Configuration error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Run sync
  const result = await syncMarkdownToFeishu({
    markdownFile: args.markdownFile,
    targetDocumentId: args.target,
    title: args.title,
  });

  if (result.success) {
    console.log('\nSync completed successfully!');
    console.log(`Document: ${result.documentTitle}`);
    console.log(`Document ID: ${result.documentId}`);
    console.log(`Mermaid diagrams rendered: ${result.mermaidDiagramsRendered}`);
    process.exit(0);
  } else {
    console.error('\nSync failed:', result.error);
    process.exit(1);
  }
}

main();
