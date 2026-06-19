#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCT_IDENTITY, packageTarballFilename } from '../src/product-identity.js';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

await main();

async function main() {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
  if (packageJson.name !== PRODUCT_IDENTITY.packageName || packageJson.version !== PRODUCT_IDENTITY.packageVersion) {
    throw new Error('package.json name/version does not match PRODUCT_IDENTITY.');
  }
  const packDir = path.join(tmpdir(), PRODUCT_IDENTITY.packSmokeDirectoryName);
  const cacheDir = path.join(tmpdir(), PRODUCT_IDENTITY.npmCacheDirectoryName);
  const expectedTarballPath = path.join(packDir, packageTarballFilename());

  await mkdir(packDir, { recursive: true });
  await rm(expectedTarballPath, { force: true });
  const packOutput = await runCapture('npm', [
    'pack',
    '--json',
    '--pack-destination',
    packDir,
    '--cache',
    cacheDir,
    '--ignore-scripts'
  ]);
  const tarballPath = resolvePackedTarball(packOutput, expectedTarballPath);
  await access(tarballPath);
  await writeFile(path.join(packDir, 'pack.json'), packOutput.trim() || fallbackPackJson(tarballPath), 'utf8');

  await runInherit(process.execPath, [
    'tests/pack-install-smoke.test.js',
    tarballPath
  ]);
}

function resolvePackedTarball(packOutput, expectedTarballPath) {
  let filename = path.basename(expectedTarballPath);
  if (packOutput.trim()) {
    const packed = JSON.parse(packOutput)[0];
    if (!packed?.filename) {
      throw new Error('npm pack did not return a packed filename.');
    }
    filename = packed.filename;
  }
  if (filename !== path.basename(expectedTarballPath)) {
    throw new Error(`Unexpected packed filename: ${filename}`);
  }
  return path.join(path.dirname(expectedTarballPath), filename);
}

function fallbackPackJson(tarballPath) {
  return `${JSON.stringify([{
    filename: path.basename(tarballPath),
    source: 'expected_filename_fallback'
  }], null, 2)}\n`;
}

function runCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
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
