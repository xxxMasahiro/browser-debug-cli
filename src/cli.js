import { CLI_NAME, DEFAULT_ARTIFACT_ROOT, PACKAGE_VERSION, PLANNED_COMMANDS } from './constants.js';
import {
  runAgentExecutionList,
  runAgentExecutionPlan,
  runAgentExecutionRun,
  runAgentExecutionStatus
} from './agent-execution.js';
import {
  runAgenticHumanReviewList,
  runAgenticHumanReviewPlan,
  runAgenticHumanReviewRun,
  runAgenticHumanReviewStatus
} from './agentic-human-review.js';
import {
  runAgentIngest,
  runAgentPackage,
  runAgentReport,
  runAgentRequestsList,
  runAgentRequestsShow,
  runAgentSurfacesList,
  runAgentWorkflowCreate,
  runAgentWorkflowIndex,
  runAgentWorkflowReport,
  runAgentWorkflowStatus
} from './agent.js';
import { daemonStatus, startDaemon, stopDaemon } from './daemon.js';
import { buildDesktopReviewProviderPreparationPlan } from './desktop-review-provider-preparation-plan.js';
import { runDoctor } from './doctor.js';
import { createEnvelope, createErrorEnvelope, stringifyEnvelope } from './envelope.js';
import { runArtifactRootMigrationExecute, runArtifactRootMigrationPlan } from './artifact-root-migration.js';
import { runArtifactRootStatus } from './artifact-root-policy.js';
import { runImageReview } from './image-review.js';
import { runIdentityAudit } from './identity-audit.js';
import { runLegacyAliasAudit } from './legacy-alias-audit.js';
import {
  legacyAliasRemovalUnavailableInfo,
  runLegacyAliasRemovalReadiness
} from './legacy-alias-removal-readiness.js';
import { runObserve } from './observe.js';
import { parseCliArgs } from './parser.js';
import { PRODUCT_IDENTITY } from './product-identity.js';
import { runReleaseReadiness } from './release-readiness.js';
import {
  constrainedShellRunUnavailableInfo,
  runConstrainedShellPlan,
  runConstrainedShellReadiness
} from './constrained-shell-readiness.js';
import { runFinalHardeningReadiness } from './final-hardening-readiness.js';
import { runResourceArtifactsCleanup, runResourceArtifactsPlan } from './resource-artifacts.js';
import { runResourceStatus } from './resource-status.js';
import { runReview } from './review.js';
import { schemaListResult, schemaResult } from './schema-registry.js';
import { runSupervisor } from './supervisor.js';
import { runTargetInit, runTargetValidate } from './target.js';
import { buildMcpCapabilityReport } from './mcp-capabilities.js';
import { runCaptureHandoff } from './capture-handoff.js';
import { buildCapturePlan } from './capture-plan.js';
import { buildCaptureReadiness } from './capture-readiness.js';
import {
  runLanguageSettings,
  runLanguageSettingsPolicy,
  runSettingsShow
} from './language-settings.js';
import {
  runLocalizationResources,
  runReportTemplates,
  runTranslationDryRun,
  runTranslationReadiness,
  translationBoundary
} from './localization-resources.js';
import { buildMcpExecutionGateReport } from './mcp-execution-gates.js';
import { buildOperationAdminReadinessReport } from './operation-admin-readiness.js';
import { buildOperationContractsReport } from './operation-contracts.js';
import { buildOperationPolicyReport } from './operation-policy.js';
import { buildOperationProviderReadinessReport } from './operation-provider-readiness.js';
import { buildOperationRegistryReport } from './operation-registry.js';
import { buildOperationRoadmapReport } from './operation-roadmap.js';
import { runVisualReviewResultPreparation } from './visual-review-result-preparation.js';
import {
  runVisualReviewExecutionList,
  runVisualReviewExecutionRun,
  runVisualReviewExecutionStatus
} from './visual-review-execution.js';
import { runVisualReviewDashboard } from './visual-review-dashboard.js';
import { runVisualReviewAggregation } from './visual-review-aggregation.js';
import { buildMcpClientConfig } from './mcp-client-config.js';
import { mcpProfileMetadata } from './mcp-profiles.js';
import { mcpServerInfo } from './mcp.js';
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
    await writeStream(context.stdout, result.stdout);
  }
  if (result.stderr && context.stderr) {
    await writeStream(context.stderr, result.stderr);
  }
  return result.exitCode;
}

function writeStream(stream, text) {
  return new Promise((resolve, reject) => {
    stream.write(text, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
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

    if (parsed.command === 'resource status') {
      return runtimeResult(parsed.command, await (context.resourceStatusRunner ?? runResourceStatus)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'resource artifacts plan') {
      return runtimeResult(parsed.command, await (context.resourceArtifactsPlanRunner ?? runResourceArtifactsPlan)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'resource artifacts cleanup') {
      return runtimeResult(parsed.command, await (context.resourceArtifactsCleanupRunner ?? runResourceArtifactsCleanup)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agent surfaces list') {
      return runtimeResult(parsed.command, await (context.agentSurfacesListRunner ?? runAgentSurfacesList)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agent requests list') {
      return runtimeResult(parsed.command, await (context.agentRequestsListRunner ?? runAgentRequestsList)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agent requests show') {
      return runtimeResult(parsed.command, await (context.agentRequestsShowRunner ?? runAgentRequestsShow)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agent workflow create') {
      return runtimeResult(parsed.command, await (context.agentWorkflowCreateRunner ?? runAgentWorkflowCreate)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agent workflow status') {
      return runtimeResult(parsed.command, await (context.agentWorkflowStatusRunner ?? runAgentWorkflowStatus)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agent workflow index') {
      return runtimeResult(parsed.command, await (context.agentWorkflowIndexRunner ?? runAgentWorkflowIndex)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agent workflow report') {
      return runtimeResult(parsed.command, await (context.agentWorkflowReportRunner ?? runAgentWorkflowReport)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agent execution plan') {
      return runtimeResult(parsed.command, await (context.agentExecutionPlanRunner ?? runAgentExecutionPlan)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agent execution run') {
      return runtimeResult(parsed.command, await (context.agentExecutionRunRunner ?? runAgentExecutionRun)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agent execution status') {
      return runtimeResult(parsed.command, await (context.agentExecutionStatusRunner ?? runAgentExecutionStatus)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agent execution list') {
      return runtimeResult(parsed.command, await (context.agentExecutionListRunner ?? runAgentExecutionList)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agentic review plan') {
      return runtimeResult(parsed.command, await (context.agenticHumanReviewPlanRunner ?? runAgenticHumanReviewPlan)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agentic review run') {
      return runtimeResult(parsed.command, await (context.agenticHumanReviewRunRunner ?? runAgenticHumanReviewRun)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agentic review status') {
      return runtimeResult(parsed.command, await (context.agenticHumanReviewStatusRunner ?? runAgenticHumanReviewStatus)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agentic review list') {
      return runtimeResult(parsed.command, await (context.agenticHumanReviewListRunner ?? runAgenticHumanReviewList)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'visual review plan') {
      return runtimeResult(parsed.command, await (context.desktopReviewProviderPreparationPlanRunner ?? buildDesktopReviewProviderPreparationPlan)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'visual review prepare') {
      return runtimeResult(parsed.command, await (context.visualReviewResultPreparationRunner ?? runVisualReviewResultPreparation)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'visual review run') {
      return runtimeResult(parsed.command, await (context.visualReviewExecutionRunRunner ?? runVisualReviewExecutionRun)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'visual review status') {
      return runtimeResult(parsed.command, await (context.visualReviewExecutionStatusRunner ?? runVisualReviewExecutionStatus)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'visual review list') {
      return runtimeResult(parsed.command, await (context.visualReviewExecutionListRunner ?? runVisualReviewExecutionList)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'visual review dashboard') {
      return runtimeResult(parsed.command, await (context.visualReviewDashboardRunner ?? runVisualReviewDashboard)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'visual review aggregate') {
      return runtimeResult(parsed.command, await (context.visualReviewAggregationRunner ?? runVisualReviewAggregation)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'identity audit') {
      return runtimeResult(parsed.command, await (context.identityAuditRunner ?? runIdentityAudit)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'identity aliases') {
      return runtimeResult(parsed.command, await (context.legacyAliasAuditRunner ?? runLegacyAliasAudit)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'identity aliases removal-readiness') {
      return runtimeResult(parsed.command, await (context.legacyAliasRemovalReadinessRunner ?? runLegacyAliasRemovalReadiness)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'identity aliases remove') {
      return runtimeResult(parsed.command, legacyAliasRemovalUnavailableInfo(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'release readiness') {
      return runtimeResult(parsed.command, await (context.releaseReadinessRunner ?? runReleaseReadiness)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'shell readiness') {
      return runtimeResult(parsed.command, await (context.constrainedShellReadinessRunner ?? runConstrainedShellReadiness)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'shell plan') {
      return runtimeResult(parsed.command, await (context.constrainedShellPlanRunner ?? runConstrainedShellPlan)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'shell run') {
      return runtimeResult(parsed.command, constrainedShellRunUnavailableInfo(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'final readiness') {
      return runtimeResult(parsed.command, await (context.finalHardeningReadinessRunner ?? runFinalHardeningReadiness)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'artifact-root status') {
      return runtimeResult(parsed.command, await (context.artifactRootStatusRunner ?? runArtifactRootStatus)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'artifact-root migration plan') {
      return runtimeResult(parsed.command, await (context.artifactRootMigrationPlanRunner ?? runArtifactRootMigrationPlan)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'artifact-root migration execute') {
      return runtimeResult(parsed.command, await (context.artifactRootMigrationExecuteRunner ?? runArtifactRootMigrationExecute)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'capture plan') {
      const capturePlan = capturePlanInfo(parsed.options, { now });
      return runtimeResult(parsed.command, capturePlan, parsed.json, now);
    }

    if (parsed.command === 'capture readiness' || parsed.command === 'capture status') {
      const captureReadiness = captureReadinessInfo(parsed.options, { now });
      return runtimeResult(parsed.command, captureReadiness, parsed.json, now);
    }

    if (parsed.command === 'capture run') {
      const captureRun = captureRunUnavailableInfo(parsed.options, { now });
      return runtimeResult(parsed.command, captureRun, parsed.json, now);
    }

    if (parsed.command === 'capture handoff') {
      return runtimeResult(parsed.command, await (context.captureHandoffRunner ?? runCaptureHandoff)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'settings show') {
      return runtimeResult(parsed.command, await (context.settingsShowRunner ?? runSettingsShow)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'settings language') {
      return runtimeResult(parsed.command, await (context.languageSettingsRunner ?? runLanguageSettings)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'settings language policy') {
      return runtimeResult(parsed.command, await (context.languageSettingsPolicyRunner ?? runLanguageSettingsPolicy)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'settings locale resources') {
      return runtimeResult(parsed.command, await (context.localizationResourcesRunner ?? runLocalizationResources)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'settings report templates') {
      return runtimeResult(parsed.command, await (context.reportTemplatesRunner ?? runReportTemplates)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'translation readiness') {
      return runtimeResult(parsed.command, await (context.translationReadinessRunner ?? runTranslationReadiness)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'translation dry-run') {
      return runtimeResult(parsed.command, await (context.translationDryRunRunner ?? runTranslationDryRun)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'translation run') {
      return runtimeResult(parsed.command, translationRunUnavailableInfo(parsed.options), parsed.json, now);
    }

    if (parsed.command === 'agent package') {
      return runtimeResult(parsed.command, await (context.agentPackageRunner ?? runAgentPackage)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agent ingest') {
      return runtimeResult(parsed.command, await (context.agentIngestRunner ?? runAgentIngest)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'agent report') {
      return runtimeResult(parsed.command, await (context.agentReportRunner ?? runAgentReport)(parsed.options, context), parsed.json, now);
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
      if (parsed.options.image) {
        return runtimeResult(parsed.command, await (context.imageReviewRunner ?? runImageReview)(parsed.options, context), parsed.json, now);
      }
      return runtimeResult(parsed.command, await (context.reviewRunner ?? runReview)(parsed.options, context), parsed.json, now);
    }

    if (parsed.command === 'schema list') {
      return runtimeResult(parsed.command, schemaListResult(), parsed.json, now);
    }

    if (parsed.command === 'schema get') {
      return runtimeResult(parsed.command, schemaResult(parsed.options.name), parsed.json, now);
    }

    if (parsed.command === 'mcp serve') {
      const mcpInfo = mcpServeInfo(parsed.options);
      if (mcpInfo.status === 'error') {
        return runtimeResult(parsed.command, mcpInfo, parsed.json, now, 2);
      }
      return runtimeResult(parsed.command, mcpInfo, parsed.json, now);
    }

    if (parsed.command === 'mcp config') {
      const mcpConfig = mcpConfigInfo(parsed.options, context.env ?? process.env);
      return runtimeResult(parsed.command, mcpConfig, parsed.json, now);
    }

    if (parsed.command === 'mcp capabilities') {
      const mcpCapabilities = mcpCapabilitiesInfo(parsed.options);
      return runtimeResult(parsed.command, mcpCapabilities, parsed.json, now);
    }

    if (parsed.command === 'mcp execution gates') {
      const mcpExecutionGates = mcpExecutionGatesInfo(parsed.options, { now });
      return runtimeResult(parsed.command, mcpExecutionGates, parsed.json, now);
    }

    if (parsed.command === 'operation registry') {
      const operationRegistry = operationRegistryInfo(parsed.options, { now });
      return runtimeResult(parsed.command, operationRegistry, parsed.json, now);
    }

    if (parsed.command === 'operation roadmap') {
      const operationRoadmap = operationRoadmapInfo(parsed.options, { now });
      return runtimeResult(parsed.command, operationRoadmap, parsed.json, now);
    }

    if (parsed.command === 'operation contracts') {
      const operationContracts = operationContractsInfo(parsed.options, { now });
      return runtimeResult(parsed.command, operationContracts, parsed.json, now);
    }

    if (parsed.command === 'operation policy') {
      const operationPolicy = operationPolicyInfo(parsed.options, { now, cwd: context.cwd });
      return runtimeResult(parsed.command, operationPolicy, parsed.json, now);
    }

    if (parsed.command === 'operation admin-readiness') {
      const operationAdminReadiness = operationAdminReadinessInfo(parsed.options, { now, cwd: context.cwd });
      return runtimeResult(parsed.command, operationAdminReadiness, parsed.json, now);
    }

    if (parsed.command === 'operation provider-readiness') {
      const operationProviderReadiness = operationProviderReadinessInfo(parsed.options, { now, cwd: context.cwd });
      return runtimeResult(parsed.command, operationProviderReadiness, parsed.json, now);
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
      '  --idle-timeout <dur>     Stop the daemon after local inactivity. Example: 15m.',
      '  --max-lifetime <dur>     Stop the daemon after a fixed lifetime. Example: 2h.',
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

  if (topic === 'resource' || topic === 'resource status') {
    return [
      `Usage: ${CLI_NAME} resource status [--json]`,
      `       ${CLI_NAME} resource artifacts plan [--max-bytes <bytes>] [--json]`,
      `       ${CLI_NAME} resource artifacts cleanup [--dry-run|--execute] [--max-bytes <bytes>] [--json]`,
      '',
      'Reports local memory and local artifact pressure without launching a browser or mutating the host.'
    ].join('\n');
  }

  if (topic === 'resource artifacts' || topic === 'resource artifacts plan' || topic === 'resource artifacts cleanup') {
    return [
      `Usage: ${CLI_NAME} resource artifacts plan [--max-bytes <bytes>] [--older-than <dur>] [--json]`,
      `       ${CLI_NAME} resource artifacts cleanup [--dry-run|--execute] [--max-bytes <bytes>] [--older-than <dur>] [--plan-hash <sha256>] [--json]`,
      '',
      'Options:',
      `  --artifact-root <path>   Local artifact root. Default: ${DEFAULT_ARTIFACT_ROOT}`,
      '  --max-bytes <bytes>      Target retained artifact size. Default: 1gib.',
      '  --older-than <dur>       Select regular artifact files older than the duration.',
      '  --plan-hash <sha256>     Optional cleanup plan hash to revalidate before execution.',
      '  --dry-run                Show cleanup candidates without deleting files.',
      '  --execute                Delete selected regular files under the artifact root and write a receipt.'
    ].join('\n');
  }

  if (
    topic === 'visual review plan'
  ) {
    return [
      `Usage: ${CLI_NAME} visual review plan --capture-handoff <workspace-json|-> [--surface <id>] [--provider <id>] [--model <id>] [--json]`,
      '',
      'Plans desktop review provider preparation from capture handoff metadata only. It reads no image bytes, writes no artifacts, calls no providers, transfers no evidence, and exposes no MCP tool.'
    ].join('\n');
  }

  if (topic === 'identity' || topic === 'identity audit') {
    return [
      `Usage: ${CLI_NAME} identity audit [--json]`,
      `       ${CLI_NAME} identity aliases [--json]`,
      `       ${CLI_NAME} identity aliases removal-readiness [--json]`,
      `       ${CLI_NAME} identity aliases remove --execute [--json]`,
      '',
      'Reports product identity, current checkout name, current origin remote, repository rename state, legacy alias compatibility, removal readiness, and artifact-root migration boundaries without mutating Git, contacting remotes, launching browsers, removing aliases, or writing artifacts.'
    ].join('\n');
  }

  if (topic === 'shell' || topic === 'shell readiness' || topic === 'shell plan' || topic === 'shell run') {
    return [
      `Usage: ${CLI_NAME} shell readiness [--json]`,
      `       ${CLI_NAME} shell plan [--json]`,
      `       ${CLI_NAME} shell run --execute [--json]`,
      '',
      'Reports constrained shell use-case review, threat model, command schema, and readiness boundaries without executing commands. shell run fails closed until a separately approved runner exists.'
    ].join('\n');
  }

  if (topic === 'final' || topic === 'final readiness') {
    return [
      `Usage: ${CLI_NAME} final readiness [--json]`,
      '',
      'Reports the local cross-feature regression matrix, smoke rebaseline plan, security sweep, docs English scan, and final product-gate readiness without running gates, launching browsers, triggering remote CI, publishing, pushing, or mutating files.'
    ].join('\n');
  }

  if (topic === 'release' || topic === 'release readiness') {
    return [
      `Usage: ${CLI_NAME} release readiness [--json]`,
      '',
      'Reports local package release readiness, publication decisions, provenance/2FA/token policy, and publish dry-run boundaries without contacting npm, checking auth, reading tokens, publishing, or mutating package metadata.'
    ].join('\n');
  }

  if (topic === 'artifact-root' || topic === 'artifact-root status' || topic === 'artifact-root migration plan' || topic === 'artifact-root migration execute') {
    return [
      `Usage: ${CLI_NAME} artifact-root status [--json]`,
      `       ${CLI_NAME} artifact-root migration plan [--json]`,
      `       ${CLI_NAME} artifact-root migration execute --execute --fixture-root <path> [--plan-hash <sha256>] [--json]`,
      '',
      'Reports artifact-root compatibility policy and migration plans. Migration execution is fixture-only in this phase, copy-only, conflict-skipping, receipt-backed, and does not delete legacy artifacts.'
    ].join('\n');
  }

  if (
    topic === 'agentic'
    || topic === 'agentic review'
    || topic === 'agentic review plan'
    || topic === 'agentic review run'
    || topic === 'agentic review status'
    || topic === 'agentic review list'
  ) {
    return [
      `Usage: ${CLI_NAME} agentic review plan --review-index <review-artifact-index> [--intent <text>|--input <text|@file|->] [--effort quick|standard|deep|xhigh] [--json]`,
      `       ${CLI_NAME} agentic review run --plan <plan> --plan-hash <sha256> [--allow-raw-pixels] [--allow-page-text] --execute [--json]`,
      `       ${CLI_NAME} agentic review status --execution <agentic-human-review-execution> [--json]`,
      `       ${CLI_NAME} agentic review list [--json]`,
      '',
      'Plans and runs CLI-only agentic human review. Planning explains the human-review scope, sub-agent roles, transfer flags, and exact approved run command without provider execution. Running requires a matching plan hash, explicit --execute, and exact transfer flags, writes advisory-only output, and remains excluded from MCP execution.'
    ].join('\n');
  }

  if (
    topic === 'visual'
    || topic === 'visual review'
    || topic === 'visual review prepare'
    || topic === 'visual review run'
    || topic === 'visual review status'
    || topic === 'visual review list'
    || topic === 'visual review dashboard'
    || topic === 'visual review aggregate'
  ) {
    return [
      `Usage: ${CLI_NAME} visual review plan --capture-handoff <workspace-json|-> [--surface <id>] [--provider <id>] [--model <id>] [--json]`,
      `       ${CLI_NAME} visual review prepare --review-index <review-artifact-index> [--surface <id>] [--provider <id>] [--model <id>] [--json]`,
      `       ${CLI_NAME} visual review run --preparation <preparation> --surface <id> --provider <id> --model <id> --execute [--json]`,
      `       ${CLI_NAME} visual review status --execution <visual-review-execution> [--json]`,
      `       ${CLI_NAME} visual review list [--json]`,
      `       ${CLI_NAME} visual review dashboard [--limit <n>] [--json]`,
      `       ${CLI_NAME} visual review aggregate --preparation <preparation> [--limit <n>] [--json]`,
      '',
      'Plans desktop review provider preparation from capture handoff metadata, creates metadata-only preparation artifacts, runs explicit CLI visual review provider adapters against preparation metadata and local references, aggregates existing local visual review results, and reports read-only dashboard status. It does not read or transfer raw pixels, mutate existing reviews, or expose MCP execution.'
    ].join('\n');
  }

  if (
    topic === 'agent'
    || topic === 'agent requests'
    || topic === 'agent requests list'
    || topic === 'agent requests show'
    || topic === 'agent workflow'
    || topic === 'agent workflow create'
    || topic === 'agent workflow status'
    || topic === 'agent workflow index'
    || topic === 'agent workflow report'
    || topic === 'agent execution'
    || topic === 'agent execution plan'
    || topic === 'agent execution run'
    || topic === 'agent execution status'
    || topic === 'agent execution list'
  ) {
    return [
      `Usage: ${CLI_NAME} agent surfaces list [--json]`,
      `       ${CLI_NAME} agent package --review-index <review-artifact-index> [--surface <id>] [--json]`,
      `       ${CLI_NAME} agent requests list [--package <agent-package>] [--json]`,
      `       ${CLI_NAME} agent requests show --package <agent-package> [--agent-result <agent-result>] [--json]`,
      `       ${CLI_NAME} agent workflow create --package <agent-package> [--name <name>] [--json]`,
      `       ${CLI_NAME} agent workflow status --workflow <agent-workflow> [--json]`,
      `       ${CLI_NAME} agent workflow index [--json]`,
      `       ${CLI_NAME} agent workflow report --workflow <agent-workflow> [--json]`,
      `       ${CLI_NAME} agent execution plan --package <agent-package> --surface <id> [--provider <id>] [--model <id>] [--idempotency-key <key>] [--json]`,
      `       ${CLI_NAME} agent execution run --execution <agent-execution> --package <agent-package> --surface <id> --provider <id> --model <id> --execute [--idempotency-key <key>] [--json]`,
      `       ${CLI_NAME} agent execution status --execution <agent-execution> [--json]`,
      `       ${CLI_NAME} agent execution list [--json]`,
      `       ${CLI_NAME} agent ingest --package <agent-package> --input <agent-result-json> [--json]`,
      `       ${CLI_NAME} agent report --review-index <review-artifact-index> --agent-result <agent-result> [--json]`,
      '',
      'Agent commands create local advisory handoff artifacts, show local request and workflow status, and import untrusted advisory JSON without provider API calls.'
    ].join('\n');
  }

  if (topic === 'review') {
    return [
      `Usage: ${CLI_NAME} review (--url <url> | --target <manifest> | --image <path> | --input -) [--json]`,
      '',
      'Options:',
      '  --url <url>              Absolute http, https, or file URL to review.',
      '  --target <manifest>      Target manifest path, @file, or inline JSON.',
      '  --image <path>           Workspace-relative image file to review without launching a browser.',
      '  --capture-handoff <json> Verify caller-declared screen/window/desktop-app provenance for --image.',
      '  --source <id>            Caller-declared image source for --image: image, screen, window, or desktop-app.',
      '  --input -                Read a target manifest JSON from stdin when provided by the caller.',
      '  --viewport <name|WxH>    Viewport profile or explicit size. Default: laptop.',
      `  --artifact-root <path>   Local artifact root. Default: ${DEFAULT_ARTIFACT_ROOT}`,
      '  --screenshot             Capture screenshot evidence.',
      '  --trace                  Record resource pressure warning when trace capture is requested.',
      '  --resource-guard <mode>  advisory, fail-critical, or off. Default: advisory.',
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

  if (topic === 'operation' || topic === 'operation registry' || topic === 'operation roadmap' || topic === 'operation contracts' || topic === 'operation policy' || topic === 'operation admin-readiness' || topic === 'operation provider-readiness') {
    return [
      `Usage: ${CLI_NAME} operation registry [--operation <id>|all] [--group <id>|all] [--risk <id>|all] [--json]`,
      `       ${CLI_NAME} operation roadmap [--phase <n>|all] [--group <id>|all] [--risk <id>|all] [--json]`,
      `       ${CLI_NAME} operation contracts [--scope <id>|all] [--operation <id>|all] [--json]`,
      `       ${CLI_NAME} operation policy [--scope <id>|all] [--operation <id>|all] [--json]`,
      `       ${CLI_NAME} operation admin-readiness [--scope <id>|all] [--operation <id>|all] [--json]`,
      `       ${CLI_NAME} operation provider-readiness [--scope <id>|all] [--operation <id>|all] [--json]`,
      `       ${CLI_NAME} release readiness [--json]`,
      `       ${CLI_NAME} artifact-root status [--json]`,
      `       ${CLI_NAME} identity aliases [--json]`,
      `       ${CLI_NAME} shell readiness [--json]`,
      `       ${CLI_NAME} final readiness [--json]`,
      '',
      'Reports read-only operation registry, roadmap, and shared contracts without writing artifacts, executing providers, deleting files, capturing pixels, publishing packages, changing aliases, promoting draft plans, issuing tokens, writing receipts, or exposing MCP write/execute tools.'
    ].join('\n');
  }

  if (topic === 'capture') {
    return [
      `Usage: ${CLI_NAME} capture readiness [--source screen|window|desktop-app|all] [--json]`,
      `       ${CLI_NAME} capture status [--source screen|window|desktop-app|all] [--json]`,
      `       ${CLI_NAME} capture plan [--source screen|window|desktop-app|all] [--json]`,
      `       ${CLI_NAME} capture run --source screen|window|desktop-app --execute [--json]`,
      `       ${CLI_NAME} capture handoff --image <workspace-image> --source screen|window|desktop-app [--json]`
    ].join('\n');
  }

  if (topic === 'settings' || topic === 'settings language' || topic === 'settings language policy' || topic === 'settings locale resources' || topic === 'settings report templates') {
    return [
      `Usage: ${CLI_NAME} settings show [--json]`,
      `       ${CLI_NAME} settings language [--json]`,
      `       ${CLI_NAME} settings language policy [--json]`,
      `       ${CLI_NAME} settings locale resources [--locale <code>] [--json]`,
      `       ${CLI_NAME} settings report templates [--locale <code>] [--json]`,
      '',
      'Reports local dashboard display locale, artifact output language settings, UI locale resources, and report templates without writing files, launching browsers, calling providers, translating raw evidence, or changing gates.'
    ].join('\n');
  }

  if (topic === 'translation' || topic === 'translation readiness' || topic === 'translation dry-run' || topic === 'translation run') {
    return [
      `Usage: ${CLI_NAME} translation readiness [--locale <code>] [--json]`,
      `       ${CLI_NAME} translation dry-run [--locale <code>] [--provider fake] [--json]`,
      `       ${CLI_NAME} translation run --provider <id> --execute [--locale <code>] [--json]`,
      '',
      'Reports translation readiness and deterministic fake dry-run output for generated UI/report chrome only. Provider execution remains approval-bound and fails closed.'
    ].join('\n');
  }

  if (topic === 'mcp') {
    return [
      `Usage: ${CLI_NAME} mcp serve [--profile safe|full|admin] [--json]`,
      `       ${CLI_NAME} mcp config [--client generic|codex] [--profile safe|full|admin] [--json]`,
      `       ${CLI_NAME} mcp config --transport http --profile safe --host 127.0.0.1 --port <port> [--json]`,
      `       ${CLI_NAME} mcp capabilities [--profile safe|full|admin|all] [--scope all|profiles|excluded] [--json]`,
      `       ${CLI_NAME} mcp execution gates [--operation <id>|all] [--profile safe|full|admin|all] [--json]`,
      `       ${CLI_NAME} operation registry [--operation <id>|all] [--json]`,
      `       ${CLI_NAME} operation roadmap [--phase <n>|all] [--json]`,
      `       ${CLI_NAME} operation contracts [--scope <id>|all] [--operation <id>|all] [--json]`,
      `       ${CLI_NAME} operation policy [--scope <id>|all] [--operation <id>|all] [--json]`,
      `       ${CLI_NAME} operation admin-readiness [--scope <id>|all] [--operation <id>|all] [--json]`,
      `       ${CLI_NAME} operation provider-readiness [--scope <id>|all] [--operation <id>|all] [--json]`
    ].join('\n');
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
    '  resource status --json',
    '  resource artifacts plan --json',
    '  resource artifacts cleanup --dry-run --json',
    '  target init --url <url> --json',
    '  target validate --target <manifest> --json',
    '  session start [--url <url>]',
    '  session close --session <id>',
    '  act --session <id> --action <json>',
    '  report --session <id>',
    '  spec export --session <id>',
    '  review --url <url> --json',
    '  review --target <manifest> --json',
    '  review --image <path> --capture-handoff <path> --json',
    '  agentic review plan --review-index <path> --json',
    '  agentic review run --plan <path> --plan-hash <sha256> --execute --json',
    '  visual review plan --capture-handoff <path> --json',
    '  visual review dashboard --json',
    '  visual review aggregate --preparation <path> --json',
    '  identity audit --json',
    '  identity aliases --json',
    '  identity aliases removal-readiness --json',
    '  release readiness --json',
    '  artifact-root status --json',
    '  artifact-root migration plan --json',
    '  shell readiness --json',
    '  shell plan --json',
    '  final readiness --json',
    '  capture readiness --json',
    '  capture plan --json',
    '  capture handoff --image <path> --json',
    '  settings show --json',
    '  settings language --json',
    '  settings language policy --json',
    '  settings locale resources --json',
    '  settings report templates --json',
    '  translation readiness --json',
    '  translation dry-run --locale ja --json',
    '  schema list --json',
    '  schema get --name <schema> --json',
    '  mcp serve --profile safe --json',
    '  mcp config --profile safe --json',
    '  mcp capabilities --json',
    '  mcp execution gates --json',
    '  operation registry --json',
    '  operation roadmap --json',
    '  operation contracts --json',
    '  operation policy --json',
    '  operation admin-readiness --json',
    '  operation provider-readiness --json',
    '',
    'Global options:',
    '  --json',
    '  --help, -h',
    '  --version, -V'
  ].join('\n');
}

function mcpServeInfo(options = {}) {
  const info = mcpServerInfo(normalizeMcpServeOptions(options));
  if (!info.ok) {
    return {
      status: 'error',
      data: {
        adapter: {
          transport: options.transport ?? 'stdio',
          local_only: true,
          external_channel: false,
          shell_tools: false,
          cleanup_tools: false,
          executable: PRODUCT_IDENTITY.mcpBinName
        }
      },
      warnings: [],
      errors: [{ code: info.code ?? 'INVALID_MCP_TRANSPORT', message: info.message, details: { profile: options.profile, transport: options.transport } }],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: {
      adapter: {
        ...info.metadata,
        external_channel: false,
        shell_tools: false,
        cleanup_tools: false,
        executable: PRODUCT_IDENTITY.mcpBinName,
        profile: mcpProfileMetadata(info.metadata.profile)
      }
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

function normalizeMcpServeOptions(options = {}) {
  return {
    transport: options.transport,
    profile: options.profile,
    host: options.host,
    port: options.port,
    endpoint: options.endpoint,
    tokenEnv: options['token-env'] ?? options.tokenEnv,
    bodyLimit: options['body-limit'] ?? options.bodyLimit
  };
}

function mcpConfigInfo(options = {}, env = {}) {
  const info = buildMcpClientConfig(normalizeMcpConfigOptions(options), env);
  if (!info.ok) {
    return {
      status: 'error',
      data: {
        config: {
          transport: options.transport ?? 'stdio',
          client: options.client ?? 'generic',
          token_values_emitted: false,
          server_started: false,
          config_file_written: false
        }
      },
      warnings: [],
      errors: [{ code: info.code ?? 'INVALID_MCP_CONFIG', message: info.message, details: { profile: options.profile, transport: options.transport, client: options.client } }],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: {
      config: info.config
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

function normalizeMcpConfigOptions(options = {}) {
  return {
    transport: options.transport,
    profile: options.profile,
    host: options.host,
    port: options.port,
    endpoint: options.endpoint,
    tokenEnv: options['token-env'] ?? options.tokenEnv,
    bodyLimit: options['body-limit'] ?? options.bodyLimit,
    client: options.client
  };
}

function mcpCapabilitiesInfo(options = {}) {
  const report = buildMcpCapabilityReport({
    profile: options.profile,
    scope: options.scope
  });
  if (!report.ok) {
    return {
      status: 'error',
      data: {
        capabilities: {
          server_started: false,
          config_file_written: false,
          write_execute_tools_exposed: false
        }
      },
      warnings: [],
      errors: [{ code: report.code ?? 'INVALID_MCP_CAPABILITIES', message: report.message, details: { profile: options.profile, scope: options.scope } }],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: {
      capabilities: report.report
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

function mcpExecutionGatesInfo(options = {}, context = {}) {
  const report = buildMcpExecutionGateReport({
    operation: options.operation,
    profile: options.profile
  }, context);
  if (!report.ok) {
    return {
      status: 'error',
      data: {
        execution_gates: {
          write_execute_tools_exposed: false,
          mcp_permissions_changed: false
        }
      },
      warnings: [],
      errors: [{ code: report.code ?? 'INVALID_MCP_EXECUTION_GATES', message: report.message, details: { operation: options.operation, profile: options.profile } }],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: {
      execution_gates: report.report,
      boundary: report.report.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

function operationRegistryInfo(options = {}, context = {}) {
  const report = buildOperationRegistryReport({
    operation: options.operation,
    group: options.group,
    risk: options.risk
  }, context);
  if (!report.ok) {
    return {
      status: 'error',
      data: {
        operation_registry: null,
        boundary: null
      },
      warnings: [],
      errors: [{ code: report.code ?? 'INVALID_OPERATION_REGISTRY', message: report.message, details: { operation: options.operation, group: options.group, risk: options.risk } }],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: {
      operation_registry: report.report,
      boundary: report.report.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

function operationRoadmapInfo(options = {}, context = {}) {
  const unsupported = Object.keys(options).filter((key) => !['phase', 'group', 'risk'].includes(key));
  if (unsupported.length > 0) {
    return {
      status: 'error',
      data: {
        operation_roadmap: null,
        boundary: null
      },
      warnings: [],
      errors: [{
        code: unsupported.includes('execute') ? 'CONFLICTING_OPTIONS' : 'UNSUPPORTED_OPERATION_ROADMAP_OPTION',
        message: `operation roadmap does not accept option: ${unsupported[0]}`,
        details: { unsupported_options: unsupported }
      }],
      artifacts: []
    };
  }
  const report = buildOperationRoadmapReport({
    phase: options.phase,
    group: options.group,
    risk: options.risk
  }, context);
  if (!report.ok) {
    return {
      status: 'error',
      data: {
        operation_roadmap: null,
        boundary: null
      },
      warnings: [],
      errors: [{ code: report.code ?? 'INVALID_OPERATION_ROADMAP', message: report.message, details: { phase: options.phase, group: options.group, risk: options.risk } }],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: {
      operation_roadmap: report.report,
      boundary: report.report.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

function operationContractsInfo(options = {}, context = {}) {
  const unsupported = Object.keys(options).filter((key) => !['scope', 'operation'].includes(key));
  if (unsupported.length > 0) {
    return {
      status: 'error',
      data: {
        operation_contracts: null,
        boundary: null
      },
      warnings: [],
      errors: [{
        code: unsupported.includes('execute') ? 'CONFLICTING_OPTIONS' : 'UNSUPPORTED_OPERATION_CONTRACTS_OPTION',
        message: `operation contracts does not accept option: ${unsupported[0]}`,
        details: { unsupported_options: unsupported }
      }],
      artifacts: []
    };
  }
  const report = buildOperationContractsReport({
    scope: options.scope,
    operation: options.operation
  }, context);
  if (!report.ok) {
    return {
      status: 'error',
      data: {
        operation_contracts: null,
        boundary: null
      },
      warnings: [],
      errors: [{ code: report.code ?? 'INVALID_OPERATION_CONTRACTS', message: report.message, details: { scope: options.scope, operation: options.operation } }],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: {
      operation_contracts: report.report,
      boundary: report.report.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

function operationPolicyInfo(options = {}, context = {}) {
  const unsupported = Object.keys(options).filter((key) => !['scope', 'operation'].includes(key));
  if (unsupported.length > 0) {
    return {
      status: 'error',
      data: {
        operation_policy: null,
        boundary: null
      },
      warnings: [],
      errors: [{
        code: unsupported.includes('execute') ? 'CONFLICTING_OPTIONS' : 'UNSUPPORTED_OPERATION_POLICY_OPTION',
        message: `operation policy does not accept option: ${unsupported[0]}`,
        details: { unsupported_options: unsupported }
      }],
      artifacts: []
    };
  }
  const report = buildOperationPolicyReport({
    scope: options.scope,
    operation: options.operation
  }, context);
  if (!report.ok) {
    return {
      status: 'error',
      data: {
        operation_policy: null,
        boundary: null
      },
      warnings: [],
      errors: [{ code: report.code ?? 'INVALID_OPERATION_POLICY', message: report.message, details: { scope: options.scope, operation: options.operation } }],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: {
      operation_policy: report.report,
      boundary: report.report.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

function operationAdminReadinessInfo(options = {}, context = {}) {
  const unsupported = Object.keys(options).filter((key) => !['scope', 'operation'].includes(key));
  if (unsupported.length > 0) {
    return {
      status: 'error',
      data: {
        operation_admin_readiness: null,
        boundary: null
      },
      warnings: [],
      errors: [{
        code: unsupported.includes('execute') ? 'CONFLICTING_OPTIONS' : 'UNSUPPORTED_OPERATION_ADMIN_READINESS_OPTION',
        message: `operation admin-readiness does not accept option: ${unsupported[0]}`,
        details: { unsupported_options: unsupported }
      }],
      artifacts: []
    };
  }
  const report = buildOperationAdminReadinessReport({
    scope: options.scope,
    operation: options.operation
  }, context);
  if (!report.ok) {
    return {
      status: 'error',
      data: {
        operation_admin_readiness: null,
        boundary: null
      },
      warnings: [],
      errors: [{ code: report.code ?? 'INVALID_OPERATION_ADMIN_READINESS', message: report.message, details: { scope: options.scope, operation: options.operation } }],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: {
      operation_admin_readiness: report.report,
      boundary: report.report.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

function operationProviderReadinessInfo(options = {}, context = {}) {
  const unsupported = Object.keys(options).filter((key) => !['scope', 'operation'].includes(key));
  if (unsupported.length > 0) {
    return {
      status: 'error',
      data: {
        operation_provider_readiness: null,
        boundary: null
      },
      warnings: [],
      errors: [{
        code: unsupported.includes('execute') ? 'CONFLICTING_OPTIONS' : 'UNSUPPORTED_OPERATION_PROVIDER_READINESS_OPTION',
        message: `operation provider-readiness does not accept option: ${unsupported[0]}`,
        details: { unsupported_options: unsupported }
      }],
      artifacts: []
    };
  }
  const report = buildOperationProviderReadinessReport({
    scope: options.scope,
    operation: options.operation
  }, context);
  if (!report.ok) {
    return {
      status: 'error',
      data: {
        operation_provider_readiness: null,
        boundary: null
      },
      warnings: [],
      errors: [{ code: report.code ?? 'INVALID_OPERATION_PROVIDER_READINESS', message: report.message, details: { scope: options.scope, operation: options.operation } }],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: {
      operation_provider_readiness: report.report,
      boundary: report.report.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

function capturePlanInfo(options = {}, context = {}) {
  const result = buildCapturePlan(options, context);
  if (!result.ok) {
    return {
      status: 'error',
      data: {
        capture_plan: null,
        boundary: null
      },
      warnings: [],
      errors: [{ code: result.code, message: result.message }],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: {
      capture_plan: result.report,
      boundary: result.report.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

function captureReadinessInfo(options = {}, context = {}) {
  const result = buildCaptureReadiness(options, context);
  if (!result.ok) {
    return {
      status: 'error',
      data: {
        capture_readiness: null,
        boundary: null
      },
      warnings: [],
      errors: [{ code: result.code, message: result.message }],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: {
      capture_readiness: result.report,
      boundary: result.report.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

function captureRunUnavailableInfo(options = {}, context = {}) {
  const readiness = buildCaptureReadiness({ source: options.source }, context);
  const boundary = readiness.ok ? readiness.report.boundary : null;
  return {
    status: 'error',
    data: {
      capture_execution: {
        status: 'not_available',
        source: options.source ?? null,
        execute_requested: Boolean(options.execute),
        approval_required: true,
        readiness: readiness.ok ? readiness.report : null
      },
      boundary
    },
    warnings: [],
    errors: [{
      code: readiness.ok ? 'CAPTURE_EXECUTION_NOT_AVAILABLE' : readiness.code,
      message: readiness.ok
        ? 'Capture execution is approval-bound and is not implemented in this no-capture phase.'
        : readiness.message,
      details: readiness.ok
        ? {
            capture_performed: false,
            os_capture_api_used: false,
            native_capture_dependency_loaded: false,
            mcp_execution_exposed: false
          }
        : {}
    }],
    artifacts: []
  };
}

function translationRunUnavailableInfo(options = {}) {
  return {
    status: 'error',
    data: {
      translation_execution: {
        status: 'not_available',
        provider: options.provider ?? null,
        locale: options.locale ?? null,
        execute_requested: Boolean(options.execute),
        approval_required: true
      },
      boundary: translationBoundary({ dryRun: false })
    },
    warnings: [],
    errors: [{
      code: 'TRANSLATION_EXECUTION_NOT_AVAILABLE',
      message: 'Translation provider execution is approval-bound and is not implemented in this provider-free phase.',
      details: {
        translation_execution_performed: false,
        provider_call_performed: false,
        credential_values_read: false,
        raw_evidence_translated: false,
        mcp_write_execute_exposed: false
      }
    }],
    artifacts: []
  };
}
