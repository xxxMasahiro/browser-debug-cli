import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MCP_PROFILE, mcpProfileMetadata, resolveMcpProfile } from './mcp-profiles.js';
import {
  MCP_HTTP_DEFAULT_BODY_LIMIT_BYTES,
  MCP_HTTP_DEFAULT_ENDPOINT,
  MCP_HTTP_DEFAULT_HOST,
  MCP_HTTP_DEFAULT_PROFILE,
  MCP_HTTP_DEFAULT_TOKEN_ENV,
  MCP_HTTP_LEGACY_TOKEN_ENVS,
  MCP_HTTP_PROTOCOL_VERSION,
  publicMcpTransportMetadata,
  resolveMcpTransportConfig
} from './mcp-transport-policy.js';
import { LEGACY_ALIAS_POLICY, PRODUCT_IDENTITY } from './product-identity.js';

export const MCP_HTTP_DEFAULT_CLIENT_PORT = 8765;
export const MCP_CONFIG_DEFAULT_CLIENT = 'generic';

const SUPPORTED_CLIENTS = new Set(['generic', 'codex']);
const TOKEN_PLACEHOLDER = '<set-16-or-more-character-token>';
const PACKAGE_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

export function buildMcpClientConfig(options = {}, env = {}) {
  const client = String(options.client ?? MCP_CONFIG_DEFAULT_CLIENT).trim();
  if (!SUPPORTED_CLIENTS.has(client)) {
    return {
      ok: false,
      code: 'INVALID_MCP_CLIENT',
      message: `Unsupported MCP client: ${client}. Expected one of: ${[...SUPPORTED_CLIENTS].join(', ')}.`
    };
  }

  const transport = String(options.transport ?? 'stdio').trim();
  if (transport === 'stdio') {
    return buildStdioConfig(options, client, env);
  }
  if (transport === 'http') {
    return buildHttpConfig(options, client, env);
  }
  return {
    ok: false,
    code: 'INVALID_MCP_TRANSPORT',
    message: `Unsupported MCP transport: ${transport}. Expected one of: stdio, http.`
  };
}

function buildStdioConfig(options, client, env) {
  const profileName = String(options.profile ?? MCP_HTTP_DEFAULT_PROFILE).trim();
  const profile = resolveMcpProfile(profileName, env);
  if (!profile.ok) {
    return { ok: false, code: 'INVALID_MCP_PROFILE', message: profile.message };
  }
  const args = profile.profile === DEFAULT_MCP_PROFILE ? [] : ['--profile', profile.profile];
  const serverConfig = {
    command: PRODUCT_IDENTITY.mcpBinName,
    args
  };
  const legacyMcpServers = buildLegacyInstalledMcpServers(args);
  const localCheckout = buildLocalCheckoutStdioConfig(args, options);
  return {
    ok: true,
    config: {
      client,
      server_name: PRODUCT_IDENTITY.mcpServerName,
      legacy_server_names: PRODUCT_IDENTITY.legacyMcpServerNames,
      transport: 'stdio',
      profile: mcpProfileMetadata(profile.profile),
      launch: {
        command: PRODUCT_IDENTITY.mcpBinName,
        args,
        env: {}
      },
      legacy_launches: buildLegacyInstalledLaunches(args, {}),
      client_connection: {
        type: 'stdio',
        command: PRODUCT_IDENTITY.mcpBinName,
        args
      },
      mcpServers: {
        [PRODUCT_IDENTITY.mcpServerName]: serverConfig
      },
      legacy_mcpServers: legacyMcpServers,
      local_checkout: localCheckout,
      metadata: publicMcpTransportMetadata({
        transport: 'stdio',
        profile: profile.profile,
        local_only: true,
        external_listener: false,
        auth_required: false
      }),
      compatibility: compatibilityMetadata(),
      boundary: integrationBoundary('stdio', profile.profile),
      next_steps: stdioNextSteps(profile.profile)
    }
  };
}

function buildHttpConfig(options, client, env) {
  const resolved = resolveMcpTransportConfig({
    transport: 'http',
    profile: options.profile ?? MCP_HTTP_DEFAULT_PROFILE,
    host: options.host ?? MCP_HTTP_DEFAULT_HOST,
    port: options.port ?? MCP_HTTP_DEFAULT_CLIENT_PORT,
    endpoint: options.endpoint ?? MCP_HTTP_DEFAULT_ENDPOINT,
    tokenEnv: options.tokenEnv ?? options['token-env'] ?? MCP_HTTP_DEFAULT_TOKEN_ENV,
    bodyLimit: options.bodyLimit ?? options['body-limit'] ?? MCP_HTTP_DEFAULT_BODY_LIMIT_BYTES
  }, env, { requireToken: false, includeToken: false });
  if (!resolved.ok) {
    return { ok: false, code: resolved.code, message: resolved.message };
  }
  const config = resolved.config;
  const args = [
    '--transport',
    'http',
    '--profile',
    config.profile,
    '--host',
    config.host,
    '--port',
    String(config.port),
    '--endpoint',
    config.endpoint,
    '--token-env',
    config.tokenEnv
  ];
  const url = `http://${formatUrlHost(config.host)}:${config.port}${config.endpoint}`;
  const tokenEnv = { [config.tokenEnv]: TOKEN_PLACEHOLDER };
  const localCheckout = buildLocalCheckoutHttpConfig(args, config, url, options);
  return {
    ok: true,
    config: {
      client,
      server_name: PRODUCT_IDENTITY.mcpServerName,
      legacy_server_names: PRODUCT_IDENTITY.legacyMcpServerNames,
      transport: 'http',
      profile: mcpProfileMetadata(config.profile),
      launch: {
        command: PRODUCT_IDENTITY.mcpBinName,
        args,
        env: tokenEnv
      },
      legacy_launches: buildLegacyInstalledLaunches(args, tokenEnv),
      client_connection: {
        type: 'streamable_http_subset',
        url,
        method: 'POST',
        protocol_version: MCP_HTTP_PROTOCOL_VERSION,
        headers: {
          Authorization: `Bearer \${${config.tokenEnv}}`,
          'Content-Type': 'application/json'
        }
      },
      local_checkout: localCheckout,
      metadata: {
        ...publicMcpTransportMetadata(config),
        legacy_token_envs: legacyTokenEnvsFor(config.tokenEnv)
      },
      compatibility: compatibilityMetadata(),
      boundary: integrationBoundary('http', config.profile),
      next_steps: httpNextSteps(config)
    }
  };
}

function integrationBoundary(transport, profile = MCP_HTTP_DEFAULT_PROFILE) {
  const adminStdio = transport === 'stdio' && profile === 'admin';
  return {
    local_only: true,
    external_channel: false,
    token_values_emitted: false,
    credentials_read: false,
    credentials_stored: false,
    server_started: false,
    config_file_written: false,
    shell_tools: false,
    cleanup_execution: false,
    provider_api_execution: adminStdio,
    agent_execution_run: adminStdio,
    socket_transport: false,
    remote_http_listener: false,
    http_full_or_admin: false,
    profile_reuse: false,
    transport
  };
}

function buildLocalCheckoutStdioConfig(args, options) {
  const launch = buildLocalCheckoutLaunch(args, {}, options, PRODUCT_IDENTITY.mcpBinPath);
  return {
    purpose: `Use this when ${PRODUCT_IDENTITY.mcpBinName} is not installed or not on PATH.`,
    package_root: launch.package_root,
    bin_path: launch.bin_path,
    launch: {
      command: launch.command,
      args: launch.args,
      env: launch.env
    },
    legacy_launches: buildLocalCheckoutLegacyLaunches(args, {}, options),
    client_connection: {
      type: 'stdio',
      command: launch.command,
      args: launch.args
    },
    mcpServers: {
      [PRODUCT_IDENTITY.mcpServerName]: {
        command: launch.command,
        args: launch.args
      }
    },
    legacy_mcpServers: buildLegacyLocalCheckoutMcpServers(args, options),
    boundary: integrationBoundary('stdio', args.includes('admin') ? 'admin' : MCP_HTTP_DEFAULT_PROFILE)
  };
}

function buildLocalCheckoutHttpConfig(args, config, url, options) {
  const tokenEnv = {
    [config.tokenEnv]: TOKEN_PLACEHOLDER
  };
  const launch = buildLocalCheckoutLaunch(args, tokenEnv, options, PRODUCT_IDENTITY.mcpBinPath);
  return {
    purpose: `Use this launch metadata when ${PRODUCT_IDENTITY.mcpBinName} is not installed or not on PATH.`,
    package_root: launch.package_root,
    bin_path: launch.bin_path,
    launch: {
      command: launch.command,
      args: launch.args,
      env: launch.env
    },
    legacy_launches: buildLocalCheckoutLegacyLaunches(args, tokenEnv, options),
    client_connection: {
      type: 'streamable_http_subset',
      url,
      method: 'POST',
      protocol_version: MCP_HTTP_PROTOCOL_VERSION,
      headers: {
        Authorization: `Bearer \${${config.tokenEnv}}`,
        'Content-Type': 'application/json'
      }
    },
    boundary: integrationBoundary('http', config.profile)
  };
}

function buildLegacyInstalledMcpServers(args) {
  const entries = [];
  for (const [index, legacyBin] of PRODUCT_IDENTITY.legacyMcpBins.entries()) {
    entries.push([
      PRODUCT_IDENTITY.legacyMcpServerNames[index] ?? legacyBin.name,
      {
        command: legacyBin.name,
        args
      }
    ]);
  }
  return Object.fromEntries(entries);
}

function buildLegacyLocalCheckoutMcpServers(args, options) {
  const entries = [];
  for (const [index, legacyBin] of PRODUCT_IDENTITY.legacyMcpBins.entries()) {
    const launch = buildLocalCheckoutLaunch(args, {}, options, legacyBin.path);
    entries.push([
      PRODUCT_IDENTITY.legacyMcpServerNames[index] ?? legacyBin.name,
      {
        command: launch.command,
        args: launch.args
      }
    ]);
  }
  return Object.fromEntries(entries);
}

function buildLegacyInstalledLaunches(args, env) {
  return PRODUCT_IDENTITY.legacyMcpBins.map((legacyBin, index) => ({
    server_name: PRODUCT_IDENTITY.legacyMcpServerNames[index] ?? legacyBin.name,
    command: legacyBin.name,
    args,
    env
  }));
}

function buildLocalCheckoutLegacyLaunches(args, env, options) {
  return PRODUCT_IDENTITY.legacyMcpBins.map((legacyBin, index) => {
    const launch = buildLocalCheckoutLaunch(args, env, options, legacyBin.path);
    return {
      server_name: PRODUCT_IDENTITY.legacyMcpServerNames[index] ?? legacyBin.name,
      command: launch.command,
      args: launch.args,
      env: launch.env,
      bin_path: launch.bin_path
    };
  });
}

function buildLocalCheckoutLaunch(args, env, options, binPathValue) {
  const packageRoot = path.resolve(String(options.packageRoot ?? PACKAGE_ROOT));
  const binPath = path.resolve(packageRoot, stripLeadingDotSlash(binPathValue));
  return {
    command: String(options.nodeCommand ?? process.execPath),
    args: [binPath, ...args],
    env,
    package_root: packageRoot,
    bin_path: binPath
  };
}

function compatibilityMetadata() {
  return {
    canonical: {
      server_name: PRODUCT_IDENTITY.mcpServerName,
      mcp_bin_name: PRODUCT_IDENTITY.mcpBinName
    },
    legacy: {
      server_names: PRODUCT_IDENTITY.legacyMcpServerNames,
      mcp_bin_names: PRODUCT_IDENTITY.legacyMcpBins.map((entry) => entry.name),
      artifact_roots: PRODUCT_IDENTITY.legacyArtifactRoots,
      alias_policy: LEGACY_ALIAS_POLICY
    }
  };
}

function legacyTokenEnvsFor(tokenEnv) {
  return tokenEnv === MCP_HTTP_DEFAULT_TOKEN_ENV ? MCP_HTTP_LEGACY_TOKEN_ENVS : [];
}

function stdioNextSteps(profile) {
  return [
    `Add the mcpServers.${PRODUCT_IDENTITY.mcpServerName} object to the MCP client configuration.`,
    `Existing clients that still use ${PRODUCT_IDENTITY.legacyMcpServerNames[0]} can copy config.legacy_mcpServers without changing tool permissions.`,
    `Use ${PRODUCT_IDENTITY.mcpBinName}${profile === DEFAULT_MCP_PROFILE ? '' : ` --profile ${profile}`} when the package bin is installed and on PATH.`,
    'Use config.local_checkout.mcpServers when connecting from a local checkout that is not on PATH.',
    'Use --profile safe for low-trust clients that only need no-browser, no-delete, no-provider tools.'
  ];
}

function httpNextSteps(config) {
  return [
    `Set ${config.tokenEnv} to a 16-or-more character bearer token before launch.`,
    `Start ${PRODUCT_IDENTITY.mcpBinName} ${[
      '--transport',
      'http',
      '--profile',
      config.profile,
      '--host',
      config.host,
      '--port',
      String(config.port),
      '--endpoint',
      config.endpoint
    ].join(' ')}.`,
    'Use config.local_checkout.launch when connecting from a local checkout that is not on PATH.',
    'Existing launchers may use config.legacy_launches or config.local_checkout.legacy_launches while migrating names.',
    'Configure the MCP client to POST JSON-RPC requests to the emitted URL with the bearer Authorization header.'
  ];
}

function formatUrlHost(host) {
  return String(host).includes(':') ? `[${host}]` : host;
}

function stripLeadingDotSlash(value) {
  return String(value).replace(/^\.\//u, '');
}
