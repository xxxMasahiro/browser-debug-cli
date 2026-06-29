import { createHash } from 'node:crypto';
import { SCHEMA_VERSION } from './constants.js';
import { redact, truncateText } from './redaction.js';

export const AGENTIC_REVIEW_API_ENDPOINT_ENV = 'AGENTIC_HUMAN_REVIEW_API_ENDPOINT';
export const AGENTIC_REVIEW_API_CREDENTIAL_ENV = 'AGENTIC_HUMAN_REVIEW_API_TOKEN';
export const AGENTIC_REVIEW_API_TIMEOUT_ENV = 'AGENTIC_HUMAN_REVIEW_API_TIMEOUT_MS';
export const AGENTIC_REVIEW_LIVE_DOGFOOD_ENV = 'AGENTIC_HUMAN_REVIEW_LIVE_DOGFOOD';

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 2147483647;
const DEFAULT_MAX_REQUEST_BYTES = 128 * 1024;
const DEFAULT_MAX_RESPONSE_BYTES = 256 * 1024;
const CAPABILITY_CONTRACT_VERSION = '2.0.0';
const EFFORT_CAPABILITY_CONTRACT_VERSION = '1.0.0';
const REAL_PROVIDER_ADAPTER_CONTRACT_VERSION = '1.0.0';
const LIVE_DOGFOOD_GATE_VERSION = '1.0.0';
const KNOWN_PROVIDER_KINDS = new Set(['fake_provider', 'injected_runner', 'api_provider']);
const KNOWN_TRANSPORTS = new Set(['local_function', 'local_callback', 'provider_api']);
const KNOWN_TRANSFER_CLASSES = new Set(['raw_pixels', 'page_text', 'dom_summary', 'url', 'artifact_refs', 'accessibility_summary']);
const KNOWN_REVIEW_EFFORTS = new Set(['quick', 'standard', 'deep', 'xhigh']);
const SENSITIVE_ENDPOINT_QUERY_PARAMS = new Set([
  'token',
  'api_key',
  'apikey',
  'key',
  'secret',
  'password',
  'credential',
  'authorization',
  'auth',
  'access_token',
  'id_token',
  'refresh_token'
]);

export const AGENTIC_HUMAN_REVIEW_PROVIDERS = Object.freeze([
  Object.freeze({
    id: 'fake-agent',
    display_name: 'Deterministic fake agentic reviewer',
    kind: 'fake_provider',
    transport: 'local_function',
    implemented: true,
    credential_mode: 'none',
    default_model: 'fake-model',
    supported_modalities: Object.freeze(['metadata', 'text_summary', 'artifact_references']),
    transferable_evidence_classes: Object.freeze(['page_text', 'url', 'artifact_refs', 'accessibility_summary']),
    external_evidence_transfer: false,
    api_call_performed: false,
    raw_provider_response_stored: false,
    timeout_ms: 0,
    max_attempts: 1,
    max_request_bytes: DEFAULT_MAX_REQUEST_BYTES,
    max_response_bytes: DEFAULT_MAX_RESPONSE_BYTES,
    cost_policy: 'none',
    supported_review_efforts: Object.freeze(['quick', 'standard', 'deep', 'xhigh']),
    native_effort_binding: Object.freeze({
      supported: false,
      request_field: null,
      effort_map: Object.freeze({}),
      unsupported_behavior: 'not_needed_for_deterministic_local_provider'
    }),
    structured_output_contract: Object.freeze({
      json_schema_supported: true,
      strict_schema_supported: true,
      tracecue_post_validation_required: true
    }),
    xhigh_execution_contract: Object.freeze({
      single_call_multi_role_output_supported: true,
      repair_retry_supported: true,
      true_multi_step_execution_supported: true,
      true_multi_step_execution_default: false,
      execution_surface: 'local_fake_provider_only'
    })
  }),
  Object.freeze({
    id: 'injected-runner',
    display_name: 'Injected local agentic reviewer',
    kind: 'injected_runner',
    transport: 'local_callback',
    implemented: true,
    credential_mode: 'none',
    default_model: 'injected-local-model',
    supported_modalities: Object.freeze(['metadata', 'text_summary', 'artifact_references']),
    transferable_evidence_classes: Object.freeze(['page_text', 'url', 'artifact_refs', 'accessibility_summary']),
    external_evidence_transfer: false,
    api_call_performed: false,
    raw_provider_response_stored: false,
    timeout_ms: 0,
    max_attempts: 1,
    max_request_bytes: DEFAULT_MAX_REQUEST_BYTES,
    max_response_bytes: DEFAULT_MAX_RESPONSE_BYTES,
    cost_policy: 'none',
    supported_review_efforts: Object.freeze(['quick', 'standard', 'deep', 'xhigh']),
    native_effort_binding: Object.freeze({
      supported: false,
      request_field: null,
      effort_map: Object.freeze({}),
      unsupported_behavior: 'local_runner_controls_its_own_reasoning'
    }),
    structured_output_contract: Object.freeze({
      json_schema_supported: true,
      strict_schema_supported: false,
      tracecue_post_validation_required: true
    }),
    xhigh_execution_contract: Object.freeze({
      single_call_multi_role_output_supported: true,
      repair_retry_supported: false,
      true_multi_step_execution_supported: false,
      true_multi_step_execution_default: false,
      execution_surface: 'caller_supplied_local_runner'
    })
  }),
  Object.freeze({
    id: 'generic-api-provider',
    display_name: 'Generic API agentic reviewer',
    kind: 'api_provider',
    transport: 'provider_api',
    implemented: true,
    credential_mode: 'environment_variable_only',
    endpoint_env: AGENTIC_REVIEW_API_ENDPOINT_ENV,
    credential_env: AGENTIC_REVIEW_API_CREDENTIAL_ENV,
    timeout_env: AGENTIC_REVIEW_API_TIMEOUT_ENV,
    default_model: 'generic-agentic-review-model',
    supported_modalities: Object.freeze(['metadata', 'text_summary', 'artifact_references']),
    transferable_evidence_classes: Object.freeze(['page_text', 'url', 'artifact_refs', 'accessibility_summary']),
    external_evidence_transfer: true,
    api_call_performed: true,
    raw_provider_response_stored: false,
    timeout_ms: DEFAULT_TIMEOUT_MS,
    max_attempts: 1,
    max_request_bytes: DEFAULT_MAX_REQUEST_BYTES,
    max_response_bytes: DEFAULT_MAX_RESPONSE_BYTES,
    cost_policy: 'unknown_cost_requires_owner_review',
    supported_review_efforts: Object.freeze(['quick', 'standard', 'deep', 'xhigh']),
    native_effort_binding: Object.freeze({
      supported: true,
      request_field: 'reasoning.effort',
      effort_map: Object.freeze({
        quick: 'low',
        standard: 'medium',
        deep: 'high',
        xhigh: 'high'
      }),
      unsupported_behavior: 'record_not_supported_and_require_tracecue_contract_validation'
    }),
    structured_output_contract: Object.freeze({
      json_schema_supported: true,
      strict_schema_supported: false,
      tracecue_post_validation_required: true
    }),
    xhigh_execution_contract: Object.freeze({
      single_call_multi_role_output_supported: true,
      repair_retry_supported: true,
      true_multi_step_execution_supported: false,
      true_multi_step_execution_default: false,
      execution_surface: 'approved_agentic_review_run_only'
    })
  })
]);

export function agenticProviderCapabilityContract(provider) {
  const normalized = normalizeProviderDescriptor(provider);
  const supportedModalities = uniqueSorted(normalized.supported_modalities);
  const transferableEvidenceClasses = uniqueSorted(normalized.transferable_evidence_classes)
    .filter((item) => KNOWN_TRANSFER_CLASSES.has(item));
  const supportedReviewEfforts = uniqueSorted(normalized.supported_review_efforts)
    .filter((item) => KNOWN_REVIEW_EFFORTS.has(item));
  const nativeEffortBinding = normalizeNativeEffortBinding(normalized.native_effort_binding);
  const structuredOutputContract = normalizeStructuredOutputContract(normalized.structured_output_contract);
  const xhighExecutionContract = normalizeXhighExecutionContract(normalized.xhigh_execution_contract);
  return redact({
    schema_version: SCHEMA_VERSION,
    capability_contract_version: CAPABILITY_CONTRACT_VERSION,
    effort_capability_contract_version: EFFORT_CAPABILITY_CONTRACT_VERSION,
    provider_id: normalized.id,
    kind: normalized.kind,
    transport: normalized.transport,
    implemented: normalized.implemented === true,
    credential_mode: normalized.credential_mode,
    endpoint_env: normalized.endpoint_env ?? null,
    credential_env: normalized.credential_env ?? null,
    timeout_env: normalized.timeout_env ?? null,
    default_model: normalized.default_model,
    supported_modalities: supportedModalities,
    transferable_evidence_classes: transferableEvidenceClasses,
    external_evidence_transfer: normalized.external_evidence_transfer === true,
    api_call_performed_by_adapter: normalized.api_call_performed === true,
    raw_provider_response_stored: false,
    timeout_ms: normalized.timeout_ms,
    max_attempts: normalized.max_attempts,
    max_request_bytes: normalized.max_request_bytes,
    max_response_bytes: normalized.max_response_bytes,
    cost_policy: normalized.cost_policy,
    effort_capability: {
      supported_review_efforts: supportedReviewEfforts,
      xhigh_supported: supportedReviewEfforts.includes('xhigh'),
      native_effort_binding: nativeEffortBinding,
      structured_output_contract: structuredOutputContract,
      xhigh_execution_contract: xhighExecutionContract,
      tracecue_contract_validation_required: true
    },
    supports_vision: supportedModalities.some((item) => /image|pixel|vision|screenshot/i.test(item))
      || transferableEvidenceClasses.includes('raw_pixels'),
    supports_json_schema: structuredOutputContract.json_schema_supported,
    supports_strict_json_schema: structuredOutputContract.strict_schema_supported,
    endpoint_policy: {
      https_required_for_external: true,
      loopback_http_allowed: true,
      url_credentials_allowed: false,
      sensitive_query_allowed: false,
      redirects_allowed: false,
      credential_source: normalized.credential_mode === 'environment_variable_only' ? 'environment_variable_only' : normalized.credential_mode
    },
    execution_boundary: {
      mcp_execution_exposed: false,
      deterministic_findings_mutated: false,
      release_gate_mutated: false,
      advisory_only: true,
      gate_effect: 'none'
    },
    real_provider_adapter_contract: {
      contract_version: REAL_PROVIDER_ADAPTER_CONTRACT_VERSION,
      manual_live_dogfood_supported: normalized.transport === 'provider_api',
      ci_live_provider_default: false,
      credential_values_recorded: false,
      raw_provider_response_stored: false,
      setup_readiness_surface: 'agentic_review_dogfood_readiness',
      execution_surface: 'agentic_review_run_only',
      required_owner_controls: [
        'approved plan hash',
        'explicit execute flag',
        'exact transfer flags',
        'environment-variable credential',
        'manual live dogfood opt-in'
      ],
      provider_specific_configuration_allowed: true,
      provider_specific_runtime_branches_allowed: false
    }
  });
}

export function agenticProviderCapabilityHash(provider) {
  return createHash('sha256')
    .update(canonicalStringify(agenticProviderCapabilityContract(provider)))
    .digest('hex');
}

export function validateAgenticProviderDescriptor(provider, { builtInIds = new Set(AGENTIC_HUMAN_REVIEW_PROVIDERS.map((item) => item.id)) } = {}) {
  const normalized = normalizeProviderDescriptor(provider);
  const missing = ['id', 'kind', 'transport'].filter((field) => !normalized[field]);
  if (missing.length > 0) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_PROVIDER_DESCRIPTOR_INVALID',
        message: 'Agentic human review provider descriptors must declare stable id, kind, and transport fields.',
        details: { missing_fields: missing }
      }
    };
  }
  if (builtInIds.has(normalized.id)) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_PROVIDER_DESCRIPTOR_COLLISION',
        message: 'Custom agentic human review provider descriptors cannot override built-in provider ids.',
        details: { provider: normalized.id }
      }
    };
  }
  if (!KNOWN_PROVIDER_KINDS.has(normalized.kind)) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_PROVIDER_DESCRIPTOR_INVALID',
        message: 'Agentic human review provider descriptors must use a known provider kind.',
        details: { provider: normalized.id, kind: normalized.kind, allowed_kinds: [...KNOWN_PROVIDER_KINDS] }
      }
    };
  }
  if (!KNOWN_TRANSPORTS.has(normalized.transport)) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_PROVIDER_DESCRIPTOR_INVALID',
        message: 'Agentic human review provider descriptors must use a known provider transport.',
        details: { provider: normalized.id, transport: normalized.transport, allowed_transports: [...KNOWN_TRANSPORTS] }
      }
    };
  }
  const unsupportedClasses = uniqueSorted(normalized.transferable_evidence_classes)
    .filter((item) => !KNOWN_TRANSFER_CLASSES.has(item));
  if (unsupportedClasses.length > 0) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_PROVIDER_DESCRIPTOR_INVALID',
        message: 'Agentic human review provider descriptors declared unsupported evidence transfer classes.',
        details: { provider: normalized.id, unsupported_classes: unsupportedClasses }
      }
    };
  }
  const unsupportedEfforts = uniqueSorted(normalized.supported_review_efforts)
    .filter((item) => !KNOWN_REVIEW_EFFORTS.has(item));
  if (unsupportedEfforts.length > 0) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_PROVIDER_DESCRIPTOR_INVALID',
        message: 'Agentic human review provider descriptors declared unsupported review efforts.',
        details: { provider: normalized.id, unsupported_efforts: unsupportedEfforts, allowed_efforts: [...KNOWN_REVIEW_EFFORTS] }
      }
    };
  }
  if (normalized.transport === 'provider_api' && normalized.credential_mode !== 'environment_variable_only') {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_PROVIDER_DESCRIPTOR_INVALID',
        message: 'Provider API descriptors must use environment-variable-only credentials.',
        details: { provider: normalized.id, credential_mode: normalized.credential_mode }
      }
    };
  }
  return { ok: true, provider: normalized };
}

export function agenticProviderSummary(provider) {
  const normalized = normalizeProviderDescriptor(provider);
  const capability = agenticProviderCapabilityContract(normalized);
  return {
    id: normalized.id,
    display_name: normalized.display_name,
    kind: normalized.kind,
    transport: normalized.transport,
    implemented: normalized.implemented === true,
    credential_mode: normalized.credential_mode,
    endpoint_env: normalized.endpoint_env ?? null,
    credential_env: normalized.credential_env ?? null,
    timeout_env: normalized.timeout_env ?? null,
    default_model: normalized.default_model,
    supported_modalities: [...(normalized.supported_modalities ?? [])],
    transferable_evidence_classes: [...(normalized.transferable_evidence_classes ?? [])],
    supported_review_efforts: [...(normalized.supported_review_efforts ?? [])],
    external_evidence_transfer: normalized.external_evidence_transfer === true,
    api_call_performed: false,
    raw_provider_response_stored: false,
    timeout_ms: normalized.timeout_ms ?? DEFAULT_TIMEOUT_MS,
    max_attempts: normalized.max_attempts ?? 1,
    max_request_bytes: normalized.max_request_bytes ?? DEFAULT_MAX_REQUEST_BYTES,
    max_response_bytes: normalized.max_response_bytes ?? DEFAULT_MAX_RESPONSE_BYTES,
    cost_policy: normalized.cost_policy ?? 'unknown_cost_requires_owner_review',
    supports_vision: capability.supports_vision,
    supports_json_schema: capability.supports_json_schema,
    supports_strict_json_schema: capability.supports_strict_json_schema,
    effort_capability: capability.effort_capability,
    endpoint_policy: capability.endpoint_policy,
    capability_contract: capability,
    capability_hash: agenticProviderCapabilityHash(normalized)
  };
}

export function resolveAgenticHumanReviewProvider({ providerId, context = {} } = {}) {
  const id = providerId ?? 'fake-agent';
  const prepared = prepareProviderDescriptors(context, { providerId: id });
  if (!prepared.ok) {
    return prepared;
  }
  const providers = prepared.providers;
  const provider = providers.find((candidate) => candidate.id === id);
  if (!provider) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_PROVIDER_UNKNOWN',
        message: 'No agentic human review provider matched the requested provider.',
        details: {
          provider: id,
          available_providers: providers.map((candidate) => candidate.id)
        }
      }
    };
  }
  return { ok: true, provider: agenticProviderSummary(provider) };
}

export function buildAgenticProviderReadiness({
  providerId = 'all',
  surface = null,
  model = null,
  proposal = null,
  plan = null,
  context = {},
  now = new Date()
} = {}) {
  const prepared = prepareProviderDescriptors(context, { providerId });
  if (!prepared.ok) {
    return prepared;
  }
  const providers = prepared.providers.map((provider) => readinessProviderRecord(provider, { surface, model }));
  const selected = providerId && providerId !== 'all'
    ? providers.filter((provider) => provider.id === providerId)
    : providers;
  if (providerId && providerId !== 'all' && selected.length === 0) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_PROVIDER_UNKNOWN',
        message: 'No agentic human review provider matched the requested provider.',
        details: { provider: providerId, available_providers: providers.map((provider) => provider.id) }
      }
    };
  }
  return {
    ok: true,
    readiness: redact({
      schema_version: SCHEMA_VERSION,
      type: 'agentic_human_review_provider_readiness',
      generated_at: now.toISOString(),
      status: selected.some((provider) => provider.implemented) ? 'ready_for_approved_plan_execution' : 'not_available',
      selected_provider: providerId ?? 'all',
      providers: selected,
      input_context: {
        proposal_id: proposal?.id ?? null,
        proposal_hash: proposal?.proposal_hash ?? null,
        plan_id: plan?.id ?? null,
        plan_hash: plan?.plan_hash ?? null,
        surface_id: surface?.id ?? surface ?? null,
        model_id: model?.id ?? model ?? null
      },
      policy: {
        provider_execution_requires_approved_plan: true,
        execute_flag_required: true,
        exact_transfer_flags_required: true,
        credentials_env_only: true,
        credential_values_read_by_readiness: false,
        credential_values_recorded: false,
        raw_provider_response_stored: false,
        mcp_execution_exposed: false,
        advisory_only: true,
        gate_effect: 'none'
      },
      boundary: {
        local_only: true,
        read_only: true,
        provider_call_performed: false,
        api_call_performed: false,
        credential_values_read: false,
        credential_values_recorded: false,
        external_evidence_transfer: false,
        raw_provider_response_stored: false,
        mcp_execution_exposed: false,
        deterministic_findings_mutated: false,
        existing_review_mutated: false,
        gate_effect: 'none'
      }
    })
  };
}

export function buildAgenticDogfoodSetupReadiness({ provider, context = {} } = {}) {
  const env = context.env ?? process.env;
  const endpointEnv = provider?.endpoint_env ?? null;
  const credentialEnv = provider?.credential_env ?? null;
  const timeoutEnv = provider?.timeout_env ?? null;
  const liveDogfoodValue = env[AGENTIC_REVIEW_LIVE_DOGFOOD_ENV];
  return redact({
    endpoint_env: endpointEnv,
    credential_env: credentialEnv,
    timeout_env: timeoutEnv,
    live_dogfood_env: AGENTIC_REVIEW_LIVE_DOGFOOD_ENV,
    endpoint_configured: hasEnvKey(env, endpointEnv),
    credential_configured: hasEnvKey(env, credentialEnv),
    timeout_configured: hasEnvKey(env, timeoutEnv),
    timeout_ms: provider?.timeout_ms ?? DEFAULT_TIMEOUT_MS,
    live_dogfood_enabled: liveDogfoodValue === '1' || String(liveDogfoodValue ?? '').toLowerCase() === 'true',
    manual_live_provider_default: false,
    ci_live_provider_default: false,
    credential_values_read_by_readiness: false,
    credential_values_recorded: false,
    raw_provider_response_stored: false
  });
}

export function buildAgenticLiveDogfoodExecutionGate({ provider, plan = {}, context = {}, phase = 'run' } = {}) {
  const normalized = normalizeProviderDescriptor(provider);
  const benchmark = plan.review_quality_benchmark ?? {};
  const dogfood = plan.dogfood_metadata ?? {};
  const caseId = dogfood.case_id ?? benchmark.case_id ?? null;
  const dogfoodRequested = Boolean(dogfood.enabled || dogfood.case_id || benchmark.enabled || benchmark.case_id);
  const providerApi = normalized.transport === 'provider_api' || normalized.external_evidence_transfer === true;
  const optInEnabled = isLiveDogfoodOptInEnabled(context);
  const requiredForExecution = providerApi && dogfoodRequested;
  const status = requiredForExecution
    ? (optInEnabled ? 'manual_live_dogfood_authorized' : 'blocked_manual_live_dogfood_opt_in_required')
    : (dogfoodRequested ? 'local_or_non_api_dogfood_ready' : 'not_dogfood_run');
  return redact({
    schema_version: SCHEMA_VERSION,
    gate_version: LIVE_DOGFOOD_GATE_VERSION,
    phase,
    status,
    provider_id: normalized.id,
    provider_transport: normalized.transport,
    provider_api: providerApi,
    dogfood_requested: dogfoodRequested,
    benchmark_case_id: caseId,
    required_for_execution: requiredForExecution,
    live_dogfood_env: AGENTIC_REVIEW_LIVE_DOGFOOD_ENV,
    live_dogfood_opt_in_enabled: requiredForExecution ? optInEnabled : null,
    manual_live_provider_default: false,
    ci_live_provider_default: false,
    provider_call_performed: false,
    api_call_performed: false,
    credential_values_recorded: false,
    raw_provider_response_stored: false,
    deterministic_findings_mutated: false,
    release_gate_mutated: false,
    advisory_only: true,
    gate_effect: 'none'
  });
}

export async function executeAgenticHumanReviewApiProvider({
  provider,
  model,
  surface,
  plan,
  planPath,
  reviewPackage,
  transferFlags,
  execution,
  context = {}
}) {
  const env = context.env ?? process.env;
  const endpoint = env[provider.endpoint_env];
  const credential = env[provider.credential_env];
  if (!endpoint || !credential) {
    return providerFailure({
      status: 'blocked',
      code: 'AGENTIC_REVIEW_API_CONFIGURATION_MISSING',
      message: 'Agentic human review API execution requires endpoint and credential environment variables.',
      details: {
        provider: provider.id,
        model: model.id,
        endpoint_env: provider.endpoint_env,
        credential_env: provider.credential_env,
        endpoint_configured: Boolean(endpoint),
        credential_configured: Boolean(credential),
        credential_values_recorded: false,
        api_call_performed: false
      },
      provider,
      providerCallPerformed: false,
      apiCallPerformed: false
    });
  }

  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    return providerFailure({
      status: 'blocked',
      code: 'AGENTIC_REVIEW_API_ENDPOINT_INVALID',
      message: 'The agentic review API endpoint environment variable must contain an absolute URL.',
      details: {
        provider: provider.id,
        endpoint_env: provider.endpoint_env,
        credential_values_recorded: false,
        api_call_performed: false
      },
      provider
    });
  }
  if (endpointUrl.protocol !== 'https:' && !(endpointUrl.protocol === 'http:' && isLoopbackHost(endpointUrl.hostname))) {
    return providerFailure({
      status: 'blocked',
      code: 'AGENTIC_REVIEW_API_ENDPOINT_UNSUPPORTED_PROTOCOL',
      message: 'The agentic review API endpoint must use https, except for explicit loopback http development endpoints.',
      details: {
        provider: provider.id,
        endpoint_env: provider.endpoint_env,
        endpoint_protocol: endpointUrl.protocol,
        endpoint_loopback: isLoopbackHost(endpointUrl.hostname),
        credential_values_recorded: false,
        api_call_performed: false
      },
      provider
    });
  }
  const endpointValidation = validateApiEndpointUrl(endpointUrl);
  if (!endpointValidation.ok) {
    return providerFailure({
      status: 'blocked',
      code: endpointValidation.error.code,
      message: endpointValidation.error.message,
      details: {
        provider: provider.id,
        endpoint_env: provider.endpoint_env,
        ...endpointValidation.error.details,
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
      code: 'AGENTIC_REVIEW_API_FETCH_UNAVAILABLE',
      message: 'No fetch implementation is available for agentic human review API execution.',
      details: {
        provider: provider.id,
        api_call_performed: false,
        credential_values_recorded: false
      },
      provider
    });
  }

  const payload = buildAgenticApiPayload({
    plan,
    planPath,
    reviewPackage,
    transferFlags,
    provider,
    model,
    surface,
    execution
  });
  const payloadText = JSON.stringify(payload);
  if (Buffer.byteLength(payloadText, 'utf8') > provider.max_request_bytes) {
    return providerFailure({
      status: 'blocked',
      code: 'AGENTIC_REVIEW_API_REQUEST_TOO_LARGE',
      message: 'The agentic review API request exceeds the provider request-size limit.',
      details: {
        provider: provider.id,
        request_bytes: Buffer.byteLength(payloadText, 'utf8'),
        max_request_bytes: provider.max_request_bytes,
        credential_values_recorded: false
      },
      provider
    });
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller && provider.timeout_ms > 0
    ? setTimeout(() => controller.abort(), provider.timeout_ms)
    : null;
  let response;
  const started = Date.now();
  try {
    response = await fetchImpl(endpointUrl.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${credential}`
      },
      body: payloadText,
      redirect: 'error',
      signal: controller?.signal
    });
  } catch (error) {
    if (timeout) {
      clearTimeout(timeout);
    }
    return providerFailure({
      status: 'failed',
      code: error?.name === 'AbortError' ? 'AGENTIC_REVIEW_API_REQUEST_TIMEOUT' : 'AGENTIC_REVIEW_API_REQUEST_FAILED',
      message: error?.name === 'AbortError'
        ? 'The agentic review API request timed out.'
        : 'The agentic review API request failed.',
      details: {
        provider: provider.id,
        failure_class: error?.name ?? 'Error',
        duration_ms: Date.now() - started,
        timeout_ms: provider.timeout_ms,
        credential_values_recorded: false,
        raw_provider_response_stored: false
      },
      provider,
      providerCallPerformed: true,
      apiCallPerformed: true,
      externalEvidenceTransfer: true
    });
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }

  const responseMeta = {
    status_code: response.status ?? null,
    ok: response.ok === true,
    duration_ms: Date.now() - started
  };
  if (!response.ok) {
    const adapterDiagnostics = redactExactSecrets(await readLoopbackAdapterDiagnostics({
      response,
      endpointUrl,
      maxResponseBytes: provider.max_response_bytes
    }), [credential, endpoint]);
    return providerFailure({
      status: 'failed',
      code: 'AGENTIC_REVIEW_API_RESPONSE_NOT_OK',
      message: 'The agentic review API response was not successful.',
      details: {
        provider: provider.id,
        ...responseMeta,
        ...adapterDiagnostics,
        credential_values_recorded: false,
        raw_provider_response_stored: false
      },
      provider,
      providerCallPerformed: true,
      apiCallPerformed: true,
      externalEvidenceTransfer: true
    });
  }

  const declaredLength = Number(typeof response.headers?.get === 'function' ? response.headers.get('content-length') : null);
  if (Number.isFinite(declaredLength) && declaredLength > provider.max_response_bytes) {
    await discardResponseBody(response, provider.max_response_bytes);
    return providerFailure({
      status: 'failed',
      code: 'AGENTIC_REVIEW_API_RESPONSE_TOO_LARGE',
      message: 'The agentic review API response exceeds the provider response-size limit.',
      details: {
        provider: provider.id,
        ...responseMeta,
        response_bytes: declaredLength,
        credential_values_recorded: false,
        raw_provider_response_stored: false
      },
      provider,
      providerCallPerformed: true,
      apiCallPerformed: true,
      externalEvidenceTransfer: true
    });
  }

  const parsed = await parseBoundedResponse(response, provider.max_response_bytes);
  if (!parsed.ok) {
    return providerFailure({
      status: 'failed',
      code: parsed.code,
      message: parsed.message,
      details: {
        provider: provider.id,
        ...responseMeta,
        response_bytes: parsed.response_bytes ?? null,
        credential_values_recorded: false,
        raw_provider_response_stored: false
      },
      provider,
      providerCallPerformed: true,
      apiCallPerformed: true,
      externalEvidenceTransfer: true
    });
  }

  return {
    ok: true,
    status: 'completed',
    input: redactExactSecrets(parsed.value?.agentic_human_review_advisory ?? parsed.value ?? {}, [credential, endpoint]),
    boundary: providerBoundary({
      provider,
      providerCallPerformed: true,
      apiCallPerformed: true,
      externalEvidenceTransfer: true,
      responseBytes: parsed.response_bytes ?? null,
      requestBytes: Buffer.byteLength(payloadText, 'utf8'),
      statusCode: response.status ?? null,
      rawPixelsTransferred: false,
      pageTextTransferred: transferFlags.supplied_flags?.includes('allow-page-text') === true,
      domSummaryTransferred: transferFlags.supplied_flags?.includes('allow-dom-summary') === true,
      urlMetadataTransferred: transferFlags.supplied_flags?.includes('allow-url') === true,
      artifactRefsTransferred: transferFlags.supplied_flags?.includes('allow-artifact-refs') === true,
      accessibilitySummaryTransferred: transferFlags.supplied_flags?.includes('allow-accessibility-summary') === true
    }),
    warnings: []
  };
}

export function providerBoundary({
  provider,
  providerCallPerformed,
  apiCallPerformed,
  externalEvidenceTransfer,
  requestBytes = null,
  responseBytes = null,
  statusCode = null,
  rawPixelsTransferred = false,
  pageTextTransferred = false,
  domSummaryTransferred = false,
  urlMetadataTransferred = false,
  artifactRefsTransferred = false,
  accessibilitySummaryTransferred = false
}) {
  return {
    provider_adapter_implemented: provider.implemented === true,
    provider_call_performed: Boolean(providerCallPerformed),
    api_call_performed: Boolean(apiCallPerformed),
    external_evidence_transfer: Boolean(externalEvidenceTransfer),
    request_bytes: requestBytes,
    response_bytes: responseBytes,
    provider_status_code: statusCode,
    raw_pixels_transferred: Boolean(rawPixelsTransferred),
    page_text_transferred: Boolean(pageTextTransferred),
    dom_summary_transferred: Boolean(domSummaryTransferred),
    url_metadata_transferred: Boolean(urlMetadataTransferred),
    artifact_refs_transferred: Boolean(artifactRefsTransferred),
    accessibility_summary_transferred: Boolean(accessibilitySummaryTransferred),
    credential_values_recorded: false,
    raw_provider_response_stored: false
  };
}

function readinessProviderRecord(provider, { surface, model }) {
  const summary = agenticProviderSummary(provider);
  return {
    ...summary,
    requested_surface_id: surface?.id ?? surface ?? null,
    requested_model_id: model?.id ?? model ?? summary.default_model,
    credential_values_read_by_readiness: false,
    credential_values_recorded: false,
    raw_provider_response_stored: false,
    provider_call_performed: false,
    api_call_performed: false,
    external_evidence_transfer_performed: false,
    transfer_policy: {
      requires_approved_plan_hash: true,
      requires_exact_transfer_flags: true,
      requires_matching_provider_capability_hash: true,
      provider_capability_hash: summary.capability_hash,
      mcp_execution_allowed: false,
      default_external_transfer: false,
      transferable_evidence_classes: summary.transferable_evidence_classes
    },
    setup_readiness: {
      readiness_surface: 'agentic_review_dogfood_readiness',
      live_dogfood_manual_only: true,
      ci_live_provider_default: false,
      endpoint_env: summary.endpoint_env,
      credential_env: summary.credential_env,
      timeout_env: summary.timeout_env,
      live_dogfood_env: AGENTIC_REVIEW_LIVE_DOGFOOD_ENV,
      credential_values_read_by_readiness: false,
      credential_values_recorded: false,
      raw_provider_response_stored: false
    }
  };
}

function prepareProviderDescriptors(context = {}, { providerId = 'all' } = {}) {
  const customDescriptors = normalizeProviderDescriptors(context.agenticReviewProviders);
  const customProviders = [];
  for (const descriptor of customDescriptors) {
    const validation = validateAgenticProviderDescriptor(descriptor);
    if (!validation.ok) {
      return validation;
    }
    customProviders.push(validation.provider);
  }
  const builtInProviders = [];
  for (const descriptor of AGENTIC_HUMAN_REVIEW_PROVIDERS) {
    const selected = providerId === 'all' || providerId === descriptor.id;
    const runtime = selected
      ? applyRuntimeProviderConfig(descriptor, context)
      : { ok: true, provider: normalizeProviderDescriptor(descriptor) };
    if (!runtime.ok) {
      return runtime;
    }
    builtInProviders.push(runtime.provider);
  }
  return {
    ok: true,
    providers: [
      ...customProviders,
      ...builtInProviders
    ]
  };
}

function normalizeProviderDescriptors(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function normalizeProviderDescriptor(provider) {
  return {
    id: provider.id,
    display_name: provider.display_name ?? provider.id,
    kind: provider.kind ?? 'provider',
    transport: provider.transport ?? 'unknown',
    implemented: provider.implemented === true,
    credential_mode: provider.credential_mode ?? 'none',
    endpoint_env: provider.endpoint_env ?? null,
    credential_env: provider.credential_env ?? null,
    timeout_env: provider.timeout_env ?? null,
    default_model: provider.default_model ?? 'fake-model',
    supported_modalities: Array.isArray(provider.supported_modalities) ? provider.supported_modalities : ['metadata'],
    transferable_evidence_classes: Array.isArray(provider.transferable_evidence_classes)
      ? provider.transferable_evidence_classes
      : ['page_text', 'url', 'artifact_refs', 'accessibility_summary'],
    supported_review_efforts: Array.isArray(provider.supported_review_efforts)
      ? provider.supported_review_efforts
      : Array.isArray(provider.effort_capability?.supported_review_efforts)
        ? provider.effort_capability.supported_review_efforts
      : ['quick', 'standard', 'deep'],
    native_effort_binding: provider.native_effort_binding ?? provider.effort_capability?.native_effort_binding ?? null,
    structured_output_contract: provider.structured_output_contract ?? provider.effort_capability?.structured_output_contract ?? null,
    xhigh_execution_contract: provider.xhigh_execution_contract ?? provider.effort_capability?.xhigh_execution_contract ?? null,
    external_evidence_transfer: provider.external_evidence_transfer === true,
    api_call_performed: provider.api_call_performed === true,
    raw_provider_response_stored: false,
    timeout_ms: Number.isFinite(Number(provider.timeout_ms)) ? Number(provider.timeout_ms) : DEFAULT_TIMEOUT_MS,
    max_attempts: Number.isFinite(Number(provider.max_attempts)) ? Number(provider.max_attempts) : 1,
    max_request_bytes: Number.isFinite(Number(provider.max_request_bytes)) ? Number(provider.max_request_bytes) : DEFAULT_MAX_REQUEST_BYTES,
    max_response_bytes: Number.isFinite(Number(provider.max_response_bytes)) ? Number(provider.max_response_bytes) : DEFAULT_MAX_RESPONSE_BYTES,
    cost_policy: provider.cost_policy ?? 'unknown_cost_requires_owner_review'
  };
}

function normalizeNativeEffortBinding(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const map = source.effort_map && typeof source.effort_map === 'object' && !Array.isArray(source.effort_map)
    ? source.effort_map
    : {};
  const normalizedMap = Object.fromEntries([...KNOWN_REVIEW_EFFORTS].map((effort) => [
    effort,
    typeof map[effort] === 'string' && map[effort].trim() ? map[effort].trim() : null
  ]));
  return {
    supported: source.supported === true,
    request_field: typeof source.request_field === 'string' && source.request_field.trim() ? source.request_field.trim() : null,
    effort_map: normalizedMap,
    unsupported_behavior: typeof source.unsupported_behavior === 'string' && source.unsupported_behavior.trim()
      ? source.unsupported_behavior.trim()
      : 'record_not_supported_and_continue_with_tracecue_contract_validation'
  };
}

function normalizeStructuredOutputContract(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    json_schema_supported: source.json_schema_supported !== false,
    strict_schema_supported: source.strict_schema_supported === true,
    tracecue_post_validation_required: source.tracecue_post_validation_required !== false
  };
}

function normalizeXhighExecutionContract(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    single_call_multi_role_output_supported: source.single_call_multi_role_output_supported !== false,
    repair_retry_supported: source.repair_retry_supported === true,
    true_multi_step_execution_supported: source.true_multi_step_execution_supported === true,
    true_multi_step_execution_default: source.true_multi_step_execution_default === true,
    execution_surface: typeof source.execution_surface === 'string' && source.execution_surface.trim()
      ? source.execution_surface.trim()
      : 'not_declared'
  };
}

function applyRuntimeProviderConfig(provider, context = {}) {
  const normalized = normalizeProviderDescriptor(provider);
  if (normalized.id !== 'generic-api-provider') {
    return { ok: true, provider: normalized };
  }
  const env = context.env ?? process.env;
  const timeout = parseOptionalPositiveIntegerEnv(env, normalized.timeout_env, 'timeout_ms');
  if (!timeout.ok) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_PROVIDER_RUNTIME_CONFIG_INVALID',
        message: 'Agentic human review provider runtime configuration is invalid.',
        details: timeout.details
      }
    };
  }
  return {
    ok: true,
    provider: {
      ...normalized,
      timeout_ms: timeout.configured ? timeout.value : normalized.timeout_ms
    }
  };
}

function parseOptionalPositiveIntegerEnv(env, key, field) {
  if (!hasEnvKey(env, key)) {
    return { ok: true, configured: false, value: null };
  }
  const raw = String(env[key] ?? '').trim();
  if (!/^[1-9]\d*$/.test(raw)) {
    return {
      ok: false,
      details: {
        env: key,
        field,
        value_present: raw.length > 0,
        expected: 'positive integer milliseconds'
      }
    };
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > MAX_TIMEOUT_MS) {
    return {
      ok: false,
      details: {
        env: key,
        field,
        value_present: true,
        max: MAX_TIMEOUT_MS,
        expected: 'safe positive integer milliseconds within Node timer range'
      }
    };
  }
  return { ok: true, configured: true, value };
}

function buildAgenticApiPayload({ plan, planPath, reviewPackage, transferFlags, provider, model, surface, execution }) {
  const filteredPackage = filterReviewPackageForTransfer(reviewPackage, transferFlags);
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_request',
    plan: {
      id: plan.id,
      plan_path_included: false,
      plan_hash: plan.plan_hash,
      intent: plan.intent,
      review_scope: plan.review_scope,
      review_effort: plan.review_effort,
      sub_agents: plan.sub_agents,
      rounds: plan.rounds,
      rubric: plan.rubric,
      rubric_profile: plan.rubric_profile ?? null,
      evidence_plan: plan.evidence_plan ?? reviewPackage?.evidence_plan ?? null,
      visual_evidence_package_v2: filteredPackage.visual_evidence_package_v2 ?? null,
      visible_text_reading_contract: filteredPackage.visible_text_reading_contract ?? null,
      visible_text_provenance: filteredPackage.visible_text_provenance ?? null,
      screen_text_understanding_contract: filteredPackage.screen_text_understanding_contract ?? null,
      human_review_contract: plan.human_review_contract ?? null,
      provider_instruction_contract: plan.provider_instruction_contract ?? null,
      role_instruction_contracts: plan.role_instruction_contracts ?? null,
      orchestration_contract: plan.orchestration_contract ?? null,
      effort_execution_contract: plan.effort_execution_contract ?? null,
      provider_effort_binding: plan.provider_effort_binding ?? null,
      strict_output_contract: plan.strict_output_contract ?? null,
      repair_retry_contract: plan.repair_retry_contract ?? null,
      xhigh_multi_step_contract: plan.xhigh_multi_step_contract ?? null,
      review_quality_benchmark: plan.review_quality_benchmark ?? null,
      owner_baseline_requirement_contract: plan.owner_baseline_requirement_contract ?? null,
      provider_capability_contract: plan.provider_capability_contract ?? null,
      provider_capability_hash: plan.provider_capability_hash ?? null,
      dogfood_metadata: plan.dogfood_metadata ?? null
    },
    package: filteredPackage,
    provider: {
      id: provider.id,
      kind: provider.kind,
      transport: provider.transport,
      raw_provider_response_stored: false
    },
    model: { id: model.id },
    surface: {
      id: surface.id,
      kind: surface.kind ?? null
    },
    execution: {
      id: execution.id,
      execution_path_included: false
    },
    disclosure_policy: {
      approved_transfer_flags: transferFlags.supplied_flags,
      raw_pixels_included: false,
      raw_artifact_content_included: false,
      raw_pixel_bytes_included: false,
      visual_references_included: transferFlags.supplied_flags?.includes('allow-raw-pixels') === true,
      control_metadata_included: true,
      page_text_summary_included: transferFlags.supplied_flags?.includes('allow-page-text') === true,
      dom_summary_included: transferFlags.supplied_flags?.includes('allow-dom-summary') === true,
      url_metadata_included: transferFlags.supplied_flags?.includes('allow-url') === true,
      artifact_references_included: transferFlags.supplied_flags?.includes('allow-artifact-refs') === true,
      accessibility_summary_included: transferFlags.supplied_flags?.includes('allow-accessibility-summary') === true,
      external_evidence_transfer: true,
      mcp_execution_allowed: false
    }
  });
}

function filterReviewPackageForTransfer(reviewPackage, transferFlags) {
  const flags = new Set(transferFlags.supplied_flags ?? []);
  return {
    id: reviewPackage?.id ?? null,
    package_kind: reviewPackage?.package_kind ?? null,
    source: {
      review_id: reviewPackage?.source?.review_id ?? null,
      review_mode: reviewPackage?.source?.review_mode ?? null,
      route: flags.has('allow-url') ? reviewPackage?.source?.route ?? null : null,
      viewport: reviewPackage?.source?.viewport ?? null,
      evidence_classes: reviewPackage?.source?.evidence_classes ?? []
    },
    task: reviewPackage?.task ?? null,
    visual_evidence: flags.has('allow-raw-pixels')
      ? {
          reference_count: reviewPackage?.visual_evidence?.reference_count ?? 0,
          references: reviewPackage?.visual_evidence?.references ?? [],
          raw_pixels_embedded_in_json: false
        }
      : { reference_count: 0, references: [], raw_pixels_embedded_in_json: false },
    visual_evidence_package_v2: flags.has('allow-raw-pixels')
      ? reviewPackage?.visual_evidence_package_v2 ?? null
      : {
          schema_version: SCHEMA_VERSION,
          evidence_package_version: reviewPackage?.visual_evidence_package_v2?.evidence_package_version ?? null,
          reference_count: 0,
          references: [],
          raw_pixel_policy: {
            raw_pixel_bytes_available_from_json: false,
            raw_pixel_bytes_embedded_in_json: false,
            raw_pixel_bytes_read_by_planning: false,
            raw_pixel_bytes_require_explicit_run_transfer_flag: true
          },
          advisory_only: true,
          gate_effect: 'none'
        },
    content_evidence: flags.has('allow-page-text')
      ? reviewPackage?.content_evidence ?? null
      : { text_snippet_count: 0, text_snippets: [], page_text_included_as_bounded_summary: false },
    visible_text_reading_contract: flags.has('allow-page-text')
      ? reviewPackage?.visible_text_reading_contract ?? null
      : {
          schema_version: SCHEMA_VERSION,
          reading_contract_version: reviewPackage?.visible_text_reading_contract?.reading_contract_version ?? null,
          snippet_count: 0,
          bounded_text_snippets: [],
          ocr_boundary: {
            external_ocr_performed: false,
            provider_ocr_allowed_only_after_approved_visual_transfer: true,
            raw_dom_included: false,
            raw_report_body_included: false
          },
          advisory_only: true,
          gate_effect: 'none'
        },
    visible_text_provenance: flags.has('allow-page-text')
      ? reviewPackage?.visible_text_provenance ?? null
      : buildFilteredVisibleTextProvenance(reviewPackage?.visible_text_provenance),
    screen_text_understanding_contract: flags.has('allow-page-text')
      ? reviewPackage?.screen_text_understanding_contract ?? null
      : buildFilteredScreenTextUnderstandingContract(reviewPackage?.screen_text_understanding_contract),
    semantic_evidence: flags.has('allow-accessibility-summary') ? reviewPackage?.semantic_evidence ?? null : null,
    artifact_references: flags.has('allow-artifact-refs') ? reviewPackage?.artifact_references ?? [] : [],
    rubric_profile: reviewPackage?.rubric_profile ?? null,
    evidence_plan: reviewPackage?.evidence_plan ?? null,
    privacy_disclosure_audit: reviewPackage?.privacy_disclosure_audit ?? null,
    existing_review_state: filterExistingReviewState(reviewPackage?.existing_review_state),
    disclosure: {
      raw_pixels_embedded_in_json: false,
      raw_artifact_content_included: false,
      raw_pixel_bytes_included: false,
      visual_references_included: flags.has('allow-raw-pixels')
    }
  };
}

function buildFilteredVisibleTextProvenance(provenance) {
  return {
    schema_version: SCHEMA_VERSION,
    provenance_version: provenance?.provenance_version ?? null,
    source_count: 0,
    sources: [],
    source_separation: {
      page_text_transferred: false,
      local_ocr_performed: false,
      provider_ocr_performed: false,
      raw_dom_included: false,
      raw_report_body_included: false
    },
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildFilteredScreenTextUnderstandingContract(contract) {
  return {
    schema_version: SCHEMA_VERSION,
    contract_version: contract?.contract_version ?? null,
    snippet_count: 0,
    reviewer_tasks: contract?.reviewer_tasks ?? [],
    external_ocr_performed: false,
    provider_ocr_allowed_only_after_approved_visual_transfer: true,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function filterExistingReviewState(existingReviewState) {
  if (!existingReviewState || typeof existingReviewState !== 'object') {
    return null;
  }
  return {
    findings_count: Number(existingReviewState.findings_count ?? 0),
    local_release_gate: existingReviewState.local_release_gate ?? null,
    deterministic_review_hash: existingReviewState.deterministic_review_hash ?? null,
    deterministic_review_path_included: false,
    deterministic_review_mutation_allowed: false
  };
}

function hasEnvKey(env, key) {
  if (!env || !key) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(env, key);
}

function isLiveDogfoodOptInEnabled(context = {}) {
  const env = context.env ?? process.env;
  const value = env[AGENTIC_REVIEW_LIVE_DOGFOOD_ENV];
  return value === '1' || String(value ?? '').toLowerCase() === 'true';
}

function isLoopbackHost(hostname) {
  const host = String(hostname ?? '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

function validateApiEndpointUrl(endpointUrl) {
  if (endpointUrl.username || endpointUrl.password) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_API_ENDPOINT_CREDENTIALS_UNSUPPORTED',
        message: 'The agentic review API endpoint cannot include username or password URL credentials.',
        details: { endpoint_credentials_present: true }
      }
    };
  }
  const sensitiveParams = [];
  for (const key of endpointUrl.searchParams.keys()) {
    if (SENSITIVE_ENDPOINT_QUERY_PARAMS.has(String(key).toLowerCase())) {
      sensitiveParams.push(key);
    }
  }
  if (sensitiveParams.length > 0) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_API_ENDPOINT_SENSITIVE_QUERY_UNSUPPORTED',
        message: 'The agentic review API endpoint cannot include sensitive credential-like query parameters.',
        details: { sensitive_query_params: sensitiveParams }
      }
    };
  }
  return { ok: true };
}

async function readLoopbackAdapterDiagnostics({ response, endpointUrl, maxResponseBytes }) {
  if (!isLoopbackHost(endpointUrl.hostname)) {
    await discardResponseBody(response, maxResponseBytes);
    return {};
  }
  const parsed = await parseBoundedResponse(response, maxResponseBytes);
  if (!parsed.ok) {
    return {
      loopback_adapter_error_observed: false,
      loopback_adapter_response_code: parsed.code,
      loopback_adapter_response_bytes: parsed.response_bytes ?? null
    };
  }
  const value = parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)
    ? parsed.value
    : {};
  const error = value.error && typeof value.error === 'object' && !Array.isArray(value.error)
    ? value.error
    : null;
  if (value.schema_version !== SCHEMA_VERSION
    || typeof error?.code !== 'string'
    || !error.code.startsWith('AHR_RESPONSES_ADAPTER_')) {
    return {
      loopback_adapter_error_observed: false,
      loopback_adapter_response_bytes: parsed.response_bytes ?? null
    };
  }
  return redact({
    loopback_adapter_error_observed: true,
    loopback_adapter_error_code: error.code,
    loopback_adapter_error_message: truncateText(String(error.message ?? ''), 500),
    loopback_adapter_error_details: error.details && typeof error.details === 'object' && !Array.isArray(error.details)
      ? error.details
      : {},
    loopback_adapter_response_bytes: parsed.response_bytes ?? null
  });
}

async function parseBoundedResponse(response, maxResponseBytes) {
  if (response.body && typeof response.body.getReader === 'function') {
    return parseReadableStreamResponse(response.body, maxResponseBytes);
  }
  if (response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
    return parseAsyncIterableResponse(response.body, maxResponseBytes);
  }
  if (typeof response.text === 'function') {
    const text = await response.text();
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > maxResponseBytes) {
      return {
        ok: false,
        code: 'AGENTIC_REVIEW_API_RESPONSE_TOO_LARGE',
        message: 'The agentic review API response exceeds the provider response-size limit.',
        response_bytes: bytes
      };
    }
    try {
      return { ok: true, value: JSON.parse(text), response_bytes: bytes };
    } catch {
      return {
        ok: false,
        code: 'AGENTIC_REVIEW_API_RESPONSE_INVALID_JSON',
        message: 'The agentic review API response was not valid JSON.',
        response_bytes: bytes
      };
    }
  }
  if (typeof response.json === 'function') {
    const value = await response.json();
    const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (bytes > maxResponseBytes) {
      return {
        ok: false,
        code: 'AGENTIC_REVIEW_API_RESPONSE_TOO_LARGE',
        message: 'The agentic review API response exceeds the provider response-size limit.',
        response_bytes: bytes
      };
    }
    return { ok: true, value, response_bytes: bytes };
  }
  return {
    ok: false,
    code: 'AGENTIC_REVIEW_API_RESPONSE_UNREADABLE',
    message: 'The agentic review API response body could not be read.'
  };
}

async function parseReadableStreamResponse(body, maxResponseBytes) {
  const reader = body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      const chunk = Buffer.from(value ?? []);
      bytes += chunk.length;
      if (bytes > maxResponseBytes) {
        await reader.cancel?.();
        return responseTooLarge(bytes);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock?.();
  }
  return parseResponseText(Buffer.concat(chunks).toString('utf8'), bytes);
}

async function parseAsyncIterableResponse(body, maxResponseBytes) {
  const chunks = [];
  let bytes = 0;
  for await (const value of body) {
    const chunk = typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value ?? []);
    bytes += chunk.length;
    if (bytes > maxResponseBytes) {
      return responseTooLarge(bytes);
    }
    chunks.push(chunk);
  }
  return parseResponseText(Buffer.concat(chunks).toString('utf8'), bytes);
}

function parseResponseText(text, bytes = Buffer.byteLength(text, 'utf8')) {
  try {
    return { ok: true, value: JSON.parse(text), response_bytes: bytes };
  } catch {
    return {
      ok: false,
      code: 'AGENTIC_REVIEW_API_RESPONSE_INVALID_JSON',
      message: 'The agentic review API response was not valid JSON.',
      response_bytes: bytes
    };
  }
}

function responseTooLarge(responseBytes) {
  return {
    ok: false,
    code: 'AGENTIC_REVIEW_API_RESPONSE_TOO_LARGE',
    message: 'The agentic review API response exceeds the provider response-size limit.',
    response_bytes: responseBytes
  };
}

async function discardResponseBody(response, maxResponseBytes) {
  try {
    await parseBoundedResponse(response, maxResponseBytes);
  } catch {
    // Discard failures are intentionally ignored; raw responses are never stored.
  }
}

function providerFailure({
  status,
  code,
  message,
  details,
  provider,
  providerCallPerformed = false,
  apiCallPerformed = false,
  externalEvidenceTransfer = false
}) {
  const diagnosticDetails = redact(details ?? {});
  return {
    ok: false,
    status,
    error: { code, message, details: diagnosticDetails },
    failure_diagnostics: {
      schema_version: SCHEMA_VERSION,
      diagnostic_version: '1.0.0',
      stage: diagnosticStageForCode(code),
      code,
      provider_id: provider?.id ?? null,
      status,
      message,
      details: diagnosticDetails,
      next_actions: providerFailureNextActions(code),
      provider_call_performed: Boolean(providerCallPerformed),
      api_call_performed: Boolean(apiCallPerformed),
      external_evidence_transfer: Boolean(externalEvidenceTransfer),
      credential_values_recorded: false,
      raw_provider_response_stored: false,
      advisory_only: true,
      gate_effect: 'none'
    },
    boundary: providerBoundary({
      provider,
      providerCallPerformed,
      apiCallPerformed,
      externalEvidenceTransfer
    }),
    warnings: []
  };
}

function diagnosticStageForCode(code) {
  if (/CONFIGURATION|ENDPOINT|FETCH/.test(code)) {
    return 'setup';
  }
  if (/REQUEST|TIMEOUT/.test(code)) {
    return 'request';
  }
  if (/RESPONSE|JSON/.test(code)) {
    return 'response';
  }
  return 'provider';
}

function providerFailureNextActions(code) {
  if (/CONFIGURATION/.test(code)) {
    return [
      'Configure endpoint and credential environment variables for the selected provider.',
      'Run dogfood readiness before retrying the approved plan.'
    ];
  }
  if (/ENDPOINT/.test(code)) {
    return [
      'Use an https endpoint or explicit loopback http endpoint.',
      'Remove URL credentials, sensitive query parameters, and redirect-dependent endpoints.'
    ];
  }
  if (/REQUEST_TOO_LARGE/.test(code)) {
    return ['Reduce approved transfer classes or lower package size before retrying.'];
  }
  if (/RESPONSE_TOO_LARGE|INVALID_JSON|RESPONSE_NOT_OK/.test(code)) {
    return ['Check provider output formatting and size limits without storing raw response bodies.'];
  }
  if (/TIMEOUT/.test(code)) {
    return ['Increase the configured timeout or retry with a smaller approved evidence package.'];
  }
  return ['Inspect the advisory-safe diagnostics and retry only after preserving the approved plan boundary.'];
}

function redactExactSecrets(value, secrets) {
  const filtered = secrets.filter(Boolean).map(String);
  if (typeof value === 'string') {
    return filtered.reduce((text, secret) => text.split(secret).join('[REDACTED]'), truncateText(value, 2000));
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactExactSecrets(item, filtered));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactExactSecrets(item, filtered)]));
  }
  return value;
}

function uniqueSorted(values) {
  return [...new Set(Array.isArray(values) ? values.map((item) => String(item)) : [])].sort();
}

function canonicalStringify(value) {
  return JSON.stringify(sortForJson(value));
}

function sortForJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortForJson);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortForJson(value[key])])
  );
}
