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
      quality_signals: { type: 'object' },
      evidence_summary: { type: 'object' },
      artifact_index: { type: 'object' },
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
