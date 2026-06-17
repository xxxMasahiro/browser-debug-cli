import { CLI_NAME, DEFAULT_ARTIFACT_ROOT, PACKAGE_VERSION, PLANNED_COMMANDS } from './constants.js';
import { runDoctor } from './doctor.js';
import { createEnvelope, createErrorEnvelope, stringifyEnvelope } from './envelope.js';
import { runObserve } from './observe.js';
import { parseCliArgs } from './parser.js';
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

  if (topic === 'doctor') {
    return `Usage: ${CLI_NAME} doctor [--json]`;
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
    '  session start [--url <url>]',
    '  session close --session <id>',
    '  act --session <id> --action <json>',
    '  report --session <id>',
    '  spec export --session <id>',
    '',
    'Global options:',
    '  --json',
    '  --help, -h',
    '  --version, -V'
  ].join('\n');
}
