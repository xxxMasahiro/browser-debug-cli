import { SCHEMA_VERSION } from './constants.js';

const baseEnvelopeProperties = {
  schema_version: { type: 'string' },
  command: { type: 'string' },
  status: { enum: ['ok', 'error'] },
  observed_at: { type: 'string' },
  data: { type: 'object' },
  warnings: { type: 'array' },
  errors: { type: 'array' },
  artifacts: { type: 'array' }
};

const artifactProperties = {
  schema_version: { type: 'string' },
  type: { type: 'string' },
  path: { type: 'string' },
  description: { type: 'string' }
};

const schemas = Object.freeze({
  envelope: Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://browser-debug.local/schemas/envelope.schema.json',
    title: 'Browser Debug CLI Envelope',
    type: 'object',
    required: ['schema_version', 'command', 'status', 'observed_at', 'data', 'warnings', 'errors', 'artifacts'],
    properties: baseEnvelopeProperties,
    additionalProperties: true
  }),
  artifact: Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://browser-debug.local/schemas/artifact.schema.json',
    title: 'Browser Debug CLI Artifact',
    type: 'object',
    required: ['schema_version', 'type', 'path', 'description'],
    properties: artifactProperties,
    additionalProperties: true
  }),
  finding: Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://browser-debug.local/schemas/finding.schema.json',
    title: 'Browser Debug CLI Review Finding',
    type: 'object',
    required: ['id', 'category', 'severity', 'confidence', 'source', 'message', 'evidence', 'artifacts', 'repro'],
    properties: {
      id: { type: 'string' },
      category: {
        enum: [
          'browser_health',
          'layout_integrity',
          'interaction_quality',
          'accessibility_basics',
          'mock_fidelity',
          'evidence_quality'
        ]
      },
      severity: { enum: ['info', 'low', 'medium', 'high', 'critical'] },
      confidence: { enum: ['low', 'medium', 'high'] },
      source: { enum: ['deterministic', 'heuristic', 'model_advisory', 'owner_required'] },
      selector: { type: ['string', 'null'] },
      rect: { type: ['object', 'null'] },
      route: { type: ['string', 'null'] },
      viewport: { type: ['object', 'null'] },
      message: { type: 'string' },
      evidence: { type: 'object' },
      artifacts: { type: 'array' },
      repro: { type: 'array' },
      priority: { type: 'string' },
      impact: { type: 'string' },
      recommendation: { type: 'string' },
      fix_candidates: { type: 'array' },
      implementation_notes: { type: 'object' },
      owner_decision_required: { type: 'boolean' }
    },
    additionalProperties: true
  }),
  target_manifest: Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://browser-debug.local/schemas/target-manifest.schema.json',
    title: 'Browser Debug CLI Target Manifest',
    type: 'object',
    required: ['baseUrl'],
    properties: {
      baseUrl: { type: 'string' },
      schemaVersion: { type: 'string' },
      name: { type: 'string' },
      scope: { type: 'object' },
      seeds: { type: 'array', items: { type: 'string' } },
      expectedRoutes: { type: 'array', items: { type: 'string' } },
      pages: { type: 'array' },
      sourceData: { type: 'array' },
      localContentUxAdvisory: { type: 'object' },
      viewportMatrix: { type: 'array' },
      actionPolicy: { type: 'object' },
      budgets: { type: 'object' },
      artifacts: { type: 'object' },
      masks: { type: 'array' },
      regions: { type: 'array' },
      appHints: { type: 'object' }
    },
    additionalProperties: true
  }),
  agent_surface: Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://browser-debug.local/schemas/agent-surface.schema.json',
    title: 'Browser Debug CLI Agent Surface',
    type: 'object',
    required: ['id', 'kind', 'transport', 'status', 'external_evidence_transfer', 'credential_mode', 'implemented'],
    properties: {
      id: { type: 'string' },
      display_name: { type: 'string' },
      kind: { enum: ['subscription_surface', 'api_provider'] },
      transport: { type: 'string' },
      status: { enum: ['available', 'approval_required', 'disabled'] },
      automation: { type: 'string' },
      external_evidence_transfer: { type: 'boolean' },
      credential_mode: { type: 'string' },
      implemented: { type: 'boolean' },
      capabilities: { type: 'array' },
      boundaries: { type: 'object' },
      approval_required_for: { type: 'array' }
    },
    additionalProperties: true
  }),
  agent_task_package: Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://browser-debug.local/schemas/agent-task-package.schema.json',
    title: 'Browser Debug CLI Agent Task Package',
    type: 'object',
    required: ['schema_version', 'id', 'task', 'status', 'created_at', 'surface', 'source', 'disclosure_policy', 'evidence_packet', 'boundary'],
    properties: {
      schema_version: { type: 'string' },
      id: { type: 'string' },
      task: { type: 'string' },
      status: { enum: ['ready', 'error'] },
      created_at: { type: 'string' },
      surface: { type: 'object' },
      source: { type: 'object' },
      disclosure_policy: { type: 'object' },
      evidence_packet: { type: 'object' },
      prompt: { type: 'object' },
      boundary: { type: 'object' }
    },
    additionalProperties: true
  }),
  agent_request_status: Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://browser-debug.local/schemas/agent-request-status.schema.json',
    title: 'Browser Debug CLI Agent Request Status',
    type: 'object',
    required: ['schema_version', 'package_id', 'package_path', 'status', 'gate_effect', 'api_call_performed', 'automatic_upload', 'existing_review_mutated'],
    properties: {
      schema_version: { type: 'string' },
      package_id: { type: ['string', 'null'] },
      package_path: { type: 'string' },
      prompt_path: { type: ['string', 'null'] },
      receipt_path: { type: ['string', 'null'] },
      review_artifact_index_path: { type: ['string', 'null'] },
      review_id: { type: ['string', 'null'] },
      task: { type: ['string', 'null'] },
      status: { enum: ['waiting_for_agent', 'advisory_imported'] },
      created_at: { type: ['string', 'null'] },
      surface: { type: ['object', 'null'] },
      result_paths: { type: 'array' },
      latest_result_path: { type: ['string', 'null'] },
      advisory_findings: { type: 'number' },
      owner_decision_requests: { type: 'number' },
      gate_effect: { enum: ['none'] },
      external_evidence_transfer: { type: 'boolean' },
      api_call_performed: { type: 'boolean' },
      automatic_upload: { type: 'boolean' },
      existing_review_mutated: { type: 'boolean' },
      next_step: { type: 'string' }
    },
    additionalProperties: true
  }),
  agent_request_detail: Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://browser-debug.local/schemas/agent-request-detail.schema.json',
    title: 'Browser Debug CLI Agent Request Detail',
    type: 'object',
    required: ['schema_version', 'package_id', 'package_path', 'status', 'gate_effect', 'api_call_performed', 'automatic_upload', 'existing_review_mutated'],
    properties: {
      schema_version: { type: 'string' },
      package_id: { type: ['string', 'null'] },
      package_path: { type: 'string' },
      prompt_path: { type: ['string', 'null'] },
      receipt_path: { type: ['string', 'null'] },
      status: { enum: ['waiting_for_agent', 'advisory_imported'] },
      selected_result_path: { type: ['string', 'null'] },
      latest_result_path: { type: ['string', 'null'] },
      result_paths: { type: 'array' },
      created_at: { type: ['string', 'null'] },
      task: { type: ['string', 'null'] },
      surface: { type: ['object', 'null'] },
      source: { type: 'object' },
      package_summary: { type: 'object' },
      agent_advisory_summary: { type: ['object', 'null'] },
      dashboard_handoff: { type: 'object' },
      gate_effect: { enum: ['none'] },
      external_evidence_transfer: { type: 'boolean' },
      api_call_performed: { type: 'boolean' },
      automatic_upload: { type: 'boolean' },
      existing_review_mutated: { type: 'boolean' }
    },
    additionalProperties: true
  }),
  agent_workflow: Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://browser-debug.local/schemas/agent-workflow.schema.json',
    title: 'Browser Debug CLI Agent Workflow',
    type: 'object',
    required: ['schema_version', 'id', 'status', 'workflow_path', 'package_path', 'steps', 'dashboard_handoff', 'provider_boundary', 'gate_effect', 'api_call_performed', 'automatic_upload', 'existing_review_mutated'],
    properties: {
      schema_version: { type: 'string' },
      id: { type: 'string' },
      name: { type: 'string' },
      status: { enum: ['waiting_for_agent', 'advisory_imported', 'package_missing'] },
      created_at: { type: ['string', 'null'] },
      updated_at: { type: ['string', 'null'] },
      evaluated_at: { type: 'string' },
      workflow_path: { type: 'string' },
      workflow_receipt_path: { type: ['string', 'null'] },
      package_id: { type: ['string', 'null'] },
      package_path: { type: ['string', 'null'] },
      prompt_path: { type: ['string', 'null'] },
      receipt_path: { type: ['string', 'null'] },
      review_artifact_index_path: { type: ['string', 'null'] },
      review_id: { type: ['string', 'null'] },
      task: { type: ['string', 'null'] },
      surface: { type: ['object', 'null'] },
      latest_result_path: { type: ['string', 'null'] },
      result_paths: { type: 'array' },
      report_paths: { type: 'array' },
      advisory_findings: { type: 'number' },
      owner_decision_requests: { type: 'number' },
      steps: { type: 'object' },
      dashboard_handoff: { type: 'object' },
      request_status: { type: ['object', 'null'] },
      request_detail: { type: ['object', 'null'] },
      provider_boundary: { type: 'object' },
      gate_effect: { enum: ['none'] },
      external_evidence_transfer: { type: 'boolean' },
      api_call_performed: { type: 'boolean' },
      automatic_upload: { type: 'boolean' },
      existing_review_mutated: { type: 'boolean' },
      boundary: { type: 'object' }
    },
    additionalProperties: true
  }),
  agent_advisory_result: Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://browser-debug.local/schemas/agent-advisory-result.schema.json',
    title: 'Browser Debug CLI Agent Advisory Result',
    type: 'object',
    required: ['schema_version', 'id', 'agent_advisory', 'agent_advisory_findings', 'agent_advisory_action_plan', 'agent_advisory_readiness', 'boundary'],
    properties: {
      schema_version: { type: 'string' },
      id: { type: 'string' },
      package_id: { type: ['string', 'null'] },
      package_path: { type: 'string' },
      imported_at: { type: 'string' },
      agent_advisory: { type: 'object' },
      agent_advisory_findings: { type: 'array' },
      agent_advisory_action_plan: { type: 'object' },
      agent_advisory_readiness: { type: 'object' },
      owner_decision_requests: { type: 'array' },
      warnings: { type: 'array' },
      boundary: { type: 'object' }
    },
    additionalProperties: true
  }),
  agent_disclosure_policy: Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://browser-debug.local/schemas/agent-disclosure-policy.schema.json',
    title: 'Browser Debug CLI Agent Disclosure Policy',
    type: 'object',
    required: ['scope', 'raw_artifact_content_included', 'external_evidence_transfer', 'redaction_applied'],
    properties: {
      scope: { type: 'string' },
      raw_artifact_content_included: { type: 'boolean' },
      raw_dom_included: { type: 'boolean' },
      trace_content_included: { type: 'boolean' },
      screenshot_binary_included: { type: 'boolean' },
      console_payloads_included: { type: 'boolean' },
      network_payloads_included: { type: 'boolean' },
      source_data_values_included: { type: 'boolean' },
      local_artifact_paths_included: { type: 'boolean' },
      external_evidence_transfer: { type: 'boolean' },
      requires_owner_review_before_external_transfer: { type: 'boolean' },
      redaction_applied: { type: 'boolean' }
    },
    additionalProperties: true
  }),
  review: Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://browser-debug.local/schemas/review.schema.json',
    title: 'Browser Debug CLI Review Result',
    type: 'object',
    required: ['review', 'findings', 'metrics', 'environment'],
    properties: {
      review: { type: 'object' },
      findings: { type: 'array', items: { $ref: 'finding.schema.json' } },
      metrics: { type: 'object' },
      action_plan: { type: 'object' },
      review_advisory: { type: 'object' },
      manifest_suggestions: { type: 'array' },
      local_content_ux_advisory: { type: 'object' },
      content_ux_findings: { type: 'array' },
      content_ux_action_plan: { type: 'object' },
      content_ux_readiness: { type: 'object' },
      content_ux_page_handoff: { type: 'object' },
      content_ux_manifest_authoring: { type: 'object' },
      content_ux_review_brief: { type: 'object' },
      content_ux_rubric_evaluation: { type: 'object' },
      quality_signals: { type: 'object' },
      resource_guard: { type: 'object' },
      evidence_summary: { type: 'object' },
      artifact_index: { type: 'object' },
      agent_advisory: { type: 'object' },
      agent_advisory_findings: { type: 'array' },
      agent_advisory_action_plan: { type: 'object' },
      agent_advisory_readiness: { type: 'object' },
      environment: { type: 'object' },
      coverage: { type: 'object' }
    },
    additionalProperties: true
  }),
  mcp_tool: Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://browser-debug.local/schemas/mcp-tool.schema.json',
    title: 'Browser Debug CLI MCP Tool Contract',
    type: 'object',
    required: ['name', 'description', 'inputSchema'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      inputSchema: { type: 'object' }
    },
    additionalProperties: true
  })
});

export function listSchemas() {
  return Object.keys(schemas).map((name) => ({
    name,
    schema_version: SCHEMA_VERSION,
    id: schemas[name].$id,
    title: schemas[name].title
  }));
}

export function getSchema(name) {
  return schemas[name] ?? null;
}

export function schemaNames() {
  return Object.keys(schemas);
}

export function schemaResult(name) {
  const schema = getSchema(name);
  if (!schema) {
    return {
      status: 'error',
      data: {},
      warnings: [],
      errors: [{
        code: 'SCHEMA_NOT_FOUND',
        message: `Unknown schema: ${name}`,
        details: { schema: name, available: schemaNames() }
      }],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: { schema },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

export function schemaListResult() {
  return {
    status: 'ok',
    data: { schemas: listSchemas() },
    warnings: [],
    errors: [],
    artifacts: []
  };
}
