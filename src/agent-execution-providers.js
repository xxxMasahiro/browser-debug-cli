import { SCHEMA_VERSION } from './constants.js';
import { redact, truncateText } from './redaction.js';

export const API_PROVIDER_ENDPOINT_ENV = 'BROWSER_DEBUG_AGENT_API_ENDPOINT';
export const API_PROVIDER_CREDENTIAL_ENV = 'BROWSER_DEBUG_AGENT_API_TOKEN';

const MAX_AGENT_FINDINGS = 50;
const MAX_OWNER_DECISIONS = 25;

const AGENT_FINDING_CATEGORIES = new Set([
  'visual_design',
  'content_information_architecture',
  'user_journey',
  'mock_interpretation',
  'implementation_diagnosis',
  'accessibility_advisory',
  'evidence_quality',
  'other'
]);

const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const CONFIDENCE_VALUES = new Set(['low', 'medium', 'high', 'inconclusive']);

export const AGENT_EXECUTION_PROVIDERS = Object.freeze([
  Object.freeze({
    id: 'fake-agent',
    display_name: 'Deterministic fake agent',
    kind: 'fake_provider',
    transport: 'local_function',
    implemented: true,
    surface_kinds: ['subscription_surface', 'api_provider'],
    model_policy: 'allowlisted',
    models: ['fake-model', 'deterministic-local-review'],
    credential_mode: 'none',
    external_evidence_transfer: false,
    api_call_performed: false,
    raw_provider_response_stored: false
  }),
  Object.freeze({
    id: 'local-runner',
    display_name: 'Configured local runner',
    kind: 'local_runner',
    transport: 'local_callback',
    implemented: true,
    surface_kinds: ['subscription_surface'],
    model_policy: 'configured_runner_id',
    credential_mode: 'none',
    external_evidence_transfer: false,
    api_call_performed: false,
    raw_provider_response_stored: false
  }),
  Object.freeze({
    id: 'generic-api-provider',
    display_name: 'Generic API provider',
    kind: 'api_provider',
    transport: 'provider_api',
    implemented: true,
    surface_kinds: ['api_provider'],
    model_policy: 'provider_model_id',
    credential_mode: 'environment_variable_only',
    endpoint_env: API_PROVIDER_ENDPOINT_ENV,
    credential_env: API_PROVIDER_CREDENTIAL_ENV,
    external_evidence_transfer: true,
    api_call_performed: true,
    raw_provider_response_stored: false
  })
]);

export function resolveAgentExecutionProvider({ providerId, surface, modelId }) {
  const provider = AGENT_EXECUTION_PROVIDERS.find((candidate) => candidate.id === providerId) ?? null;
  if (!provider) {
    return {
      ok: false,
      error: {
        code: 'AGENT_EXECUTION_PROVIDER_UNKNOWN',
        message: 'No agent execution provider matched the requested provider.',
        details: {
          provider: providerId,
          available_providers: AGENT_EXECUTION_PROVIDERS.map((candidate) => candidate.id)
        }
      }
    };
  }
  if (!provider.surface_kinds.includes(surface.kind)) {
    return {
      ok: false,
      error: {
        code: 'AGENT_EXECUTION_PROVIDER_SURFACE_MISMATCH',
        message: 'The requested provider is not compatible with the selected surface.',
        details: {
          provider: provider.id,
          surface: surface.id,
          surface_kind: surface.kind,
          compatible_surface_kinds: provider.surface_kinds
        }
      }
    };
  }
  if (provider.model_policy === 'allowlisted' && !provider.models.includes(modelId)) {
    return {
      ok: false,
      error: {
        code: 'AGENT_EXECUTION_MODEL_UNKNOWN',
        message: 'The requested model is not available for this provider.',
        details: {
          provider: provider.id,
          model: modelId,
          available_models: provider.models
        }
      }
    };
  }
  return { ok: true, provider: providerSummary(provider) };
}

export async function executeAgentExecutionProvider({
  provider,
  model,
  surface,
  agentPackage,
  packagePath,
  promptText,
  execution,
  resultId,
  now,
  context = {}
}) {
  if (provider.id === 'fake-agent') {
    return fakeAgentResult({ provider, model, surface, agentPackage, packagePath, execution, resultId, now });
  }
  if (provider.id === 'local-runner') {
    return configuredLocalRunnerResult({ provider, model, surface, agentPackage, packagePath, promptText, execution, resultId, now, context });
  }
  if (provider.id === 'generic-api-provider') {
    return apiProviderResult({ provider, model, surface, agentPackage, packagePath, promptText, execution, resultId, now, context });
  }
  return providerFailure({
    status: 'blocked',
    code: 'AGENT_EXECUTION_PROVIDER_UNKNOWN',
    message: 'No implemented provider adapter is available for the requested provider.',
    details: { provider: provider.id },
    provider
  });
}

export function providerSummary(provider) {
  return {
    id: provider.id,
    display_name: provider.display_name,
    kind: provider.kind,
    transport: provider.transport,
    implemented: provider.implemented === true,
    credential_mode: provider.credential_mode,
    endpoint_env: provider.endpoint_env ?? null,
    credential_env: provider.credential_env ?? null,
    external_evidence_transfer: provider.external_evidence_transfer === true,
    api_call_performed: false,
    raw_provider_response_stored: false
  };
}

function fakeAgentResult({ provider, model, surface, agentPackage, packagePath, execution, resultId, now }) {
  const input = {
    agent_advisory_findings: [],
    agent_advisory_action_plan: { next_actions: [] },
    owner_decision_requests: []
  };
  const boundary = providerBoundary({
    provider,
    apiCallPerformed: false,
    externalEvidenceTransfer: false
  });
  return {
    ok: true,
    status: 'completed',
    provider_adapter: providerAdapterRecord(provider, boundary),
    agent_result: normalizeExecutionAdvisoryResult({
      id: resultId,
      now,
      packageData: agentPackage.packet,
      packagePath,
      input,
      surface,
      provider,
      model,
      execution,
      boundary
    }),
    boundary,
    warnings: []
  };
}

async function configuredLocalRunnerResult({ provider, model, surface, agentPackage, packagePath, promptText, execution, resultId, now, context }) {
  const runner = localRunnerForContext(context, provider.id, model.id);
  if (!runner) {
    return providerFailure({
      status: 'blocked',
      code: 'AGENT_EXECUTION_LOCAL_RUNNER_NOT_CONFIGURED',
      message: 'The requested local runner is not configured in the execution context.',
      details: {
        provider: provider.id,
        model: model.id,
        shell_used: false,
        free_form_shell_input_accepted: false,
        next_step: 'Configure a local runner callback in the package API context, or use agent package plus agent ingest for manual handoff.'
      },
      provider
    });
  }

  let input;
  try {
    input = await runner({
      schema_version: SCHEMA_VERSION,
      package: redact(agentPackage.packet),
      package_path: packagePath,
      prompt_text: promptText,
      surface,
      provider,
      model,
      execution
    });
  } catch (error) {
    return providerFailure({
      status: 'failed',
      code: 'AGENT_EXECUTION_LOCAL_RUNNER_FAILED',
      message: 'The configured local runner failed before returning advisory JSON.',
      details: {
        provider: provider.id,
        model: model.id,
        reason: error.message,
        shell_used: false,
        raw_provider_response_stored: false
      },
      provider
    });
  }

  const boundary = providerBoundary({
    provider,
    apiCallPerformed: false,
    externalEvidenceTransfer: false
  });
  return {
    ok: true,
    status: 'completed',
    provider_adapter: providerAdapterRecord(provider, boundary),
    agent_result: normalizeExecutionAdvisoryResult({
      id: resultId,
      now,
      packageData: agentPackage.packet,
      packagePath,
      input: input ?? {},
      surface,
      provider,
      model,
      execution,
      boundary
    }),
    boundary,
    warnings: []
  };
}

async function apiProviderResult({ provider, model, surface, agentPackage, packagePath, promptText, execution, resultId, now, context }) {
  const env = context.env ?? process.env;
  const endpoint = env[API_PROVIDER_ENDPOINT_ENV];
  const credential = env[API_PROVIDER_CREDENTIAL_ENV];
  if (!endpoint || !credential) {
    return providerFailure({
      status: 'blocked',
      code: 'AGENT_EXECUTION_API_CONFIGURATION_MISSING',
      message: 'API provider execution requires endpoint and credential environment variables.',
      details: {
        provider: provider.id,
        model: model.id,
        endpoint_env: API_PROVIDER_ENDPOINT_ENV,
        credential_env: API_PROVIDER_CREDENTIAL_ENV,
        endpoint_configured: Boolean(endpoint),
        credential_configured: Boolean(credential),
        credential_values_recorded: false,
        api_call_performed: false
      },
      provider
    });
  }

  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    return providerFailure({
      status: 'blocked',
      code: 'AGENT_EXECUTION_API_ENDPOINT_INVALID',
      message: 'The API provider endpoint environment variable must contain an absolute URL.',
      details: {
        provider: provider.id,
        endpoint_env: API_PROVIDER_ENDPOINT_ENV,
        credential_values_recorded: false,
        api_call_performed: false
      },
      provider
    });
  }
  if (endpointUrl.protocol !== 'https:' && endpointUrl.protocol !== 'http:') {
    return providerFailure({
      status: 'blocked',
      code: 'AGENT_EXECUTION_API_ENDPOINT_UNSUPPORTED_PROTOCOL',
      message: 'The API provider endpoint must use http or https.',
      details: {
        provider: provider.id,
        endpoint_env: API_PROVIDER_ENDPOINT_ENV,
        endpoint_protocol: endpointUrl.protocol,
        credential_values_recorded: false,
        api_call_performed: false
      },
      provider
    });
  }

  const fetchImpl = context.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return providerFailure({
      status: 'blocked',
      code: 'AGENT_EXECUTION_API_FETCH_UNAVAILABLE',
      message: 'No fetch implementation is available for API provider execution.',
      details: {
        provider: provider.id,
        api_call_performed: false,
        credential_values_recorded: false
      },
      provider
    });
  }

  const payload = buildApiPayload({
    agentPackage,
    packagePath,
    promptText,
    surface,
    provider,
    model,
    execution
  });

  let response;
  try {
    response = await fetchImpl(endpointUrl.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${credential}`
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    return providerFailure({
      status: 'failed',
      code: 'AGENT_EXECUTION_API_REQUEST_FAILED',
      message: 'The API provider request failed.',
      details: {
        provider: provider.id,
        endpoint_origin: endpointUrl.origin,
        reason: error.message,
        api_call_performed: true,
        credential_values_recorded: false,
        raw_provider_response_stored: false
      },
      provider,
      apiCallPerformed: true,
      externalEvidenceTransfer: true
    });
  }

  if (!response.ok) {
    return providerFailure({
      status: 'failed',
      code: 'AGENT_EXECUTION_API_RESPONSE_NOT_OK',
      message: 'The API provider returned a non-success status.',
      details: {
        provider: provider.id,
        endpoint_origin: endpointUrl.origin,
        response_status: response.status,
        api_call_performed: true,
        credential_values_recorded: false,
        raw_provider_response_stored: false
      },
      provider,
      apiCallPerformed: true,
      externalEvidenceTransfer: true
    });
  }

  let input;
  try {
    input = await response.json();
  } catch {
    return providerFailure({
      status: 'failed',
      code: 'AGENT_EXECUTION_API_RESPONSE_INVALID_JSON',
      message: 'The API provider response was not valid advisory JSON.',
      details: {
        provider: provider.id,
        endpoint_origin: endpointUrl.origin,
        api_call_performed: true,
        credential_values_recorded: false,
        raw_provider_response_stored: false
      },
      provider,
      apiCallPerformed: true,
      externalEvidenceTransfer: true
    });
  }

  const boundary = providerBoundary({
    provider,
    apiCallPerformed: true,
    externalEvidenceTransfer: true
  });
  return {
    ok: true,
    status: 'completed',
    provider_adapter: providerAdapterRecord(provider, boundary),
    agent_result: normalizeExecutionAdvisoryResult({
      id: resultId,
      now,
      packageData: agentPackage.packet,
      packagePath,
      input: input?.agent_advisory_result ?? input,
      surface,
      provider,
      model,
      execution,
      boundary
    }),
    boundary,
    warnings: [{
      code: 'AGENT_EXECUTION_EXTERNAL_EVIDENCE_TRANSFER_PERFORMED',
      message: 'API provider execution sent a bounded package and prompt payload to the configured endpoint.',
      details: {
        provider: provider.id,
        endpoint_origin: endpointUrl.origin,
        raw_artifact_content_included: false,
        raw_provider_response_stored: false,
        credential_values_recorded: false
      }
    }]
  };
}

function localRunnerForContext(context, providerId, modelId) {
  if (typeof context.agentExecutionLocalRunner === 'function') {
    return context.agentExecutionLocalRunner;
  }
  const runners = context.agentExecutionLocalRunners;
  if (!runners || typeof runners !== 'object') {
    return null;
  }
  if (typeof runners[modelId] === 'function') {
    return runners[modelId];
  }
  if (typeof runners[providerId] === 'function') {
    return runners[providerId];
  }
  return null;
}

function buildApiPayload({ agentPackage, packagePath, promptText, surface, provider, model, execution }) {
  const packet = agentPackage.packet ?? {};
  const disclosurePolicy = packet.disclosure_policy ?? {};
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agent_execution_request',
    execution_id: execution.id,
    execution_path: execution.execution_path,
    package_id: packet.id ?? null,
    package_path: packagePath,
    prompt_text: truncateText(promptText, 20000),
    surface: {
      id: surface.id,
      kind: surface.kind,
      transport: surface.transport
    },
    provider: {
      id: provider.id,
      kind: provider.kind
    },
    model: {
      id: model.id
    },
    disclosure_policy: {
      scope: disclosurePolicy.scope ?? 'metadata_and_local_artifact_references',
      prompt_content_included: Boolean(promptText),
      raw_artifact_content_included: false,
      raw_dom_included: false,
      trace_content_included: false,
      screenshot_binary_included: false,
      console_payloads_included: false,
      network_payloads_included: false,
      source_data_values_included: false,
      local_artifact_paths_included: Boolean(disclosurePolicy.local_artifact_paths_included),
      external_evidence_transfer: true,
      redaction_applied: true
    },
    evidence_packet: {
      triage: packet.evidence_packet?.triage ?? {},
      coverage_summary: packet.evidence_packet?.coverage_summary ?? null,
      evidence_classes: Array.isArray(packet.evidence_packet?.evidence_classes) ? packet.evidence_packet.evidence_classes : [],
      artifacts: normalizeApiArtifactReferences(packet.evidence_packet?.artifacts),
      rerun: packet.evidence_packet?.rerun ?? null,
      boundaries: packet.evidence_packet?.boundaries ?? {}
    },
    required_output_schema: 'agent_advisory_result'
  });
}

function normalizeApiArtifactReferences(artifacts) {
  if (!Array.isArray(artifacts)) {
    return [];
  }
  return artifacts.slice(0, 100).map((artifact) => ({
    type: truncateText(artifact?.type ?? 'artifact', 100),
    path: truncateText(artifact?.path ?? '', 500),
    description: truncateText(artifact?.description ?? '', 500),
    local_reference: true,
    content_included: false,
    sensitive_content_possible: Boolean(artifact?.sensitive_content_possible)
  }));
}

function normalizeExecutionAdvisoryResult({ id, now, packageData, packagePath, input, surface, provider, model, execution, boundary }) {
  const inputFindings = Array.isArray(input?.agent_advisory_findings)
    ? input.agent_advisory_findings
    : Array.isArray(input?.experience_findings)
      ? input.experience_findings
      : [];
  const findings = inputFindings.slice(0, MAX_AGENT_FINDINGS).map((finding, index) => normalizeAgentFinding(finding, index + 1, id));
  const ownerDecisionRequests = normalizeOwnerDecisionRequests(input?.owner_decision_requests);
  const actionPlan = normalizeAgentActionPlan(input?.agent_advisory_action_plan ?? input?.experience_action_plan, findings);
  const readiness = {
    schema_version: SCHEMA_VERSION,
    status: findings.length > 0 || ownerDecisionRequests.length > 0 ? 'owner_review_recommended' : 'passed',
    gate_effect: 'none',
    blocking_release_gate: false,
    legacy_release_readiness_unchanged: true,
    deterministic_findings_unchanged: true,
    external_evidence_transfer: boundary.external_evidence_transfer,
    advisory_findings: findings.length,
    owner_decision_requests: ownerDecisionRequests.length
  };
  const warnings = [];
  if (inputFindings.length > MAX_AGENT_FINDINGS) {
    warnings.push({
      code: 'AGENT_ADVISORY_FINDINGS_TRUNCATED',
      message: 'Agent advisory findings were truncated to keep output bounded.',
      details: { limit: MAX_AGENT_FINDINGS, received: inputFindings.length }
    });
  }
  return redact({
    schema_version: SCHEMA_VERSION,
    id,
    package_id: stringOrNull(packageData.id),
    package_path: packagePath,
    imported_at: now.toISOString(),
    execution_id: execution.id,
    execution_path: execution.execution_path,
    provider: {
      id: provider.id,
      kind: provider.kind,
      transport: provider.transport
    },
    model: {
      id: model.id
    },
    agent_advisory: {
      schema_version: SCHEMA_VERSION,
      id,
      status: readiness.status,
      source: 'agent_execution',
      surface: surfaceSummary(surface),
      package_id: stringOrNull(packageData.id),
      execution_id: execution.id,
      provider_id: provider.id,
      model_id: model.id,
      untrusted_model_output: true,
      gate_effect: 'none',
      external_evidence_transfer: boundary.external_evidence_transfer,
      api_call_performed_by_cli: boundary.api_call_performed,
      raw_provider_response_stored: false,
      limitations: [
        'Agent execution output is untrusted advisory data and is not deterministic proof.',
        'Agent execution output does not change review findings, metrics, action plans, or release readiness.',
        'No shell commands, browser actions, cleanup, publication, manifest edits, or MCP execution are executed from agent output.'
      ]
    },
    agent_advisory_findings: findings,
    agent_advisory_action_plan: actionPlan,
    agent_advisory_readiness: readiness,
    owner_decision_requests: ownerDecisionRequests,
    warnings,
    boundary
  });
}

function normalizeAgentFinding(finding, index, resultId) {
  const category = AGENT_FINDING_CATEGORIES.has(finding?.category) ? finding.category : 'other';
  const severity = SEVERITIES.has(finding?.severity) ? finding.severity : 'info';
  return {
    id: truncateText(finding?.id ?? `${resultId}-finding-${index}`, 120),
    category,
    severity,
    confidence: normalizeConfidence(finding?.confidence),
    evidence_refs: normalizeEvidenceRefs(finding?.evidence_refs ?? finding?.artifacts),
    selector: optionalString(finding?.selector, 300),
    route: optionalString(finding?.route, 500),
    viewport: finding?.viewport && typeof finding.viewport === 'object' ? redact(finding.viewport) : null,
    message: truncateText(finding?.message ?? finding?.summary ?? 'Agent execution advisory finding.', 600),
    recommendation: truncateText(finding?.recommendation ?? 'Review this advisory item with the product owner before implementation.', 900),
    implementation_hypothesis: truncateText(finding?.implementation_hypothesis ?? finding?.implementation_notes ?? '', 900),
    owner_decision_required: finding?.owner_decision_required !== false,
    source: 'agent_advisory',
    untrusted_text: true,
    gate_effect: 'none'
  };
}

function normalizeAgentActionPlan(inputPlan, findings) {
  const nextActions = Array.isArray(inputPlan?.next_actions)
    ? inputPlan.next_actions.slice(0, MAX_AGENT_FINDINGS).map((action, index) => ({
        id: truncateText(action?.id ?? `agent-execution-action-${index + 1}`, 120),
        severity: SEVERITIES.has(action?.severity) ? action.severity : 'info',
        category: AGENT_FINDING_CATEGORIES.has(action?.category) ? action.category : 'other',
        recommendation: truncateText(action?.recommendation ?? action?.message ?? 'Review the corresponding agent execution advisory finding.', 900),
        finding_id: optionalString(action?.finding_id, 180)
      }))
    : findings.map((finding) => ({
        id: `action-for-${finding.id}`,
        severity: finding.severity,
        category: finding.category,
        recommendation: finding.recommendation,
        finding_id: finding.id
      }));
  return {
    schema_version: SCHEMA_VERSION,
    status: nextActions.length > 0 ? 'needs_owner_review' : 'passed',
    gate_effect: 'none',
    legacy_action_plan_unchanged: true,
    deterministic_findings_unchanged: true,
    total_action_items: nextActions.length,
    next_actions: nextActions
  };
}

function normalizeOwnerDecisionRequests(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.slice(0, MAX_OWNER_DECISIONS).map((value, index) => ({
    id: truncateText(value?.id ?? `owner-decision-${index + 1}`, 120),
    question: truncateText(value?.question ?? value?.message ?? 'Owner decision required.', 500),
    reason: truncateText(value?.reason ?? '', 700),
    related_finding_id: optionalString(value?.related_finding_id, 180),
    gate_effect: 'none',
    untrusted_text: true
  }));
}

function normalizeConfidence(value) {
  if (typeof value === 'string') {
    const normalized = CONFIDENCE_VALUES.has(value) ? value : 'inconclusive';
    return {
      evidence: normalized,
      judgment: normalized,
      implementation: 'inconclusive'
    };
  }
  return {
    evidence: CONFIDENCE_VALUES.has(value?.evidence) ? value.evidence : 'inconclusive',
    judgment: CONFIDENCE_VALUES.has(value?.judgment) ? value.judgment : 'inconclusive',
    implementation: CONFIDENCE_VALUES.has(value?.implementation) ? value.implementation : 'inconclusive'
  };
}

function normalizeEvidenceRefs(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.slice(0, 20).map((value) => {
    if (typeof value === 'string') {
      return { path: truncateText(value, 500), local_reference: true };
    }
    return {
      type: optionalString(value?.type, 100),
      path: optionalString(value?.path, 500),
      local_reference: value?.local_reference !== false
    };
  });
}

function providerFailure({
  status,
  code,
  message,
  details,
  provider,
  apiCallPerformed = false,
  externalEvidenceTransfer = false
}) {
  const boundary = providerBoundary({ provider, apiCallPerformed, externalEvidenceTransfer });
  return {
    ok: false,
    status,
    error: { code, message, details: redact(details ?? {}) },
    provider_adapter: providerAdapterRecord(provider, boundary),
    boundary,
    warnings: []
  };
}

function providerBoundary({ provider, apiCallPerformed, externalEvidenceTransfer }) {
  return {
    browser_launched: false,
    api_call_performed: Boolean(apiCallPerformed),
    external_evidence_transfer: Boolean(externalEvidenceTransfer),
    automatic_upload: false,
    credential_storage: 'none',
    persistent_credential_storage: false,
    credential_values_recorded: false,
    raw_response_stored: false,
    raw_provider_response_stored: false,
    raw_artifact_content_included: false,
    existing_review_mutated: false,
    mcp_execution_exposed: false,
    provider_adapter_implemented: provider.implemented === true,
    shell_used: false,
    free_form_shell_input_accepted: false
  };
}

function providerAdapterRecord(provider, boundary) {
  return {
    id: provider.id,
    kind: provider.kind,
    transport: provider.transport,
    implemented: provider.implemented === true,
    endpoint_env: provider.endpoint_env ?? null,
    credential_env: provider.credential_env ?? null,
    credential_mode: provider.credential_mode,
    api_call_performed: boundary.api_call_performed,
    external_evidence_transfer: boundary.external_evidence_transfer,
    credential_values_recorded: false,
    raw_provider_response_stored: false,
    shell_used: false,
    free_form_shell_input_accepted: false
  };
}

function surfaceSummary(surface) {
  return {
    id: surface.id,
    kind: surface.kind,
    transport: surface.transport,
    status: surface.status,
    external_evidence_transfer: surface.external_evidence_transfer,
    credential_mode: surface.credential_mode,
    implemented: surface.implemented
  };
}

function optionalString(value, maxLength) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return truncateText(value, maxLength);
}

function stringOrNull(value) {
  return typeof value === 'string' && value ? value : null;
}
