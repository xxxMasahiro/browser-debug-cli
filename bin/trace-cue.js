#!/usr/bin/env node
import { runCli } from '../src/cli.js';

const argv = process.argv.slice(2);
const exitCode = await runCli(argv, {
  cwd: process.cwd(),
  env: process.env,
  invokedBinName: 'trace-cue',
  nodeVersion: process.versions.node,
  stderr: process.stderr,
  stdinText: await maybeReadStdin(argv),
  stdout: process.stdout
});

process.exitCode = exitCode;

async function maybeReadStdin(argv) {
  const inputIndex = argv.indexOf('--input');
  const captureHandoffIndex = argv.indexOf('--capture-handoff');
  const usesStdin = argv.includes('--input=-')
    || (inputIndex !== -1 && argv[inputIndex + 1] === '-')
    || argv.includes('--capture-handoff=-')
    || (captureHandoffIndex !== -1 && argv[captureHandoffIndex + 1] === '-');
  if (!usesStdin || process.stdin.isTTY) {
    return undefined;
  }
  let text = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    text += chunk;
  }
  return text;
}
