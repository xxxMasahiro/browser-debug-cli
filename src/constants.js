export const CLI_NAME = 'browser-debug';
export const PACKAGE_VERSION = '0.0.0';
export const SCHEMA_VERSION = '0.1.0';
export const MIN_NODE_MAJOR = 20;
export const DEFAULT_ARTIFACT_ROOT = '.browser-debug';

export const SCHEMA_VERSION_POLICY = Object.freeze({
  current: SCHEMA_VERSION,
  stage: 'mvp-pre-1.0',
  compatible_change: 'additive fields may be added while existing fields keep their meaning and type',
  breaking_change: 'rename, removal, or type changes require a schema version bump'
});

export const ARTIFACT_RETENTION_POLICY = Object.freeze({
  mode: 'manual',
  automatic_cleanup: false,
  cleanup_command: null,
  default_root: DEFAULT_ARTIFACT_ROOT
});

export const PLANNED_COMMANDS = Object.freeze([
  'doctor',
  'observe',
  'supervise',
  'daemon start',
  'daemon status',
  'daemon stop',
  'target init',
  'session start',
  'session close',
  'act',
  'report',
  'spec export',
  'review',
  'schema list',
  'schema get',
  'mcp serve'
]);
