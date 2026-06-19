#!/usr/bin/env node
import { parseMcpServerArgs, runMcpStdio } from '../src/mcp.js';
import { PRODUCT_IDENTITY } from '../src/product-identity.js';

const parsed = parseMcpServerArgs(process.argv.slice(2), process.env);
if (!parsed.ok) {
  process.stderr.write(`${parsed.message}\n`);
  process.exit(2);
}
if (parsed.help) {
  process.stdout.write(`Usage: ${PRODUCT_IDENTITY.mcpBinName} [--profile safe|full|admin]\n`);
  process.exit(0);
}

await runMcpStdio({
  cwd: process.cwd(),
  env: process.env,
  mcpProfile: parsed.profile,
  nodeVersion: process.versions.node,
  stdin: process.stdin,
  stdout: process.stdout
});
