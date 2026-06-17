#!/usr/bin/env node
import { runCli } from '../src/cli.js';

const exitCode = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  nodeVersion: process.versions.node,
  stderr: process.stderr,
  stdout: process.stdout
});

process.exitCode = exitCode;
