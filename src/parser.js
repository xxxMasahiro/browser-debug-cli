const VALUE_OPTIONS = new Set([
  'action',
  'actions',
  'agent-result',
  'artifact-root',
  'daemon',
  'idle-timeout',
  'input',
  'mask',
  'max-routes',
  'max-bytes',
  'max-lifetime',
  'mock',
  'name',
  'older-than',
  'package',
  'region',
  'resource-guard',
  'review-index',
  'session',
  'surface',
  'target',
  'threshold',
  'timeout',
  'task',
  'url',
  'viewport'
]);

const BOOLEAN_OPTIONS = new Set([
  'devtools',
  'dry-run',
  'execute',
  'headed',
  'report',
  'screenshot',
  'trace'
]);

const URL_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

export function parseCliArgs(argv) {
  const { globals, remaining, error } = collectGlobalOptions(argv);
  if (error) {
    return parseError('unknown', globals.json, error);
  }
  if (globals.version) {
    return { ok: true, command: 'version', json: globals.json, options: {} };
  }
  if (globals.help && remaining.length === 0) {
    return { ok: true, command: 'help', json: globals.json, options: {} };
  }
  if (remaining.length === 0) {
    return parseError('unknown', globals.json, {
      code: 'MISSING_COMMAND',
      message: 'A command is required.',
      details: { planned_commands: plannedCommands() }
    });
  }

  const commandName = remaining[0];
  const args = remaining.slice(1);

  switch (commandName) {
    case 'doctor':
      return parseNoArgCommand('doctor', args, globals);
    case 'observe':
      return parseObserve(args, globals);
    case 'supervise':
      return parseSupervise(args, globals);
    case 'daemon':
      return parseDaemon(args, globals);
    case 'resource':
      return parseResource(args, globals);
    case 'agent':
      return parseAgent(args, globals);
    case 'target':
      return parseTarget(args, globals);
    case 'session':
      return parseSession(args, globals);
    case 'act':
      return parseAct(args, globals);
    case 'report':
      return parseRequiredOptions('report', args, globals, ['session']);
    case 'spec':
      return parseSpec(args, globals);
    case 'review':
      return parseReview(args, globals);
    case 'schema':
      return parseSchema(args, globals);
    case 'mcp':
      return parseMcp(args, globals);
    case 'help':
      return { ok: true, command: 'help', json: globals.json, options: {} };
    default:
      return parseError(commandName, globals.json, {
        code: 'UNKNOWN_COMMAND',
        message: `Unknown command: ${commandName}`,
        details: { planned_commands: plannedCommands() }
      });
  }
}

function collectGlobalOptions(argv) {
  const globals = { help: false, json: false, version: false };
  const remaining = [];

  for (const token of argv) {
    if (token === '--json') {
      globals.json = true;
    } else if (token === '--help' || token === '-h') {
      globals.help = true;
    } else if (token === '--version' || token === '-V') {
      globals.version = true;
    } else if (token === '--') {
      return {
        globals,
        remaining,
        error: {
          code: 'UNSUPPORTED_ARGUMENT_SEPARATOR',
          message: 'The -- argument separator is not supported yet.',
          details: {}
        }
      };
    } else {
      remaining.push(token);
    }
  }

  return { globals, remaining };
}

function parseNoArgCommand(command, args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: command } };
  }
  if (args.length > 0) {
    return parseError(command, globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: `${command} does not accept positional arguments.`,
      details: { argument: args[0] }
    });
  }
  return { ok: true, command, json: globals.json, options: {} };
}

function parseObserve(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'observe' } };
  }

  const parsed = parseOptions('observe', args, globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError('observe', globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: 'observe does not accept positional arguments.',
      details: { argument: parsed.positionals[0] }
    });
  }
  if (!parsed.options.url) {
    return parseError('observe', globals.json, {
      code: 'MISSING_REQUIRED_OPTION',
      message: 'observe requires --url <url>.',
      details: { option: 'url' }
    });
  }

  const urlError = validateUrl(parsed.options.url);
  if (urlError) {
    return parseError('observe', globals.json, urlError);
  }

  return { ok: true, command: 'observe', json: globals.json, options: parsed.options };
}

function parseSupervise(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'supervise' } };
  }

  const parsed = parseOptions('supervise', args, globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError('supervise', globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: 'supervise does not accept positional arguments.',
      details: { argument: parsed.positionals[0] }
    });
  }
  if (!parsed.options.url) {
    return parseError('supervise', globals.json, {
      code: 'MISSING_REQUIRED_OPTION',
      message: 'supervise requires --url <url>.',
      details: { option: 'url' }
    });
  }

  const urlError = validateUrl(parsed.options.url);
  if (urlError) {
    return parseError('supervise', globals.json, urlError);
  }

  return { ok: true, command: 'supervise', json: globals.json, options: parsed.options };
}

function parseSession(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'session' } };
  }
  const subcommand = args[0];
  if (!subcommand) {
    return parseError('session', globals.json, {
      code: 'MISSING_SUBCOMMAND',
      message: 'session requires a subcommand.',
      details: { subcommands: ['start', 'close'] }
    });
  }
  if (subcommand === 'start') {
    return parseOptionalOptions('session start', args.slice(1), globals);
  }
  if (subcommand === 'close') {
    return parseRequiredOptions('session close', args.slice(1), globals, ['session']);
  }
  return parseError('session', globals.json, {
    code: 'UNKNOWN_SUBCOMMAND',
    message: `Unknown session subcommand: ${subcommand}`,
    details: { subcommands: ['start', 'close'] }
  });
}

function parseDaemon(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'daemon' } };
  }
  const subcommand = args[0];
  if (!subcommand) {
    return parseError('daemon', globals.json, {
      code: 'MISSING_SUBCOMMAND',
      message: 'daemon requires a subcommand.',
      details: { subcommands: ['start', 'status', 'stop'] }
    });
  }
  if (subcommand === 'start') {
    return parseDaemonStart(args.slice(1), globals);
  }
  if (subcommand === 'status' || subcommand === 'stop') {
    return parseRequiredOptions(`daemon ${subcommand}`, args.slice(1), globals, ['daemon']);
  }
  return parseError('daemon', globals.json, {
    code: 'UNKNOWN_SUBCOMMAND',
    message: `Unknown daemon subcommand: ${subcommand}`,
    details: { subcommands: ['start', 'status', 'stop'] }
  });
}

function parseDaemonStart(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'daemon start' } };
  }
  const parsed = parseOptions('daemon start', args, globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError('daemon start', globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: 'daemon start does not accept positional arguments.',
      details: { argument: parsed.positionals[0] }
    });
  }
  if (!parsed.options.url) {
    return parseError('daemon start', globals.json, {
      code: 'MISSING_REQUIRED_OPTION',
      message: 'daemon start requires --url <url>.',
      details: { option: 'url' }
    });
  }
  const urlError = validateUrl(parsed.options.url);
  if (urlError) {
    return parseError('daemon start', globals.json, urlError);
  }
  return { ok: true, command: 'daemon start', json: globals.json, options: parsed.options };
}

function parseResource(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'resource' } };
  }
  const subcommand = args[0];
  if (!subcommand) {
    return parseError('resource', globals.json, {
      code: 'MISSING_SUBCOMMAND',
      message: 'resource requires a subcommand.',
      details: { subcommands: ['status', 'artifacts'] }
    });
  }
  if (subcommand === 'status') {
    return parseNoArgCommand('resource status', args.slice(1), globals);
  }
  if (subcommand === 'artifacts') {
    return parseResourceArtifacts(args.slice(1), globals);
  }
  return parseError('resource', globals.json, {
    code: 'UNKNOWN_SUBCOMMAND',
    message: `Unknown resource subcommand: ${subcommand}`,
    details: { subcommands: ['status', 'artifacts'] }
  });
}

function parseResourceArtifacts(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'resource artifacts' } };
  }
  const subcommand = args[0];
  if (!subcommand) {
    return parseError('resource artifacts', globals.json, {
      code: 'MISSING_SUBCOMMAND',
      message: 'resource artifacts requires a subcommand.',
      details: { subcommands: ['plan', 'cleanup'] }
    });
  }
  if (subcommand !== 'plan' && subcommand !== 'cleanup') {
    return parseError('resource artifacts', globals.json, {
      code: 'UNKNOWN_SUBCOMMAND',
      message: `Unknown resource artifacts subcommand: ${subcommand}`,
      details: { subcommands: ['plan', 'cleanup'] }
    });
  }
  const parsed = parseOptions(`resource artifacts ${subcommand}`, args.slice(1), globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError(`resource artifacts ${subcommand}`, globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: `resource artifacts ${subcommand} does not accept positional arguments.`,
      details: { argument: parsed.positionals[0] }
    });
  }
  if (subcommand === 'cleanup' && parsed.options['dry-run'] && parsed.options.execute) {
    return parseError('resource artifacts cleanup', globals.json, {
      code: 'CONFLICTING_OPTIONS',
      message: 'resource artifacts cleanup accepts either --dry-run or --execute, not both.',
      details: { options: ['dry-run', 'execute'] }
    });
  }
  return { ok: true, command: `resource artifacts ${subcommand}`, json: globals.json, options: parsed.options };
}

function parseAgent(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'agent' } };
  }
  const subcommand = args[0];
  if (!subcommand) {
    return parseError('agent', globals.json, {
      code: 'MISSING_SUBCOMMAND',
      message: 'agent requires a subcommand.',
      details: { subcommands: ['surfaces', 'requests', 'package', 'ingest', 'report'] }
    });
  }
  if (subcommand === 'surfaces') {
    return parseAgentSurfaces(args.slice(1), globals);
  }
  if (subcommand === 'requests') {
    return parseAgentRequests(args.slice(1), globals);
  }
  if (subcommand === 'package') {
    return parseAgentPackage(args.slice(1), globals);
  }
  if (subcommand === 'ingest') {
    return parseAgentIngest(args.slice(1), globals);
  }
  if (subcommand === 'report') {
    return parseAgentReport(args.slice(1), globals);
  }
  return parseError('agent', globals.json, {
    code: 'UNKNOWN_SUBCOMMAND',
    message: `Unknown agent subcommand: ${subcommand}`,
    details: { subcommands: ['surfaces', 'requests', 'package', 'ingest', 'report'] }
  });
}

function parseAgentSurfaces(args, globals) {
  const subcommand = args[0];
  if (subcommand !== 'list') {
    return parseError('agent surfaces', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown agent surfaces subcommand: ${subcommand}` : 'agent surfaces requires a subcommand.',
      details: { subcommands: ['list'] }
    });
  }
  return parseNoArgCommand('agent surfaces list', args.slice(1), globals);
}

function parseAgentRequests(args, globals) {
  const subcommand = args[0];
  if (subcommand !== 'list') {
    return parseError('agent requests', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown agent requests subcommand: ${subcommand}` : 'agent requests requires a subcommand.',
      details: { subcommands: ['list'] }
    });
  }
  const parsed = parseOptions('agent requests list', args.slice(1), globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError('agent requests list', globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: 'agent requests list does not accept positional arguments.',
      details: { argument: parsed.positionals[0] }
    });
  }
  return { ok: true, command: 'agent requests list', json: globals.json, options: parsed.options };
}

function parseAgentPackage(args, globals) {
  const parsed = parseRequiredOptions('agent package', args, globals, ['review-index']);
  if (!parsed.ok) {
    return parsed;
  }
  return parsed;
}

function parseAgentIngest(args, globals) {
  const parsed = parseRequiredOptions('agent ingest', args, globals, ['package', 'input']);
  if (!parsed.ok) {
    return parsed;
  }
  return parsed;
}

function parseAgentReport(args, globals) {
  const parsed = parseRequiredOptions('agent report', args, globals, ['review-index', 'agent-result']);
  if (!parsed.ok) {
    return parsed;
  }
  return parsed;
}

function parseSpec(args, globals) {
  const subcommand = args[0];
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'spec' } };
  }
  if (subcommand !== 'export') {
    return parseError('spec', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown spec subcommand: ${subcommand}` : 'spec requires a subcommand.',
      details: { subcommands: ['export'] }
    });
  }
  return parseRequiredOptions('spec export', args.slice(1), globals, ['session']);
}

function parseTarget(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'target' } };
  }
  const subcommand = args[0];
  if (!subcommand) {
    return parseError('target', globals.json, {
      code: 'MISSING_SUBCOMMAND',
      message: 'target requires a subcommand.',
      details: { subcommands: ['init', 'validate'] }
    });
  }
  if (subcommand === 'init') {
    return parseTargetInit(args.slice(1), globals);
  }
  if (subcommand === 'validate') {
    return parseTargetValidate(args.slice(1), globals);
  }
  return parseError('target', globals.json, {
    code: 'UNKNOWN_SUBCOMMAND',
    message: `Unknown target subcommand: ${subcommand}`,
    details: { subcommands: ['init', 'validate'] }
  });
}

function parseTargetInit(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'target init' } };
  }
  const parsed = parseOptions('target init', args, globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError('target init', globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: 'target init does not accept positional arguments.',
      details: { argument: parsed.positionals[0] }
    });
  }
  if (!parsed.options.url) {
    return parseError('target init', globals.json, {
      code: 'MISSING_REQUIRED_OPTION',
      message: 'target init requires --url <url>.',
      details: { option: 'url' }
    });
  }
  const urlError = validateUrl(parsed.options.url);
  if (urlError) {
    return parseError('target init', globals.json, urlError);
  }
  return { ok: true, command: 'target init', json: globals.json, options: parsed.options };
}

function parseTargetValidate(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'target validate' } };
  }
  const parsed = parseOptions('target validate', args, globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError('target validate', globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: 'target validate does not accept positional arguments.',
      details: { argument: parsed.positionals[0] }
    });
  }
  if (parsed.options.target && parsed.options.input) {
    return parseError('target validate', globals.json, {
      code: 'CONFLICTING_OPTIONS',
      message: 'target validate accepts either --target <manifest> or --input -, not both.',
      details: { options: ['target', 'input'] }
    });
  }
  if (!parsed.options.target && !parsed.options.input) {
    return parseError('target validate', globals.json, {
      code: 'MISSING_REQUIRED_OPTION',
      message: 'target validate requires --target <manifest> or --input -.',
      details: { options: ['target', 'input'] }
    });
  }
  return { ok: true, command: 'target validate', json: globals.json, options: parsed.options };
}

function parseReview(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'review' } };
  }
  const parsed = parseOptions('review', args, globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError('review', globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: 'review does not accept positional arguments.',
      details: { argument: parsed.positionals[0] }
    });
  }
  if (!parsed.options.url && !parsed.options.target && !parsed.options.input) {
    return parseError('review', globals.json, {
      code: 'MISSING_REQUIRED_OPTION',
      message: 'review requires --url <url>, --target <manifest>, or --input -.',
      details: { options: ['url', 'target', 'input'] }
    });
  }
  if (parsed.options.url) {
    const urlError = validateUrl(parsed.options.url);
    if (urlError) {
      return parseError('review', globals.json, urlError);
    }
  }
  return { ok: true, command: 'review', json: globals.json, options: parsed.options };
}

function parseSchema(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'schema' } };
  }
  const subcommand = args[0];
  if (!subcommand) {
    return parseError('schema', globals.json, {
      code: 'MISSING_SUBCOMMAND',
      message: 'schema requires a subcommand.',
      details: { subcommands: ['list', 'get'] }
    });
  }
  if (subcommand === 'list') {
    return parseNoArgCommand('schema list', args.slice(1), globals);
  }
  if (subcommand === 'get') {
    return parseRequiredOptions('schema get', args.slice(1), globals, ['name']);
  }
  return parseError('schema', globals.json, {
    code: 'UNKNOWN_SUBCOMMAND',
    message: `Unknown schema subcommand: ${subcommand}`,
    details: { subcommands: ['list', 'get'] }
  });
}

function parseMcp(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'mcp' } };
  }
  const subcommand = args[0];
  if (subcommand !== 'serve') {
    return parseError('mcp', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown mcp subcommand: ${subcommand}` : 'mcp requires a subcommand.',
      details: { subcommands: ['serve'] }
    });
  }
  return parseNoArgCommand('mcp serve', args.slice(1), globals);
}

function parseRequiredOptions(command, args, globals, requiredOptions) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: command } };
  }
  const parsed = parseOptions(command, args, globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError(command, globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: `${command} does not accept positional arguments.`,
      details: { argument: parsed.positionals[0] }
    });
  }
  for (const option of requiredOptions) {
    if (!parsed.options[option]) {
      return parseError(command, globals.json, {
        code: 'MISSING_REQUIRED_OPTION',
        message: `${command} requires --${option} <value>.`,
        details: { option }
      });
    }
  }
  return { ok: true, command, json: globals.json, options: parsed.options };
}

function parseAct(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'act' } };
  }
  const parsed = parseOptions('act', args, globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError('act', globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: 'act does not accept positional arguments.',
      details: { argument: parsed.positionals[0] }
    });
  }
  if (!parsed.options.session) {
    return parseError('act', globals.json, {
      code: 'MISSING_REQUIRED_OPTION',
      message: 'act requires --session <value>.',
      details: { option: 'session' }
    });
  }
  if (!parsed.options.action && !parsed.options.input) {
    return parseError('act', globals.json, {
      code: 'MISSING_REQUIRED_OPTION',
      message: 'act requires --action <json> or --input -.',
      details: { options: ['action', 'input'] }
    });
  }
  return { ok: true, command: 'act', json: globals.json, options: parsed.options };
}

function parseOptionalOptions(command, args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: command } };
  }
  const parsed = parseOptions(command, args, globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError(command, globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: `${command} does not accept positional arguments.`,
      details: { argument: parsed.positionals[0] }
    });
  }
  if (parsed.options.url) {
    const urlError = validateUrl(parsed.options.url);
    if (urlError) {
      return parseError(command, globals.json, urlError);
    }
  }
  return { ok: true, command, json: globals.json, options: parsed.options };
}

function parseOptions(command, args, json) {
  const options = {};
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('-')) {
      positionals.push(token);
      continue;
    }
    if (!token.startsWith('--')) {
      return parseError(command, json, {
        code: 'UNSUPPORTED_SHORT_OPTION',
        message: `Unsupported short option: ${token}`,
        details: { option: token }
      });
    }

    const { name, value } = splitLongOption(token);
    if (BOOLEAN_OPTIONS.has(name)) {
      if (value !== undefined) {
        return parseError(command, json, {
          code: 'UNEXPECTED_OPTION_VALUE',
          message: `--${name} does not accept a value.`,
          details: { option: name }
        });
      }
      options[name] = true;
      continue;
    }

    if (!VALUE_OPTIONS.has(name)) {
      return parseError(command, json, {
        code: 'UNKNOWN_OPTION',
        message: `Unknown option: --${name}`,
        details: { option: name }
      });
    }

    if (value !== undefined) {
      options[name] = value;
      continue;
    }

    const next = args[index + 1];
    if (!next || (next.startsWith('-') && next !== '-')) {
      return parseError(command, json, {
        code: 'MISSING_OPTION_VALUE',
        message: `--${name} requires a value.`,
        details: { option: name }
      });
    }
    options[name] = next;
    index += 1;
  }

  return { ok: true, options, positionals };
}

function splitLongOption(token) {
  const valueStart = token.indexOf('=');
  if (valueStart === -1) {
    return { name: token.slice(2), value: undefined };
  }
  return {
    name: token.slice(2, valueStart),
    value: token.slice(valueStart + 1)
  };
}

function validateUrl(value) {
  try {
    const url = new URL(value);
    if (!URL_PROTOCOLS.has(url.protocol)) {
      return {
        code: 'UNSUPPORTED_URL_PROTOCOL',
        message: `Unsupported URL protocol: ${url.protocol}`,
        details: { protocol: url.protocol, supported_protocols: [...URL_PROTOCOLS] }
      };
    }
    return null;
  } catch {
    return {
      code: 'INVALID_URL',
      message: 'The --url value must be an absolute URL.',
      details: { option: 'url' }
    };
  }
}

function parseError(command, json, error) {
  return { ok: false, command, json, error };
}

function plannedCommands() {
  return [
    'doctor',
    'observe',
    'supervise',
    'daemon start',
    'daemon status',
    'daemon stop',
    'resource status',
    'resource artifacts plan',
    'resource artifacts cleanup',
    'agent surfaces list',
    'agent requests list',
    'agent package',
    'agent ingest',
    'agent report',
    'target init',
    'target validate',
    'session start',
    'session close',
    'act',
    'report',
    'spec export',
    'review',
    'schema list',
    'schema get',
    'mcp serve'
  ];
}
