import path from 'node:path';
import { CLI_NAME, PACKAGE_VERSION } from './constants.js';

export const PRODUCT_IDENTITY = Object.freeze({
  packageName: 'browser-debug-cli',
  packageVersion: PACKAGE_VERSION,
  displayName: 'Browser Debug CLI',
  cliBinName: CLI_NAME,
  cliBinPath: './bin/browser-debug.js',
  mcpBinName: `${CLI_NAME}-mcp`,
  mcpBinPath: './bin/browser-debug-mcp.js',
  mcpServerName: 'browser-debug-cli',
  pluginName: 'browser-debug-cli',
  pluginSkillPath: 'skills/browser-debug-review/SKILL.md',
  repositoryUrl: 'https://github.com/xxxMasahiro/browser-debug-cli',
  npmCacheDirectoryName: 'browser-debug-cli-npm-cache',
  packSmokeDirectoryName: 'browser-debug-cli-pack-smoke',
  packSmokeKeepEnv: 'BROWSER_DEBUG_KEEP_PACK_INSTALL_SMOKE'
});

export function packageTarballFilename(identity = PRODUCT_IDENTITY) {
  return `${tarballPackageName(identity.packageName)}-${identity.packageVersion}.tgz`;
}

export function packageInstallDirectory(nodeModules, identity = PRODUCT_IDENTITY) {
  return path.join(nodeModules, ...packageNamePathParts(identity.packageName));
}

export function packageSchemaSpecifier(schemaName, identity = PRODUCT_IDENTITY) {
  return `${identity.packageName}/schemas/${schemaName}`;
}

export function productIdentitySummary(identity = PRODUCT_IDENTITY) {
  return {
    package_name: identity.packageName,
    package_version: identity.packageVersion,
    display_name: identity.displayName,
    cli_bin_name: identity.cliBinName,
    mcp_bin_name: identity.mcpBinName,
    mcp_server_name: identity.mcpServerName,
    plugin_name: identity.pluginName,
    repository_url: identity.repositoryUrl
  };
}

function tarballPackageName(packageName) {
  return packageName.replace(/^@/u, '').replace(/\//gu, '-');
}

function packageNamePathParts(packageName) {
  return packageName.split('/').filter(Boolean);
}
