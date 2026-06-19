import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  artifactObject,
  artifactRelPath,
  createArtifactId,
  ensureArtifactRoot,
  resolveArtifactRoot,
  writeJsonArtifact
} from './artifacts.js';
import { AGENT_SURFACES } from './agent.js';
import {
  executeAgentExecutionProvider,
  resolveAgentExecutionProvider
} from './agent-execution-providers.js';
import { DEFAULT_ARTIFACT_ROOT, SCHEMA_VERSION } from './constants.js';
import { redact } from './redaction.js';

const DEFAULT_LOCAL_PROVIDER = 'local-runner';
const DEFAULT_API_PROVIDER = 'generic-api-provider';
const DEFAULT_LOCAL_MODEL = 'local-agent';
const DEFAULT_API_MODEL = 'generic-model';

export async function runAgentExecutionPlan(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = currentDate(context.now);
  const artifactRootInput = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const root = await ensureArtifactRoot(cwd, artifactRootInput);
  const id = context.createId?.('agent-execution', now) ?? createArtifactId(now, 'agent-execution');
  const packageRead = await readAgentPackage(cwd, options.package);
  if (!packageRead.ok) {
    return errorResult(packageRead.error.code, packageRead.error.message, packageRead.error.details);
  }
  const surface = findSurface(options.surface);
  if (!surface) {
    return errorResult('AGENT_EXECUTION_SURFACE_NOT_FOUND', 'No agent surface matched the requested execution surface.', {
      surface: options.surface,
      available_surfaces: AGENT_SURFACES.map((item) => item.id)
    });
  }

  const provider = normalizeProvider(options.provider, surface);
  const model = normalizeModel(options.model, provider);
  const providerRead = resolveAgentExecutionProvider({ providerId: provider.id, surface, modelId: model.id });
  if (!providerRead.ok) {
    return errorResult(providerRead.error.code, providerRead.error.message, providerRead.error.details);
  }

  const executionRel = artifactRelPath(artifactRootInput, 'agent-executions', id, 'execution.json');
  const receiptRel = artifactRelPath(artifactRootInput, 'receipts', `${id}.json`);
  const execution = buildExecutionRecord({
    id,
    status: 'planned',
    createdAt: now.toISOString(),
    evaluatedAt: now.toISOString(),
    executionPath: executionRel,
    executionReceiptPath: receiptRel,
    agentPackage: packageRead.agentPackage,
    surface,
    provider: providerRead.provider,
    model,
    executeRequested: false
  });
  const receipt = buildExecutionReceipt(execution);

  await writeJsonArtifact(root, ['agent-executions', id, 'execution.json'], execution);
  await writeJsonArtifact(root, ['receipts', `${id}.json`], receipt);

  return {
    status: 'ok',
    data: {
      agent_execution: execution,
      agent_execution_plan: execution,
      boundary: execution.boundary
    },
    warnings: planWarnings(surface),
    errors: [],
    artifacts: [
      artifactObject({
        type: 'agent_execution',
        path: executionRel,
        description: 'Local dry-run agent execution plan.'
      }),
      artifactObject({
        type: 'agent_execution_receipt',
        path: receiptRel,
        description: 'Content-free receipt for the local dry-run execution plan.'
      })
    ]
  };
}

export async function runAgentExecutionRun(options = {}, context = {}) {
  if (!options.execute) {
    return errorResult('AGENT_EXECUTION_REQUIRES_EXECUTE', 'agent execution run requires explicit --execute.', {
      execute_required: true,
      dry_run_command: `browser-debug agent execution plan --package ${options.package ?? '<agent-package>'} --surface ${options.surface ?? '<surface>'} --json`
    });
  }

  if (!options.execution) {
    return errorResult('AGENT_EXECUTION_PLAN_REQUIRED', 'agent execution run requires --execution <agent-execution> from a prior dry-run plan.', {
      execution_required: true,
      dry_run_command: `browser-debug agent execution plan --package ${options.package ?? '<agent-package>'} --surface ${options.surface ?? '<surface>'} --provider ${options.provider ?? '<provider>'} --model ${options.model ?? '<model>'} --json`
    });
  }

  const cwd = context.cwd ?? process.cwd();
  const now = currentDate(context.now);
  const artifactRootInput = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const root = await ensureArtifactRoot(cwd, artifactRootInput);
  const packageRead = await readAgentPackage(cwd, options.package);
  if (!packageRead.ok) {
    return errorResult(packageRead.error.code, packageRead.error.message, packageRead.error.details);
  }

  const surface = findSurface(options.surface);
  if (!surface) {
    return errorResult('AGENT_EXECUTION_SURFACE_NOT_FOUND', 'No agent surface matched the requested execution surface.', {
      surface: options.surface,
      available_surfaces: AGENT_SURFACES.map((item) => item.id)
    });
  }

  const executionRead = await readExecution(cwd, options.execution);
  if (!executionRead.ok) {
    return errorResult(executionRead.error.code, executionRead.error.message, executionRead.error.details);
  }

  const provider = normalizeProvider(options.provider, surface);
  const model = normalizeModel(options.model, provider);
  const providerRead = resolveAgentExecutionProvider({ providerId: provider.id, surface, modelId: model.id });
  if (!providerRead.ok) {
    return errorResult(providerRead.error.code, providerRead.error.message, providerRead.error.details);
  }

  const validation = validateExecutionPlan({
    execution: executionRead.execution,
    executionPath: executionRead.relativePath,
    agentPackage: packageRead.agentPackage,
    surface,
    provider: providerRead.provider,
    model
  });
  if (!validation.ok) {
    return errorResult(validation.error.code, validation.error.message, validation.error.details);
  }

  const promptRead = await readOptionalWorkspaceText(cwd, packageRead.agentPackage.packet.prompt?.path, 'agent prompt');
  const resultId = context.createId?.('agent-result', now) ?? createArtifactId(now, 'agent-result');
  const resultRel = artifactRelPath(artifactRootInput, 'agent-results', `${resultId}.json`);
  const runReceiptRel = artifactRelPath(artifactRootInput, 'receipts', `${executionRead.execution.id}-run.json`);
  const providerResult = await executeAgentExecutionProvider({
    provider: providerRead.provider,
    model,
    surface,
    agentPackage: packageRead.agentPackage,
    packagePath: packageRead.agentPackage.package_path,
    promptText: promptRead.text,
    execution: executionRead.execution,
    resultId,
    now,
    context
  });

  const execution = buildExecutionRunRecord({
    plan: executionRead.execution,
    now,
    status: providerResult.status,
    provider: providerRead.provider,
    model,
    providerResult,
    resultPath: providerResult.ok ? resultRel : null,
    runReceiptPath: runReceiptRel
  });
  const receipt = buildExecutionReceipt(execution, {
    type: 'agent_execution_run_receipt',
    resultPath: providerResult.ok ? resultRel : null,
    providerResult
  });

  if (providerResult.ok) {
    await writeJsonArtifact(root, ['agent-results', `${resultId}.json`], providerResult.agent_result);
  }
  await writeJsonArtifact(root, ['agent-executions', execution.id, 'execution.json'], execution);
  await writeJsonArtifact(root, ['receipts', `${execution.id}-run.json`], receipt);

  const artifacts = [
    artifactObject({
      type: 'agent_execution',
      path: execution.execution_path,
      description: 'Local agent execution status record.'
    }),
    artifactObject({
      type: 'agent_execution_receipt',
      path: runReceiptRel,
      description: 'Content-free receipt for the local agent execution run.'
    })
  ];
  if (providerResult.ok) {
    artifacts.unshift(artifactObject({
      type: 'agent_advisory_result',
      path: resultRel,
      description: 'Normalized untrusted agent advisory result from agent execution.'
    }));
  }

  if (!providerResult.ok) {
    return {
      status: 'error',
      data: {
        agent_execution: execution,
        agent_execution_status: execution,
        boundary: execution.boundary
      },
      warnings: providerResult.warnings,
      errors: [providerResult.error],
      artifacts
    };
  }

  return {
    status: 'ok',
    data: {
      agent_execution: execution,
      agent_execution_status: execution,
      agent_advisory_result: {
        id: resultId,
        path: resultRel,
        status: providerResult.agent_result.agent_advisory?.status ?? 'passed',
        gate_effect: 'none',
        untrusted_model_output: true
      },
      boundary: execution.boundary
    },
    warnings: [...promptRead.warnings, ...providerResult.warnings],
    errors: [],
    artifacts
  };
}

export async function runAgentExecutionStatus(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const executionRead = await readExecution(cwd, options.execution);
  if (!executionRead.ok) {
    return errorResult(executionRead.error.code, executionRead.error.message, executionRead.error.details);
  }
  return {
    status: 'ok',
    data: {
      agent_execution: executionRead.execution,
      agent_execution_status: executionRead.execution,
      boundary: executionRead.execution.boundary ?? executionBoundary()
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

export async function runAgentExecutionList(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const artifactRootInput = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const root = resolveArtifactRoot(cwd, artifactRootInput);
  const executions = [];
  const warnings = [];

  try {
    const entries = await readdir(path.join(root, 'agent-executions'), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const executionPath = artifactRelPath(artifactRootInput, 'agent-executions', entry.name, 'execution.json');
      const executionRead = await readExecution(cwd, executionPath);
      if (executionRead.ok) {
        executions.push(executionRead.execution);
      } else {
        warnings.push({
          code: 'AGENT_EXECUTION_READ_FAILED',
          message: 'Could not read an agent execution while listing execution status.',
          details: { execution_path: executionPath, reason: executionRead.error.message }
        });
      }
    }
  } catch {
    // Missing execution directory is a valid empty-list state.
  }

  return {
    status: 'ok',
    data: {
      agent_executions: executions,
      summary: summarizeExecutions(executions),
      boundary: executionBoundary()
    },
    warnings,
    errors: [],
    artifacts: []
  };
}

function buildExecutionRecord({
  id,
  status,
  createdAt,
  evaluatedAt,
  executionPath,
  executionReceiptPath,
  agentPackage,
  surface,
  provider,
  model,
  executeRequested
}) {
  const packet = agentPackage.packet;
  const disclosurePolicy = packet.disclosure_policy ?? {};
  return redact({
    schema_version: SCHEMA_VERSION,
    id,
    status,
    mode: 'dry_run_plan',
    created_at: createdAt,
    evaluated_at: evaluatedAt,
    execution_path: executionPath,
    execution_receipt_path: executionReceiptPath,
    package_id: packet.id ?? null,
    package_path: agentPackage.package_path,
    prompt_path: packet.prompt?.path ?? null,
    review_artifact_index_path: packet.source?.review_artifact_index_path ?? null,
    surface: surfaceSummary(surface),
    provider,
    model,
    steps: {
      plan: {
        status: 'completed',
        no_network: true,
        browser_launched: false
      },
      execution: {
        status: executeRequested ? 'blocked' : 'not_requested',
        requires_execute_flag: true,
        provider_adapter_required: provider.implemented !== true
      },
      normalize: {
        status: 'not_started',
        expected_schema: 'agent_advisory_result'
      },
      ingest: {
        status: 'pending',
        command: `browser-debug agent ingest --package ${agentPackage.package_path} --input @agent-advisory-result.json --json`
      },
      report: {
        status: 'pending',
        command: `browser-debug agent report --review-index ${packet.source?.review_artifact_index_path ?? '<review-index>'} --agent-result <agent-result> --json`
      }
    },
    dashboard_handoff: {
      status_command: `browser-debug agent execution status --execution ${executionPath} --json`,
      list_command: 'browser-debug agent execution list --json',
      run_command: `browser-debug agent execution run --execution ${executionPath} --package ${agentPackage.package_path} --surface ${surface.id} --provider ${provider.id} --model ${model.id} --execute --json`,
      agent_result_path: null,
      report_command: null,
      next_safe_action: 'Review the dry-run execution plan, then run the explicit execution command when the provider boundary is configured.'
    },
    disclosure_policy: {
      raw_artifact_content_included: Boolean(disclosurePolicy.raw_artifact_content_included),
      screenshot_binary_included: Boolean(disclosurePolicy.screenshot_binary_included),
      trace_content_included: Boolean(disclosurePolicy.trace_content_included),
      source_data_values_included: Boolean(disclosurePolicy.source_data_values_included),
      local_artifact_paths_included: Boolean(disclosurePolicy.local_artifact_paths_included),
      external_evidence_transfer: false,
      bounded_prompt_disclosure_only: true
    },
    gate_effect: 'none',
    external_evidence_transfer: false,
    api_call_performed: false,
    automatic_upload: false,
    credential_storage: 'none',
    persistent_credential_storage: false,
    credential_values_recorded: false,
    raw_response_stored: false,
    raw_provider_response_stored: false,
    existing_review_mutated: false,
    mcp_execution_exposed: false,
    provider_adapter: {
      id: provider.id,
      kind: provider.kind,
      transport: provider.transport,
      implemented: provider.implemented === true,
      credential_mode: provider.credential_mode,
      endpoint_env: provider.endpoint_env ?? null,
      credential_env: provider.credential_env ?? null,
      api_call_performed: false,
      external_evidence_transfer: false,
      credential_values_recorded: false,
      raw_provider_response_stored: false
    },
    normalized_agent_result_path: null,
    dashboard_status: executionDashboardStatus({
      status,
      resultPath: null,
      provider,
      apiCallPerformed: false,
      externalEvidenceTransfer: false
    }),
    boundary: executionBoundary({ provider_adapter_implemented: provider.implemented === true })
  });
}

function buildExecutionRunRecord({ plan, now, status, provider, model, providerResult, resultPath, runReceiptPath }) {
  const boundary = executionBoundary({
    ...providerResult.boundary,
    provider_adapter_implemented: provider.implemented === true
  });
  const completed = status === 'completed';
  const failedOrBlocked = status === 'failed' || status === 'blocked';
  return redact({
    ...plan,
    status,
    mode: 'provider_run',
    updated_at: now.toISOString(),
    evaluated_at: now.toISOString(),
    completed_at: completed ? now.toISOString() : null,
    provider,
    model,
    provider_adapter: providerResult.provider_adapter,
    execution_run_receipt_path: runReceiptPath,
    normalized_agent_result_path: resultPath,
    latest_result_path: resultPath,
    agent_result_path: resultPath,
    steps: {
      ...(plan.steps ?? {}),
      execution: {
        status,
        requires_execute_flag: true,
        provider_adapter_required: false,
        provider_id: provider.id,
        model_id: model.id,
        api_call_performed: boundary.api_call_performed,
        external_evidence_transfer: boundary.external_evidence_transfer,
        raw_provider_response_stored: false
      },
      normalize: {
        status: completed ? 'completed' : failedOrBlocked ? 'blocked' : 'not_started',
        expected_schema: 'agent_advisory_result',
        result_path: resultPath,
        raw_provider_response_stored: false
      },
      ingest: {
        status: completed ? 'completed_by_execution' : 'pending',
        latest_result_path: resultPath,
        command: completed ? null : plan.steps?.ingest?.command ?? null
      },
      report: {
        status: completed ? 'pending' : 'blocked_waiting_for_execution',
        command: completed
          ? `browser-debug agent report --review-index ${plan.review_artifact_index_path ?? '<review-index>'} --agent-result ${resultPath} --json`
          : plan.steps?.report?.command ?? null
      }
    },
    dashboard_handoff: {
      ...(plan.dashboard_handoff ?? {}),
      status_label: status,
      agent_result_path: resultPath,
      report_command: completed
        ? `browser-debug agent report --review-index ${plan.review_artifact_index_path ?? '<review-index>'} --agent-result ${resultPath} --json`
        : null,
      next_safe_action: completed
        ? 'Review the normalized advisory result, then run the advisory report command when useful.'
        : 'Inspect the execution error and rerun from a dry-run plan after the provider boundary is configured.'
    },
    dashboard_status: executionDashboardStatus({
      status,
      resultPath,
      provider,
      apiCallPerformed: boundary.api_call_performed,
      externalEvidenceTransfer: boundary.external_evidence_transfer
    }),
    gate_effect: 'none',
    external_evidence_transfer: boundary.external_evidence_transfer,
    api_call_performed: boundary.api_call_performed,
    automatic_upload: false,
    credential_storage: 'none',
    persistent_credential_storage: false,
    credential_values_recorded: false,
    raw_response_stored: false,
    raw_provider_response_stored: false,
    existing_review_mutated: false,
    mcp_execution_exposed: false,
    boundary
  });
}

function buildExecutionReceipt(execution, overrides = {}) {
  const providerResult = overrides.providerResult ?? {};
  return redact({
    schema_version: SCHEMA_VERSION,
    type: overrides.type ?? 'agent_execution_receipt',
    id: execution.id,
    created_at: execution.updated_at ?? execution.created_at,
    status: execution.status,
    execution_path: execution.execution_path,
    package_path: execution.package_path,
    surface_id: execution.surface?.id ?? null,
    provider_id: execution.provider?.id ?? null,
    model_id: execution.model?.id ?? null,
    result_path: overrides.resultPath ?? execution.normalized_agent_result_path ?? null,
    api_call_performed: Boolean(execution.api_call_performed),
    external_evidence_transfer: Boolean(execution.external_evidence_transfer),
    automatic_upload: false,
    credential_storage: 'none',
    persistent_credential_storage: false,
    credential_values_recorded: false,
    raw_response_stored: false,
    raw_provider_response_stored: false,
    existing_review_mutated: false,
    mcp_execution_exposed: false,
    provider_error_code: providerResult.error?.code ?? null
  });
}

function surfaceSummary(surface) {
  return {
    id: surface.id,
    kind: surface.kind,
    transport: surface.transport,
    status: surface.status,
    implemented: surface.implemented,
    external_evidence_transfer: surface.external_evidence_transfer,
    credential_mode: surface.credential_mode
  };
}

function normalizeProvider(provider, surface) {
  const id = provider ?? (surface.kind === 'api_provider' ? DEFAULT_API_PROVIDER : DEFAULT_LOCAL_PROVIDER);
  return {
    id,
    kind: id === DEFAULT_API_PROVIDER ? 'api_provider' : 'local_runner',
    implemented: false,
    api_call_performed: false,
    credential_mode: id === DEFAULT_API_PROVIDER ? 'environment_variable_only' : 'none'
  };
}

function normalizeModel(model, provider) {
  const defaultModel = provider.id === DEFAULT_API_PROVIDER
    ? DEFAULT_API_MODEL
    : provider.id === 'fake-agent'
      ? 'fake-model'
      : DEFAULT_LOCAL_MODEL;
  return {
    id: model ?? defaultModel,
    selected: Boolean(model),
    raw_provider_response_stored: false
  };
}

function findSurface(id) {
  return AGENT_SURFACES.find((surface) => surface.id === id) ?? null;
}

function planWarnings(surface) {
  if (surface.kind !== 'api_provider') {
    return [];
  }
  return [{
    code: 'AGENT_EXECUTION_EXTERNAL_PROVIDER_APPROVAL_REQUIRED',
    message: 'The selected surface represents an API provider boundary. Planning is local only; execution requires explicit --execute, env-only configuration, and bounded disclosure.',
    details: {
      surface: surface.id,
      api_call_performed: false,
      external_evidence_transfer: false
    }
  }];
}

async function readAgentPackage(cwd, packagePath) {
  const input = await readWorkspaceJson(cwd, packagePath, 'agent execution package');
  if (!input.ok) {
    return input;
  }
  return {
    ok: true,
    agentPackage: {
      package_path: normalizeRelPath(packagePath),
      packet: input.value
    }
  };
}

async function readExecution(cwd, executionPath) {
  const input = await readWorkspaceJson(cwd, executionPath, 'agent execution');
  if (!input.ok) {
    return input;
  }
  return {
    ok: true,
    execution: input.value,
    relativePath: normalizeRelPath(executionPath)
  };
}

async function readOptionalWorkspaceText(cwd, relativePath, label) {
  if (!relativePath) {
    return { text: '', warnings: [] };
  }
  if (path.isAbsolute(relativePath)) {
    return {
      text: '',
      warnings: [{
        code: 'AGENT_EXECUTION_PROMPT_PATH_OUTSIDE_WORKSPACE',
        message: `The ${label} path must be relative to the workspace.`,
        details: { path: relativePath }
      }]
    };
  }
  const absolute = path.resolve(cwd, relativePath);
  const root = path.resolve(cwd);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    return {
      text: '',
      warnings: [{
        code: 'AGENT_EXECUTION_PROMPT_PATH_OUTSIDE_WORKSPACE',
        message: `The ${label} path must stay inside the workspace.`,
        details: { path: relativePath }
      }]
    };
  }
  try {
    return { text: await readFile(absolute, 'utf8'), warnings: [] };
  } catch (error) {
    return {
      text: '',
      warnings: [{
        code: 'AGENT_EXECUTION_PROMPT_READ_FAILED',
        message: `Could not read the ${label}; execution will continue with package metadata only.`,
        details: { path: relativePath, reason: error.message }
      }]
    };
  }
}

async function readWorkspaceJson(cwd, relativePath, label) {
  if (!relativePath) {
    return {
      ok: false,
      error: {
        code: 'AGENT_EXECUTION_MISSING_PATH',
        message: `A ${label} path is required.`,
        details: {}
      }
    };
  }
  if (path.isAbsolute(relativePath)) {
    return {
      ok: false,
      error: {
        code: 'AGENT_EXECUTION_PATH_OUTSIDE_WORKSPACE',
        message: `The ${label} path must be relative to the workspace.`,
        details: { path: relativePath }
      }
    };
  }
  const absolute = path.resolve(cwd, relativePath);
  const root = path.resolve(cwd);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    return {
      ok: false,
      error: {
        code: 'AGENT_EXECUTION_PATH_OUTSIDE_WORKSPACE',
        message: `The ${label} path must stay inside the workspace.`,
        details: { path: relativePath }
      }
    };
  }
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(absolute, 'utf8'))
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'AGENT_EXECUTION_READ_FAILED',
        message: `Could not read the ${label} JSON.`,
        details: { path: relativePath, reason: error.message }
      }
    };
  }
}

function summarizeExecutions(executions) {
  const summary = {
    total: executions.length,
    planned: 0,
    running: 0,
    completed: 0,
    failed: 0,
    blocked: 0,
    advisory_results: 0,
    api_call_performed: false,
    external_evidence_transfer: false,
    automatic_upload: false,
    credential_values_recorded: false,
    raw_provider_response_stored: false,
    existing_review_mutated: false,
    mcp_execution_exposed: false
  };
  for (const execution of executions) {
    if (Object.hasOwn(summary, execution.status)) {
      summary[execution.status] += 1;
    }
    if (execution.normalized_agent_result_path || execution.agent_result_path) {
      summary.advisory_results += 1;
    }
    summary.api_call_performed = summary.api_call_performed || Boolean(execution.api_call_performed);
    summary.external_evidence_transfer = summary.external_evidence_transfer || Boolean(execution.external_evidence_transfer);
    summary.automatic_upload = summary.automatic_upload || Boolean(execution.automatic_upload);
    summary.credential_values_recorded = summary.credential_values_recorded || Boolean(execution.credential_values_recorded);
    summary.raw_provider_response_stored = summary.raw_provider_response_stored || Boolean(execution.raw_provider_response_stored);
    summary.existing_review_mutated = summary.existing_review_mutated || Boolean(execution.existing_review_mutated);
    summary.mcp_execution_exposed = summary.mcp_execution_exposed || Boolean(execution.mcp_execution_exposed);
  }
  return summary;
}

function validateExecutionPlan({ execution, executionPath, agentPackage, surface, provider, model }) {
  if (execution.status !== 'planned') {
    return {
      ok: false,
      error: {
        code: 'AGENT_EXECUTION_PLAN_NOT_RUNNABLE',
        message: 'agent execution run requires an execution plan with status planned.',
        details: { execution: executionPath, status: execution.status }
      }
    };
  }
  const expected = {
    package_path: agentPackage.package_path,
    surface_id: surface.id,
    provider_id: provider.id,
    model_id: model.id
  };
  const actual = {
    package_path: execution.package_path,
    surface_id: execution.surface?.id,
    provider_id: execution.provider?.id,
    model_id: execution.model?.id
  };
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      return {
        ok: false,
        error: {
          code: 'AGENT_EXECUTION_PLAN_MISMATCH',
          message: 'The execution plan does not match the requested package, surface, provider, and model.',
          details: { execution: executionPath, mismatch: key, expected: value, actual: actual[key] ?? null }
        }
      };
    }
  }
  return { ok: true };
}

function executionDashboardStatus({ status, resultPath, provider, apiCallPerformed, externalEvidenceTransfer }) {
  return {
    status_label: status,
    provider_id: provider.id,
    provider_kind: provider.kind,
    agent_result_path: resultPath,
    report_pending: status === 'completed',
    api_call_performed: Boolean(apiCallPerformed),
    external_evidence_transfer: Boolean(externalEvidenceTransfer),
    credential_values_recorded: false,
    raw_provider_response_stored: false,
    existing_review_mutated: false,
    mcp_execution_exposed: false
  };
}

function executionBoundary(overrides = {}) {
  return {
    browser_launched: false,
    api_call_performed: false,
    external_evidence_transfer: false,
    automatic_upload: false,
    credential_storage: 'none',
    persistent_credential_storage: false,
    credential_values_recorded: false,
    raw_response_stored: false,
    raw_provider_response_stored: false,
    existing_review_mutated: false,
    mcp_execution_exposed: false,
    provider_adapter_implemented: false,
    shell_used: false,
    free_form_shell_input_accepted: false,
    ...overrides
  };
}

function normalizeRelPath(value) {
  return value.replace(/\\/g, '/');
}

function currentDate(now) {
  const value = typeof now === 'function' ? now() : now;
  if (value instanceof Date) {
    return value;
  }
  if (value) {
    return new Date(value);
  }
  return new Date();
}

function errorResult(code, message, details = {}) {
  return {
    status: 'error',
    data: {
      boundary: executionBoundary()
    },
    warnings: [],
    errors: [{ code, message, details }],
    artifacts: []
  };
}
