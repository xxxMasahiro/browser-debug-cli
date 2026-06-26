import assert from 'node:assert/strict';
import { constants as fsConstants } from 'node:fs';
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  PRODUCT_IDENTITY,
  filesystemSafeName,
  packageInstallDirectory,
  packageBinEntries,
  packageSchemaSpecifier,
  packageTarballFilename
} from '../src/product-identity.js';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

await main();

async function main() {
  const tarballPath = process.argv[2];
  assert.ok(tarballPath, 'Usage: node tests/pack-install-smoke.test.js <packed-tarball>');
  assert.equal(path.basename(tarballPath), packageTarballFilename());
  await access(tarballPath, fsConstants.R_OK);

  const layout = await createPackedInstallLayout(tarballPath);
  try {
    const { installRoot, packageDir, binDir } = layout;

    await assertFile(packageDir, normalizePackagePath(PRODUCT_IDENTITY.cliBinPath));
    await assertFile(packageDir, normalizePackagePath(PRODUCT_IDENTITY.mcpBinPath));
    for (const binEntry of packageBinEntries()) {
      await assertFile(packageDir, normalizePackagePath(binEntry.path));
    }
    await assertFile(packageDir, 'src/api.js');
    await assertFile(packageDir, 'src/image-review.js');
    await assertFile(packageDir, 'src/capture-handoff.js');
    await assertFile(packageDir, 'src/capture-plan.js');
    await assertFile(packageDir, 'src/desktop-review-provider-preparation-plan.js');
    await assertFile(packageDir, 'src/locale-policy.js');
    await assertFile(packageDir, 'src/language-settings.js');
    await assertFile(packageDir, 'src/localization-resources.js');
    await assertFile(packageDir, 'src/release-readiness.js');
    await assertFile(packageDir, 'src/artifact-root-policy.js');
    await assertFile(packageDir, 'src/artifact-root-migration.js');
    await assertFile(packageDir, 'src/legacy-alias-audit.js');
    await assertFile(packageDir, 'src/legacy-alias-removal-readiness.js');
    await assertFile(packageDir, 'src/constrained-shell-readiness.js');
    await assertFile(packageDir, 'src/final-hardening-readiness.js');
    await assertFile(packageDir, 'src/mcp-capabilities.js');
    await assertFile(packageDir, 'src/mcp-execution-gates.js');
    await assertFile(packageDir, 'src/operation-registry.js');
    await assertFile(packageDir, 'src/operation-roadmap.js');
    await assertFile(packageDir, 'src/operation-contracts.js');
    await assertFile(packageDir, 'src/operation-policy.js');
    await assertFile(packageDir, 'src/operation-admin-readiness.js');
    await assertFile(packageDir, 'src/operation-provider-readiness.js');
    await assertFile(packageDir, 'src/mcp-client-config.js');
    await assertFile(packageDir, 'src/mcp-http-transport.js');
    await assertFile(packageDir, 'src/mcp-transport-policy.js');
    await assertFile(packageDir, 'src/product-identity.js');
    await assertFile(packageDir, 'src/mcp-profiles.js');
    await assertFile(packageDir, 'src/visual-review-provider-policy.js');
    await assertFile(packageDir, 'src/visual-review-result-preparation.js');
    await assertFile(packageDir, 'src/visual-review-execution.js');
    await assertFile(packageDir, 'src/visual-review-dashboard.js');
    await assertFile(packageDir, 'src/visual-review-aggregation.js');
    await assertFile(packageDir, 'schemas/agent-execution.schema.json');
    await assertFile(packageDir, 'schemas/capture-handoff.schema.json');
    await assertFile(packageDir, 'schemas/capture-plan.schema.json');
    await assertFile(packageDir, 'schemas/identity-audit.schema.json');
    await assertFile(packageDir, 'schemas/language-settings.schema.json');
    await assertFile(packageDir, 'schemas/localization-resources.schema.json');
    await assertFile(packageDir, 'schemas/report-templates.schema.json');
    await assertFile(packageDir, 'schemas/translation-readiness.schema.json');
    await assertFile(packageDir, 'schemas/translation-dry-run.schema.json');
    await assertFile(packageDir, 'schemas/release-readiness.schema.json');
    await assertFile(packageDir, 'schemas/artifact-root-policy.schema.json');
    await assertFile(packageDir, 'schemas/artifact-root-migration.schema.json');
    await assertFile(packageDir, 'schemas/legacy-alias-audit.schema.json');
    await assertFile(packageDir, 'schemas/legacy-alias-removal-readiness.schema.json');
    await assertFile(packageDir, 'schemas/constrained-shell-readiness.schema.json');
    await assertFile(packageDir, 'schemas/final-hardening-readiness.schema.json');
    await assertFile(packageDir, 'schemas/desktop-review-provider-preparation-plan.schema.json');
    await assertFile(packageDir, 'schemas/image-review.schema.json');
    await assertFile(packageDir, 'schemas/mcp-execution-gates.schema.json');
    await assertFile(packageDir, 'schemas/operation-registry.schema.json');
    await assertFile(packageDir, 'schemas/operation-roadmap.schema.json');
    await assertFile(packageDir, 'schemas/operation-contracts.schema.json');
    await assertFile(packageDir, 'schemas/operation-policy.schema.json');
    await assertFile(packageDir, 'schemas/operation-admin-readiness.schema.json');
    await assertFile(packageDir, 'schemas/operation-provider-readiness.schema.json');
    await assertFile(packageDir, 'schemas/visual-review-provider-policy.schema.json');
    await assertFile(packageDir, 'schemas/visual-review-result-preparation.schema.json');
    await assertFile(packageDir, 'schemas/visual-review-dashboard.schema.json');
    await assertFile(packageDir, 'schemas/visual-review-execution.schema.json');
    await assertFile(packageDir, 'schemas/visual-review-result.schema.json');
    await assertFile(packageDir, 'schemas/visual-review-aggregation.schema.json');
    await assertFile(packageDir, 'schemas/review.schema.json');
    await assertFile(packageDir, 'templates/review-target-manifest.json');
    await assertFile(packageDir, 'templates/status-dashboard-content-ux-target-manifest.json');
    await assertFile(packageDir, '.codex-plugin/plugin.json');
    await assertFile(packageDir, '.mcp.json');
    await assertFile(packageDir, PRODUCT_IDENTITY.pluginSkillPath);
    await assertFile(packageDir, 'docs/workflow/CONSUMER_USAGE.md');
    await assertFile(packageDir, 'docs/workflow/IDENTITY_MIGRATION.md');
    await assertFile(packageDir, 'docs/workflow/SECURITY.md');
    await assertFile(packageDir, 'ops/OPERATION_POLICY.json');
    await assertFile(packageDir, 'ops/ARTIFACT_ROOT_POLICY.json');
    await assert.rejects(access(path.join(packageDir, 'docs/product/IMPLEMENTATION_PLAN.md')));

    const packageJson = JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8'));
    assert.equal(packageJson.name, PRODUCT_IDENTITY.packageName);
    assert.equal(packageJson.private, true);
    assert.equal(packageJson.license, 'UNLICENSED');
    assert.equal(packageJson.bin[PRODUCT_IDENTITY.cliBinName], PRODUCT_IDENTITY.cliBinPath);
    assert.equal(packageJson.bin[PRODUCT_IDENTITY.mcpBinName], PRODUCT_IDENTITY.mcpBinPath);
    for (const binEntry of packageBinEntries()) {
      assert.equal(packageJson.bin[binEntry.name], binEntry.path);
    }

    const browserDebugBin = await readFile(path.join(packageDir, normalizePackagePath(PRODUCT_IDENTITY.cliBinPath)), 'utf8');
    const browserDebugMcpBin = await readFile(path.join(packageDir, normalizePackagePath(PRODUCT_IDENTITY.mcpBinPath)), 'utf8');
    assert.match(browserDebugBin, /from '\.\.\/src\/cli\.js'/);
    assert.match(browserDebugBin, /--capture-handoff/);
    assert.match(browserDebugMcpBin, /from '\.\.\/src\/mcp\.js'/);
    assert.match(browserDebugMcpBin, /from '\.\.\/src\/mcp-http-transport\.js'/);
    assert.equal(((await stat(path.join(packageDir, normalizePackagePath(PRODUCT_IDENTITY.cliBinPath)))).mode & 0o111) !== 0, true);
    assert.equal(((await stat(path.join(packageDir, normalizePackagePath(PRODUCT_IDENTITY.mcpBinPath)))).mode & 0o111) !== 0, true);

    const requireFromInstall = createRequire(path.join(installRoot, 'package.json'));
    const apiPath = requireFromInstall.resolve(PRODUCT_IDENTITY.packageName);
    const reviewSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('review'));
    const visualEvidenceSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('visual-evidence'));
    const captureHandoffSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('capture-handoff'));
    const capturePlanSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('capture-plan'));
    const identityAuditSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('identity-audit'));
    const languageSettingsSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('language-settings'));
    const releaseReadinessSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('release-readiness'));
    const artifactRootPolicySchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('artifact-root-policy'));
    const artifactRootMigrationSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('artifact-root-migration'));
    const legacyAliasAuditSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('legacy-alias-audit'));
    const legacyAliasRemovalReadinessSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('legacy-alias-removal-readiness'));
    const constrainedShellReadinessSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('constrained-shell-readiness'));
    const finalHardeningReadinessSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('final-hardening-readiness'));
    const desktopReviewProviderPreparationPlanSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('desktop-review-provider-preparation-plan'));
    const imageReviewSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('image-review'));
    const mcpExecutionGatesSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('mcp-execution-gates'));
    const operationRegistrySchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('operation-registry'));
    const operationRoadmapSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('operation-roadmap'));
    const operationContractsSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('operation-contracts'));
    const operationPolicySchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('operation-policy'));
    const operationAdminReadinessSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('operation-admin-readiness'));
    const operationProviderReadinessSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('operation-provider-readiness'));
    const visualReviewProviderPolicySchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('visual-review-provider-policy'));
    const visualReviewResultPreparationSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('visual-review-result-preparation'));
    const visualReviewDashboardSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('visual-review-dashboard'));
    const visualReviewExecutionSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('visual-review-execution'));
    const visualReviewResultSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('visual-review-result'));
    const visualReviewAggregationSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('visual-review-aggregation'));
    assert.equal(path.normalize(apiPath), path.join(packageDir, 'src/api.js'));
    assert.equal(path.normalize(reviewSchemaPath), path.join(packageDir, 'schemas/review.schema.json'));
    assert.equal(path.normalize(visualEvidenceSchemaPath), path.join(packageDir, 'schemas/visual-evidence.schema.json'));
    assert.equal(path.normalize(captureHandoffSchemaPath), path.join(packageDir, 'schemas/capture-handoff.schema.json'));
    assert.equal(path.normalize(capturePlanSchemaPath), path.join(packageDir, 'schemas/capture-plan.schema.json'));
    assert.equal(path.normalize(identityAuditSchemaPath), path.join(packageDir, 'schemas/identity-audit.schema.json'));
    assert.equal(path.normalize(languageSettingsSchemaPath), path.join(packageDir, 'schemas/language-settings.schema.json'));
    assert.equal(path.normalize(releaseReadinessSchemaPath), path.join(packageDir, 'schemas/release-readiness.schema.json'));
    assert.equal(path.normalize(artifactRootPolicySchemaPath), path.join(packageDir, 'schemas/artifact-root-policy.schema.json'));
    assert.equal(path.normalize(artifactRootMigrationSchemaPath), path.join(packageDir, 'schemas/artifact-root-migration.schema.json'));
    assert.equal(path.normalize(legacyAliasAuditSchemaPath), path.join(packageDir, 'schemas/legacy-alias-audit.schema.json'));
    assert.equal(path.normalize(legacyAliasRemovalReadinessSchemaPath), path.join(packageDir, 'schemas/legacy-alias-removal-readiness.schema.json'));
    assert.equal(path.normalize(constrainedShellReadinessSchemaPath), path.join(packageDir, 'schemas/constrained-shell-readiness.schema.json'));
    assert.equal(path.normalize(finalHardeningReadinessSchemaPath), path.join(packageDir, 'schemas/final-hardening-readiness.schema.json'));
    assert.equal(path.normalize(desktopReviewProviderPreparationPlanSchemaPath), path.join(packageDir, 'schemas/desktop-review-provider-preparation-plan.schema.json'));
    assert.equal(path.normalize(imageReviewSchemaPath), path.join(packageDir, 'schemas/image-review.schema.json'));
    assert.equal(path.normalize(mcpExecutionGatesSchemaPath), path.join(packageDir, 'schemas/mcp-execution-gates.schema.json'));
    assert.equal(path.normalize(operationRegistrySchemaPath), path.join(packageDir, 'schemas/operation-registry.schema.json'));
    assert.equal(path.normalize(operationRoadmapSchemaPath), path.join(packageDir, 'schemas/operation-roadmap.schema.json'));
    assert.equal(path.normalize(operationContractsSchemaPath), path.join(packageDir, 'schemas/operation-contracts.schema.json'));
    assert.equal(path.normalize(operationPolicySchemaPath), path.join(packageDir, 'schemas/operation-policy.schema.json'));
    assert.equal(path.normalize(operationAdminReadinessSchemaPath), path.join(packageDir, 'schemas/operation-admin-readiness.schema.json'));
    assert.equal(path.normalize(operationProviderReadinessSchemaPath), path.join(packageDir, 'schemas/operation-provider-readiness.schema.json'));
    assert.equal(path.normalize(visualReviewProviderPolicySchemaPath), path.join(packageDir, 'schemas/visual-review-provider-policy.schema.json'));
    assert.equal(path.normalize(visualReviewResultPreparationSchemaPath), path.join(packageDir, 'schemas/visual-review-result-preparation.schema.json'));
    assert.equal(path.normalize(visualReviewDashboardSchemaPath), path.join(packageDir, 'schemas/visual-review-dashboard.schema.json'));
    assert.equal(path.normalize(visualReviewExecutionSchemaPath), path.join(packageDir, 'schemas/visual-review-execution.schema.json'));
    assert.equal(path.normalize(visualReviewResultSchemaPath), path.join(packageDir, 'schemas/visual-review-result.schema.json'));
    assert.equal(path.normalize(visualReviewAggregationSchemaPath), path.join(packageDir, 'schemas/visual-review-aggregation.schema.json'));

    const api = await import(pathToFileURL(apiPath));
    assert.equal(typeof api.executeCli, 'function');
    assert.equal(typeof api.runImageReview, 'function');
    assert.equal(typeof api.runTargetValidate, 'function');
    assert.equal(api.PRODUCT_IDENTITY.packageName, PRODUCT_IDENTITY.packageName);
    assert.equal(api.PRODUCT_IDENTITY.cliBinName, PRODUCT_IDENTITY.cliBinName);
    assert.equal(typeof api.packageBinEntries, 'function');
    assert.equal(typeof api.filesystemSafeName, 'function');
    assert.equal(typeof api.packageTarballFilename, 'function');
    assert.equal(typeof api.getMcpTools, 'function');
    assert.equal(typeof api.getMcpToolsByTag, 'function');
    assert.equal(typeof api.resolveMcpProfile, 'function');
    assert.equal(typeof api.startMcpHttpServer, 'function');
    assert.equal(typeof api.runCaptureHandoff, 'function');
    assert.equal(typeof api.runIdentityAudit, 'function');
    assert.equal(typeof api.normalizeRepositoryUrl, 'function');
    assert.equal(typeof api.normalizeTraceCueLocale, 'function');
    assert.equal(api.normalizeTraceCueLocale('zh-Hant'), 'zh-TW');
    assert.equal(Array.isArray(api.TRACE_CUE_LOCALE_CODES), true);
    assert.equal(api.TRACE_CUE_LOCALE_CODES.length, 14);
    assert.equal(typeof api.runLanguageSettings, 'function');
    assert.equal(typeof api.runLanguageSettingsPolicy, 'function');
    assert.equal(typeof api.normalizeLanguageSettings, 'function');
    assert.equal(typeof api.runReleaseReadiness, 'function');
    assert.equal(typeof api.releaseReadinessBoundary, 'function');
    assert.equal(typeof api.runArtifactRootStatus, 'function');
    assert.equal(typeof api.buildArtifactRootMigrationPlan, 'function');
    assert.equal(typeof api.runArtifactRootMigrationExecute, 'function');
    assert.equal(typeof api.runLegacyAliasAudit, 'function');
    assert.equal(typeof api.legacyAliasWarningsForInvocation, 'function');
    assert.equal(typeof api.legacyAliasSurfaces, 'function');
    assert.equal(api.releaseReadinessBoundary().npm_publish_performed, false);
    assert.equal(api.artifactRootBoundary().real_workspace_migration_executed, false);
    assert.equal(api.legacyAliasAuditBoundary().legacy_alias_removed, false);
    assert.equal(
      api.normalizeLanguageSettings({ ui_locale: 'ar', profiles: { reports: { language: { output_language_mode: 'ui' } } } }).artifact_output.text_direction,
      'rtl'
    );
    assert.equal(api.normalizeRepositoryUrl('git@github.com:xxxMasahiro/browser-debug-cli.git'), 'github.com/xxxMasahiro/browser-debug-cli');
    assert.equal(api.CAPTURE_HANDOFF_VERSION, '1.0.0');
    assert.equal(Array.isArray(api.CAPTURE_HANDOFF_SOURCE_KINDS), true);
    assert.equal(api.CAPTURE_HANDOFF_SOURCE_KINDS.includes('desktop_app_capture'), true);
    assert.equal(typeof api.normalizeCaptureHandoffContract, 'function');
    assert.equal(typeof api.readCaptureHandoffJsonInput, 'function');
    assert.equal(Array.isArray(api.IMAGE_REVIEW_SOURCE_IDS), true);
    assert.equal(api.IMAGE_REVIEW_SOURCE_IDS.includes('desktop-app'), true);
    assert.equal(api.normalizeImageReviewSource('desktop-app').source_kind, 'desktop_app_capture');
    assert.equal(typeof api.buildCapturePlan, 'function');
    assert.equal(api.CAPTURE_PLAN_VERSION, '1.0.0');
    assert.equal(typeof api.buildDesktopReviewProviderPreparationPlan, 'function');
    assert.equal(api.DESKTOP_REVIEW_PROVIDER_PREPARATION_PLAN_VERSION, '1.0.0');
    assert.equal(typeof api.desktopReviewProviderPreparationPlanBoundary, 'function');
    assert.equal(typeof api.buildMcpCapabilityReport, 'function');
    assert.equal(api.MCP_CAPABILITY_POLICY_VERSION, '1.0.0');
    assert.equal(typeof api.buildMcpExecutionGateReport, 'function');
    assert.equal(api.MCP_EXECUTION_GATE_POLICY_VERSION, '1.0.0');
    assert.equal(typeof api.buildMcpClientConfig, 'function');
    assert.equal(typeof api.resolveMcpTransportConfig, 'function');
    assert.equal(typeof api.createVisualEvidenceRecord, 'function');
    assert.equal(typeof api.writeVisualEvidenceRecord, 'function');
    assert.equal(typeof api.buildVisualReviewProviderPolicy, 'function');
    assert.equal(typeof api.visualReviewProviderBoundary, 'function');
    assert.equal(typeof api.runVisualReviewResultPreparation, 'function');
    assert.equal(typeof api.visualReviewResultPreparationBoundary, 'function');
    assert.equal(typeof api.runVisualReviewExecutionRun, 'function');
    assert.equal(typeof api.visualReviewExecutionBoundary, 'function');
    assert.equal(typeof api.runVisualReviewDashboard, 'function');
    assert.equal(typeof api.visualReviewDashboardBoundary, 'function');
    assert.equal(typeof api.runVisualReviewAggregation, 'function');
    assert.equal(typeof api.visualReviewAggregationBoundary, 'function');
    assert.equal(typeof api.buildOperationRegistryReport, 'function');
    assert.equal(typeof api.operationRegistryBoundary, 'function');
    assert.equal(typeof api.buildOperationRoadmapReport, 'function');
    assert.equal(typeof api.operationRoadmapBoundary, 'function');
    assert.equal(typeof api.buildOperationContractsReport, 'function');
    assert.equal(typeof api.operationContractsBoundary, 'function');
    assert.equal(typeof api.buildOperationPolicyReport, 'function');
    assert.equal(typeof api.operationPolicyBoundary, 'function');
    assert.equal(typeof api.buildOperationAdminReadinessReport, 'function');
    assert.equal(typeof api.operationAdminReadinessBoundary, 'function');
    assert.equal(typeof api.buildOperationProviderReadinessReport, 'function');
    assert.equal(typeof api.operationProviderReadinessBoundary, 'function');
    assert.equal(typeof api.buildLocalizationResources, 'function');
    assert.equal(typeof api.buildReportTemplates, 'function');
    assert.equal(typeof api.buildTranslationReadiness, 'function');
    assert.equal(typeof api.buildTranslationDryRun, 'function');
    assert.equal(typeof api.translationBoundary, 'function');
    assert.equal(typeof api.buildLegacyAliasRemovalReadiness, 'function');
    assert.equal(typeof api.legacyAliasRemovalReadinessBoundary, 'function');
    assert.equal(typeof api.buildConstrainedShellReadiness, 'function');
    assert.equal(typeof api.constrainedShellBoundary, 'function');
    assert.equal(typeof api.buildFinalHardeningReadiness, 'function');
    assert.equal(typeof api.finalHardeningBoundary, 'function');
    assert.equal(api.schemaNames().includes('agent_execution'), true);
    assert.equal(api.schemaNames().includes('capture_handoff'), true);
    assert.equal(api.schemaNames().includes('capture_plan'), true);
    assert.equal(api.schemaNames().includes('capture_readiness'), true);
    assert.equal(api.schemaNames().includes('capture_artifact'), true);
    assert.equal(api.schemaNames().includes('capture_receipt'), true);
    assert.equal(api.schemaNames().includes('identity_audit'), true);
    assert.equal(api.schemaNames().includes('language_settings'), true);
    assert.equal(api.schemaNames().includes('localization_resources'), true);
    assert.equal(api.schemaNames().includes('report_templates'), true);
    assert.equal(api.schemaNames().includes('translation_readiness'), true);
    assert.equal(api.schemaNames().includes('translation_dry_run'), true);
    assert.equal(api.schemaNames().includes('release_readiness'), true);
    assert.equal(api.schemaNames().includes('artifact_root_policy'), true);
    assert.equal(api.schemaNames().includes('artifact_root_migration'), true);
    assert.equal(api.schemaNames().includes('legacy_alias_audit'), true);
    assert.equal(api.schemaNames().includes('legacy_alias_removal_readiness'), true);
    assert.equal(api.schemaNames().includes('constrained_shell_readiness'), true);
    assert.equal(api.schemaNames().includes('final_hardening_readiness'), true);
    assert.equal(api.schemaNames().includes('desktop_review_provider_preparation_plan'), true);
    assert.equal(api.schemaNames().includes('image_review'), true);
    assert.equal(api.schemaNames().includes('mcp_execution_gates'), true);
    assert.equal(api.schemaNames().includes('operation_registry'), true);
    assert.equal(api.schemaNames().includes('operation_roadmap'), true);
    assert.equal(api.schemaNames().includes('operation_contracts'), true);
    assert.equal(api.schemaNames().includes('operation_policy'), true);
    assert.equal(api.schemaNames().includes('operation_admin_readiness'), true);
    assert.equal(api.schemaNames().includes('operation_provider_readiness'), true);
    assert.equal(api.schemaNames().includes('visual_evidence'), true);
    assert.equal(api.schemaNames().includes('visual_review_provider_policy'), true);
    assert.equal(api.schemaNames().includes('visual_review_result_preparation'), true);
    assert.equal(api.schemaNames().includes('visual_review_dashboard'), true);
    assert.equal(api.schemaNames().includes('visual_review_execution'), true);
    assert.equal(api.schemaNames().includes('visual_review_result'), true);
    assert.equal(api.schemaNames().includes('visual_review_aggregation'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_visual_review_dashboard'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_language_settings'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_localization_resources'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_report_templates'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_translation_readiness'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_release_readiness'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_artifact_root_status'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_legacy_alias_audit'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_legacy_alias_removal_readiness'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_shell_readiness'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_final_readiness'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => /shell.*(?:run|execute|command)/i.test(tool.name)), false);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_capture_readiness'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_capture_plan'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_capture_handoff'), false);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_visual_review_plan'), false);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_visual_review_aggregate'), false);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_mcp_execution_gates'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_operation_registry'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_operation_roadmap'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_operation_contracts'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_operation_policy'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_operation_admin_readiness'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_operation_provider_readiness'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.tags.includes(api.MCP_TOOL_TAGS.PROVIDER_STATUS_LIST_READ)), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_review_target'), true);
    assert.equal(api.DEFAULT_MCP_PROFILE, 'full');
    assert.equal(api.MCP_HTTP_DEFAULT_PROFILE, 'safe');
    assert.equal(api.MCP_HTTP_DEFAULT_CLIENT_PORT, 8765);
    assert.equal(api.resolveMcpTransportConfig({ transport: 'http', profile: 'full' }, {}, { requireToken: false }).ok, false);
    const installedMcpBinPath = path.resolve(packageDir, PRODUCT_IDENTITY.mcpBinPath);
    const stdioClientConfig = api.buildMcpClientConfig({ profile: 'safe' });
    assert.equal(stdioClientConfig.ok, true);
    assert.equal(stdioClientConfig.config.local_checkout.launch.command, process.execPath);
    assert.deepEqual(stdioClientConfig.config.local_checkout.launch.args, [installedMcpBinPath, '--profile', 'safe']);
    assert.equal(stdioClientConfig.config.local_checkout.mcpServers[PRODUCT_IDENTITY.mcpServerName].command, process.execPath);
    const httpClientConfig = api.buildMcpClientConfig({ transport: 'http' });
    assert.equal(httpClientConfig.ok, true);
    assert.equal(httpClientConfig.config.client_connection.url, 'http://127.0.0.1:8765/mcp');
    assert.equal(httpClientConfig.config.local_checkout.launch.command, process.execPath);
    assert.equal(httpClientConfig.config.local_checkout.launch.args[0], installedMcpBinPath);
    assert.equal(httpClientConfig.config.local_checkout.client_connection.url, 'http://127.0.0.1:8765/mcp');
    const mcpHttpTokenEnv = 'TRACE_CUE_MCP_HTTP_TOKEN';
    assert.equal(httpClientConfig.config.launch.env[mcpHttpTokenEnv], '<set-16-or-more-character-token>');
    assert.equal(httpClientConfig.config.local_checkout.launch.env[mcpHttpTokenEnv], '<set-16-or-more-character-token>');
    assert.equal(JSON.stringify(httpClientConfig).includes('secret'), false);
    assert.equal(api.resolveMcpProfile('safe').ok, true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_visual_review_dashboard'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_language_settings'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_localization_resources'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_report_templates'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_translation_readiness'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_capture_readiness'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_capture_plan'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_capture_handoff'), false);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_visual_review_plan'), false);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_visual_review_aggregate'), false);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_mcp_execution_gates'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_mcp_capabilities'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_operation_registry'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_operation_roadmap'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_operation_contracts'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_operation_policy'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_operation_admin_readiness'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_operation_provider_readiness'), true);
    assert.equal(api.getMcpToolsByTag('safe', api.MCP_TOOL_TAGS.PROVIDER_STATUS_LIST_READ).length >= 2, true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_review'), false);
    assert.equal(api.getMcpTools('full').some((tool) => tool.name === 'browser_debug_review'), true);
    const capabilityReport = api.buildMcpCapabilityReport({ profile: 'admin', scope: 'excluded' });
    assert.equal(capabilityReport.ok, true);
    assert.equal(api.getMcpTools('admin').some((tool) => tool.name === 'browser_debug_agent_execution_plan'), true);
    assert.equal(api.getMcpTools('admin').some((tool) => tool.name === 'browser_debug_agent_execution_run'), true);
    assert.equal(api.getMcpTools('full').some((tool) => tool.name === 'browser_debug_agent_execution_run'), false);
    assert.equal(capabilityReport.report.admin_policy.write_execute_tools_exposed, true);
    assert.equal(capabilityReport.report.excluded_operations.some((operation) => operation.id === 'agent_execution_run'), false);
    assert.equal(capabilityReport.report.excluded_operations.some((operation) => operation.id === 'provider_api_execution'), false);
    assert.equal(capabilityReport.report.excluded_operations.some((operation) => operation.id === 'visual_provider_execution'), true);
    assert.equal(capabilityReport.report.excluded_operations.some((operation) => operation.id === 'visual_review_run'), true);
    assert.equal(capabilityReport.report.excluded_operations.some((operation) => operation.id === 'visual_review_result_preparation'), true);
    assert.equal(capabilityReport.report.excluded_operations.some((operation) => operation.id === 'visual_review_aggregation'), true);
    assert.equal(capabilityReport.report.excluded_operations.some((operation) => operation.id === 'desktop_review_provider_preparation_plan'), true);
    assert.equal(capabilityReport.report.excluded_operations.some((operation) => operation.id === 'translation_mcp_admin_execute'), true);
    assert.equal(capabilityReport.report.excluded_operations.some((operation) => operation.id === 'npm_publish'), true);
    assert.equal(capabilityReport.report.excluded_operations.some((operation) => operation.id === 'legacy_alias_removal'), true);
    assert.equal(capabilityReport.report.boundaries.raw_image_transfer, false);
    assert.equal(capabilityReport.report.excluded_operations.every((operation) => operation.mcp_admin === false), true);

    const operationRegistry = api.buildOperationRegistryReport({ group: 'localization' });
    assert.equal(operationRegistry.ok, true);
    assert.equal(operationRegistry.report.boundary.mcp_write_execute_exposed, false);
    assert.equal(operationRegistry.report.operations.some((operation) => operation.id === 'translation_mcp_admin_execute'), true);
    const operationRoadmap = api.buildOperationRoadmapReport({ phase: '155' });
    assert.equal(operationRoadmap.ok, true);
    assert.equal(operationRoadmap.report.phases[0].implementation.live_execution_performed, false);
    assert.equal(operationRoadmap.report.boundary.draft_roadmap_promoted_to_product_plan, false);
    const operationContracts = api.buildOperationContractsReport({ scope: 'token_contract' });
    assert.equal(operationContracts.ok, true);
    assert.equal(operationContracts.report.contracts[0].id, 'token_contract');
    assert.equal(operationContracts.report.boundary.execution_tokens_issued, false);
    await mkdir(path.join(installRoot, '.browser-debug', 'screenshots'), { recursive: true });
    await writeFile(path.join(installRoot, '.browser-debug', 'screenshots', 'packed-large.txt'), 'packed artifact', 'utf8');
    const resourcePlan = await api.executeCli(['resource', 'artifacts', 'plan', '--max-bytes', '1', '--json'], {
      cwd: installRoot,
      now: '2026-06-26T00:00:00.000Z'
    });
    assert.equal(resourcePlan.exitCode, 0);
    const resourcePlanBody = JSON.parse(resourcePlan.stdout);
    assert.match(resourcePlanBody.data.cleanup_proposal.plan_hash, /^[a-f0-9]{64}$/);
    assert.equal(resourcePlanBody.data.cleanup_proposal.policy.candidate_lock_algorithm, 'sha256:path-size-mtime-content');
    const operationPolicy = api.buildOperationPolicyReport({ scope: 'harness_readiness' }, { cwd: installRoot });
    assert.equal(operationPolicy.ok, true);
    assert.equal(operationPolicy.report.readiness[0].id, 'harness_readiness');
    assert.equal(operationPolicy.report.boundary.execution_harness_enabled, false);
    const operationAdminReadiness = api.buildOperationAdminReadinessReport({ scope: 'mcp_admin_token_flow' }, { cwd: installRoot });
    assert.equal(operationAdminReadiness.ok, true);
    assert.equal(operationAdminReadiness.report.readiness[0].id, 'mcp_admin_token_flow');
    assert.equal(operationAdminReadiness.report.boundary.execution_tokens_issued, false);
    const operationProviderReadiness = api.buildOperationProviderReadinessReport({ scope: 'env_credential_guard' }, { cwd: installRoot });
    assert.equal(operationProviderReadiness.ok, true);
    assert.equal(operationProviderReadiness.report.readiness[0].id, 'env_credential_guard');
    assert.equal(operationProviderReadiness.report.boundary.credential_values_read, false);

    const initialized = await api.handleMcpRequest(
      { jsonrpc: '2.0', id: 0, method: 'initialize' },
      { cwd: installRoot }
    );
    assert.equal(initialized.result.serverInfo.name, PRODUCT_IDENTITY.mcpServerName);
    assert.equal(initialized.result.metadata.name, 'full');
    assert.equal(initialized.result.metadata.identity.package_name, PRODUCT_IDENTITY.packageName);
    assert.equal(initialized.result.metadata.identity.package_version, PRODUCT_IDENTITY.packageVersion);
    assert.equal(initialized.result.metadata.identity.cli_bin_name, PRODUCT_IDENTITY.cliBinName);

    const httpToken = 'pack-smoke-token';
    const resolvedHttp = api.resolveMcpTransportConfig(
      { transport: 'http', port: 8765 },
      { [mcpHttpTokenEnv]: httpToken }
    );
    assert.equal(resolvedHttp.ok, true);
    const httpServer = api.createMcpHttpServer(resolvedHttp.config, {
      cwd: installRoot,
      env: { [mcpHttpTokenEnv]: httpToken }
    });
    const initializedHttp = await dispatchHttpRequest(httpServer, {
      method: 'POST',
      url: '/mcp',
      headers: {
        host: '127.0.0.1:8765',
        'content-type': 'application/json',
        authorization: `Bearer ${httpToken}`,
        origin: 'http://127.0.0.1'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'initialize' })
    });
    assert.equal(initializedHttp.status, 200);
    assert.equal(initializedHttp.headers['MCP-Protocol-Version'], '2025-06-18');
    const initializedHttpBody = JSON.parse(initializedHttp.text);
    assert.equal(initializedHttpBody.result.serverInfo.name, PRODUCT_IDENTITY.mcpServerName);
    assert.equal(initializedHttpBody.result.metadata.profile.name, 'safe');
    assert.equal(initializedHttpBody.result.metadata.identity.cli_bin_name, PRODUCT_IDENTITY.cliBinName);

    const doctor = await api.executeCli(['doctor', '--json'], { cwd: installRoot });
    assert.equal(doctor.exitCode, 0);
    const doctorBody = JSON.parse(doctor.stdout);
    assert.equal(doctorBody.command, 'doctor');
    assert.equal(doctorBody.status, 'ok');
    assert.equal(doctorBody.data.checks.find((check) => check.id === 'artifact_root.ignored').status, 'pass');
    assert.equal(doctorBody.data.checks.find((check) => check.id === 'playwright.package').status, 'pass');

    const schemaList = await api.executeCli(['schema', 'list', '--json'], { cwd: installRoot });
    assert.equal(schemaList.exitCode, 0);
    const schemaBody = JSON.parse(schemaList.stdout);
    const schemaNames = schemaBody.data.schemas.map((schema) => schema.name);
    assert.ok(schemaNames.includes('review'));
    assert.ok(schemaNames.includes('target_manifest'));
    assert.ok(schemaNames.includes('agent_execution'));
    assert.ok(schemaNames.includes('capture_handoff'));
    assert.ok(schemaNames.includes('capture_plan'));
    assert.ok(schemaNames.includes('capture_readiness'));
    assert.ok(schemaNames.includes('capture_artifact'));
    assert.ok(schemaNames.includes('capture_receipt'));
    assert.ok(schemaNames.includes('language_settings'));
    assert.ok(schemaNames.includes('localization_resources'));
    assert.ok(schemaNames.includes('report_templates'));
    assert.ok(schemaNames.includes('translation_readiness'));
    assert.ok(schemaNames.includes('translation_dry_run'));
    assert.ok(schemaNames.includes('release_readiness'));
    assert.ok(schemaNames.includes('artifact_root_policy'));
    assert.ok(schemaNames.includes('artifact_root_migration'));
    assert.ok(schemaNames.includes('legacy_alias_audit'));
    assert.ok(schemaNames.includes('legacy_alias_removal_readiness'));
    assert.ok(schemaNames.includes('constrained_shell_readiness'));
    assert.ok(schemaNames.includes('final_hardening_readiness'));
    assert.ok(schemaNames.includes('desktop_review_provider_preparation_plan'));
    assert.ok(schemaNames.includes('image_review'));
    assert.ok(schemaNames.includes('mcp_execution_gates'));
    assert.ok(schemaNames.includes('operation_registry'));
    assert.ok(schemaNames.includes('operation_roadmap'));
    assert.ok(schemaNames.includes('operation_contracts'));
    assert.ok(schemaNames.includes('operation_policy'));
    assert.ok(schemaNames.includes('operation_admin_readiness'));
    assert.ok(schemaNames.includes('operation_provider_readiness'));
    assert.ok(schemaNames.includes('visual_evidence'));
    assert.ok(schemaNames.includes('visual_review_provider_policy'));
    assert.ok(schemaNames.includes('visual_review_result_preparation'));
    assert.ok(schemaNames.includes('visual_review_dashboard'));
    assert.ok(schemaNames.includes('visual_review_execution'));
    assert.ok(schemaNames.includes('visual_review_result'));
    assert.ok(schemaNames.includes('visual_review_aggregation'));

    const targetPath = path.join(installRoot, 'target.json');
    await writeFile(targetPath, JSON.stringify(targetManifestFixture(), null, 2), 'utf8');
    const validate = await api.executeCli(
      ['target', 'validate', '--target', 'target.json', '--json'],
      { cwd: installRoot }
    );
    assert.equal(validate.exitCode, 0);
    const validateBody = JSON.parse(validate.stdout);
    assert.equal(validateBody.command, 'target validate');
    assert.equal(validateBody.status, 'ok');
    assert.equal(validateBody.data.boundary.browser_launched, false);
    assert.equal(validateBody.data.boundary.external_upload, false);

    const mcpBody = await api.handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { cwd: installRoot });
    assert.equal(mcpBody.result.profile.name, 'full');
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_target_validate'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_agent_requests_list'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_agent_workflow_status'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_agent_execution_status'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_language_settings'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_release_readiness'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_artifact_root_status'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_legacy_alias_audit'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_operation_registry'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_operation_roadmap'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_operation_contracts'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_operation_policy'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_operation_admin_readiness'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_operation_provider_readiness'), true);
    assert.equal(mcpBody.result.tools.some((tool) => /agent_execution_plan|agent_execution_run|cleanup_execute|provider_execute/i.test(tool.name)), false);

    const safeMcpBody = await api.handleMcpRequest(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { cwd: installRoot, mcpProfile: 'safe' }
    );
    assert.equal(safeMcpBody.result.profile.name, 'safe');
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_target_validate'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_agent_requests_show'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_agent_execution_list'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_mcp_capabilities'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_language_settings'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_release_readiness'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_artifact_root_status'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_legacy_alias_audit'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_operation_registry'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_operation_roadmap'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_operation_contracts'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_operation_policy'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => /agent_execution_plan|agent_execution_run|cleanup_execute|provider_execute/i.test(tool.name)), false);
    const adminMcpBody = await api.handleMcpRequest(
      { jsonrpc: '2.0', id: 21, method: 'tools/list' },
      { cwd: installRoot, mcpProfile: 'admin' }
    );
    assert.equal(adminMcpBody.result.profile.name, 'admin');
    assert.equal(adminMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_agent_execution_plan'), true);
    assert.equal(adminMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_agent_execution_run'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_operation_admin_readiness'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_operation_provider_readiness'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_review_target'), false);

    const contractsCli = await api.executeCli(
      ['operation', 'contracts', '--scope', 'receipt_contract', '--json'],
      { cwd: installRoot }
    );
    assert.equal(contractsCli.exitCode, 0);
    const contractsCliBody = JSON.parse(contractsCli.stdout);
    assert.equal(contractsCliBody.data.operation_contracts.contracts[0].id, 'receipt_contract');
    assert.equal(contractsCliBody.data.operation_contracts.boundary.receipt_writer_enabled, false);

    const policyCli = await api.executeCli(
      ['operation', 'policy', '--scope', 'mcp_readiness', '--json'],
      { cwd: installRoot }
    );
    assert.equal(policyCli.exitCode, 0);
    const policyCliBody = JSON.parse(policyCli.stdout);
    assert.equal(policyCliBody.data.operation_policy.readiness[0].id, 'mcp_readiness');
    assert.equal(policyCliBody.data.operation_policy.boundary.mcp_admin_execution_enabled, true);
    assert.equal(policyCliBody.data.operation_policy.boundary.execution_harness_enabled, false);
    assert.equal(policyCliBody.data.operation_policy.boundary.mcp_write_execute_exposed, true);

    const adminReadinessCli = await api.executeCli(
      ['operation', 'admin-readiness', '--scope', 'mcp_admin_harness_bridge', '--json'],
      { cwd: installRoot }
    );
    assert.equal(adminReadinessCli.exitCode, 0);
    const adminReadinessCliBody = JSON.parse(adminReadinessCli.stdout);
    assert.equal(adminReadinessCliBody.data.operation_admin_readiness.readiness[0].id, 'mcp_admin_harness_bridge');
    assert.equal(adminReadinessCliBody.data.operation_admin_readiness.boundary.mcp_admin_harness_enabled, false);
    assert.equal(adminReadinessCliBody.data.operation_admin_readiness.boundary.mcp_admin_execute_calls_enabled, true);
    assert.equal(adminReadinessCliBody.data.operation_admin_readiness.boundary.mcp_write_execute_exposed, true);

    const providerReadinessCli = await api.executeCli(
      ['operation', 'provider-readiness', '--scope', 'provider_mcp_status_list', '--operation', 'provider_api_execution', '--json'],
      { cwd: installRoot }
    );
    assert.equal(providerReadinessCli.exitCode, 0);
    const providerReadinessCliBody = JSON.parse(providerReadinessCli.stdout);
    assert.equal(providerReadinessCliBody.data.operation_provider_readiness.operation_selection, 'provider_mcp_api_execute');
    assert.equal(providerReadinessCliBody.data.operation_provider_readiness.readiness[0].id, 'provider_mcp_status_list');
    assert.equal(providerReadinessCliBody.data.operation_provider_readiness.status_list_contract.status_tool_available, true);
    assert.equal(providerReadinessCliBody.data.operation_provider_readiness.status_list_contract.list_tool_available, true);
    assert.equal(providerReadinessCliBody.data.operation_provider_readiness.boundary.provider_mcp_execution_enabled, true);
    assert.equal(providerReadinessCliBody.data.operation_provider_readiness.boundary.mcp_write_execute_exposed, true);
    assert.equal(providerReadinessCliBody.data.operation_provider_readiness.boundary.provider_call_performed, false);

    const capabilityCli = await api.executeCli(
      ['mcp', 'capabilities', '--profile', 'admin', '--scope', 'excluded', '--json'],
      { cwd: installRoot }
    );
    assert.equal(capabilityCli.exitCode, 0);
    const capabilityCliBody = JSON.parse(capabilityCli.stdout);
    assert.equal(capabilityCliBody.data.capabilities.admin_policy.agent_execution_run_exposed, true);
    assert.equal(capabilityCliBody.data.capabilities.excluded_operations.some((operation) => operation.id === 'agent_execution_run'), false);
    assert.equal(capabilityCliBody.data.capabilities.excluded_operations.some((operation) => operation.id === 'resource_artifacts_cleanup_execute'), true);
    assert.equal(capabilityCliBody.data.capabilities.excluded_operations.some((operation) => operation.id === 'constrained_shell_mcp_execute'), true);

    const capabilityTool = await api.handleMcpRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'browser_debug_mcp_capabilities',
        arguments: { profile: 'admin', scope: 'excluded' }
      }
    }, { cwd: installRoot, mcpProfile: 'safe' });
    assert.equal(capabilityTool.result.structuredContent.command, 'mcp capabilities');
    assert.equal(capabilityTool.result.structuredContent.data.capabilities.admin_policy.write_execute_tools_exposed, true);

    const binLink = await lstat(path.join(binDir, PRODUCT_IDENTITY.cliBinName));
    assert.equal(binLink.isSymbolicLink(), true);
    for (const binEntry of packageBinEntries()) {
      const linked = await lstat(path.join(binDir, binEntry.name));
      assert.equal(linked.isSymbolicLink(), true);
    }
    console.log('Packed install smoke passed.');
  } finally {
    if (process.env[PRODUCT_IDENTITY.packSmokeKeepEnv] !== '1') {
      await rm(layout.tempRoot, { recursive: true, force: true });
    }
  }
}

async function createPackedInstallLayout(tarballPath) {
  const tempRoot = await mkdtemp(path.join(tmpdir(), `${filesystemSafeName(PRODUCT_IDENTITY.packageName)}-pack-install-`));
  const installRoot = path.join(tempRoot, 'install');
  const nodeModules = path.join(installRoot, 'node_modules');
  const packageDir = packageInstallDirectory(nodeModules);
  const binDir = path.join(nodeModules, '.bin');

  await mkdir(packageDir, { recursive: true });
  await mkdir(binDir, { recursive: true });
  await writeFile(path.join(installRoot, 'package.json'), '{"type":"module"}\n', 'utf8');
  await writeFile(path.join(installRoot, '.gitignore'), '.browser-debug/\n', 'utf8');
  await extractPackageTarball(tarballPath, packageDir);
  await linkDependency(nodeModules, 'playwright');
  await linkDependency(nodeModules, 'playwright-core');
  for (const binEntry of packageBinEntries()) {
    await linkBin(binDir, binEntry.name, path.join(packageDir, normalizePackagePath(binEntry.path)));
  }

  return { tempRoot, installRoot, packageDir, binDir };
}

function dispatchHttpRequest(server, { method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    const request = new PassThrough();
    request.method = method;
    request.url = url;
    request.headers = headers;
    const response = {
      status: 200,
      headers: {},
      writeHead(status, responseHeaders) {
        this.status = status;
        this.headers = { ...responseHeaders };
      },
      end(chunk = '') {
        resolve({
          status: this.status,
          headers: this.headers,
          text: String(chunk)
        });
      }
    };
    server.once('error', reject);
    server.emit('request', request, response);
    request.end(body);
  });
}

async function extractPackageTarball(tarballPath, outputDir) {
  const archive = gunzipSync(await readFile(tarballPath));
  let offset = 0;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const fullName = [prefix, name].filter(Boolean).join('/');
    const type = readTarString(header, 156, 1) || '0';
    const size = Number.parseInt(readTarString(header, 124, 12).trim() || '0', 8);
    const mode = Number.parseInt(readTarString(header, 100, 8).trim() || '644', 8);
    const relative = fullName.replace(/^package\/?/, '');
    offset += 512;
    if (relative && isSafeRelativePath(relative)) {
      const target = path.join(outputDir, relative);
      if (type === '5') {
        await mkdir(target, { recursive: true });
      } else if (type === '0' || type === '') {
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, archive.subarray(offset, offset + size));
        await chmod(target, mode);
      }
    }
    offset += Math.ceil(size / 512) * 512;
  }
}

function readTarString(buffer, start, length) {
  return buffer
    .subarray(start, start + length)
    .toString('utf8')
    .replace(/\0.*$/u, '')
    .trim();
}

function isSafeRelativePath(relativePath) {
  return relativePath
    && !path.isAbsolute(relativePath)
    && !relativePath.split('/').some((part) => part === '..' || part === '');
}

function normalizePackagePath(packagePath) {
  return packagePath.replace(/^\.\//u, '');
}

async function linkDependency(nodeModules, name) {
  const source = path.join(repoRoot, 'node_modules', name);
  await access(source, fsConstants.R_OK);
  await symlink(source, path.join(nodeModules, name), 'dir');
}

async function linkBin(binDir, name, target) {
  await chmod(target, 0o755);
  await symlink(path.relative(binDir, target), path.join(binDir, name), 'file');
}

async function assertFile(root, relativePath) {
  await access(path.join(root, relativePath), fsConstants.R_OK);
}

function targetManifestFixture() {
  return {
    schema_version: '0.1.0',
    name: 'Packed install fixture',
    baseUrl: 'https://example.test/',
    scope: {
      sameOrigin: true,
      allowedHosts: ['example.test']
    },
    seeds: ['/'],
    expectedRoutes: ['/'],
    viewportMatrix: [
      { name: 'desktop', width: 1280, height: 720 }
    ],
    actionPolicy: {
      click: 'navigation_only',
      forms: 'skip',
      destructive: 'skip',
      external: 'skip'
    },
    budgets: {
      maxRoutes: 1,
      maxActionsPerRoute: 0
    },
    artifacts: {
      screenshot: false,
      trace: false,
      report: false
    },
    masks: [],
    regions: [],
    pages: [],
    localContentUxAdvisory: {
      enabled: false
    }
  };
}
