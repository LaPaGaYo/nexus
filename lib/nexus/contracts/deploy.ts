import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { deployContractJsonPath } from '../io/artifacts';
import { isRecord, readJsonResult } from '../io/validation-helpers';
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

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function oneOf<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]): T[number] {
  if (typeof value !== 'string' || value.length === 0) {
    return fallback;
  }

  return (options as readonly string[]).includes(value) ? value as T[number] : fallback;
}

function normalizePlatform(value: unknown): DeployPlatform {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
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

function normalizeProjectType(value: unknown): DeployProjectType {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
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

function normalizeTrigger(value: unknown, fallback: DeployTriggerKind = 'command'): DeployTriggerKind {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
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

  return oneOf(normalized, DEPLOY_TRIGGER_KINDS, fallback);
}

function normalizeStatusKind(
  command: unknown,
  workflow: unknown,
  fallback: DeployStatusKind = 'command',
): DeployStatusKind {
  const normalizedCommand = typeof command === 'string' ? command.trim() : '';
  const normalizedWorkflow = typeof workflow === 'string' ? workflow.trim() : '';
  if (!normalizedCommand || normalizedCommand.toLowerCase() === 'none') {
    return normalizedWorkflow ? 'github_actions' : 'none';
  }
  const loweredCommand = normalizedCommand.toLowerCase();
  if (loweredCommand.includes('http health check')) {
    return 'http';
  }
  if (loweredCommand.includes('github actions')) {
    return 'github_actions';
  }
  if (loweredCommand.includes('command') || loweredCommand.includes('script') || loweredCommand.includes('cli')) {
    return 'command';
  }

  return oneOf(loweredCommand, DEPLOY_STATUS_KINDS, fallback);
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

function sanitizeCommand(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === 'none' || normalized.toLowerCase() === 'http health check') {
    return null;
  }

  return normalized;
}

function splitHooks(value: unknown): string[] {
  if (typeof value !== 'string') {
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

function normalizeSurfaceLabel(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

function noteUnrecognizedKind(
  notes: string[],
  field: 'deploy_trigger.kind' | 'deploy_status.kind',
  value: unknown,
): void {
  if (typeof value !== 'string') {
    if (value !== null && value !== undefined) {
      notes.push(`${field} non-string value not recognized; treated as 'none'.`);
    }
    return;
  }

  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === 'none') {
    return;
  }

  notes.push(`${field} '${normalized}' not recognized; treated as 'none'.`);
}

function normalizeCanonicalTriggerKind(value: unknown, notes: string[]): DeployTriggerKind {
  const normalized = normalizeTrigger(value, 'none');
  if (normalized === 'none') {
    noteUnrecognizedKind(notes, 'deploy_trigger.kind', value);
  }
  return normalized;
}

function normalizeCanonicalStatusKind(value: unknown, notes: string[]): DeployStatusKind {
  const normalized = normalizeStatusKind(value, null, 'none');
  if (normalized === 'none') {
    noteUnrecognizedKind(notes, 'deploy_status.kind', value);
  }
  return normalized;
}

function normalizeSecondarySurfaces(contract: Record<string, unknown>): DeployContractRecord['secondary_surfaces'] {
  if (!Array.isArray(contract.secondary_surfaces)) {
    return [];
  }

  return contract.secondary_surfaces
    .map((surface, index) => {
      const entry = recordOrNull(surface);
      if (!entry) {
        return null;
      }

      const production = recordOrNull(entry.production);
      const deployTrigger = recordOrNull(entry.deploy_trigger);
      const deployStatus = recordOrNull(entry.deploy_status);
      const label = normalizeSurfaceLabel(entry.label) ?? `secondary-${index + 1}`;
      const notes = stringArray(entry.notes);

      return {
        label,
        platform: normalizePlatform(entry.platform),
        project_type: normalizeProjectType(entry.project_type),
        production: {
          url: stringOrNull(production?.url),
          health_check: stringOrNull(production?.health_check),
        },
        deploy_trigger: {
          kind: normalizeCanonicalTriggerKind(deployTrigger?.kind, notes),
          details: stringOrNull(deployTrigger?.details),
        },
        deploy_workflow: stringOrNull(entry.deploy_workflow),
        deploy_status: {
          kind: normalizeCanonicalStatusKind(deployStatus?.kind, notes),
          command: stringOrNull(deployStatus?.command),
        },
        notes,
        sources: stringArray(entry.sources),
      };
    })
    .filter((surface): surface is DeployContractRecord['secondary_surfaces'][number] => surface !== null);
}

function normalizeCanonicalDeployContract(parsed: Record<string, unknown>): DeployContractRecord {
  const production = recordOrNull(parsed.production);
  const staging = recordOrNull(parsed.staging);
  const deployTrigger = recordOrNull(parsed.deploy_trigger);
  const deployStatus = recordOrNull(parsed.deploy_status);
  const customHooks = recordOrNull(parsed.custom_hooks);
  const notes = stringArray(parsed.notes);

  return {
    schema_version: 1,
    configured_at: typeof parsed.configured_at === 'string' ? parsed.configured_at : '',
    primary_surface_label: normalizeSurfaceLabel(parsed.primary_surface_label),
    platform: normalizePlatform(parsed.platform),
    project_type: normalizeProjectType(parsed.project_type),
    production: {
      url: stringOrNull(production?.url),
      health_check: stringOrNull(production?.health_check),
    },
    staging: {
      url: stringOrNull(staging?.url),
      workflow: stringOrNull(staging?.workflow),
    },
    deploy_trigger: {
      kind: normalizeCanonicalTriggerKind(deployTrigger?.kind, notes),
      details: stringOrNull(deployTrigger?.details),
    },
    deploy_workflow: stringOrNull(parsed.deploy_workflow),
    deploy_status: {
      kind: normalizeCanonicalStatusKind(deployStatus?.kind, notes),
      command: stringOrNull(deployStatus?.command),
    },
    custom_hooks: {
      pre_merge: stringArray(customHooks?.pre_merge),
      post_merge: stringArray(customHooks?.post_merge),
    },
    secondary_surfaces: normalizeSecondarySurfaces(parsed),
    notes,
    sources: stringArray(parsed.sources),
  };
}

type CanonicalDeployContractRead =
  | { kind: 'contract'; contract: DeployContractRecord }
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'parse_error'; error: Error };

function readCanonicalDeployContractResult(cwd: string): CanonicalDeployContractRead {
  const result = readJsonResult<DeployContractRecord>(join(cwd, deployContractJsonPath()));
  if (!result.ok) {
    return result.reason === 'parse_error'
      ? { kind: 'parse_error', error: result.error }
      : { kind: 'missing' };
  }

  if (!isRecord(result.value)) {
    return { kind: 'invalid' };
  }

  return { kind: 'contract', contract: normalizeCanonicalDeployContract(result.value) };
}

export function readCanonicalDeployContract(cwd: string): DeployContractRecord | null {
  const result = readCanonicalDeployContractResult(cwd);
  return result.kind === 'contract' ? result.contract : null;
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
    primary_surface_label: projectType === 'web_app' ? 'web' : null,
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
    secondary_surfaces: [],
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
  const secondarySurfaces = contract.secondary_surfaces.map((surface) => ({
    label: surface.label,
    platform: surface.platform,
    project_type: surface.project_type,
    production_url: surface.production.url,
    health_check: surface.production.health_check,
    deploy_status_kind: surface.deploy_status.kind,
    deploy_status_command: surface.deploy_status.command,
    deploy_workflow: surface.deploy_workflow,
    blocking: false as const,
    notes: surface.notes,
  }));

  return {
    schema_version: 1,
    run_id: runId,
    generated_at: generatedAt,
    configured: contract.platform !== 'unknown',
    source,
    contract_path: contractPath,
    primary_surface_label: contract.primary_surface_label,
    platform: contract.platform,
    project_type: contract.project_type,
    production_url: contract.production.url,
    health_check: contract.production.health_check,
    deploy_status_kind: contract.deploy_status.kind,
    deploy_status_command: contract.deploy_status.command,
    deploy_workflow: contract.deploy_workflow,
    staging_detected: Boolean(contract.staging.url || contract.staging.workflow),
    secondary_surfaces: secondarySurfaces,
    notes: secondarySurfaces.length > 0
      ? [
          ...contract.notes,
          `Secondary deploy surfaces detected: ${secondarySurfaces.map((surface) => `${surface.label} (${surface.platform})`).join(', ')}`,
        ]
      : contract.notes,
  };
}

function unconfiguredDeployReadiness(
  source: DeployConfigSource,
  contractPath: string | null,
  runId: string,
  generatedAt: string,
  notes: string[] = [],
): DeployReadinessRecord {
  return {
    schema_version: 1,
    run_id: runId,
    generated_at: generatedAt,
    configured: false,
    source,
    contract_path: contractPath,
    primary_surface_label: null,
    platform: null,
    project_type: null,
    production_url: null,
    health_check: null,
    deploy_status_kind: 'none',
    deploy_status_command: null,
    deploy_workflow: null,
    staging_detected: false,
    secondary_surfaces: [],
    notes,
  };
}

export function resolveDeployReadiness(cwd: string, runId: string, generatedAt: string): DeployReadinessRecord {
  const canonical = readCanonicalDeployContractResult(cwd);
  if (canonical.kind === 'contract') {
    return readinessFromContract('canonical_contract', canonical.contract, runId, generatedAt, deployContractJsonPath());
  }
  if (canonical.kind === 'parse_error') {
    return unconfiguredDeployReadiness(
      'canonical_contract',
      deployContractJsonPath(),
      runId,
      generatedAt,
      [`deploy contract parse error: ${canonical.error.message}`],
    );
  }
  if (canonical.kind === 'invalid') {
    return unconfiguredDeployReadiness(
      'canonical_contract',
      deployContractJsonPath(),
      runId,
      generatedAt,
      ['deploy contract root is not a JSON object; treated as unconfigured.'],
    );
  }

  const legacy = readLegacyClaudeDeployContract(cwd);
  if (legacy) {
    return readinessFromContract('legacy_claude', legacy, runId, generatedAt, null);
  }

  return unconfiguredDeployReadiness('none', null, runId, generatedAt);
}
