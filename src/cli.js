import { CLI_NAME, DEFAULT_ARTIFACT_ROOT, PACKAGE_VERSION, PLANNED_COMMANDS } from './constants.js';
import { daemonStatus, startDaemon, stopDaemon } from './daemon.js';
import { runDoctor } from './doctor.js';
import { createEnvelope, createErrorEnvelope, stringifyEnvelope } from './envelope.js';
import { runObserve } from './observe.js';
import { parseCliArgs } from './parser.js';
import { runReview } from './review.js';
import { schemaListResult, schemaResult } from './schema-registry.js';
import { runSupervisor } from './supervisor.js';
import { runTargetInit, runTargetValidate } from './target.js';
import {
  buildReport,
  closeSession,
  exportSpec,
  runSessionAction,
  startSession
} from './sessions.js';

export async function runCli(argv, context = {}) {
  const result = await executeCli(argv, context);
  if (result.stdout && context.stdout) {
    context.stdout.write(result.stdout);
  }
  if (result.stderr && context.stderr) {
    context.stderr.write(result.stderr);
  }
  return result.exitCode;
}

export async function executeCli(argv, context = {}) {
  const parsed = parseCliArgs(argv);
  const now = context.now ?? (() => new Date());

  if (!parsed.ok) {
    const envelope = createErrorEnvelope({
      command: parsed.command,
      code: parsed.error.code,
      message: parsed.error.message,
      details: parsed.error.details,
      now
    });
    return formatResult(envelope, parsed.json, 2);
  }

  if (parsed.command === 'help') {
    const envelope = createEnvelope({
      command: 'help',
      status: 'ok',
      data: {
        usage: usageText(parsed.options.topic),
        planned_commands: PLANNED_COMMANDS
      },
      now
    });
    return formatResult(envelope, parsed.json, 0, usageText(parsed.options.topic));
  }

  if (parsed.command === 'version') {
    const envelope = createEnvelope({
      command: 'version',
      status: 'ok',
      data: { version: PACKAGE_VERSION },
      now
    });
    return formatResult(envelope, parsed.json, 0, `${PACKAGE_VERSION}\n`);
  }

  try {
    if (parsed.command === 'doctor') {
      const doctor = await runDoctor({
        cwd: context.cwd,
        nodeVersion: context.nodeVersion,
        platform: context.platform,
        importPlaywright: context.importPlaywright
      });
      const envelope = createEnvelope({
        command: 'doctor',
        status: doctor.status,
        data: doctor.data,
        warnings: doctor.warnings,
        errors: doctor.errors,
        artifacts: [],
        now
      });
      return formatResult(envelope, parsed.json, doctor.status === 'ok' ? 0 : 1, doctorText(envelope));
    }

    if (parsed.command === 'observe') {
      return runtimeResult(parsed.command, await (context.observeRunner ?? runObserve)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'supervise') {
      return runtimeResult(parsed.command, await (context.supervisorRunner ?? runSupervisor)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'daemon start') {
      return runtimeResult(parsed.command, await (context.daemonStartRunner ?? startDaemon)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'daemon status') {
      return runtimeResult(parsed.command, await (context.daemonStatusRunner ?? daemonStatus)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'daemon stop') {
      return runtimeResult(parsed.command, await (context.daemonStopRunner ?? stopDaemon)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'target init') {
      return runtimeResult(parsed.command, await (context.targetInitRunner ?? runTargetInit)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'target validate') {
      return runtimeResult(parsed.command, await (context.targetValidateRunner ?? runTargetValidate)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'session start') {
      return runtimeResult(parsed.command, await startSession(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'session close') {
      return runtimeResult(parsed.command, await closeSession(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'act') {
      return runtimeResult(parsed.command, await runSessionAction(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'report') {
      return runtimeResult(parsed.command, await buildReport(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'spec export') {
      return runtimeResult(parsed.command, await exportSpec(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'review') {
      return runtimeResult(parsed.command, await (context.reviewRunner ?? runReview)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'schema list') {
      return runtimeResult(parsed.command, schemaListResult(), parsed.json, now);
    }

    if (parsed.command === 'schema get') {
      return runtimeResult(parsed.command, schemaResult(parsed.options.name), parsed.json, now);
    }

    if (parsed.command === 'mcp serve') {
      return runtimeResult(parsed.command, mcpServeInfo(), parsed.json, now);
    }

    return notImplemented(parsed.command, parsed.json, now);
  } catch (error) {
    const envelope = createErrorEnvelope({
      command: parsed.command,
      code: classifyRuntimeError(error),
      message: error.message,
      details: {},
      now
    });
    return formatResult(envelope, parsed.json, 1);
  }
}

function notImplemented(command, json, now) {
  const envelope = createErrorEnvelope({
    command,
    code: 'NOT_IMPLEMENTED',
    message: `${command} is planned but not implemented in this no-browser slice.`,
    details: {
      browser_launched: false,
      artifact_root: DEFAULT_ARTIFACT_ROOT
    },
    now
  });
  return formatResult(envelope, json, 2);
}

function runtimeResult(command, result, json, now) {
  const envelope = createEnvelope({
    command,
    status: result.status,
    data: result.data,
    warnings: result.warnings,
    errors: result.errors,
    artifacts: result.artifacts,
    now
  });
  return formatResult(envelope, json, result.status === 'ok' ? 0 : 1, runtimeText(command, envelope));
}

function formatResult(envelope, json, exitCode, textOutput = '') {
  if (json) {
    return {
      exitCode,
      stdout: stringifyEnvelope(envelope),
      stderr: '',
      envelope
    };
  }

  if (envelope.status === 'error') {
    return {
      exitCode,
      stdout: '',
      stderr: errorText(envelope),
      envelope
    };
  }

  return {
    exitCode,
    stdout: textOutput || `${envelope.command}: ${envelope.status}\n`,
    stderr: '',
    envelope
  };
}

function errorText(envelope) {
  const [error] = envelope.errors;
  return `Error ${error.code}: ${error.message}\n`;
}

function doctorText(envelope) {
  const lines = [
    `${CLI_NAME} doctor: ${envelope.status}`,
    ...envelope.data.checks.map((check) => `- ${check.id}: ${check.status} - ${check.summary}`)
  ];
  if (envelope.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of envelope.warnings) {
      lines.push(`- ${warning.code}: ${warning.message}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function runtimeText(command, envelope) {
  if (envelope.status !== 'ok') {
    return errorText(envelope);
  }
  const artifactLines = envelope.artifacts.map((artifact) => `- ${artifact.type}: ${artifact.path}`);
  return [
    `${CLI_NAME} ${command}: ok`,
    ...artifactLines
  ].join('\n') + '\n';
}

function classifyRuntimeError(error) {
  if (error.code === 'ENOENT') {
    return 'SESSION_NOT_FOUND';
  }
  return 'RUNTIME_ERROR';
}

function usageText(topic) {
  if (topic === 'observe') {
    return [
      `Usage: ${CLI_NAME} observe --url <url> [--json]`,
      '',
      'Options:',
      '  --url <url>              Absolute http, https, or file URL to inspect.',
      `  --artifact-root <path>   Local artifact root. Default: ${DEFAULT_ARTIFACT_ROOT}`,
      '  --headed                 Run the observation in a visible browser.',
      '  --devtools               Run the observation in a visible browser with DevTools.',
      '  --screenshot             Capture a full-page screenshot.',
      '  --trace                  Capture a local Playwright trace zip.'
    ].join('\n');
  }

  if (topic === 'supervise') {
    return [
      `Usage: ${CLI_NAME} supervise --url <url> [--actions <json-array>] [--json]`,
      '',
      'Options:',
      '  --url <url>              Absolute http, https, or file URL to inspect.',
      '  --actions <json-array>   Ordered actions applied in one ephemeral browser context.',
      `  --artifact-root <path>   Local artifact root. Default: ${DEFAULT_ARTIFACT_ROOT}`,
      '  --headed                 Run supervision in a visible browser.',
      '  --devtools               Run supervision in a visible browser with DevTools.',
      '  --screenshot             Capture a final full-page screenshot.',
      '  --trace                  Capture one local Playwright trace zip for the supervised run.'
    ].join('\n');
  }

  if (topic === 'doctor') {
    return `Usage: ${CLI_NAME} doctor [--json]`;
  }

  if (topic === 'daemon' || topic === 'daemon start') {
    return [
      `Usage: ${CLI_NAME} daemon start --url <url> [--json]`,
      '',
      'Options:',
      '  --url <url>              Absolute http, https, or file URL to inspect.',
      `  --artifact-root <path>   Local artifact root. Default: ${DEFAULT_ARTIFACT_ROOT}`,
      '  --headed                 Keep the background browser visible.',
      '  --devtools               Keep the background browser visible with DevTools.'
    ].join('\n');
  }

  if (topic === 'daemon status') {
    return `Usage: ${CLI_NAME} daemon status --daemon <id> [--json]`;
  }

  if (topic === 'daemon stop') {
    return `Usage: ${CLI_NAME} daemon stop --daemon <id> [--json]`;
  }

  if (topic === 'review') {
    return [
      `Usage: ${CLI_NAME} review (--url <url> | --target <manifest> | --input -) [--json]`,
      '',
      'Options:',
      '  --url <url>              Absolute http, https, or file URL to review.',
      '  --target <manifest>      Target manifest path, @file, or inline JSON.',
      '  --input -                Read a target manifest JSON from stdin when provided by the caller.',
      '  --viewport <name|WxH>    Viewport profile or explicit size. Default: laptop.',
      `  --artifact-root <path>   Local artifact root. Default: ${DEFAULT_ARTIFACT_ROOT}`,
      '  --screenshot             Capture screenshot evidence.',
      '  --mock <path>            Compare against a workspace-relative PNG mock.',
      '  --threshold <number>     Mock byte-difference threshold. Default: 0.01.',
      '  --report                 Write a Markdown review report.'
    ].join('\n');
  }

  if (topic === 'target' || topic === 'target init') {
    return [
      `Usage: ${CLI_NAME} target init --url <url> [--name <name>] [--viewport <name-or-size>] [--max-routes <n>] [--json]`,
      `       ${CLI_NAME} target validate (--target <manifest> | --input -) [--json]`,
      '',
      'Options:',
      '  --url <url>              Absolute http, https, or file URL to seed.',
      '  --name <name>            Human-readable manifest name.',
      '  --viewport <name|WxH>    Optional single viewport; defaults to desktop and mobile.',
      '  --max-routes <n>         Route discovery budget for generated manifests.',
      '  --target <manifest>      Target manifest path, @file, or inline JSON to validate.',
      '  --input -                Read a target manifest JSON from stdin for validation.',
      `  --artifact-root <path>   Local artifact root. Default: ${DEFAULT_ARTIFACT_ROOT}`
    ].join('\n');
  }

  if (topic === 'target validate') {
    return [
      `Usage: ${CLI_NAME} target validate (--target <manifest> | --input -) [--json]`,
      '',
      'Options:',
      '  --target <manifest>      Target manifest path, @file, or inline JSON.',
      '  --input -                Read a target manifest JSON from stdin when provided by the caller.'
    ].join('\n');
  }

  if (topic === 'schema') {
    return [
      `Usage: ${CLI_NAME} schema list [--json]`,
      `       ${CLI_NAME} schema get --name <schema> [--json]`
    ].join('\n');
  }

  if (topic === 'mcp') {
    return `Usage: ${CLI_NAME} mcp serve [--json]`;
  }

  if (topic === 'session start') {
    return `Usage: ${CLI_NAME} session start [--url <url>] [--json]`;
  }

  return [
    `Usage: ${CLI_NAME} <command> [options]`,
    '',
    'Commands:',
    '  doctor',
    '  observe --url <url> --json',
    '  supervise --url <url> [--actions <json-array>] --json',
    '  daemon start --url <url> --json',
    '  daemon status --daemon <id> --json',
    '  daemon stop --daemon <id> --json',
    '  target init --url <url> --json',
    '  target validate --target <manifest> --json',
    '  session start [--url <url>]',
    '  session close --session <id>',
    '  act --session <id> --action <json>',
    '  report --session <id>',
    '  spec export --session <id>',
    '  review --url <url> --json',
    '  review --target <manifest> --json',
    '  schema list --json',
    '  schema get --name <schema> --json',
    '  mcp serve --json',
    '',
    'Global options:',
    '  --json',
    '  --help, -h',
    '  --version, -V'
  ].join('\n');
}

function mcpServeInfo() {
  return {
    status: 'ok',
    data: {
      adapter: {
        transport: 'stdio',
        local_only: true,
        external_channel: false,
        shell_tools: false,
        cleanup_tools: false,
        executable: 'browser-debug-mcp'
      }
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}
