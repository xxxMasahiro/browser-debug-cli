import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { executeCli } from '../src/cli.js';
import { startMcpHttpServer } from '../src/mcp-http-transport.js';
import {
  buildDesktopReviewProviderPreparationPlan,
  desktopReviewProviderPreparationPlanBoundary
} from '../src/desktop-review-provider-preparation-plan.js';
import { runImageReview } from '../src/image-review.js';
import { buildIdentityAudit, runIdentityAudit, normalizeRepositoryUrl } from '../src/identity-audit.js';
import { runCaptureHandoff, captureHandoffBoundary } from '../src/capture-handoff.js';
import { buildCapturePlan, capturePlanBoundary } from '../src/capture-plan.js';
import { buildCaptureReadiness, captureReadinessBoundary } from '../src/capture-readiness.js';
import {
  runVisualReviewResultPreparation,
  visualReviewResultPreparationBoundary
} from '../src/visual-review-result-preparation.js';
import {
  runVisualReviewExecutionRun,
  visualReviewExecutionBoundary
} from '../src/visual-review-execution.js';
import {
  runVisualReviewDashboard,
  visualReviewDashboardBoundary
} from '../src/visual-review-dashboard.js';
import {
  runVisualReviewAggregation,
  visualReviewAggregationBoundary
} from '../src/visual-review-aggregation.js';
import {
  TRACE_CUE_LOCALE_CODES,
  getTraceCueIntlLocale,
  getTraceCueLocaleDirection,
  normalizeTraceCueLocale
} from '../src/locale-policy.js';
import {
  buildLanguageSettingsPolicyContract,
  normalizeLanguageSettings,
  runLanguageSettings,
  languageSettingsBoundary
} from '../src/language-settings.js';
import {
  buildLocalizationResources,
  buildReportTemplates,
  buildTranslationDryRun,
  buildTranslationReadiness,
  translationBoundary
} from '../src/localization-resources.js';
import {
  buildArtifactRootStatus,
  artifactRootBoundary
} from '../src/artifact-root-policy.js';
import {
  buildArtifactRootMigrationPlan
} from '../src/artifact-root-migration.js';
import {
  buildLegacyAliasAudit,
  legacyAliasWarningsForInvocation
} from '../src/legacy-alias-audit.js';
import {
  buildLegacyAliasRemovalReadiness,
  legacyAliasRemovalReadinessBoundary
} from '../src/legacy-alias-removal-readiness.js';
import {
  buildReleaseReadiness,
  releaseReadinessBoundary
} from '../src/release-readiness.js';
import {
  buildConstrainedShellReadiness,
  constrainedShellBoundary
} from '../src/constrained-shell-readiness.js';
import {
  buildFinalHardeningReadiness,
  finalHardeningBoundary
} from '../src/final-hardening-readiness.js';
import {
  buildOperationAdminReadinessReport,
  operationAdminReadinessBoundary
} from '../src/operation-admin-readiness.js';
import {
  buildOperationContractsReport,
  operationContractsBoundary
} from '../src/operation-contracts.js';
import {
  buildOperationPolicyReport,
  operationPolicyBoundary
} from '../src/operation-policy.js';
import {
  buildOperationProviderReadinessReport,
  operationProviderReadinessBoundary
} from '../src/operation-provider-readiness.js';
import {
  buildOperationRegistryReport,
  operationRegistryBoundary
} from '../src/operation-registry.js';
import {
  buildOperationRoadmapReport,
  operationRoadmapBoundary
} from '../src/operation-roadmap.js';
import { MCP_TOOL_TAGS, getMcpToolsByTag, handleMcpRequest } from '../src/mcp.js';
import { runObserve } from '../src/observe.js';
import { parseCliArgs } from '../src/parser.js';
import { PRODUCT_IDENTITY, filesystemSafeName } from '../src/product-identity.js';
import { redact, redactUrl } from '../src/redaction.js';
import { classifyActionCandidate, normalizeTargetManifest, runReview } from '../src/review.js';
import { buildLocalContentUxAdvisory } from '../src/content-ux-advisory.js';
import { createTargetManifest } from '../src/target.js';
import { ensureArtifactRoot } from '../src/artifacts.js';
import {
  createVisualEvidenceRecord,
  imageMetadata,
  readWorkspaceImageFile,
  writeVisualEvidenceRecord
} from '../src/visual-evidence.js';
import {
  buildVisualReviewProviderPolicy,
  normalizeVisualReviewDisclosureMode,
  visualReviewProviderBoundary
} from '../src/visual-review-provider-policy.js';
import {
  API_PROVIDER_CREDENTIAL_ENV,
  API_PROVIDER_ENDPOINT_ENV
} from '../src/agent-execution-providers.js';
import {
  agenticHumanReviewBoundary,
  runAgenticHumanReviewPlan,
  runAgenticHumanReviewPropose,
  runAgenticHumanReviewProviderReadiness,
  runAgenticHumanReviewReportQuality,
  runAgenticHumanReviewRun
} from '../src/agentic-human-review.js';
import {
  AGENTIC_REVIEW_API_CREDENTIAL_ENV,
  AGENTIC_REVIEW_API_ENDPOINT_ENV,
  AGENTIC_REVIEW_API_TIMEOUT_ENV,
  AGENTIC_REVIEW_LIVE_DOGFOOD_ENV
} from '../src/agentic-human-review-providers.js';
import {
  buildOpenAiResponsesRequest,
  handleAgenticHumanReviewResponsesAdapterRequest,
  normalizeAgenticHumanReviewResponsesAdapterConfig,
  parseOpenAiResponsesAdvisory
} from '../src/agentic-human-review-responses-adapter.js';

const fixedNow = '2026-06-17T00:00:00.000Z';

test('doctor returns the JSON envelope without launching a browser', async () => {
  const result = await executeCli(['doctor', '--json'], {
    cwd: process.cwd(),
    nodeVersion: '24.14.1',
    platform: 'linux',
    now: fixedNow,
    importPlaywright: async () => ({ available: false, reason: 'module not found' })
  });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.schema_version, '0.1.0');
  assert.equal(body.command, 'doctor');
  assert.equal(body.status, 'ok');
  assert.equal(body.observed_at, fixedNow);
  assert.equal(body.data.runtime.minimum_node_major, 20);
  assert.equal(body.data.schema_version_policy.current, '0.1.0');
  assert.equal(body.data.schema_version_policy.stage, 'mvp-pre-1.0');
  assert.equal(body.data.artifact_retention.mode, 'manual');
  assert.equal(body.data.artifact_retention.automatic_cleanup, false);
  assert.equal(body.artifacts.length, 0);
  assert.deepEqual(body.errors, []);
  assert.equal(body.warnings[0].code, 'PLAYWRIGHT_NOT_INSTALLED');
});

test('language settings keep dashboard UI and artifact output language independent', async () => {
  assert.deepEqual(TRACE_CUE_LOCALE_CODES, ['ja', 'en', 'ko', 'zh-CN', 'zh-TW', 'es', 'pt-BR', 'fr', 'de', 'id', 'vi', 'th', 'hi', 'ar']);
  assert.equal(new Set(TRACE_CUE_LOCALE_CODES).size, 14);
  assert.equal(normalizeTraceCueLocale('zh-Hant'), 'zh-TW');
  assert.equal(normalizeTraceCueLocale('pt'), 'pt-BR');
  assert.equal(getTraceCueLocaleDirection('ar'), 'rtl');
  assert.equal(getTraceCueIntlLocale('ar'), 'ar-SA');

  const policy = buildLanguageSettingsPolicyContract();
  assert.equal(policy.locale_authority.supported_locale_count, 14);
  assert.equal(policy.defaults.ui_locale, 'en');
  assert.equal(policy.boundary.provider_dispatch_enabled, false);
  assert.equal(policy.boundary.mcp_write_execute_exposed, false);

  const normalized = normalizeLanguageSettings({
    ui_locale: 'ja-JP',
    profiles: {
      reports: {
        language: {
          source_language: 'auto',
          output_language_mode: 'explicit',
          output_language: 'ar',
          translation_mode: 'provider-derived'
        }
      }
    }
  });
  assert.equal(normalized.dashboard_ui.locale, 'ja');
  assert.equal(normalized.source.language, 'auto');
  assert.equal(normalized.artifact_output.language_mode, 'explicit');
  assert.equal(normalized.artifact_output.language, 'ar');
  assert.equal(normalized.artifact_output.text_direction, 'rtl');
  assert.equal(normalized.artifact_output.translation_mode, 'none');
  assert.equal(normalized.artifact_output.translation_execution_enabled, false);
  assert.equal(normalized.safety.provider_dispatch_allowed_by_settings, false);
  assert.equal(normalized.diagnostics.some((diagnostic) => diagnostic.code === 'translation-mode-not-implemented'), true);

  const uiDerived = normalizeLanguageSettings({
    ui_locale: 'ko',
    profiles: {
      reports: {
        language: {
          source_language: 'auto',
          output_language_mode: 'ui'
        }
      }
    }
  });
  assert.equal(uiDerived.dashboard_ui.locale, 'ko');
  assert.equal(uiDerived.artifact_output.language, 'ko');
  assert.equal(uiDerived.source.status, 'auto');

  const sourceDerived = normalizeLanguageSettings({
    ui_locale: 'ja',
    profiles: {
      reports: {
        language: {
          source_language: 'en',
          output_language_mode: 'source'
        }
      }
    }
  });
  assert.equal(sourceDerived.dashboard_ui.locale, 'ja');
  assert.equal(sourceDerived.artifact_output.language, 'en');

  const parsed = parseCliArgs(['settings', 'language', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'settings language');

  const result = await executeCli(['settings', 'language', '--json'], { now: fixedNow });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'settings language');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.language_settings.dashboard_ui.locale, 'en');
  assert.equal(body.data.language_settings.artifact_output.translation_execution_enabled, false);
  assert.equal(body.data.boundary.read_only, true);
  assert.deepEqual(body.artifacts, []);

  const policyResult = await executeCli(['settings', 'language', 'policy', '--json'], { now: fixedNow });
  assert.equal(policyResult.exitCode, 0);
  assert.equal(JSON.parse(policyResult.stdout).data.language_settings_policy.locale_authority.supported_locale_count, 14);

  const direct = await runLanguageSettings({}, { now: fixedNow });
  assert.equal(direct.data.language_settings.dashboard_ui.locale, 'en');
  assert.equal(languageSettingsBoundary().gate_effect, 'none');
});

test('localization resources and translation readiness stay provider-free', async () => {
  const resources = buildLocalizationResources({ locale: 'ar' }, { now: fixedNow });
  assert.equal(resources.locale_selection, 'ar');
  assert.equal(resources.selected_resource.text_direction, 'rtl');
  assert.equal(resources.selected_resource.status, 'stub-falls-back-to-baseline');
  assert.equal(resources.rtl_layout_guard.logical_css_required, true);
  assert.equal(resources.raw_evidence_policy.translated, false);
  assert.equal(resources.boundary.provider_call_performed, false);

  const templates = buildReportTemplates({ locale: 'ja' }, { now: fixedNow });
  assert.equal(templates.locale_selection, 'ja');
  assert.equal(templates.rendering_contract.raw_evidence_interpolation_translatable, false);
  assert.equal(templates.selected_templates.templates.every((item) => item.raw_evidence === false), true);

  const readiness = await buildTranslationReadiness({ locale: 'fr' }, { now: fixedNow });
  assert.equal(readiness.locale_selection, 'fr');
  assert.equal(readiness.provider_policy.dry_run_available, true);
  assert.equal(readiness.provider_policy.live_provider_execution_available, false);
  assert.equal(readiness.disclosure_plan.raw_evidence_translated, false);
  assert.equal(readiness.boundary.provider_call_performed, false);

  const dryRun = await buildTranslationDryRun({ locale: 'de', provider: 'fake' }, { now: fixedNow });
  assert.equal(dryRun.status, 'dry_run_only');
  assert.equal(dryRun.items.some((item) => item.output_text.startsWith('[de]')), true);
  assert.equal(dryRun.items.every((item) => item.raw_evidence === false), true);
  assert.equal(dryRun.boundary.translation_execution_performed, false);
  assert.equal(translationBoundary({ dryRun: true }).fake_translation_generated, true);

  const parsedResources = parseCliArgs(['settings', 'locale', 'resources', '--locale', 'ar', '--json']);
  assert.equal(parsedResources.ok, true);
  assert.equal(parsedResources.command, 'settings locale resources');

  const resourcesResult = await executeCli(['settings', 'locale', 'resources', '--locale', 'ar', '--json'], { now: fixedNow });
  assert.equal(resourcesResult.exitCode, 0);
  const resourcesBody = JSON.parse(resourcesResult.stdout);
  assert.equal(resourcesBody.data.localization_resources.selected_resource.text_direction, 'rtl');
  assert.equal(resourcesBody.data.boundary.raw_evidence_translated, false);

  const templatesResult = await executeCli(['settings', 'report', 'templates', '--locale', 'ja', '--json'], { now: fixedNow });
  assert.equal(templatesResult.exitCode, 0);
  const templatesBody = JSON.parse(templatesResult.stdout);
  assert.equal(templatesBody.data.report_templates.rendering_contract.canonical_enum_translation_allowed, false);

  const resourceExecute = await executeCli(['settings', 'locale', 'resources', '--execute', '--json'], { now: fixedNow });
  assert.equal(resourceExecute.exitCode, 2);
  assert.equal(JSON.parse(resourceExecute.stdout).errors[0].code, 'UNSUPPORTED_LOCALIZATION_OPTION');

  const readinessResult = await executeCli(['translation', 'readiness', '--locale', 'fr', '--json'], { now: fixedNow });
  assert.equal(readinessResult.exitCode, 0);
  const readinessBody = JSON.parse(readinessResult.stdout);
  assert.equal(readinessBody.data.translation_readiness.provider_policy.live_provider_execution_available, false);
  assert.equal(readinessBody.data.boundary.provider_call_performed, false);

  const dryRunResult = await executeCli(['translation', 'dry-run', '--locale', 'de', '--provider', 'fake', '--json'], { now: fixedNow });
  assert.equal(dryRunResult.exitCode, 0);
  const dryRunBody = JSON.parse(dryRunResult.stdout);
  assert.equal(dryRunBody.data.translation_dry_run.status, 'dry_run_only');
  assert.equal(dryRunBody.data.translation_dry_run.raw_evidence_policy.translated, false);

  const unsupportedInput = await executeCli(['translation', 'dry-run', '--image', 'screen.png', '--json'], { now: fixedNow });
  assert.equal(unsupportedInput.exitCode, 2);
  assert.equal(JSON.parse(unsupportedInput.stdout).errors[0].code, 'UNSUPPORTED_TRANSLATION_OPTION');

  const apiProvider = await executeCli(['translation', 'dry-run', '--provider', 'api', '--json'], { now: fixedNow });
  assert.equal(apiProvider.exitCode, 1);
  assert.equal(JSON.parse(apiProvider.stdout).errors[0].code, 'TRANSLATION_PROVIDER_NOT_AVAILABLE');

  const runUnavailable = await executeCli(['translation', 'run', '--provider', 'api', '--execute', '--json'], { now: fixedNow });
  assert.equal(runUnavailable.exitCode, 1);
  const runUnavailableBody = JSON.parse(runUnavailable.stdout);
  assert.equal(runUnavailableBody.errors[0].code, 'TRANSLATION_EXECUTION_NOT_AVAILABLE');
  assert.equal(runUnavailableBody.data.boundary.translation_execution_performed, false);

  const mcpReadiness = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 15,
    method: 'tools/call',
    params: {
      name: 'browser_debug_translation_readiness',
      arguments: { locale: 'fr' }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpReadiness.result.structuredContent.command, 'translation readiness');
  assert.equal(mcpReadiness.result.structuredContent.data.translation_readiness.locale_selection, 'fr');

  const mcpResourcesWithExecute = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 16,
    method: 'tools/call',
    params: {
      name: 'browser_debug_localization_resources',
      arguments: { locale: 'ja', execute: true }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpResourcesWithExecute.error.code, -32602);
  assert.match(mcpResourcesWithExecute.error.message, /Unsupported MCP argument/);
});

test('identity audit reports current and future rename readiness without mutating Git', async () => {
  const parsed = parseCliArgs(['identity', 'audit', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'identity audit');

  const result = await executeCli(['identity', 'audit', '--json'], {
    now: fixedNow,
    cwd: process.cwd(),
    gitRemoteUrl: `${PRODUCT_IDENTITY.repositoryUrl}.git`
  });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'identity audit');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.identity_audit.schema_version, '1.0.0');
  assert.equal(body.data.identity_audit.identity.package_name, PRODUCT_IDENTITY.packageName);
  assert.equal(body.data.identity_audit.repository.origin_matches_current_repository_url, true);
  assert.equal(body.data.identity_audit.repository.origin_matches_future_repository_url, true);
  assert.equal(body.data.identity_audit.repository.remote_rename_pending, false);
  assert.equal(typeof body.data.identity_audit.readiness.physical_directory_rename_completed, 'boolean');
  assert.equal(
    [
      'ready_for_physical_rename_check',
      'physical_rename_complete_remote_rename_pending',
      'identity_rename_complete'
    ].includes(body.data.identity_audit.readiness.status),
    true
  );
  assert.equal(body.data.identity_audit.compatibility.legacy_alias_removal_authorized, false);
  assert.equal(body.data.identity_audit.compatibility.artifact_root_migration_authorized, false);
  assert.equal(body.data.identity_audit.compatibility.legacy_alias_audit.removal_candidate_ready, false);
  assert.equal(body.data.identity_audit.compatibility.legacy_alias_audit.retained_count >= 1, true);
  assert.equal(body.data.boundary.git_mutated, false);
  assert.equal(body.data.boundary.remote_contact, false);
  assert.equal(body.data.boundary.artifacts_written, false);
  assert.equal(normalizeRepositoryUrl('git@github.com:xxxMasahiro/browser-debug-cli.git'), 'github.com/xxxMasahiro/browser-debug-cli');
  assert.equal(normalizeRepositoryUrl('ssh://git@github.com/xxxMasahiro/browser-debug-cli.git'), 'github.com/xxxMasahiro/browser-debug-cli');
  assert.equal(filesystemSafeName('@scope/trace cue'), 'scope-trace-cue');

  const direct = await runIdentityAudit({}, {
    cwd: process.cwd(),
    gitRemoteUrl: PRODUCT_IDENTITY.futureRepositoryUrl
  });
  assert.equal(direct.data.identity_audit.repository.origin_matches_future_repository_url, true);

  const fixtureParent = await mkdtemp(path.join(tmpdir(), 'trace-cue-identity-audit-'));
  const legacyRoot = path.join(fixtureParent, PRODUCT_IDENTITY.legacyPackageNames[0]);
  const futureRoot = path.join(fixtureParent, PRODUCT_IDENTITY.futureRepositoryName);
  await mkdir(path.join(legacyRoot, '.git'), { recursive: true });
  await mkdir(path.join(futureRoot, '.git'), { recursive: true });
  await writeFile(path.join(legacyRoot, '.git', 'config'), `[remote "origin"]\n\turl = ${PRODUCT_IDENTITY.repositoryUrl}.git\n`, 'utf8');
  await writeFile(path.join(futureRoot, '.git', 'config'), `[remote "origin"]\n\turl = ${PRODUCT_IDENTITY.legacyRepositoryUrls[0]}.git\n`, 'utf8');

  const legacyRootAudit = await buildIdentityAudit({ cwd: legacyRoot });
  assert.equal(legacyRootAudit.repository.physical_rename_pending, true);
  assert.equal(legacyRootAudit.readiness.physical_directory_rename_safe_to_test, true);
  assert.equal(legacyRootAudit.readiness.physical_directory_rename_completed, false);
  assert.equal(legacyRootAudit.readiness.status, 'ready_for_physical_rename_check');

  const futureRootAudit = await buildIdentityAudit({ cwd: futureRoot });
  assert.equal(futureRootAudit.repository.physical_rename_pending, false);
  assert.equal(futureRootAudit.readiness.physical_directory_rename_safe_to_test, false);
  assert.equal(futureRootAudit.readiness.physical_directory_rename_completed, true);
  assert.equal(futureRootAudit.readiness.status, 'physical_rename_complete_remote_rename_pending');

  const completedAudit = await buildIdentityAudit({
    cwd: futureRoot,
    gitRemoteUrl: PRODUCT_IDENTITY.repositoryUrl
  });
  assert.equal(completedAudit.repository.remote_rename_pending, false);
  assert.equal(completedAudit.readiness.status, 'identity_rename_complete');
});

test('release, artifact-root, and legacy alias readiness stay local and non-publishing', async () => {
  const releaseParsed = parseCliArgs(['release', 'readiness', '--json']);
  assert.equal(releaseParsed.ok, true);
  assert.equal(releaseParsed.command, 'release readiness');

  const releaseResult = await executeCli(['release', 'readiness', '--json'], {
    cwd: process.cwd(),
    now: fixedNow
  });
  assert.equal(releaseResult.exitCode, 0);
  const releaseBody = JSON.parse(releaseResult.stdout);
  assert.equal(releaseBody.command, 'release readiness');
  assert.equal(releaseBody.data.release_readiness.package_metadata.private, true);
  assert.equal(releaseBody.data.release_readiness.package_metadata.license, 'UNLICENSED');
  assert.equal(releaseBody.data.release_readiness.publication_boundary.npm_publish_performed, false);
  assert.equal(releaseBody.data.release_readiness.publication_boundary.npm_publish_dry_run_performed, false);
  assert.equal(releaseBody.data.release_readiness.publication_boundary.npm_auth_checked, false);
  assert.equal(releaseBody.data.boundary.network_contact, false);
  assert.equal(releaseBody.data.boundary.product_docs_promoted, false);
  assert.deepEqual(releaseBody.artifacts, []);

  const releaseDirect = await buildReleaseReadiness({}, { cwd: process.cwd(), now: fixedNow });
  assert.equal(releaseDirect.decisions.publish_dry_run.status, 'approval_required_not_run');
  assert.equal(releaseReadinessBoundary().npm_publish_performed, false);

  const artifactStatusParsed = parseCliArgs(['artifact-root', 'status', '--json']);
  assert.equal(artifactStatusParsed.ok, true);
  assert.equal(artifactStatusParsed.command, 'artifact-root status');

  const artifactStatus = await executeCli(['artifact-root', 'status', '--json'], {
    cwd: process.cwd(),
    now: fixedNow
  });
  assert.equal(artifactStatus.exitCode, 0);
  const artifactStatusBody = JSON.parse(artifactStatus.stdout);
  assert.equal(artifactStatusBody.data.artifact_root_status.current_behavior.default_artifact_root_preserved, true);
  assert.equal(artifactStatusBody.data.artifact_root_status.current_behavior.dual_write_active, false);
  assert.deepEqual(artifactStatusBody.data.artifact_root_status.current_behavior.read_roots, [
    PRODUCT_IDENTITY.defaultArtifactRoot,
    PRODUCT_IDENTITY.futureArtifactRoot
  ]);
  assert.equal(artifactStatusBody.data.artifact_root_status.migration.real_workspace_execution_enabled, false);
  assert.equal(artifactStatusBody.data.boundary.real_workspace_migration_executed, false);
  assert.equal(artifactRootBoundary().legacy_files_deleted, false);

  const artifactDirect = await buildArtifactRootStatus({}, { cwd: process.cwd(), now: fixedNow });
  assert.equal(artifactDirect.policy_source.loaded, true);

  const migrationPlan = await executeCli(['artifact-root', 'migration', 'plan', '--json'], {
    cwd: process.cwd(),
    now: fixedNow
  });
  assert.equal(migrationPlan.exitCode, 0);
  const migrationPlanBody = JSON.parse(migrationPlan.stdout);
  assert.match(migrationPlanBody.data.artifact_root_migration.plan_hash, /^[a-f0-9]{64}$/);
  assert.equal(migrationPlanBody.data.artifact_root_migration.execution_boundary.real_workspace_execution_enabled, false);
  assert.equal(migrationPlanBody.data.boundary.migration_executed, false);

  const missingFixture = parseCliArgs(['artifact-root', 'migration', 'execute', '--execute', '--json']);
  assert.equal(missingFixture.ok, false);
  assert.equal(missingFixture.error.code, 'MISSING_REQUIRED_OPTION');

  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'trace-cue-artifact-root-migration-'));
  await mkdir(path.join(fixtureRoot, PRODUCT_IDENTITY.defaultArtifactRoot, 'reports'), { recursive: true });
  await writeFile(path.join(fixtureRoot, PRODUCT_IDENTITY.defaultArtifactRoot, 'reports', 'sample.json'), '{"ok":true}\n', 'utf8');
  const fixturePlan = await buildArtifactRootMigrationPlan({ 'fixture-root': fixtureRoot }, {
    cwd: fixtureRoot,
    now: fixedNow,
    fixtureOnly: true
  });
  assert.equal(fixturePlan.candidate_count, 1);
  assert.equal(fixturePlan.copy_count, 1);

  const fixtureExecute = await executeCli([
    'artifact-root',
    'migration',
    'execute',
    '--execute',
    '--fixture-root',
    fixtureRoot,
    '--plan-hash',
    fixturePlan.plan_hash,
    '--json'
  ], {
    cwd: process.cwd(),
    now: fixedNow
  });
  assert.equal(fixtureExecute.exitCode, 0);
  const fixtureExecuteBody = JSON.parse(fixtureExecute.stdout);
  assert.equal(fixtureExecuteBody.data.artifact_root_migration.execution.fixture_only, true);
  assert.equal(fixtureExecuteBody.data.artifact_root_migration.execution.copied_count, 1);
  assert.equal(fixtureExecuteBody.data.artifact_root_migration.execution.deletes_legacy_files, false);
  assert.equal(fixtureExecuteBody.data.boundary.real_workspace_migration_executed, false);
  await access(path.join(fixtureRoot, PRODUCT_IDENTITY.defaultArtifactRoot, 'reports', 'sample.json'));
  await access(path.join(fixtureRoot, PRODUCT_IDENTITY.futureArtifactRoot, 'reports', 'sample.json'));

  const aliasParsed = parseCliArgs(['identity', 'aliases', '--json']);
  assert.equal(aliasParsed.ok, true);
  assert.equal(aliasParsed.command, 'identity aliases');

  const aliasResult = await executeCli(['identity', 'aliases', '--json'], {
    cwd: process.cwd(),
    now: fixedNow,
    invokedBinName: PRODUCT_IDENTITY.legacyCliBins[0].name
  });
  assert.equal(aliasResult.exitCode, 0);
  const aliasBody = JSON.parse(aliasResult.stdout);
  assert.equal(aliasBody.data.legacy_alias_audit.summary.removal_authorized, false);
  assert.equal(aliasBody.data.legacy_alias_audit.summary.removal_candidate_ready, false);
  assert.equal(aliasBody.data.legacy_alias_audit.invocation.legacy_invocation, true);
  assert.equal(aliasBody.warnings.some((warning) => warning.code === 'LEGACY_CLI_BIN_USED'), true);
  assert.equal(aliasBody.data.boundary.legacy_alias_removed, false);

  const aliasDirect = await buildLegacyAliasAudit({}, {
    cwd: process.cwd(),
    now: fixedNow
  });
  assert.equal(aliasDirect.summary.retained_count, aliasDirect.summary.surface_count);
  assert.equal(legacyAliasWarningsForInvocation(PRODUCT_IDENTITY.cliBinName).length, 0);
  assert.equal(legacyAliasWarningsForInvocation(PRODUCT_IDENTITY.legacyCliBins[0].name).length, 1);

  const mcpRelease = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 20,
    method: 'tools/call',
    params: {
      name: 'browser_debug_release_readiness',
      arguments: {}
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpRelease.result.structuredContent.command, 'release readiness');
  assert.equal(mcpRelease.result.structuredContent.data.boundary.npm_publish_performed, false);

  const mcpArtifact = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 21,
    method: 'tools/call',
    params: {
      name: 'browser_debug_artifact_root_status',
      arguments: { execute: true }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpArtifact.error.code, -32602);
  assert.match(mcpArtifact.error.message, /Unsupported MCP argument/);

  const mcpAliases = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 22,
    method: 'tools/call',
    params: {
      name: 'browser_debug_legacy_alias_audit',
      arguments: {}
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpAliases.result.structuredContent.command, 'identity aliases');
  assert.equal(mcpAliases.result.structuredContent.data.boundary.legacy_alias_removed, false);
});

test('legacy alias removal, shell, and final hardening readiness stay fail-closed and local-only', async () => {
  const removalParsed = parseCliArgs(['identity', 'aliases', 'removal-readiness', '--json']);
  assert.equal(removalParsed.ok, true);
  assert.equal(removalParsed.command, 'identity aliases removal-readiness');

  const removalReadiness = await executeCli(['identity', 'aliases', 'removal-readiness', '--json'], {
    cwd: process.cwd(),
    now: fixedNow
  });
  assert.equal(removalReadiness.exitCode, 0);
  const removalBody = JSON.parse(removalReadiness.stdout);
  assert.equal(removalBody.data.legacy_alias_removal_readiness.status, 'blocked_approval_required');
  assert.equal(removalBody.data.legacy_alias_removal_readiness.readiness.removal_authorized, false);
  assert.equal(removalBody.data.legacy_alias_removal_readiness.readiness.package_bins_removed, false);
  assert.equal(removalBody.data.legacy_alias_removal_readiness.compatibility.legacy_aliases_must_remain, true);
  assert.equal(removalBody.data.boundary.legacy_alias_removed, false);
  assert.equal(removalBody.data.boundary.product_docs_promoted, false);
  assert.deepEqual(removalBody.artifacts, []);

  const directRemoval = await buildLegacyAliasRemovalReadiness({}, {
    cwd: process.cwd(),
    now: fixedNow
  });
  assert.equal(directRemoval.blockers.every((blocker) => blocker.active), true);
  assert.equal(legacyAliasRemovalReadinessBoundary().mcp_execution_exposed, false);

  const removalExecute = await executeCli(['identity', 'aliases', 'remove', '--execute', '--json'], { now: fixedNow });
  assert.equal(removalExecute.exitCode, 1);
  const removalExecuteBody = JSON.parse(removalExecute.stdout);
  assert.equal(removalExecuteBody.errors[0].code, 'LEGACY_ALIAS_REMOVAL_NOT_AVAILABLE');
  assert.equal(removalExecuteBody.data.boundary.legacy_alias_removed, false);

  const shellParsed = parseCliArgs(['shell', 'readiness', '--json']);
  assert.equal(shellParsed.ok, true);
  assert.equal(shellParsed.command, 'shell readiness');

  const shellReadiness = await executeCli(['shell', 'readiness', '--json'], { now: fixedNow });
  assert.equal(shellReadiness.exitCode, 0);
  const shellBody = JSON.parse(shellReadiness.stdout);
  assert.equal(shellBody.data.constrained_shell_readiness.status, 'plan_only');
  assert.equal(shellBody.artifacts.length, 0);
  assert.equal(shellBody.data.constrained_shell_readiness.threat_model.free_form_shell_allowed, false);
  assert.equal(shellBody.data.constrained_shell_readiness.command_schema.allowlist_required, true);
  assert.equal(shellBody.data.boundary.command_executed, false);
  assert.equal(shellBody.data.boundary.shell_used, false);
  assert.equal(shellBody.data.boundary.mcp_execution_exposed, false);
  assert.equal(shellBody.data.boundary.mcp_write_execute_exposed, false);

  const shellPlan = await executeCli(['shell', 'plan', '--json'], { now: fixedNow });
  assert.equal(shellPlan.exitCode, 0);
  assert.equal(JSON.parse(shellPlan.stdout).data.constrained_shell_plan.mode, 'plan');

  const shellExecuteOption = parseCliArgs(['shell', 'readiness', '--execute', '--json']);
  assert.equal(shellExecuteOption.ok, false);
  assert.equal(shellExecuteOption.error.code, 'CONFLICTING_OPTIONS');

  const shellCommandOption = parseCliArgs(['shell', 'readiness', '--command', 'echo hi', '--json']);
  assert.equal(shellCommandOption.ok, false);
  assert.equal(shellCommandOption.error.code, 'UNKNOWN_OPTION');

  const shellPlanPositional = parseCliArgs(['shell', 'plan', 'echo', '--json']);
  assert.equal(shellPlanPositional.ok, false);
  assert.equal(shellPlanPositional.error.code, 'UNEXPECTED_ARGUMENT');

  const shellRunMissingExecute = parseCliArgs(['shell', 'run', '--json']);
  assert.equal(shellRunMissingExecute.ok, false);
  assert.equal(shellRunMissingExecute.error.code, 'MISSING_REQUIRED_OPTION');

  const directShell = buildConstrainedShellReadiness({}, { now: fixedNow });
  assert.equal(directShell.mcp_readiness.execution_tool_exposed, false);
  assert.equal(constrainedShellBoundary().child_process_used, false);

  const shellExecute = await executeCli(['shell', 'run', '--execute', '--json'], { now: fixedNow });
  assert.equal(shellExecute.exitCode, 1);
  const shellExecuteBody = JSON.parse(shellExecute.stdout);
  assert.equal(shellExecuteBody.errors[0].code, 'CONSTRAINED_SHELL_EXECUTION_NOT_AVAILABLE');
  assert.equal(shellExecuteBody.data.boundary.command_executed, false);
  assert.equal(shellExecuteBody.data.boundary.shell_used, false);
  assert.equal(shellExecuteBody.data.boundary.mcp_execution_exposed, false);

  const sentinel = 'shell-secret-sentinel';
  const shellSentinel = await executeCli(['shell', 'readiness', '--json'], {
    now: fixedNow,
    env: { TRACE_CUE_TEST_SECRET: sentinel },
    fetch: () => {
      throw new Error('shell readiness must not call fetch');
    }
  });
  assert.equal(shellSentinel.exitCode, 0);
  assert.equal(shellSentinel.stdout.includes(sentinel), false);

  const finalReadiness = await executeCli(['final', 'readiness', '--json'], { now: fixedNow });
  assert.equal(finalReadiness.exitCode, 0);
  const finalBody = JSON.parse(finalReadiness.stdout);
  assert.equal(finalBody.data.final_hardening_readiness.phase_range.start, 149);
  assert.equal(finalBody.data.final_hardening_readiness.phase_range.end, 155);
  assert.equal(finalBody.data.final_hardening_readiness.smoke_rebaseline.browser_smoke_executed_by_report, false);
  assert.equal(finalBody.data.final_hardening_readiness.local_gate_plan.every((check) => check.executed_by_report === false), true);
  assert.equal(finalBody.data.boundary.browser_launched, false);
  assert.equal(finalBody.data.boundary.remote_ci_triggered, false);
  assert.equal(finalBody.data.boundary.npm_publish_performed, false);
  assert.equal(finalBody.data.boundary.shell_used, false);
  assert.equal(buildFinalHardeningReadiness({}, { now: fixedNow }).release_boundary.legacy_alias_removed, false);
  assert.equal(finalHardeningBoundary().mcp_execution_exposed, false);

  const mcpRemovalReadiness = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 23,
    method: 'tools/call',
    params: {
      name: 'browser_debug_legacy_alias_removal_readiness',
      arguments: {}
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpRemovalReadiness.result.structuredContent.command, 'identity aliases removal-readiness');
  assert.equal(mcpRemovalReadiness.result.structuredContent.data.boundary.legacy_alias_removed, false);

  const mcpShell = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 24,
    method: 'tools/call',
    params: {
      name: 'browser_debug_shell_readiness',
      arguments: {}
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpShell.result.structuredContent.command, 'shell readiness');
  assert.equal(mcpShell.result.structuredContent.data.boundary.shell_used, false);
  assert.equal(mcpShell.result.structuredContent.data.boundary.writes_artifacts, false);
  assert.equal(mcpShell.result.structuredContent.data.boundary.deletes_files, false);

  const mcpFinal = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 25,
    method: 'tools/call',
    params: {
      name: 'browser_debug_final_readiness',
      arguments: {}
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpFinal.result.structuredContent.command, 'final readiness');
  assert.equal(mcpFinal.result.structuredContent.data.boundary.remote_ci_triggered, false);

  const mcpShellExecute = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 26,
    method: 'tools/call',
    params: {
      name: 'browser_debug_shell_readiness',
      arguments: { execute: true }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpShellExecute.error.code, -32602);
});

test('resource status reports local memory boundaries without launching a browser', async () => {
  const parsed = parseCliArgs(['resource', 'status', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'resource status');

  const result = await executeCli(['resource', 'status', '--json'], {
    now: fixedNow,
    ...createResourceStatusContext()
  });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'resource status');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.resource_status.status, 'ok');
  assert.equal(body.data.resource_status.source, 'proc_meminfo');
  assert.equal(body.data.resource_status.memory.total_bytes, 1024 * 1024 * 1024);
  assert.equal(body.data.resource_status.memory.available_ratio, 0.25);
  assert.equal(body.data.resource_status.memory.swap_used_ratio, 0.25);
  assert.equal(body.data.resource_status.cgroup.version, 'v2');
  assert.equal(body.data.resource_status.cgroup.usage_ratio, 0.5);
  assert.equal(body.data.resource_status.pressure.available, true);
  assert.equal(body.data.resource_status.process.rss_bytes, 64 * 1024 * 1024);
  assert.equal(body.data.resource_status.cache_policy.automatic_system_cache_reclamation, false);
  assert.equal(body.data.resource_status.cache_policy.automatic_swap_configuration, false);
  assert.equal(body.data.boundary.browser_launched, false);
  assert.equal(body.data.boundary.external_upload, false);
  assert.equal(body.data.boundary.profile_reuse, false);
  assert.equal(body.data.boundary.system_cache_mutated, false);
  assert.equal(body.data.boundary.swap_mutated, false);
  assert.equal(body.data.boundary.cache_deleted, false);
  assert.equal(body.data.boundary.shell_used, false);
  assert.deepEqual(body.artifacts, []);
  assert.deepEqual(body.errors, []);
});

test('resource artifacts plan and explicit cleanup stay scoped to the artifact root', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-artifacts-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  await mkdir(path.join(cwd, '.browser-debug', 'screenshots'), { recursive: true });
  await writeFile(path.join(cwd, '.browser-debug', 'screenshots', 'large-a.png'), '1234567890', 'utf8');
  await writeFile(path.join(cwd, '.browser-debug', 'screenshots', 'large-b.png'), '1234567890', 'utf8');

  const parsed = parseCliArgs(['resource', 'artifacts', 'plan', '--max-bytes', '5', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'resource artifacts plan');

  const planned = await executeCli(['resource', 'artifacts', 'plan', '--max-bytes', '5', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(planned.exitCode, 0);
  const plannedBody = JSON.parse(planned.stdout);
  assert.equal(plannedBody.command, 'resource artifacts plan');
  assert.equal(plannedBody.data.boundary.browser_launched, false);
  assert.equal(plannedBody.data.boundary.cache_deleted, false);
  assert.equal(plannedBody.data.cleanup_proposal.candidate_count >= 1, true);
  assert.match(plannedBody.data.cleanup_proposal.plan_hash, /^[a-f0-9]{64}$/);
  assert.equal(plannedBody.data.cleanup_proposal.policy.candidate_lock_algorithm, 'sha256:path-size-mtime-content');
  assert.equal(plannedBody.data.cleanup_proposal.policy.directories_deleted, false);
  assert.match(plannedBody.data.cleanup_proposal.candidates[0].lock.sha256, /^[a-f0-9]{64}$/);

  const dryRun = await executeCli(['resource', 'artifacts', 'cleanup', '--max-bytes', '5', '--dry-run', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(dryRun.exitCode, 0);
  const dryRunBody = JSON.parse(dryRun.stdout);
  assert.equal(dryRunBody.data.cleanup.dry_run, true);
  assert.equal(dryRunBody.data.boundary.cache_deleted, false);
  await access(path.join(cwd, '.browser-debug', 'screenshots', 'large-a.png'));

  const mismatched = await executeCli([
    'resource',
    'artifacts',
    'cleanup',
    '--max-bytes',
    '5',
    '--plan-hash',
    '0'.repeat(64),
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(mismatched.exitCode, 1);
  const mismatchedBody = JSON.parse(mismatched.stdout);
  assert.equal(mismatchedBody.errors[0].code, 'ARTIFACT_CLEANUP_PLAN_HASH_MISMATCH');
  await access(path.join(cwd, '.browser-debug', 'screenshots', 'large-a.png'));

  const cleaned = await executeCli(['resource', 'artifacts', 'cleanup', '--max-bytes', '5', '--execute', '--json'], {
    cwd,
    now: fixedNow,
    createId: () => 'artifact-cleanup-fixed'
  });
  assert.equal(cleaned.exitCode, 0);
  const cleanedBody = JSON.parse(cleaned.stdout);
  assert.equal(cleanedBody.data.cleanup.execute, true);
  assert.equal(cleanedBody.data.cleanup.files_deleted >= 1, true);
  assert.equal(cleanedBody.data.boundary.cache_deleted, true);
  assert.equal(cleanedBody.data.boundary.directories_deleted, false);
  assert.equal(cleanedBody.data.boundary.candidate_locks_enforced, true);
  assert.equal(cleanedBody.artifacts[0].type, 'artifact_cleanup_receipt');
  const receipt = JSON.parse(
    await readFile(path.join(cwd, '.browser-debug', 'receipts', 'artifact-cleanup-fixed.json'), 'utf8')
  );
  assert.equal(receipt.execute, true);
  assert.match(receipt.plan_hash, /^[a-f0-9]{64}$/);
  assert.equal(receipt.candidate_lock_algorithm, 'sha256:path-size-mtime-content');
  assert.equal(receipt.boundary.deletion_scope, 'artifact_root_only');

  const outside = await mkdtemp(path.join(tmpdir(), 'browser-debug-artifact-outside-'));
  const symlinkCwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-artifact-symlink-'));
  await symlink(outside, path.join(symlinkCwd, '.browser-debug'));
  const symlinkPlan = await executeCli(['resource', 'artifacts', 'plan', '--json'], {
    cwd: symlinkCwd,
    now: fixedNow
  });
  assert.equal(symlinkPlan.exitCode, 1);
  const symlinkBody = JSON.parse(symlinkPlan.stdout);
  assert.equal(symlinkBody.errors[0].code, 'ARTIFACT_USAGE_FAILED');
});

test('review resource guard can stop critical browser work before launch', async () => {
  let launches = 0;
  const result = await runReview({
    url: 'https://example.test/',
    'resource-guard': 'fail-critical'
  }, {
    now: fixedNow,
    collectResourceStatus: async () => criticalResourceStatus(),
    browserType: {
      async launch() {
        launches += 1;
        throw new Error('browser must not launch');
      }
    }
  });

  assert.equal(result.status, 'error');
  assert.equal(result.errors[0].code, 'RESOURCE_GUARD_CRITICAL');
  assert.equal(result.data.resource_guard.status, 'critical');
  assert.equal(result.data.resource_guard.stop_on_critical, true);
  assert.equal(result.data.resource_guard.boundary.browser_launched_by_guard, false);
  assert.equal(result.warnings.some((warning) => warning.code === 'RESOURCE_GUARD_CRITICAL'), true);
  assert.equal(launches, 0);
});

test('missing command produces a deterministic JSON error', async () => {
  const result = await executeCli(['--json'], { now: fixedNow });

  assert.equal(result.exitCode, 2);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'unknown');
  assert.equal(body.status, 'error');
  assert.equal(body.observed_at, fixedNow);
  assert.equal(body.errors[0].code, 'MISSING_COMMAND');
  assert.deepEqual(body.warnings, []);
  assert.deepEqual(body.artifacts, []);
});

test('observe requires an absolute URL', async () => {
  const result = await executeCli(['observe', '--json'], { now: fixedNow });

  assert.equal(result.exitCode, 2);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'observe');
  assert.equal(body.errors[0].code, 'MISSING_REQUIRED_OPTION');
  assert.equal(body.errors[0].details.option, 'url');
});

test('observe parses a URL and returns a deterministic JSON envelope', async () => {
  const result = await executeCli(
    ['observe', '--url', 'https://example.test/', '--trace', '--json'],
    {
      now: fixedNow,
      observeRunner: async (options) => ({
        status: 'ok',
        data: {
          id: 'observation-fixed',
          input_url: options.url,
          final_url: options.url,
          title: 'Fixture',
          page: { action_candidates: [] }
        },
        warnings: [],
        errors: [],
        artifacts: [{ type: 'observation', path: '.browser-debug/observations/observation-fixed.json' }]
      })
    }
  );

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'observe');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.id, 'observation-fixed');
  assert.equal(result.envelope.data.input_url, 'https://example.test/');
  assert.equal(body.artifacts[0].type, 'observation');
});

test('parser keeps the planned session command surface explicit', () => {
  const parsed = parseCliArgs(['session', 'close', '--session', 'abc123', '--json']);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'session close');
  assert.equal(parsed.json, true);
  assert.equal(parsed.options.session, 'abc123');
});

test('supervise parses actions and returns a deterministic JSON envelope', async () => {
  const result = await executeCli(
    ['supervise', '--url', 'https://example.test/', '--actions', '[{"type":"observe"}]', '--json'],
    {
      now: fixedNow,
      supervisorRunner: async (options) => ({
        status: 'ok',
        data: {
          supervision: {
            id: 'supervision-fixed',
            current_url: options.url,
            action_history: JSON.parse(options.actions)
          },
          final_observation: { title: 'Supervision Fixture' }
        },
        warnings: [],
        errors: [],
        artifacts: [{ type: 'supervision', path: '.browser-debug/sessions/supervision-fixed.json' }]
      })
    }
  );

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'supervise');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.supervision.id, 'supervision-fixed');
  assert.equal(body.data.supervision.action_history[0].type, 'observe');
});

test('review parses URL targets and returns a deterministic JSON envelope', async () => {
  const parsed = parseCliArgs(['review', '--url', 'https://example.test/', '--viewport', 'mobile', '--screenshot', '--resource-guard', 'fail-critical', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'review');
  assert.equal(parsed.options.url, 'https://example.test/');
  assert.equal(parsed.options.viewport, 'mobile');
  assert.equal(parsed.options.screenshot, true);
  assert.equal(parsed.options['resource-guard'], 'fail-critical');

  const result = await executeCli(
    ['review', '--url', 'https://example.test/', '--json'],
    {
      now: fixedNow,
      reviewRunner: async (options) => ({
        status: 'ok',
        data: {
          review: { id: 'review-fixed', mode: 'single_url', final_url: options.url },
          findings: [],
          metrics: { finding_count: 0 },
          environment: {}
        },
        warnings: [],
        errors: [],
        artifacts: [{ type: 'review', path: '.browser-debug/reviews/review-fixed.json' }]
      })
    }
  );

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'review');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.review.id, 'review-fixed');
});

test('visual evidence core records local image metadata without embedding pixels', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-visual-evidence-'));
  const png = minimalPngBuffer(2, 3);
  await writeFile(path.join(cwd, 'fixture.png'), png);
  const loaded = await readWorkspaceImageFile({ cwd, inputPath: 'fixture.png' });
  assert.equal(loaded.workspace_path, 'fixture.png');
  assert.equal(loaded.media.format, 'png');
  assert.equal(loaded.media.width, 2);
  assert.equal(loaded.media.height, 3);
  assert.equal(loaded.media.bytes, png.length);
  assert.equal(loaded.media.sha256, imageMetadata(png).sha256);

  const record = createVisualEvidenceRecord({
    id: 'visual-fixed',
    createdAt: fixedNow,
    sourceKind: 'image_file',
    sourcePath: loaded.workspace_path,
    buffer: loaded.buffer,
    labels: ['standalone_image']
  });
  assert.equal(record.boundary.local_only, true);
  assert.equal(record.boundary.external_upload, false);
  assert.equal(record.boundary.provider_call_performed, false);
  assert.equal(record.boundary.raw_pixels_in_json, false);
  assert.equal(JSON.stringify(record).includes(png.toString('base64')), false);
  assert.equal(record.privacy.requires_owner_review_before_external_transfer, true);

  const root = await ensureArtifactRoot(cwd);
  record.boundary = {
    ...record.boundary,
    external_upload: true,
    provider_call_performed: true,
    binary_content_included: true,
    mcp_execution_exposed: true
  };
  const written = await writeVisualEvidenceRecord({ id: 'visual-fixed', root, artifactRoot: '.browser-debug', record });
  assert.equal(written.artifact.type, 'visual_evidence');
  assert.equal(written.artifact.path, '.browser-debug/visual-evidence/visual-fixed.json');
  const persisted = JSON.parse(await readFile(path.join(cwd, written.artifact.path), 'utf8'));
  assert.equal(persisted.media.sha256, record.media.sha256);
  assert.equal(persisted.boundary.external_upload, false);
  assert.equal(persisted.boundary.provider_call_performed, false);
  assert.equal(persisted.boundary.binary_content_included, false);
  assert.equal(persisted.boundary.mcp_execution_exposed, false);

  const outside = await mkdtemp(path.join(tmpdir(), 'trace-cue-visual-outside-'));
  await writeFile(path.join(outside, 'outside.png'), png);
  await assert.rejects(
    () => readWorkspaceImageFile({ cwd, inputPath: path.relative(cwd, path.join(outside, 'outside.png')) }),
    /must stay inside the current workspace/
  );
});

test('visual review provider policy stays planning-only and strips raw image transfer by default', () => {
  const policy = buildVisualReviewProviderPolicy({
    disclosureMode: 'explicit_image_transfer',
    agentPackage: {
      packet: {
        evidence_packet: {
          artifacts: [
            { type: 'visual_evidence', path: '.browser-debug/visual-evidence/visual-fixed.json', content_included: false },
            { type: 'screenshot', path: '.browser-debug/screenshots/page.png', content_included: false }
          ]
        }
      }
    },
    surface: { id: 'local-subscription-agent', kind: 'subscription_surface', transport: 'local_files' },
    provider: { id: 'fake-agent', kind: 'local_runner', implemented: true },
    model: { id: 'fake-model', selected: true }
  });

  assert.equal(policy.status, 'blocked_external_transfer_requires_owner_review');
  assert.equal(policy.disclosure.raw_pixels_included, false);
  assert.equal(policy.disclosure.external_evidence_transfer_authorized, false);
  assert.equal(policy.disclosure.provider_execution_authorized, false);
  assert.equal(policy.execution.provider_call_performed, false);
  assert.equal(policy.execution.mcp_execution_exposed, false);
  assert.equal(policy.visual_evidence.visual_evidence_reference_count, 1);
  assert.equal(visualReviewProviderBoundary().future_execute_required, true);
  assert.equal(normalizeVisualReviewDisclosureMode('local_reference'), 'local_reference');
  assert.throws(() => normalizeVisualReviewDisclosureMode('raw_pixels'), /Unsupported visual review disclosure mode/);
});

test('standalone image review reads a workspace image without launching a browser or embedding pixels', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-image-review-'));
  const png = minimalPngBuffer(120, 80);
  await writeFile(path.join(cwd, 'screen.png'), png);

  const parsed = parseCliArgs(['review', '--image', 'screen.png', '--report', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'review');
  assert.equal(parsed.options.image, 'screen.png');
  assert.equal(parseCliArgs(['review', '--image', 'https://example.test/a.png', '--json']).ok, false);
  assert.equal(parseCliArgs(['review', '--image', '../screen.png', '--json']).ok, false);
  assert.equal(parseCliArgs(['review', '--image', 'screen.png', '--provider', 'fake-agent', '--json']).ok, false);

  const result = await executeCli(['review', '--image', 'screen.png', '--report', '--json'], {
    cwd,
    now: fixedNow,
    createId: () => 'image-review-fixed'
  });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'review');
  assert.equal(body.data.review.mode, 'image_file');
  assert.equal(body.data.metrics.width, 120);
  assert.equal(body.data.metrics.height, 80);
  assert.equal(body.data.boundary.browser_launched, false);
  assert.equal(body.data.boundary.provider_call_performed, false);
  assert.equal(body.data.boundary.raw_pixels_in_json, false);
  assert.equal(body.data.boundary.workspace_confined_input, true);
  assert.equal(JSON.stringify(body.data).includes(png.toString('base64')), false);
  assert.equal(body.artifacts.some((artifact) => artifact.type === 'image_review'), true);
  assert.equal(body.artifacts.some((artifact) => artifact.type === 'visual_evidence'), true);
  assert.equal(body.artifacts.some((artifact) => artifact.type === 'review_artifact_index'), true);
  assert.equal(body.artifacts.some((artifact) => artifact.type === 'image_review_report'), true);

  const imageReviewFile = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'reviews', 'image-review-fixed.json'), 'utf8'));
  assert.equal(imageReviewFile.image_review.visual_evidence.boundary.provider_call_performed, false);
  assert.equal(imageReviewFile.evidence_summary.binary_content_included, false);
  assert.equal(imageReviewFile.artifact_index.evidence_classes.includes('visual evidence metadata'), true);
  const imageReviewIndex = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'review-artifacts', 'image-review-fixed.json'), 'utf8'));
  assert.equal(imageReviewIndex.mode, 'image_file');
  assert.equal(imageReviewIndex.boundaries.provider_call_performed, false);

  const direct = await runImageReview({ image: 'screen.png' }, {
    cwd,
    now: fixedNow,
    createId: () => 'image-review-direct'
  });
  assert.equal(direct.status, 'ok');
  assert.equal(direct.data.boundary.external_upload, false);
});

test('desktop image review preserves caller-declared desktop provenance through visual preparation', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-desktop-image-review-'));
  const png = minimalPngBuffer(240, 160);
  await writeFile(path.join(cwd, 'desktop.png'), png);

  const handoff = await executeCli(['capture', 'handoff', '--image', 'desktop.png', '--source', 'desktop-app', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(handoff.exitCode, 0);
  const handoffBody = JSON.parse(handoff.stdout);
  await writeFile(path.join(cwd, 'handoff.json'), JSON.stringify(handoffBody, null, 2));

  const parsed = parseCliArgs(['review', '--image', 'desktop.png', '--capture-handoff', 'handoff.json', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.options['capture-handoff'], 'handoff.json');
  assert.equal(parseCliArgs(['review', '--image', 'desktop.png', '--source', 'desktop-app', '--json']).ok, true);
  assert.equal(parseCliArgs(['review', '--image', 'desktop.png', '--source', 'all', '--json']).ok, false);
  assert.equal(parseCliArgs(['review', '--url', 'https://example.test', '--source', 'desktop-app', '--json']).ok, false);
  assert.equal(parseCliArgs(['review', '--url', 'https://example.test', '--capture-handoff', 'handoff.json', '--json']).ok, false);

  const review = await executeCli(['review', '--image', 'desktop.png', '--capture-handoff', 'handoff.json', '--json'], {
    cwd,
    now: fixedNow,
    createId: () => 'desktop-image-review-fixed'
  });
  assert.equal(review.exitCode, 0);
  const reviewBody = JSON.parse(review.stdout);
  assert.equal(reviewBody.data.review.mode, 'image_file');
  assert.equal(reviewBody.data.review.source_kind, 'desktop_app_capture');
  assert.equal(reviewBody.data.review.source_selection, 'desktop-app');
  assert.equal(reviewBody.data.review.source_verified_by_trace_cue, false);
  assert.equal(reviewBody.data.review.capture_handoff_id, handoffBody.data.capture_handoff.id);
  assert.equal(reviewBody.data.image_review.source.kind, 'desktop_app_capture');
  assert.equal(reviewBody.data.image_review.source.caller_declared_provenance, true);
  assert.equal(reviewBody.data.image_review.capture_handoff.input_path, 'handoff.json');
  assert.equal(reviewBody.data.image_review.capture_handoff.media_sha256_matched, true);
  assert.equal(reviewBody.data.evidence_summary.capture_handoff_path, 'handoff.json');
  assert.equal(typeof reviewBody.data.evidence_summary.capture_handoff_hash, 'string');
  assert.equal(reviewBody.data.boundary.capture_handoff_json_read, true);
  assert.equal(reviewBody.data.boundary.capture_handoff_media_sha256_matched, true);
  assert.equal(reviewBody.data.boundary.capture_performed_by_trace_cue, false);
  assert.equal(reviewBody.data.boundary.os_capture_api_used, false);
  assert.equal(JSON.stringify(reviewBody.data).includes(png.toString('base64')), false);

  const visualEvidence = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'visual-evidence', 'desktop-image-review-fixed.json'), 'utf8'));
  assert.equal(visualEvidence.source.kind, 'desktop_app_capture');
  assert.equal(visualEvidence.capture.handoff_id, handoffBody.data.capture_handoff.id);
  assert.equal(visualEvidence.capture.media_sha256_matched, true);
  assert.equal(visualEvidence.privacy.may_contain_desktop_content, true);
  assert.equal(visualEvidence.boundary.raw_pixels_in_json, false);

  const index = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'review-artifacts', 'desktop-image-review-fixed.json'), 'utf8'));
  assert.match(index.rerun.command, /--capture-handoff handoff\.json/);
  assert.equal(index.boundaries.source_verified_by_trace_cue, false);
  assert.equal(index.boundaries.capture_handoff_json_read, true);
  assert.equal(index.boundaries.capture_handoff_media_sha256_matched, true);
  assert.equal(index.boundaries.provider_call_performed, false);

  const preparation = await executeCli([
    'visual',
    'review',
    'prepare',
    '--review-index',
    '.browser-debug/review-artifacts/desktop-image-review-fixed.json',
    '--surface',
    'desktop-app',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'desktop-visual-preparation-fixed'
  });
  assert.equal(preparation.exitCode, 0);
  const preparationBody = JSON.parse(preparation.stdout);
  assert.equal(preparationBody.data.visual_review_result_preparation.visual_evidence.references[0].source.kind, 'desktop_app_capture');
  assert.equal(preparationBody.data.visual_review_result_preparation.visual_evidence.references[0].privacy.may_contain_desktop_content, true);
  assert.equal(preparationBody.data.visual_review_result_preparation.provider_policy.execution.provider_call_performed, false);
  assert.equal(preparationBody.data.visual_review_result_preparation.execution.mcp_execution_exposed, false);

  const pathMismatch = {
    ...handoffBody,
    data: {
      ...handoffBody.data,
      capture_handoff: {
        ...handoffBody.data.capture_handoff,
        source: {
          ...handoffBody.data.capture_handoff.source,
          path: 'other.png'
        }
      }
    }
  };
  await writeFile(path.join(cwd, 'path-mismatch.json'), JSON.stringify(pathMismatch, null, 2));
  const mismatch = await executeCli(['review', '--image', 'desktop.png', '--capture-handoff', 'path-mismatch.json', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(mismatch.exitCode, 1);
  assert.equal(JSON.parse(mismatch.stdout).errors[0].code, 'IMAGE_REVIEW_CAPTURE_HANDOFF_IMAGE_MISMATCH');

  const hashMismatch = {
    ...handoffBody,
    data: {
      ...handoffBody.data,
      capture_handoff: {
        ...handoffBody.data.capture_handoff,
        media: {
          ...handoffBody.data.capture_handoff.media,
          sha256: '0'.repeat(64)
        }
      }
    }
  };
  await writeFile(path.join(cwd, 'hash-mismatch.json'), JSON.stringify(hashMismatch, null, 2));
  const badHash = await executeCli(['review', '--image', 'desktop.png', '--capture-handoff', 'hash-mismatch.json', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(badHash.exitCode, 1);
  assert.equal(JSON.parse(badHash.stdout).errors[0].code, 'IMAGE_REVIEW_CAPTURE_HANDOFF_HASH_MISMATCH');
});

test('visual review prepare writes metadata-only result preparation without provider execution', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-visual-prepare-'));
  const png = minimalPngBuffer(120, 80);
  await writeFile(path.join(cwd, 'screen.png'), png);

  const imageReview = await executeCli(['review', '--image', 'screen.png', '--json'], {
    cwd,
    now: fixedNow,
    createId: () => 'image-review-fixed'
  });
  assert.equal(imageReview.exitCode, 0);

  const parsed = parseCliArgs([
    'visual',
    'review',
    'prepare',
    '--review-index',
    '.browser-debug/review-artifacts/image-review-fixed.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--json'
  ]);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'visual review prepare');
  assert.equal(parseCliArgs(['visual', 'review', 'prepare', '--review-index', '.browser-debug/review-artifacts/image-review-fixed.json', '--execute', '--json']).ok, false);

  const result = await executeCli([
    'visual',
    'review',
    'prepare',
    '--review-index',
    '.browser-debug/review-artifacts/image-review-fixed.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'visual-review-preparation-fixed'
  });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'visual review prepare');
  const preparation = body.data.visual_review_result_preparation;
  assert.equal(preparation.status, 'prepared');
  assert.equal(preparation.visual_evidence.metadata_only, true);
  assert.equal(preparation.visual_evidence.readable_count, 1);
  assert.equal(preparation.visual_evidence.references[0].media.width, 120);
  assert.equal(preparation.disclosure_policy.raw_pixels_included, false);
  assert.equal(preparation.disclosure_policy.raw_artifact_content_included, false);
  assert.equal(preparation.provider_policy.execution.provider_call_performed, false);
  assert.equal(preparation.execution.enabled, false);
  assert.equal(preparation.execution.execute_supported, false);
  assert.equal(preparation.execution.mcp_execution_exposed, false);
  assert.equal(preparation.boundary.existing_review_mutated, false);
  assert.equal(preparation.result_contract.required_output_schema, 'visual_review_result');
  assert.equal(body.data.visual_review_result_template.status, 'not_run');
  assert.equal(JSON.stringify(body.data).includes(png.toString('base64')), false);
  assert.equal(body.artifacts.some((artifact) => artifact.type === 'visual_review_result_preparation'), true);
  assert.equal(body.artifacts.some((artifact) => artifact.type === 'visual_review_result_preparation_receipt'), true);

  const preparationFile = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'visual-review-results', 'visual-review-preparation-fixed', 'preparation.json'), 'utf8'));
  assert.equal(preparationFile.raw_pixels_included, false);
  assert.equal(preparationFile.provider_call_performed, false);
  const receiptFile = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'receipts', 'visual-review-preparation-fixed.json'), 'utf8'));
  assert.equal(receiptFile.raw_pixels_included, false);
  assert.equal(receiptFile.provider_call_performed, false);

  const direct = await runVisualReviewResultPreparation({
    'review-index': '.browser-debug/review-artifacts/image-review-fixed.json'
  }, {
    cwd,
    now: fixedNow,
    createId: () => 'visual-review-preparation-direct'
  });
  assert.equal(direct.status, 'ok');
  assert.equal(direct.data.boundary.external_evidence_transfer, false);
  assert.equal(visualReviewResultPreparationBoundary().mcp_execution_exposed, false);
});

test('visual review run executes metadata-only visual review providers and writes normalized results', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-visual-run-'));
  const png = minimalPngBuffer(120, 80);
  await writeFile(path.join(cwd, 'screen.png'), png);

  const imageReview = await executeCli(['review', '--image', 'screen.png', '--json'], {
    cwd,
    now: fixedNow,
    createId: () => 'image-review-visual-run'
  });
  assert.equal(imageReview.exitCode, 0);

  const preparation = await executeCli([
    'visual',
    'review',
    'prepare',
    '--review-index',
    '.browser-debug/review-artifacts/image-review-visual-run.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'visual-review-preparation-run'
  });
  assert.equal(preparation.exitCode, 0);

  const parsed = parseCliArgs([
    'visual',
    'review',
    'run',
    '--preparation',
    '.browser-debug/visual-review-results/visual-review-preparation-run/preparation.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--execute',
    '--json'
  ]);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'visual review run');
  assert.equal(parseCliArgs([
    'visual',
    'review',
    'run',
    '--preparation',
    '.browser-debug/visual-review-results/visual-review-preparation-run/preparation.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--json'
  ]).ok, false);

  const run = await executeCli([
    'visual',
    'review',
    'run',
    '--preparation',
    '.browser-debug/visual-review-results/visual-review-preparation-run/preparation.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: (prefix) => prefix === 'visual-review-execution' ? 'visual-review-execution-fixed' : 'visual-review-result-fixed'
  });
  assert.equal(run.exitCode, 0);
  const body = JSON.parse(run.stdout);
  assert.equal(body.command, 'visual review run');
  assert.equal(body.data.visual_review_execution.status, 'completed');
  assert.equal(body.data.visual_review_execution.result_path, '.browser-debug/visual-review-results/visual-review-execution-fixed/result.json');
  assert.equal(body.data.visual_review_execution.provider_call_performed, true);
  assert.equal(body.data.visual_review_execution.api_call_performed, false);
  assert.equal(body.data.visual_review_execution.external_evidence_transfer, false);
  assert.equal(body.data.visual_review_execution.raw_pixels_included, false);
  assert.equal(body.data.visual_review_execution.raw_pixels_read, false);
  assert.equal(body.data.visual_review_execution.raw_pixels_transferred, false);
  assert.equal(body.data.visual_review_execution.raw_provider_response_stored, false);
  assert.equal(body.data.visual_review_execution.existing_review_mutated, false);
  assert.equal(body.data.visual_review_execution.mcp_execution_exposed, false);
  assert.equal(body.data.visual_review_result.status, 'completed');
  assert.equal(body.artifacts.some((artifact) => artifact.type === 'visual_review_result'), true);
  assert.equal(body.artifacts.some((artifact) => artifact.type === 'visual_review_execution'), true);
  assert.equal(JSON.stringify(body.data).includes(png.toString('base64')), false);

  const resultFile = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'visual-review-results', 'visual-review-execution-fixed', 'result.json'), 'utf8'));
  assert.equal(resultFile.status, 'completed');
  assert.equal(resultFile.visual_review_result.untrusted_model_output, true);
  assert.equal(resultFile.boundary.raw_pixels_included, false);
  assert.equal(resultFile.boundary.raw_provider_response_stored, false);
  const executionFile = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'visual-review-results', 'visual-review-execution-fixed', 'execution.json'), 'utf8'));
  assert.equal(executionFile.dashboard_handoff.status_command, 'trace-cue visual review status --execution .browser-debug/visual-review-results/visual-review-execution-fixed/execution.json --json');
  const receiptFile = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'receipts', 'visual-review-execution-fixed-visual-review-run.json'), 'utf8'));
  assert.equal(receiptFile.raw_pixels_included, false);
  assert.equal(receiptFile.raw_provider_response_stored, false);

  const status = await executeCli([
    'visual',
    'review',
    'status',
    '--execution',
    '.browser-debug/visual-review-results/visual-review-execution-fixed/execution.json',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(status.exitCode, 0);
  assert.equal(JSON.parse(status.stdout).data.visual_review_execution_status.status, 'completed');

  const list = await executeCli(['visual', 'review', 'list', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(list.exitCode, 0);
  const listBody = JSON.parse(list.stdout);
  assert.equal(listBody.data.summary.total, 1);
  assert.equal(listBody.data.summary.completed, 1);
  assert.equal(listBody.data.summary.raw_pixels_included, false);

  const direct = await runVisualReviewExecutionRun({
    preparation: '.browser-debug/visual-review-results/visual-review-preparation-run/preparation.json',
    surface: 'local-subscription-agent',
    provider: 'fake-agent',
    model: 'fake-model',
    execute: true
  }, {
    cwd,
    now: fixedNow,
    createId: (prefix) => prefix === 'visual-review-execution' ? 'visual-review-execution-direct' : 'visual-review-result-direct'
  });
  assert.equal(direct.status, 'ok');
  assert.equal(direct.data.boundary.raw_pixels_transferred, false);
  assert.equal(visualReviewExecutionBoundary().mcp_execution_exposed, false);
});

test('visual review aggregate combines local visual review results without provider calls or writes', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-visual-aggregate-'));
  await mkdir(path.join(cwd, '.browser-debug', 'visual-review-results', 'prep'), { recursive: true });
  await mkdir(path.join(cwd, '.browser-debug', 'visual-review-results', 'agent-a'), { recursive: true });
  await mkdir(path.join(cwd, '.browser-debug', 'visual-review-results', 'agent-b'), { recursive: true });
  await mkdir(path.join(cwd, '.browser-debug', 'visual-review-results', 'broken'), { recursive: true });

  const preparation = {
    schema_version: '0.1.0',
    id: 'prep-aggregate',
    status: 'prepared',
    visual_evidence: { references: [] }
  };
  await writeFile(path.join(cwd, '.browser-debug', 'visual-review-results', 'prep', 'preparation.json'), JSON.stringify(preparation, null, 2));

  const baseResult = {
    schema_version: '0.1.0',
    status: 'needs_owner_review',
    preparation_id: 'prep-aggregate',
    preparation_path: '.browser-debug/visual-review-results/prep/preparation.json',
    visual_review_result: {
      summary: 'Visual review advisory only.'
    },
    boundary: {
      provider_call_performed: true,
      api_call_performed: false,
      external_evidence_transfer: false,
      raw_pixels_included: false,
      raw_provider_response_stored: false
    }
  };
  await writeFile(path.join(cwd, '.browser-debug', 'visual-review-results', 'agent-a', 'result.json'), JSON.stringify({
    ...baseResult,
    id: 'result-a',
    execution_id: 'agent-a',
    provider: { id: 'fake-agent', kind: 'deterministic_fake' },
    model: { id: 'model-a' },
    advisory_findings: [{
      id: 'finding-a',
      category: 'layout_integrity',
      severity: 'medium',
      message: 'Primary action alignment needs owner review.',
      recommendation: 'Review the primary action placement with the owner.'
    }],
    owner_decision_requests: [{
      id: 'decision-a',
      question: 'Should the primary action stay in this position?'
    }]
  }, null, 2));
  await writeFile(path.join(cwd, '.browser-debug', 'visual-review-results', 'agent-a', 'execution.json'), JSON.stringify({
    id: 'agent-a',
    status: 'completed'
  }, null, 2));
  await writeFile(path.join(cwd, '.browser-debug', 'visual-review-results', 'agent-b', 'result.json'), JSON.stringify({
    ...baseResult,
    id: 'result-b',
    execution_id: 'agent-b',
    provider: { id: 'local-runner', kind: 'local_callback' },
    model: { id: 'model-b' },
    advisory_findings: [{
      id: 'finding-b',
      category: 'layout_integrity',
      severity: 'high',
      message: 'Primary action alignment needs owner review.',
      recommendation: 'Review the primary action placement with the owner.'
    }]
  }, null, 2));
  await writeFile(path.join(cwd, '.browser-debug', 'visual-review-results', 'broken', 'result.json'), '{');

  const parsed = parseCliArgs(['visual', 'review', 'aggregate', '--preparation', '.browser-debug/visual-review-results/prep/preparation.json', '--limit', '10', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'visual review aggregate');
  assert.equal(parseCliArgs(['visual', 'review', 'aggregate', '--preparation', '.browser-debug/visual-review-results/prep/preparation.json', '--execute', '--json']).ok, false);
  assert.equal(parseCliArgs(['visual', 'review', 'aggregate', '--preparation', '.browser-debug/visual-review-results/prep/preparation.json', '--provider', 'fake-agent', '--json']).ok, false);

  const result = await executeCli(['visual', 'review', 'aggregate', '--preparation', '.browser-debug/visual-review-results/prep/preparation.json', '--limit', '10', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'visual review aggregate');
  const aggregation = body.data.visual_review_aggregation;
  assert.equal(aggregation.status, 'completed');
  assert.equal(aggregation.summary.result_count, 2);
  assert.equal(aggregation.summary.review_agent_count, 2);
  assert.equal(aggregation.summary.corroborated_finding_count, 1);
  assert.equal(aggregation.summary.conflict_count, 1);
  assert.equal(aggregation.aggregation_findings[0].status, 'corroborated');
  assert.deepEqual(aggregation.aggregation_findings[0].source_severities, ['medium', 'high']);
  assert.equal(aggregation.owner_decision_requests.length, 1);
  assert.equal(aggregation.source_effects.provider_call_performed, true);
  assert.equal(aggregation.boundary.provider_call_performed, false);
  assert.equal(aggregation.boundary.writes_artifacts, false);
  assert.equal(aggregation.boundary.raw_pixels_read, false);
  assert.equal(aggregation.boundary.mcp_execution_exposed, false);
  assert.deepEqual(body.artifacts, []);
  assert.equal(JSON.stringify(body.data).includes('secret-provider-payload'), false);
  assert.ok(body.warnings.some((warning) => warning.code === 'VISUAL_REVIEW_AGGREGATION_ARTIFACT_INVALID_JSON'));

  const direct = await runVisualReviewAggregation({
    preparation: '.browser-debug/visual-review-results/prep/preparation.json',
    limit: 10
  }, { cwd, now: fixedNow });
  assert.equal(direct.status, 'ok');
  assert.equal(direct.data.visual_review_aggregation.summary.result_count, 2);
  assert.equal(visualReviewAggregationBoundary().mcp_execution_exposed, false);
});

test('visual review dashboard aggregates local visual review status without writes', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-visual-dashboard-'));
  const png = minimalPngBuffer(120, 80);
  await writeFile(path.join(cwd, 'screen.png'), png);

  const imageReview = await executeCli(['review', '--image', 'screen.png', '--json'], {
    cwd,
    now: fixedNow,
    createId: () => 'image-review-dashboard'
  });
  assert.equal(imageReview.exitCode, 0);

  const preparation = await executeCli([
    'visual',
    'review',
    'prepare',
    '--review-index',
    '.browser-debug/review-artifacts/image-review-dashboard.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'visual-review-preparation-dashboard'
  });
  assert.equal(preparation.exitCode, 0);

  const run = await executeCli([
    'visual',
    'review',
    'run',
    '--preparation',
    '.browser-debug/visual-review-results/visual-review-preparation-dashboard/preparation.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: (prefix) => prefix === 'visual-review-execution' ? 'visual-review-execution-dashboard' : 'visual-review-result-dashboard'
  });
  assert.equal(run.exitCode, 0);

  const parsed = parseCliArgs(['visual', 'review', 'dashboard', '--limit', '10', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'visual review dashboard');

  const dashboard = await executeCli(['visual', 'review', 'dashboard', '--limit', '10', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(dashboard.exitCode, 0);
  const body = JSON.parse(dashboard.stdout);
  assert.equal(body.command, 'visual review dashboard');
  assert.equal(body.data.visual_review_dashboard.status, 'ready');
  assert.equal(body.data.visual_review_dashboard.summary.preparation_count, 1);
  assert.equal(body.data.visual_review_dashboard.summary.execution_count, 1);
  assert.equal(body.data.visual_review_dashboard.summary.result_count, 1);
  assert.equal(body.data.visual_review_dashboard.summary.provider_call_performed, true);
  assert.equal(body.data.visual_review_dashboard.language_settings.dashboard_ui.locale, 'en');
  assert.equal(body.data.visual_review_dashboard.language_settings.artifact_output.translation_execution_enabled, false);
  assert.equal(body.data.visual_review_dashboard.boundary.read_only, true);
  assert.equal(body.data.visual_review_dashboard.boundary.writes_artifacts, false);
  assert.equal(body.data.visual_review_dashboard.boundary.provider_call_performed, false);
  assert.equal(body.data.visual_review_dashboard.boundary.raw_pixels_read, false);
  assert.equal(body.data.visual_review_dashboard.control_center_handoff.mcp_tool, 'browser_debug_visual_review_dashboard');
  assert.equal(body.data.visual_review_dashboard.control_center_handoff.language_settings_command, 'trace-cue settings language --json');
  assert.equal(body.data.visual_review_dashboard.gate_effect, 'none');
  assert.deepEqual(body.artifacts, []);
  assert.equal(JSON.stringify(body.data).includes(png.toString('base64')), false);

  const direct = await runVisualReviewDashboard({}, { cwd, now: fixedNow });
  assert.equal(direct.status, 'ok');
  assert.equal(direct.data.visual_review_dashboard.status, 'ready');
  assert.equal(direct.data.boundary.read_only, true);
  assert.equal(visualReviewDashboardBoundary().mcp_write_execute_exposed, false);

  const mcpDashboard = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 45,
    method: 'tools/call',
    params: {
      name: 'browser_debug_visual_review_dashboard',
      arguments: { limit: 10 }
    }
  }, { cwd, mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpDashboard.result.structuredContent.command, 'visual review dashboard');
  assert.equal(mcpDashboard.result.structuredContent.data.visual_review_dashboard.summary.execution_count, 1);
  assert.equal(mcpDashboard.result.structuredContent.data.visual_review_dashboard.language_settings.dashboard_ui.locale, 'en');
  assert.equal(mcpDashboard.result.structuredContent.data.boundary.read_only, true);
});

test('visual review run blocks unsafe preparation states', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-visual-run-blocked-'));
  await mkdir(path.join(cwd, '.browser-debug', 'visual-review-results', 'blocked'), { recursive: true });
  await writeFile(path.join(cwd, '.browser-debug', 'visual-review-results', 'blocked', 'preparation.json'), JSON.stringify({
    schema_version: '0.1.0',
    id: 'blocked-preparation',
    status: 'blocked_missing_visual_evidence',
    result_contract: { required_output_schema: 'visual_review_result' },
    visual_evidence: { readable_count: 0, references: [] },
    provider_policy: { surface: { id: 'local-subscription-agent' }, provider: { id: 'fake-agent' }, model: { id: 'fake-model' } },
    disclosure_policy: { raw_pixels_included: false, raw_artifact_content_included: false },
    boundary: {}
  }, null, 2), 'utf8');

  const blocked = await executeCli([
    'visual',
    'review',
    'run',
    '--preparation',
    '.browser-debug/visual-review-results/blocked/preparation.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(blocked.exitCode, 1);
  assert.equal(JSON.parse(blocked.stdout).errors[0].code, 'VISUAL_REVIEW_PREPARATION_NOT_RUNNABLE');

  await writeFile(path.join(cwd, '.browser-debug', 'visual-review-results', 'blocked', 'preparation.json'), JSON.stringify({
    schema_version: '0.1.0',
    id: 'unsafe-preparation',
    status: 'prepared',
    result_contract: { required_output_schema: 'visual_review_result' },
    visual_evidence: { readable_count: 1, references: [{ path: '.browser-debug/visual-evidence/example.json' }] },
    provider_policy: { surface: { id: 'local-subscription-agent' }, provider: { id: 'fake-agent' }, model: { id: 'fake-model' } },
    disclosure_policy: { raw_pixels_included: true, raw_artifact_content_included: false },
    boundary: {}
  }, null, 2), 'utf8');

  const unsafe = await executeCli([
    'visual',
    'review',
    'run',
    '--preparation',
    '.browser-debug/visual-review-results/blocked/preparation.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(unsafe.exitCode, 1);
  assert.equal(JSON.parse(unsafe.stdout).errors[0].code, 'VISUAL_REVIEW_PREPARATION_UNSUPPORTED_DISCLOSURE');
});

test('visual review run can use local and API providers without storing credentials or raw responses', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-visual-run-provider-'));
  await mkdir(path.join(cwd, '.browser-debug', 'visual-review-results', 'prepared'), { recursive: true });
  const preparation = {
    schema_version: '0.1.0',
    id: 'provider-preparation',
    status: 'prepared',
    result_contract: { required_output_schema: 'visual_review_result' },
    visual_evidence: {
      readable_count: 1,
      references: [{
        id: 'visual-evidence-1',
        path: '.browser-debug/visual-evidence/visual-evidence-1.json',
        media: { width: 100, height: 80, sha256: 'hash' }
      }]
    },
    provider_policy: {
      surface: { id: null },
      provider: { id: null },
      model: { id: null }
    },
    disclosure_policy: {
      raw_pixels_included: false,
      raw_artifact_content_included: false,
      binary_content_included: false,
      screenshot_binary_included: false,
      raw_dom_included: false,
      trace_content_included: false,
      raw_console_payloads_included: false,
      raw_network_payloads_included: false,
      raw_report_body_included: false,
      source_data_values_included: false
    },
    boundary: {}
  };
  await writeFile(path.join(cwd, '.browser-debug', 'visual-review-results', 'prepared', 'preparation.json'), JSON.stringify(preparation, null, 2), 'utf8');

  const localRun = await executeCli([
    'visual',
    'review',
    'run',
    '--preparation',
    '.browser-debug/visual-review-results/prepared/preparation.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'local-runner',
    '--model',
    'local-agent',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: (prefix) => prefix === 'visual-review-execution' ? 'visual-review-execution-local' : 'visual-review-result-local',
    visualReviewLocalRunner: async ({ preparation_path: preparationPath }) => ({
      summary: `Local visual review used ${preparationPath}.`,
      advisory_findings: [{
        id: 'visual-local-finding',
        category: 'layout_integrity',
        severity: 'medium',
        message: 'Local visual review advisory.',
        recommendation: 'Review the local visual advisory.'
      }],
      owner_decision_requests: []
    })
  });
  assert.equal(localRun.exitCode, 0);
  const localBody = JSON.parse(localRun.stdout);
  assert.equal(localBody.data.visual_review_execution.provider_call_performed, true);
  assert.equal(localBody.data.visual_review_execution.api_call_performed, false);
  const localResult = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'visual-review-results', 'visual-review-execution-local', 'result.json'), 'utf8'));
  assert.equal(localResult.advisory_findings.length, 1);
  assert.equal(localResult.status, 'needs_owner_review');

  const apiMissing = await executeCli([
    'visual',
    'review',
    'run',
    '--preparation',
    '.browser-debug/visual-review-results/prepared/preparation.json',
    '--surface',
    'generic-api-provider',
    '--provider',
    'generic-api-provider',
    '--model',
    'generic-model',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: (prefix) => prefix === 'visual-review-execution' ? 'visual-review-execution-api-missing' : 'visual-review-result-api-missing',
    env: {}
  });
  assert.equal(apiMissing.exitCode, 1);
  assert.equal(JSON.parse(apiMissing.stdout).errors[0].code, 'VISUAL_REVIEW_API_CONFIGURATION_MISSING');

  const apiCalls = [];
  const apiRun = await executeCli([
    'visual',
    'review',
    'run',
    '--preparation',
    '.browser-debug/visual-review-results/prepared/preparation.json',
    '--surface',
    'generic-api-provider',
    '--provider',
    'generic-api-provider',
    '--model',
    'generic-model',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: (prefix) => prefix === 'visual-review-execution' ? 'visual-review-execution-api' : 'visual-review-result-api',
    env: {
      [API_PROVIDER_ENDPOINT_ENV]: 'https://provider.example.test/visual-review',
      [API_PROVIDER_CREDENTIAL_ENV]: 'credential-value-for-test'
    },
    fetch: async (url, init) => {
      apiCalls.push({ url, init, body: JSON.parse(init.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          visual_review_result: {
            summary: 'API visual review advisory.',
            advisory_findings: [{
              id: 'api-visual-finding',
              category: 'visual_hierarchy',
              severity: 'low',
              message: 'API visual review advisory.',
              recommendation: 'Review the API visual advisory.'
            }],
            owner_decision_requests: []
          }
        })
      };
    }
  });
  assert.equal(apiRun.exitCode, 0);
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].body.type, 'visual_review_request');
  assert.equal(apiCalls[0].body.disclosure_policy.raw_pixels_included, false);
  assert.equal(apiCalls[0].body.disclosure_policy.raw_artifact_content_included, false);
  assert.equal(apiCalls[0].body.visual_evidence.references[0].content_included, false);
  assert.match(apiCalls[0].init.headers.authorization, /^Bearer /);
  const apiBody = JSON.parse(apiRun.stdout);
  assert.equal(apiBody.data.visual_review_execution.api_call_performed, true);
  assert.equal(apiBody.data.visual_review_execution.external_evidence_transfer, true);
  assert.equal(apiBody.data.visual_review_execution.credential_values_recorded, false);
  assert.equal(apiBody.data.visual_review_execution.raw_provider_response_stored, false);
  const apiResultText = await readFile(path.join(cwd, '.browser-debug', 'visual-review-results', 'visual-review-execution-api', 'result.json'), 'utf8');
  assert.equal(apiResultText.includes('credential-value-for-test'), false);
});

test('visual review prepare blocks indexes without visual evidence metadata', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-visual-prepare-empty-'));
  await mkdir(path.join(cwd, '.browser-debug', 'review-artifacts'), { recursive: true });
  await writeFile(path.join(cwd, '.browser-debug', 'review-artifacts', 'empty.json'), JSON.stringify({
    schema_version: '0.1.0',
    id: 'empty',
    mode: 'image_file',
    local_only: true,
    artifact_root: '.browser-debug',
    evidence_classes: [],
    artifacts: [],
    boundaries: {}
  }, null, 2), 'utf8');

  const result = await executeCli([
    'visual',
    'review',
    'prepare',
    '--review-index',
    '.browser-debug/review-artifacts/empty.json',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'visual-review-preparation-empty'
  });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.data.visual_review_result_preparation.status, 'blocked_missing_visual_evidence');
  assert.equal(body.data.visual_review_result_preparation.visual_evidence.readable_count, 0);
  assert.equal(body.data.visual_review_result_preparation.execution.provider_call_performed, false);
});

test('schema commands expose machine-readable contracts', async () => {
  const listed = await executeCli(['schema', 'list', '--json'], { now: fixedNow });
  assert.equal(listed.exitCode, 0);
  const listedBody = JSON.parse(listed.stdout);
  assert.equal(listedBody.command, 'schema list');
  assert.ok(listedBody.data.schemas.some((schema) => schema.name === 'review'));

  const fetched = await executeCli(['schema', 'get', '--name', 'finding', '--json'], { now: fixedNow });
  assert.equal(fetched.exitCode, 0);
  const fetchedBody = JSON.parse(fetched.stdout);
  assert.equal(fetchedBody.command, 'schema get');
  assert.equal(fetchedBody.data.schema.title, 'TraceCue Review Finding');

  const visualEvidence = await executeCli(['schema', 'get', '--name', 'visual_evidence', '--json'], { now: fixedNow });
  assert.equal(visualEvidence.exitCode, 0);
  assert.equal(JSON.parse(visualEvidence.stdout).data.schema.title, 'TraceCue Visual Evidence');

  const reviewSchemaFile = JSON.parse(await readFile(new URL('../schemas/review.schema.json', import.meta.url), 'utf8'));
  const reviewSchema = await executeCli(['schema', 'get', '--name', 'review', '--json'], { now: fixedNow });
  const reviewSchemaBody = JSON.parse(reviewSchema.stdout);
  assert.deepEqual(
    Object.keys(reviewSchemaBody.data.schema.properties).sort(),
    Object.keys(reviewSchemaFile.properties).sort()
  );
  assert.equal(reviewSchemaBody.data.schema.$id, reviewSchemaFile.$id);
  assert.equal(reviewSchemaBody.data.schema.title, reviewSchemaFile.title);
  assert.deepEqual((reviewSchemaBody.data.schema.required ?? []).sort(), (reviewSchemaFile.required ?? []).sort());

  const targetManifestSchemaFile = JSON.parse(await readFile(new URL('../schemas/target-manifest.schema.json', import.meta.url), 'utf8'));
  const targetManifestSchema = await executeCli(['schema', 'get', '--name', 'target_manifest', '--json'], { now: fixedNow });
  const targetManifestSchemaBody = JSON.parse(targetManifestSchema.stdout);
  assert.deepEqual(
    Object.keys(targetManifestSchemaBody.data.schema.properties).sort(),
    Object.keys(targetManifestSchemaFile.properties).sort()
  );
  assert.equal(targetManifestSchemaBody.data.schema.$id, targetManifestSchemaFile.$id);
  assert.equal(targetManifestSchemaBody.data.schema.title, targetManifestSchemaFile.title);
  assert.deepEqual((targetManifestSchemaBody.data.schema.required ?? []).sort(), (targetManifestSchemaFile.required ?? []).sort());

  const agentSchemaPairs = [
    ['capture_handoff', '../schemas/capture-handoff.schema.json'],
    ['capture_plan', '../schemas/capture-plan.schema.json'],
    ['capture_readiness', '../schemas/capture-readiness.schema.json'],
    ['capture_artifact', '../schemas/capture-artifact.schema.json'],
    ['capture_receipt', '../schemas/capture-receipt.schema.json'],
    ['identity_audit', '../schemas/identity-audit.schema.json'],
    ['localization_resources', '../schemas/localization-resources.schema.json'],
    ['report_templates', '../schemas/report-templates.schema.json'],
    ['translation_readiness', '../schemas/translation-readiness.schema.json'],
    ['translation_dry_run', '../schemas/translation-dry-run.schema.json'],
    ['release_readiness', '../schemas/release-readiness.schema.json'],
    ['artifact_root_policy', '../schemas/artifact-root-policy.schema.json'],
    ['artifact_root_migration', '../schemas/artifact-root-migration.schema.json'],
    ['legacy_alias_audit', '../schemas/legacy-alias-audit.schema.json'],
    ['legacy_alias_removal_readiness', '../schemas/legacy-alias-removal-readiness.schema.json'],
    ['constrained_shell_readiness', '../schemas/constrained-shell-readiness.schema.json'],
    ['final_hardening_readiness', '../schemas/final-hardening-readiness.schema.json'],
    ['desktop_review_provider_preparation_plan', '../schemas/desktop-review-provider-preparation-plan.schema.json'],
    ['image_review', '../schemas/image-review.schema.json'],
    ['mcp_execution_gates', '../schemas/mcp-execution-gates.schema.json'],
    ['visual_review_provider_policy', '../schemas/visual-review-provider-policy.schema.json'],
    ['visual_review_result_preparation', '../schemas/visual-review-result-preparation.schema.json'],
    ['visual_review_dashboard', '../schemas/visual-review-dashboard.schema.json'],
    ['language_settings', '../schemas/language-settings.schema.json'],
    ['operation_registry', '../schemas/operation-registry.schema.json'],
    ['operation_roadmap', '../schemas/operation-roadmap.schema.json'],
    ['operation_contracts', '../schemas/operation-contracts.schema.json'],
    ['operation_policy', '../schemas/operation-policy.schema.json'],
    ['operation_admin_readiness', '../schemas/operation-admin-readiness.schema.json'],
    ['operation_provider_readiness', '../schemas/operation-provider-readiness.schema.json'],
    ['visual_review_execution', '../schemas/visual-review-execution.schema.json'],
    ['visual_review_result', '../schemas/visual-review-result.schema.json'],
    ['visual_review_aggregation', '../schemas/visual-review-aggregation.schema.json'],
    ['agent_surface', '../schemas/agent-surface.schema.json'],
    ['agent_task_package', '../schemas/agent-task-package.schema.json'],
    ['agent_request_status', '../schemas/agent-request-status.schema.json'],
    ['agent_request_detail', '../schemas/agent-request-detail.schema.json'],
    ['agent_workflow', '../schemas/agent-workflow.schema.json'],
    ['agent_execution', '../schemas/agent-execution.schema.json'],
    ['agentic_human_review_proposal', '../schemas/agentic-human-review-proposal.schema.json'],
    ['agentic_human_review_provider_readiness', '../schemas/agentic-human-review-provider-readiness.schema.json'],
    ['agentic_human_review_report_quality', '../schemas/agentic-human-review-report-quality.schema.json'],
    ['agentic_human_review_benchmark_cases', '../schemas/agentic-human-review-benchmark-cases.schema.json'],
    ['agentic_human_review_benchmark_case', '../schemas/agentic-human-review-benchmark-case.schema.json'],
    ['agentic_human_review_calibration_result', '../schemas/agentic-human-review-calibration-result.schema.json'],
    ['agentic_human_review_comparison', '../schemas/agentic-human-review-comparison.schema.json'],
    ['agentic_human_review_batch_comparison', '../schemas/agentic-human-review-batch-comparison.schema.json'],
    ['agentic_human_review_evidence_set', '../schemas/agentic-human-review-evidence-set.schema.json'],
    ['agentic_human_review_evaluator_policy', '../schemas/agentic-human-review-evaluator-policy.schema.json'],
    ['agentic_human_review_xhigh_plan', '../schemas/agentic-human-review-xhigh-plan.schema.json'],
    ['agentic_human_review_xhigh_simulation', '../schemas/agentic-human-review-xhigh-simulation.schema.json'],
    ['agentic_human_review_longitudinal_quality', '../schemas/agentic-human-review-longitudinal-quality.schema.json'],
    ['agentic_human_review_claim_policy', '../schemas/agentic-human-review-claim-policy.schema.json'],
    ['agentic_human_review_claim_audit', '../schemas/agentic-human-review-claim-audit.schema.json'],
    ['agentic_human_review_dogfood_readiness', '../schemas/agentic-human-review-dogfood-readiness.schema.json'],
    ['agentic_human_review_dogfood_plan', '../schemas/agentic-human-review-dogfood-plan.schema.json'],
    ['agentic_human_review_plan', '../schemas/agentic-human-review-plan.schema.json'],
    ['agentic_human_review_package', '../schemas/agentic-human-review-package.schema.json'],
    ['human_review_rubric', '../schemas/human-review-rubric.schema.json'],
    ['agentic_human_review_advisory', '../schemas/agentic-human-review-advisory.schema.json'],
    ['agentic_human_review_receipt', '../schemas/agentic-human-review-receipt.schema.json'],
    ['agent_advisory_result', '../schemas/agent-advisory-result.schema.json'],
    ['agent_disclosure_policy', '../schemas/agent-disclosure-policy.schema.json']
  ];
  for (const [name, file] of agentSchemaPairs) {
    const schemaFile = JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
    const schema = await executeCli(['schema', 'get', '--name', name, '--json'], { now: fixedNow });
    assert.equal(schema.exitCode, 0);
    const schemaBody = JSON.parse(schema.stdout);
    assert.deepEqual(
      Object.keys(schemaBody.data.schema.properties).sort(),
      Object.keys(schemaFile.properties).sort()
    );
    assert.equal(schemaBody.data.schema.$id, schemaFile.$id);
    assert.equal(schemaBody.data.schema.title, schemaFile.title);
    assert.deepEqual((schemaBody.data.schema.required ?? []).sort(), (schemaFile.required ?? []).sort());
  }
});

test('agent package, ingest, and report stay local and advisory-only', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-agent-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  await mkdir(path.join(cwd, '.browser-debug', 'review-artifacts'), { recursive: true });
  const reviewIndex = {
    schema_version: '0.1.0',
    id: 'review-fixed',
    mode: 'target_manifest',
    local_only: true,
    external_upload: false,
    artifact_root: '.browser-debug',
    evidence_classes: ['layout', 'screenshot'],
    artifacts: [
      { type: 'review', path: '.browser-debug/reviews/review-fixed.json', description: 'Review JSON.' },
      { type: 'screenshot', path: '.browser-debug/screenshots/review-fixed.png', description: 'Screenshot.' }
    ],
    triage: {
      status: 'needs_attention',
      local_release_gate: 'needs_fixes',
      model_review_enabled: false
    },
    coverage_summary: {
      discovered_routes: 1,
      visited_routes: 1,
      expected_routes: 1,
      skipped_routes: 0,
      failed_page_expectations: 0,
      viewports: ['desktop']
    },
    rerun: {
      command: 'trace-cue review --target @target.json --json',
      guidance: ['Rerun after fixes.']
    },
    boundaries: {
      screenshots_may_contain_page_content: true,
      traces_may_contain_page_content: false,
      profile_reuse: false,
      credential_storage: false
    }
  };
  await writeFile(
    path.join(cwd, '.browser-debug', 'review-artifacts', 'review-fixed.json'),
    `${JSON.stringify(reviewIndex, null, 2)}\n`,
    'utf8'
  );

  const listed = await executeCli(['agent', 'surfaces', 'list', '--json'], { now: fixedNow });
  assert.equal(listed.exitCode, 0);
  const listedBody = JSON.parse(listed.stdout);
  assert.equal(listedBody.command, 'agent surfaces list');
  assert.ok(listedBody.data.agent_surfaces.some((surface) => surface.kind === 'subscription_surface' && surface.implemented === true));
  assert.ok(listedBody.data.agent_surfaces.some((surface) => surface.kind === 'api_provider' && surface.status === 'approval_required'));
  assert.equal(listedBody.data.boundary.api_call_performed, false);

  const packaged = await executeCli([
    'agent',
    'package',
    '--review-index',
    '.browser-debug/review-artifacts/review-fixed.json',
    '--surface',
    'local-subscription-agent',
    '--task',
    'experience_review',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agent-package-fixed'
  });
  assert.equal(packaged.exitCode, 0);
  const packagedBody = JSON.parse(packaged.stdout);
  assert.equal(packagedBody.command, 'agent package');
  assert.equal(packagedBody.data.agent_task_package.path, '.browser-debug/agent-packages/agent-package-fixed/packet.json');
  assert.equal(packagedBody.data.agent_disclosure_policy.raw_artifact_content_included, false);
  assert.equal(packagedBody.data.agent_disclosure_policy.screenshot_binary_included, false);
  assert.equal(packagedBody.data.agent_disclosure_policy.external_evidence_transfer, false);
  assert.equal(packagedBody.data.boundary.api_call_performed, false);
  assert.equal(packagedBody.data.boundary.existing_review_mutated, false);
  assert.equal(packagedBody.artifacts.some((artifact) => artifact.type === 'agent_prompt'), true);
  assert.equal(packagedBody.warnings.some((warning) => warning.code === 'AGENT_PACKAGE_SENSITIVE_ARTIFACT_REFERENCES'), true);
  const packet = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'agent-packages', 'agent-package-fixed', 'packet.json'), 'utf8'));
  assert.equal(packet.evidence_packet.artifacts[1].content_included, false);
  assert.equal(packet.boundary.external_evidence_transfer, false);
  const prompt = await readFile(path.join(cwd, '.browser-debug', 'agent-packages', 'agent-package-fixed', 'prompt.md'), 'utf8');
  assert.match(prompt, /Required output shape/);

  const waitingRequests = await executeCli(['agent', 'requests', 'list', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(waitingRequests.exitCode, 0);
  const waitingRequestsBody = JSON.parse(waitingRequests.stdout);
  assert.equal(waitingRequestsBody.command, 'agent requests list');
  assert.equal(waitingRequestsBody.data.summary.total, 1);
  assert.equal(waitingRequestsBody.data.summary.waiting_for_agent, 1);
  assert.equal(waitingRequestsBody.data.summary.api_call_performed, false);
  assert.equal(waitingRequestsBody.data.summary.automatic_upload, false);
  assert.equal(waitingRequestsBody.data.agent_requests[0].status, 'waiting_for_agent');
  assert.equal(waitingRequestsBody.data.agent_requests[0].package_path, '.browser-debug/agent-packages/agent-package-fixed/packet.json');
  assert.equal(waitingRequestsBody.data.agent_requests[0].gate_effect, 'none');
  assert.equal(waitingRequestsBody.data.agent_requests[0].existing_review_mutated, false);

  const waitingDetail = await executeCli([
    'agent',
    'requests',
    'show',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(waitingDetail.exitCode, 0);
  const waitingDetailBody = JSON.parse(waitingDetail.stdout);
  assert.equal(waitingDetailBody.command, 'agent requests show');
  assert.equal(waitingDetailBody.data.agent_request_detail.status, 'waiting_for_agent');
  assert.equal(waitingDetailBody.data.agent_request_detail.selected_result_path, null);
  assert.equal(waitingDetailBody.data.agent_request_detail.package_summary.artifact_reference_count, 2);
  assert.equal(waitingDetailBody.data.agent_request_detail.package_summary.artifact_references[1].content_included, false);
  assert.equal(waitingDetailBody.data.agent_request_detail.dashboard_handoff.ingest_expected_schema, 'agent_advisory_result');
  assert.equal(waitingDetailBody.data.agent_request_detail.api_call_performed, false);
  assert.equal(waitingDetailBody.data.agent_request_detail.automatic_upload, false);
  assert.equal(waitingDetailBody.data.agent_request_detail.existing_review_mutated, false);
  assert.deepEqual(waitingDetailBody.artifacts, []);

  const workflowCreated = await executeCli([
    'agent',
    'workflow',
    'create',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--name',
    'Dashboard handoff',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agent-workflow-fixed'
  });
  assert.equal(workflowCreated.exitCode, 0);
  const workflowCreatedBody = JSON.parse(workflowCreated.stdout);
  assert.equal(workflowCreatedBody.command, 'agent workflow create');
  assert.equal(workflowCreatedBody.data.agent_workflow.status, 'waiting_for_agent');
  assert.equal(workflowCreatedBody.data.agent_workflow.workflow_path, '.browser-debug/agent-workflows/agent-workflow-fixed/workflow.json');
  assert.equal(workflowCreatedBody.data.agent_workflow.steps.agent_review.status, 'waiting');
  assert.equal(workflowCreatedBody.data.agent_workflow.provider_boundary.direct_provider_execution, false);
  assert.equal(workflowCreatedBody.data.agent_workflow.provider_boundary.provider_api_call_performed, false);
  assert.equal(workflowCreatedBody.data.agent_workflow.api_call_performed, false);
  assert.equal(workflowCreatedBody.data.agent_workflow.automatic_upload, false);
  assert.equal(workflowCreatedBody.data.agent_workflow.existing_review_mutated, false);
  assert.equal(workflowCreatedBody.artifacts.some((artifact) => artifact.type === 'agent_workflow'), true);
  const workflowFile = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'agent-workflows', 'agent-workflow-fixed', 'workflow.json'), 'utf8'));
  assert.equal(workflowFile.dashboard_handoff.status_command, 'trace-cue agent workflow status --workflow .browser-debug/agent-workflows/agent-workflow-fixed/workflow.json --json');

  const advisoryInput = JSON.stringify({
    agent_advisory_findings: [{
      id: 'visual-density',
      category: 'visual_design',
      severity: 'medium',
      confidence: { evidence: 'high', judgment: 'medium', implementation: 'low' },
      message: 'Primary controls compete with secondary metadata.',
      recommendation: 'Reduce secondary metadata weight before changing the primary action.',
      selector: '#primary-panel',
      evidence_refs: ['.browser-debug/screenshots/review-fixed.png'],
      owner_decision_required: true
    }],
    owner_decision_requests: [{
      id: 'brand-fit',
      question: 'Is the denser layout acceptable for the target audience?',
      reason: 'This is a subjective product judgment.'
    }]
  });
  const absoluteInput = await executeCli([
    'agent',
    'ingest',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--input',
    `@${path.join(cwd, 'agent-advisory-result.json')}`,
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(absoluteInput.exitCode, 1);
  const absoluteInputBody = JSON.parse(absoluteInput.stdout);
  assert.equal(absoluteInputBody.errors[0].code, 'AGENT_INPUT_PATH_OUTSIDE_WORKSPACE');

  const ingested = await executeCli([
    'agent',
    'ingest',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--input',
    '-',
    '--surface',
    'local-subscription-agent',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    stdinText: advisoryInput,
    createId: () => 'agent-result-fixed'
  });
  assert.equal(ingested.exitCode, 0);
  const ingestedBody = JSON.parse(ingested.stdout);
  assert.equal(ingestedBody.command, 'agent ingest');
  assert.equal(ingestedBody.data.agent_advisory.gate_effect, 'none');
  assert.equal(ingestedBody.data.agent_advisory.untrusted_model_output, true);
  assert.equal(ingestedBody.data.agent_advisory_findings.length, 1);
  assert.equal(ingestedBody.data.agent_advisory_findings[0].source, 'agent_advisory');
  assert.equal(ingestedBody.data.agent_advisory_findings[0].gate_effect, 'none');
  assert.equal(ingestedBody.data.agent_advisory_action_plan.legacy_action_plan_unchanged, true);
  assert.equal(ingestedBody.data.agent_advisory_readiness.legacy_release_readiness_unchanged, true);
  assert.equal(ingestedBody.data.boundary.existing_review_mutated, false);
  assert.equal(ingestedBody.artifacts.some((artifact) => artifact.type === 'agent_import_receipt'), true);
  const receipt = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'receipts', 'agent-result-fixed.json'), 'utf8'));
  assert.equal(receipt.raw_response_stored, false);
  assert.equal(receipt.api_call_performed, false);

  const importedRequests = await executeCli([
    'agent',
    'requests',
    'list',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(importedRequests.exitCode, 0);
  const importedRequestsBody = JSON.parse(importedRequests.stdout);
  assert.equal(importedRequestsBody.data.summary.total, 1);
  assert.equal(importedRequestsBody.data.summary.advisory_imported, 1);
  assert.equal(importedRequestsBody.data.agent_requests[0].status, 'advisory_imported');
  assert.equal(importedRequestsBody.data.agent_requests[0].latest_result_path, '.browser-debug/agent-results/agent-result-fixed.json');
  assert.equal(importedRequestsBody.data.agent_requests[0].advisory_findings, 1);
  assert.equal(importedRequestsBody.data.agent_requests[0].api_call_performed, false);

  const importedDetail = await executeCli([
    'agent',
    'requests',
    'show',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--agent-result',
    '.browser-debug/agent-results/agent-result-fixed.json',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(importedDetail.exitCode, 0);
  const importedDetailBody = JSON.parse(importedDetail.stdout);
  assert.equal(importedDetailBody.data.agent_request_detail.status, 'advisory_imported');
  assert.equal(importedDetailBody.data.agent_request_detail.selected_result_path, '.browser-debug/agent-results/agent-result-fixed.json');
  assert.equal(importedDetailBody.data.agent_request_detail.agent_advisory_summary.advisory_findings, 1);
  assert.equal(importedDetailBody.data.agent_request_detail.agent_advisory_summary.owner_decision_requests, 1);
  assert.equal(importedDetailBody.data.agent_request_detail.agent_advisory_summary.action_items, 1);
  assert.equal(importedDetailBody.data.agent_request_detail.agent_advisory_summary.gate_effect, 'none');
  assert.equal(importedDetailBody.data.agent_request_detail.dashboard_handoff.report_command.includes('agent report'), true);
  assert.equal(importedDetailBody.data.agent_request_detail.api_call_performed, false);
  assert.equal(importedDetailBody.data.agent_request_detail.automatic_upload, false);
  assert.equal(importedDetailBody.data.agent_request_detail.existing_review_mutated, false);

  const workflowStatus = await executeCli([
    'agent',
    'workflow',
    'status',
    '--workflow',
    '.browser-debug/agent-workflows/agent-workflow-fixed/workflow.json',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(workflowStatus.exitCode, 0);
  const workflowStatusBody = JSON.parse(workflowStatus.stdout);
  assert.equal(workflowStatusBody.command, 'agent workflow status');
  assert.equal(workflowStatusBody.data.agent_workflow_status.status, 'advisory_imported');
  assert.equal(workflowStatusBody.data.agent_workflow_status.latest_result_path, '.browser-debug/agent-results/agent-result-fixed.json');
  assert.equal(workflowStatusBody.data.agent_workflow_status.steps.ingest.status, 'completed');
  assert.equal(workflowStatusBody.data.agent_workflow_status.steps.report.status, 'pending');
  assert.equal(workflowStatusBody.data.agent_workflow_status.request_detail.agent_advisory_summary.advisory_findings, 1);
  assert.equal(workflowStatusBody.data.agent_workflow_status.provider_boundary.direct_provider_execution, false);
  assert.equal(workflowStatusBody.data.agent_workflow_status.provider_boundary.provider_api_call_performed, false);
  assert.equal(workflowStatusBody.data.agent_workflow_status.api_call_performed, false);
  assert.equal(workflowStatusBody.data.agent_workflow_status.existing_review_mutated, false);
  assert.deepEqual(workflowStatusBody.artifacts, []);

  const workflowIndex = await executeCli([
    'agent',
    'workflow',
    'index',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(workflowIndex.exitCode, 0);
  const workflowIndexBody = JSON.parse(workflowIndex.stdout);
  assert.equal(workflowIndexBody.command, 'agent workflow index');
  assert.equal(workflowIndexBody.data.summary.total, 1);
  assert.equal(workflowIndexBody.data.summary.advisory_imported, 1);
  assert.equal(workflowIndexBody.data.summary.report_pending, 1);
  assert.equal(workflowIndexBody.data.summary.api_call_performed, false);
  assert.equal(workflowIndexBody.data.summary.automatic_upload, false);
  assert.equal(workflowIndexBody.data.summary.existing_review_mutated, false);

  const workflowReport = await executeCli([
    'agent',
    'workflow',
    'report',
    '--workflow',
    '.browser-debug/agent-workflows/agent-workflow-fixed/workflow.json',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agent-workflow-report-fixed'
  });
  assert.equal(workflowReport.exitCode, 0);
  const workflowReportBody = JSON.parse(workflowReport.stdout);
  assert.equal(workflowReportBody.command, 'agent workflow report');
  assert.equal(workflowReportBody.data.agent_workflow_report.path, '.browser-debug/reports/agent-workflow-report-fixed.md');
  assert.equal(workflowReportBody.data.agent_workflow_report.status, 'advisory_imported');
  assert.equal(workflowReportBody.data.agent_workflow_report.existing_review_mutated, false);
  assert.equal(workflowReportBody.data.provider_boundary.provider_api_call_performed, false);
  assert.equal(workflowReportBody.artifacts.some((artifact) => artifact.type === 'agent_workflow_report'), true);
  const workflowReportText = await readFile(path.join(cwd, '.browser-debug', 'reports', 'agent-workflow-report-fixed.md'), 'utf8');
  assert.match(workflowReportText, /Agent Workflow Report/);
  assert.match(workflowReportText, /Existing deterministic review findings/);

  const executionPlan = await executeCli([
    'agent',
    'execution',
    'plan',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agent-execution-fixed'
  });
  assert.equal(executionPlan.exitCode, 0);
  const executionPlanBody = JSON.parse(executionPlan.stdout);
  assert.equal(executionPlanBody.command, 'agent execution plan');
  assert.equal(executionPlanBody.data.agent_execution.status, 'planned');
  assert.equal(executionPlanBody.data.agent_execution.execution_path, '.browser-debug/agent-executions/agent-execution-fixed/execution.json');
  assert.equal(executionPlanBody.data.agent_execution.steps.plan.no_network, true);
  assert.equal(executionPlanBody.data.agent_execution.steps.execution.provider_adapter_required, false);
  assert.equal(executionPlanBody.data.agent_execution.provider.id, 'fake-agent');
  assert.equal(executionPlanBody.data.agent_execution.model.id, 'fake-model');
  assert.equal(executionPlanBody.data.agent_execution.provider_adapter.implemented, true);
  assert.equal(executionPlanBody.data.agent_execution.api_call_performed, false);
  assert.equal(executionPlanBody.data.agent_execution.external_evidence_transfer, false);
  assert.equal(executionPlanBody.data.agent_execution.credential_values_recorded, false);
  assert.equal(executionPlanBody.data.agent_execution.raw_provider_response_stored, false);
  assert.equal(executionPlanBody.data.agent_execution.mcp_execution_exposed, false);
  assert.equal(executionPlanBody.data.agent_execution.raw_pixels_included, false);
  assert.equal(executionPlanBody.data.agent_execution.visual_review_provider_execution_authorized, false);
  const visualReviewPolicy = executionPlanBody.data.agent_execution.visual_review_provider_policy;
  assert.equal(visualReviewPolicy.status, 'planned');
  assert.equal(visualReviewPolicy.disclosure.raw_pixels_included, false);
  assert.equal(visualReviewPolicy.disclosure.provider_execution_authorized, false);
  assert.equal(visualReviewPolicy.disclosure.external_evidence_transfer_authorized, false);
  assert.equal(visualReviewPolicy.execution.provider_call_performed, false);
  assert.equal(visualReviewPolicy.execution.mcp_execution_exposed, false);
  assert.equal(executionPlanBody.artifacts.some((artifact) => artifact.type === 'agent_execution'), true);
  const executionFile = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'agent-executions', 'agent-execution-fixed', 'execution.json'), 'utf8'));
  assert.equal(executionFile.visual_review_provider_policy.boundary.raw_pixels_included, false);
  assert.equal(executionFile.visual_review_provider_policy.boundary.provider_execution_authorized, false);
  assert.equal(executionFile.dashboard_handoff.status_command, 'trace-cue agent execution status --execution .browser-debug/agent-executions/agent-execution-fixed/execution.json --json');
  assert.equal(executionFile.dashboard_handoff.run_command, 'trace-cue agent execution run --execution .browser-debug/agent-executions/agent-execution-fixed/execution.json --package .browser-debug/agent-packages/agent-package-fixed/packet.json --surface local-subscription-agent --provider fake-agent --model fake-model --execute --json');

  const executionStatus = await executeCli([
    'agent',
    'execution',
    'status',
    '--execution',
    '.browser-debug/agent-executions/agent-execution-fixed/execution.json',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(executionStatus.exitCode, 0);
  const executionStatusBody = JSON.parse(executionStatus.stdout);
  assert.equal(executionStatusBody.command, 'agent execution status');
  assert.equal(executionStatusBody.data.agent_execution_status.status, 'planned');
  assert.equal(executionStatusBody.data.agent_execution_status.existing_review_mutated, false);

  const executionIndex = await executeCli([
    'agent',
    'execution',
    'list',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(executionIndex.exitCode, 0);
  const executionIndexBody = JSON.parse(executionIndex.stdout);
  assert.equal(executionIndexBody.command, 'agent execution list');
  assert.equal(executionIndexBody.data.summary.total, 1);
  assert.equal(executionIndexBody.data.summary.planned, 1);
  assert.equal(executionIndexBody.data.summary.api_call_performed, false);
  assert.equal(executionIndexBody.data.summary.mcp_execution_exposed, false);

  const mcpSurfaces = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 30,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_surfaces_list',
      arguments: {}
    }
  }, { cwd, mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpSurfaces.result.structuredContent.command, 'agent surfaces list');
  assert.equal(mcpSurfaces.result.structuredContent.data.boundary.api_call_performed, false);

  const mcpRequestsList = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 31,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_requests_list',
      arguments: { package: '.browser-debug/agent-packages/agent-package-fixed/packet.json' }
    }
  }, { cwd, mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpRequestsList.result.structuredContent.command, 'agent requests list');
  assert.equal(mcpRequestsList.result.structuredContent.data.summary.total, 1);

  const mcpRequestShow = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 32,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_requests_show',
      arguments: {
        package: '.browser-debug/agent-packages/agent-package-fixed/packet.json',
        agentResult: '.browser-debug/agent-results/agent-result-fixed.json'
      }
    }
  }, { cwd, mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpRequestShow.result.structuredContent.command, 'agent requests show');
  assert.equal(mcpRequestShow.result.structuredContent.data.agent_request_detail.status, 'advisory_imported');
  assert.deepEqual(mcpRequestShow.result.structuredContent.artifacts, []);

  const mcpWorkflowStatus = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 33,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_workflow_status',
      arguments: { workflow: '.browser-debug/agent-workflows/agent-workflow-fixed/workflow.json' }
    }
  }, { cwd, mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpWorkflowStatus.result.structuredContent.command, 'agent workflow status');
  assert.equal(mcpWorkflowStatus.result.structuredContent.data.agent_workflow_status.status, 'advisory_imported');

  const mcpWorkflowIndex = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 34,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_workflow_index',
      arguments: {}
    }
  }, { cwd, mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpWorkflowIndex.result.structuredContent.command, 'agent workflow index');
  assert.equal(mcpWorkflowIndex.result.structuredContent.data.summary.report_pending, 1);

  const mcpExecutionStatus = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 35,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_status',
      arguments: { execution: '.browser-debug/agent-executions/agent-execution-fixed/execution.json' }
    }
  }, { cwd, mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpExecutionStatus.result.structuredContent.command, 'agent execution status');
  assert.equal(mcpExecutionStatus.result.structuredContent.data.agent_execution_status.status, 'planned');

  const mcpExecutionList = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 36,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_list',
      arguments: {}
    }
  }, { cwd, mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpExecutionList.result.structuredContent.command, 'agent execution list');
  assert.equal(mcpExecutionList.result.structuredContent.data.summary.planned, 1);

  const executionRunWithoutFlag = await executeCli([
    'agent',
    'execution',
    'run',
    '--execution',
    '.browser-debug/agent-executions/agent-execution-fixed/execution.json',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(executionRunWithoutFlag.exitCode, 2);
  const executionRunWithoutFlagBody = JSON.parse(executionRunWithoutFlag.stdout);
  assert.equal(executionRunWithoutFlagBody.errors[0].code, 'MISSING_REQUIRED_OPTION');
  assert.equal(executionRunWithoutFlagBody.errors[0].details.option, 'execute');

  const executionRunWithoutPlan = await executeCli([
    'agent',
    'execution',
    'run',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(executionRunWithoutPlan.exitCode, 2);
  const executionRunWithoutPlanBody = JSON.parse(executionRunWithoutPlan.stdout);
  assert.equal(executionRunWithoutPlanBody.errors[0].code, 'MISSING_REQUIRED_OPTION');
  assert.equal(executionRunWithoutPlanBody.errors[0].details.option, 'execution');

  const executionRun = await executeCli([
    'agent',
    'execution',
    'run',
    '--execution',
    '.browser-debug/agent-executions/agent-execution-fixed/execution.json',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: (prefix) => prefix === 'agent-result' ? 'agent-result-from-fake' : 'unexpected-id'
  });
  assert.equal(executionRun.exitCode, 0);
  const executionRunBody = JSON.parse(executionRun.stdout);
  assert.equal(executionRunBody.command, 'agent execution run');
  assert.equal(executionRunBody.data.agent_execution.status, 'completed');
  assert.equal(executionRunBody.data.agent_execution.normalized_agent_result_path, '.browser-debug/agent-results/agent-result-from-fake.json');
  assert.equal(executionRunBody.data.agent_execution.api_call_performed, false);
  assert.equal(executionRunBody.data.agent_execution.external_evidence_transfer, false);
  assert.equal(executionRunBody.data.agent_execution.credential_values_recorded, false);
  assert.equal(executionRunBody.data.agent_execution.raw_provider_response_stored, false);
  assert.equal(executionRunBody.data.agent_execution.mcp_execution_exposed, false);
  assert.equal(Object.hasOwn(executionRunBody.data.agent_execution, 'visual_review_provider_policy'), false);
  assert.equal(executionRunBody.artifacts.some((artifact) => artifact.type === 'agent_advisory_result'), true);
  const fakeResult = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'agent-results', 'agent-result-from-fake.json'), 'utf8'));
  assert.equal(fakeResult.agent_advisory.source, 'agent_execution');
  assert.equal(fakeResult.agent_advisory.api_call_performed_by_cli, false);
  assert.equal(fakeResult.boundary.raw_provider_response_stored, false);

  const completedExecutionStatus = await executeCli([
    'agent',
    'execution',
    'status',
    '--execution',
    '.browser-debug/agent-executions/agent-execution-fixed/execution.json',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(completedExecutionStatus.exitCode, 0);
  const completedExecutionStatusBody = JSON.parse(completedExecutionStatus.stdout);
  assert.equal(completedExecutionStatusBody.data.agent_execution_status.status, 'completed');
  assert.equal(completedExecutionStatusBody.data.agent_execution_status.dashboard_status.report_pending, true);

  const localExecutionPlan = await executeCli([
    'agent',
    'execution',
    'plan',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'local-runner',
    '--model',
    'local-agent',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agent-execution-local'
  });
  assert.equal(localExecutionPlan.exitCode, 0);

  const localExecutionRun = await executeCli([
    'agent',
    'execution',
    'run',
    '--execution',
    '.browser-debug/agent-executions/agent-execution-local/execution.json',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'local-runner',
    '--model',
    'local-agent',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: (prefix) => prefix === 'agent-result' ? 'agent-result-from-local-runner' : 'unexpected-id',
    agentExecutionLocalRunner: async ({ package_path: packagePath }) => ({
      agent_advisory_findings: [{
        id: 'local-runner-finding',
        category: 'implementation_diagnosis',
        severity: 'medium',
        message: `Local runner reviewed ${packagePath}.`,
        recommendation: 'Review the local runner advisory item.'
      }],
      agent_advisory_action_plan: { next_actions: [] },
      owner_decision_requests: []
    })
  });
  assert.equal(localExecutionRun.exitCode, 0);
  const localExecutionRunBody = JSON.parse(localExecutionRun.stdout);
  assert.equal(localExecutionRunBody.data.agent_execution.status, 'completed');
  assert.equal(localExecutionRunBody.data.agent_execution.boundary.shell_used, false);
  assert.equal(localExecutionRunBody.data.agent_execution.boundary.free_form_shell_input_accepted, false);
  const localRunnerResult = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'agent-results', 'agent-result-from-local-runner.json'), 'utf8'));
  assert.equal(localRunnerResult.agent_advisory_findings.length, 1);
  assert.equal(localRunnerResult.agent_advisory_findings[0].source, 'agent_advisory');

  const apiPackage = await executeCli([
    'agent',
    'package',
    '--review-index',
    '.browser-debug/review-artifacts/review-fixed.json',
    '--surface',
    'generic-api-provider',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agent-package-api'
  });
  assert.equal(apiPackage.exitCode, 0);

  const apiExecutionPlan = await executeCli([
    'agent',
    'execution',
    'plan',
    '--package',
    '.browser-debug/agent-packages/agent-package-api/packet.json',
    '--surface',
    'generic-api-provider',
    '--provider',
    'generic-api-provider',
    '--model',
    'generic-model',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agent-execution-api-missing-config'
  });
  assert.equal(apiExecutionPlan.exitCode, 0);

  const apiExecutionMissingConfig = await executeCli([
    'agent',
    'execution',
    'run',
    '--execution',
    '.browser-debug/agent-executions/agent-execution-api-missing-config/execution.json',
    '--package',
    '.browser-debug/agent-packages/agent-package-api/packet.json',
    '--surface',
    'generic-api-provider',
    '--provider',
    'generic-api-provider',
    '--model',
    'generic-model',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    env: {}
  });
  assert.equal(apiExecutionMissingConfig.exitCode, 1);
  const apiExecutionMissingConfigBody = JSON.parse(apiExecutionMissingConfig.stdout);
  assert.equal(apiExecutionMissingConfigBody.errors[0].code, 'AGENT_EXECUTION_API_CONFIGURATION_MISSING');
  assert.equal(apiExecutionMissingConfigBody.data.agent_execution.api_call_performed, false);
  assert.equal(apiExecutionMissingConfigBody.data.agent_execution.credential_values_recorded, false);

  const apiExecutionPlanSuccess = await executeCli([
    'agent',
    'execution',
    'plan',
    '--package',
    '.browser-debug/agent-packages/agent-package-api/packet.json',
    '--surface',
    'generic-api-provider',
    '--provider',
    'generic-api-provider',
    '--model',
    'generic-model',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agent-execution-api'
  });
  assert.equal(apiExecutionPlanSuccess.exitCode, 0);

  const apiCalls = [];
  const apiExecutionRun = await executeCli([
    'agent',
    'execution',
    'run',
    '--execution',
    '.browser-debug/agent-executions/agent-execution-api/execution.json',
    '--package',
    '.browser-debug/agent-packages/agent-package-api/packet.json',
    '--surface',
    'generic-api-provider',
    '--provider',
    'generic-api-provider',
    '--model',
    'generic-model',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: (prefix) => prefix === 'agent-result' ? 'agent-result-from-api' : 'unexpected-id',
    env: {
      [API_PROVIDER_ENDPOINT_ENV]: 'https://provider.example.test/agent-advisory',
      [API_PROVIDER_CREDENTIAL_ENV]: 'credential-value-for-test'
    },
    fetch: async (url, init) => {
      apiCalls.push({ url, init, body: JSON.parse(init.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          agent_advisory_findings: [{
            id: 'api-finding',
            category: 'visual_design',
            severity: 'low',
            message: 'API provider advisory.',
            recommendation: 'Review the API advisory item.'
          }],
          agent_advisory_action_plan: { next_actions: [] },
          owner_decision_requests: []
        })
      };
    }
  });
  assert.equal(apiExecutionRun.exitCode, 0);
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].url, 'https://provider.example.test/agent-advisory');
  assert.equal(apiCalls[0].body.disclosure_policy.raw_artifact_content_included, false);
  assert.equal(apiCalls[0].body.disclosure_policy.prompt_content_included, true);
  assert.match(apiCalls[0].init.headers.authorization, /^Bearer /);
  const apiExecutionRunBody = JSON.parse(apiExecutionRun.stdout);
  assert.equal(apiExecutionRunBody.data.agent_execution.api_call_performed, true);
  assert.equal(apiExecutionRunBody.data.agent_execution.external_evidence_transfer, true);
  assert.equal(apiExecutionRunBody.data.agent_execution.credential_values_recorded, false);
  assert.equal(apiExecutionRunBody.data.agent_execution.raw_provider_response_stored, false);
  const apiResultText = await readFile(path.join(cwd, '.browser-debug', 'agent-results', 'agent-result-from-api.json'), 'utf8');
  assert.doesNotMatch(apiResultText, /credential-value-for-test/);
  const apiResult = JSON.parse(apiResultText);
  assert.equal(apiResult.agent_advisory.api_call_performed_by_cli, true);
  assert.equal(apiResult.agent_advisory_findings.length, 1);

  const mcpSafeRunBlocked = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 37,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_run',
      arguments: {}
    }
  }, { cwd, mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpSafeRunBlocked.error.code, -32602);
  assert.match(mcpSafeRunBlocked.error.message, /not available for MCP profile safe/);

  const mcpAdminPlanCredentialArg = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 38,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_plan',
      arguments: {
        package: '.browser-debug/agent-packages/agent-package-fixed/packet.json',
        surface: 'local-subscription-agent',
        provider: 'fake-agent',
        model: 'fake-model',
        idempotencyKey: 'mcp-credential-arg-plan',
        credential: 'must-not-be-accepted'
      }
    }
  }, { cwd, mcpProfile: 'admin', now: fixedNow });
  assert.equal(mcpAdminPlanCredentialArg.error.code, -32602);
  assert.match(mcpAdminPlanCredentialArg.error.message, /Unsupported MCP argument/);

  const outsideAgentPackageRoot = await mkdtemp(path.join(tmpdir(), 'trace-cue-agent-execution-outside-'));
  await writeFile(path.join(outsideAgentPackageRoot, 'packet.json'), JSON.stringify({ id: 'outside-package' }), 'utf8');
  await symlink(path.join(outsideAgentPackageRoot, 'packet.json'), path.join(cwd, 'linked-agent-packet.json'));
  const mcpSymlinkPackageBlocked = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 39,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_plan',
      arguments: {
        package: 'linked-agent-packet.json',
        surface: 'local-subscription-agent',
        provider: 'fake-agent',
        model: 'fake-model',
        idempotencyKey: 'mcp-symlink-package-plan'
      }
    }
  }, { cwd, mcpProfile: 'admin', now: fixedNow });
  assert.equal(mcpSymlinkPackageBlocked.result.isError, true);
  assert.equal(mcpSymlinkPackageBlocked.result.structuredContent.errors[0].code, 'AGENT_EXECUTION_REALPATH_OUTSIDE_WORKSPACE');

  const mcpFakePlan = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 40,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_plan',
      arguments: {
        package: '.browser-debug/agent-packages/agent-package-fixed/packet.json',
        surface: 'local-subscription-agent',
        provider: 'fake-agent',
        model: 'fake-model',
        idempotencyKey: 'mcp-fake-plan'
      }
    }
  }, { cwd, mcpProfile: 'admin', now: fixedNow });
  assert.equal(mcpFakePlan.result.structuredContent.command, 'agent execution plan');
  assert.equal(mcpFakePlan.result.structuredContent.data.agent_execution.status, 'planned');
  assert.equal(mcpFakePlan.result.structuredContent.data.agent_execution.mcp_execution_exposed, true);
  assert.equal(mcpFakePlan.result.structuredContent.data.agent_execution.idempotency_key_hash.length, 64);
  assert.equal(JSON.stringify(mcpFakePlan.result.structuredContent).includes('mcp-fake-plan'), false);
  const mcpFakeExecutionPath = mcpFakePlan.result.structuredContent.data.agent_execution.execution_path;

  const mcpFakeRunMissingExecute = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 41,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_run',
      arguments: {
        execution: mcpFakeExecutionPath,
        package: '.browser-debug/agent-packages/agent-package-fixed/packet.json',
        surface: 'local-subscription-agent',
        provider: 'fake-agent',
        model: 'fake-model',
        execute: false,
        idempotencyKey: 'mcp-fake-run-missing-execute'
      }
    }
  }, { cwd, mcpProfile: 'admin', now: fixedNow });
  assert.equal(mcpFakeRunMissingExecute.error.code, -32602);
  assert.match(mcpFakeRunMissingExecute.error.message, /requires execute: true/);

  const mcpFakeRun = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 42,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_run',
      arguments: {
        execution: mcpFakeExecutionPath,
        package: '.browser-debug/agent-packages/agent-package-fixed/packet.json',
        surface: 'local-subscription-agent',
        provider: 'fake-agent',
        model: 'fake-model',
        execute: true,
        idempotencyKey: 'mcp-fake-run'
      }
    }
  }, { cwd, mcpProfile: 'admin', now: fixedNow });
  assert.equal(mcpFakeRun.result.structuredContent.command, 'agent execution run');
  assert.equal(mcpFakeRun.result.structuredContent.data.agent_execution.status, 'completed');
  assert.equal(mcpFakeRun.result.structuredContent.data.agent_execution.mcp_execution_exposed, true);
  const mcpFakeResultPath = mcpFakeRun.result.structuredContent.data.agent_execution.normalized_agent_result_path;
  const mcpFakeResult = JSON.parse(await readFile(path.join(cwd, mcpFakeResultPath), 'utf8'));
  assert.equal(mcpFakeResult.boundary.mcp_execution_exposed, true);
  assert.equal(mcpFakeResult.agent_advisory.mcp_execution_exposed, true);

  const mcpLocalPlan = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 43,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_plan',
      arguments: {
        package: '.browser-debug/agent-packages/agent-package-fixed/packet.json',
        surface: 'local-subscription-agent',
        provider: 'local-runner',
        model: 'local-agent',
        idempotencyKey: 'mcp-local-plan'
      }
    }
  }, { cwd, mcpProfile: 'admin', now: fixedNow });
  const mcpLocalExecutionPath = mcpLocalPlan.result.structuredContent.data.agent_execution.execution_path;
  const mcpLocalRun = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 44,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_run',
      arguments: {
        execution: mcpLocalExecutionPath,
        package: '.browser-debug/agent-packages/agent-package-fixed/packet.json',
        surface: 'local-subscription-agent',
        provider: 'local-runner',
        model: 'local-agent',
        execute: true,
        idempotencyKey: 'mcp-local-run'
      }
    }
  }, {
    cwd,
    mcpProfile: 'admin',
    now: fixedNow,
    agentExecutionLocalRunner: async () => ({
      agent_advisory_findings: [{
        id: 'mcp-local-runner-finding',
        category: 'implementation_diagnosis',
        severity: 'low',
        message: 'MCP local runner advisory.',
        recommendation: 'Review the MCP local runner advisory item.'
      }]
    })
  });
  assert.equal(mcpLocalRun.result.structuredContent.data.agent_execution.status, 'completed');
  assert.equal(mcpLocalRun.result.structuredContent.data.agent_execution.boundary.shell_used, false);
  assert.equal(mcpLocalRun.result.structuredContent.data.agent_execution.boundary.free_form_shell_input_accepted, false);
  assert.equal(mcpLocalRun.result.structuredContent.data.agent_execution.mcp_execution_exposed, true);

  const mcpApiPlanMissing = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 45,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_plan',
      arguments: {
        package: '.browser-debug/agent-packages/agent-package-api/packet.json',
        surface: 'generic-api-provider',
        provider: 'generic-api-provider',
        model: 'generic-model',
        idempotencyKey: 'mcp-api-missing-plan'
      }
    }
  }, { cwd, mcpProfile: 'admin', now: fixedNow });
  const mcpApiMissingExecutionPath = mcpApiPlanMissing.result.structuredContent.data.agent_execution.execution_path;
  let mcpMissingFetchCalled = false;
  const mcpApiRunMissingConfig = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 46,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_run',
      arguments: {
        execution: mcpApiMissingExecutionPath,
        package: '.browser-debug/agent-packages/agent-package-api/packet.json',
        surface: 'generic-api-provider',
        provider: 'generic-api-provider',
        model: 'generic-model',
        execute: true,
        idempotencyKey: 'mcp-api-missing-run'
      }
    }
  }, {
    cwd,
    mcpProfile: 'admin',
    now: fixedNow,
    env: {},
    fetch: async () => {
      mcpMissingFetchCalled = true;
      throw new Error('missing-config must not call fetch');
    }
  });
  assert.equal(mcpApiRunMissingConfig.result.isError, true);
  assert.equal(mcpApiRunMissingConfig.result.structuredContent.errors[0].code, 'AGENT_EXECUTION_API_CONFIGURATION_MISSING');
  assert.equal(mcpMissingFetchCalled, false);

  const mcpApiPlan = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 47,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_plan',
      arguments: {
        package: '.browser-debug/agent-packages/agent-package-api/packet.json',
        surface: 'generic-api-provider',
        provider: 'generic-api-provider',
        model: 'generic-model',
        idempotencyKey: 'mcp-api-plan'
      }
    }
  }, { cwd, mcpProfile: 'admin', now: fixedNow });
  const mcpApiExecutionPath = mcpApiPlan.result.structuredContent.data.agent_execution.execution_path;
  const mcpApiCalls = [];
  const mcpCredentialSentinel = 'credential-value-for-mcp-test';
  const mcpApiRun = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 48,
    method: 'tools/call',
    params: {
      name: 'browser_debug_agent_execution_run',
      arguments: {
        execution: mcpApiExecutionPath,
        package: '.browser-debug/agent-packages/agent-package-api/packet.json',
        surface: 'generic-api-provider',
        provider: 'generic-api-provider',
        model: 'generic-model',
        execute: true,
        idempotencyKey: 'mcp-api-run'
      }
    }
  }, {
    cwd,
    mcpProfile: 'admin',
    now: fixedNow,
    env: {
      [API_PROVIDER_ENDPOINT_ENV]: 'https://provider.example.test/mcp-agent-advisory',
      [API_PROVIDER_CREDENTIAL_ENV]: mcpCredentialSentinel
    },
    fetch: async (url, init) => {
      mcpApiCalls.push({ url, init, body: JSON.parse(init.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          agent_advisory_findings: [{
            id: 'mcp-api-finding',
            category: 'visual_design',
            severity: 'low',
            message: 'MCP API provider advisory.',
            recommendation: 'Review the MCP API advisory item.'
          }]
        })
      };
    }
  });
  assert.equal(mcpApiRun.result.structuredContent.data.agent_execution.status, 'completed');
  assert.equal(mcpApiRun.result.structuredContent.data.agent_execution.api_call_performed, true);
  assert.equal(mcpApiRun.result.structuredContent.data.agent_execution.external_evidence_transfer, true);
  assert.equal(mcpApiRun.result.structuredContent.data.agent_execution.credential_values_recorded, false);
  assert.equal(mcpApiRun.result.structuredContent.data.agent_execution.raw_provider_response_stored, false);
  assert.equal(mcpApiRun.result.structuredContent.data.agent_execution.mcp_execution_exposed, true);
  assert.equal(mcpApiCalls.length, 1);
  assert.equal(mcpApiCalls[0].body.disclosure_policy.raw_artifact_content_included, false);
  assert.equal(mcpApiCalls[0].body.disclosure_policy.trace_content_included, false);
  assert.equal(mcpApiCalls[0].body.disclosure_policy.screenshot_binary_included, false);
  assert.equal(mcpApiCalls[0].body.disclosure_policy.source_data_values_included, false);
  assert.equal(mcpApiCalls[0].body.disclosure_policy.prompt_content_included, true);
  assert.match(mcpApiCalls[0].init.headers.authorization, /^Bearer /);
  assert.doesNotMatch(JSON.stringify(mcpApiRun.result.structuredContent), new RegExp(mcpCredentialSentinel));
  const mcpApiResultPath = mcpApiRun.result.structuredContent.data.agent_execution.normalized_agent_result_path;
  const mcpApiResultText = await readFile(path.join(cwd, mcpApiResultPath), 'utf8');
  assert.doesNotMatch(mcpApiResultText, new RegExp(mcpCredentialSentinel));
  const mcpApiReceiptText = await readFile(path.join(cwd, '.browser-debug', 'receipts', `${mcpApiRun.result.structuredContent.data.agent_execution.id}-run.json`), 'utf8');
  assert.doesNotMatch(mcpApiReceiptText, new RegExp(mcpCredentialSentinel));

  const completedExecutionIndex = await executeCli([
    'agent',
    'execution',
    'list',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(completedExecutionIndex.exitCode, 0);
  const completedExecutionIndexBody = JSON.parse(completedExecutionIndex.stdout);
  assert.equal(completedExecutionIndexBody.data.summary.completed, 6);
  assert.equal(completedExecutionIndexBody.data.summary.blocked, 2);
  assert.equal(completedExecutionIndexBody.data.summary.advisory_results, 6);
  assert.equal(completedExecutionIndexBody.data.summary.credential_values_recorded, false);
  assert.equal(completedExecutionIndexBody.data.summary.raw_provider_response_stored, false);
  assert.equal(completedExecutionIndexBody.data.summary.mcp_execution_exposed, true);

  await writeFile(
    path.join(cwd, '.browser-debug', 'agent-results', 'agent-result-other.json'),
    `${JSON.stringify({ package_id: 'other-package', package_path: '.browser-debug/agent-packages/other/packet.json' })}\n`,
    'utf8'
  );
  const mismatchedDetail = await executeCli([
    'agent',
    'requests',
    'show',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--agent-result',
    '.browser-debug/agent-results/agent-result-other.json',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(mismatchedDetail.exitCode, 1);
  const mismatchedDetailBody = JSON.parse(mismatchedDetail.stdout);
  assert.equal(mismatchedDetailBody.errors[0].code, 'AGENT_RESULT_PACKAGE_MISMATCH');

  const reported = await executeCli([
    'agent',
    'report',
    '--review-index',
    '.browser-debug/review-artifacts/review-fixed.json',
    '--agent-result',
    '.browser-debug/agent-results/agent-result-fixed.json',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agent-report-fixed'
  });
  assert.equal(reported.exitCode, 0);
  const reportedBody = JSON.parse(reported.stdout);
  assert.equal(reportedBody.command, 'agent report');
  assert.equal(reportedBody.data.agent_report.existing_review_mutated, false);
  const report = await readFile(path.join(cwd, '.browser-debug', 'reports', 'agent-report-fixed.md'), 'utf8');
  assert.match(report, /Agent Advisory Report/);
  assert.match(report, /Existing deterministic review findings/);
});

test('agentic human review enforces plan approval, transfer flags, and advisory-only output', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-agentic-review-'));
  const png = minimalPngBuffer(160, 90);
  await writeFile(path.join(cwd, 'screen.png'), png);

  const imageReview = await executeCli(['review', '--image', 'screen.png', '--json'], {
    cwd,
    now: fixedNow,
    createId: () => 'image-review-fixed'
  });
  assert.equal(imageReview.exitCode, 0);
  const reviewIndexPath = '.browser-debug/review-artifacts/image-review-fixed.json';
  const originalReviewText = await readFile(path.join(cwd, '.browser-debug', 'reviews', 'image-review-fixed.json'), 'utf8');
  const originalIndexText = await readFile(path.join(cwd, reviewIndexPath), 'utf8');

  const parsedProposal = parseCliArgs([
    'agentic',
    'review',
    'propose',
    '--brief',
    'Use xhigh review to judge visual UX, written content, trust, likely viewer feeling, and improvement suggestions.',
    '--review-index',
    reviewIndexPath,
    '--json'
  ]);
  assert.equal(parsedProposal.ok, true);
  assert.equal(parsedProposal.command, 'agentic review propose');

  const conflictingProposal = parseCliArgs([
    'agentic',
    'review',
    'propose',
    '--brief',
    'Review this.',
    '--input',
    'Review this differently.',
    '--json'
  ]);
  assert.equal(conflictingProposal.ok, false);
  assert.equal(conflictingProposal.error.code, 'CONFLICTING_OPTIONS');

  const proposalResult = await executeCli([
    'agentic',
    'review',
    'propose',
    '--brief',
    'Use xhigh review to judge visual UX, written content, trust, likely viewer feeling, and improvement suggestions.',
    '--review-index',
    reviewIndexPath,
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--surface',
    'local-subscription-agent',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agentic-proposal-fixed'
  });
  assert.equal(proposalResult.exitCode, 0);
  const proposalBody = JSON.parse(proposalResult.stdout);
  assert.equal(proposalBody.command, 'agentic review propose');
  assert.equal(proposalBody.data.agentic_human_review_proposal.type, 'agentic_human_review_proposal');
  assert.equal(proposalBody.data.agentic_human_review_proposal.human_review_schema_version, '2.0.0');
  assert.equal(proposalBody.data.agentic_human_review_proposal.human_review_contract.output_requirements.reader_feeling_required, true);
  assert.equal(proposalBody.data.agentic_human_review_proposal.human_review_contract.output_requirements.mechanical_vs_human_review_required, true);
  assert.equal(proposalBody.data.agentic_human_review_proposal.approval.proposal_is_not_approval, true);
  assert.equal(proposalBody.data.agentic_human_review_proposal.approval.provider_execution_authorized, false);
  assert.equal(proposalBody.data.agentic_human_review_proposal.boundary.provider_call_performed, false);
  assert.equal(proposalBody.data.agentic_human_review_proposal.review_effort.mode, 'xhigh');
  assert.match(proposalBody.data.proposal_hash, /^[a-f0-9]{64}$/);
  assert.equal(proposalBody.artifacts.some((artifact) => artifact.type === 'agentic_human_review_proposal'), true);
  assert.equal(JSON.stringify(proposalBody).includes(png.toString('base64')), false);

  const proposalPath = '.browser-debug/agentic-human-review-proposals/agentic-proposal-fixed/proposal.json';
  const planFromProposal = await executeCli([
    'agentic',
    'review',
    'plan',
    '--proposal',
    proposalPath,
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agentic-plan-from-proposal'
  });
  assert.equal(planFromProposal.exitCode, 0);
  const planFromProposalBody = JSON.parse(planFromProposal.stdout);
  assert.equal(planFromProposalBody.data.agentic_human_review_plan.proposal_provenance.proposal_path, proposalPath);
  assert.equal(planFromProposalBody.data.agentic_human_review_plan.proposal_provenance.proposal_is_not_approval, true);
  assert.equal(planFromProposalBody.data.agentic_human_review_plan.review_effort.mode, 'xhigh');

  const proposalBypass = await executeCli([
    'agent',
    'execution',
    'plan',
    '--package',
    proposalPath,
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(proposalBypass.exitCode, 1);
  assert.equal(JSON.parse(proposalBypass.stdout).errors[0].code, 'AGENT_EXECUTION_AGENTIC_REVIEW_UNSUPPORTED');

  const readinessResult = await executeCli([
    'agentic',
    'review',
    'provider-readiness',
    '--proposal',
    proposalPath,
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(readinessResult.exitCode, 0);
  const readinessBody = JSON.parse(readinessResult.stdout);
  assert.equal(readinessBody.command, 'agentic review provider-readiness');
  assert.equal(readinessBody.data.agentic_human_review_provider_readiness.boundary.provider_call_performed, false);
  assert.equal(readinessBody.data.agentic_human_review_provider_readiness.boundary.credential_values_read, false);
  assert.equal(readinessBody.data.agentic_human_review_provider_readiness.providers[0].id, 'fake-agent');
  assert.match(readinessBody.data.agentic_human_review_provider_readiness.providers[0].capability_hash, /^[a-f0-9]{64}$/);
  assert.equal(readinessBody.data.agentic_human_review_provider_readiness.providers[0].transfer_policy.requires_matching_provider_capability_hash, true);

  const fakeReadinessWithInvalidGenericTimeout = await executeCli([
    'agentic',
    'review',
    'provider-readiness',
    '--provider',
    'fake-agent',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    env: {
      [AGENTIC_REVIEW_API_TIMEOUT_ENV]: 'invalid'
    }
  });
  assert.equal(fakeReadinessWithInvalidGenericTimeout.exitCode, 0);
  assert.equal(JSON.parse(fakeReadinessWithInvalidGenericTimeout.stdout).data.agentic_human_review_provider_readiness.providers[0].id, 'fake-agent');

  const directProposal = await runAgenticHumanReviewPropose({
    brief: 'Quick first-impression review proposal.',
    provider: 'fake-agent',
    model: 'fake-model'
  }, {
    cwd,
    now: fixedNow,
    createId: () => 'agentic-direct-proposal'
  });
  assert.equal(directProposal.status, 'ok');
  assert.equal(directProposal.data.agentic_human_review_proposal.approval.plan_hash_created, false);

  const directReadiness = await runAgenticHumanReviewProviderReadiness({
    provider: 'generic-api-provider'
  }, { cwd, now: fixedNow });
  assert.equal(directReadiness.status, 'ok');
  assert.equal(directReadiness.data.agentic_human_review_provider_readiness.providers[0].credential_values_read_by_readiness, false);
  assert.equal(directReadiness.data.agentic_human_review_provider_readiness.providers[0].timeout_env, AGENTIC_REVIEW_API_TIMEOUT_ENV);
  assert.equal(directReadiness.data.agentic_human_review_provider_readiness.providers[0].timeout_ms, 30000);

  const parsedDogfoodReadiness = parseCliArgs([
    'agentic',
    'review',
    'dogfood',
    'readiness',
    '--provider',
    'generic-api-provider',
    '--json'
  ]);
  assert.equal(parsedDogfoodReadiness.ok, true);
  assert.equal(parsedDogfoodReadiness.command, 'agentic review dogfood readiness');

  const dogfoodReadiness = await executeCli([
    'agentic',
    'review',
    'dogfood',
    'readiness',
    '--provider',
    'generic-api-provider',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    env: {
      [AGENTIC_REVIEW_API_ENDPOINT_ENV]: 'https://provider.example/review',
      [AGENTIC_REVIEW_API_CREDENTIAL_ENV]: 'api-secret-value',
      [AGENTIC_REVIEW_LIVE_DOGFOOD_ENV]: '1'
    }
  });
  assert.equal(dogfoodReadiness.exitCode, 0);
  const dogfoodReadinessBody = JSON.parse(dogfoodReadiness.stdout);
  assert.equal(dogfoodReadinessBody.command, 'agentic review dogfood readiness');
  assert.equal(dogfoodReadinessBody.data.agentic_human_review_dogfood_readiness.setup.endpoint_configured, true);
  assert.equal(dogfoodReadinessBody.data.agentic_human_review_dogfood_readiness.setup.credential_configured, true);
  assert.equal(dogfoodReadinessBody.data.agentic_human_review_dogfood_readiness.setup.live_dogfood_enabled, true);
  assert.deepEqual(dogfoodReadinessBody.data.agentic_human_review_dogfood_readiness.human_review_maturity_plan.required_efforts, ['standard', 'deep', 'xhigh']);
  assert.equal(dogfoodReadinessBody.data.agentic_human_review_dogfood_readiness.human_review_maturity_plan.human_equivalence_claim.human_equivalent_claim_allowed_by_plan, false);
  assert.equal(dogfoodReadinessBody.data.agentic_human_review_dogfood_readiness.boundary.provider_call_performed, false);
  assert.equal(dogfoodReadinessBody.data.agentic_human_review_dogfood_readiness.boundary.credential_values_read, false);
  assert.doesNotMatch(dogfoodReadiness.stdout, /api-secret-value|provider\.example/);

  const parsedDogfoodPlan = parseCliArgs([
    'agentic',
    'review',
    'dogfood',
    'plan',
    '--case',
    'article-comprehension-risk',
    '--provider',
    'generic-api-provider',
    '--json'
  ]);
  assert.equal(parsedDogfoodPlan.ok, true);
  assert.equal(parsedDogfoodPlan.command, 'agentic review dogfood plan');

  const dogfoodPlan = await executeCli([
    'agentic',
    'review',
    'dogfood',
    'plan',
    '--case',
    'article-comprehension-risk',
    '--provider',
    'generic-api-provider',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(dogfoodPlan.exitCode, 0);
  const dogfoodPlanBody = JSON.parse(dogfoodPlan.stdout);
  assert.equal(dogfoodPlanBody.command, 'agentic review dogfood plan');
  assert.equal(dogfoodPlanBody.data.agentic_human_review_dogfood_plan.case.case_id, 'article-comprehension-risk');
  assert.equal(dogfoodPlanBody.data.agentic_human_review_dogfood_plan.human_review_maturity_plan.active_case_id, 'article-comprehension-risk');
  assert.equal(dogfoodPlanBody.data.agentic_human_review_dogfood_plan.human_review_maturity_plan.active_case_matrix[0].plan_commands.length, 3);
  assert.equal(dogfoodPlanBody.data.agentic_human_review_dogfood_plan.human_review_maturity_plan.active_case_matrix[0].plan_commands.some((item) => item.effort === 'deep'), true);
  assert.equal(dogfoodPlanBody.data.agentic_human_review_dogfood_plan.manual_live_provider_policy.provider_call_performed_by_plan, false);
  assert.match(dogfoodPlanBody.data.agentic_human_review_dogfood_plan.workflow.compare, /direct-vs-tracecue/);

  const parsedPlan = parseCliArgs([
    'agentic',
    'review',
    'plan',
    '--review-index',
    reviewIndexPath,
    '--intent',
    'Review the visual UI, page text, readability, trust, and likely user reaction.',
    '--effort',
    'xhigh',
    '--default-subagent-effort',
    'high',
    '--role-efforts',
    'critic_reviewer:xhigh,verification_reviewer:xhigh',
    '--benchmark-case',
    'blog-content-value',
    '--json'
  ]);
  assert.equal(parsedPlan.ok, true);
  assert.equal(parsedPlan.command, 'agentic review plan');

  const planResult = await executeCli([
    'agentic',
    'review',
    'plan',
    '--review-index',
    reviewIndexPath,
    '--intent',
    'Review the visual UI, page text, readability, trust, and likely user reaction.',
    '--effort',
    'xhigh',
    '--default-subagent-effort',
    'high',
    '--role-efforts',
    'critic_reviewer:xhigh,verification_reviewer:xhigh',
    '--benchmark-case',
    'blog-content-value',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agentic-plan-fixed'
  });
  assert.equal(planResult.exitCode, 0);
  const planBody = JSON.parse(planResult.stdout);
  assert.equal(planBody.command, 'agentic review plan');
  assert.match(planBody.data.plan_hash, /^[a-f0-9]{64}$/);
  assert.equal(planBody.data.approval_required, true);
  assert.equal(planBody.data.boundary.provider_call_performed, false);
  assert.equal(planBody.data.boundary.api_call_performed, false);
  assert.equal(planBody.data.boundary.mcp_execution_exposed, false);
  assert.equal(planBody.data.agentic_human_review_plan.execution.provider_call_performed, false);
  assert.equal(planBody.data.agentic_human_review_plan.human_review_schema_version, '2.0.0');
  assert.equal(planBody.data.agentic_human_review_plan.human_review_contract.output_requirements.content_comprehension_required, true);
  assert.equal(planBody.data.agentic_human_review_plan.provider_instruction_contract.required_behavior.some((item) => /skilled human reviewer/.test(item)), true);
  assert.equal(planBody.data.agentic_human_review_plan.provider_instruction_contract.output_sections.includes('benchmark_requirement_coverage'), true);
  assert.equal(planBody.data.agentic_human_review_plan.result_contract.benchmark_requirement_coverage_required, true);
  assert.equal(planBody.data.agentic_human_review_plan.review_quality_benchmark.quality_dimensions.includes('mechanical_vs_human_distinction'), true);
  assert.equal(planBody.data.agentic_human_review_plan.benchmark_completion_readiness.completion_version, '1.0.0');
  assert.equal(planBody.data.agentic_human_review_plan.benchmark_completion_readiness.release_gate_policy.release_gate_mutated, false);
  assert.equal(planBody.data.agentic_human_review_plan.live_dogfood_execution_gate.status, 'local_or_non_api_dogfood_ready');
  assert.equal(planBody.data.agentic_human_review_plan.provider_capability_contract.provider_id, 'fake-agent');
  assert.match(planBody.data.agentic_human_review_plan.provider_capability_hash, /^[a-f0-9]{64}$/);
  assert.equal(planBody.data.agentic_human_review_plan.provider_capability_contract.execution_boundary.mcp_execution_exposed, false);
  assert.equal(planBody.data.agentic_human_review_plan.rubric_profile.advisory_only, true);
  assert.equal(planBody.data.agentic_human_review_plan.evidence_plan.visual_reference_policy.raw_pixel_bytes_embedded_in_json, false);
  assert.equal(planBody.data.agentic_human_review_plan.evidence_plan.visual_evidence_package_version, '2.0.0');
  assert.equal(planBody.data.agentic_human_review_plan.evidence_plan.visible_text_reading_contract_version, '2.0.0');
  assert.equal(planBody.data.agentic_human_review_plan.privacy_disclosure_audit.controls.raw_provider_response_stored, false);
  assert.equal(planBody.data.agentic_human_review_plan.orchestration_contract.orchestration_version, '2.0.0');
  assert.equal(planBody.data.agentic_human_review_plan.orchestration_contract.round_plan_version, '1.0.0');
  assert.equal(Array.isArray(planBody.data.agentic_human_review_plan.orchestration_contract.round_plan_v2), true);
  assert.equal(planBody.data.agentic_human_review_plan.orchestration_contract.provider_round_execution_mode, 'single_provider_call_with_required_multi_role_round_output');
  assert.equal(Array.isArray(planBody.data.agentic_human_review_plan.role_instruction_contracts), true);
  assert.equal(planBody.data.agentic_human_review_plan.role_instruction_contracts.length >= 5, true);
  assert.equal(planBody.data.agentic_human_review_plan.transfer_approval_preview.exact_match_required, true);
  assert.equal(planBody.data.agentic_human_review_plan.transfer_approval_preview.required_flags.includes('--allow-page-text'), true);
  assert.equal(planBody.data.agentic_human_review_plan.transfer_approval_preview.safety_controls.extra_transfer_flags_rejected, true);
  assert.equal(planBody.data.agentic_human_review_plan.source_evidence_summary.has_technical_evidence, true);
  assert.equal(planBody.data.agentic_human_review_plan.review_effort.mode, 'xhigh');
  assert.equal(planBody.data.agentic_human_review_plan.review_effort.role_count >= 5, true);
  assert.equal(planBody.data.agentic_human_review_plan.review_effort.critic_or_verifier_included, true);
  assert.deepEqual(
    planBody.data.agentic_human_review_plan.transfer_permissions.required_flags.slice().sort(),
    ['allow-page-text', 'allow-raw-pixels']
  );
  assert.match(planBody.data.agentic_human_review_plan.human_explanation.exact_run_command, /agentic review run/);
  assert.match(planBody.data.agentic_human_review_plan.human_explanation.exact_run_command, /--allow-page-text/);
  assert.match(planBody.data.agentic_human_review_plan.human_explanation.exact_run_command, /--allow-raw-pixels/);
  assert.equal(planBody.artifacts.some((artifact) => artifact.type === 'agentic_human_review_plan'), true);
  assert.equal(planBody.artifacts.some((artifact) => artifact.type === 'agentic_human_review_package'), true);
  assert.equal(JSON.stringify(planBody).includes(png.toString('base64')), false);

  const directPlan = await runAgenticHumanReviewPlan({
    'review-index': reviewIndexPath,
    intent: 'Review the visible hierarchy and wording as a person would.',
    provider: 'fake-agent',
    model: 'fake-model'
  }, {
    cwd,
    now: fixedNow,
    createId: () => 'agentic-direct-plan'
  });
  assert.equal(directPlan.status, 'ok');
  assert.equal(directPlan.data.agentic_human_review_plan.execution.provider_call_performed, false);
  assert.equal(agenticHumanReviewBoundary().mcp_execution_exposed, false);

  const invalidBenchmarkPlan = await executeCli([
    'agentic',
    'review',
    'plan',
    '--review-index',
    reviewIndexPath,
    '--intent',
    'Review with an invalid benchmark case.',
    '--benchmark-case',
    'missing-benchmark-case',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(invalidBenchmarkPlan.exitCode, 1);
  assert.equal(JSON.parse(invalidBenchmarkPlan.stdout).errors[0].code, 'AGENTIC_REVIEW_BENCHMARK_CASE_NOT_FOUND');

  const planPath = '.browser-debug/agentic-human-review-plans/agentic-plan-fixed/plan.json';
  const packagePath = '.browser-debug/agentic-human-review-packages/agentic-plan-fixed/package.json';
  const planFilePath = path.join(cwd, planPath);
  const planText = await readFile(planFilePath, 'utf8');
  const planFile = JSON.parse(planText);
  const planHash = planFile.plan_hash;
  assert.equal(planHash, planBody.data.plan_hash);
  assert.equal(planFile.approval.required_plan_hash, planHash);
  const packageFile = JSON.parse(await readFile(path.join(cwd, packagePath), 'utf8'));
  assert.equal(packageFile.human_review_schema_version, '2.0.0');
  assert.equal(packageFile.human_review_input_contract.output_requirements.reader_feeling_required, true);
  assert.equal(packageFile.visual_evidence_package_v2.evidence_package_version, '2.0.0');
  assert.equal(packageFile.visual_evidence_package_v2.raw_pixel_policy.raw_pixel_bytes_embedded_in_json, false);
  assert.equal(packageFile.visible_text_reading_contract.reading_contract_version, '2.0.0');
  assert.equal(packageFile.visible_text_provenance.provenance_version, '1.0.0');
  assert.equal(packageFile.visible_text_reading_contract.text_provenance_version, '1.0.0');
  assert.equal(packageFile.visible_text_reading_contract.source_provenance.source_separation.provider_ocr_performed, false);
  assert.equal(packageFile.screen_text_understanding_contract.contract_version, '1.0.0');
  assert.equal(packageFile.visible_text_reading_contract.ocr_boundary.external_ocr_performed, false);
  assert.equal(typeof packageFile.technical_evidence.finding_count, 'number');
  assert.equal(packageFile.mechanical_review_summary.technical_issue_count, packageFile.technical_evidence.finding_count);
  assert.equal(packageFile.evidence_plan.visual_reference_policy.raw_pixel_bytes_embedded_in_json, false);
  assert.equal(packageFile.privacy_disclosure_audit.controls.deterministic_findings_mutated, false);

  await writeFile(planFilePath, `${JSON.stringify({ ...planFile, intent: 'tampered for readiness' }, null, 2)}\n`, 'utf8');
  const readinessTamperedPlan = await executeCli([
    'agentic',
    'review',
    'provider-readiness',
    '--plan',
    planPath,
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(readinessTamperedPlan.exitCode, 1);
  assert.equal(JSON.parse(readinessTamperedPlan.stdout).errors[0].code, 'AGENTIC_REVIEW_PLAN_MODIFIED');
  await writeFile(planFilePath, planText, 'utf8');

  const directRunWithoutExecute = await runAgenticHumanReviewRun({
    plan: planPath,
    'plan-hash': planHash
  }, {
    cwd,
    now: fixedNow
  });
  assert.equal(directRunWithoutExecute.status, 'error');
  assert.equal(directRunWithoutExecute.errors[0].code, 'AGENTIC_REVIEW_RUN_REQUIRES_EXECUTE');

  const runWithoutExecute = await executeCli([
    'agentic',
    'review',
    'run',
    '--plan',
    planPath,
    '--plan-hash',
    planHash,
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(runWithoutExecute.exitCode, 2);
  assert.equal(JSON.parse(runWithoutExecute.stdout).errors[0].code, 'MISSING_REQUIRED_OPTION');

  const runMissingFlag = await executeCli([
    'agentic',
    'review',
    'run',
    '--plan',
    planPath,
    '--plan-hash',
    planHash,
    '--allow-raw-pixels',
    '--execute',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(runMissingFlag.exitCode, 1);
  assert.equal(JSON.parse(runMissingFlag.stdout).errors[0].code, 'AGENTIC_REVIEW_TRANSFER_FLAGS_MISMATCH');

  const runBadHash = await executeCli([
    'agentic',
    'review',
    'run',
    '--plan',
    planPath,
    '--plan-hash',
    '0'.repeat(64),
    '--allow-page-text',
    '--allow-raw-pixels',
    '--execute',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(runBadHash.exitCode, 1);
  assert.equal(JSON.parse(runBadHash.stdout).errors[0].code, 'AGENTIC_REVIEW_PLAN_HASH_MISMATCH');

  await writeFile(planFilePath, `${JSON.stringify({ ...planFile, intent: 'tampered intent' }, null, 2)}\n`, 'utf8');
  const runTampered = await executeCli([
    'agentic',
    'review',
    'run',
    '--plan',
    planPath,
    '--plan-hash',
    planHash,
    '--allow-page-text',
    '--allow-raw-pixels',
    '--execute',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(runTampered.exitCode, 1);
  assert.equal(JSON.parse(runTampered.stdout).errors[0].code, 'AGENTIC_REVIEW_PLAN_MODIFIED');
  await writeFile(planFilePath, planText, 'utf8');

  const agentExecutionBypass = await executeCli([
    'agent',
    'execution',
    'plan',
    '--package',
    '.browser-debug/agentic-human-review-packages/agentic-plan-fixed/package.json',
    '--surface',
    'local-subscription-agent',
    '--provider',
    'fake-agent',
    '--model',
    'fake-model',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(agentExecutionBypass.exitCode, 1);
  assert.equal(JSON.parse(agentExecutionBypass.stdout).errors[0].code, 'AGENT_EXECUTION_AGENTIC_REVIEW_UNSUPPORTED');

  const apiPlanResult = await executeCli([
    'agentic',
    'review',
    'plan',
    '--review-index',
    reviewIndexPath,
    '--intent',
    'Review page text, artifact references, accessibility summary, and likely viewer feeling with an API provider.',
    '--provider',
    'generic-api-provider',
    '--model',
    'api-model',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agentic-plan-api',
    env: {
      [AGENTIC_REVIEW_API_TIMEOUT_ENV]: '90000'
    }
  });
  assert.equal(apiPlanResult.exitCode, 0);
  const apiPlanBody = JSON.parse(apiPlanResult.stdout);
  assert.equal(apiPlanBody.data.agentic_human_review_plan.provider.timeout_env, AGENTIC_REVIEW_API_TIMEOUT_ENV);
  assert.equal(apiPlanBody.data.agentic_human_review_plan.provider.timeout_ms, 90000);
  assert.equal(apiPlanBody.data.agentic_human_review_plan.provider_capability_contract.timeout_env, AGENTIC_REVIEW_API_TIMEOUT_ENV);
  assert.equal(apiPlanBody.data.agentic_human_review_plan.provider_capability_contract.timeout_ms, 90000);
  const apiRequiredFlags = apiPlanBody.data.agentic_human_review_plan.transfer_permissions.required_flags.slice().sort();
  assert.deepEqual(apiRequiredFlags, ['allow-accessibility-summary', 'allow-artifact-refs', 'allow-page-text']);
  assert.equal(apiPlanBody.data.agentic_human_review_plan.transfer_permissions.default_external_transfer, true);

  let apiRequestPayload = null;
  const apiPlanPath = '.browser-debug/agentic-human-review-plans/agentic-plan-api/plan.json';
  const apiPlanHash = apiPlanBody.data.plan_hash;
  const apiReadinessWithTimeout = await executeCli([
    'agentic',
    'review',
    'provider-readiness',
    '--plan',
    apiPlanPath,
    '--json'
  ], {
    cwd,
    now: fixedNow,
    env: {
      [AGENTIC_REVIEW_API_TIMEOUT_ENV]: '90000'
    }
  });
  assert.equal(apiReadinessWithTimeout.exitCode, 0);
  const apiReadinessBody = JSON.parse(apiReadinessWithTimeout.stdout);
  assert.equal(apiReadinessBody.data.agentic_human_review_provider_readiness.providers[0].timeout_env, AGENTIC_REVIEW_API_TIMEOUT_ENV);
  assert.equal(apiReadinessBody.data.agentic_human_review_provider_readiness.providers[0].timeout_ms, 90000);
  assert.equal(apiReadinessBody.data.agentic_human_review_provider_readiness.providers[0].setup_readiness.timeout_env, AGENTIC_REVIEW_API_TIMEOUT_ENV);

  const invalidApiTimeoutReadiness = await executeCli([
    'agentic',
    'review',
    'provider-readiness',
    '--provider',
    'generic-api-provider',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    env: {
      [AGENTIC_REVIEW_API_TIMEOUT_ENV]: 'invalid'
    }
  });
  assert.equal(invalidApiTimeoutReadiness.exitCode, 1);
  assert.equal(JSON.parse(invalidApiTimeoutReadiness.stdout).errors[0].code, 'AGENTIC_REVIEW_PROVIDER_RUNTIME_CONFIG_INVALID');

  const overflowApiTimeoutReadiness = await executeCli([
    'agentic',
    'review',
    'provider-readiness',
    '--provider',
    'generic-api-provider',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    env: {
      [AGENTIC_REVIEW_API_TIMEOUT_ENV]: '2147483648'
    }
  });
  assert.equal(overflowApiTimeoutReadiness.exitCode, 1);
  assert.equal(JSON.parse(overflowApiTimeoutReadiness.stdout).errors[0].code, 'AGENTIC_REVIEW_PROVIDER_RUNTIME_CONFIG_INVALID');

  const apiRunArgs = [
    'agentic',
    'review',
    'run',
    '--plan',
    apiPlanPath,
    '--plan-hash',
    apiPlanHash,
    ...apiRequiredFlags.map((flag) => `--${flag}`),
    '--provider',
    'generic-api-provider',
    '--model',
    'api-model',
    '--execute',
    '--json'
  ];
  const apiRunWithoutTimeout = await executeCli(apiRunArgs, {
    cwd,
    now: fixedNow,
    env: {
      [AGENTIC_REVIEW_API_ENDPOINT_ENV]: 'https://provider.example/review',
      [AGENTIC_REVIEW_API_CREDENTIAL_ENV]: 'api-secret-value'
    },
    fetch: async () => {
      throw new Error('fetch should not be called when provider capability drift is detected');
    }
  });
  assert.equal(apiRunWithoutTimeout.exitCode, 1);
  assert.equal(JSON.parse(apiRunWithoutTimeout.stdout).errors[0].code, 'AGENTIC_REVIEW_PROVIDER_CAPABILITY_DRIFT');

  const apiRunResult = await executeCli(apiRunArgs, {
    cwd,
    now: fixedNow,
    createId: (prefix) => {
      if (prefix === 'agentic-human-review-execution') {
        return 'agentic-execution-api';
      }
      if (prefix === 'agentic-human-review-result') {
        return 'agentic-result-api';
      }
      return 'unexpected-agentic-api-id';
    },
    env: {
      [AGENTIC_REVIEW_API_ENDPOINT_ENV]: 'https://provider.example/review',
      [AGENTIC_REVIEW_API_CREDENTIAL_ENV]: 'api-secret-value',
      [AGENTIC_REVIEW_API_TIMEOUT_ENV]: '90000'
    },
    fetch: async (url, init) => {
      assert.equal(url, 'https://provider.example/review');
      assert.match(init.headers.authorization, /Bearer /);
      assert.equal(init.redirect, 'error');
      apiRequestPayload = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          summary: 'API provider advisory completed.',
          subjective_perception: {
            first_impression: ['A viewer can understand the main purpose quickly.'],
            emotional_reception: ['The page feels neutral and needs stronger reassurance.']
          },
          readability_comprehension: {
            scanability: 'clear',
            reading_load: 'medium',
            meaning_gaps: ['Some wording needs a clearer proof point.']
          },
          role_opinions: [{
            role: 'content_reviewer',
            display_name: 'Content Reviewer',
            effort: 'high',
            summary: 'The content is understandable, with a proof gap.',
            findings: [],
            uncertainties: []
          }],
          findings: [{
            id: 'api-proof-gap',
            category: 'trust_and_credibility',
            severity: 'medium',
            message: 'The trust claim needs visible evidence.',
            recommendation: 'Add a short proof point near the claim.'
          }],
          review_claims: [{
            id: 'api-claim-1',
            claim: 'The page is readable but needs stronger trust support.',
            supported_by_roles: ['content_reviewer'],
            confidence: { evidence: 'medium', judgment: 'medium', implementation: 'medium' }
          }],
          owner_decision_requests: [{
            id: 'api-owner-proof',
            question: 'Which proof point should be shown first?',
            reason: 'The choice affects trust and comprehension.'
          }]
        })
      };
    }
  });
  assert.equal(apiRunResult.exitCode, 0);
  const apiRunBody = JSON.parse(apiRunResult.stdout);
  assert.equal(apiRunBody.data.agentic_human_review_execution.api_call_performed, true);
  assert.equal(apiRunBody.data.agentic_human_review_execution.external_evidence_transfer, true);
  assert.equal(apiRunBody.data.agentic_human_review_execution.raw_provider_response_stored, false);
  assert.equal(apiRunBody.data.agentic_human_review_execution.credential_values_recorded, false);
  assert.equal(apiRunBody.data.agentic_human_review_execution.page_text_transferred, true);
  assert.equal(apiRunBody.data.agentic_human_review_execution.artifact_refs_transferred, true);
  assert.equal(apiRunBody.data.agentic_human_review_execution.accessibility_summary_transferred, true);
  assert.equal(apiRequestPayload.disclosure_policy.page_text_summary_included, true);
  assert.equal(apiRequestPayload.disclosure_policy.artifact_references_included, true);
  assert.equal(apiRequestPayload.disclosure_policy.raw_pixel_bytes_included, false);
  assert.equal(apiRequestPayload.disclosure_policy.control_metadata_included, true);
  assert.equal(apiRequestPayload.plan.plan_path_included, false);
  assert.match(apiRequestPayload.plan.provider_capability_hash, /^[a-f0-9]{64}$/);
  assert.equal(apiRequestPayload.plan.evidence_plan.privacy_boundary.deterministic_review_mutation_allowed, false);
  assert.equal(apiRequestPayload.plan.visual_evidence_package_v2.raw_pixel_policy.raw_pixel_bytes_embedded_in_json, false);
  assert.equal(apiRequestPayload.plan.visible_text_reading_contract.reading_contract_version, '2.0.0');
  assert.equal(apiRequestPayload.plan.visible_text_provenance.provenance_version, '1.0.0');
  assert.equal(apiRequestPayload.plan.screen_text_understanding_contract.contract_version, '1.0.0');
  assert.equal(apiRequestPayload.plan.orchestration_contract.advisory_only, true);
  assert.equal(Array.isArray(apiRequestPayload.plan.role_instruction_contracts), true);
  assert.equal(apiRequestPayload.execution.execution_path_included, false);
  assert.equal(apiRequestPayload.package.existing_review_state.deterministic_review_path_included, false);
  assert.equal(apiRequestPayload.package.disclosure.raw_pixel_bytes_included, false);
  assert.equal(apiRequestPayload.package.visual_evidence_package_v2.reference_count, 0);
  assert.equal(apiRequestPayload.package.visible_text_reading_contract.snippet_count > 0, true);
  assert.equal(apiRequestPayload.package.visible_text_provenance.source_count > 0, true);
  assert.equal(apiRequestPayload.plan.human_review_contract.output_requirements.reader_feeling_required, true);
  assert.equal(apiRequestPayload.plan.provider_instruction_contract.output_sections.includes('mechanical_vs_human_review'), true);
  assert.doesNotMatch(apiRunResult.stdout, /api-secret-value|provider\.example/);

  const noTextProvider = {
    id: 'metadata-only-api-provider',
    display_name: 'Metadata-only API Provider',
    kind: 'api_provider',
    transport: 'provider_api',
    implemented: true,
    credential_mode: 'environment_variable_only',
    endpoint_env: AGENTIC_REVIEW_API_ENDPOINT_ENV,
    credential_env: AGENTIC_REVIEW_API_CREDENTIAL_ENV,
    default_model: 'metadata-only-model',
    supported_modalities: ['metadata'],
    transferable_evidence_classes: ['artifact_refs'],
    external_evidence_transfer: true,
    api_call_performed: true
  };
  const noTextPlanResult = await executeCli([
    'agentic',
    'review',
    'plan',
    '--review-index',
    reviewIndexPath,
    '--intent',
    'Review only metadata and artifact references with no page text transfer.',
    '--provider',
    'metadata-only-api-provider',
    '--model',
    'metadata-only-model',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agentic-plan-api-no-text',
    agenticReviewProviders: [noTextProvider]
  });
  assert.equal(noTextPlanResult.exitCode, 0);
  const noTextPlanBody = JSON.parse(noTextPlanResult.stdout);
  const noTextRequiredFlags = noTextPlanBody.data.agentic_human_review_plan.transfer_permissions.required_flags.slice().sort();
  assert.deepEqual(noTextRequiredFlags, ['allow-artifact-refs']);
  let noTextPayload = null;
  const noTextRunResult = await executeCli([
    'agentic',
    'review',
    'run',
    '--plan',
    '.browser-debug/agentic-human-review-plans/agentic-plan-api-no-text/plan.json',
    '--plan-hash',
    noTextPlanBody.data.plan_hash,
    '--allow-artifact-refs',
    '--provider',
    'metadata-only-api-provider',
    '--model',
    'metadata-only-model',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: (prefix) => {
      if (prefix === 'agentic-human-review-execution') {
        return 'agentic-execution-api-no-text';
      }
      if (prefix === 'agentic-human-review-result') {
        return 'agentic-result-api-no-text';
      }
      return 'unexpected-agentic-api-no-text-id';
    },
    agenticReviewProviders: [noTextProvider],
    env: {
      [AGENTIC_REVIEW_API_ENDPOINT_ENV]: 'https://provider.example/review',
      [AGENTIC_REVIEW_API_CREDENTIAL_ENV]: 'api-secret-value'
    },
    fetch: async (url, init) => {
      assert.equal(url, 'https://provider.example/review');
      noTextPayload = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ summary: 'Metadata-only advisory completed.' })
      };
    }
  });
  assert.equal(noTextRunResult.exitCode, 0);
  assert.equal(noTextPayload.disclosure_policy.page_text_summary_included, false);
  assert.equal(noTextPayload.plan.visible_text_reading_contract.snippet_count, 0);
  assert.equal(noTextPayload.plan.visible_text_provenance.source_count, 0);
  assert.equal(noTextPayload.package.visible_text_reading_contract.snippet_count, 0);
  assert.equal(noTextPayload.package.visible_text_provenance.source_count, 0);

  const apiDogfoodPlanResult = await executeCli([
    'agentic',
    'review',
    'plan',
    '--review-index',
    reviewIndexPath,
    '--intent',
    'Dogfood a real provider against the blog content benchmark.',
    '--benchmark-case',
    'blog-content-value',
    '--provider',
    'generic-api-provider',
    '--model',
    'api-model',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agentic-plan-api-dogfood',
    env: {
      [AGENTIC_REVIEW_LIVE_DOGFOOD_ENV]: '0'
    }
  });
  assert.equal(apiDogfoodPlanResult.exitCode, 0);
  const apiDogfoodPlanBody = JSON.parse(apiDogfoodPlanResult.stdout);
  assert.equal(apiDogfoodPlanBody.data.agentic_human_review_plan.review_quality_benchmark.case_id, 'blog-content-value');
  assert.equal(apiDogfoodPlanBody.data.agentic_human_review_plan.live_dogfood_execution_gate.status, 'blocked_manual_live_dogfood_opt_in_required');
  const apiDogfoodFlags = apiDogfoodPlanBody.data.agentic_human_review_plan.transfer_permissions.required_flags.slice().sort();
  const apiDogfoodWithoutOptIn = await executeCli([
    'agentic',
    'review',
    'run',
    '--plan',
    '.browser-debug/agentic-human-review-plans/agentic-plan-api-dogfood/plan.json',
    '--plan-hash',
    apiDogfoodPlanBody.data.plan_hash,
    ...apiDogfoodFlags.map((flag) => `--${flag}`),
    '--provider',
    'generic-api-provider',
    '--model',
    'api-model',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    env: {
      [AGENTIC_REVIEW_API_ENDPOINT_ENV]: 'https://provider.example/review',
      [AGENTIC_REVIEW_API_CREDENTIAL_ENV]: 'api-secret-value',
      [AGENTIC_REVIEW_LIVE_DOGFOOD_ENV]: '0'
    },
    fetch: async () => {
      throw new Error('fetch must not be called without live dogfood opt-in');
    }
  });
  assert.equal(apiDogfoodWithoutOptIn.exitCode, 1);
  assert.equal(JSON.parse(apiDogfoodWithoutOptIn.stdout).errors[0].code, 'AGENTIC_REVIEW_LIVE_DOGFOOD_OPT_IN_REQUIRED');

  const httpEndpointRun = await executeCli(apiRunArgs, {
    cwd,
    now: fixedNow,
    env: {
      [AGENTIC_REVIEW_API_ENDPOINT_ENV]: 'http://provider.example/review',
      [AGENTIC_REVIEW_API_CREDENTIAL_ENV]: 'api-secret-value',
      [AGENTIC_REVIEW_API_TIMEOUT_ENV]: '90000'
    },
    fetch: async () => {
      throw new Error('fetch must not be called for unsupported protocol');
    }
  });
  assert.equal(httpEndpointRun.exitCode, 1);
  const httpEndpointBody = JSON.parse(httpEndpointRun.stdout);
  assert.equal(httpEndpointBody.errors[0].code, 'AGENTIC_REVIEW_API_ENDPOINT_UNSUPPORTED_PROTOCOL');
  assert.equal(httpEndpointBody.data.agentic_human_review_execution.failure_diagnostics.stage, 'setup');
  assert.equal(httpEndpointBody.data.agentic_human_review_execution.failure_diagnostics.raw_provider_response_stored, false);

  const credentialEndpointRun = await executeCli(apiRunArgs, {
    cwd,
    now: fixedNow,
    env: {
      [AGENTIC_REVIEW_API_ENDPOINT_ENV]: 'https://user:pass@provider.example/review',
      [AGENTIC_REVIEW_API_CREDENTIAL_ENV]: 'api-secret-value',
      [AGENTIC_REVIEW_API_TIMEOUT_ENV]: '90000'
    },
    fetch: async () => {
      throw new Error('fetch must not be called for endpoint URL credentials');
    }
  });
  assert.equal(credentialEndpointRun.exitCode, 1);
  assert.equal(JSON.parse(credentialEndpointRun.stdout).errors[0].code, 'AGENTIC_REVIEW_API_ENDPOINT_CREDENTIALS_UNSUPPORTED');

  const sensitiveQueryEndpointRun = await executeCli(apiRunArgs, {
    cwd,
    now: fixedNow,
    env: {
      [AGENTIC_REVIEW_API_ENDPOINT_ENV]: 'https://provider.example/review?token=secret',
      [AGENTIC_REVIEW_API_CREDENTIAL_ENV]: 'api-secret-value',
      [AGENTIC_REVIEW_API_TIMEOUT_ENV]: '90000'
    },
    fetch: async () => {
      throw new Error('fetch must not be called for sensitive endpoint query');
    }
  });
  assert.equal(sensitiveQueryEndpointRun.exitCode, 1);
  assert.equal(JSON.parse(sensitiveQueryEndpointRun.stdout).errors[0].code, 'AGENTIC_REVIEW_API_ENDPOINT_SENSITIVE_QUERY_UNSUPPORTED');

  const runResult = await executeCli([
    'agentic',
    'review',
    'run',
    '--plan',
    planPath,
    '--plan-hash',
    planHash,
    '--allow-page-text',
    '--allow-raw-pixels',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: (prefix) => {
      if (prefix === 'agentic-human-review-execution') {
        return 'agentic-execution-fixed';
      }
      if (prefix === 'agentic-human-review-result') {
        return 'agentic-result-fixed';
      }
      return 'unexpected-agentic-id';
    }
  });
  assert.equal(runResult.exitCode, 0);
  const runBody = JSON.parse(runResult.stdout);
  assert.equal(runBody.command, 'agentic review run');
  assert.equal(runBody.data.agentic_human_review_execution.status, 'completed');
  assert.equal(runBody.data.agentic_human_review_execution.plan_hash, planHash);
  assert.equal(runBody.data.agentic_human_review_execution.provider_call_performed, true);
  assert.equal(runBody.data.agentic_human_review_execution.api_call_performed, false);
  assert.equal(runBody.data.agentic_human_review_execution.raw_provider_response_stored, false);
  assert.equal(runBody.data.agentic_human_review_execution.credential_values_recorded, false);
  assert.equal(runBody.data.agentic_human_review_execution.existing_review_mutated, false);
  assert.equal(runBody.data.agentic_human_review_execution.mcp_execution_exposed, false);
  assert.deepEqual(runBody.data.agentic_human_review_execution.transfer_permissions.supplied_flags, ['allow-page-text', 'allow-raw-pixels']);
  assert.equal(runBody.data.agentic_human_review_advisory.gate_effect, 'none');
  assert.equal(JSON.stringify(runBody).includes(png.toString('base64')), false);

  const resultText = await readFile(path.join(cwd, '.browser-debug', 'agentic-human-review-results', 'agentic-execution-fixed', 'result.json'), 'utf8');
  const resultFile = JSON.parse(resultText);
  assert.equal(resultFile.result_type, 'agentic_human_review_advisory');
  assert.equal(resultFile.human_review_schema_version, '2.0.0');
  assert.equal(resultFile.agentic_human_review_advisory.source, 'agentic_human_review');
  assert.equal(Array.isArray(resultFile.reader_experience_review.likely_viewer_feeling), true);
  assert.equal(Array.isArray(resultFile.mechanical_vs_human_review.balanced_takeaways), true);
  assert.equal(resultFile.human_review_coverage.human_review_schema_version, '2.0.0');
  assert.equal(resultFile.human_review_coverage.coverage_score > 0.5, true);
  assert.equal(resultFile.benchmark_requirement_coverage.status, 'passed');
  assert.equal(resultFile.benchmark_requirement_coverage.summary.structured_record_completeness_score, 1);
  assert.equal(resultFile.benchmark_requirement_coverage.required_mentions.every((item) => item.present === true), true);
  assert.equal(resultFile.agentic_human_review_readiness.advisory_only, true);
  assert.equal(resultFile.agentic_human_review_readiness.deterministic_findings_unchanged, true);
  assert.equal(resultFile.agentic_human_review_readiness.gate_effect, 'none');
  assert.equal(resultFile.boundary.mcp_execution_exposed, false);
  assert.equal(resultFile.boundary.raw_provider_response_stored, false);
  assert.equal(resultFile.boundary.credential_values_recorded, false);
  assert.equal(Array.isArray(resultFile.role_execution_records), true);
  assert.equal(resultFile.role_execution_records.every((record) => record.reported_by_provider === true), true);
  assert.equal(resultFile.role_instruction_coverage.coverage_score > 0, true);
  assert.equal(resultFile.review_quality_evaluation.gate_effect, 'none');
  assert.equal(resultFile.review_quality_evaluation.evaluator_version, '3.0.0');
  assert.equal(typeof resultFile.review_quality_evaluation.calibration_ready_score, 'number');
  assert.equal(typeof resultFile.review_quality_evaluation.human_likeness_score, 'number');
  assert.equal(typeof resultFile.review_quality_evaluation.content_reading_score, 'number');
  assert.equal(resultFile.review_quality_evaluation.safety_boundary_score, 1);
  assert.equal(resultFile.review_quality_evaluation.xhigh_completion_status, 'complete');
  assert.equal(resultFile.xhigh_multi_round_review.status, 'complete');
  assert.equal(resultFile.xhigh_multi_round_review.true_multi_call_execution_performed, false);
  assert.equal(resultFile.benchmark_completion_readiness.release_gate_policy.release_gate_mutated, false);
  assert.equal(resultFile.live_dogfood_execution_gate.status, 'local_or_non_api_dogfood_ready');
  assert.equal(resultFile.human_report_v3.report_version, '3.0.0');
  assert.equal(resultFile.human_report_v3.owner_review_required, true);
  assert.equal(resultFile.consensus_analysis.gate_effect, 'none');
  assert.equal(resultFile.dissent_analysis.owner_review_required, true);
  assert.equal(resultFile.calibration_metadata.calibration_version, '1.0.0');
  assert.equal(resultFile.privacy_disclosure_audit.controls.raw_pixel_bytes_embedded_in_json, false);
  assert.equal(resultFile.provider.capability_contract_included, false);
  assert.match(resultFile.provider.capability_hash, /^[a-f0-9]{64}$/);
  assert.equal(Array.isArray(resultFile.review_claims), true);
  assert.equal(Array.isArray(resultFile.critique_records), true);
  assert.equal(resultFile.integration_record.owner_review_required, true);
  assert.equal(resultFile.report_quality.gate_effect, 'none');
  assert.equal(resultFile.report_quality.human_review_coverage_score > 0.5, true);
  assert.equal(resultFile.report_quality.actionability_score > 0, true);
  assert.equal(JSON.stringify(resultFile).includes(png.toString('base64')), false);
  const reportText = await readFile(path.join(cwd, '.browser-debug', 'reports', 'agentic-execution-fixed-agentic-human-review.md'), 'utf8');
  assert.match(reportText, /Agentic Human Review/);
  assert.match(reportText, /Advisory-only result/);
  assert.match(reportText, /Role Opinions/);
  assert.match(reportText, /Mechanical Review Compared With Human Review/);
  assert.match(reportText, /Human Report V3/);
  assert.match(reportText, /Report Quality/);
  assert.match(reportText, /Quality Evaluation/);
  assert.match(reportText, /Calibration And Privacy/);

  const qualityResult = await executeCli([
    'agentic',
    'review',
    'report-quality',
    '--result',
    '.browser-debug/agentic-human-review-results/agentic-execution-fixed/result.json',
    '--execution',
    '.browser-debug/agentic-human-review-results/agentic-execution-fixed/execution.json',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(qualityResult.exitCode, 0);
  const qualityBody = JSON.parse(qualityResult.stdout);
  assert.equal(qualityBody.command, 'agentic review report-quality');
  assert.equal(qualityBody.data.agentic_human_review_report_quality.gate_effect, 'none');
  assert.equal(qualityBody.data.agentic_human_review_report_quality.quality_evaluator_version, '3.0.0');
  assert.equal(qualityBody.data.agentic_human_review_report_quality.human_review_coverage_score > 0.5, true);
  assert.equal(qualityBody.data.agentic_human_review_report_quality.benchmark_requirement_coverage_score, 1);
  assert.equal(qualityBody.data.agentic_human_review_report_quality.actionability_score > 0, true);
  assert.equal(qualityBody.data.agentic_human_review_report_quality.xhigh_multi_round_review.status, 'complete');
  assert.equal(qualityBody.data.agentic_human_review_report_quality.benchmark_completion_readiness.release_gate_policy.blocks_release, false);
  assert.equal(qualityBody.data.agentic_human_review_report_quality.human_review_maturity.human_equivalence_claim.human_equivalent_claim_allowed, false);
  assert.equal(qualityBody.data.agentic_human_review_report_quality.human_review_maturity.human_equivalence_claim.human_superior_claim_allowed, false);
  assert.equal(qualityBody.data.agentic_human_review_report_quality.human_review_maturity.current_result.observed_effort, 'xhigh');
  assert.deepEqual(qualityBody.data.agentic_human_review_report_quality.human_review_maturity.longitudinal_quality_evaluation.missing_efforts, ['standard', 'deep']);
  assert.equal(qualityBody.data.agentic_human_review_report_quality.human_review_maturity.real_page_dogfood_evidence.current_result_counts_as_manual_live_provider_dogfood, false);
  assert.equal(qualityBody.data.agentic_human_review_report_quality.human_review_maturity.gaps.some((gap) => gap.code === 'AHR_MATURITY_COMPARISON_HISTORY_REQUIRED'), true);
  assert.equal(qualityBody.data.agentic_human_review_report_quality.longitudinal_quality_evaluation.current_result_counts_as_longitudinal_series, false);
  assert.equal(qualityBody.data.agentic_human_review_report_quality.boundary.read_only, true);
  assert.equal(qualityBody.data.agentic_human_review_report_quality.boundary.mcp_execution_exposed, false);

  await writeFile(path.join(cwd, 'not-agentic-result.json'), '{"type":"not_agentic"}\n', 'utf8');
  const invalidQuality = await executeCli([
    'agentic',
    'review',
    'report-quality',
    '--result',
    'not-agentic-result.json',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(invalidQuality.exitCode, 1);
  assert.equal(JSON.parse(invalidQuality.stdout).errors[0].code, 'AGENTIC_REVIEW_RESULT_CONTRACT_MISMATCH');

  const directQuality = await runAgenticHumanReviewReportQuality({
    result: '.browser-debug/agentic-human-review-results/agentic-execution-fixed/result.json'
  }, { cwd, now: fixedNow });
  assert.equal(directQuality.status, 'ok');
  assert.equal(directQuality.data.agentic_human_review_report_quality.advisory_only, true);
  assert.equal(directQuality.data.agentic_human_review_report_quality.human_review_maturity.human_equivalence_claim.status, 'not_claimed');

  const benchmarkList = await executeCli([
    'agentic',
    'review',
    'benchmark',
    'list',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(benchmarkList.exitCode, 0);
  const benchmarkListBody = JSON.parse(benchmarkList.stdout);
  assert.equal(benchmarkListBody.command, 'agentic review benchmark list');
  assert.equal(benchmarkListBody.data.agentic_human_review_benchmark_cases.summary.total >= 5, true);
  assert.equal(benchmarkListBody.data.agentic_human_review_benchmark_cases.benchmark_completion_readiness.status, 'benchmark_corpus_ready');
  assert.equal(benchmarkListBody.data.agentic_human_review_benchmark_cases.boundary.read_only, true);

  const benchmarkShow = await executeCli([
    'agentic',
    'review',
    'benchmark',
    'show',
    '--case',
    'blog-content-value',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(benchmarkShow.exitCode, 0);
  const benchmarkShowBody = JSON.parse(benchmarkShow.stdout);
  assert.equal(benchmarkShowBody.command, 'agentic review benchmark show');
  assert.equal(benchmarkShowBody.data.agentic_human_review_benchmark_case.case.case_id, 'blog-content-value');
  assert.equal(benchmarkShowBody.data.agentic_human_review_benchmark_case.calibration_contract.advisory_only, true);
  assert.equal(benchmarkShowBody.data.agentic_human_review_benchmark_case.benchmark_completion_readiness.active_case_id, 'blog-content-value');

  const calibrationResult = await executeCli([
    'agentic',
    'review',
    'calibrate',
    '--result',
    '.browser-debug/agentic-human-review-results/agentic-execution-fixed/result.json',
    '--case',
    'blog-content-value',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(calibrationResult.exitCode, 0);
  const calibrationBody = JSON.parse(calibrationResult.stdout);
  assert.equal(calibrationBody.command, 'agentic review calibrate');
  assert.equal(calibrationBody.data.agentic_human_review_calibration.case_id, 'blog-content-value');
  assert.equal(typeof calibrationBody.data.agentic_human_review_calibration.scores.required_mention_coverage, 'number');
  assert.equal(calibrationBody.data.agentic_human_review_calibration.passed, true);
  assert.equal(calibrationBody.data.agentic_human_review_calibration.scores.structured_record_completeness_score, 1);
  assert.equal(calibrationBody.data.agentic_human_review_calibration.benchmark_completion_readiness.active_case_id, 'blog-content-value');
  assert.equal(calibrationBody.data.agentic_human_review_calibration.boundary.read_only, true);
  assert.equal(calibrationBody.data.agentic_human_review_calibration.gate_effect, 'none');

  const comparisonResult = await executeCli([
    'agentic',
    'review',
    'compare',
    '--baseline',
    '.browser-debug/agentic-human-review-results/agentic-execution-api/result.json',
    '--candidate',
    '.browser-debug/agentic-human-review-results/agentic-execution-fixed/result.json',
    '--comparison-kind',
    'direct-vs-tracecue',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(comparisonResult.exitCode, 0);
  const comparisonBody = JSON.parse(comparisonResult.stdout);
  assert.equal(comparisonBody.command, 'agentic review compare');
  assert.equal(comparisonBody.data.agentic_human_review_comparison.boundary.read_only, true);
  assert.equal(comparisonBody.data.agentic_human_review_comparison.gate_effect, 'none');
  assert.equal(comparisonBody.data.agentic_human_review_comparison.comparison_kind, 'direct-vs-tracecue');
  assert.equal(comparisonBody.data.agentic_human_review_comparison.direct_vs_tracecue_analysis.candidate_role, 'tracecue_agentic_human_review_workflow');
  assert.equal(typeof comparisonBody.data.agentic_human_review_comparison.deltas.actionability_score, 'number');
  assert.equal(typeof comparisonBody.data.agentic_human_review_comparison.deltas.benchmark_structured_record_completeness_score, 'number');

  const evidenceSetPath = path.join(cwd, 'agentic-evidence-set.json');
  await writeFile(evidenceSetPath, JSON.stringify({
    type: 'agentic_human_review_evidence_set_manifest',
    results: [
      { path: '.browser-debug/agentic-human-review-results/agentic-execution-fixed/result.json' }
    ],
    calibrations: [],
    comparisons: []
  }, null, 2), 'utf8');
  const evidenceSet = await executeCli([
    'agentic',
    'review',
    'evidence-set',
    'summarize',
    '--input',
    'agentic-evidence-set.json',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(evidenceSet.exitCode, 0);
  const evidenceSetBody = JSON.parse(evidenceSet.stdout);
  assert.equal(evidenceSetBody.command, 'agentic review evidence-set summarize');
  assert.equal(evidenceSetBody.data.agentic_human_review_evidence_set.summary.observed_efforts.includes('xhigh'), true);
  assert.equal(evidenceSetBody.data.agentic_human_review_evidence_set.summary.human_equivalent_claim_allowed, false);

  const comparisonDatasetPath = path.join(cwd, 'agentic-comparison-dataset.json');
  await writeFile(comparisonDatasetPath, JSON.stringify({
    pairs: [{
      baseline: '.browser-debug/agentic-human-review-results/agentic-execution-api/result.json',
      candidate: '.browser-debug/agentic-human-review-results/agentic-execution-fixed/result.json',
      comparison_kind: 'provider-dogfood'
    }]
  }, null, 2), 'utf8');
  const batchComparison = await executeCli([
    'agentic',
    'review',
    'compare',
    'batch',
    '--dataset',
    'agentic-comparison-dataset.json',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(batchComparison.exitCode, 0);
  const batchComparisonBody = JSON.parse(batchComparison.stdout);
  assert.equal(batchComparisonBody.command, 'agentic review compare batch');
  assert.equal(batchComparisonBody.data.agentic_human_review_batch_comparison.compared_pair_count, 1);
  assert.equal(batchComparisonBody.data.agentic_human_review_batch_comparison.boundary.read_only, true);

  const evaluatorPolicy = await executeCli([
    'agentic',
    'review',
    'evaluator',
    'policy',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(evaluatorPolicy.exitCode, 0);
  const evaluatorPolicyBody = JSON.parse(evaluatorPolicy.stdout);
  assert.equal(evaluatorPolicyBody.data.agentic_human_review_evaluator_policy.policy.required_outputs.structured_benchmark_requirement_coverage, true);

  const xhighPlan = await executeCli([
    'agentic',
    'review',
    'xhigh',
    'plan',
    '--plan',
    planPath,
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(xhighPlan.exitCode, 0);
  const xhighPlanBody = JSON.parse(xhighPlan.stdout);
  assert.equal(xhighPlanBody.data.agentic_human_review_xhigh_plan.status, 'ready_for_local_round_simulation');
  assert.equal(xhighPlanBody.data.agentic_human_review_xhigh_plan.execution_boundary.live_multi_call_execution_performed, false);

  const longitudinal = await executeCli([
    'agentic',
    'review',
    'quality',
    'longitudinal',
    '--evidence-set',
    'agentic-evidence-set.json',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(longitudinal.exitCode, 0);
  const longitudinalBody = JSON.parse(longitudinal.stdout);
  assert.equal(longitudinalBody.data.agentic_human_review_longitudinal_quality.claim_policy.human_equivalent_claim_allowed, false);

  const claimAudit = await executeCli([
    'agentic',
    'review',
    'claim',
    'audit',
    '--result',
    '.browser-debug/agentic-human-review-results/agentic-execution-fixed/result.json',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(claimAudit.exitCode, 0);
  const claimAuditBody = JSON.parse(claimAudit.stdout);
  assert.equal(claimAuditBody.data.agentic_human_review_claim_audit.human_superior_claim_allowed, false);

  const claimPolicy = await executeCli([
    'agentic',
    'review',
    'claim',
    'policy',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(claimPolicy.exitCode, 0);
  const claimPolicyBody = JSON.parse(claimPolicy.stdout);
  assert.equal(claimPolicyBody.data.agentic_human_review_claim_policy.policy.equality_or_superiority_claims_allowed, false);

  assert.equal(await readFile(path.join(cwd, '.browser-debug', 'reviews', 'image-review-fixed.json'), 'utf8'), originalReviewText);
  assert.equal(await readFile(path.join(cwd, reviewIndexPath), 'utf8'), originalIndexText);

  const statusResult = await executeCli([
    'agentic',
    'review',
    'status',
    '--execution',
    '.browser-debug/agentic-human-review-results/agentic-execution-fixed/execution.json',
    '--json'
  ], { cwd, now: fixedNow });
  assert.equal(statusResult.exitCode, 0);
  const statusBody = JSON.parse(statusResult.stdout);
  assert.equal(statusBody.command, 'agentic review status');
  assert.equal(statusBody.data.agentic_human_review_status.status, 'completed');
  assert.equal(statusBody.data.boundary.mcp_execution_exposed, false);

  const listResult = await executeCli(['agentic', 'review', 'list', '--json'], { cwd, now: fixedNow });
  assert.equal(listResult.exitCode, 0);
  const listBody = JSON.parse(listResult.stdout);
  assert.equal(listBody.command, 'agentic review list');
  assert.equal(listBody.data.summary.total, 6);
  assert.equal(listBody.data.summary.completed, 3);
  assert.equal(listBody.data.summary.blocked, 3);
  assert.equal(listBody.data.summary.api_call_performed, true);
  assert.equal(listBody.data.summary.external_evidence_transfer, true);
  assert.equal(listBody.data.boundary.mcp_execution_exposed, false);
});

test('agentic human review injected runner redacts sensitive advisory text', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-agentic-review-injected-'));
  const png = minimalPngBuffer(120, 80);
  await writeFile(path.join(cwd, 'screen.png'), png);

  const imageReview = await executeCli(['review', '--image', 'screen.png', '--json'], {
    cwd,
    now: fixedNow,
    createId: () => 'image-review-injected'
  });
  assert.equal(imageReview.exitCode, 0);

  const planResult = await executeCli([
    'agentic',
    'review',
    'plan',
    '--review-index',
    '.browser-debug/review-artifacts/image-review-injected.json',
    '--intent',
    'Review text comprehension and likely emotional reaction.',
    '--effort',
    'xhigh',
    '--provider',
    'injected-runner',
    '--model',
    'injected-local-model',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agentic-plan-injected'
  });
  assert.equal(planResult.exitCode, 0);
  const planBody = JSON.parse(planResult.stdout);
  const planPath = '.browser-debug/agentic-human-review-plans/agentic-plan-injected/plan.json';
  const planHash = planBody.data.plan_hash;
  const injectedRequiredFlags = planBody.data.agentic_human_review_plan.transfer_permissions.required_flags.slice().sort();
  const secretText = 'TRACE_CUE_TEST_SECRET: sentinel';

  const runResult = await executeCli([
    'agentic',
    'review',
    'run',
    '--plan',
    planPath,
    '--plan-hash',
    planHash,
    ...injectedRequiredFlags.map((flag) => `--${flag}`),
    '--provider',
    'injected-runner',
    '--model',
    'injected-local-model',
    '--execute',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: (prefix) => {
      if (prefix === 'agentic-human-review-execution') {
        return 'agentic-execution-injected';
      }
      if (prefix === 'agentic-human-review-result') {
        return 'agentic-result-injected';
      }
      return 'unexpected-agentic-injected-id';
    },
    agenticReviewRunner: async () => ({
      summary: `Injected review completed. ${secretText}`,
      subjective_perception: {
        first_impression: [`The page likely feels clear at first glance. ${secretText}`],
        emotional_reception: ['A cautious reader may want stronger reassurance.']
      },
      readability_comprehension: {
        scanability: 'clear',
        reading_load: 'medium',
        meaning_gaps: [`Some claims need clearer proof. ${secretText}`]
      },
      role_opinions: [{
        role: 'content_reviewer',
        display_name: 'Content Reviewer',
        effort: 'high',
        summary: `Copy is understandable but should avoid hidden assumptions. ${secretText}`,
        findings: [],
        uncertainties: []
      }],
      findings: [{
        id: 'injected-copy-risk',
        category: 'copy_and_tone',
        severity: 'medium',
        message: `The main text needs more concrete evidence. ${secretText}`,
        recommendation: `Revise the supporting copy. ${secretText}`
      }],
      owner_decision_requests: [{
        id: 'owner-tone-decision',
        question: `Should the tone be more direct? ${secretText}`,
        reason: `Tone changes affect audience trust. ${secretText}`
      }]
    })
  });
  assert.equal(runResult.exitCode, 0);
  assert.doesNotMatch(runResult.stdout, /sentinel/);
  const resultText = await readFile(path.join(cwd, '.browser-debug', 'agentic-human-review-results', 'agentic-execution-injected', 'result.json'), 'utf8');
  assert.doesNotMatch(resultText, /sentinel/);
  const resultFile = JSON.parse(resultText);
  assert.equal(resultFile.agentic_human_review_findings.length, 1);
  assert.equal(resultFile.agentic_human_review_findings[0].source, 'agentic_human_review_advisory');
  assert.equal(resultFile.boundary.raw_provider_response_stored, false);
  assert.equal(resultFile.xhigh_multi_round_review.status, 'incomplete');
  assert.equal(resultFile.xhigh_multi_round_review.missing_roles.includes('synthesis_agent'), true);
  assert.equal(resultFile.review_quality_evaluation.multi_round_expectation_satisfied, false);
  assert.equal(resultFile.role_execution_records.some((record) => record.status === 'missing_output'), true);
  const reportText = await readFile(path.join(cwd, '.browser-debug', 'reports', 'agentic-execution-injected-agentic-human-review.md'), 'utf8');
  assert.doesNotMatch(reportText, /sentinel/);
});

test('agentic human review responses adapter converts requests without leaking credentials or local paths', async () => {
  const request = adapterTraceCueRequest();
  let observedFetch = null;
  const result = await handleAgenticHumanReviewResponsesAdapterRequest({
    method: 'POST',
    url: '/agentic-human-review',
    headers: {
      host: '127.0.0.1:8787',
      'content-type': 'application/json',
      authorization: 'Bearer adapter-secret-value'
    },
    remoteAddress: '127.0.0.1',
    bodyText: JSON.stringify(request),
    env: adapterEnv(),
    fetchImpl: async (url, init) => {
      observedFetch = { url, init, body: JSON.parse(init.body) };
      return jsonResponse({
        output_text: JSON.stringify({
          summary: 'The adapter provider produced a human-facing review.',
          subjective_perception: {
            first_impression: ['The screen likely feels understandable but not yet fully reassuring.'],
            emotional_reception: ['A reader may feel cautious until the evidence is clearer.']
          },
          readability_comprehension: {
            scanability: 'mixed',
            reading_load: 'medium',
            meaning_gaps: ['The primary claim needs a clearer evidence link.']
          },
          role_opinions: request.plan.sub_agents.map((agent) => ({
            role: agent.role,
            display_name: agent.display_name,
            effort: agent.effort,
            round: agent.round,
            summary: `${agent.display_name} reviewed the request through the adapter.`,
            findings: [],
            uncertainties: []
          })),
          findings: [{
            id: 'adapter-review-gap',
            category: 'copy_and_comprehension',
            severity: 'medium',
            message: 'The visible content needs clearer evidence support.',
            recommendation: 'Connect the main claim to the strongest visible proof.'
          }],
          improvement_suggestions: ['Clarify the main claim and evidence order.'],
          owner_decision_requests: [{
            id: 'owner-evidence-priority',
            question: 'Which proof should be most prominent?',
            reason: 'The answer affects reader trust.'
          }]
        })
      });
    },
    now: fixedNow
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.body.summary, 'The adapter provider produced a human-facing review.');
  assert.equal(result.body.role_opinions.length, request.plan.sub_agents.length);
  assert.equal(result.body.adapter_boundary.raw_provider_response_stored, false);
  assert.equal(result.body.adapter_boundary.credential_values_recorded, false);
  assert.equal(observedFetch.url, 'https://api.openai.com/v1/responses');
  assert.equal(observedFetch.init.method, 'POST');
  assert.equal(observedFetch.init.headers.authorization, 'Bearer provider-secret-value');
  assert.equal(observedFetch.body.model, 'review-model-for-test');
  assert.equal(observedFetch.body.store, false);
  assert.deepEqual(observedFetch.body.tools, []);
  assert.equal(observedFetch.body.text.format.type, 'json_schema');
  assert.equal(observedFetch.body.text.format.name, 'tracecue_agentic_human_review_advisory');
  assert.doesNotMatch(observedFetch.body.input, /adapter-secret-value|provider-secret-value|\.browser-debug|\/tmp\/local-plan/);
  assert.doesNotMatch(JSON.stringify(result.body), /adapter-secret-value|provider-secret-value|output_text/);

  const directRequest = buildOpenAiResponsesRequest({
    traceCueRequest: request,
    model: 'direct-model',
    generatedAt: fixedNow
  });
  assert.equal(directRequest.model, 'direct-model');
  assert.equal(directRequest.store, false);
  assert.doesNotMatch(directRequest.input, /\.browser-debug|\/tmp\/local-plan/);
});

test('agentic human review responses adapter rejects unsafe local requests before provider fetch', async () => {
  const request = adapterTraceCueRequest();
  let fetchCalls = 0;
  const base = {
    method: 'POST',
    url: '/agentic-human-review',
    remoteAddress: '127.0.0.1',
    bodyText: JSON.stringify(request),
    env: adapterEnv(),
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch should not be called');
    },
    now: fixedNow
  };

  const nonLoopbackHost = await handleAgenticHumanReviewResponsesAdapterRequest({
    ...base,
    headers: {
      host: 'example.com',
      authorization: 'Bearer adapter-secret-value',
      'content-type': 'application/json'
    }
  });
  assert.equal(nonLoopbackHost.statusCode, 403);
  assert.equal(nonLoopbackHost.body.error.code, 'AHR_RESPONSES_ADAPTER_LOOPBACK_REQUIRED');

  const missingToken = await handleAgenticHumanReviewResponsesAdapterRequest({
    ...base,
    headers: {
      host: '127.0.0.1:8787',
      'content-type': 'application/json'
    }
  });
  assert.equal(missingToken.statusCode, 401);
  assert.equal(missingToken.body.error.code, 'AHR_RESPONSES_ADAPTER_UNAUTHORIZED');

  const rawPixelBytes = await handleAgenticHumanReviewResponsesAdapterRequest({
    ...base,
    headers: {
      host: '127.0.0.1:8787',
      authorization: 'Bearer adapter-secret-value',
      'content-type': 'application/json'
    },
    bodyText: JSON.stringify({
      ...request,
      disclosure_policy: {
        ...request.disclosure_policy,
        raw_pixel_bytes_included: true
      }
    })
  });
  assert.equal(rawPixelBytes.statusCode, 400);
  assert.equal(rawPixelBytes.body.error.code, 'AHR_RESPONSES_ADAPTER_RAW_PIXEL_BYTES_UNSUPPORTED');

  const providerEndpoint = await handleAgenticHumanReviewResponsesAdapterRequest({
    ...base,
    headers: {
      host: '127.0.0.1:8787',
      authorization: 'Bearer adapter-secret-value',
      'content-type': 'application/json'
    },
    env: {
      ...base.env,
      AGENTIC_HUMAN_REVIEW_OPENAI_RESPONSES_ENDPOINT: 'http://provider.example/review'
    }
  });
  assert.equal(providerEndpoint.statusCode, 503);
  assert.equal(providerEndpoint.body.error.code, 'AHR_RESPONSES_ADAPTER_PROVIDER_ENDPOINT_UNSUPPORTED_PROTOCOL');
  assert.equal(fetchCalls, 0);
  assert.doesNotMatch(JSON.stringify(providerEndpoint.body), /adapter-secret-value|provider-secret-value/);
});

test('agentic human review responses adapter parses provider output text safely', () => {
  const parsed = parseOpenAiResponsesAdvisory({
    output: [{
      content: [{
        text: JSON.stringify({
          summary: 'Parsed from message content.',
          role_opinions: []
        })
      }]
    }]
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.summary, 'Parsed from message content.');

  const invalid = parseOpenAiResponsesAdvisory({ output_text: 'not json' });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, 'AHR_RESPONSES_ADAPTER_PROVIDER_OUTPUT_INVALID_JSON');

  assert.throws(
    () => normalizeAgenticHumanReviewResponsesAdapterConfig({ host: '0.0.0.0' }),
    /loopback/
  );
});

test('target manifests and action candidates use generic review abstractions', () => {
  const template = createTargetManifest({
    url: 'https://example.test/app',
    name: 'Example App',
    'max-routes': '12'
  });
  assert.equal(template.name, 'Example App');
  assert.equal(template.budgets.maxRoutes, 12);
  assert.deepEqual(template.viewportMatrix, ['desktop', 'mobile']);

  const normalized = normalizeTargetManifest({
    baseUrl: 'https://example.test/app',
    seeds: ['/app#overview'],
    pages: [{
      name: 'Overview',
      path: '/app#overview',
      role: 'status_overview',
      priority: 'P1',
      viewports: ['mobile', { name: 'tablet', width: 768, height: 1024 }],
      expectations: {
        text: ['Overview'],
        selectors: ['#primary'],
        dataBindings: [{
          id: 'service-status',
          sourceId: 'service',
          pointer: '/service/status',
          selector: '#service-state',
          target: 'data-state'
        }],
        userQuestions: [{
          id: 'attention-state',
          question: 'Can the user tell whether the service needs attention?',
          expectedEvidence: ['ready'],
          selector: '#risk'
        }]
      },
      mock: 'mocks/overview.png'
    }],
    sourceData: [{
      id: 'service',
      data: { service: { status: 'ready' } }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['non-engineer', 'early-career engineer'],
      goal: 'Help users understand the current service status.',
      requiredUserQuestions: [{
        id: 'status-state',
        pageId: 'overview',
        question: 'Can the user identify the current service status?',
        expectedEvidence: ['ready']
      }],
      reviewBrief: {
        summary: 'The overview page should explain current service status and next decisions.',
        userRoles: ['operator'],
        decisionNeeds: [{
          id: 'intervention-decision',
          pageId: 'overview',
          question: 'Can the user decide whether intervention is needed?',
          expectedEvidence: ['ready']
        }]
      },
      rubric: [{
        id: 'status-state-criterion',
        category: 'status_clarity',
        pageId: 'overview',
        criterion: 'The page communicates status clearly.',
        expectedEvidence: ['ready']
      }]
    },
    viewportMatrix: ['desktop', { name: 'phone', width: 390, height: 844 }],
    budgets: { maxRoutes: 5 }
  });
  assert.equal(normalized.ok, true);
  assert.equal(normalized.target.seeds[0], 'https://example.test/app#overview');
  assert.equal(normalized.target.viewportMatrix[0].name, 'desktop');
  assert.equal(normalized.target.viewportMatrix[1].name, 'phone');
  assert.equal(normalized.target.viewportMatrix.some((viewport) => viewport.name === 'mobile'), true);
  assert.equal(normalized.target.viewportMatrix.some((viewport) => viewport.name === 'tablet'), true);
  assert.equal(normalized.target.budgets.maxRoutes, 5);
  assert.equal(normalized.target.pages[0].id, 'overview');
  assert.equal(normalized.target.pages[0].role, 'status_overview');
  assert.equal(normalized.target.pages[0].priority, 'high');
  assert.equal(normalized.target.pages[0].expectations.text[0].value, 'Overview');
  assert.equal(normalized.target.pages[0].expectations.selectors[0].value, '#primary');
  assert.equal(normalized.target.pages[0].expectations.dataBindings[0].sourceId, 'service');
  assert.equal(normalized.target.pages[0].expectations.dataBindings[0].target, 'data-state');
  assert.equal(normalized.target.pages[0].expectations.userQuestions[0].id, 'attention-state');
  assert.equal(normalized.target.localContentUxAdvisory.enabled, true);
  assert.equal(normalized.target.localContentUxAdvisory.requiredUserQuestions[0].id, 'status-state');
  assert.equal(normalized.target.localContentUxAdvisory.reviewBrief.decisionNeeds[0].id, 'intervention-decision');
  assert.equal(normalized.target.localContentUxAdvisory.rubric[0].category, 'status_clarity');
  assert.equal(normalized.target.localContentUxAdvisory.sourceData[0].available, true);

  assert.equal(classifyActionCandidate({ tag: 'a', href: 'https://example.test/app#next' }, 'https://example.test/app'), 'navigation');
  assert.equal(classifyActionCandidate({ tag: 'input' }, 'https://example.test/app'), 'input_required');
  assert.equal(classifyActionCandidate({ tag: 'button', text: 'Delete project' }, 'https://example.test/app'), 'destructive');
  assert.equal(classifyActionCandidate({ tag: 'button', text: 'Open settings' }, 'https://example.test/app'), 'state_revealing');
});

test('local content UX advisory is manifest opt-in and does not expose source values', () => {
  const normalized = normalizeTargetManifest({
    baseUrl: 'https://example.test/app',
    pages: [{
      name: 'Overview',
      path: '/app',
      role: 'status_overview',
      expectations: {
        dataBindings: [{
          id: 'run-summary',
          sourceId: 'service',
          pointer: '/status/summary',
          target: 'text',
          severity: 'medium'
        }]
      }
    }],
    sourceData: [{
      id: 'service',
      data: { status: { summary: 'Current local run is healthy' } }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['operators'],
      goal: 'Expose service status in a way users can understand.',
      reviewBrief: {
        summary: 'The overview page should let operators decide whether intervention is needed.',
        userRoles: ['operator'],
        decisionNeeds: [{
          id: 'operator-decision',
          pageId: 'overview',
          question: 'Can operators decide whether intervention is needed?',
          expectedEvidence: ['healthy']
        }]
      },
      rubric: [{
        id: 'state-summary-rubric',
        category: 'status_clarity',
        pageId: 'overview',
        criterion: 'The page communicates service health clearly.',
        expectedEvidence: ['healthy'],
        severity: 'medium'
      }]
    }
  });
  assert.equal(normalized.ok, true);
  const target = normalized.target;
  const matched = buildLocalContentUxAdvisory({
    target,
    routeReviews: [{
      route: { url: target.pages[0].url },
      viewport: { name: 'desktop' },
      evidenceSummary: {
        visible_text: 'Dashboard overview. Current local run is healthy.',
        visible_text_length: 53
      }
    }]
  });
  assert.equal(matched.status, 'passed');
  assert.equal(matched.counts.data_binding_matches, 1);
  assert.deepEqual(matched.findings, []);
  assert.equal(matched.action_plan.status, 'passed');
  assert.equal(matched.action_plan.gate_effect, 'none');
  assert.equal(matched.readiness.status, 'passed');
  assert.equal(matched.readiness.legacy_release_readiness_unchanged, true);
  assert.equal(matched.page_handoff.summary.pages, 1);
  assert.equal(matched.page_handoff.summary.pages_with_findings, 0);
  assert.equal(matched.manifest_authoring.status, 'advisory_notes');
  assert.equal(matched.review_brief.status, 'passed');
  assert.equal(matched.review_brief.summary.decision_needs_met, 1);
  assert.equal(matched.rubric_evaluation.status, 'passed');
  assert.equal(matched.rubric_evaluation.summary.criteria_passed, 1);
  assert.equal(matched.quality_signal.rubric_criteria, 1);
  assert.doesNotMatch(JSON.stringify(matched), /Current local run is healthy/);

  const mismatched = buildLocalContentUxAdvisory({
    target,
    routeReviews: [{
      route: { url: target.pages[0].url },
      viewport: { name: 'desktop' },
      evidenceSummary: {
        visible_text: 'Dashboard overview is unavailable.',
        visible_text_length: 34
      }
    }]
  });
  assert.equal(mismatched.status, 'needs_owner_review');
  assert.equal(mismatched.counts.data_binding_mismatches, 1);
  assert.ok(mismatched.signals.some((signal) => signal.id === 'content_ux_source_text_not_visible'));
  assert.equal(mismatched.findings.length, 1);
  assert.equal(mismatched.findings[0].category, 'content_contract');
  assert.equal(mismatched.findings[0].source, 'local_content_ux_advisory');
  assert.equal(mismatched.findings[0].gate_effect, 'none');
  assert.equal(mismatched.action_plan.status, 'needs_content_owner_review');
  assert.equal(mismatched.action_plan.legacy_action_plan_unchanged, true);
  assert.equal(mismatched.action_plan.total_action_items, 1);
  assert.equal(mismatched.action_plan.page_focus[0].page_id, 'overview');
  assert.equal(mismatched.readiness.status, 'needs_content_owner_review');
  assert.equal(mismatched.readiness.gate_effect, 'none');
  assert.equal(mismatched.readiness.blocking_release_gate, false);
  assert.equal(mismatched.page_handoff.summary.pages_with_findings, 1);
  assert.equal(mismatched.page_handoff.pages[0].status, 'needs_content_owner_review');
  assert.ok(mismatched.manifest_authoring.suggestions.some((suggestion) => suggestion.type === 'add_user_questions'));
  assert.equal(mismatched.review_brief.status, 'needs_content_owner_review');
  assert.equal(mismatched.review_brief.summary.decision_needs_needing_owner_review, 1);
  assert.equal(mismatched.rubric_evaluation.status, 'needs_content_owner_review');
  assert.equal(mismatched.rubric_evaluation.summary.criteria_needing_owner_review, 1);
  assert.doesNotMatch(JSON.stringify(mismatched), /Current local run is healthy/);
});

test('local content UX advisory supports selector-scoped state contracts and user questions', () => {
  const normalized = normalizeTargetManifest({
    baseUrl: 'https://example.test/app',
    pages: [{
      name: 'Status',
      path: '/app',
      expectations: {
        dataBindings: [
          {
            id: 'service-state',
            sourceId: 'service',
            pointer: '/service/state',
            selector: '#service',
            target: 'data-state',
            match: 'exact'
          },
          {
            id: 'health-status',
            sourceId: 'service',
            pointer: '/health/status',
            selector: '#check',
            target: 'attribute',
            attribute: 'data-status',
            match: 'exact'
          },
          {
            id: 'risk-level',
            sourceId: 'service',
            pointer: '/risk/level',
            selector: '#risk',
            target: 'data-risk',
            match: 'exact'
          }
        ],
        userQuestions: [{
          id: 'risk-awareness',
          question: 'Can users identify current risk?',
          expectedEvidence: ['Low risk'],
          selector: '#risk'
        }]
      }
    }],
    sourceData: [{
      id: 'service',
      data: {
        service: { state: 'ready' },
        health: { status: 'complete' },
        risk: { level: 'minor' }
      }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['operators'],
      goal: 'Explain service status and risk.',
      requiredUserQuestions: [{
        id: 'environment-awareness',
        pageId: 'status',
        question: 'Can users identify the active environment?',
        expectedEvidence: ['Production']
      }]
    }
  });
  assert.equal(normalized.ok, true);
  const target = normalized.target;
  const advisory = buildLocalContentUxAdvisory({
    target,
    routeReviews: [{
      route: { url: target.pages[0].url },
      manifest_page_id: 'status',
      viewport: { name: 'desktop' },
      evidenceSummary: {
        visible_text: 'Production environment. Low risk.',
        visible_text_length: 25,
        elements: [
          { selector: '#service', text: 'Service state', accessible_name: 'Service state', attributes: { 'data-state': 'ready' } },
          { selector: '#check', text: 'Health check', accessible_name: 'Health check', attributes: { 'data-status': 'complete' } },
          { selector: '#risk', text: 'Low risk', accessible_name: 'Low risk', attributes: { 'data-risk': 'minor' } }
        ]
      }
    }]
  });

  assert.equal(advisory.status, 'passed');
  assert.equal(advisory.counts.data_binding_checks, 3);
  assert.equal(advisory.counts.selector_scoped_binding_checks, 3);
  assert.equal(advisory.counts.attribute_binding_checks, 1);
  assert.equal(advisory.counts.state_binding_checks, 1);
  assert.equal(advisory.counts.risk_binding_checks, 1);
  assert.equal(advisory.counts.data_binding_matches, 3);
  assert.equal(advisory.counts.required_user_questions, 2);
  assert.equal(advisory.counts.user_questions_answered, 2);
  assert.equal(advisory.quality_signal.required_user_questions, 2);
  assert.deepEqual(advisory.findings, []);
  assert.equal(advisory.action_plan.status, 'passed');
  assert.equal(advisory.readiness.status, 'passed');
  assert.doesNotMatch(JSON.stringify(advisory), /"ready"|"complete"|"minor"/);

  const mismatch = buildLocalContentUxAdvisory({
    target,
    routeReviews: [{
      route: { url: target.pages[0].url },
      manifest_page_id: 'status',
      viewport: { name: 'desktop' },
      evidenceSummary: {
        visible_text: 'Environment unknown.',
        visible_text_length: 12,
        elements: [
          { selector: '#service', text: 'Service state', attributes: { 'data-state': 'offline' } },
          { selector: '#check', text: 'Health check', attributes: { 'data-status': 'failed' } },
          { selector: '#risk', text: 'Unknown', attributes: { 'data-risk': 'high' } }
        ]
      }
    }]
  });
  assert.equal(mismatch.status, 'needs_owner_review');
  assert.equal(mismatch.counts.data_binding_mismatches, 3);
  assert.equal(mismatch.counts.user_questions_unanswered, 2);
  assert.ok(mismatch.signals.some((signal) => signal.id === 'content_ux_source_state_not_matched'));
  assert.ok(mismatch.signals.some((signal) => signal.id === 'content_ux_user_question_not_answered'));
  assert.equal(mismatch.findings.length, 5);
  assert.ok(mismatch.findings.some((finding) => finding.category === 'content_contract'));
  assert.ok(mismatch.findings.some((finding) => finding.category === 'status_clarity'));
  assert.ok(mismatch.findings.some((finding) => finding.category === 'information_architecture'));
  assert.equal(mismatch.action_plan.total_action_items, mismatch.findings.length);
  assert.equal(mismatch.action_plan.status, 'needs_content_owner_review');
  assert.equal(mismatch.action_plan.gate_effect, 'none');
  assert.equal(mismatch.action_plan.page_focus[0].page_id, 'status');
  assert.equal(mismatch.readiness.status, 'needs_content_owner_review');
  assert.equal(mismatch.readiness.content_owner_review_required, true);
  assert.equal(mismatch.readiness.page_handoff.pages_with_findings, 1);
  assert.equal(mismatch.page_handoff.pages.find((page) => page.page_id === 'status').top_categories.includes('status_clarity'), true);
  assert.doesNotMatch(JSON.stringify(mismatch), /"ready"|"complete"|"minor"/);

  const questionOnly = normalizeTargetManifest({
    baseUrl: 'https://example.test/app',
    pages: [{
      name: 'Question Only',
      path: '/app',
      expectations: {
        userQuestions: [{
          id: 'next-action',
          question: 'Can users identify the next action?',
          expectedEvidence: ['Run checks']
        }]
      }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['operators'],
      goal: 'Explain next actions.'
    }
  });
  const questionOnlyAdvisory = buildLocalContentUxAdvisory({
    target: questionOnly.target,
    routeReviews: [{
      route: { url: questionOnly.target.pages[0].url },
      manifest_page_id: 'question-only',
      viewport: { name: 'desktop' },
      evidenceSummary: {
        visible_text: 'Run checks before release.',
        visible_text_length: 26,
        elements: []
      }
    }]
  });
  assert.equal(questionOnlyAdvisory.counts.pages_without_content_contract, 1);
  assert.equal(questionOnlyAdvisory.counts.required_user_questions, 1);
  assert.equal(questionOnlyAdvisory.counts.user_questions_answered, 1);
  assert.equal(questionOnlyAdvisory.action_plan.status, 'advisory_notes');
  assert.ok(questionOnlyAdvisory.findings.some((finding) => finding.category === 'coverage_contract'));

  const userJourneyGap = normalizeTargetManifest({
    baseUrl: 'https://example.test/app',
    pages: [{
      name: 'Next Action',
      path: '/next',
      expectations: {
        userQuestions: [{
          id: 'next-action',
          question: 'Can users identify the next action?',
          expectedEvidence: ['Run checks'],
          severity: 'medium'
        }, {
          id: 'details-navigation',
          question: 'Can users find the details page?',
          expectedEvidence: ['Open details'],
          severity: 'medium'
        }]
      }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['operators'],
      goal: 'Explain next actions and navigation.'
    }
  });
  const userJourneyGapAdvisory = buildLocalContentUxAdvisory({
    target: userJourneyGap.target,
    routeReviews: [{
      route: { url: userJourneyGap.target.pages[0].url },
      manifest_page_id: 'next-action',
      viewport: { name: 'desktop' },
      evidenceSummary: {
        visible_text: 'Overview only.',
        visible_text_length: 14,
        elements: []
      }
    }]
  });
  assert.ok(userJourneyGapAdvisory.findings.some((finding) => finding.category === 'action_clarity'));
  assert.ok(userJourneyGapAdvisory.findings.some((finding) => finding.category === 'navigation_clarity'));
  assert.equal(userJourneyGapAdvisory.page_handoff.summary.pages_with_findings, 1);
  assert.ok(userJourneyGapAdvisory.manifest_authoring.suggestions.some((suggestion) => suggestion.type === 'strengthen_next_action_contracts'));
  assert.ok(userJourneyGapAdvisory.manifest_authoring.suggestions.some((suggestion) => suggestion.type === 'strengthen_navigation_contracts'));
});

test('target init writes a reusable local target manifest artifact', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-target-init-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');

  const parsed = parseCliArgs([
    'target',
    'init',
    '--url',
    'https://example.test/app',
    '--name',
    'Example App',
    '--max-routes',
    '8',
    '--json'
  ]);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'target init');
  assert.equal(parsed.options['max-routes'], '8');

  const result = await executeCli([
    'target',
    'init',
    '--url',
    'https://example.test/app',
    '--name',
    'Example App',
    '--max-routes',
    '8',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'target-fixed'
  });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'target init');
  assert.equal(body.data.target_manifest.name, 'Example App');
  assert.equal(body.data.target_manifest.budgets.maxRoutes, 8);
  assert.deepEqual(body.data.target_manifest.pages, []);
  assert.equal(body.data.boundary.external_upload, false);
  const artifact = body.artifacts.find((candidate) => candidate.type === 'target_manifest');
  assert.ok(artifact);
  const manifest = JSON.parse(await readFile(path.join(cwd, artifact.path), 'utf8'));
  assert.equal(manifest.baseUrl, 'https://example.test/app');
});

test('target validate checks edited manifests without launching a browser', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-target-validate-'));
  const manifestPath = path.join(cwd, 'target.json');
  await writeFile(manifestPath, JSON.stringify({
    baseUrl: 'https://example.test/app',
    expectedRoutes: ['/app/status'],
    pages: [{
      name: 'Status',
      path: '/app/status',
      role: 'status_overview',
      expectations: {
        text: ['Status'],
        selectors: ['#status'],
        dataBindings: [{
          id: 'status-summary',
          sourceId: 'status-source',
          pointer: '/status/summary',
          selector: '#status',
          target: 'text'
        }],
        userQuestions: [{
          id: 'status-understanding',
          question: 'Can users understand the current status?',
          expectedEvidence: ['healthy']
        }]
      }
    }],
    sourceData: [{
      id: 'status-source',
      data: { status: { summary: 'Current local run is healthy' } }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['operators'],
      goal: 'Explain status clearly.',
      requiredUserQuestions: [{
        id: 'next-decision',
        pageId: 'status',
        question: 'Can users decide the next step?',
        expectedEvidence: ['healthy']
      }],
      reviewBrief: {
        summary: 'The status page should explain whether action is needed.',
        userRoles: ['operator'],
        decisionNeeds: [{
          id: 'action-decision',
          pageId: 'status',
          question: 'Can users decide whether action is needed?',
          expectedEvidence: ['healthy']
        }]
      },
      rubric: [{
        id: 'status-clarity',
        pageId: 'status',
        category: 'status_clarity',
        criterion: 'Status is clear.',
        expectedEvidence: ['healthy']
      }]
    }
  }), 'utf8');

  const parsed = parseCliArgs(['target', 'validate', '--target', manifestPath, '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'target validate');

  const result = await executeCli(['target', 'validate', '--target', manifestPath, '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'target validate');
  assert.equal(body.data.target_manifest.status, 'valid');
  assert.equal(body.data.target_manifest.counts.expected_routes, 1);
  assert.equal(body.data.target_manifest.counts.pages, 1);
  assert.equal(body.data.target_manifest.counts.source_data_available, 1);
  assert.equal(body.data.target_manifest.counts.data_bindings, 1);
  assert.equal(body.data.target_manifest.counts.required_user_questions, 1);
  assert.equal(body.data.target_manifest.counts.review_brief_decision_needs, 1);
  assert.equal(body.data.target_manifest.counts.rubric_criteria, 1);
  assert.equal(body.data.boundary.browser_launched, false);
  assert.equal(body.data.boundary.external_upload, false);
  assert.equal(body.data.boundary.profile_reuse, false);
  assert.equal(body.data.boundary.source_data_values_exposed, false);
  assert.equal(body.data.boundary.manifest_mutated, false);
  assert.match(body.data.next_commands.review_json, /trace-cue review --target @/);
  assert.doesNotMatch(result.stdout, /Current local run is healthy/);

  const invalid = await executeCli(['target', 'validate', '--target', '{"name":"missing base"}', '--json'], {
    now: fixedNow
  });
  assert.equal(invalid.exitCode, 1);
  const invalidBody = JSON.parse(invalid.stdout);
  assert.equal(invalidBody.command, 'target validate');
  assert.equal(invalidBody.errors[0].code, 'TARGET_BASE_URL_REQUIRED');
});

test('capture handoff summarizes existing workspace images without writing artifacts', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-capture-handoff-'));
  const png = minimalPngBuffer(320, 180);
  await writeFile(path.join(cwd, 'desktop.png'), png);

  const parsed = parseCliArgs(['capture', 'handoff', '--image', 'desktop.png', '--source', 'desktop-app', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'capture handoff');
  assert.equal(parsed.options.image, 'desktop.png');
  assert.equal(parsed.options.source, 'desktop-app');

  const result = await executeCli(['capture', 'handoff', '--image', 'desktop.png', '--source', 'desktop-app', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'capture handoff');
  assert.equal(body.data.capture_handoff.status, 'metadata_only');
  assert.equal(body.data.capture_handoff.source.kind, 'desktop_app_capture');
  assert.equal(body.data.capture_handoff.source.capture_performed_by_trace_cue, false);
  assert.equal(body.data.capture_handoff.source.source_verified_by_trace_cue, false);
  assert.equal(body.data.capture_handoff.source.surface_identity_collected, false);
  assert.equal(body.data.capture_handoff.media.width, 320);
  assert.equal(body.data.capture_handoff.media.height, 180);
  assert.equal(body.data.capture_handoff.boundary.existing_workspace_image_read, true);
  assert.equal(body.data.capture_handoff.boundary.image_bytes_read_for_metadata, true);
  assert.equal(body.data.capture_handoff.boundary.capture_performed, false);
  assert.equal(body.data.capture_handoff.boundary.raw_pixels_in_json, false);
  assert.equal(body.data.capture_handoff.boundary.writes_artifacts, false);
  assert.equal(body.data.capture_handoff.boundary.mcp_permissions_changed, false);
  assert.equal(body.data.capture_handoff.boundary.mcp_execution_exposed, false);
  assert.deepEqual(body.artifacts, []);
  assert.equal(JSON.stringify(body.data).includes(png.toString('base64')), false);
  await assert.rejects(() => access(path.join(cwd, '.browser-debug')));

  const direct = await runCaptureHandoff({ image: 'desktop.png', source: 'screen' }, { cwd, now: fixedNow });
  assert.equal(direct.status, 'ok');
  assert.equal(direct.data.capture_handoff.source.kind, 'screen_capture');
  assert.equal(captureHandoffBoundary().artifact_created, false);

  const invalidSource = await executeCli(['capture', 'handoff', '--image', 'desktop.png', '--source', 'camera', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(invalidSource.exitCode, 1);
  assert.equal(JSON.parse(invalidSource.stdout).errors[0].code, 'INVALID_CAPTURE_HANDOFF_SOURCE');

  const oversize = await executeCli(['capture', 'handoff', '--image', 'desktop.png', '--source', 'screen', '--max-bytes', '1', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(oversize.exitCode, 1);
  assert.equal(JSON.parse(oversize.stdout).errors[0].code, 'VISUAL_EVIDENCE_INPUT_TOO_LARGE');

  const allSource = parseCliArgs(['capture', 'handoff', '--image', 'desktop.png', '--source', 'all', '--json']);
  assert.equal(allSource.ok, false);
  assert.equal(allSource.error.code, 'INVALID_CAPTURE_HANDOFF_SOURCE');

  for (const badImage of ['https://example.test/desktop.png', '../desktop.png', '@desktop.png', '-']) {
    const parsedBadImage = parseCliArgs(['capture', 'handoff', '--image', badImage, '--source', 'screen', '--json']);
    assert.equal(parsedBadImage.ok, false);
    assert.equal(parsedBadImage.error.code, 'INVALID_CAPTURE_HANDOFF_IMAGE');
  }

  const provider = parseCliArgs(['capture', 'handoff', '--image', 'desktop.png', '--source', 'screen', '--provider', 'generic-api', '--json']);
  assert.equal(provider.ok, false);
  assert.equal(provider.error.code, 'UNSUPPORTED_CAPTURE_HANDOFF_OPTION');

  const artifactRoot = parseCliArgs(['capture', 'handoff', '--image', 'desktop.png', '--source', 'screen', '--artifact-root', '.trace-cue', '--json']);
  assert.equal(artifactRoot.ok, false);
  assert.equal(artifactRoot.error.code, 'UNSUPPORTED_CAPTURE_HANDOFF_OPTION');
});

test('visual review plan prepares desktop review provider planning from capture handoff metadata only', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'trace-cue-desktop-review-plan-'));
  const png = minimalPngBuffer(320, 180);
  await writeFile(path.join(cwd, 'desktop.png'), png);

  const handoffResult = await executeCli(['capture', 'handoff', '--image', 'desktop.png', '--source', 'desktop-app', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(handoffResult.exitCode, 0);
  const handoffBody = JSON.parse(handoffResult.stdout);
  assert.equal(handoffBody.data.capture_handoff.source.kind, 'desktop_app_capture');
  await writeFile(path.join(cwd, 'handoff.json'), JSON.stringify(handoffBody, null, 2));

  const parsed = parseCliArgs(['visual', 'review', 'plan', '--capture-handoff', 'handoff.json', '--surface', 'desktop-app', '--provider', 'manual', '--model', 'reviewer', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'visual review plan');
  assert.equal(parsed.options['capture-handoff'], 'handoff.json');

  const result = await executeCli(['visual', 'review', 'plan', '--capture-handoff', 'handoff.json', '--surface', 'desktop-app', '--provider', 'manual', '--model', 'reviewer', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'visual review plan');
  assert.equal(body.data.desktop_review_provider_preparation_plan.status, 'planned');
  assert.equal(body.data.desktop_review_provider_preparation_plan.source.source_kind, 'desktop_app_capture');
  assert.equal(body.data.desktop_review_provider_preparation_plan.source.workspace_image_path, 'desktop.png');
  assert.equal(body.data.desktop_review_provider_preparation_plan.source.source_verified_by_trace_cue, false);
  assert.equal(body.data.desktop_review_provider_preparation_plan.media.width, 320);
  assert.equal(body.data.desktop_review_provider_preparation_plan.readiness.provider_preparation_artifact_created, false);
  assert.equal(body.data.desktop_review_provider_preparation_plan.provider_preparation.planning_only, true);
  assert.equal(body.data.desktop_review_provider_preparation_plan.provider_preparation.provider_call_performed, false);
  assert.equal(body.data.desktop_review_provider_preparation_plan.disclosure_policy.image_bytes_read, false);
  assert.equal(body.data.desktop_review_provider_preparation_plan.disclosure_policy.raw_pixels_in_json, false);
  assert.equal(body.data.desktop_review_provider_preparation_plan.boundary.capture_handoff_json_read, true);
  assert.equal(body.data.desktop_review_provider_preparation_plan.boundary.image_bytes_read, false);
  assert.equal(body.data.desktop_review_provider_preparation_plan.boundary.writes_artifacts, false);
  assert.equal(body.data.desktop_review_provider_preparation_plan.boundary.provider_call_performed, false);
  assert.equal(body.data.desktop_review_provider_preparation_plan.boundary.mcp_execution_exposed, false);
  assert.deepEqual(body.artifacts, []);
  assert.equal(JSON.stringify(body.data).includes(png.toString('base64')), false);
  await assert.rejects(() => access(path.join(cwd, '.browser-debug')));

  const direct = await buildDesktopReviewProviderPreparationPlan({
    'capture-handoff': JSON.stringify(handoffBody.data.capture_handoff),
    surface: 'screen'
  }, { cwd, now: fixedNow });
  assert.equal(direct.status, 'ok');
  assert.equal(direct.data.desktop_review_provider_preparation_plan.source.source_kind, 'desktop_app_capture');
  assert.equal(desktopReviewProviderPreparationPlanBoundary().artifact_created, false);

  const execute = parseCliArgs(['visual', 'review', 'plan', '--capture-handoff', 'handoff.json', '--execute', '--json']);
  assert.equal(execute.ok, false);
  assert.equal(execute.error.code, 'CONFLICTING_OPTIONS');

  const image = parseCliArgs(['visual', 'review', 'plan', '--capture-handoff', 'handoff.json', '--image', 'desktop.png', '--json']);
  assert.equal(image.ok, false);
  assert.equal(image.error.code, 'UNSUPPORTED_VISUAL_REVIEW_PLAN_OPTION');

  const unsafe = {
    ...handoffBody.data.capture_handoff,
    source: {
      ...handoffBody.data.capture_handoff.source,
      path: '../desktop.png'
    }
  };
  await writeFile(path.join(cwd, 'unsafe-handoff.json'), JSON.stringify(unsafe, null, 2));
  const unsafeResult = await executeCli(['visual', 'review', 'plan', '--capture-handoff', 'unsafe-handoff.json', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(unsafeResult.exitCode, 1);
  assert.equal(JSON.parse(unsafeResult.stdout).errors[0].code, 'DESKTOP_REVIEW_PLAN_CAPTURE_HANDOFF_IMAGE_PATH_INVALID');
});

test('capture plan reports screen and window capture boundaries without capturing pixels', async () => {
  const readinessParsed = parseCliArgs(['capture', 'readiness', '--source', 'screen', '--json']);
  assert.equal(readinessParsed.ok, true);
  assert.equal(readinessParsed.command, 'capture readiness');
  assert.equal(readinessParsed.options.source, 'screen');

  const readiness = await executeCli(['capture', 'readiness', '--source', 'screen', '--json'], { now: fixedNow });
  assert.equal(readiness.exitCode, 0);
  const readinessBody = JSON.parse(readiness.stdout);
  assert.equal(readinessBody.command, 'capture readiness');
  assert.equal(readinessBody.data.capture_readiness.source_selection, 'screen');
  assert.equal(readinessBody.data.capture_readiness.probe.method, 'static_process_platform_only');
  assert.equal(readinessBody.data.capture_readiness.probe.os_capture_api_used, false);
  assert.equal(readinessBody.data.capture_readiness.probe.window_enumeration_performed, false);
  assert.equal(readinessBody.data.capture_readiness.probe.process_enumeration_performed, false);
  assert.equal(readinessBody.data.capture_readiness.summary.cli_execute_available, false);
  assert.equal(readinessBody.data.capture_readiness.summary.mcp_execute_available, false);
  assert.equal(readinessBody.data.capture_readiness.privacy_policy.raw_pixels_allowed_in_json, false);
  assert.equal(readinessBody.data.capture_readiness.artifact_contract.capture_artifact_schema, 'capture_artifact');
  assert.equal(readinessBody.data.capture_readiness.artifact_contract.capture_receipt_schema, 'capture_receipt');
  assert.equal(readinessBody.data.boundary.readiness_only, true);
  assert.equal(readinessBody.data.boundary.raw_pixels_read, false);
  assert.equal(readinessBody.data.boundary.native_capture_dependency_loaded, false);
  assert.equal(readinessBody.data.boundary.static_platform_probe_only, true);
  assert.deepEqual(readinessBody.artifacts, []);

  const status = await executeCli(['capture', 'status', '--source', 'desktop-app', '--json'], { now: fixedNow });
  assert.equal(status.exitCode, 0);
  const statusBody = JSON.parse(status.stdout);
  assert.equal(statusBody.command, 'capture status');
  assert.equal(statusBody.data.capture_readiness.source_selection, 'desktop-app');
  assert.equal(statusBody.data.capture_readiness.capabilities[0].source_kind, 'desktop_app_capture');

  const directReadiness = buildCaptureReadiness({ source: 'window' }, { now: fixedNow, platform: 'linux', arch: 'x64' });
  assert.equal(directReadiness.ok, true);
  assert.equal(directReadiness.report.capabilities[0].platform_support_status, 'possible_with_approved_adapter');
  assert.equal(captureReadinessBoundary().os_capture_api_used, false);

  const readinessExecute = await executeCli(['capture', 'readiness', '--execute', '--json'], { now: fixedNow });
  assert.equal(readinessExecute.exitCode, 2);
  assert.equal(JSON.parse(readinessExecute.stdout).errors[0].code, 'CONFLICTING_OPTIONS');

  const readinessProvider = await executeCli(['capture', 'readiness', '--provider', 'generic-api', '--json'], { now: fixedNow });
  assert.equal(readinessProvider.exitCode, 2);
  assert.equal(JSON.parse(readinessProvider.stdout).errors[0].code, 'UNSUPPORTED_CAPTURE_READINESS_OPTION');

  const parsed = parseCliArgs(['capture', 'plan', '--source', 'window', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'capture plan');
  assert.equal(parsed.options.source, 'window');

  const result = await executeCli(['capture', 'plan', '--source', 'window', '--json'], { now: fixedNow });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'capture plan');
  assert.equal(body.data.capture_plan.source_selection, 'window');
  assert.equal(body.data.capture_plan.summary.capture_performed, false);
  assert.equal(body.data.capture_plan.summary.raw_pixels_read, false);
  assert.equal(body.data.capture_plan.summary.raw_pixels_written, false);
  assert.equal(body.data.capture_plan.summary.raw_pixels_in_json, false);
  assert.equal(body.data.capture_plan.summary.native_capture_dependency_loaded, false);
  assert.equal(body.data.capture_plan.summary.mcp_execution_exposed, false);
  assert.equal(body.data.capture_plan.summary.owner_review_required_before_capture, true);
  assert.equal(body.data.capture_plan.sources.length, 1);
  assert.equal(body.data.capture_plan.sources[0].source_kind, 'window_capture');
  assert.equal(body.data.capture_plan.sources[0].mcp_capture_available, false);
  assert.equal(body.data.capture_plan.sources[0].required_gates.some((gate) => gate.id === 'explicit_window_selection'), true);
  assert.equal(body.data.boundary.read_only, true);
  assert.equal(body.data.boundary.os_capture_api_used, false);
  assert.equal(body.data.boundary.window_enumeration_performed, false);
  assert.equal(body.data.boundary.native_capture_dependency_loaded, false);
  assert.equal(body.data.boundary.requires_owner_review_before_capture, true);
  assert.deepEqual(body.artifacts, []);

  const direct = buildCapturePlan({ source: 'desktop-app' }, { now: fixedNow });
  assert.equal(direct.ok, true);
  assert.equal(direct.report.sources[0].source_kind, 'desktop_app_capture');
  assert.equal(capturePlanBoundary().process_enumeration_performed, false);

  const invalid = await executeCli(['capture', 'plan', '--source', 'camera', '--json'], { now: fixedNow });
  assert.equal(invalid.exitCode, 1);
  assert.equal(JSON.parse(invalid.stdout).errors[0].code, 'INVALID_CAPTURE_PLAN_SOURCE');

  const execute = await executeCli(['capture', 'plan', '--execute', '--json'], { now: fixedNow });
  assert.equal(execute.exitCode, 2);
  assert.equal(JSON.parse(execute.stdout).errors[0].code, 'CONFLICTING_OPTIONS');

  const provider = await executeCli(['capture', 'plan', '--provider', 'generic-api', '--json'], { now: fixedNow });
  assert.equal(provider.exitCode, 2);
  assert.equal(JSON.parse(provider.stdout).errors[0].code, 'UNSUPPORTED_CAPTURE_PLAN_OPTION');

  const runMissingExecute = await executeCli(['capture', 'run', '--source', 'screen', '--json'], { now: fixedNow });
  assert.equal(runMissingExecute.exitCode, 2);
  assert.equal(JSON.parse(runMissingExecute.stdout).errors[0].code, 'MISSING_REQUIRED_OPTION');

  const runUnavailable = await executeCli(['capture', 'run', '--source', 'screen', '--execute', '--json'], { now: fixedNow });
  assert.equal(runUnavailable.exitCode, 1);
  const runUnavailableBody = JSON.parse(runUnavailable.stdout);
  assert.equal(runUnavailableBody.command, 'capture run');
  assert.equal(runUnavailableBody.errors[0].code, 'CAPTURE_EXECUTION_NOT_AVAILABLE');
  assert.equal(runUnavailableBody.data.capture_execution.execute_requested, true);
  assert.equal(runUnavailableBody.data.capture_execution.approval_required, true);
  assert.equal(runUnavailableBody.data.boundary.capture_performed, false);
  assert.equal(runUnavailableBody.data.boundary.os_capture_api_used, false);
  assert.deepEqual(runUnavailableBody.artifacts, []);

  const mcpPlan = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 48,
    method: 'tools/call',
    params: {
      name: 'browser_debug_capture_plan',
      arguments: { source: 'screen' }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpPlan.result.structuredContent.command, 'capture plan');
  assert.equal(mcpPlan.result.structuredContent.data.capture_plan.source_selection, 'screen');
  assert.equal(mcpPlan.result.structuredContent.data.boundary.mcp_execution_exposed, false);

  const mcpReadiness = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 481,
    method: 'tools/call',
    params: {
      name: 'browser_debug_capture_readiness',
      arguments: { source: 'window' }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpReadiness.result.structuredContent.command, 'capture readiness');
  assert.equal(mcpReadiness.result.structuredContent.data.capture_readiness.source_selection, 'window');
  assert.equal(mcpReadiness.result.structuredContent.data.capture_readiness.summary.mcp_execute_available, false);
  assert.equal(mcpReadiness.result.structuredContent.data.boundary.os_capture_api_used, false);

  const mcpPlanWithExecute = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 482,
    method: 'tools/call',
    params: {
      name: 'browser_debug_capture_plan',
      arguments: { source: 'screen', execute: true }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpPlanWithExecute.error.code, -32602);
  assert.match(mcpPlanWithExecute.error.message, /Unsupported MCP argument/);
});

test('MCP execution gates report required approval boundaries without exposing execution', async () => {
  const parsed = parseCliArgs(['mcp', 'execution', 'gates', '--operation', 'visual_review_run', '--profile', 'admin', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'mcp execution gates');
  assert.equal(parsed.options.operation, 'visual_review_run');

  const result = await executeCli(['mcp', 'execution', 'gates', '--operation', 'visual_review_run', '--profile', 'admin', '--json'], { now: fixedNow });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'mcp execution gates');
  assert.equal(body.data.execution_gates.operation_selection, 'visual_review_run');
  assert.equal(body.data.execution_gates.summary.write_execute_tools_exposed, false);
  assert.equal(body.data.execution_gates.summary.execution_ready_for_mcp, false);
  assert.equal(body.data.execution_gates.operations.length, 1);
  assert.equal(body.data.execution_gates.operations[0].current_mcp_exposure.admin, false);
  assert.equal(body.data.execution_gates.operations[0].required_gates.some((gate) => gate.id === 'credential_boundary'), true);
  assert.equal(body.data.boundary.read_only, true);
  assert.equal(body.data.boundary.mcp_permissions_changed, false);
  assert.deepEqual(body.artifacts, []);

  const desktopPlanGate = await executeCli(['mcp', 'execution', 'gates', '--operation', 'desktop_review_provider_preparation_plan', '--json'], { now: fixedNow });
  assert.equal(desktopPlanGate.exitCode, 0);
  const desktopPlanGateBody = JSON.parse(desktopPlanGate.stdout);
  assert.equal(desktopPlanGateBody.data.execution_gates.operations[0].current_mcp_exposure.safe, false);
  assert.equal(desktopPlanGateBody.data.execution_gates.operations[0].required_gates.some((gate) => gate.id === 'no_raw_pixels'), true);

  const aggregationGate = await executeCli(['mcp', 'execution', 'gates', '--operation', 'visual_review_aggregation', '--json'], { now: fixedNow });
  assert.equal(aggregationGate.exitCode, 0);
  const aggregationGateBody = JSON.parse(aggregationGate.stdout);
  assert.equal(aggregationGateBody.data.execution_gates.operations[0].proposed_stage, 'read_exposure_gate_required');
  assert.equal(aggregationGateBody.data.execution_gates.operations[0].current_mcp_exposure.admin, false);
  assert.equal(aggregationGateBody.data.execution_gates.operations[0].required_gates.some((gate) => gate.id === 'source_attribution_required'), true);

  const agenticGate = await executeCli(['mcp', 'execution', 'gates', '--operation', 'agentic_human_review_run', '--profile', 'admin', '--json'], { now: fixedNow });
  assert.equal(agenticGate.exitCode, 0);
  const agenticGateBody = JSON.parse(agenticGate.stdout);
  assert.equal(agenticGateBody.data.execution_gates.operations[0].current_mcp_exposure.admin, false);
  assert.equal(agenticGateBody.data.execution_gates.operations[0].required_gates.some((gate) => gate.id === 'approved_plan_hash'), true);
  assert.equal(agenticGateBody.data.execution_gates.operations[0].required_gates.some((gate) => gate.id === 'transfer_permission_flags'), true);
  assert.equal(agenticGateBody.data.execution_gates.operations[0].required_gates.some((gate) => gate.id === 'mcp_exclusion'), true);

  const invalid = await executeCli(['mcp', 'execution', 'gates', '--operation', 'wide_open', '--json'], { now: fixedNow });
  assert.equal(invalid.exitCode, 1);
  assert.equal(JSON.parse(invalid.stdout).errors[0].code, 'INVALID_MCP_EXECUTION_GATE_OPERATION');

  const mcpGate = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 46,
    method: 'tools/call',
    params: {
      name: 'browser_debug_mcp_execution_gates',
      arguments: { operation: 'agent_execution_run', profile: 'admin' }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpGate.result.structuredContent.command, 'mcp execution gates');
  assert.equal(mcpGate.result.structuredContent.data.execution_gates.operation_selection, 'agent_execution_run');
  assert.equal(mcpGate.result.structuredContent.data.boundary.mcp_write_execute_exposed, false);
});

test('operation registry reports roadmap risks without enabling execution', async () => {
  const parsed = parseCliArgs(['operation', 'registry', '--group', 'localization', '--risk', 'translation', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'operation registry');
  assert.equal(parsed.options.group, 'localization');
  assert.equal(parsed.options.risk, 'translation');

  const apiReport = buildOperationRegistryReport({ operation: 'npm_publish' }, { now: fixedNow });
  assert.equal(apiReport.ok, true);
  assert.equal(apiReport.report.operations[0].id, 'npm_publish');
  assert.equal(apiReport.report.operations[0].risk.release_bound, true);
  assert.equal(apiReport.report.boundary.npm_publish_performed, false);
  assert.equal(operationRegistryBoundary().mcp_write_execute_exposed, false);

  const agenticRegistry = await executeCli(['operation', 'registry', '--operation', 'agentic_human_review_run', '--json'], { now: fixedNow });
  assert.equal(agenticRegistry.exitCode, 0);
  const agenticRegistryBody = JSON.parse(agenticRegistry.stdout);
  const agenticRunOperation = agenticRegistryBody.data.operation_registry.operations[0];
  assert.equal(agenticRunOperation.id, 'agentic_human_review_run');
  assert.equal(agenticRunOperation.current_status, 'cli_only_available');
  assert.equal(agenticRunOperation.current_mcp_exposure.safe, false);
  assert.equal(agenticRunOperation.current_mcp_exposure.full, false);
  assert.equal(agenticRunOperation.current_mcp_exposure.admin, false);
  assert.equal(agenticRunOperation.capability_excluded, true);
  assert.equal(agenticRunOperation.required_gates.some((gate) => gate.id === 'approved_plan_hash'), true);
  assert.equal(agenticRunOperation.required_gates.some((gate) => gate.id === 'raw_provider_response_not_stored'), true);
  assert.equal(agenticRegistryBody.data.operation_registry.summary.write_execute_tools_exposed, false);

  const result = await executeCli(['operation', 'registry', '--group', 'release_identity', '--json'], { now: fixedNow });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'operation registry');
  assert.equal(body.data.operation_registry.group_selection, 'release_identity');
  assert.equal(body.data.operation_registry.summary.read_only_registry_only, true);
  const releaseReadinessOperation = body.data.operation_registry.operations.find((operation) => operation.id === 'release_readiness');
  const artifactRootStatusOperation = body.data.operation_registry.operations.find((operation) => operation.id === 'artifact_root_status');
  const artifactRootMigrationPlanOperation = body.data.operation_registry.operations.find((operation) => operation.id === 'artifact_root_migration_plan');
  const artifactRootMigrationExecuteOperation = body.data.operation_registry.operations.find((operation) => operation.id === 'artifact_root_migration_execute');
  const legacyAliasAuditOperation = body.data.operation_registry.operations.find((operation) => operation.id === 'legacy_alias_audit');
  const legacyAliasRemovalReadinessOperation = body.data.operation_registry.operations.find((operation) => operation.id === 'legacy_alias_removal_readiness');
  const legacyAliasRemovalOperation = body.data.operation_registry.operations.find((operation) => operation.id === 'legacy_alias_removal');
  assert.equal(releaseReadinessOperation.current_mcp_exposure.safe, true);
  assert.equal(releaseReadinessOperation.capability_excluded, false);
  assert.equal(body.data.operation_registry.operations.some((operation) => operation.id === 'npm_publish'), true);
  assert.equal(artifactRootStatusOperation.current_mcp_exposure.admin, true);
  assert.equal(artifactRootStatusOperation.capability_excluded, false);
  assert.equal(artifactRootMigrationPlanOperation.current_status, 'read_only_available');
  assert.equal(artifactRootMigrationExecuteOperation.current_status, 'fixture_only_cli_gate');
  assert.equal(artifactRootMigrationExecuteOperation.current_mcp_exposure.admin, false);
  assert.equal(legacyAliasAuditOperation.current_mcp_exposure.full, true);
  assert.equal(legacyAliasAuditOperation.capability_excluded, false);
  assert.equal(legacyAliasRemovalReadinessOperation.current_mcp_exposure.safe, true);
  assert.equal(legacyAliasRemovalReadinessOperation.capability_excluded, false);
  assert.equal(legacyAliasRemovalOperation.current_status, 'fail_closed_cli_gate');
  assert.equal(legacyAliasRemovalOperation.current_mcp_exposure.admin, false);
  assert.equal(body.data.operation_registry.summary.write_execute_tools_exposed, false);
  assert.equal(body.data.boundary.deletes_files, false);
  assert.equal(body.data.boundary.provider_call_performed, false);
  assert.equal(body.data.boundary.mcp_write_execute_exposed, false);
  assert.deepEqual(body.artifacts, []);

  const cleanupRegistry = await executeCli(['operation', 'registry', '--group', 'cleanup_mcp', '--json'], { now: fixedNow });
  assert.equal(cleanupRegistry.exitCode, 0);
  const cleanupRegistryBody = JSON.parse(cleanupRegistry.stdout);
  const cleanupPlanOperation = cleanupRegistryBody.data.operation_registry.operations.find((operation) => operation.id === 'resource_artifacts_cleanup_plan');
  const cleanupExecuteOperation = cleanupRegistryBody.data.operation_registry.operations.find((operation) => operation.id === 'resource_artifacts_cleanup_execute');
  assert.equal(cleanupPlanOperation.current_mcp_exposure.safe, true);
  assert.equal(cleanupPlanOperation.current_mcp_exposure.full, true);
  assert.equal(cleanupPlanOperation.current_mcp_exposure.admin, true);
  assert.equal(cleanupPlanOperation.capability_excluded, false);
  assert.equal(cleanupPlanOperation.required_gates.some((gate) => gate.id === 'plan_hash'), true);
  assert.equal(cleanupExecuteOperation.current_mcp_exposure.admin, false);
  assert.equal(cleanupExecuteOperation.capability_excluded, true);
  assert.equal(cleanupRegistryBody.data.operation_registry.summary.write_execute_tools_exposed, false);

  const captureRegistry = await executeCli(['operation', 'registry', '--group', 'capture', '--json'], { now: fixedNow });
  assert.equal(captureRegistry.exitCode, 0);
  const captureRegistryBody = JSON.parse(captureRegistry.stdout);
  const captureReadinessOperation = captureRegistryBody.data.operation_registry.operations.find((operation) => operation.id === 'capture_readiness_probe');
  const capturePlanOperation = captureRegistryBody.data.operation_registry.operations.find((operation) => operation.id === 'capture_plan_read_only');
  const captureExecuteOperation = captureRegistryBody.data.operation_registry.operations.find((operation) => operation.id === 'screen_window_capture_execute');
  assert.equal(captureReadinessOperation.current_mcp_exposure.safe, true);
  assert.equal(captureReadinessOperation.capability_excluded, false);
  assert.equal(capturePlanOperation.current_mcp_exposure.admin, true);
  assert.equal(capturePlanOperation.required_gates.some((gate) => gate.id === 'mcp_read_only'), true);
  assert.equal(captureExecuteOperation.cli_available, true);
  assert.equal(captureExecuteOperation.current_status, 'fail_closed_cli_gate');
  assert.equal(captureExecuteOperation.current_mcp_exposure.admin, false);
  assert.equal(captureExecuteOperation.capability_excluded, true);
  assert.equal(captureRegistryBody.data.operation_registry.summary.write_execute_tools_exposed, false);

  const localizationRegistry = await executeCli(['operation', 'registry', '--group', 'localization', '--json'], { now: fixedNow });
  assert.equal(localizationRegistry.exitCode, 0);
  const localizationRegistryBody = JSON.parse(localizationRegistry.stdout);
  const uiResourcesOperation = localizationRegistryBody.data.operation_registry.operations.find((operation) => operation.id === 'ui_i18n_resource_runtime');
  const reportTemplatesOperation = localizationRegistryBody.data.operation_registry.operations.find((operation) => operation.id === 'report_localized_rendering');
  const translationReadinessOperation = localizationRegistryBody.data.operation_registry.operations.find((operation) => operation.id === 'translation_readiness');
  const translationExecuteOperation = localizationRegistryBody.data.operation_registry.operations.find((operation) => operation.id === 'translation_mcp_admin_execute');
  assert.equal(uiResourcesOperation.current_mcp_exposure.safe, true);
  assert.equal(reportTemplatesOperation.current_mcp_exposure.full, true);
  assert.equal(translationReadinessOperation.current_mcp_exposure.admin, true);
  assert.equal(translationExecuteOperation.current_status, 'fail_closed_cli_gate');
  assert.equal(translationExecuteOperation.current_mcp_exposure.admin, false);
  assert.equal(localizationRegistryBody.data.operation_registry.summary.write_execute_tools_exposed, false);

  const shellRegistry = await executeCli(['operation', 'registry', '--group', 'constrained_shell', '--json'], { now: fixedNow });
  assert.equal(shellRegistry.exitCode, 0);
  const shellRegistryBody = JSON.parse(shellRegistry.stdout);
  const shellReadinessOperation = shellRegistryBody.data.operation_registry.operations.find((operation) => operation.id === 'constrained_shell_readiness');
  const shellExecuteOperation = shellRegistryBody.data.operation_registry.operations.find((operation) => operation.id === 'constrained_shell_execute');
  assert.equal(shellReadinessOperation.current_mcp_exposure.safe, true);
  assert.equal(shellReadinessOperation.capability_excluded, false);
  assert.equal(shellExecuteOperation.current_status, 'fail_closed_cli_gate');
  assert.equal(shellExecuteOperation.current_mcp_exposure.admin, false);
  assert.equal(shellExecuteOperation.capability_excluded, true);
  assert.equal(shellRegistryBody.data.operation_registry.summary.write_execute_tools_exposed, false);

  const finalRegistry = await executeCli(['operation', 'registry', '--group', 'final_hardening', '--json'], { now: fixedNow });
  assert.equal(finalRegistry.exitCode, 0);
  const finalRegistryBody = JSON.parse(finalRegistry.stdout);
  const finalReadinessOperation = finalRegistryBody.data.operation_registry.operations.find((operation) => operation.id === 'final_hardening_readiness');
  assert.equal(finalReadinessOperation.current_mcp_exposure.full, true);
  assert.equal(finalReadinessOperation.capability_excluded, false);
  assert.equal(finalRegistryBody.data.operation_registry.summary.write_execute_tools_exposed, false);

  const translationGate = await executeCli(['mcp', 'execution', 'gates', '--operation', 'translation_mcp_admin_execute', '--json'], { now: fixedNow });
  assert.equal(translationGate.exitCode, 0);
  const translationGateBody = JSON.parse(translationGate.stdout);
  assert.equal(translationGateBody.data.execution_gates.operations[0].group, 'localization');
  assert.equal(translationGateBody.data.execution_gates.operations[0].required_gates.some((gate) => gate.id === 'raw_evidence_non_translation'), true);
  assert.equal(translationGateBody.data.execution_gates.registry.source, 'operation_registry');

  const mcpRegistry = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 47,
    method: 'tools/call',
    params: {
      name: 'browser_debug_operation_registry',
      arguments: { group: 'constrained_shell' }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpRegistry.result.structuredContent.command, 'operation registry');
  assert.equal(mcpRegistry.result.structuredContent.data.operation_registry.group_selection, 'constrained_shell');
  assert.equal(mcpRegistry.result.structuredContent.data.boundary.shell_used, false);

  const invalid = await executeCli(['operation', 'registry', '--risk', 'wide-open', '--json'], { now: fixedNow });
  assert.equal(invalid.exitCode, 1);
  assert.equal(JSON.parse(invalid.stdout).errors[0].code, 'INVALID_OPERATION_REGISTRY_RISK');
});

test('operation roadmap reports phase A/B/C contracts without promoting draft execution', async () => {
  const parsed = parseCliArgs(['operation', 'roadmap', '--phase', '125', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'operation roadmap');
  assert.equal(parsed.options.phase, '125');

  const apiReport = buildOperationRoadmapReport({ phase: '125' }, { now: fixedNow });
  assert.equal(apiReport.ok, true);
  assert.equal(apiReport.report.phases.length, 1);
  assert.equal(apiReport.report.phases[0].phase, 125);
  assert.equal(apiReport.report.phases[0].proposal.step, 'A');
  assert.equal(apiReport.report.phases[0].implementation_plan.step, 'B');
  assert.equal(apiReport.report.phases[0].implementation.step, 'C');
  assert.equal(apiReport.report.phases[0].implementation.approval_required_before_live_execution, true);
  assert.equal(apiReport.report.phases[0].implementation.live_execution_performed, false);
  assert.equal(apiReport.report.boundary.draft_roadmap_promoted_to_product_plan, false);
  assert.equal(operationRoadmapBoundary().mcp_write_execute_exposed, false);

  const result = await executeCli(['operation', 'roadmap', '--group', 'release_identity', '--json'], { now: fixedNow });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'operation roadmap');
  assert.equal(body.data.operation_roadmap.group_selection, 'release_identity');
  assert.equal(body.data.operation_roadmap.summary.phase_count, 20);
  assert.equal(body.data.operation_roadmap.summary.local_boundary_implemented_count, 20);
  assert.equal(body.data.operation_roadmap.summary.live_execution_performed, false);
  assert.equal(body.data.operation_roadmap.phases.some((phase) => phase.phase === 125), true);
  assert.equal(body.data.operation_roadmap.phases.find((phase) => phase.phase === 125).implementation.status, 'implemented_as_fail_closed_approval_gate');
  assert.equal(body.data.operation_roadmap.phases.find((phase) => phase.phase === 139).slice, 'Legacy Alias Removal Boundary');
  assert.match(body.data.operation_roadmap.phases.find((phase) => phase.phase === 139).purpose, /readiness and fail-closed/);
  assert.equal(body.data.boundary.live_execution_performed, false);
  assert.equal(body.data.boundary.execution_tokens_issued, false);
  assert.equal(body.data.boundary.ci_remote_triggered, false);
  assert.deepEqual(body.artifacts, []);

  const safePhase = await executeCli(['operation', 'roadmap', '--phase', '66', '--json'], { now: fixedNow });
  assert.equal(safePhase.exitCode, 0);
  const safePhaseBody = JSON.parse(safePhase.stdout);
  assert.equal(safePhaseBody.data.operation_roadmap.phases[0].implementation.approval_required_before_live_execution, false);
  assert.equal(safePhaseBody.data.operation_roadmap.phases[0].implementation.status, 'implemented_as_read_only_or_dry_run_contract');

  const invalid = await executeCli(['operation', 'roadmap', '--phase', '200', '--json'], { now: fixedNow });
  assert.equal(invalid.exitCode, 1);
  assert.equal(JSON.parse(invalid.stdout).errors[0].code, 'INVALID_OPERATION_ROADMAP_PHASE');

  const execute = await executeCli(['operation', 'roadmap', '--phase', '125', '--execute', '--json'], { now: fixedNow });
  assert.equal(execute.exitCode, 1);
  assert.equal(JSON.parse(execute.stdout).errors[0].code, 'CONFLICTING_OPTIONS');

  const mcpRoadmap = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 49,
    method: 'tools/call',
    params: {
      name: 'browser_debug_operation_roadmap',
      arguments: { phase: '94' }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpRoadmap.result.structuredContent.command, 'operation roadmap');
  assert.equal(mcpRoadmap.result.structuredContent.data.operation_roadmap.phase_selection, 94);
  assert.equal(mcpRoadmap.result.structuredContent.data.operation_roadmap.phases[0].implementation.approval_required_before_live_execution, true);
  assert.equal(mcpRoadmap.result.structuredContent.data.boundary.capture_performed, false);
});

test('operation contracts report shared Phase 61-64 contracts without issuing tokens', async () => {
  const parsed = parseCliArgs(['operation', 'contracts', '--scope', 'token_contract', '--operation', 'agent_execution_run', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'operation contracts');
  assert.equal(parsed.options.scope, 'token_contract');
  assert.equal(parsed.options.operation, 'agent_execution_run');

  const apiReport = buildOperationContractsReport({ scope: 'receipt_contract', operation: 'translation_mcp_admin_execute' }, { now: fixedNow });
  assert.equal(apiReport.ok, true);
  assert.equal(apiReport.report.scope_selection, 'receipt_contract');
  assert.equal(apiReport.report.operation_selection, 'translation_mcp_admin_execute');
  assert.deepEqual(apiReport.report.phase_range.implemented_contract_phases, [61, 62, 63, 64]);
  assert.equal(apiReport.report.contracts[0].id, 'receipt_contract');
  assert.equal(apiReport.report.contracts[0].boundary.receipt_writer_enabled, false);
  assert.equal(apiReport.report.boundary.execute_token_contract_recorded, true);
  assert.equal(apiReport.report.boundary.execution_tokens_issued, false);
  assert.equal(apiReport.report.boundary.receipt_writer_enabled, false);
  assert.equal(operationContractsBoundary().mcp_write_execute_exposed, false);

  const result = await executeCli(['operation', 'contracts', '--scope', 'all', '--operation', 'resource_artifacts_cleanup_execute', '--json'], { now: fixedNow });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'operation contracts');
  assert.equal(body.data.operation_contracts.summary.contract_count, 4);
  assert.equal(body.data.operation_contracts.summary.token_issuance_enabled, false);
  assert.equal(body.data.operation_contracts.selected_operations[0].id, 'resource_artifacts_cleanup_execute');
  assert.equal(body.data.operation_contracts.selected_operations[0].required_gates.some((gate) => gate.id === 'candidate_lock'), true);
  assert.equal(body.data.boundary.contracts_report_only, true);
  assert.equal(body.data.boundary.live_execution_performed, false);
  assert.equal(body.data.boundary.artifacts_written, false);
  assert.deepEqual(body.artifacts, []);

  const invalid = await executeCli(['operation', 'contracts', '--scope', 'unsafe', '--json'], { now: fixedNow });
  assert.equal(invalid.exitCode, 1);
  assert.equal(JSON.parse(invalid.stdout).errors[0].code, 'INVALID_OPERATION_CONTRACTS_SCOPE');

  const execute = await executeCli(['operation', 'contracts', '--scope', 'token_contract', '--execute', '--json'], { now: fixedNow });
  assert.equal(execute.exitCode, 1);
  assert.equal(JSON.parse(execute.stdout).errors[0].code, 'CONFLICTING_OPTIONS');

  const mcpContracts = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 50,
    method: 'tools/call',
    params: {
      name: 'browser_debug_operation_contracts',
      arguments: { scope: 'gate_schema', operation: 'agent_execution_run' }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpContracts.result.structuredContent.command, 'operation contracts');
  assert.equal(mcpContracts.result.structuredContent.data.operation_contracts.scope_selection, 'gate_schema');
  assert.equal(mcpContracts.result.structuredContent.data.operation_contracts.contracts[0].id, 'gate_schema');
  assert.equal(mcpContracts.result.structuredContent.data.boundary.execution_harness_enabled, false);
});

test('operation policy reports Phase 65-68 readiness without token or harness execution', async () => {
  const parsed = parseCliArgs(['operation', 'policy', '--scope', 'harness_readiness', '--operation', 'agent_execution_run', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'operation policy');
  assert.equal(parsed.options.scope, 'harness_readiness');
  assert.equal(parsed.options.operation, 'agent_execution_run');

  const apiReport = buildOperationPolicyReport({ scope: 'mcp_readiness', operation: 'translation_mcp_admin_execute' }, { now: fixedNow });
  assert.equal(apiReport.ok, true);
  assert.equal(apiReport.report.scope_selection, 'mcp_readiness');
  assert.equal(apiReport.report.policy_source.loaded, true);
  assert.equal(apiReport.report.admin_policy.write_execute_tools_exposed, true);
  assert.equal(apiReport.report.readiness[0].id, 'mcp_readiness');
  assert.equal(apiReport.report.readiness[0].boundary.admin_mcp_execution_enabled, true);
  assert.equal(apiReport.report.boundary.phase_policy_recorded.includes(68), true);
  assert.equal(apiReport.report.boundary.execution_harness_enabled, false);
  assert.equal(operationPolicyBoundary().mcp_write_execute_exposed, true);

  const result = await executeCli(['operation', 'policy', '--scope', 'all', '--operation', 'resource_artifacts_cleanup_execute', '--json'], { now: fixedNow });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'operation policy');
  assert.equal(body.data.operation_policy.summary.readiness_count, 4);
  assert.equal(body.data.operation_policy.summary.execution_harness_enabled, false);
  assert.equal(body.data.operation_policy.admin_policy.live_execution_enabled, false);
  assert.equal(body.data.operation_policy.selected_operations[0].id, 'resource_artifacts_cleanup_execute');
  assert.equal(body.data.boundary.policy_report_only, true);
  assert.equal(body.data.boundary.admin_policy_config_written, false);
  assert.equal(body.data.boundary.mcp_admin_execution_enabled, true);
  assert.deepEqual(body.artifacts, []);

  const invalid = await executeCli(['operation', 'policy', '--scope', 'unsafe', '--json'], { now: fixedNow });
  assert.equal(invalid.exitCode, 1);
  assert.equal(JSON.parse(invalid.stdout).errors[0].code, 'INVALID_OPERATION_POLICY_SCOPE');

  const execute = await executeCli(['operation', 'policy', '--scope', 'harness_readiness', '--execute', '--json'], { now: fixedNow });
  assert.equal(execute.exitCode, 1);
  assert.equal(JSON.parse(execute.stdout).errors[0].code, 'CONFLICTING_OPTIONS');

  const mcpPolicy = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 51,
    method: 'tools/call',
    params: {
      name: 'browser_debug_operation_policy',
      arguments: { scope: 'admin_policy', operation: 'agent_execution_run' }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpPolicy.result.structuredContent.command, 'operation policy');
  assert.equal(mcpPolicy.result.structuredContent.data.operation_policy.scope_selection, 'admin_policy');
  assert.equal(mcpPolicy.result.structuredContent.data.operation_policy.admin_policy.token_issuance_enabled, false);
  assert.equal(mcpPolicy.result.structuredContent.data.boundary.mcp_write_execute_exposed, true);
});

test('operation admin-readiness reports Phase 69-70 readiness without token issuance or generic harness execution', async () => {
  const parsed = parseCliArgs(['operation', 'admin-readiness', '--scope', 'mcp_admin_token_flow', '--operation', 'agent_execution_run', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'operation admin-readiness');
  assert.equal(parsed.options.scope, 'mcp_admin_token_flow');
  assert.equal(parsed.options.operation, 'agent_execution_run');

  const apiReport = buildOperationAdminReadinessReport(
    { scope: 'mcp_admin_harness_bridge', operation: 'translation_mcp_admin_execute' },
    { now: fixedNow }
  );
  assert.equal(apiReport.ok, true);
  assert.equal(apiReport.report.scope_selection, 'mcp_admin_harness_bridge');
  assert.equal(apiReport.report.readiness[0].id, 'mcp_admin_harness_bridge');
  assert.equal(apiReport.report.readiness[0].boundary.mcp_admin_harness_enabled, false);
  assert.equal(apiReport.report.approval_boundary.approval_required_for_live_execution, true);
  assert.deepEqual(apiReport.report.boundary.phase_admin_readiness_recorded, [69, 70]);
  assert.equal(apiReport.report.boundary.mcp_admin_token_flow_enabled, false);
  assert.equal(apiReport.report.boundary.execution_tokens_issued, false);
  assert.equal(apiReport.report.boundary.mcp_admin_harness_enabled, false);
  assert.equal(operationAdminReadinessBoundary().mcp_write_execute_exposed, true);

  const result = await executeCli(['operation', 'admin-readiness', '--scope', 'all', '--operation', 'resource_artifacts_cleanup_execute', '--json'], { now: fixedNow });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'operation admin-readiness');
  assert.equal(body.data.operation_admin_readiness.summary.readiness_count, 2);
  assert.equal(body.data.operation_admin_readiness.summary.mcp_admin_token_flow_enabled, false);
  assert.equal(body.data.operation_admin_readiness.summary.mcp_admin_harness_enabled, false);
  assert.equal(body.data.operation_admin_readiness.selected_operations[0].id, 'resource_artifacts_cleanup_execute');
  assert.equal(body.data.boundary.admin_readiness_report_only, true);
  assert.equal(body.data.boundary.token_issuance_enabled, false);
  assert.equal(body.data.boundary.mcp_admin_execute_calls_enabled, true);
  assert.deepEqual(body.artifacts, []);

  const invalid = await executeCli(['operation', 'admin-readiness', '--scope', 'unsafe', '--json'], { now: fixedNow });
  assert.equal(invalid.exitCode, 1);
  assert.equal(JSON.parse(invalid.stdout).errors[0].code, 'INVALID_OPERATION_ADMIN_READINESS_SCOPE');

  const execute = await executeCli(['operation', 'admin-readiness', '--scope', 'mcp_admin_token_flow', '--execute', '--json'], { now: fixedNow });
  assert.equal(execute.exitCode, 1);
  assert.equal(JSON.parse(execute.stdout).errors[0].code, 'CONFLICTING_OPTIONS');

  const mcpAdminReadiness = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 52,
    method: 'tools/call',
    params: {
      name: 'browser_debug_operation_admin_readiness',
      arguments: { scope: 'mcp_admin_token_flow', operation: 'agent_execution_run' }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpAdminReadiness.result.structuredContent.command, 'operation admin-readiness');
  assert.equal(mcpAdminReadiness.result.structuredContent.data.operation_admin_readiness.scope_selection, 'mcp_admin_token_flow');
  assert.equal(mcpAdminReadiness.result.structuredContent.data.operation_admin_readiness.readiness[0].boundary.token_issuance_enabled, false);
  assert.equal(mcpAdminReadiness.result.structuredContent.data.boundary.mcp_write_execute_exposed, true);
});

test('operation provider-readiness reports provider planning, admin execution, and status/list readiness without provider calls', async () => {
  const parsed = parseCliArgs(['operation', 'provider-readiness', '--scope', 'env_credential_guard', '--operation', 'agent_execution_run', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'operation provider-readiness');
  assert.equal(parsed.options.scope, 'env_credential_guard');
  assert.equal(parsed.options.operation, 'agent_execution_run');

  const apiReport = buildOperationProviderReadinessReport(
    { scope: 'disclosure_contract', operation: 'provider_api_execution' },
    { now: fixedNow }
  );
  assert.equal(apiReport.ok, true);
  assert.equal(apiReport.report.scope_selection, 'disclosure_contract');
  assert.equal(apiReport.report.operation_selection, 'provider_mcp_api_execute');
  assert.equal(apiReport.report.readiness[0].id, 'disclosure_contract');
  assert.equal(apiReport.report.disclosure_contract.external_evidence_transfer_authorized, true);
  assert.equal(apiReport.report.provider_catalog.some((provider) => provider.id === 'generic-api-provider'), true);
  assert.equal(apiReport.report.provider_catalog.every((provider) => provider.provider_call_performed === false), true);
  assert.equal(apiReport.report.status_list_contract.status_tool_available, true);
  assert.equal(apiReport.report.status_list_contract.list_tool_available, true);
  assert.equal(apiReport.report.status_list_contract.tools.every((tool) => tool.effects.providerCall === false), true);
  assert.equal(apiReport.report.status_list_contract.tools.every((tool) => tool.effects.writesArtifacts === false), true);
  assert.equal(apiReport.report.credential_guard.endpoint_env_name, API_PROVIDER_ENDPOINT_ENV);
  assert.equal(apiReport.report.credential_guard.credential_env_name, API_PROVIDER_CREDENTIAL_ENV);
  assert.equal(apiReport.report.boundary.credential_values_read, false);
  assert.equal(apiReport.report.boundary.provider_call_performed, false);
  assert.equal(operationProviderReadinessBoundary().mcp_write_execute_exposed, true);
  assert.equal(operationProviderReadinessBoundary().provider_mcp_status_list_available, true);

  const statusListTools = getMcpToolsByTag('safe', MCP_TOOL_TAGS.PROVIDER_STATUS_LIST_READ);
  assert.equal(statusListTools.some((tool) => tool.tags.includes(MCP_TOOL_TAGS.AGENT_EXECUTION_STATUS_READ)), true);
  assert.equal(statusListTools.some((tool) => tool.tags.includes(MCP_TOOL_TAGS.AGENT_EXECUTION_LIST_READ)), true);
  assert.equal(statusListTools.every((tool) => tool.effects.providerCall === false), true);
  assert.equal(statusListTools.every((tool) => tool.effects.writesArtifacts === false), true);

  const result = await executeCli(['operation', 'provider-readiness', '--scope', 'all', '--operation', 'agent_execution_run', '--json'], { now: fixedNow });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'operation provider-readiness');
  assert.equal(body.data.operation_provider_readiness.summary.readiness_count, 7);
  assert.equal(body.data.operation_provider_readiness.summary.implemented_phase_max, 78);
  assert.equal(body.data.operation_provider_readiness.summary.provider_mcp_status_list_available, true);
  assert.equal(body.data.operation_provider_readiness.summary.status_list_tool_count >= 2, true);
  assert.equal(body.data.operation_provider_readiness.summary.provider_mcp_execution_enabled, true);
  assert.equal(body.data.operation_provider_readiness.summary.provider_mcp_fake_execution_enabled, true);
  assert.equal(body.data.operation_provider_readiness.summary.provider_mcp_local_runner_execution_enabled, true);
  assert.equal(body.data.operation_provider_readiness.summary.provider_mcp_api_execution_enabled, true);
  assert.equal(body.data.operation_provider_readiness.summary.credential_values_recorded, false);
  assert.equal(body.data.operation_provider_readiness.provider_catalog.length >= 3, true);
  assert.equal(body.data.operation_provider_readiness.status_list_contract.read_only, true);
  assert.equal(body.data.boundary.provider_readiness_report_only, true);
  assert.equal(body.data.boundary.provider_mcp_status_list_read_only, true);
  assert.equal(body.data.boundary.provider_mcp_execution_enabled, true);
  assert.equal(body.data.boundary.safe_mcp_provider_execution_enabled, false);
  assert.equal(body.data.boundary.full_mcp_provider_execution_enabled, false);
  assert.equal(body.data.boundary.admin_mcp_provider_execution_enabled, true);
  assert.equal(body.data.boundary.external_evidence_transfer_performed, false);
  assert.deepEqual(body.artifacts, []);

  const invalid = await executeCli(['operation', 'provider-readiness', '--scope', 'unsafe', '--json'], { now: fixedNow });
  assert.equal(invalid.exitCode, 1);
  assert.equal(JSON.parse(invalid.stdout).errors[0].code, 'INVALID_OPERATION_PROVIDER_READINESS_SCOPE');

  const execute = await executeCli(['operation', 'provider-readiness', '--scope', 'provider_mcp_plan', '--execute', '--json'], { now: fixedNow });
  assert.equal(execute.exitCode, 1);
  assert.equal(JSON.parse(execute.stdout).errors[0].code, 'CONFLICTING_OPTIONS');

  const providerOption = await executeCli(['operation', 'provider-readiness', '--provider', 'generic-api-provider', '--json'], { now: fixedNow });
  assert.equal(providerOption.exitCode, 1);
  assert.equal(JSON.parse(providerOption.stdout).errors[0].code, 'UNSUPPORTED_OPERATION_PROVIDER_READINESS_OPTION');

  const sentinelCredential = 'credential-sentinel-value';
  const sentinelEndpoint = 'https://provider.invalid/sentinel';
  const sentinel = await executeCli(['operation', 'provider-readiness', '--scope', 'env_credential_guard', '--json'], {
    now: fixedNow,
    env: {
      [API_PROVIDER_ENDPOINT_ENV]: sentinelEndpoint,
      [API_PROVIDER_CREDENTIAL_ENV]: sentinelCredential
    },
    fetch: () => {
      throw new Error('provider readiness must not call fetch');
    }
  });
  assert.equal(sentinel.exitCode, 0);
  assert.equal(sentinel.stdout.includes(sentinelCredential), false);
  assert.equal(sentinel.stdout.includes(sentinelEndpoint), false);

  const mcpProviderReadiness = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 53,
    method: 'tools/call',
    params: {
      name: 'browser_debug_operation_provider_readiness',
      arguments: { scope: 'provider_mcp_status_list', operation: 'agent_execution_run' }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(mcpProviderReadiness.result.structuredContent.command, 'operation provider-readiness');
  assert.equal(mcpProviderReadiness.result.structuredContent.data.operation_provider_readiness.scope_selection, 'provider_mcp_status_list');
  assert.equal(mcpProviderReadiness.result.structuredContent.data.operation_provider_readiness.readiness[0].id, 'provider_mcp_status_list');
  assert.equal(mcpProviderReadiness.result.structuredContent.data.operation_provider_readiness.status_list_contract.provider_mcp_execution_enabled, true);
  assert.equal(mcpProviderReadiness.result.structuredContent.data.operation_provider_readiness.credential_guard.credential_values_read, false);
  assert.equal(mcpProviderReadiness.result.structuredContent.data.boundary.provider_call_performed, false);
});

test('MCP adapter exposes a local allowlisted tool surface', async () => {
  const initialized = await handleMcpRequest({ jsonrpc: '2.0', id: 0, method: 'initialize' });
  assert.equal(initialized.result.serverInfo.name, PRODUCT_IDENTITY.mcpServerName);
  assert.equal(initialized.result.metadata.name, 'full');
  assert.equal(initialized.result.metadata.identity.package_name, PRODUCT_IDENTITY.packageName);
  assert.equal(initialized.result.metadata.identity.package_version, PRODUCT_IDENTITY.packageVersion);
  assert.equal(initialized.result.metadata.identity.mcp_bin_name, PRODUCT_IDENTITY.mcpBinName);
  assert.equal(initialized.result.metadata.compatibility.legacy_alias_policy.removal_authorized, false);
  assert.equal(initialized.result.metadata.profile.name, 'full');

  const listed = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(listed.result.profile.name, 'full');
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_review'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_target_init'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_target_validate'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_resource_status'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_resource_artifacts_plan'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_agent_surfaces_list'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_agent_requests_list'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_agent_workflow_status'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_agent_execution_status'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_visual_review_dashboard'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_capture_readiness'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_language_settings'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_localization_resources'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_report_templates'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_translation_readiness'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_release_readiness'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_artifact_root_status'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_legacy_alias_audit'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_legacy_alias_removal_readiness'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_shell_readiness'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_final_readiness'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_mcp_execution_gates'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_mcp_capabilities'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_operation_registry'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_operation_roadmap'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_operation_contracts'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_operation_policy'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_operation_admin_readiness'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_operation_provider_readiness'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_review_target'), true);
  assert.equal(listed.result.tools.some((tool) => /agentic.*review|human_review|agent_execution_plan|agent_execution_run|cleanup_execute|provider_execute|visual_review_prepare|visual_review_plan|visual_review_aggregate|desktop_review_provider|capture_handoff|raw_pixel|page_text|shell_run|shell_execute/i.test(tool.name)), false);
  assert.equal(listed.result.tools.every((tool) => tool.effects.shellUsed === false), true);

  const safeListed = await handleMcpRequest({ jsonrpc: '2.0', id: 11, method: 'tools/list' }, { mcpProfile: 'safe' });
  const safeToolNames = safeListed.result.tools.map((tool) => tool.name);
  assert.equal(safeListed.result.profile.name, 'safe');
  assert.equal(safeToolNames.includes('browser_debug_target_validate'), true);
  assert.equal(safeToolNames.includes('browser_debug_resource_status'), true);
  assert.equal(safeToolNames.includes('browser_debug_resource_artifacts_plan'), true);
  assert.equal(safeToolNames.includes('browser_debug_agent_surfaces_list'), true);
  assert.equal(safeToolNames.includes('browser_debug_agent_requests_show'), true);
  assert.equal(safeToolNames.includes('browser_debug_agent_workflow_index'), true);
  assert.equal(safeToolNames.includes('browser_debug_agent_execution_list'), true);
  assert.equal(safeToolNames.includes('browser_debug_visual_review_dashboard'), true);
  assert.equal(safeToolNames.includes('browser_debug_capture_readiness'), true);
  assert.equal(safeToolNames.includes('browser_debug_language_settings'), true);
  assert.equal(safeToolNames.includes('browser_debug_localization_resources'), true);
  assert.equal(safeToolNames.includes('browser_debug_report_templates'), true);
  assert.equal(safeToolNames.includes('browser_debug_translation_readiness'), true);
  assert.equal(safeToolNames.includes('browser_debug_release_readiness'), true);
  assert.equal(safeToolNames.includes('browser_debug_artifact_root_status'), true);
  assert.equal(safeToolNames.includes('browser_debug_legacy_alias_audit'), true);
  assert.equal(safeToolNames.includes('browser_debug_legacy_alias_removal_readiness'), true);
  assert.equal(safeToolNames.includes('browser_debug_shell_readiness'), true);
  assert.equal(safeToolNames.includes('browser_debug_final_readiness'), true);
  assert.equal(safeToolNames.includes('browser_debug_mcp_execution_gates'), true);
  assert.equal(safeToolNames.includes('browser_debug_mcp_capabilities'), true);
  assert.equal(safeToolNames.includes('browser_debug_operation_registry'), true);
  assert.equal(safeToolNames.includes('browser_debug_operation_roadmap'), true);
  assert.equal(safeToolNames.includes('browser_debug_operation_contracts'), true);
  assert.equal(safeToolNames.includes('browser_debug_operation_policy'), true);
  assert.equal(safeToolNames.includes('browser_debug_operation_admin_readiness'), true);
  assert.equal(safeToolNames.includes('browser_debug_operation_provider_readiness'), true);
  assert.equal(safeToolNames.includes('browser_debug_review'), false);
  assert.equal(safeToolNames.includes('browser_debug_observe'), false);
  assert.equal(safeToolNames.includes('browser_debug_target_init'), false);
  assert.equal(safeToolNames.includes('browser_debug_review_target'), false);
  assert.equal(safeToolNames.some((name) => /agentic.*review|human_review|agent_execution_plan|agent_execution_run|cleanup_execute|provider_execute|visual_review_prepare|visual_review_plan|visual_review_run|visual_review_aggregate|desktop_review_provider|capture_handoff|raw_pixel|page_text|shell_run|shell_execute/i.test(name)), false);
  assert.equal(safeListed.result.tools.every((tool) => tool.effects.browserLaunched === false), true);
  assert.equal(safeListed.result.tools.every((tool) => tool.effects.deletesFiles === false), true);
  assert.equal(safeListed.result.tools.every((tool) => tool.effects.providerCall === false), true);

  const languageTool = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 14,
    method: 'tools/call',
    params: {
      name: 'browser_debug_language_settings',
      arguments: {}
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(languageTool.result.structuredContent.command, 'settings language');
  assert.equal(languageTool.result.structuredContent.data.language_settings.dashboard_ui.locale, 'en');
  assert.equal(languageTool.result.structuredContent.data.boundary.mcp_write_execute_exposed, false);

  const adminListed = await handleMcpRequest({ jsonrpc: '2.0', id: 12, method: 'tools/list' }, { mcpProfile: 'admin' });
  assert.equal(adminListed.result.profile.name, 'admin');
  const adminToolNames = adminListed.result.tools.map((tool) => tool.name);
  assert.equal(adminToolNames.includes('browser_debug_agent_execution_plan'), true);
  assert.equal(adminToolNames.includes('browser_debug_agent_execution_run'), true);
  assert.equal(adminToolNames.some((name) => /agentic.*review|human_review|raw_pixel|page_text/i.test(name)), false);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_agent_execution_plan'), false);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_agent_execution_run'), false);
  assert.equal(adminListed.result.tools.find((tool) => tool.name === 'browser_debug_agent_execution_run').effects.providerCall, true);
  assert.equal(adminListed.result.tools.find((tool) => tool.name === 'browser_debug_agent_execution_run').effects.writesArtifacts, true);
  assert.equal(adminListed.result.tools.every((tool) => tool.effects.deletesFiles === false), true);

  const invalidProfile = await handleMcpRequest({ jsonrpc: '2.0', id: 13, method: 'tools/list' }, { mcpProfile: 'wide-open' });
  assert.equal(invalidProfile.error.code, -32602);
  assert.match(invalidProfile.error.message, /Unsupported MCP profile/);

  const blockedByProfile = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 14,
    method: 'tools/call',
    params: {
      name: 'browser_debug_review',
      arguments: { url: 'https://example.test/' }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(blockedByProfile.error.code, -32602);
  assert.match(blockedByProfile.error.message, /not available for MCP profile safe/);

  const mcpInfoParsed = parseCliArgs(['mcp', 'serve', '--profile', 'safe', '--json']);
  assert.equal(mcpInfoParsed.ok, true);
  assert.equal(mcpInfoParsed.options.profile, 'safe');

  const mcpInfo = await executeCli(['mcp', 'serve', '--profile', 'safe', '--json'], { now: fixedNow });
  assert.equal(mcpInfo.exitCode, 0);
  const mcpInfoBody = JSON.parse(mcpInfo.stdout);
  assert.equal(mcpInfoBody.data.adapter.profile.name, 'safe');

  const mcpConfigParsed = parseCliArgs(['mcp', 'config', '--client', 'codex', '--profile', 'safe', '--json']);
  assert.equal(mcpConfigParsed.ok, true);
  assert.equal(mcpConfigParsed.command, 'mcp config');
  assert.equal(mcpConfigParsed.options.client, 'codex');

  const stdioConfig = await executeCli(['mcp', 'config', '--client', 'codex', '--json'], { now: fixedNow });
  assert.equal(stdioConfig.exitCode, 0);
  const stdioConfigBody = JSON.parse(stdioConfig.stdout);
  assert.equal(stdioConfigBody.command, 'mcp config');
  assert.equal(stdioConfigBody.data.config.transport, 'stdio');
  assert.equal(stdioConfigBody.data.config.client, 'codex');
  assert.equal(stdioConfigBody.data.config.profile.name, 'safe');
  assert.equal(stdioConfigBody.data.config.launch.command, PRODUCT_IDENTITY.mcpBinName);
  assert.deepEqual(stdioConfigBody.data.config.launch.args, ['--profile', 'safe']);
  assert.equal(stdioConfigBody.data.config.mcpServers[PRODUCT_IDENTITY.mcpServerName].command, PRODUCT_IDENTITY.mcpBinName);
  const legacyMcpServerName = PRODUCT_IDENTITY.legacyMcpServerNames[0];
  const legacyMcpBin = PRODUCT_IDENTITY.legacyMcpBins[0];
  assert.equal(stdioConfigBody.data.config.legacy_mcpServers[legacyMcpServerName].command, legacyMcpBin.name);
  assert.deepEqual(stdioConfigBody.data.config.legacy_mcpServers[legacyMcpServerName].args, ['--profile', 'safe']);
  assert.equal(stdioConfigBody.data.config.compatibility.legacy.mcp_bin_names[0], legacyMcpBin.name);
  const expectedLocalMcpBinPath = path.resolve(process.cwd(), PRODUCT_IDENTITY.mcpBinPath);
  assert.equal(stdioConfigBody.data.config.local_checkout.launch.command, process.execPath);
  assert.deepEqual(stdioConfigBody.data.config.local_checkout.launch.args, [expectedLocalMcpBinPath, '--profile', 'safe']);
  assert.equal(stdioConfigBody.data.config.local_checkout.mcpServers[PRODUCT_IDENTITY.mcpServerName].command, process.execPath);
  assert.deepEqual(
    stdioConfigBody.data.config.local_checkout.mcpServers[PRODUCT_IDENTITY.mcpServerName].args,
    [expectedLocalMcpBinPath, '--profile', 'safe']
  );
  const expectedLegacyLocalMcpBinPath = path.resolve(process.cwd(), legacyMcpBin.path);
  assert.equal(stdioConfigBody.data.config.local_checkout.legacy_mcpServers[legacyMcpServerName].command, process.execPath);
  assert.deepEqual(
    stdioConfigBody.data.config.local_checkout.legacy_mcpServers[legacyMcpServerName].args,
    [expectedLegacyLocalMcpBinPath, '--profile', 'safe']
  );
  assert.equal(stdioConfigBody.data.config.local_checkout.boundary.config_file_written, false);
  assert.equal(stdioConfigBody.data.config.boundary.server_started, false);
  assert.equal(stdioConfigBody.data.config.boundary.token_values_emitted, false);
  assert.equal(stdioConfigBody.data.config.boundary.cleanup_execution, false);
  assert.equal(stdioConfigBody.data.config.boundary.provider_api_execution, false);

  const mcpCapabilitiesParsed = parseCliArgs(['mcp', 'capabilities', '--profile', 'admin', '--scope', 'excluded', '--json']);
  assert.equal(mcpCapabilitiesParsed.ok, true);
  assert.equal(mcpCapabilitiesParsed.command, 'mcp capabilities');
  assert.equal(mcpCapabilitiesParsed.options.profile, 'admin');
  assert.equal(mcpCapabilitiesParsed.options.scope, 'excluded');

  const mcpCapabilities = await executeCli(['mcp', 'capabilities', '--profile', 'admin', '--scope', 'excluded', '--json'], { now: fixedNow });
  assert.equal(mcpCapabilities.exitCode, 0);
  const mcpCapabilitiesBody = JSON.parse(mcpCapabilities.stdout);
  const excludedOperationIds = mcpCapabilitiesBody.data.capabilities.excluded_operations.map((operation) => operation.id);
  assert.equal(mcpCapabilitiesBody.command, 'mcp capabilities');
  assert.equal(mcpCapabilitiesBody.data.capabilities.scope, 'excluded');
  assert.equal(mcpCapabilitiesBody.data.capabilities.profiles.length, 0);
  assert.equal(mcpCapabilitiesBody.data.capabilities.transports.length, 0);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.currently_equivalent_to_full, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.write_execute_tools_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.cleanup_plan_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.cleanup_execution_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.agent_execution_plan_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.agent_execution_run_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.agentic_human_review_propose_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.agentic_human_review_plan_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.agentic_human_review_run_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.agentic_human_review_provider_readiness_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.agentic_human_review_report_quality_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.agentic_human_review_provider_api_execution_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.agentic_human_review_raw_pixel_transfer_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.agentic_human_review_page_text_transfer_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.provider_api_execution_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.shell_tools_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.cleanup_execution, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.cleanup_plan, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.agent_execution_plan, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.agent_execution_run, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.agentic_human_review_propose, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.agentic_human_review_plan, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.agentic_human_review_run, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.agentic_human_review_provider_readiness, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.agentic_human_review_report_quality, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.agentic_human_review_provider_api_execution, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.agentic_human_review_raw_pixel_transfer, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.agentic_human_review_page_text_transfer, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.provider_api_execution, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.arbitrary_shell, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.http_full_or_admin, false);
  assert.deepEqual(mcpCapabilitiesBody.data.capabilities.excluded_operations.map((operation) => operation.mcp_admin), excludedOperationIds.map(() => false));
  assert.equal(excludedOperationIds.includes('agent_execution_run'), false);
  assert.ok(excludedOperationIds.includes('visual_provider_execution'));
  assert.ok(excludedOperationIds.includes('visual_review_run'));
  assert.ok(excludedOperationIds.includes('visual_review_result_preparation'));
  assert.ok(excludedOperationIds.includes('visual_review_aggregation'));
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.visual_review_run_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.visual_review_result_preparation_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.visual_review_aggregation_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.capture_readiness_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.capture_plan_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.capture_execution_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.localization_resources_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.report_templates_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.translation_readiness_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.translation_execution_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.release_readiness_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.npm_publication_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.artifact_root_status_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.artifact_root_migration_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.legacy_alias_audit_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.legacy_alias_removal_readiness_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.legacy_alias_removal_exposed, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.shell_readiness_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.admin_policy.final_readiness_exposed, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.visual_review_run, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.visual_review_result_preparation, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.visual_review_aggregation, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.capture_readiness, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.capture_plan, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.capture_execution, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.localization_resources, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.report_templates, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.translation_readiness, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.translation_execution, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.release_readiness, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.npm_publication, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.artifact_root_status, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.artifact_root_migration, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.legacy_alias_audit, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.legacy_alias_removal_readiness, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.legacy_alias_removal, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.shell_readiness, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.final_readiness, true);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.constrained_shell_execution, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.raw_image_transfer, false);
  assert.equal(mcpCapabilitiesBody.data.capabilities.boundaries.raw_page_text_transfer, false);
  assert.ok(excludedOperationIds.includes('agentic_human_review_plan'));
  assert.ok(excludedOperationIds.includes('agentic_human_review_package'));
  assert.ok(excludedOperationIds.includes('agentic_human_review_run'));
  assert.ok(excludedOperationIds.includes('agentic_human_review_propose'));
  assert.ok(excludedOperationIds.includes('agentic_human_review_provider_readiness'));
  assert.ok(excludedOperationIds.includes('agentic_human_review_provider_api_execution'));
  assert.ok(excludedOperationIds.includes('agentic_human_review_report_quality'));
  assert.ok(excludedOperationIds.includes('agentic_human_review_raw_pixel_transfer'));
  assert.ok(excludedOperationIds.includes('agentic_human_review_page_text_transfer'));
  assert.ok(excludedOperationIds.includes('resource_artifacts_cleanup_execute'));
  assert.equal(excludedOperationIds.includes('provider_api_execution'), false);
  assert.ok(excludedOperationIds.includes('translation_mcp_admin_execute'));
  assert.ok(excludedOperationIds.includes('npm_publish'));
  assert.ok(excludedOperationIds.includes('artifact_root_migration_execute'));
  assert.ok(excludedOperationIds.includes('legacy_alias_removal'));
  assert.ok(excludedOperationIds.includes('arbitrary_shell'));
  assert.ok(excludedOperationIds.includes('constrained_shell_mcp_execute'));
  assert.ok(excludedOperationIds.includes('http_full_admin_socket_remote'));

  const safeProfileCapabilities = await executeCli(['mcp', 'capabilities', '--profile', 'safe', '--scope', 'profiles', '--json'], { now: fixedNow });
  assert.equal(safeProfileCapabilities.exitCode, 0);
  const safeProfileCapabilitiesBody = JSON.parse(safeProfileCapabilities.stdout);
  assert.deepEqual(safeProfileCapabilitiesBody.data.capabilities.profiles.map((profile) => profile.name), ['safe']);
  assert.equal(safeProfileCapabilitiesBody.data.capabilities.excluded_operations.length, 0);
  assert.equal(safeProfileCapabilitiesBody.data.capabilities.profiles[0].tools.some((tool) => tool.name === 'browser_debug_mcp_capabilities'), true);
  assert.equal(safeProfileCapabilitiesBody.data.capabilities.profiles[0].tools.some((tool) => tool.name === 'browser_debug_review'), false);

  const invalidCapabilities = await executeCli(['mcp', 'capabilities', '--scope', 'wide-open', '--json'], { now: fixedNow });
  assert.equal(invalidCapabilities.exitCode, 1);
  assert.equal(JSON.parse(invalidCapabilities.stdout).errors[0].code, 'INVALID_MCP_CAPABILITY_SCOPE');

  const httpInfoParsed = parseCliArgs([
    'mcp',
    'serve',
    '--transport',
    'http',
    '--profile',
    'safe',
    '--host',
    '127.0.0.1',
    '--port',
    '0',
    '--token-env',
    'TRACE_CUE_MCP_HTTP_TOKEN',
    '--json'
  ]);
  assert.equal(httpInfoParsed.ok, true);
  assert.equal(httpInfoParsed.options.transport, 'http');
  assert.equal(httpInfoParsed.options.profile, 'safe');

  const httpInfo = await executeCli([
    'mcp',
    'serve',
    '--transport',
    'http',
    '--profile',
    'safe',
    '--host',
    '127.0.0.1',
    '--port',
    '0',
    '--json'
  ], { now: fixedNow });
  assert.equal(httpInfo.exitCode, 0);
  const httpInfoBody = JSON.parse(httpInfo.stdout);
  assert.equal(httpInfoBody.data.adapter.transport, 'http');
  assert.equal(httpInfoBody.data.adapter.profile.name, 'safe');
  assert.equal(httpInfoBody.data.adapter.auth_required, true);
  assert.equal(httpInfoBody.data.adapter.token_env, 'TRACE_CUE_MCP_HTTP_TOKEN');
  assert.equal(httpInfoBody.data.adapter.external_channel, false);

  const mcpHttpTokenEnv = 'TRACE_CUE_MCP_HTTP_TOKEN';
  const httpConfig = await executeCli([
    'mcp',
    'config',
    '--transport',
    'http',
    '--profile',
    'safe',
    '--host',
    '127.0.0.1',
    '--port',
    '8765',
    '--token-env',
    'TRACE_CUE_MCP_HTTP_TOKEN',
    '--json'
  ], { now: fixedNow, env: { [mcpHttpTokenEnv]: 'redaction-sentinel-value' } });
  assert.equal(httpConfig.exitCode, 0);
  const httpConfigBody = JSON.parse(httpConfig.stdout);
  assert.equal(httpConfigBody.data.config.transport, 'http');
  assert.equal(httpConfigBody.data.config.profile.name, 'safe');
  assert.equal(httpConfigBody.data.config.client_connection.url, 'http://127.0.0.1:8765/mcp');
  assert.equal(httpConfigBody.data.config.client_connection.protocol_version, '2025-06-18');
  assert.equal(httpConfigBody.data.config.launch.env[mcpHttpTokenEnv], '<set-16-or-more-character-token>');
  assert.equal(httpConfigBody.data.config.local_checkout.launch.command, process.execPath);
  assert.deepEqual(httpConfigBody.data.config.local_checkout.launch.args, [
    expectedLocalMcpBinPath,
    '--transport',
    'http',
    '--profile',
    'safe',
    '--host',
    '127.0.0.1',
    '--port',
    '8765',
    '--endpoint',
    '/mcp',
    '--token-env',
    'TRACE_CUE_MCP_HTTP_TOKEN'
  ]);
  assert.equal(httpConfigBody.data.config.local_checkout.launch.env[mcpHttpTokenEnv], '<set-16-or-more-character-token>');
  assert.equal(httpConfigBody.data.config.local_checkout.client_connection.url, 'http://127.0.0.1:8765/mcp');
  assert.equal(httpConfigBody.data.config.local_checkout.boundary.server_started, false);
  assert.equal(httpConfigBody.data.config.metadata.token_env, 'TRACE_CUE_MCP_HTTP_TOKEN');
  assert.deepEqual(httpConfigBody.data.config.metadata.legacy_token_envs, ['BROWSER_DEBUG_MCP_HTTP_TOKEN']);
  assert.equal(httpConfigBody.data.config.legacy_launches[0].command, legacyMcpBin.name);
  assert.equal(httpConfigBody.data.config.local_checkout.legacy_launches[0].bin_path, expectedLegacyLocalMcpBinPath);
  assert.equal(httpConfigBody.data.config.boundary.token_values_emitted, false);
  assert.equal(httpConfigBody.data.config.boundary.server_started, false);
  assert.equal(httpConfigBody.data.config.boundary.http_full_or_admin, false);
  assert.equal(JSON.stringify(httpConfigBody).includes('redaction-sentinel-value'), false);

  const httpConfigDefaultPort = await executeCli(['mcp', 'config', '--transport', 'http', '--json'], { now: fixedNow });
  assert.equal(httpConfigDefaultPort.exitCode, 0);
  assert.equal(JSON.parse(httpConfigDefaultPort.stdout).data.config.client_connection.url, 'http://127.0.0.1:8765/mcp');

  const httpFullConfig = await executeCli(['mcp', 'config', '--transport', 'http', '--profile', 'full', '--json'], { now: fixedNow });
  assert.equal(httpFullConfig.exitCode, 1);
  assert.equal(JSON.parse(httpFullConfig.stdout).errors[0].code, 'HTTP_MCP_PROFILE_REJECTED');

  const httpFullInfo = await executeCli(['mcp', 'serve', '--transport', 'http', '--profile', 'full', '--json'], { now: fixedNow });
  assert.equal(httpFullInfo.exitCode, 1);
  assert.equal(JSON.parse(httpFullInfo.stdout).errors[0].code, 'HTTP_MCP_PROFILE_REJECTED');

  const invalidMcpInfo = await executeCli(['mcp', 'serve', '--profile', 'wide-open', '--json'], { now: fixedNow });
  assert.equal(invalidMcpInfo.exitCode, 1);
  assert.equal(JSON.parse(invalidMcpInfo.stdout).errors[0].code, 'INVALID_MCP_PROFILE');

  const schema = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'browser_debug_schema_get',
      arguments: { name: 'envelope' }
    }
  }, { now: fixedNow });
  assert.equal(schema.result.structuredContent.command, 'schema get');
  assert.equal(schema.result.structuredContent.status, 'ok');

  const resource = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'browser_debug_resource_status',
      arguments: {}
    }
  }, { now: fixedNow, ...createResourceStatusContext() });
  assert.equal(resource.result.structuredContent.command, 'resource status');
  assert.equal(resource.result.structuredContent.status, 'ok');
  assert.equal(resource.result.structuredContent.data.boundary.browser_launched, false);
  assert.equal(resource.result.structuredContent.data.boundary.system_cache_mutated, false);

  const artifactCwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-mcp-artifacts-'));
  const artifactPlan = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: {
      name: 'browser_debug_resource_artifacts_plan',
      arguments: { maxBytes: '1mib' }
    }
  }, { cwd: artifactCwd, now: fixedNow });
  assert.equal(artifactPlan.result.structuredContent.command, 'resource artifacts plan');
  assert.equal(artifactPlan.result.structuredContent.data.boundary.cache_deleted, false);
  assert.match(artifactPlan.result.structuredContent.data.cleanup_proposal.plan_hash, /^[a-f0-9]{64}$/);

  const artifactPlanWithExecute = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 61,
    method: 'tools/call',
    params: {
      name: 'browser_debug_resource_artifacts_plan',
      arguments: { maxBytes: '1mib', execute: true }
    }
  }, { cwd: artifactCwd, now: fixedNow });
  assert.equal(artifactPlanWithExecute.error.code, -32602);
  assert.match(artifactPlanWithExecute.error.message, /Unsupported MCP argument/);

  const capabilityPolicy = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: {
      name: 'browser_debug_mcp_capabilities',
      arguments: { profile: 'admin', scope: 'excluded' }
    }
  }, { mcpProfile: 'safe', now: fixedNow });
  assert.equal(capabilityPolicy.result.structuredContent.command, 'mcp capabilities');
  assert.equal(capabilityPolicy.result.structuredContent.status, 'ok');
  assert.equal(capabilityPolicy.result.structuredContent.data.capabilities.admin_policy.write_execute_tools_exposed, true);
  assert.equal(capabilityPolicy.result.structuredContent.data.capabilities.excluded_operations.some((operation) => operation.id === 'agent_execution_run'), false);
  assert.equal(capabilityPolicy.result.structuredContent.data.capabilities.excluded_operations.every((operation) => operation.mcp_admin === false), true);

  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-mcp-target-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const target = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'browser_debug_target_init',
      arguments: { url: 'https://example.test/app', maxRoutes: 4 }
    }
  }, { cwd, now: fixedNow, createId: () => 'target-mcp' });
  assert.equal(target.result.structuredContent.command, 'target init');
  assert.equal(target.result.structuredContent.data.target_manifest.budgets.maxRoutes, 4);

  const targetArtifact = target.result.structuredContent.artifacts.find((artifact) => artifact.type === 'target_manifest');
  const validated = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'browser_debug_target_validate',
      arguments: { target: targetArtifact.path }
    }
  }, { cwd, now: fixedNow });
  assert.equal(validated.result.structuredContent.command, 'target validate');
  assert.equal(validated.result.structuredContent.data.target_manifest.status, 'valid');
  assert.equal(validated.result.structuredContent.data.boundary.browser_launched, false);

  const confinedRoot = await mkdtemp(path.join(tmpdir(), 'browser-debug-mcp-confine-'));
  const workspace = path.join(confinedRoot, 'workspace');
  await mkdir(workspace);
  await writeFile(path.join(workspace, '.gitignore'), '.browser-debug/\n', 'utf8');
  const manifest = {
    schema_version: '0.1.0',
    name: 'MCP confinement fixture',
    baseUrl: 'https://example.test/',
    scope: { sameOrigin: true, allowedHosts: ['example.test'] },
    seeds: ['/'],
    expectedRoutes: ['/'],
    viewportMatrix: [{ name: 'desktop', width: 1280, height: 720 }],
    actionPolicy: { click: 'navigation_only', forms: 'skip', destructive: 'skip', external: 'skip' },
    budgets: { maxRoutes: 1, maxActionsPerRoute: 0 },
    artifacts: { screenshot: false, trace: false, report: false },
    masks: [],
    regions: [],
    pages: [],
    localContentUxAdvisory: { enabled: false }
  };
  await writeFile(path.join(workspace, 'target.json'), JSON.stringify(manifest), 'utf8');
  const outsideManifest = path.join(confinedRoot, 'outside-target.json');
  await writeFile(outsideManifest, JSON.stringify(manifest), 'utf8');
  await symlink(outsideManifest, path.join(workspace, 'linked-target.json'));

  const safeValidated = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 15,
    method: 'tools/call',
    params: {
      name: 'browser_debug_target_validate',
      arguments: { target: 'target.json' }
    }
  }, { cwd: workspace, mcpProfile: 'safe', now: fixedNow });
  assert.equal(safeValidated.result.structuredContent.status, 'ok');

  const traversalBlocked = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 16,
    method: 'tools/call',
    params: {
      name: 'browser_debug_target_validate',
      arguments: { target: '../outside-target.json' }
    }
  }, { cwd: workspace, mcpProfile: 'safe', now: fixedNow });
  assert.equal(traversalBlocked.result.isError, true);
  assert.equal(traversalBlocked.result.structuredContent.errors[0].code, 'INPUT_FILE_OUTSIDE_WORKSPACE');

  const symlinkBlocked = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 17,
    method: 'tools/call',
    params: {
      name: 'browser_debug_target_validate',
      arguments: { target: 'linked-target.json' }
    }
  }, { cwd: workspace, mcpProfile: 'safe', now: fixedNow });
  assert.equal(symlinkBlocked.result.isError, true);
  assert.equal(symlinkBlocked.result.structuredContent.errors[0].code, 'INPUT_FILE_OUTSIDE_WORKSPACE');
});

test('HTTP MCP transport is loopback, token-gated, and safe-profile only', async () => {
  const token = '0123456789abcdef';
  const mcpHttpTokenEnv = 'TRACE_CUE_MCP_HTTP_TOKEN';
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-http-mcp-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');

  const started = await startMcpHttpServer({ port: 0 }, {
    cwd,
    now: fixedNow,
    env: { [mcpHttpTokenEnv]: token }
  });
  try {
    assert.equal(started.metadata.profile, 'safe');
    assert.equal(started.metadata.auth_required, true);
    assert.equal(started.metadata.external_channel, false);

    const listed = await fetch(started.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Origin: 'http://127.0.0.1'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    });
    assert.equal(listed.status, 200);
    const listedBody = await listed.json();
    const toolNames = listedBody.result.tools.map((tool) => tool.name);
    assert.equal(listedBody.result.profile.name, 'safe');
    assert.equal(toolNames.includes('browser_debug_resource_status'), true);
    assert.equal(toolNames.includes('browser_debug_agent_execution_list'), true);
    assert.equal(toolNames.includes('browser_debug_review'), false);
    assert.equal(toolNames.includes('browser_debug_observe'), false);

    const missingAuth = await fetch(started.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    });
    assert.equal(missingAuth.status, 401);
    assert.doesNotMatch(await missingAuth.text(), new RegExp(token));

    const invalidOrigin = await fetch(started.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Origin: 'https://example.invalid'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' })
    });
    assert.equal(invalidOrigin.status, 403);

    const getResponse = await fetch(started.url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(getResponse.status, 405);
  } finally {
    await new Promise((resolve) => started.server.close(resolve));
  }

  await assert.rejects(
    startMcpHttpServer({ profile: 'full', port: 0 }, {
      env: { [mcpHttpTokenEnv]: token }
    }),
    /safe profile/
  );
  await assert.rejects(
    startMcpHttpServer({ host: '0.0.0.0', port: 0 }, {
      env: { [mcpHttpTokenEnv]: token }
    }),
    /loopback host/
  );

  const limited = await startMcpHttpServer({ port: 0, bodyLimit: 32 }, {
    env: { [mcpHttpTokenEnv]: token }
  });
  try {
    const oversized = await fetch(limited.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/list', padding: 'x'.repeat(64) })
    });
    assert.equal(oversized.status, 413);
  } finally {
    await new Promise((resolve) => limited.server.close(resolve));
  }
});

test('daemon commands parse and return deterministic JSON envelopes', async () => {
  const started = await executeCli(
    ['daemon', 'start', '--url', 'https://example.test/', '--idle-timeout', '30s', '--max-lifetime', '2h', '--json'],
    {
      now: fixedNow,
      daemonStartRunner: async (options) => ({
        status: 'ok',
        data: {
          daemon: {
            id: 'daemon-fixed',
            status: 'running',
            current_url: options.url,
            browser: {
              ephemeral_context: true,
              existing_profile_reused: false,
              persistent_storage: false
            },
            lifecycle: {
              idle_timeout_ms: options['idle-timeout'],
              max_lifetime_ms: options['max-lifetime']
            }
          }
        },
        warnings: [],
        errors: [],
        artifacts: [{ type: 'daemon', path: '.browser-debug/daemons/daemon-fixed.json' }]
      })
    }
  );
  assert.equal(started.exitCode, 0);
  const startedBody = JSON.parse(started.stdout);
  assert.equal(startedBody.command, 'daemon start');
  assert.equal(startedBody.data.daemon.id, 'daemon-fixed');
  assert.equal(startedBody.data.daemon.browser.existing_profile_reused, false);
  assert.equal(startedBody.data.daemon.lifecycle.idle_timeout_ms, '30s');

  const statusParsed = parseCliArgs(['daemon', 'status', '--daemon', 'daemon-fixed', '--json']);
  assert.equal(statusParsed.ok, true);
  assert.equal(statusParsed.command, 'daemon status');
  assert.equal(statusParsed.options.daemon, 'daemon-fixed');

  const stopped = await executeCli(
    ['daemon', 'stop', '--daemon', 'daemon-fixed', '--json'],
    {
      now: fixedNow,
      daemonStopRunner: async (options) => ({
        status: 'ok',
        data: {
          daemon: {
            id: options.daemon,
            status: 'stopped',
            process_status: 'not_alive'
          }
        },
        warnings: [],
        errors: [],
        artifacts: [{ type: 'daemon', path: `.browser-debug/daemons/${options.daemon}.json` }]
      })
    }
  );
  assert.equal(stopped.exitCode, 0);
  assert.equal(JSON.parse(stopped.stdout).data.daemon.status, 'stopped');
});

test('session start, act, report, and spec export use local artifacts', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), `${filesystemSafeName(PRODUCT_IDENTITY.packageName)}-session-`));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');

  const context = {
    cwd,
    now: fixedNow,
    createId: (prefix) => `${prefix}-fixed`,
    observeRunner: async (options) => ({
      status: 'ok',
      data: {
        id: 'observation-fixed',
        input_url: options.url,
        final_url: options.url,
        title: 'Session Fixture',
        page: { action_candidates: [] }
      },
      warnings: [],
      errors: [],
      artifacts: [{ type: 'observation', path: '.browser-debug/observations/observation-fixed.json' }]
    })
  };

  const started = await executeCli(
    ['session', 'start', '--url', 'https://example.test/', '--json'],
    context
  );
  assert.equal(started.exitCode, 0);
  const startedBody = JSON.parse(started.stdout);
  assert.equal(startedBody.data.session.id, 'session-fixed');
  assert.equal(startedBody.data.session.current_url, 'https://example.test/');

  const acted = await executeCli(
    ['act', '--session', 'session-fixed', '--action', '{"type":"navigate","url":"https://example.test/next"}', '--json'],
    context
  );
  assert.equal(acted.exitCode, 0);
  const actedBody = JSON.parse(acted.stdout);
  assert.equal(actedBody.data.action_result.type, 'navigate');
  assert.equal(actedBody.data.session.current_url, 'https://example.test/next');

  const actedFromInput = await executeCli(
    ['act', '--session', 'session-fixed', '--input', '-', '--json'],
    { ...context, stdinText: '{"type":"observe"}' }
  );
  assert.equal(actedFromInput.exitCode, 0);
  assert.equal(JSON.parse(actedFromInput.stdout).data.action_result.type, 'observe');

  const reported = await executeCli(['report', '--session', 'session-fixed', '--json'], context);
  assert.equal(reported.exitCode, 0);
  assert.equal(JSON.parse(reported.stdout).artifacts[0].type, 'report');

  const exported = await executeCli(['spec', 'export', '--session', 'session-fixed', '--json'], context);
  assert.equal(exported.exitCode, 0);
  assert.equal(JSON.parse(exported.stdout).artifacts[0].type, 'spec');

  const report = await readFile(path.join(cwd, '.browser-debug', 'reports', 'session-fixed.md'), 'utf8');
  assert.match(report, /TraceCue Report: session-fixed/);
});

test('redaction removes common secrets and sensitive query params', () => {
  assert.equal(
    redactUrl('https://example.test/path?token=abc123456789&ok=1'),
    'https://example.test/path?token=[REDACTED]&ok=1'
  );
  assert.deepEqual(redact({ password: 'secret-value', nested: 'Bearer abcdefghijklmnop' }), {
    password: '[REDACTED]',
    nested: 'Bearer [REDACTED]'
  });
});

test('headed and devtools observe modes set Playwright launch options', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-modes-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const launches = [];
  const browserType = createFakeBrowserType(launches);

  const headed = await runObserve(
    { url: 'file:///tmp/browser-debug-headed.html', headed: true },
    { cwd, now: fixedNow, createId: () => 'observation-headed', browserType }
  );
  assert.equal(headed.status, 'ok');
  assert.deepEqual(launches[0], { headless: false, devtools: false });
  assert.equal(headed.data.browser.headless, false);
  assert.equal(headed.data.browser.devtools, false);
  assert.equal(headed.data.browser.ephemeral_context, true);

  const devtools = await runObserve(
    { url: 'file:///tmp/browser-debug-devtools.html', devtools: true },
    { cwd, now: fixedNow, createId: () => 'observation-devtools', browserType }
  );
  assert.equal(devtools.status, 'ok');
  assert.deepEqual(launches[1], { headless: false, devtools: true });
  assert.equal(devtools.data.browser.headless, false);
  assert.equal(devtools.data.browser.devtools, true);

  const observation = JSON.parse(
    await readFile(path.join(cwd, '.browser-debug', 'observations', 'observation-devtools.json'), 'utf8')
  );
  assert.equal(observation.browser.devtools, true);
});

function createFakeBrowserType(launches) {
  return {
    async launch(options) {
      launches.push(options);
      return createFakeBrowser();
    }
  };
}

function criticalResourceStatus() {
  return {
    status: 'critical',
    source: 'fixture',
    recommended_action: 'pause_browser_work_and_replan',
    memory: {
      available_bytes: 16 * 1024 * 1024,
      available_ratio: 0.01,
      swap_used_bytes: 900 * 1024 * 1024,
      swap_used_ratio: 0.95
    },
    cgroup: {
      available: true,
      current_bytes: 950 * 1024 * 1024,
      limit_bytes: 1024 * 1024 * 1024,
      usage_ratio: 0.95
    },
    pressure: {
      available: false,
      some: null,
      full: null
    },
    boundary: {
      local_only: true,
      browser_launched: false,
      system_cache_mutated: false,
      swap_mutated: false,
      cache_deleted: false
    }
  };
}

function createResourceStatusContext() {
  const files = new Map([
    ['/proc/meminfo', [
      'MemTotal:       1048576 kB',
      'MemFree:         131072 kB',
      'MemAvailable:    262144 kB',
      'Buffers:          16384 kB',
      'Cached:           65536 kB',
      'SwapCached:           0 kB',
      'Active(file):      4096 kB',
      'Inactive(file):    8192 kB',
      'Dirty:                0 kB',
      'Writeback:            0 kB',
      'KReclaimable:      8192 kB',
      'SReclaimable:      8192 kB',
      'SUnreclaim:        4096 kB',
      'SwapTotal:       524288 kB',
      'SwapFree:        393216 kB'
    ].join('\n')],
    ['/sys/fs/cgroup/memory.max', `${1024 * 1024 * 1024}\n`],
    ['/sys/fs/cgroup/memory.current', `${512 * 1024 * 1024}\n`],
    ['/sys/fs/cgroup/memory.swap.max', `${512 * 1024 * 1024}\n`],
    ['/sys/fs/cgroup/memory.swap.current', `${128 * 1024 * 1024}\n`],
    ['/proc/pressure/memory', [
      'some avg10=0.00 avg60=0.00 avg300=0.00 total=0',
      'full avg10=0.00 avg60=0.00 avg300=0.00 total=0'
    ].join('\n')]
  ]);
  return {
    readTextFile: async (filePath) => {
      if (files.has(filePath)) {
        return files.get(filePath);
      }
      const error = new Error(`missing fixture: ${filePath}`);
      error.code = 'ENOENT';
      throw error;
    },
    os: {
      totalmem: () => 2 * 1024 * 1024 * 1024,
      freemem: () => 1024 * 1024 * 1024
    },
    memoryUsage: () => ({
      rss: 64 * 1024 * 1024,
      heapTotal: 16 * 1024 * 1024,
      heapUsed: 8 * 1024 * 1024,
      external: 2 * 1024 * 1024,
      arrayBuffers: 1024 * 1024
    })
  };
}

function createFakeBrowser() {
  return {
    async newContext() {
      return {
        tracing: {
          async start() {},
          async stop() {}
        },
        async newPage() {
          return createFakePage();
        },
        async close() {}
      };
    },
    async close() {}
  };
}

function minimalPngBuffer(width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(buffer, 0);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function adapterTraceCueRequest() {
  const subAgents = [
    {
      role: 'visual_reviewer',
      display_name: 'Visual Reviewer',
      effort: 'xhigh',
      round: 1
    },
    {
      role: 'content_reviewer',
      display_name: 'Content Reviewer',
      effort: 'xhigh',
      round: 1
    },
    {
      role: 'critic_reviewer',
      display_name: 'Critic Reviewer',
      effort: 'xhigh',
      round: 2
    },
    {
      role: 'verification_reviewer',
      display_name: 'Verification Reviewer',
      effort: 'xhigh',
      round: 2
    },
    {
      role: 'synthesis_agent',
      display_name: 'Synthesis Agent',
      effort: 'xhigh',
      round: 3
    }
  ];
  return {
    schema_version: '0.1.0',
    type: 'agentic_human_review_request',
    plan: {
      id: 'adapter-plan',
      plan_hash: 'a'.repeat(64),
      plan_path_included: false,
      plan_path: '/tmp/local-plan/plan.json',
      intent: 'Review visual UX, visible text comprehension, and likely reader feeling.',
      review_effort: { mode: 'xhigh' },
      sub_agents: subAgents,
      rounds: [1, 2, 3],
      evidence_plan: {
        visual_reference_policy: {
          raw_pixel_bytes_embedded_in_json: false
        }
      }
    },
    package: {
      id: 'adapter-package',
      visual_evidence: {
        reference_count: 1,
        references: [{
          path: '.browser-debug/visual-evidence/local-image.json',
          raw_pixels_embedded_in_json: false
        }],
        raw_pixels_embedded_in_json: false
      },
      content_evidence: {
        text_snippet_count: 1,
        text_snippets: ['Visible heading and supporting copy are available for review.']
      },
      artifact_references: [{
        type: 'review',
        path: '.browser-debug/reviews/local-review.json'
      }],
      disclosure: {
        raw_pixels_embedded_in_json: false,
        raw_artifact_content_included: false,
        raw_pixel_bytes_included: false
      }
    },
    provider: {
      id: 'generic-api-provider',
      kind: 'api_provider',
      transport: 'provider_api'
    },
    model: { id: 'generic-agentic-review-model' },
    surface: { id: 'local-subscription-agent' },
    execution: {
      id: 'adapter-execution',
      execution_path_included: false,
      execution_path: '/tmp/local-plan/execution.json'
    },
    disclosure_policy: {
      approved_transfer_flags: ['allow-page-text', 'allow-raw-pixels'],
      raw_pixels_included: false,
      raw_artifact_content_included: false,
      raw_pixel_bytes_included: false,
      visual_references_included: true,
      page_text_summary_included: true,
      external_evidence_transfer: true,
      mcp_execution_allowed: false
    }
  };
}

function adapterEnv(extra = {}) {
  const tokenEnv = 'AGENTIC_HUMAN_REVIEW_API_' + 'TOKEN';
  const providerKeyEnv = 'AGENTIC_HUMAN_REVIEW_OPENAI_' + 'API_KEY';
  return {
    [tokenEnv]: 'adapter-secret-value',
    [providerKeyEnv]: 'provider-secret-value',
    AGENTIC_HUMAN_REVIEW_OPENAI_MODEL: 'review-model-for-test',
    ...extra
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: () => null
    },
    text: async () => JSON.stringify(body)
  };
}

function createFakePage() {
  let currentUrl = 'about:blank';
  return {
    on() {},
    async goto(url) {
      currentUrl = url;
      return {
        status: () => 200,
        ok: () => true,
        url: () => url
      };
    },
    async waitForLoadState() {},
    async evaluate() {
      return {
        url: currentUrl,
        title: 'Mode Fixture',
        ready_state: 'complete',
        language: 'en',
        viewport: { width: 1280, height: 720 },
        visible_text: 'Mode Fixture',
        headings: [],
        action_candidates: [],
        forms: []
      };
    },
    url() {
      return currentUrl;
    },
    async screenshot() {
      return minimalPngBuffer(1280, 720);
    }
  };
}
