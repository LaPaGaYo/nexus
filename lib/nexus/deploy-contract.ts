import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { deployContractJsonPath } from './artifacts';
import {
  DEPLOY_CONFIG_SOURCES,
  DEPLOY_PLATFORMS,
  DEPLOY_PROJECT_TYPES,
  DEPLOY_STATUS_KINDS,
  DEPLOY_TRIGGER_KINDS,
  type DeployConfigSource,
  type DeployContractRecord,
  type DeployPlatform,
  type DeployProjectType,
  type DeployReadinessRecord,
  type DeployStatusKind,
  type DeployTriggerKind,
} from './types';

function oneOf<T extends readonly string[]>(value: string | null | undefined, options: T, fallback: T[number]): T[number] {
  if (!value) {
    return fallback;
  }

  return (options as readonly string[]).includes(value) ? value as T[number] : fallback;
}

function normalizePlatform(value: string | null | undefined): DeployPlatform {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return 'unknown';
  }

  if (normalized.includes('fly')) return 'fly';
  if (normalized.includes('render')) return 'render';
  if (normalized.includes('vercel')) return 'vercel';
  if (normalized.includes('netlify')) return 'netlify';
  if (normalized.includes('heroku')) return 'heroku';
  if (normalized.includes('railway')) return 'railway';
  if (normalized.includes('github')) return 'github_actions';
  if (normalized === 'none' || normalized.includes("doesn't deploy") || normalized.includes('does not deploy')) return 'none';
  if (normalized.includes('custom')) return 'custom';

  return oneOf(normalized, DEPLOY_PLATFORMS, 'unknown');
}

function normalizeProjectType(value: string | null | undefined): DeployProjectType {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return 'unknown';
  }

  if (normalized.includes('web')) return 'web_app';
  if (normalized.includes('api')) return 'api';
  if (normalized.includes('cli')) return 'cli';
  if (normalized.includes('library')) return 'library';
  if (normalized.includes('service')) return 'service';

  return oneOf(normalized, DEPLOY_PROJECT_TYPES, 'unknown');
}

function normalizeTrigger(value: string | null | undefined): DeployTriggerKind {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return 'none';
  }

  if (normalized.includes('automatic on push') || normalized.includes('auto-deploy on push') || normalized.includes('auto deploy on push')) {
    return 'auto_on_push';
  }
  if (normalized.includes('github actions')) return 'github_actions';
  if (normalized.includes('manual')) return 'manual';
  if (normalized.includes('command') || normalized.includes('script') || normalized.includes('cli')) return 'command';
  if (normalized === 'none') return 'none';

  return oneOf(normalized, DEPLOY_TRIGGER_KINDS, 'command');
}

function normalizeStatusKind(command: string | null | undefined, workflow: string | null | undefined): DeployStatusKind {
  const normalizedCommand = command?.trim() ?? '';
  if (!normalizedCommand || normalizedCommand.toLowerCase() === 'none') {
    return workflow ? 'github_actions' : 'none';
  }
  if (normalizedCommand.toLowerCase().includes('http health check')) {
    return 'http';
  }

  return 'command';
}

function parseBulletValue(section: string, label: string): string | null {
  const pattern = new RegExp(`^-\\s+${label}:\\s*(.+)$`, 'im');
  const match = section.match(pattern);
  const value = match?.[1]?.trim() ?? '';
  return value.length > 0 ? value : null;
}

function parseHookValue(section: string, label: string): string | null {
  const pattern = new RegExp(`^-\\s+${label}:\\s*(.+)$`, 'im');
  const match = section.match(pattern);
  const value = match?.[1]?.trim() ?? '';
  return value.length > 0 ? value : null;
}

function sanitizeCommand(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === 'none' || normalized.toLowerCase() === 'http health check') {
    return null;
  }

  return normalized;
}

function splitHooks(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  if (value.trim().toLowerCase() === 'none') {
    return [];
  }

  return value
    .split(/\s*;\s*/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readSection(content: string, header: string): string | null {
  const lines = content.split('\n');
  const startIndex = lines.findIndex((line) => line.trim() === header.trim());
  if (startIndex === -1) {
    return null;
  }

  const collected: string[] = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('## ') && i > startIndex + 1) {
      break;
    }
    collected.push(line);
  }

  return collected.join('\n').trim();
}

export function readCanonicalDeployContract(cwd: string): DeployContractRecord | null {
  const path = join(cwd, deployContractJsonPath());
  if (!existsSync(path)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<DeployContractRecord>;
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  return {
    schema_version: 1,
    configured_at: typeof parsed.configured_at === 'string' ? parsed.configured_at : new Date().toISOString(),
    platform: normalizePlatform(parsed.platform ?? null),
    project_type: normalizeProjectType(parsed.project_type ?? null),
    production: {
      url: parsed.production?.url ?? null,
      health_check: parsed.production?.health_check ?? null,
    },
    staging: {
      url: parsed.staging?.url ?? null,
      workflow: parsed.staging?.workflow ?? null,
    },
    deploy_trigger: {
      kind: oneOf(parsed.deploy_trigger?.kind ?? null, DEPLOY_TRIGGER_KINDS, 'none'),
      details: parsed.deploy_trigger?.details ?? null,
    },
    deploy_workflow: parsed.deploy_workflow ?? null,
    deploy_status: {
      kind: oneOf(parsed.deploy_status?.kind ?? null, DEPLOY_STATUS_KINDS, 'none'),
      command: parsed.deploy_status?.command ?? null,
    },
    custom_hooks: {
      pre_merge: Array.isArray(parsed.custom_hooks?.pre_merge) ? parsed.custom_hooks.pre_merge.filter((entry): entry is string => typeof entry === 'string') : [],
      post_merge: Array.isArray(parsed.custom_hooks?.post_merge) ? parsed.custom_hooks.post_merge.filter((entry): entry is string => typeof entry === 'string') : [],
    },
    notes: Array.isArray(parsed.notes) ? parsed.notes.filter((entry): entry is string => typeof entry === 'string') : [],
    sources: Array.isArray(parsed.sources) ? parsed.sources.filter((entry): entry is string => typeof entry === 'string') : [],
  };
}

export function readLegacyClaudeDeployContract(cwd: string): DeployContractRecord | null {
  const path = join(cwd, 'CLAUDE.md');
  if (!existsSync(path)) {
    return null;
  }

  const content = readFileSync(path, 'utf8');
  const configSection = readSection(content, '## Deploy Configuration (configured by /setup-deploy)')
    ?? readSection(content, '## Deploy Configuration');
  if (!configSection) {
    return null;
  }

  const hooksSection = readSection(content, '### Custom deploy hooks');
  const platform = normalizePlatform(parseBulletValue(configSection, 'Platform'));
  const projectType = normalizeProjectType(parseBulletValue(configSection, 'Project type'));
  const productionUrl = parseBulletValue(configSection, 'Production URL');
  const deployWorkflow = parseBulletValue(configSection, 'Deploy workflow');
  const deployStatusCommand = sanitizeCommand(parseBulletValue(configSection, 'Deploy status command') ?? parseHookValue(hooksSection ?? '', 'Deploy status'));
  const healthCheck = parseBulletValue(configSection, 'Post-deploy health check') ?? parseHookValue(hooksSection ?? '', 'Health check');
  const deployTriggerDetails = parseHookValue(hooksSection ?? '', 'Deploy trigger') ?? deployWorkflow;
  const triggerKind = normalizeTrigger(deployTriggerDetails);
  const statusKind = normalizeStatusKind(deployStatusCommand, deployWorkflow);

  return {
    schema_version: 1,
    configured_at: '',
    platform,
    project_type: projectType,
    production: {
      url: productionUrl,
      health_check: healthCheck,
    },
    staging: {
      url: parseBulletValue(configSection, 'Staging URL'),
      workflow: parseBulletValue(configSection, 'Staging workflow'),
    },
    deploy_trigger: {
      kind: triggerKind,
      details: deployTriggerDetails ?? null,
    },
    deploy_workflow: deployWorkflow,
    deploy_status: {
      kind: statusKind,
      command: deployStatusCommand,
    },
    custom_hooks: {
      pre_merge: splitHooks(parseHookValue(hooksSection ?? '', 'Pre-merge')),
      post_merge: splitHooks(parseHookValue(hooksSection ?? '', 'Post-merge')),
    },
    notes: ['Recovered from legacy CLAUDE.md deploy configuration.'],
    sources: ['CLAUDE.md'],
  };
}

function readinessFromContract(
  source: Exclude<DeployConfigSource, 'none'>,
  contract: DeployContractRecord,
  runId: string,
  generatedAt: string,
  contractPath: string | null,
): DeployReadinessRecord {
  return {
    schema_version: 1,
    run_id: runId,
    generated_at: generatedAt,
    configured: contract.platform !== 'unknown',
    source,
    contract_path: contractPath,
    platform: contract.platform,
    project_type: contract.project_type,
    production_url: contract.production.url,
    health_check: contract.production.health_check,
    deploy_status_kind: contract.deploy_status.kind,
    deploy_status_command: contract.deploy_status.command,
    deploy_workflow: contract.deploy_workflow,
    staging_detected: Boolean(contract.staging.url || contract.staging.workflow),
    notes: contract.notes,
  };
}

export function resolveDeployReadiness(cwd: string, runId: string, generatedAt: string): DeployReadinessRecord {
  const canonical = readCanonicalDeployContract(cwd);
  if (canonical) {
    return readinessFromContract('canonical_contract', canonical, runId, generatedAt, deployContractJsonPath());
  }

  const legacy = readLegacyClaudeDeployContract(cwd);
  if (legacy) {
    return readinessFromContract('legacy_claude', legacy, runId, generatedAt, null);
  }

  return {
    schema_version: 1,
    run_id: runId,
    generated_at: generatedAt,
    configured: false,
    source: 'none',
    contract_path: null,
    platform: null,
    project_type: null,
    production_url: null,
    health_check: null,
    deploy_status_kind: 'none',
    deploy_status_command: null,
    deploy_workflow: null,
    staging_detected: false,
    notes: [],
  };
}
