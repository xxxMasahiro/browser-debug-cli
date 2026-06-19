import { executeCli } from './cli.js';
import { PACKAGE_VERSION } from './constants.js';
import {
  DEFAULT_MCP_PROFILE,
  MCP_PROFILES,
  getMcpTools,
  mcpProfileMetadata,
  mcpToolToCliArgs,
  resolveMcpProfile,
  resolveMcpTool
} from './mcp-profiles.js';
import { PRODUCT_IDENTITY, productIdentitySummary } from './product-identity.js';

export { DEFAULT_MCP_PROFILE, MCP_PROFILES, getMcpTools, mcpProfileMetadata, resolveMcpProfile };

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
  const cliArgs = mcpToolToCliArgs(resolved.tool, args);
  const result = await executeCli(cliArgs, {
    ...context,
    mcpProfile: resolved.profile,
    restrictWorkspaceInputs: true
  });
  return { ok: true, envelope: result.envelope };
}

export function parseMcpServerArgs(args = [], env = {}) {
  let profileInput = env.BROWSER_DEBUG_MCP_PROFILE;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--profile') {
      if (!args[index + 1]) {
        return { ok: false, message: '--profile requires a value.' };
      }
      profileInput = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--profile=')) {
      profileInput = arg.slice('--profile='.length);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      return { ok: true, help: true };
    }
    return { ok: false, message: `Unsupported browser-debug-mcp argument: ${arg}` };
  }
  const profile = resolveMcpProfile(profileInput, env);
  if (!profile.ok) {
    return { ok: false, message: profile.message };
  }
  return { ok: true, profile: profile.profile };
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
