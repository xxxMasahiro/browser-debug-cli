#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCT_IDENTITY } from '../src/product-identity.js';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

await main();

async function main() {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
  if (packageJson.name !== PRODUCT_IDENTITY.packageName || packageJson.version !== PRODUCT_IDENTITY.packageVersion) {
    throw new Error('package.json name/version does not match PRODUCT_IDENTITY.');
  }

  await runInherit('npm', [
    'pack',
    '--dry-run',
    '--json',
    '--cache',
    path.join(tmpdir(), PRODUCT_IDENTITY.npmCacheDirectoryName)
  ]);
}

function runInherit(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}
