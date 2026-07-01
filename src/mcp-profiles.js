export const DEFAULT_MCP_PROFILE = 'full';
export const MCP_PROFILE_NAMES = Object.freeze(['safe', 'full', 'admin']);

export const MCP_TOOL_TAGS = Object.freeze({
  AGENT_EXECUTION_STATUS_READ: 'agent_execution_status_read',
  AGENT_EXECUTION_LIST_READ: 'agent_execution_list_read',
  AGENT_EXECUTION_PLAN_WRITE: 'agent_execution_plan_write',
  AGENT_EXECUTION_RUN_EXECUTE: 'agent_execution_run_execute',
  PROVIDER_STATUS_LIST_READ: 'provider_status_list_read',
  PROVIDER_EXECUTION_ADMIN: 'provider_execution_admin',
  BOUNDED_SUPERVISE_FULL: 'bounded_supervise_full',
  PERSISTENT_SESSION_ADMIN: 'persistent_session_admin'
});

const SAFE_PROFILE_TOOLS = Object.freeze([
  'browser_debug_doctor',
  'browser_debug_target_validate',
  'browser_debug_resource_status',
  'browser_debug_resource_artifacts_plan',
  'browser_debug_agent_surfaces_list',
  'browser_debug_agent_requests_list',
  'browser_debug_agent_requests_show',
  'browser_debug_agent_workflow_status',
  'browser_debug_agent_workflow_index',
  'browser_debug_agent_execution_status',
  'browser_debug_agent_execution_list',
  'browser_debug_visual_review_dashboard',
  'browser_debug_capture_readiness',
  'browser_debug_capture_plan',
  'browser_debug_language_settings',
  'browser_debug_localization_resources',
  'browser_debug_report_templates',
  'browser_debug_translation_readiness',
  'browser_debug_release_readiness',
  'browser_debug_artifact_root_status',
  'browser_debug_legacy_alias_audit',
  'browser_debug_legacy_alias_removal_readiness',
  'browser_debug_shell_readiness',
  'browser_debug_final_readiness',
  'browser_debug_mcp_execution_gates',
  'browser_debug_mcp_capabilities',
  'browser_debug_operation_registry',
  'browser_debug_operation_roadmap',
  'browser_debug_operation_contracts',
  'browser_debug_operation_policy',
  'browser_debug_operation_admin_readiness',
  'browser_debug_operation_provider_readiness',
  'browser_debug_schema_list',
  'browser_debug_schema_get'
]);

const FULL_PROFILE_TOOLS = Object.freeze([
  'browser_debug_doctor',
  'browser_debug_observe',
  'browser_debug_supervise',
  'browser_debug_review',
  'browser_debug_target_init',
  'browser_debug_target_validate',
  'browser_debug_resource_status',
  'browser_debug_resource_artifacts_plan',
  'browser_debug_agent_surfaces_list',
  'browser_debug_agent_requests_list',
  'browser_debug_agent_requests_show',
  'browser_debug_agent_workflow_status',
  'browser_debug_agent_workflow_index',
  'browser_debug_agent_execution_status',
  'browser_debug_agent_execution_list',
  'browser_debug_visual_review_dashboard',
  'browser_debug_capture_readiness',
  'browser_debug_capture_plan',
  'browser_debug_language_settings',
  'browser_debug_localization_resources',
  'browser_debug_report_templates',
  'browser_debug_translation_readiness',
  'browser_debug_release_readiness',
  'browser_debug_artifact_root_status',
  'browser_debug_legacy_alias_audit',
  'browser_debug_legacy_alias_removal_readiness',
  'browser_debug_shell_readiness',
  'browser_debug_final_readiness',
  'browser_debug_mcp_execution_gates',
  'browser_debug_mcp_capabilities',
  'browser_debug_operation_registry',
  'browser_debug_operation_roadmap',
  'browser_debug_operation_contracts',
  'browser_debug_operation_policy',
  'browser_debug_operation_admin_readiness',
  'browser_debug_operation_provider_readiness',
  'browser_debug_review_target',
  'browser_debug_schema_list',
  'browser_debug_schema_get'
]);

const ADMIN_PROFILE_TOOLS = Object.freeze([
  ...FULL_PROFILE_TOOLS,
  'browser_debug_session_start',
  'browser_debug_session_status',
  'browser_debug_session_stop',
  'browser_debug_session_act',
  'browser_debug_session_observe',
  'browser_debug_session_checkpoint',
  'browser_debug_session_review',
  'browser_debug_agent_execution_plan',
  'browser_debug_agent_execution_run'
]);

export const MCP_PROFILES = Object.freeze({
  safe: Object.freeze({
    name: 'safe',
    description: 'No-browser/no-delete/no-provider MCP surface for discovery and local read-only planning.',
    tools: SAFE_PROFILE_TOOLS,
    boundaries: Object.freeze({
      browser_launched: false,
      writes_artifacts: false,
      deletes_files: false,
      provider_call: false,
      shell_used: false,
      external_listener: false
    })
  }),
  full: Object.freeze({
    name: 'full',
    description: 'Compatibility MCP surface for local observe, review, target, schema, and planning workflows.',
    tools: FULL_PROFILE_TOOLS,
    boundaries: Object.freeze({
      browser_launched: true,
      writes_artifacts: true,
      deletes_files: false,
      provider_call: false,
      shell_used: false,
      external_listener: false
    })
  }),
  admin: Object.freeze({
    name: 'admin',
    description: 'Explicit local-maintenance MCP profile with approved admin-only agent execution plan/run tools.',
    tools: ADMIN_PROFILE_TOOLS,
    boundaries: Object.freeze({
      browser_launched: true,
      writes_artifacts: true,
      deletes_files: false,
      provider_call: true,
      shell_used: false,
      external_listener: false
    })
  })
});

const TOOL_REGISTRY = Object.freeze([
  {
    name: 'browser_debug_doctor',
    minimumProfile: 'safe',
    description: 'Run TraceCue doctor and return the standard JSON envelope.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    effects: effects({ browserLaunched: false, writesArtifacts: false }),
    toCliArgs: () => ['doctor', '--json']
  },
  {
    name: 'browser_debug_observe',
    minimumProfile: 'full',
    description: 'Observe one approved URL with local Playwright evidence.',
    inputSchema: {
      type: 'object',
      required: ['url'],
      additionalProperties: false,
      properties: {
        url: { type: 'string' },
        screenshot: { type: 'boolean' },
        trace: { type: 'boolean' },
        timeout: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: true, writesArtifacts: true }),
    toCliArgs: (args) => withCommonOptions(['observe', '--url', args.url], args)
  },
  {
    name: 'browser_debug_supervise',
    minimumProfile: 'full',
    description: 'Run bounded ordered browser actions in one ephemeral local context, then close the browser.',
    tags: [MCP_TOOL_TAGS.BOUNDED_SUPERVISE_FULL],
    inputSchema: {
      type: 'object',
      required: ['url'],
      additionalProperties: false,
      properties: {
        url: { type: 'string' },
        actions: {
          type: 'array',
          maxItems: 25,
          items: { type: 'object' }
        },
        screenshot: { type: 'boolean' },
        trace: { type: 'boolean' },
        timeout: { type: 'string' },
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: true, writesArtifacts: true }),
    validate: validateBoundedSuperviseArgs,
    toCliArgs: (args) => {
      const output = ['supervise', '--url', args.url];
      if (args.actions !== undefined) {
        output.push('--actions', JSON.stringify(args.actions));
      }
      if (args.artifactRoot !== undefined) {
        output.push('--artifact-root', String(args.artifactRoot));
      }
      return withCommonOptions(output, args);
    }
  },
  {
    name: 'browser_debug_review',
    minimumProfile: 'full',
    description: 'Run a deterministic local browser review for one URL.',
    inputSchema: {
      type: 'object',
      required: ['url'],
      additionalProperties: false,
      properties: {
        url: { type: 'string' },
        viewport: { type: 'string' },
        screenshot: { type: 'boolean' },
        report: { type: 'boolean' },
        timeout: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: true, writesArtifacts: true }),
    toCliArgs: (args) => withCommonOptions(['review', '--url', args.url], args)
  },
  {
    name: 'browser_debug_target_init',
    minimumProfile: 'full',
    description: 'Create a local target manifest artifact for manifest-driven review.',
    inputSchema: {
      type: 'object',
      required: ['url'],
      additionalProperties: false,
      properties: {
        url: { type: 'string' },
        name: { type: 'string' },
        viewport: { type: 'string' },
        maxRoutes: { type: 'number' },
        timeout: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: true }),
    toCliArgs: (args) => {
      const output = withCommonOptions(['target', 'init', '--url', args.url], args);
      if (args.name) {
        output.splice(-1, 0, '--name', String(args.name));
      }
      if (args.maxRoutes !== undefined) {
        output.splice(-1, 0, '--max-routes', String(args.maxRoutes));
      }
      return output;
    }
  },
  {
    name: 'browser_debug_target_validate',
    minimumProfile: 'safe',
    description: 'Validate a local target manifest without launching a browser.',
    inputSchema: {
      type: 'object',
      required: ['target'],
      additionalProperties: false,
      properties: {
        target: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false }),
    toCliArgs: (args) => ['target', 'validate', '--target', args.target, '--json']
  },
  {
    name: 'browser_debug_resource_status',
    minimumProfile: 'safe',
    description: 'Report local memory, swap, cgroup, and pressure signals without launching a browser.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    effects: effects({ browserLaunched: false, writesArtifacts: false }),
    toCliArgs: () => ['resource', 'status', '--json']
  },
  {
    name: 'browser_debug_resource_artifacts_plan',
    minimumProfile: 'safe',
    description: 'Report local TraceCue artifact size and cleanup candidates without deleting files.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        maxBytes: { type: 'string' },
        olderThan: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false }),
    validate: (args) => validateExactRequiredStrings(args, ['maxBytes', 'olderThan'], []),
    toCliArgs: (args) => {
      const output = ['resource', 'artifacts', 'plan'];
      if (args.maxBytes !== undefined) {
        output.push('--max-bytes', String(args.maxBytes));
      }
      if (args.olderThan !== undefined) {
        output.push('--older-than', String(args.olderThan));
      }
      output.push('--json');
      return output;
    }
  },
  {
    name: 'browser_debug_agent_surfaces_list',
    minimumProfile: 'safe',
    description: 'List local agent advisory surfaces without launching a browser or calling providers.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    effects: effects({ browserLaunched: false, writesArtifacts: false }),
    toCliArgs: () => ['agent', 'surfaces', 'list', '--json']
  },
  {
    name: 'browser_debug_agent_requests_list',
    minimumProfile: 'safe',
    description: 'List local agent advisory package/request status without writing artifacts.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        package: { type: 'string' },
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false }),
    toCliArgs: (args) => withOptionalOptions(['agent', 'requests', 'list'], args, {
      package: '--package',
      artifactRoot: '--artifact-root'
    })
  },
  {
    name: 'browser_debug_agent_requests_show',
    minimumProfile: 'safe',
    description: 'Show one local agent advisory request detail without writing artifacts.',
    inputSchema: {
      type: 'object',
      required: ['package'],
      additionalProperties: false,
      properties: {
        package: { type: 'string' },
        agentResult: { type: 'string' },
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false }),
    toCliArgs: (args) => withOptionalOptions(['agent', 'requests', 'show'], args, {
      package: '--package',
      agentResult: '--agent-result',
      artifactRoot: '--artifact-root'
    })
  },
  {
    name: 'browser_debug_agent_workflow_status',
    minimumProfile: 'safe',
    description: 'Read local agent workflow status without writing artifacts or calling providers.',
    inputSchema: {
      type: 'object',
      required: ['workflow'],
      additionalProperties: false,
      properties: {
        workflow: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false }),
    toCliArgs: (args) => ['agent', 'workflow', 'status', '--workflow', args.workflow, '--json']
  },
  {
    name: 'browser_debug_agent_workflow_index',
    minimumProfile: 'safe',
    description: 'Index local agent workflows without writing artifacts or calling providers.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false }),
    toCliArgs: (args) => withOptionalOptions(['agent', 'workflow', 'index'], args, {
      artifactRoot: '--artifact-root'
    })
  },
  {
    name: 'browser_debug_agent_execution_status',
    minimumProfile: 'safe',
    description: 'Read local agent execution status without executing providers.',
    tags: [
      MCP_TOOL_TAGS.AGENT_EXECUTION_STATUS_READ,
      MCP_TOOL_TAGS.PROVIDER_STATUS_LIST_READ
    ],
    inputSchema: {
      type: 'object',
      required: ['execution'],
      additionalProperties: false,
      properties: {
        execution: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    toCliArgs: (args) => ['agent', 'execution', 'status', '--execution', args.execution, '--json']
  },
  {
    name: 'browser_debug_agent_execution_list',
    minimumProfile: 'safe',
    description: 'List local agent execution metadata without executing providers.',
    tags: [
      MCP_TOOL_TAGS.AGENT_EXECUTION_LIST_READ,
      MCP_TOOL_TAGS.PROVIDER_STATUS_LIST_READ
    ],
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    toCliArgs: (args) => withOptionalOptions(['agent', 'execution', 'list'], args, {
      artifactRoot: '--artifact-root'
    })
  },
  {
    name: 'browser_debug_session_start',
    minimumProfile: 'admin',
    description: 'Start an admin-only local persistent browser session with TTL, idle timeout, and origin allowlist boundaries.',
    tags: [MCP_TOOL_TAGS.PERSISTENT_SESSION_ADMIN],
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        url: { type: 'string' },
        ttl: { type: 'string' },
        idleTimeout: { type: 'string' },
        timeout: { type: 'string' },
        headed: { type: 'boolean' },
        manualCheckpoint: { type: 'string' },
        originAllowlist: { type: 'string' },
        storageState: { type: 'string' },
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: true, writesArtifacts: true }),
    validate: validateSessionStartArgs,
    toCliArgs: (args) => sessionStartCliArgs(args)
  },
  {
    name: 'browser_debug_session_status',
    minimumProfile: 'admin',
    description: 'Read admin-only local persistent browser session status.',
    tags: [MCP_TOOL_TAGS.PERSISTENT_SESSION_ADMIN],
    inputSchema: {
      type: 'object',
      required: ['session'],
      additionalProperties: false,
      properties: {
        session: { type: 'string' },
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false }),
    validate: (args) => validateExactRequiredStrings(args, ['session', 'artifactRoot'], ['session']),
    toCliArgs: (args) => withOptionalOptions(['session', 'status', '--session', args.session], args, {
      artifactRoot: '--artifact-root'
    })
  },
  {
    name: 'browser_debug_session_stop',
    minimumProfile: 'admin',
    description: 'Stop an admin-only local persistent browser session owned by TraceCue.',
    tags: [MCP_TOOL_TAGS.PERSISTENT_SESSION_ADMIN],
    inputSchema: {
      type: 'object',
      required: ['session'],
      additionalProperties: false,
      properties: {
        session: { type: 'string' },
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: true }),
    validate: (args) => validateExactRequiredStrings(args, ['session', 'artifactRoot'], ['session']),
    toCliArgs: (args) => withOptionalOptions(['session', 'stop', '--session', args.session], args, {
      artifactRoot: '--artifact-root'
    })
  },
  {
    name: 'browser_debug_session_act',
    minimumProfile: 'admin',
    description: 'Apply one bounded action to an admin-only persistent browser session.',
    tags: [MCP_TOOL_TAGS.PERSISTENT_SESSION_ADMIN],
    inputSchema: {
      type: 'object',
      required: ['session', 'action'],
      additionalProperties: false,
      properties: {
        session: { type: 'string' },
        action: { type: 'object' },
        screenshot: { type: 'boolean' },
        timeout: { type: 'string' },
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: true, writesArtifacts: true }),
    validate: validateSessionActionArgs,
    toCliArgs: (args) => {
      const output = ['session', 'act', '--session', args.session, '--action', JSON.stringify(args.action)];
      if (args.artifactRoot !== undefined) {
        output.push('--artifact-root', String(args.artifactRoot));
      }
      return withCommonOptions(output, args);
    }
  },
  {
    name: 'browser_debug_session_observe',
    minimumProfile: 'admin',
    description: 'Observe the current page state of an admin-only persistent browser session.',
    tags: [MCP_TOOL_TAGS.PERSISTENT_SESSION_ADMIN],
    inputSchema: {
      type: 'object',
      required: ['session'],
      additionalProperties: false,
      properties: {
        session: { type: 'string' },
        screenshot: { type: 'boolean' },
        timeout: { type: 'string' },
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: true, writesArtifacts: true }),
    validate: (args) => validateSessionCommonArgs(args, ['session', 'screenshot', 'timeout', 'artifactRoot'], ['session']),
    toCliArgs: (args) => withCommonOptions(withOptionalOptionsBase(['session', 'observe', '--session', args.session], args, {
      artifactRoot: '--artifact-root'
    }), args)
  },
  {
    name: 'browser_debug_session_checkpoint',
    minimumProfile: 'admin',
    description: 'Record a manual-login checkpoint for an admin-only persistent browser session and optionally export storageState.',
    tags: [MCP_TOOL_TAGS.PERSISTENT_SESSION_ADMIN],
    inputSchema: {
      type: 'object',
      required: ['session', 'name'],
      additionalProperties: false,
      properties: {
        session: { type: 'string' },
        name: { type: 'string' },
        untilUrl: { type: 'string' },
        untilSelector: { type: 'string' },
        exportStorageState: { type: 'boolean' },
        timeout: { type: 'string' },
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: true, writesArtifacts: true }),
    validate: validateSessionCheckpointArgs,
    toCliArgs: (args) => sessionCheckpointCliArgs(args)
  },
  {
    name: 'browser_debug_session_review',
    minimumProfile: 'admin',
    description: 'Create a local review handoff artifact index from an admin-only persistent browser session.',
    tags: [MCP_TOOL_TAGS.PERSISTENT_SESSION_ADMIN],
    inputSchema: {
      type: 'object',
      required: ['session'],
      additionalProperties: false,
      properties: {
        session: { type: 'string' },
        screenshot: { type: 'boolean' },
        report: { type: 'boolean' },
        timeout: { type: 'string' },
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: true, writesArtifacts: true }),
    validate: (args) => validateSessionCommonArgs(args, ['session', 'screenshot', 'report', 'timeout', 'artifactRoot'], ['session']),
    toCliArgs: (args) => withCommonOptions(withOptionalOptionsBase(['session', 'review', '--session', args.session], args, {
      artifactRoot: '--artifact-root'
    }), args)
  },
  {
    name: 'browser_debug_agent_execution_plan',
    minimumProfile: 'admin',
    description: 'Create an admin-only local dry-run agent execution plan through MCP without executing providers.',
    tags: [
      MCP_TOOL_TAGS.AGENT_EXECUTION_PLAN_WRITE,
      MCP_TOOL_TAGS.PROVIDER_EXECUTION_ADMIN
    ],
    inputSchema: {
      type: 'object',
      required: ['package', 'surface', 'provider', 'model', 'idempotencyKey'],
      additionalProperties: false,
      properties: {
        package: { type: 'string' },
        surface: { type: 'string' },
        provider: { type: 'string' },
        model: { type: 'string' },
        idempotencyKey: { type: 'string' },
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: true, providerCall: false }),
    validate: (args) => validateExactRequiredStrings(args, [
      'package',
      'surface',
      'provider',
      'model',
      'idempotencyKey',
      'artifactRoot'
    ], ['package', 'surface', 'provider', 'model', 'idempotencyKey']),
    toCliArgs: (args) => withOptionalOptions(['agent', 'execution', 'plan'], args, {
      package: '--package',
      surface: '--surface',
      provider: '--provider',
      model: '--model',
      idempotencyKey: '--idempotency-key',
      artifactRoot: '--artifact-root'
    })
  },
  {
    name: 'browser_debug_agent_execution_run',
    minimumProfile: 'admin',
    description: 'Run a matching admin-only agent execution plan through MCP with explicit execute intent.',
    tags: [
      MCP_TOOL_TAGS.AGENT_EXECUTION_RUN_EXECUTE,
      MCP_TOOL_TAGS.PROVIDER_EXECUTION_ADMIN
    ],
    inputSchema: {
      type: 'object',
      required: ['execution', 'package', 'surface', 'provider', 'model', 'execute', 'idempotencyKey'],
      additionalProperties: false,
      properties: {
        execution: { type: 'string' },
        package: { type: 'string' },
        surface: { type: 'string' },
        provider: { type: 'string' },
        model: { type: 'string' },
        execute: { type: 'boolean', const: true },
        idempotencyKey: { type: 'string' },
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: true, providerCall: true }),
    validate: (args) => {
      const required = validateExactRequiredStrings(args, [
        'execution',
        'package',
        'surface',
        'provider',
        'model',
        'execute',
        'idempotencyKey',
        'artifactRoot'
      ], ['execution', 'package', 'surface', 'provider', 'model', 'idempotencyKey']);
      if (!required.ok) {
        return required;
      }
      if (args.execute !== true) {
        return {
          ok: false,
          message: 'browser_debug_agent_execution_run requires execute: true.'
        };
      }
      return { ok: true };
    },
    toCliArgs: (args) => {
      const output = withOptionalOptions(['agent', 'execution', 'run'], args, {
        execution: '--execution',
        package: '--package',
        surface: '--surface',
        provider: '--provider',
        model: '--model',
        idempotencyKey: '--idempotency-key',
        artifactRoot: '--artifact-root'
      });
      if (args.execute === true) {
        output.splice(-1, 0, '--execute');
      }
      return output;
    }
  },
  {
    name: 'browser_debug_visual_review_dashboard',
    minimumProfile: 'safe',
    description: 'Read local visual review preparation, execution, and result dashboard status without writing artifacts or executing providers.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        artifactRoot: { type: 'string' },
        limit: { type: 'number' },
        maxBytes: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    toCliArgs: (args) => withOptionalOptions(['visual', 'review', 'dashboard'], args, {
      artifactRoot: '--artifact-root',
      limit: '--limit',
      maxBytes: '--max-bytes'
    })
  },
  {
    name: 'browser_debug_review_target',
    minimumProfile: 'full',
    description: 'Run a deterministic local browser review for a target manifest.',
    inputSchema: {
      type: 'object',
      required: ['target'],
      additionalProperties: false,
      properties: {
        target: { type: 'string' },
        report: { type: 'boolean' },
        timeout: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: true, writesArtifacts: true }),
    toCliArgs: (args) => withCommonOptions(['review', '--target', args.target], args)
  },
  {
    name: 'browser_debug_capture_readiness',
    minimumProfile: 'safe',
    description: 'Inspect screen, window, and desktop app capture readiness without capturing pixels.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        source: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    validate: (args) => validateExactRequiredStrings(args, ['source'], []),
    toCliArgs: (args) => withOptionalOptions(['capture', 'readiness'], args, {
      source: '--source'
    })
  },
  {
    name: 'browser_debug_capture_plan',
    minimumProfile: 'safe',
    description: 'Inspect read-only screen, window, and desktop app capture planning requirements without capturing pixels.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        source: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    validate: (args) => validateExactRequiredStrings(args, ['source'], []),
    toCliArgs: (args) => withOptionalOptions(['capture', 'plan'], args, {
      source: '--source'
    })
  },
  {
    name: 'browser_debug_language_settings',
    minimumProfile: 'safe',
    description: 'Inspect local dashboard display locale and artifact output language settings without writing files or executing providers.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    toCliArgs: () => ['settings', 'language', '--json']
  },
  {
    name: 'browser_debug_localization_resources',
    minimumProfile: 'safe',
    description: 'Inspect provider-free dashboard UI locale resources without translating raw evidence.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        locale: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    validate: (args) => validateExactRequiredStrings(args, ['locale'], []),
    toCliArgs: (args) => withOptionalOptions(['settings', 'locale', 'resources'], args, {
      locale: '--locale'
    })
  },
  {
    name: 'browser_debug_report_templates',
    minimumProfile: 'safe',
    description: 'Inspect provider-free report template locale resources without translating raw evidence.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        locale: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    validate: (args) => validateExactRequiredStrings(args, ['locale'], []),
    toCliArgs: (args) => withOptionalOptions(['settings', 'report', 'templates'], args, {
      locale: '--locale'
    })
  },
  {
    name: 'browser_debug_translation_readiness',
    minimumProfile: 'safe',
    description: 'Inspect translation readiness without provider calls, credentials, or raw evidence translation.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        locale: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    validate: (args) => validateExactRequiredStrings(args, ['locale'], []),
    toCliArgs: (args) => withOptionalOptions(['translation', 'readiness'], args, {
      locale: '--locale'
    })
  },
  {
    name: 'browser_debug_release_readiness',
    minimumProfile: 'safe',
    description: 'Inspect local release readiness and npm publication boundaries without contacting npm or reading credentials.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    validate: (args) => validateExactRequiredStrings(args, [], []),
    toCliArgs: () => ['release', 'readiness', '--json']
  },
  {
    name: 'browser_debug_artifact_root_status',
    minimumProfile: 'safe',
    description: 'Inspect artifact-root compatibility policy and migration boundaries without writing artifacts.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        artifactRoot: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    validate: (args) => validateExactRequiredStrings(args, ['artifactRoot'], []),
    toCliArgs: (args) => withOptionalOptions(['artifact-root', 'status'], args, {
      artifactRoot: '--artifact-root'
    })
  },
  {
    name: 'browser_debug_legacy_alias_audit',
    minimumProfile: 'safe',
    description: 'Inspect retained legacy alias compatibility without removing aliases or changing MCP permissions.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    validate: (args) => validateExactRequiredStrings(args, [], []),
    toCliArgs: () => ['identity', 'aliases', '--json']
  },
  {
    name: 'browser_debug_legacy_alias_removal_readiness',
    minimumProfile: 'safe',
    description: 'Inspect legacy alias removal readiness without removing aliases or changing compatibility surfaces.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    validate: (args) => validateExactRequiredStrings(args, [], []),
    toCliArgs: () => ['identity', 'aliases', 'removal-readiness', '--json']
  },
  {
    name: 'browser_debug_shell_readiness',
    minimumProfile: 'safe',
    description: 'Inspect constrained shell use-case, threat-model, and plan-only readiness without executing commands.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false, shellUsed: false }),
    validate: (args) => validateExactRequiredStrings(args, [], []),
    toCliArgs: () => ['shell', 'readiness', '--json']
  },
  {
    name: 'browser_debug_final_readiness',
    minimumProfile: 'safe',
    description: 'Inspect local final hardening readiness without running gates, launching browsers, publishing, or triggering remote CI.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false, shellUsed: false }),
    validate: (args) => validateExactRequiredStrings(args, [], []),
    toCliArgs: () => ['final', 'readiness', '--json']
  },
  {
    name: 'browser_debug_mcp_execution_gates',
    minimumProfile: 'safe',
    description: 'Inspect read-only MCP planning and execution gate requirements without changing MCP permissions or running providers.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        operation: { type: 'string' },
        profile: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    toCliArgs: (args) => withOptionalOptions(['mcp', 'execution', 'gates'], args, {
      operation: '--operation',
      profile: '--profile'
    })
  },
  {
    name: 'browser_debug_mcp_capabilities',
    minimumProfile: 'safe',
    description: 'Inspect MCP profile, transport, and admin write/execute exposure policy without changing state.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        profile: { type: 'string' },
        scope: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false }),
    toCliArgs: (args) => withOptionalOptions(['mcp', 'capabilities'], args, {
      profile: '--profile',
      scope: '--scope'
    })
  },
  {
    name: 'browser_debug_operation_registry',
    minimumProfile: 'safe',
    description: 'Inspect the read-only operation registry, risk taxonomy, and approval gates without changing state.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        operation: { type: 'string' },
        group: { type: 'string' },
        risk: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    toCliArgs: (args) => withOptionalOptions(['operation', 'registry'], args, {
      operation: '--operation',
      group: '--group',
      risk: '--risk'
    })
  },
  {
    name: 'browser_debug_operation_roadmap',
    minimumProfile: 'safe',
    description: 'Inspect the read-only operation roadmap A/B/C boundary contracts without changing state.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        phase: { type: 'string' },
        group: { type: 'string' },
        risk: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    toCliArgs: (args) => withOptionalOptions(['operation', 'roadmap'], args, {
      phase: '--phase',
      group: '--group',
      risk: '--risk'
    })
  },
  {
    name: 'browser_debug_operation_contracts',
    minimumProfile: 'safe',
    description: 'Inspect shared read-only operation contracts for risk, gate, token, and receipt boundaries without changing state.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scope: { type: 'string' },
        operation: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    toCliArgs: (args) => withOptionalOptions(['operation', 'contracts'], args, {
      scope: '--scope',
      operation: '--operation'
    })
  },
  {
    name: 'browser_debug_operation_policy',
    minimumProfile: 'safe',
    description: 'Inspect read-only operation policy and readiness for admin defaults, CLI planning, harness disabled state, and MCP readiness.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scope: { type: 'string' },
        operation: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    toCliArgs: (args) => withOptionalOptions(['operation', 'policy'], args, {
      scope: '--scope',
      operation: '--operation'
    })
  },
  {
    name: 'browser_debug_operation_admin_readiness',
    minimumProfile: 'safe',
    description: 'Inspect read-only MCP admin token-flow and harness readiness without issuing tokens or enabling execution.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scope: { type: 'string' },
        operation: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    toCliArgs: (args) => withOptionalOptions(['operation', 'admin-readiness'], args, {
      scope: '--scope',
      operation: '--operation'
    })
  },
  {
    name: 'browser_debug_operation_provider_readiness',
    minimumProfile: 'safe',
    description: 'Inspect read-only provider MCP planning, disclosure, and credential-guard readiness without calling providers.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scope: { type: 'string' },
        operation: { type: 'string' }
      }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false, providerCall: false }),
    toCliArgs: (args) => withOptionalOptions(['operation', 'provider-readiness'], args, {
      scope: '--scope',
      operation: '--operation'
    })
  },
  {
    name: 'browser_debug_schema_list',
    minimumProfile: 'safe',
    description: 'List machine-readable TraceCue schemas.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    effects: effects({ browserLaunched: false, writesArtifacts: false }),
    toCliArgs: () => ['schema', 'list', '--json']
  },
  {
    name: 'browser_debug_schema_get',
    minimumProfile: 'safe',
    description: 'Get one machine-readable Browser Debug CLI schema.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: { name: { type: 'string' } }
    },
    effects: effects({ browserLaunched: false, writesArtifacts: false }),
    toCliArgs: (args) => ['schema', 'get', '--name', args.name, '--json']
  }
]);

const TOOL_BY_NAME = new Map(TOOL_REGISTRY.map((tool) => [tool.name, tool]));

export function resolveMcpProfile(value, env = {}) {
  const profile = String(value || env.TRACE_CUE_MCP_PROFILE || env.BROWSER_DEBUG_MCP_PROFILE || DEFAULT_MCP_PROFILE).trim();
  if (Object.hasOwn(MCP_PROFILES, profile)) {
    return { ok: true, profile, definition: MCP_PROFILES[profile] };
  }
  return {
    ok: false,
    profile,
    message: `Unsupported MCP profile: ${profile}. Expected one of: ${MCP_PROFILE_NAMES.join(', ')}.`
  };
}

export function getMcpTools(profile = DEFAULT_MCP_PROFILE) {
  const resolved = resolveMcpProfile(profile);
  if (!resolved.ok) {
    return [];
  }
  return resolved.definition.tools.map((name) => publicTool(TOOL_BY_NAME.get(name)));
}

export function getMcpToolsByTag(profile = DEFAULT_MCP_PROFILE, tag) {
  return getMcpTools(profile).filter((tool) => tool.tags.includes(tag));
}

export function resolveMcpTool(profile, name) {
  const resolved = resolveMcpProfile(profile);
  if (!resolved.ok) {
    return { ok: false, code: 'INVALID_PROFILE', message: resolved.message };
  }
  const tool = TOOL_BY_NAME.get(name);
  if (!tool) {
    return { ok: false, code: 'UNKNOWN_TOOL', message: `Unknown tool: ${name}` };
  }
  if (!resolved.definition.tools.includes(name)) {
    return {
      ok: false,
      code: 'TOOL_NOT_IN_PROFILE',
      message: `Tool not available for MCP profile ${resolved.profile}: ${name}`
    };
  }
  return { ok: true, profile: resolved.profile, definition: resolved.definition, tool };
}

export function mcpToolToCliArgs(tool, args = {}) {
  const definition = typeof tool === 'string' ? TOOL_BY_NAME.get(tool) : tool;
  if (!definition) {
    return ['doctor', '--json'];
  }
  return definition.toCliArgs(args);
}

export function validateMcpToolArgs(tool, args = {}) {
  const definition = typeof tool === 'string' ? TOOL_BY_NAME.get(tool) : tool;
  if (!definition || typeof definition.validate !== 'function') {
    return { ok: true };
  }
  return definition.validate(args ?? {});
}

export function mcpProfileMetadata(profile = DEFAULT_MCP_PROFILE) {
  const resolved = resolveMcpProfile(profile);
  if (!resolved.ok) {
    return null;
  }
  return {
    name: resolved.profile,
    default: DEFAULT_MCP_PROFILE,
    available: MCP_PROFILE_NAMES,
    description: resolved.definition.description,
    boundaries: resolved.definition.boundaries
  };
}

function publicTool(tool) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    minimumProfile: tool.minimumProfile,
    effects: tool.effects,
    tags: Object.freeze([...(tool.tags ?? [])])
  };
}

function effects(overrides) {
  return Object.freeze({
    browserLaunched: false,
    writesArtifacts: false,
    deletesFiles: false,
    providerCall: false,
    shellUsed: false,
    externalListener: false,
    externalUpload: false,
    ...overrides
  });
}

function withCommonOptions(base, args) {
  const output = [...base];
  if (args.viewport) {
    output.push('--viewport', String(args.viewport));
  }
  if (args.timeout) {
    output.push('--timeout', String(args.timeout));
  }
  if (args.screenshot) {
    output.push('--screenshot');
  }
  if (args.trace) {
    output.push('--trace');
  }
  if (args.report) {
    output.push('--report');
  }
  output.push('--json');
  return output;
}

function withOptionalOptionsBase(base, args, optionMap) {
  const output = [...base];
  for (const [key, flag] of Object.entries(optionMap)) {
    if (args[key] !== undefined) {
      output.push(flag, String(args[key]));
    }
  }
  return output;
}

function withOptionalOptions(base, args, optionMap) {
  const output = withOptionalOptionsBase(base, args, optionMap);
  output.push('--json');
  return output;
}

function validateExactRequiredStrings(args, allowedKeys, requiredKeys) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(args ?? {})) {
    if (!allowed.has(key)) {
      return {
        ok: false,
        message: `Unsupported MCP argument for this tool: ${key}`
      };
    }
  }
  for (const key of requiredKeys) {
    if (typeof args?.[key] !== 'string' || args[key].trim() === '') {
      return {
        ok: false,
        message: `Missing required MCP argument: ${key}`
      };
    }
  }
  return { ok: true };
}

function validateBoundedSuperviseArgs(args = {}) {
  const required = validateSessionCommonArgs(args, ['url', 'actions', 'screenshot', 'trace', 'timeout', 'artifactRoot'], ['url']);
  if (!required.ok) {
    return required;
  }
  const url = validateMcpUrl(args.url);
  if (!url.ok) {
    return url;
  }
  if (args.actions !== undefined) {
    const actions = validateMcpActionArray(args.actions, 25);
    if (!actions.ok) {
      return actions;
    }
  }
  return { ok: true };
}

function validateSessionStartArgs(args = {}) {
  const required = validateSessionCommonArgs(args, [
    'url',
    'ttl',
    'idleTimeout',
    'timeout',
    'headed',
    'manualCheckpoint',
    'originAllowlist',
    'storageState',
    'artifactRoot'
  ], []);
  if (!required.ok) {
    return required;
  }
  if (!args.url && !args.storageState) {
    return { ok: false, message: 'browser_debug_session_start requires url or storageState.' };
  }
  if (args.url) {
    const url = validateMcpUrl(args.url);
    if (!url.ok) {
      return url;
    }
  }
  if (args.manualCheckpoint && args.headed !== true) {
    return { ok: false, message: 'manualCheckpoint requires headed: true.' };
  }
  return { ok: true };
}

function validateSessionActionArgs(args = {}) {
  const required = validateSessionCommonArgs(args, ['session', 'action', 'screenshot', 'timeout', 'artifactRoot'], ['session']);
  if (!required.ok) {
    return required;
  }
  const action = validateMcpAction(args.action);
  if (!action.ok) {
    return action;
  }
  return { ok: true };
}

function validateSessionCheckpointArgs(args = {}) {
  const required = validateSessionCommonArgs(args, [
    'session',
    'name',
    'untilUrl',
    'untilSelector',
    'exportStorageState',
    'timeout',
    'artifactRoot'
  ], ['session', 'name']);
  if (!required.ok) {
    return required;
  }
  if (args.exportStorageState !== undefined && args.exportStorageState !== true && args.exportStorageState !== false) {
    return { ok: false, message: 'exportStorageState must be a boolean.' };
  }
  return { ok: true };
}

function validateSessionCommonArgs(args = {}, allowedKeys, requiredKeys) {
  const required = validateExactRequiredStrings(args, allowedKeys, requiredKeys);
  if (!required.ok) {
    return required;
  }
  for (const key of ['screenshot', 'trace', 'report', 'headed', 'exportStorageState']) {
    if (args[key] !== undefined && typeof args[key] !== 'boolean') {
      return { ok: false, message: `${key} must be a boolean.` };
    }
  }
  return { ok: true };
}

function validateMcpActionArray(value, maxItems) {
  if (!Array.isArray(value)) {
    return { ok: false, message: 'actions must be an array.' };
  }
  if (value.length > maxItems) {
    return { ok: false, message: `actions must contain at most ${maxItems} items.` };
  }
  for (const action of value) {
    const result = validateMcpAction(action);
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
}

function validateMcpAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return { ok: false, message: 'action must be an object.' };
  }
  const supported = new Set(['click', 'fill', 'select', 'press', 'scroll', 'wait', 'observe', 'screenshot', 'navigate']);
  if (!supported.has(action.type)) {
    return { ok: false, message: `Unsupported action type: ${action.type}` };
  }
  if (action.type === 'navigate') {
    return validateMcpUrl(action.url);
  }
  return { ok: true };
}

function validateMcpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { ok: false, message: 'A non-empty URL is required.' };
  }
  try {
    const url = new URL(value);
    if (!['http:', 'https:', 'file:'].includes(url.protocol)) {
      return { ok: false, message: `Unsupported URL protocol: ${url.protocol}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'URL must be absolute.' };
  }
}

function sessionStartCliArgs(args) {
  const output = ['session', 'start'];
  if (args.url !== undefined) {
    output.push('--url', String(args.url));
  }
  if (args.ttl !== undefined) {
    output.push('--ttl', String(args.ttl));
  }
  if (args.idleTimeout !== undefined) {
    output.push('--idle-timeout', String(args.idleTimeout));
  }
  if (args.timeout !== undefined) {
    output.push('--timeout', String(args.timeout));
  }
  if (args.headed === true) {
    output.push('--headed');
  }
  if (args.manualCheckpoint !== undefined) {
    output.push('--manual-checkpoint', String(args.manualCheckpoint));
  }
  if (args.originAllowlist !== undefined) {
    output.push('--origin-allowlist', String(args.originAllowlist));
  }
  if (args.storageState !== undefined) {
    output.push('--storage-state', String(args.storageState));
  }
  if (args.artifactRoot !== undefined) {
    output.push('--artifact-root', String(args.artifactRoot));
  }
  output.push('--json');
  return output;
}

function sessionCheckpointCliArgs(args) {
  const output = ['session', 'checkpoint', '--session', args.session, '--name', args.name];
  if (args.untilUrl !== undefined) {
    output.push('--until-url', String(args.untilUrl));
  }
  if (args.untilSelector !== undefined) {
    output.push('--until-selector', String(args.untilSelector));
  }
  if (args.exportStorageState === true) {
    output.push('--export-storage-state');
  }
  if (args.timeout !== undefined) {
    output.push('--timeout', String(args.timeout));
  }
  if (args.artifactRoot !== undefined) {
    output.push('--artifact-root', String(args.artifactRoot));
  }
  output.push('--json');
  return output;
}
