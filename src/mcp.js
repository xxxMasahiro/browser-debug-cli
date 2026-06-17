import { executeCli } from './cli.js';
import { PACKAGE_VERSION } from './constants.js';

export const MCP_TOOLS = Object.freeze([
  {
    name: 'browser_debug_doctor',
    description: 'Run Browser Debug CLI doctor and return the standard JSON envelope.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} }
  },
  {
    name: 'browser_debug_observe',
    description: 'Observe one approved URL with local Playwright evidence.',
    inputSchema: {
      type: 'object',
      required: ['url'],
      additionalProperties: false,
      properties: {
        url: { type: 'string' },
        screenshot: { type: 'boolean' },
        trace: { type: 'boolean' },
        timeout: { type: 'string' }
      }
    }
  },
  {
    name: 'browser_debug_review',
    description: 'Run a deterministic local browser review for one URL.',
    inputSchema: {
      type: 'object',
      required: ['url'],
      additionalProperties: false,
      properties: {
        url: { type: 'string' },
        viewport: { type: 'string' },
        screenshot: { type: 'boolean' },
        report: { type: 'boolean' },
        timeout: { type: 'string' }
      }
    }
  },
  {
    name: 'browser_debug_target_init',
    description: 'Create a local target manifest artifact for manifest-driven review.',
    inputSchema: {
      type: 'object',
      required: ['url'],
      additionalProperties: false,
      properties: {
        url: { type: 'string' },
        name: { type: 'string' },
        viewport: { type: 'string' },
        maxRoutes: { type: 'number' },
        timeout: { type: 'string' }
      }
    }
  },
  {
    name: 'browser_debug_review_target',
    description: 'Run a deterministic local browser review for a target manifest.',
    inputSchema: {
      type: 'object',
      required: ['target'],
      additionalProperties: false,
      properties: {
        target: { type: 'string' },
        report: { type: 'boolean' },
        timeout: { type: 'string' }
      }
    }
  },
  {
    name: 'browser_debug_schema_list',
    description: 'List machine-readable Browser Debug CLI schemas.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} }
  },
  {
    name: 'browser_debug_schema_get',
    description: 'Get one machine-readable Browser Debug CLI schema.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: { name: { type: 'string' } }
    }
  }
]);

export async function handleMcpRequest(request, context = {}) {
  if (!request || typeof request !== 'object') {
    return response(null, null, errorObject(-32600, 'Invalid Request'));
  }
  if (request.method === 'initialize') {
    return response(request.id, {
      protocolVersion: '2025-06-18',
      serverInfo: {
        name: 'browser-debug-cli',
        version: PACKAGE_VERSION
      },
      capabilities: {
        tools: {}
      }
    });
  }
  if (request.method === 'tools/list') {
    return response(request.id, { tools: MCP_TOOLS });
  }
  if (request.method === 'tools/call') {
    const toolName = request.params?.name;
    const args = request.params?.arguments ?? {};
    const result = await callTool(toolName, args, context);
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

async function callTool(name, args, context) {
  if (!MCP_TOOLS.some((tool) => tool.name === name)) {
    return { ok: false, message: `Unknown tool: ${name}` };
  }
  const cliArgs = toolToCliArgs(name, args);
  const result = await executeCli(cliArgs, context);
  return { ok: true, envelope: result.envelope };
}

function toolToCliArgs(name, args) {
  if (name === 'browser_debug_doctor') {
    return ['doctor', '--json'];
  }
  if (name === 'browser_debug_observe') {
    return withCommonOptions(['observe', '--url', args.url], args);
  }
  if (name === 'browser_debug_review') {
    return withCommonOptions(['review', '--url', args.url], args);
  }
  if (name === 'browser_debug_target_init') {
    const output = withCommonOptions(['target', 'init', '--url', args.url], args);
    if (args.name) {
      output.splice(-1, 0, '--name', String(args.name));
    }
    if (args.maxRoutes !== undefined) {
      output.splice(-1, 0, '--max-routes', String(args.maxRoutes));
    }
    return output;
  }
  if (name === 'browser_debug_review_target') {
    return withCommonOptions(['review', '--target', args.target], args);
  }
  if (name === 'browser_debug_schema_list') {
    return ['schema', 'list', '--json'];
  }
  if (name === 'browser_debug_schema_get') {
    return ['schema', 'get', '--name', args.name, '--json'];
  }
  return ['doctor', '--json'];
}

function withCommonOptions(base, args) {
  const output = [...base];
  if (args.viewport) {
    output.push('--viewport', String(args.viewport));
  }
  if (args.timeout) {
    output.push('--timeout', String(args.timeout));
  }
  if (args.screenshot) {
    output.push('--screenshot');
  }
  if (args.trace) {
    output.push('--trace');
  }
  if (args.report) {
    output.push('--report');
  }
  output.push('--json');
  return output;
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
