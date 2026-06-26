#!/usr/bin/env node
import path from 'node:path';
import { parseMcpServerArgs, runMcpStdio } from '../src/mcp.js';
import { runMcpHttp } from '../src/mcp-http-transport.js';
import { PRODUCT_IDENTITY } from '../src/product-identity.js';

const parsed = parseMcpServerArgs(process.argv.slice(2), process.env);
if (!parsed.ok) {
  process.stderr.write(`${parsed.message}\n`);
  process.exit(2);
}
if (parsed.help) {
  const invokedBinName = path.basename(process.argv[1] ?? PRODUCT_IDENTITY.mcpBinName);
  process.stdout.write([
    `Usage: ${invokedBinName} [--profile safe|full|admin]`,
    `       ${invokedBinName} --transport http --profile safe --host 127.0.0.1 --port 0`,
    '',
    `Canonical MCP bin: ${PRODUCT_IDENTITY.mcpBinName}. Legacy MCP bins: ${PRODUCT_IDENTITY.legacyMcpBins.map((entry) => entry.name).join(', ')}.`,
    'HTTP transport requires a bearer token in TRACE_CUE_MCP_HTTP_TOKEN; BROWSER_DEBUG_MCP_HTTP_TOKEN remains a legacy fallback.',
    'The default transport remains stdio for compatibility.'
  ].join('\n'));
  process.stdout.write('\n');
  process.exit(0);
}

const context = {
  cwd: process.cwd(),
  env: process.env,
  mcpProfile: parsed.profile,
  invokedBinName: PRODUCT_IDENTITY.mcpBinName,
  nodeVersion: process.versions.node,
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr
};

if (parsed.transport === 'http') {
  await runMcpHttp(parsed, context);
} else {
  await runMcpStdio(context);
}
