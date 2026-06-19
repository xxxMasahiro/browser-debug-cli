import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MCP_PROFILE, mcpProfileMetadata, resolveMcpProfile } from './mcp-profiles.js';
import {
  MCP_HTTP_DEFAULT_BODY_LIMIT_BYTES,
  MCP_HTTP_DEFAULT_ENDPOINT,
  MCP_HTTP_DEFAULT_HOST,
  MCP_HTTP_DEFAULT_PROFILE,
  MCP_HTTP_DEFAULT_TOKEN_ENV,
  MCP_HTTP_PROTOCOL_VERSION,
  publicMcpTransportMetadata,
  resolveMcpTransportConfig
} from './mcp-transport-policy.js';
import { PRODUCT_IDENTITY } from './product-identity.js';

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
  const localCheckout = buildLocalCheckoutStdioConfig(args, options);
  return {
    ok: true,
    config: {
      client,
      server_name: PRODUCT_IDENTITY.mcpServerName,
      transport: 'stdio',
      profile: mcpProfileMetadata(profile.profile),
      launch: {
        command: PRODUCT_IDENTITY.mcpBinName,
        args,
        env: {}
      },
      client_connection: {
        type: 'stdio',
        command: PRODUCT_IDENTITY.mcpBinName,
        args
      },
      mcpServers: {
        [PRODUCT_IDENTITY.mcpServerName]: serverConfig
      },
      local_checkout: localCheckout,
      metadata: publicMcpTransportMetadata({
        transport: 'stdio',
        profile: profile.profile,
        local_only: true,
        external_listener: false,
        auth_required: false
      }),
      boundary: integrationBoundary('stdio'),
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
  const localCheckout = buildLocalCheckoutHttpConfig(args, config, url, options);
  return {
    ok: true,
    config: {
      client,
      server_name: PRODUCT_IDENTITY.mcpServerName,
      transport: 'http',
      profile: mcpProfileMetadata(config.profile),
      launch: {
        command: PRODUCT_IDENTITY.mcpBinName,
        args,
        env: {
          [config.tokenEnv]: TOKEN_PLACEHOLDER
        }
      },
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
      metadata: publicMcpTransportMetadata(config),
      boundary: integrationBoundary('http'),
      next_steps: httpNextSteps(config)
    }
  };
}

function integrationBoundary(transport) {
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
    provider_api_execution: false,
    agent_execution_run: false,
    socket_transport: false,
    remote_http_listener: false,
    http_full_or_admin: false,
    profile_reuse: false,
    transport
  };
}

function buildLocalCheckoutStdioConfig(args, options) {
  const launch = buildLocalCheckoutLaunch(args, {}, options);
  return {
    purpose: `Use this when ${PRODUCT_IDENTITY.mcpBinName} is not installed or not on PATH.`,
    package_root: launch.package_root,
    bin_path: launch.bin_path,
    launch: {
      command: launch.command,
      args: launch.args,
      env: launch.env
    },
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
    boundary: integrationBoundary('stdio')
  };
}

function buildLocalCheckoutHttpConfig(args, config, url, options) {
  const launch = buildLocalCheckoutLaunch(args, {
    [config.tokenEnv]: TOKEN_PLACEHOLDER
  }, options);
  return {
    purpose: `Use this launch metadata when ${PRODUCT_IDENTITY.mcpBinName} is not installed or not on PATH.`,
    package_root: launch.package_root,
    bin_path: launch.bin_path,
    launch: {
      command: launch.command,
      args: launch.args,
      env: launch.env
    },
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
    boundary: integrationBoundary('http')
  };
}

function buildLocalCheckoutLaunch(args, env, options) {
  const packageRoot = path.resolve(String(options.packageRoot ?? PACKAGE_ROOT));
  const binPath = path.resolve(packageRoot, stripLeadingDotSlash(PRODUCT_IDENTITY.mcpBinPath));
  return {
    command: String(options.nodeCommand ?? process.execPath),
    args: [binPath, ...args],
    env,
    package_root: packageRoot,
    bin_path: binPath
  };
}

function stdioNextSteps(profile) {
  return [
    `Add the mcpServers.${PRODUCT_IDENTITY.mcpServerName} object to the MCP client configuration.`,
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
    'Configure the MCP client to POST JSON-RPC requests to the emitted URL with the bearer Authorization header.'
  ];
}

function formatUrlHost(host) {
  return String(host).includes(':') ? `[${host}]` : host;
}

function stripLeadingDotSlash(value) {
  return String(value).replace(/^\.\//u, '');
}
