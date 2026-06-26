import { executeCli } from './cli.js';
import { PACKAGE_VERSION } from './constants.js';
import {
  DEFAULT_MCP_PROFILE,
  MCP_PROFILES,
  MCP_TOOL_TAGS,
  getMcpTools,
  getMcpToolsByTag,
  mcpProfileMetadata,
  mcpToolToCliArgs,
  resolveMcpProfile,
  resolveMcpTool,
  validateMcpToolArgs
} from './mcp-profiles.js';
import { publicMcpTransportMetadata, resolveMcpTransportConfig } from './mcp-transport-policy.js';
import { LEGACY_ALIAS_POLICY, PRODUCT_IDENTITY, productIdentitySummary } from './product-identity.js';

export {
  DEFAULT_MCP_PROFILE,
  MCP_PROFILES,
  MCP_TOOL_TAGS,
  getMcpTools,
  getMcpToolsByTag,
  mcpProfileMetadata,
  resolveMcpProfile
};

export const MCP_TOOLS = Object.freeze(getMcpTools(DEFAULT_MCP_PROFILE));

export async function handleMcpRequest(request, context = {}) {
  if (!request || typeof request !== 'object') {
    return response(null, null, errorObject(-32600, 'Invalid Request'));
  }
  const profile = resolveMcpProfile(context.mcpProfile, context.env);
  if (!profile.ok) {
    return response(request.id, null, errorObject(-32602, profile.message));
  }
  if (request.method === 'initialize') {
    const profileMetadata = mcpProfileMetadata(profile.profile);
    return response(request.id, {
      protocolVersion: '2025-06-18',
      serverInfo: {
        name: PRODUCT_IDENTITY.mcpServerName,
        version: PACKAGE_VERSION
      },
      capabilities: {
        tools: {}
      },
      metadata: {
        ...profileMetadata,
        identity: productIdentitySummary(),
        compatibility: {
          legacy_alias_policy: LEGACY_ALIAS_POLICY,
          invoked_bin_name: context.invokedBinName ?? null,
          legacy_invocation: PRODUCT_IDENTITY.legacyMcpBins.some((entry) => entry.name === context.invokedBinName)
        },
        profile: profileMetadata
      }
    });
  }
  if (request.method === 'tools/list') {
    return response(request.id, {
      tools: getMcpTools(profile.profile),
      profile: mcpProfileMetadata(profile.profile)
    });
  }
  if (request.method === 'tools/call') {
    const toolName = request.params?.name;
    const args = request.params?.arguments ?? {};
    const result = await callTool(profile.profile, toolName, args, context);
    if (!result.ok) {
      return response(request.id, null, errorObject(-32602, result.message));
    }
    return response(request.id, {
      content: [{
        type: 'text',
        text: JSON.stringify(result.envelope, null, 2)
      }],
      structuredContent: result.envelope,
      isError: result.envelope.status === 'error'
    });
  }
  return response(request.id, null, errorObject(-32601, `Unsupported method: ${request.method}`));
}

export async function runMcpStdio(context = {}) {
  const input = await readAll(context.stdin ?? process.stdin);
  const stdout = context.stdout ?? process.stdout;
  const requests = parseRequests(input);
  for (const request of requests) {
    const output = await handleMcpRequest(request, context);
    stdout.write(`${JSON.stringify(output)}\n`);
  }
}

async function callTool(profile, name, args, context) {
  const resolved = resolveMcpTool(profile, name);
  if (!resolved.ok) {
    return { ok: false, message: resolved.message };
  }
  const validated = validateMcpToolArgs(resolved.tool, args);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }
  const cliArgs = mcpToolToCliArgs(resolved.tool, args);
  const result = await executeCli(cliArgs, {
    ...context,
    mcpProfile: resolved.profile,
    restrictWorkspaceInputs: true
  });
  return { ok: true, envelope: result.envelope };
}

export function parseMcpServerArgs(args = [], env = {}) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--profile' || arg === '--transport' || arg === '--host' || arg === '--port' || arg === '--endpoint' || arg === '--token-env' || arg === '--body-limit') {
      if (!args[index + 1]) {
        return { ok: false, message: `${arg} requires a value.` };
      }
      setServerArg(options, arg.slice(2), args[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--profile=') || arg.startsWith('--transport=') || arg.startsWith('--host=') || arg.startsWith('--port=') || arg.startsWith('--endpoint=') || arg.startsWith('--token-env=') || arg.startsWith('--body-limit=')) {
      const [key, ...valueParts] = arg.slice(2).split('=');
      setServerArg(options, key, valueParts.join('='));
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      return { ok: true, help: true };
    }
    return {
      ok: false,
      message: `Unsupported ${PRODUCT_IDENTITY.mcpBinName} argument: ${arg}`,
      details: { legacy_mcp_bin_names: PRODUCT_IDENTITY.legacyMcpBins.map((entry) => entry.name) }
    };
  }
  const resolved = resolveMcpTransportConfig(options, env);
  if (!resolved.ok) {
    return { ok: false, message: resolved.message, code: resolved.code };
  }
  return { ok: true, ...resolved.config, metadata: publicMcpTransportMetadata(resolved.config) };
}

export function mcpServerInfo(options = {}, env = {}) {
  const resolved = resolveMcpTransportConfig(options, env, { requireToken: false, includeToken: false });
  if (!resolved.ok) {
    return { ok: false, code: resolved.code, message: resolved.message };
  }
  return { ok: true, metadata: publicMcpTransportMetadata(resolved.config), config: resolved.config };
}

function setServerArg(options, key, value) {
  if (key === 'token-env') {
    options.tokenEnv = value;
    return;
  }
  if (key === 'body-limit') {
    options.bodyLimit = value;
    return;
  }
  options[key] = value;
}

function response(id, result, error = undefined) {
  const output = {
    jsonrpc: '2.0',
    id: id ?? null
  };
  if (error) {
    output.error = error;
  } else {
    output.result = result;
  }
  return output;
}

function errorObject(code, message) {
  return { code, message };
}

async function readAll(stream) {
  if (typeof stream === 'string') {
    return stream;
  }
  let input = '';
  stream.setEncoding?.('utf8');
  for await (const chunk of stream) {
    input += chunk;
  }
  return input;
}

function parseRequests(input) {
  const text = String(input ?? '').trim();
  if (!text) {
    return [];
  }
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return text
      .split(/\n+/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}
