import { readFile } from 'node:fs/promises';
import os from 'node:os';

const PROC_MEMINFO_PATH = '/proc/meminfo';
const PROC_MEMORY_PRESSURE_PATH = '/proc/pressure/memory';
const CGROUP_V2_MEMORY_MAX = '/sys/fs/cgroup/memory.max';
const CGROUP_V2_MEMORY_CURRENT = '/sys/fs/cgroup/memory.current';
const CGROUP_V2_SWAP_MAX = '/sys/fs/cgroup/memory.swap.max';
const CGROUP_V2_SWAP_CURRENT = '/sys/fs/cgroup/memory.swap.current';
const CGROUP_V1_MEMORY_LIMIT = '/sys/fs/cgroup/memory/memory.limit_in_bytes';
const CGROUP_V1_MEMORY_USAGE = '/sys/fs/cgroup/memory/memory.usage_in_bytes';
const UNLIMITED_CGROUP_LIMIT = 9_000_000_000_000_000_000;

export const RESOURCE_STATUS_THRESHOLDS = Object.freeze({
  memory_available_watch_ratio: 0.15,
  memory_available_critical_ratio: 0.08,
  cgroup_usage_watch_ratio: 0.85,
  cgroup_usage_critical_ratio: 0.95,
  swap_used_watch_ratio: 0.5,
  swap_used_critical_ratio: 0.9
});

export async function runResourceStatus(options = {}, context = {}) {
  const resourceStatus = await collectResourceStatus(context);
  return {
    status: 'ok',
    data: {
      resource_status: resourceStatus,
      boundary: resourceStatus.boundary
    },
    warnings: warningsForResourceStatus(resourceStatus),
    errors: [],
    artifacts: []
  };
}

export async function collectResourceStatus(context = {}) {
  const readTextFile = context.readTextFile ?? ((filePath) => readFile(filePath, 'utf8'));
  const osProvider = context.os ?? os;
  const memoryUsage = context.memoryUsage ?? (() => process.memoryUsage());

  const meminfo = await collectMeminfo({ readTextFile, osProvider });
  const processMemory = normalizeProcessMemory(memoryUsage());
  const cgroup = await collectCgroup({ readTextFile });
  const pressure = await collectMemoryPressure({ readTextFile });
  const status = classifyResourceStatus({ memory: meminfo.memory, cgroup });

  return {
    status,
    source: meminfo.source,
    thresholds: RESOURCE_STATUS_THRESHOLDS,
    memory: meminfo.memory,
    process: processMemory,
    cgroup,
    pressure,
    cache_policy: {
      automatic_system_cache_reclamation: false,
      automatic_swap_configuration: false,
      automatic_artifact_cache_deletion: false,
      manual_cleanup_requires_explicit_approval: true
    },
    boundary: {
      local_only: true,
      browser_launched: false,
      artifacts_written: false,
      external_upload: false,
      profile_reuse: false,
      system_cache_mutated: false,
      swap_mutated: false,
      cache_deleted: false,
      privileged_helper_used: false,
      shell_used: false,
      arbitrary_process_control: false
    },
    recommended_action: recommendedAction(status),
    recommendations: buildRecommendations({ status, memory: meminfo.memory, cgroup }),
    limitations: [
      'Resource status is a local preflight signal for browser-review planning, not a system cleanup authority.',
      'Host and cgroup values can change between this check and a later browser run.'
    ]
  };
}

async function collectMeminfo({ readTextFile, osProvider }) {
  const loaded = await readOptionalText(readTextFile, PROC_MEMINFO_PATH);
  if (loaded.ok) {
    return {
      source: 'proc_meminfo',
      memory: memoryFromMeminfo(parseMeminfoText(loaded.text))
    };
  }
  const totalBytes = safeInteger(osProvider.totalmem?.(), 0);
  const freeBytes = safeInteger(osProvider.freemem?.(), 0);
  const availableBytes = freeBytes;
  return {
    source: 'node_os',
    memory: compactObject({
      total_bytes: totalBytes,
      available_bytes: availableBytes,
      free_bytes: freeBytes,
      available_ratio: ratio(availableBytes, totalBytes),
      buffers_bytes: null,
      cached_bytes: null,
      swap_cached_bytes: null,
      active_file_bytes: null,
      inactive_file_bytes: null,
      dirty_bytes: null,
      writeback_bytes: null,
      reclaimable_bytes: null,
      sreclaimable_bytes: null,
      sunreclaim_bytes: null,
      swap_total_bytes: null,
      swap_free_bytes: null,
      swap_used_bytes: null,
      swap_used_ratio: null
    })
  };
}

export function parseMeminfoText(text) {
  const values = {};
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const match = /^([^:]+):\s+(\d+)(?:\s+(\w+))?/.exec(rawLine);
    if (!match) {
      continue;
    }
    const [, key, valueText, unitText] = match;
    const value = Number.parseInt(valueText, 10);
    if (!Number.isFinite(value)) {
      continue;
    }
    const unit = String(unitText ?? 'B').toLowerCase();
    values[key.trim()] = unit === 'kb' ? value * 1024 : value;
  }
  return values;
}

function memoryFromMeminfo(values) {
  const totalBytes = valueFor(values, 'MemTotal');
  const availableBytes = firstPositive([valueFor(values, 'MemAvailable'), valueFor(values, 'MemFree')]);
  const freeBytes = valueFor(values, 'MemFree');
  const buffersBytes = valueFor(values, 'Buffers');
  const cachedBytes = valueFor(values, 'Cached');
  const swapCachedBytes = valueFor(values, 'SwapCached');
  const activeFileBytes = valueFor(values, 'Active(file)');
  const inactiveFileBytes = valueFor(values, 'Inactive(file)');
  const dirtyBytes = valueFor(values, 'Dirty');
  const writebackBytes = valueFor(values, 'Writeback');
  const reclaimableBytes = valueFor(values, 'KReclaimable');
  const sreclaimableBytes = valueFor(values, 'SReclaimable');
  const sunreclaimBytes = valueFor(values, 'SUnreclaim');
  const swapTotalBytes = valueFor(values, 'SwapTotal');
  const swapFreeBytes = valueFor(values, 'SwapFree');
  const swapUsedBytes = Math.max(0, swapTotalBytes - swapFreeBytes);

  return {
    total_bytes: totalBytes,
    available_bytes: availableBytes,
    free_bytes: freeBytes,
    available_ratio: ratio(availableBytes, totalBytes),
    buffers_bytes: buffersBytes,
    cached_bytes: cachedBytes,
    swap_cached_bytes: swapCachedBytes,
    active_file_bytes: activeFileBytes,
    inactive_file_bytes: inactiveFileBytes,
    dirty_bytes: dirtyBytes,
    writeback_bytes: writebackBytes,
    reclaimable_bytes: reclaimableBytes,
    sreclaimable_bytes: sreclaimableBytes,
    sunreclaim_bytes: sunreclaimBytes,
    swap_total_bytes: swapTotalBytes,
    swap_free_bytes: swapFreeBytes,
    swap_used_bytes: swapUsedBytes,
    swap_used_ratio: ratio(swapUsedBytes, swapTotalBytes)
  };
}

async function collectCgroup({ readTextFile }) {
  const [v2Max, v2Current, v2SwapMax, v2SwapCurrent] = await Promise.all([
    readOptionalText(readTextFile, CGROUP_V2_MEMORY_MAX),
    readOptionalText(readTextFile, CGROUP_V2_MEMORY_CURRENT),
    readOptionalText(readTextFile, CGROUP_V2_SWAP_MAX),
    readOptionalText(readTextFile, CGROUP_V2_SWAP_CURRENT)
  ]);
  if (v2Max.ok || v2Current.ok) {
    const limitBytes = parseCgroupLimit(v2Max.text);
    const currentBytes = parseCgroupBytes(v2Current.text);
    const swapLimitBytes = parseCgroupLimit(v2SwapMax.text);
    const swapCurrentBytes = parseCgroupBytes(v2SwapCurrent.text);
    return cgroupSnapshot({
      version: 'v2',
      available: true,
      limitBytes,
      currentBytes,
      swapLimitBytes,
      swapCurrentBytes
    });
  }

  const [v1Limit, v1Usage] = await Promise.all([
    readOptionalText(readTextFile, CGROUP_V1_MEMORY_LIMIT),
    readOptionalText(readTextFile, CGROUP_V1_MEMORY_USAGE)
  ]);
  if (v1Limit.ok || v1Usage.ok) {
    return cgroupSnapshot({
      version: 'v1',
      available: true,
      limitBytes: parseCgroupLimit(v1Limit.text),
      currentBytes: parseCgroupBytes(v1Usage.text),
      swapLimitBytes: null,
      swapCurrentBytes: null
    });
  }

  return {
    available: false,
    version: null,
    limit_bytes: null,
    current_bytes: null,
    available_bytes: null,
    usage_ratio: null,
    swap_limit_bytes: null,
    swap_current_bytes: null,
    swap_usage_ratio: null
  };
}

function cgroupSnapshot({ version, available, limitBytes, currentBytes, swapLimitBytes, swapCurrentBytes }) {
  const normalizedLimit = normalizeCgroupLimit(limitBytes);
  const normalizedSwapLimit = normalizeCgroupLimit(swapLimitBytes);
  return {
    available,
    version,
    limit_bytes: normalizedLimit,
    current_bytes: currentBytes,
    available_bytes: normalizedLimit === null || currentBytes === null
      ? null
      : Math.max(0, normalizedLimit - currentBytes),
    usage_ratio: ratio(currentBytes, normalizedLimit),
    swap_limit_bytes: normalizedSwapLimit,
    swap_current_bytes: swapCurrentBytes,
    swap_usage_ratio: ratio(swapCurrentBytes, normalizedSwapLimit)
  };
}

async function collectMemoryPressure({ readTextFile }) {
  const loaded = await readOptionalText(readTextFile, PROC_MEMORY_PRESSURE_PATH);
  if (!loaded.ok) {
    return { available: false, some: null, full: null };
  }
  return {
    available: true,
    ...parsePressureText(loaded.text)
  };
}

export function parsePressureText(text) {
  const output = { some: null, full: null };
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const [kind, ...parts] = rawLine.trim().split(/\s+/);
    if (kind !== 'some' && kind !== 'full') {
      continue;
    }
    output[kind] = pressureValues(parts);
  }
  return output;
}

function pressureValues(parts) {
  const values = {};
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key) {
      continue;
    }
    values[key] = Number.isFinite(Number(value)) ? Number(value) : value;
  }
  return values;
}

function classifyResourceStatus({ memory, cgroup }) {
  const memoryAvailable = memory.available_ratio;
  const cgroupUsage = cgroup.usage_ratio;
  const swapUsed = memory.swap_used_ratio;
  if (
    atOrBelow(memoryAvailable, RESOURCE_STATUS_THRESHOLDS.memory_available_critical_ratio)
    || atOrAbove(cgroupUsage, RESOURCE_STATUS_THRESHOLDS.cgroup_usage_critical_ratio)
    || atOrAbove(swapUsed, RESOURCE_STATUS_THRESHOLDS.swap_used_critical_ratio)
  ) {
    return 'critical';
  }
  if (
    atOrBelow(memoryAvailable, RESOURCE_STATUS_THRESHOLDS.memory_available_watch_ratio)
    || atOrAbove(cgroupUsage, RESOURCE_STATUS_THRESHOLDS.cgroup_usage_watch_ratio)
    || atOrAbove(swapUsed, RESOURCE_STATUS_THRESHOLDS.swap_used_watch_ratio)
  ) {
    return 'watch';
  }
  return 'ok';
}

function recommendedAction(status) {
  if (status === 'critical') {
    return 'pause_browser_work_and_replan';
  }
  if (status === 'watch') {
    return 'reduce_browser_workload_or_split_review';
  }
  return 'proceed_with_normal_local_review';
}

function buildRecommendations({ status, memory, cgroup }) {
  const recommendations = [];
  if (status === 'ok') {
    recommendations.push({
      id: 'resource_headroom_ok',
      severity: 'info',
      summary: 'Local memory headroom is within the configured Browser Debug CLI preflight thresholds.'
    });
  } else {
    recommendations.push({
      id: 'reduce_browser_workload',
      severity: status === 'critical' ? 'high' : 'medium',
      summary: 'Reduce route or viewport budget, split the target manifest, or run browser-heavy checks in smaller batches.'
    });
    recommendations.push({
      id: 'defer_heavy_artifacts',
      severity: 'medium',
      summary: 'Capture screenshots and traces selectively when memory pressure is elevated.'
    });
    recommendations.push({
      id: 'stop_unused_browser_daemons',
      severity: 'medium',
      summary: 'Stop Browser Debug CLI daemons that are no longer needed before starting another browser-heavy review.'
    });
  }
  recommendations.push({
    id: 'validate_manifest_before_browser',
    severity: 'info',
    summary: 'Run target manifest validation before browser review so avoidable browser work is caught without launching Chromium.'
  });
  if (memory.swap_total_bytes === 0) {
    recommendations.push({
      id: 'swap_not_available',
      severity: 'info',
      summary: 'No swap is visible to this process; host-level swap changes remain outside this CLI and require explicit operator approval.'
    });
  }
  if (cgroup.available === false) {
    recommendations.push({
      id: 'cgroup_unavailable',
      severity: 'info',
      summary: 'No cgroup memory limit was visible; classification uses process-visible system memory only.'
    });
  }
  recommendations.push({
    id: 'no_destructive_memory_actions',
    severity: 'info',
    summary: 'This command reports memory state only and does not mutate system cache, swap, files, profiles, or external services.'
  });
  return recommendations;
}

function warningsForResourceStatus(resourceStatus) {
  if (resourceStatus.status === 'critical') {
    return [{
      code: 'RESOURCE_MEMORY_CRITICAL',
      message: 'Local memory or swap pressure is critical for browser-heavy work.',
      details: {
        recommended_action: resourceStatus.recommended_action
      }
    }];
  }
  if (resourceStatus.status === 'watch') {
    return [{
      code: 'RESOURCE_MEMORY_WATCH',
      message: 'Local memory or swap pressure is elevated for browser-heavy work.',
      details: {
        recommended_action: resourceStatus.recommended_action
      }
    }];
  }
  return [];
}

async function readOptionalText(readTextFile, filePath) {
  try {
    const text = await readTextFile(filePath);
    return { ok: true, text: String(text) };
  } catch (error) {
    return {
      ok: false,
      text: '',
      code: error?.code ?? 'READ_FAILED'
    };
  }
}

function normalizeProcessMemory(value) {
  return compactObject({
    rss_bytes: safeInteger(value?.rss, null),
    heap_total_bytes: safeInteger(value?.heapTotal, null),
    heap_used_bytes: safeInteger(value?.heapUsed, null),
    external_bytes: safeInteger(value?.external, null),
    array_buffers_bytes: safeInteger(value?.arrayBuffers, null)
  });
}

function parseCgroupLimit(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed || trimmed === 'max') {
    return null;
  }
  return parseCgroupBytes(trimmed);
}

function parseCgroupBytes(text) {
  const value = Number.parseInt(String(text ?? '').trim(), 10);
  return Number.isFinite(value) ? value : null;
}

function normalizeCgroupLimit(value) {
  if (value === null || value >= UNLIMITED_CGROUP_LIMIT) {
    return null;
  }
  return value;
}

function valueFor(values, key) {
  return safeInteger(values[key], 0);
}

function firstPositive(values) {
  for (const value of values) {
    if (value > 0) {
      return value;
    }
  }
  return 0;
}

function ratio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  return Number((numerator / denominator).toFixed(6));
}

function atOrAbove(value, threshold) {
  return value !== null && value >= threshold;
}

function atOrBelow(value, threshold) {
  return value !== null && value <= threshold;
}

function safeInteger(value, fallback) {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
