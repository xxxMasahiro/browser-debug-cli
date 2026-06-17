const VALUE_OPTIONS = new Set([
  'action',
  'artifact-root',
  'session',
  'timeout',
  'url'
]);

const BOOLEAN_OPTIONS = new Set([
  'devtools',
  'headed',
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
    case 'session':
      return parseSession(args, globals);
    case 'act':
      return parseRequiredOptions('act', args, globals, ['session', 'action']);
    case 'report':
      return parseRequiredOptions('report', args, globals, ['session']);
    case 'spec':
      return parseSpec(args, globals);
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
    if (!next || next.startsWith('-')) {
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
    'session start',
    'session close',
    'act',
    'report',
    'spec export'
  ];
}
