const VALUE_OPTIONS = new Set([
  'action',
  'actions',
  'agent-result',
  'artifact-root',
  'body-limit',
  'capture-handoff',
  'client',
  'daemon',
  'endpoint',
  'execution',
  'fixture-root',
  'group',
  'host',
  'idle-timeout',
  'image',
  'input',
  'idempotency-key',
  'limit',
  'locale',
  'mask',
  'max-routes',
  'max-bytes',
  'max-lifetime',
  'mock',
  'model',
  'name',
  'older-than',
  'operation',
  'package',
  'phase',
  'plan-hash',
  'port',
  'preparation',
  'profile',
  'provider',
  'region',
  'resource-guard',
  'review-index',
  'risk',
  'scope',
  'source',
  'session',
  'surface',
  'target',
  'threshold',
  'timeout',
  'token-env',
  'transport',
  'task',
  'url',
  'viewport',
  'workflow'
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
    case 'visual':
      return parseVisual(args, globals);
    case 'identity':
      return parseIdentity(args, globals);
    case 'artifact-root':
      return parseArtifactRoot(args, globals);
    case 'release':
      return parseRelease(args, globals);
    case 'shell':
      return parseShell(args, globals);
    case 'final':
      return parseFinal(args, globals);
    case 'capture':
      return parseCapture(args, globals);
    case 'settings':
      return parseSettings(args, globals);
    case 'translation':
      return parseTranslation(args, globals);
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
    case 'operation':
      return parseOperation(args, globals);
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

function parseCapture(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'capture' } };
  }
  const subcommand = args[0];
  if (subcommand !== 'plan' && subcommand !== 'handoff' && subcommand !== 'readiness' && subcommand !== 'status' && subcommand !== 'run') {
    return parseError('capture', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown capture subcommand: ${subcommand}` : 'capture requires a subcommand.',
      details: { subcommands: ['readiness', 'status', 'plan', 'run', 'handoff'] }
    });
  }
  if (subcommand === 'plan' || subcommand === 'readiness' || subcommand === 'status') {
    const command = `capture ${subcommand}`;
    const parsed = parseOptionalOptions(command, args.slice(1), globals);
    if (!parsed.ok) {
      return parsed;
    }
    if (parsed.options.execute) {
      return parseError(command, globals.json, {
        code: 'CONFLICTING_OPTIONS',
        message: `${command} is read-only and does not accept --execute.`,
        details: { option: 'execute' }
      });
    }
    const disallowedOptions = ['provider', 'model', 'image', 'url', 'screenshot', 'trace'];
    for (const option of disallowedOptions) {
      if (parsed.options[option] !== undefined) {
        return parseError(command, globals.json, {
          code: subcommand === 'plan' ? 'UNSUPPORTED_CAPTURE_PLAN_OPTION' : 'UNSUPPORTED_CAPTURE_READINESS_OPTION',
          message: `${command} does not accept --${option} because it is no-capture read-only output.`,
          details: { option }
        });
      }
    }
    return parsed;
  }
  if (subcommand === 'run') {
    const parsed = parseOptionalOptions('capture run', args.slice(1), globals);
    if (!parsed.ok) {
      return parsed;
    }
    const unsupportedOptions = Object.keys(parsed.options).filter((option) => !['source', 'execute'].includes(option));
    if (unsupportedOptions.length > 0) {
      return parseError('capture run', globals.json, {
        code: 'UNSUPPORTED_CAPTURE_RUN_OPTION',
        message: `capture run is approval-bound and does not accept --${unsupportedOptions[0]} in this phase.`,
        details: { option: unsupportedOptions[0] }
      });
    }
    if (!parsed.options.source) {
      return parseError('capture run', globals.json, {
        code: 'MISSING_REQUIRED_OPTION',
        message: 'capture run requires --source <screen|window|desktop-app>.',
        details: { option: 'source' }
      });
    }
    if (!parsed.options.execute) {
      return parseError('capture run', globals.json, {
        code: 'MISSING_REQUIRED_OPTION',
        message: 'capture run is approval-bound and requires --execute to acknowledge execution intent before it can fail closed.',
        details: { option: 'execute' }
      });
    }
    return parsed;
  }
  const parsed = parseRequiredOptions('capture handoff', args.slice(1), globals, ['image', 'source']);
  if (!parsed.ok) {
    return parsed;
  }
  const imageError = validateImageInput(parsed.options.image, {});
  if (imageError) {
    return parseError('capture handoff', globals.json, {
      code: 'INVALID_CAPTURE_HANDOFF_IMAGE',
      message: imageError.message.replace('review --image', 'capture handoff --image'),
      details: imageError.details
    });
  }
  const disallowedOptions = ['execute', 'provider', 'model', 'url', 'target', 'input', 'artifact-root', 'screenshot', 'trace', 'report', 'mock', 'threshold'];
  for (const option of disallowedOptions) {
    if (parsed.options[option] !== undefined) {
      return parseError('capture handoff', globals.json, {
        code: option === 'execute' ? 'CONFLICTING_OPTIONS' : 'UNSUPPORTED_CAPTURE_HANDOFF_OPTION',
        message: `capture handoff does not accept --${option} because it only reads an existing workspace image for metadata.`,
        details: { option }
      });
    }
  }
  if (parsed.options.source === 'all') {
    return parseError('capture handoff', globals.json, {
      code: 'INVALID_CAPTURE_HANDOFF_SOURCE',
      message: 'capture handoff requires a concrete source: screen, window, or desktop-app.',
      details: { source: parsed.options.source }
    });
  }
  return parsed;
}

function parseSettings(args, globals) {
  if (globals.help) {
    const subcommand = args[0];
    const nested = args[1];
    return {
      ok: true,
      command: 'help',
      json: globals.json,
      options: { topic: subcommand === 'language' && nested ? `settings language ${nested}` : 'settings' }
    };
  }
  const subcommand = args[0];
  if (subcommand === 'show') {
    return parseNoArgCommand('settings show', args.slice(1), globals);
  }
  if (subcommand === 'language') {
    if (args[1] === 'policy') {
      return parseNoArgCommand('settings language policy', args.slice(2), globals);
    }
    return parseNoArgCommand('settings language', args.slice(1), globals);
  }
  if (subcommand === 'locale' && args[1] === 'resources') {
    return parseReadOnlyLocalizationOptions('settings locale resources', args.slice(2), globals);
  }
  if (subcommand === 'report' && args[1] === 'templates') {
    return parseReadOnlyLocalizationOptions('settings report templates', args.slice(2), globals);
  }
  return parseError('settings', globals.json, {
    code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
    message: subcommand ? `Unknown settings subcommand: ${subcommand}` : 'settings requires a subcommand.',
    details: { subcommands: ['show', 'language', 'language policy', 'locale resources', 'report templates'] }
  });
}

function parseReadOnlyLocalizationOptions(command, args, globals) {
  const parsed = parseOptionalOptions(command, args, globals);
  if (!parsed.ok) {
    return parsed;
  }
  const unsupported = ['execute', 'provider', 'model', 'image', 'url', 'target', 'review-index', 'capture-handoff', 'input', 'package', 'execution', 'screenshot', 'trace']
    .find((option) => parsed.options[option] !== undefined);
  if (unsupported) {
    return parseError(command, globals.json, {
      code: 'UNSUPPORTED_LOCALIZATION_OPTION',
      message: `${command} does not accept --${unsupported} because localization resources are read-only and provider-free.`,
      details: { option: unsupported }
    });
  }
  return parsed;
}

function parseTranslation(args, globals) {
  if (globals.help) {
    const subcommand = args[0];
    return {
      ok: true,
      command: 'help',
      json: globals.json,
      options: { topic: subcommand ? `translation ${subcommand}` : 'translation' }
    };
  }
  const subcommand = args[0];
  if (subcommand !== 'readiness' && subcommand !== 'dry-run' && subcommand !== 'run') {
    return parseError('translation', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown translation subcommand: ${subcommand}` : 'translation requires a subcommand.',
      details: { subcommands: ['readiness', 'dry-run', 'run'] }
    });
  }
  const parsed = parseOptionalOptions(`translation ${subcommand}`, args.slice(1), globals);
  if (!parsed.ok) {
    return parsed;
  }
  const unsupported = ['image', 'url', 'target', 'review-index', 'capture-handoff', 'input', 'package', 'execution', 'screenshot', 'trace']
    .find((option) => parsed.options[option] !== undefined);
  if (unsupported) {
    return parseError(`translation ${subcommand}`, globals.json, {
      code: 'UNSUPPORTED_TRANSLATION_OPTION',
      message: `translation ${subcommand} does not accept --${unsupported} because raw evidence and execution artifacts are outside translation scope.`,
      details: { option: unsupported }
    });
  }
  if (subcommand === 'readiness' && parsed.options.execute) {
    return parseError('translation readiness', globals.json, {
      code: 'CONFLICTING_OPTIONS',
      message: 'translation readiness is read-only and does not accept --execute.',
      details: { option: 'execute' }
    });
  }
  if (subcommand === 'dry-run' && parsed.options.execute) {
    return parseError('translation dry-run', globals.json, {
      code: 'CONFLICTING_OPTIONS',
      message: 'translation dry-run does not accept --execute.',
      details: { option: 'execute' }
    });
  }
  if (subcommand === 'run' && !parsed.options.execute) {
    return parseError('translation run', globals.json, {
      code: 'MISSING_REQUIRED_OPTION',
      message: 'translation run is approval-bound and requires --execute to acknowledge execution intent before it can fail closed.',
      details: { option: 'execute' }
    });
  }
  return parsed;
}

function parseVisual(args, globals) {
  if (globals.help) {
    const scope = args[0];
    const action = args[1];
    return {
      ok: true,
      command: 'help',
      json: globals.json,
      options: { topic: scope === 'review' && action ? `visual review ${action}` : 'visual' }
    };
  }
  const scope = args[0];
  const action = args[1];
  if (scope !== 'review' || !['plan', 'prepare', 'run', 'execute', 'status', 'list', 'dashboard', 'aggregate'].includes(action)) {
    return parseError('visual', globals.json, {
      code: scope ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: scope ? 'Unknown visual subcommand: ' + [scope, action].filter(Boolean).join(' ') : 'visual requires a subcommand.',
      details: { subcommands: ['review plan', 'review prepare', 'review run', 'review status', 'review list', 'review dashboard', 'review aggregate'] }
    });
  }
  if (action === 'plan') {
    const parsed = parseRequiredOptions('visual review plan', args.slice(2), globals, ['capture-handoff']);
    if (!parsed.ok) {
      return parsed;
    }
    if (parsed.options.execute) {
      return parseError('visual review plan', globals.json, {
        code: 'CONFLICTING_OPTIONS',
        message: 'visual review plan is read-only and does not accept --execute.',
        details: { option: 'execute' }
      });
    }
    const disallowedOptions = ['artifact-root', 'image', 'url', 'target', 'review-index', 'input', 'preparation', 'package', 'agent-result', 'screenshot', 'trace', 'report', 'mock', 'threshold', 'source'];
    for (const option of disallowedOptions) {
      if (parsed.options[option] !== undefined) {
        return parseError('visual review plan', globals.json, {
          code: 'UNSUPPORTED_VISUAL_REVIEW_PLAN_OPTION',
          message: `visual review plan does not accept --${option} because it only reads capture handoff metadata.`,
          details: { option }
        });
      }
    }
    return parsed;
  }
  if (action === 'prepare') {
    const parsed = parseRequiredOptions('visual review prepare', args.slice(2), globals, ['review-index']);
    if (!parsed.ok) {
      return parsed;
    }
    if (parsed.options.execute) {
      return parseError('visual review prepare', globals.json, {
        code: 'CONFLICTING_OPTIONS',
        message: 'visual review prepare does not execute providers and does not accept --execute.',
        details: { option: 'execute' }
      });
    }
    return parsed;
  }
  if (action === 'aggregate') {
    const parsed = parseRequiredOptions('visual review aggregate', args.slice(2), globals, ['preparation']);
    if (!parsed.ok) {
      return parsed;
    }
    if (parsed.options.execute) {
      return parseError('visual review aggregate', globals.json, {
        code: 'CONFLICTING_OPTIONS',
        message: 'visual review aggregate is read-only and does not accept --execute.',
        details: { option: 'execute' }
      });
    }
    const disallowedOptions = ['provider', 'model', 'surface', 'image', 'capture-handoff', 'review-index', 'url', 'target', 'input', 'report', 'screenshot', 'trace', 'mock', 'threshold'];
    for (const option of disallowedOptions) {
      if (parsed.options[option] !== undefined) {
        return parseError('visual review aggregate', globals.json, {
          code: 'UNSUPPORTED_VISUAL_REVIEW_AGGREGATE_OPTION',
          message: `visual review aggregate does not accept --${option} because it only reads existing local visual review results.`,
          details: { option }
        });
      }
    }
    return parsed;
  }
  if (action === 'run' || action === 'execute') {
    const parsed = parseRequiredOptions('visual review run', args.slice(2), globals, ['preparation', 'surface', 'provider', 'model']);
    if (!parsed.ok) {
      return parsed;
    }
    if (!parsed.options.execute) {
      return parseError('visual review run', globals.json, {
        code: 'MISSING_REQUIRED_OPTION',
        message: 'visual review run requires --execute.',
        details: { option: 'execute' }
      });
    }
    return parsed;
  }
  if (action === 'status') {
    return parseRequiredOptions('visual review status', args.slice(2), globals, ['execution']);
  }
  const command = action === 'dashboard' ? 'visual review dashboard' : 'visual review list';
  const parsed = parseOptions(command, args.slice(2), globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError(command, globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: command + ' does not accept positional arguments.',
      details: { argument: parsed.positionals[0] }
    });
  }
  return { ok: true, command, json: globals.json, options: parsed.options };
}

function parseIdentity(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: args[0] === 'aliases' && args[1] ? `identity aliases ${args[1]}` : 'identity' } };
  }
  const subcommand = args[0];
  if (subcommand === 'audit') {
    return parseNoArgCommand('identity audit', args.slice(1), globals);
  }
  if (subcommand === 'aliases') {
    const action = args[1];
    if (!action) {
      return parseNoArgCommand('identity aliases', args.slice(1), globals);
    }
    if (action === 'removal-readiness') {
      return parseNoArgCommand('identity aliases removal-readiness', args.slice(2), globals);
    }
    if (action === 'remove') {
      const parsed = parseOptionalOptions('identity aliases remove', args.slice(2), globals);
      if (!parsed.ok) {
        return parsed;
      }
      const unsupported = Object.keys(parsed.options).find((option) => option !== 'execute');
      if (unsupported) {
        return parseError('identity aliases remove', globals.json, {
          code: 'UNSUPPORTED_LEGACY_ALIAS_REMOVAL_OPTION',
          message: `identity aliases remove does not accept --${unsupported}.`,
          details: { option: unsupported }
        });
      }
      if (!parsed.options.execute) {
        return parseError('identity aliases remove', globals.json, {
          code: 'MISSING_REQUIRED_OPTION',
          message: 'identity aliases remove is approval-bound and requires --execute to acknowledge removal intent before it can fail closed.',
          details: { option: 'execute' }
        });
      }
      return parsed;
    }
    return parseError('identity aliases', globals.json, {
      code: 'UNKNOWN_SUBCOMMAND',
      message: `Unknown identity aliases subcommand: ${action}`,
      details: { subcommands: ['removal-readiness', 'remove'] }
    });
  }
  if (subcommand !== 'audit') {
    return parseError('identity', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown identity subcommand: ${subcommand}` : 'identity requires a subcommand.',
      details: { subcommands: ['audit', 'aliases', 'aliases removal-readiness', 'aliases remove'] }
    });
  }
}

function parseShell(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: args[0] ? `shell ${args[0]}` : 'shell' } };
  }
  const subcommand = args[0];
  if (subcommand === 'readiness' || subcommand === 'plan') {
    const command = `shell ${subcommand}`;
    const parsed = parseOptionalOptions(command, args.slice(1), globals);
    if (!parsed.ok) {
      return parsed;
    }
    const unsupported = Object.keys(parsed.options)[0];
    if (unsupported) {
      return parseError(command, globals.json, {
        code: unsupported === 'execute' ? 'CONFLICTING_OPTIONS' : 'UNSUPPORTED_SHELL_READINESS_OPTION',
        message: `${command} does not accept --${unsupported} because it is plan-only and non-executing.`,
        details: { option: unsupported }
      });
    }
    return parsed;
  }
  if (subcommand === 'run') {
    const parsed = parseOptionalOptions('shell run', args.slice(1), globals);
    if (!parsed.ok) {
      return parsed;
    }
    const unsupported = Object.keys(parsed.options).find((option) => option !== 'execute');
    if (unsupported) {
      return parseError('shell run', globals.json, {
        code: 'UNSUPPORTED_SHELL_RUN_OPTION',
        message: `shell run is approval-bound and does not accept --${unsupported} in this phase.`,
        details: { option: unsupported }
      });
    }
    if (!parsed.options.execute) {
      return parseError('shell run', globals.json, {
        code: 'MISSING_REQUIRED_OPTION',
        message: 'shell run is approval-bound and requires --execute to acknowledge execution intent before it can fail closed.',
        details: { option: 'execute' }
      });
    }
    return parsed;
  }
  return parseError('shell', globals.json, {
    code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
    message: subcommand ? `Unknown shell subcommand: ${subcommand}` : 'shell requires a subcommand.',
    details: { subcommands: ['readiness', 'plan', 'run'] }
  });
}

function parseFinal(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'final' } };
  }
  const subcommand = args[0];
  if (subcommand !== 'readiness') {
    return parseError('final', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown final subcommand: ${subcommand}` : 'final requires a subcommand.',
      details: { subcommands: ['readiness'] }
    });
  }
  const parsed = parseOptionalOptions('final readiness', args.slice(1), globals);
  if (!parsed.ok) {
    return parsed;
  }
  const unsupported = Object.keys(parsed.options)[0];
  if (unsupported) {
    return parseError('final readiness', globals.json, {
      code: unsupported === 'execute' ? 'CONFLICTING_OPTIONS' : 'UNSUPPORTED_FINAL_READINESS_OPTION',
      message: `final readiness does not accept --${unsupported} because it reports local readiness only.`,
      details: { option: unsupported }
    });
  }
  return parsed;
}

function parseArtifactRoot(args, globals) {
  if (globals.help) {
    const subcommand = args[0];
    const nested = args[1];
    return {
      ok: true,
      command: 'help',
      json: globals.json,
      options: { topic: subcommand === 'migration' && nested ? `artifact-root migration ${nested}` : 'artifact-root' }
    };
  }
  const subcommand = args[0];
  if (subcommand === 'status') {
    return parseArtifactRootReadOnly('artifact-root status', args.slice(1), globals);
  }
  if (subcommand === 'migration') {
    const action = args[1];
    if (action === 'plan') {
      return parseArtifactRootReadOnly('artifact-root migration plan', args.slice(2), globals);
    }
    if (action === 'execute') {
      const parsed = parseOptionalOptions('artifact-root migration execute', args.slice(2), globals);
      if (!parsed.ok) {
        return parsed;
      }
      const unsupported = Object.keys(parsed.options).find((option) => !['execute', 'fixture-root', 'plan-hash'].includes(option));
      if (unsupported) {
        return parseError('artifact-root migration execute', globals.json, {
          code: 'UNSUPPORTED_ARTIFACT_ROOT_MIGRATION_OPTION',
          message: `artifact-root migration execute does not accept --${unsupported}.`,
          details: { option: unsupported }
        });
      }
      if (!parsed.options.execute) {
        return parseError('artifact-root migration execute', globals.json, {
          code: 'MISSING_REQUIRED_OPTION',
          message: 'artifact-root migration execute requires --execute.',
          details: { option: 'execute' }
        });
      }
      if (!parsed.options['fixture-root']) {
        return parseError('artifact-root migration execute', globals.json, {
          code: 'MISSING_REQUIRED_OPTION',
          message: 'artifact-root migration execute is fixture-only in this phase and requires --fixture-root <path>.',
          details: { option: 'fixture-root' }
        });
      }
      return parsed;
    }
    return parseError('artifact-root migration', globals.json, {
      code: action ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: action ? `Unknown artifact-root migration subcommand: ${action}` : 'artifact-root migration requires a subcommand.',
      details: { subcommands: ['plan', 'execute'] }
    });
  }
  return parseError('artifact-root', globals.json, {
    code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
    message: subcommand ? `Unknown artifact-root subcommand: ${subcommand}` : 'artifact-root requires a subcommand.',
    details: { subcommands: ['status', 'migration plan', 'migration execute'] }
  });
}

function parseArtifactRootReadOnly(command, args, globals) {
  const parsed = parseOptionalOptions(command, args, globals);
  if (!parsed.ok) {
    return parsed;
  }
  const unsupported = Object.keys(parsed.options).find((option) => !['artifact-root'].includes(option));
  if (unsupported) {
    return parseError(command, globals.json, {
      code: unsupported === 'execute' ? 'CONFLICTING_OPTIONS' : 'UNSUPPORTED_ARTIFACT_ROOT_OPTION',
      message: `${command} does not accept --${unsupported} because it is read-only.`,
      details: { option: unsupported }
    });
  }
  return parsed;
}

function parseRelease(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'release' } };
  }
  const subcommand = args[0];
  if (subcommand !== 'readiness') {
    return parseError('release', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown release subcommand: ${subcommand}` : 'release requires a subcommand.',
      details: { subcommands: ['readiness'] }
    });
  }
  const parsed = parseOptionalOptions('release readiness', args.slice(1), globals);
  if (!parsed.ok) {
    return parsed;
  }
  const unsupported = Object.keys(parsed.options).find((option) => ![].includes(option));
  if (unsupported) {
    return parseError('release readiness', globals.json, {
      code: unsupported === 'execute' ? 'CONFLICTING_OPTIONS' : 'UNSUPPORTED_RELEASE_READINESS_OPTION',
      message: `release readiness does not accept --${unsupported} because it is local read-only output.`,
      details: { option: unsupported }
    });
  }
  return parsed;
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
      details: { subcommands: ['surfaces', 'requests', 'workflow', 'execution', 'package', 'ingest', 'report'] }
    });
  }
  if (subcommand === 'surfaces') {
    return parseAgentSurfaces(args.slice(1), globals);
  }
  if (subcommand === 'requests') {
    return parseAgentRequests(args.slice(1), globals);
  }
  if (subcommand === 'workflow') {
    return parseAgentWorkflow(args.slice(1), globals);
  }
  if (subcommand === 'execution') {
    return parseAgentExecution(args.slice(1), globals);
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
    details: { subcommands: ['surfaces', 'requests', 'workflow', 'execution', 'package', 'ingest', 'report'] }
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
  if (subcommand !== 'list' && subcommand !== 'show') {
    return parseError('agent requests', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown agent requests subcommand: ${subcommand}` : 'agent requests requires a subcommand.',
      details: { subcommands: ['list', 'show'] }
    });
  }
  if (subcommand === 'show') {
    return parseRequiredOptions('agent requests show', args.slice(1), globals, ['package']);
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

function parseAgentWorkflow(args, globals) {
  const subcommand = args[0];
  if (!['create', 'status', 'index', 'report'].includes(subcommand)) {
    return parseError('agent workflow', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown agent workflow subcommand: ${subcommand}` : 'agent workflow requires a subcommand.',
      details: { subcommands: ['create', 'status', 'index', 'report'] }
    });
  }
  if (subcommand === 'create') {
    return parseRequiredOptions('agent workflow create', args.slice(1), globals, ['package']);
  }
  if (subcommand === 'status') {
    return parseRequiredOptions('agent workflow status', args.slice(1), globals, ['workflow']);
  }
  if (subcommand === 'report') {
    return parseRequiredOptions('agent workflow report', args.slice(1), globals, ['workflow']);
  }
  const parsed = parseOptions('agent workflow index', args.slice(1), globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError('agent workflow index', globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: 'agent workflow index does not accept positional arguments.',
      details: { argument: parsed.positionals[0] }
    });
  }
  return { ok: true, command: 'agent workflow index', json: globals.json, options: parsed.options };
}

function parseAgentExecution(args, globals) {
  const subcommand = args[0];
  if (!['plan', 'run', 'status', 'list'].includes(subcommand)) {
    return parseError('agent execution', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown agent execution subcommand: ${subcommand}` : 'agent execution requires a subcommand.',
      details: { subcommands: ['plan', 'run', 'status', 'list'] }
    });
  }
  if (subcommand === 'plan') {
    return parseRequiredOptions('agent execution plan', args.slice(1), globals, ['package', 'surface']);
  }
  if (subcommand === 'run') {
    const parsed = parseRequiredOptions('agent execution run', args.slice(1), globals, ['execution', 'package', 'surface', 'provider', 'model']);
    if (!parsed.ok) {
      return parsed;
    }
    if (!parsed.options.execute) {
      return parseError('agent execution run', globals.json, {
        code: 'MISSING_REQUIRED_OPTION',
        message: 'agent execution run requires --execute.',
        details: { option: 'execute' }
      });
    }
    return parsed;
  }
  if (subcommand === 'status') {
    return parseRequiredOptions('agent execution status', args.slice(1), globals, ['execution']);
  }
  const parsed = parseOptions('agent execution list', args.slice(1), globals.json);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.positionals.length > 0) {
    return parseError('agent execution list', globals.json, {
      code: 'UNEXPECTED_ARGUMENT',
      message: 'agent execution list does not accept positional arguments.',
      details: { argument: parsed.positionals[0] }
    });
  }
  return { ok: true, command: 'agent execution list', json: globals.json, options: parsed.options };
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
  const reviewInputs = ['url', 'target', 'input', 'image'].filter((key) => parsed.options[key]);
  if (reviewInputs.length === 0) {
    return parseError('review', globals.json, {
      code: 'MISSING_REQUIRED_OPTION',
      message: 'review requires --url <url>, --target <manifest>, --image <path>, or --input -.',
      details: { options: ['url', 'target', 'image', 'input'] }
    });
  }
  if (reviewInputs.length > 1) {
    return parseError('review', globals.json, {
      code: 'CONFLICTING_OPTIONS',
      message: 'review accepts only one input source: --url, --target, --image, or --input -.',
      details: { options: reviewInputs }
    });
  }
  if (parsed.options.url) {
    const urlError = validateUrl(parsed.options.url);
    if (urlError) {
      return parseError('review', globals.json, urlError);
    }
  }
  if (parsed.options.image) {
    const imageError = validateImageInput(parsed.options.image, parsed.options);
    if (imageError) {
      return parseError('review', globals.json, imageError);
    }
    const imageSourceError = validateImageReviewSource(parsed.options.source);
    if (imageSourceError) {
      return parseError('review', globals.json, imageSourceError);
    }
  } else if (parsed.options['capture-handoff']) {
    return parseError('review', globals.json, {
      code: 'UNSUPPORTED_REVIEW_CAPTURE_HANDOFF_OPTION',
      message: 'review --capture-handoff is only supported with review --image.',
      details: { option: 'capture-handoff' }
    });
  } else if (parsed.options.source) {
    return parseError('review', globals.json, {
      code: 'UNSUPPORTED_REVIEW_SOURCE_OPTION',
      message: 'review --source is only supported with review --image.',
      details: { option: 'source' }
    });
  }
  return { ok: true, command: 'review', json: globals.json, options: parsed.options };
}

function validateImageInput(value, options) {
  const image = String(value ?? '').trim();
  if (!image || image === '-') {
    return {
      code: 'INVALID_IMAGE_INPUT',
      message: 'review --image requires a workspace-relative image file path.',
      details: { image: value }
    };
  }
  if (image.startsWith('@')) {
    return {
      code: 'INVALID_IMAGE_INPUT',
      message: 'review --image does not accept @file indirection.',
      details: { image }
    };
  }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/|[A-Za-z]:[\\/])/i.test(image) || image.includes('\0')) {
    return {
      code: 'INVALID_IMAGE_INPUT',
      message: 'review --image must be a workspace-relative file path, not a URL, data URI, absolute path, or raw input stream.',
      details: { image }
    };
  }
  if (image.split(/[\\/]+/).includes('..')) {
    return {
      code: 'INVALID_IMAGE_INPUT',
      message: 'review --image must not contain parent directory traversal.',
      details: { image }
    };
  }
  const disallowed = ['provider', 'model', 'execute'].filter((key) => options[key] !== undefined);
  if (disallowed.length > 0) {
    return {
      code: 'CONFLICTING_OPTIONS',
      message: 'review --image does not accept provider, model, or execute options.',
      details: { options: disallowed }
    };
  }
  return null;
}

function validateImageReviewSource(value) {
  if (value === undefined) {
    return null;
  }
  const source = String(value ?? '').trim();
  if (['image', 'screen', 'window', 'desktop-app'].includes(source)) {
    return null;
  }
  return {
    code: 'INVALID_IMAGE_REVIEW_SOURCE',
    message: 'review --image --source must be one of: image, screen, window, desktop-app.',
    details: { source: value }
  };
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
  if (subcommand === 'execution') {
    if (args[1] !== 'gates') {
      return parseError('mcp execution', globals.json, {
        code: args[1] ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
        message: args[1] ? `Unknown mcp execution subcommand: ${args[1]}` : 'mcp execution requires a subcommand.',
        details: { subcommands: ['gates'] }
      });
    }
    return parseOptionalOptions('mcp execution gates', args.slice(2), globals);
  }
  if (subcommand !== 'serve' && subcommand !== 'config' && subcommand !== 'capabilities') {
    return parseError('mcp', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown mcp subcommand: ${subcommand}` : 'mcp requires a subcommand.',
      details: { subcommands: ['serve', 'config', 'capabilities', 'execution gates'] }
    });
  }
  return parseOptionalOptions(`mcp ${subcommand}`, args.slice(1), globals);
}

function parseOperation(args, globals) {
  if (globals.help) {
    return { ok: true, command: 'help', json: globals.json, options: { topic: 'operation' } };
  }
  const subcommand = args[0];
  if (subcommand !== 'registry' && subcommand !== 'roadmap' && subcommand !== 'contracts' && subcommand !== 'policy' && subcommand !== 'admin-readiness' && subcommand !== 'provider-readiness') {
    return parseError('operation', globals.json, {
      code: subcommand ? 'UNKNOWN_SUBCOMMAND' : 'MISSING_SUBCOMMAND',
      message: subcommand ? `Unknown operation subcommand: ${subcommand}` : 'operation requires a subcommand.',
      details: { subcommands: ['registry', 'roadmap', 'contracts', 'policy', 'admin-readiness', 'provider-readiness'] }
    });
  }
  return parseOptionalOptions(`operation ${subcommand}`, args.slice(1), globals);
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
    'agent requests show',
    'agent workflow create',
    'agent workflow status',
    'agent workflow index',
    'agent workflow report',
    'agent execution plan',
    'agent execution run',
    'agent execution status',
    'agent execution list',
    'visual review plan',
    'visual review prepare',
    'visual review run',
    'visual review status',
    'visual review list',
    'visual review dashboard',
    'identity audit',
    'capture readiness',
    'capture status',
    'capture plan',
    'capture run',
    'capture handoff',
    'settings show',
    'settings language',
    'settings language policy',
    'settings locale resources',
    'settings report templates',
    'translation readiness',
    'translation dry-run',
    'translation run',
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
    'mcp serve',
    'mcp config',
    'mcp capabilities',
    'mcp execution gates',
    'operation registry',
    'operation roadmap',
    'operation contracts',
    'operation policy',
    'operation admin-readiness',
    'operation provider-readiness'
  ];
}
