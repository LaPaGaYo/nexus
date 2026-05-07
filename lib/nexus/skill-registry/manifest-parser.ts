import { existsSync, readFileSync } from 'fs';
import { load as loadYaml } from 'js-yaml';
import { CANONICAL_COMMANDS, type CanonicalCommandId } from '../types';
import {
  NEXUS_SKILL_MANIFEST_SCHEMA_VERSION,
  NEXUS_SKILL_NAMESPACES,
  type NexusSkillAppliesTo,
  type NexusSkillClassification,
  type NexusSkillContext,
  type NexusSkillHost,
  type NexusSkillInputDecl,
  type NexusSkillManifest,
  type NexusSkillManifestNamespace,
  type NexusSkillOutputDecl,
  type NexusSkillProvenance,
  type NexusSkillRankingBoost,
  type NexusSkillRankingHints,
} from './manifest-schema';

export type NexusSkillManifestReadResult =
  | { kind: 'manifest'; data: NexusSkillManifest }
  | { kind: 'missing' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'parse_error'; reason: string }
  | { kind: 'unsupported_version'; found: number };

const TOP_LEVEL_FIELDS = new Set([
  'schema_version',
  'name',
  'summary',
  'intent_keywords',
  'lifecycle_stages',
  'classification',
  'applies_to',
  'inputs',
  'outputs',
  'ranking',
  'provenance',
  'notes',
]);

const HOSTS: readonly NexusSkillHost[] = ['claude', 'codex', 'gemini-cli'];
const CONTEXTS: readonly NexusSkillContext[] = ['solo', 'pair', 'team'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, label: string): string | { reason: string } {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { reason: `${label} required` };
  }
  return value.trim();
}

function optionalString(value: unknown, label: string): string | undefined | { reason: string } {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return { reason: `${label} must be a string` };
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalBoolean(value: unknown, label: string): boolean | undefined | { reason: string } {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    return { reason: `${label} must be a boolean` };
  }
  return value;
}

function stringArray(value: unknown, label: string, required = false): string[] | { reason: string } | undefined {
  if (value === undefined) {
    return required ? { reason: `${label} required` } : undefined;
  }
  if (!Array.isArray(value)) {
    return { reason: `${label} must be an array` };
  }
  const output: string[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      return { reason: `${label}[${index}] must be a non-empty string` };
    }
    output.push(entry.trim());
  }
  if (required && output.length === 0) {
    return { reason: 'at least one intent_keyword required' };
  }
  return output;
}

function enumArray<T extends string>(
  value: unknown,
  label: string,
  allowed: readonly T[],
): T[] | { reason: string } | undefined {
  const values = stringArray(value, label);
  if (values === undefined || 'reason' in values) {
    return values;
  }
  for (const entry of values) {
    if (!allowed.includes(entry as T)) {
      return { reason: `${label} contains unsupported value '${entry}'` };
    }
  }
  return values as T[];
}

function parseClassification(value: unknown): NexusSkillClassification | { reason: string } | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return { reason: 'classification must be an object' };
  }
  const namespace = optionalString(value.namespace, 'classification.namespace');
  if (typeof namespace === 'object') {
    return namespace;
  }
  if (namespace !== undefined && !NEXUS_SKILL_NAMESPACES.includes(namespace as NexusSkillManifestNamespace)) {
    return { reason: `classification.namespace contains unsupported value '${namespace}'` };
  }
  const category = optionalString(value.category, 'classification.category');
  if (typeof category === 'object') {
    return category;
  }
  return {
    ...(namespace !== undefined ? { namespace: namespace as NexusSkillManifestNamespace } : {}),
    ...(category !== undefined ? { category } : {}),
  };
}

function parseAppliesTo(value: unknown): NexusSkillAppliesTo | { reason: string } | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return { reason: 'applies_to must be an object' };
  }
  const hosts = enumArray(value.hosts, 'applies_to.hosts', HOSTS);
  if (hosts && 'reason' in hosts) {
    return hosts;
  }
  const contexts = enumArray(value.contexts, 'applies_to.contexts', CONTEXTS);
  if (contexts && 'reason' in contexts) {
    return contexts;
  }
  return {
    ...(hosts !== undefined ? { hosts } : {}),
    ...(contexts !== undefined ? { contexts } : {}),
  };
}

function parseArtifactDecls<T extends NexusSkillInputDecl | NexusSkillOutputDecl>(
  value: unknown,
  label: 'inputs' | 'outputs',
): T[] | { reason: string } | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return { reason: `${label} must be an array` };
  }
  const output: T[] = [];
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      return { reason: `${label}[${index}] must be an object` };
    }
    const name = stringValue(entry.name, `${label}[${index}].name`);
    if (typeof name === 'object') {
      return name;
    }
    const description = optionalString(entry.description, `${label}[${index}].description`);
    if (typeof description === 'object') {
      return description;
    }
    const artifact = optionalString(entry.artifact, `${label}[${index}].artifact`);
    if (typeof artifact === 'object') {
      return artifact;
    }
    const optional = optionalBoolean(entry.optional, `${label}[${index}].optional`);
    if (typeof optional === 'object') {
      return optional;
    }
    output.push({
      name,
      ...(description !== undefined ? { description } : {}),
      ...(artifact !== undefined ? { artifact } : {}),
      ...(optional !== undefined ? { optional } : {}),
    } as T);
  }
  return output;
}

function parseRankingBoosts(value: unknown): NexusSkillRankingBoost[] | { reason: string } | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return { reason: 'ranking.boosts must be an array' };
  }
  const boosts: NexusSkillRankingBoost[] = [];
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      return { reason: `ranking.boosts[${index}] must be an object` };
    }
    if (typeof entry.delta !== 'number' || !Number.isFinite(entry.delta)) {
      return { reason: `ranking.boosts[${index}].delta must be a number` };
    }
    const context = optionalString(entry.context, `ranking.boosts[${index}].context`);
    if (typeof context === 'object') {
      return context;
    }
    const tag = optionalString(entry.tag, `ranking.boosts[${index}].tag`);
    if (typeof tag === 'object') {
      return tag;
    }
    if (context === undefined && tag === undefined) {
      return { reason: `ranking.boosts[${index}] must declare context or tag` };
    }
    boosts.push({
      ...(context !== undefined ? { context } : {}),
      ...(tag !== undefined ? { tag } : {}),
      delta: entry.delta,
    });
  }
  return boosts;
}

function parseRanking(value: unknown): NexusSkillRankingHints | { reason: string } | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return { reason: 'ranking must be an object' };
  }
  if (value.base_score !== undefined && (typeof value.base_score !== 'number' || !Number.isFinite(value.base_score))) {
    return { reason: 'ranking.base_score must be a number' };
  }
  const boosts = parseRankingBoosts(value.boosts);
  if (boosts && 'reason' in boosts) {
    return boosts;
  }
  return {
    ...(value.base_score !== undefined ? { base_score: value.base_score } : {}),
    ...(boosts !== undefined ? { boosts } : {}),
  };
}

function parseProvenance(value: unknown): NexusSkillProvenance | { reason: string } | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return { reason: 'provenance must be an object' };
  }
  const provenance: NexusSkillProvenance = {};
  for (const key of ['author', 'source_url', 'version', 'license'] as const) {
    const parsed = optionalString(value[key], `provenance.${key}`);
    if (typeof parsed === 'object') {
      return parsed;
    }
    if (parsed !== undefined) {
      provenance[key] = parsed;
    }
  }
  return provenance;
}

function warnUnknownTopLevelFields(record: Record<string, unknown>): void {
  for (const field of Object.keys(record)) {
    if (!TOP_LEVEL_FIELDS.has(field)) {
      console.warn(`[nexus] Unknown nexus.skill.yaml field '${field}' ignored.`);
    }
  }
}

function validateManifest(parsed: unknown): NexusSkillManifestReadResult {
  if (!isRecord(parsed)) {
    return { kind: 'invalid', reason: 'manifest must be an object' };
  }
  warnUnknownTopLevelFields(parsed);

  if (parsed.schema_version === undefined) {
    return { kind: 'invalid', reason: 'schema_version required' };
  }
  if (typeof parsed.schema_version !== 'number' || !Number.isInteger(parsed.schema_version)) {
    return { kind: 'invalid', reason: 'schema_version must be a number' };
  }
  if (parsed.schema_version > NEXUS_SKILL_MANIFEST_SCHEMA_VERSION) {
    return { kind: 'unsupported_version', found: parsed.schema_version };
  }
  if (parsed.schema_version !== NEXUS_SKILL_MANIFEST_SCHEMA_VERSION) {
    return { kind: 'invalid', reason: `schema_version must be ${NEXUS_SKILL_MANIFEST_SCHEMA_VERSION}` };
  }

  const name = stringValue(parsed.name, 'name');
  if (typeof name === 'object') {
    return { kind: 'invalid', reason: name.reason };
  }
  const summary = stringValue(parsed.summary, 'summary');
  if (typeof summary === 'object') {
    return { kind: 'invalid', reason: summary.reason };
  }
  if (summary.length > 200) {
    return { kind: 'invalid', reason: 'summary must be 200 characters or fewer' };
  }
  const intentKeywords = stringArray(parsed.intent_keywords, 'intent_keywords', true);
  if (!intentKeywords || 'reason' in intentKeywords) {
    return { kind: 'invalid', reason: intentKeywords?.reason ?? 'intent_keywords required' };
  }
  const lifecycleStages = enumArray(parsed.lifecycle_stages, 'lifecycle_stages', CANONICAL_COMMANDS);
  if (lifecycleStages && 'reason' in lifecycleStages) {
    return { kind: 'invalid', reason: lifecycleStages.reason };
  }
  const classification = parseClassification(parsed.classification);
  if (classification && 'reason' in classification) {
    return { kind: 'invalid', reason: classification.reason };
  }
  const appliesTo = parseAppliesTo(parsed.applies_to);
  if (appliesTo && 'reason' in appliesTo) {
    return { kind: 'invalid', reason: appliesTo.reason };
  }
  const inputs = parseArtifactDecls<NexusSkillInputDecl>(parsed.inputs, 'inputs');
  if (inputs && 'reason' in inputs) {
    return { kind: 'invalid', reason: inputs.reason };
  }
  const outputs = parseArtifactDecls<NexusSkillOutputDecl>(parsed.outputs, 'outputs');
  if (outputs && 'reason' in outputs) {
    return { kind: 'invalid', reason: outputs.reason };
  }
  const ranking = parseRanking(parsed.ranking);
  if (ranking && 'reason' in ranking) {
    return { kind: 'invalid', reason: ranking.reason };
  }
  const provenance = parseProvenance(parsed.provenance);
  if (provenance && 'reason' in provenance) {
    return { kind: 'invalid', reason: provenance.reason };
  }
  const notes = stringArray(parsed.notes, 'notes');
  if (notes && 'reason' in notes) {
    return { kind: 'invalid', reason: notes.reason };
  }

  return {
    kind: 'manifest',
    data: {
      schema_version: NEXUS_SKILL_MANIFEST_SCHEMA_VERSION,
      name,
      summary,
      intent_keywords: intentKeywords,
      ...(lifecycleStages !== undefined ? { lifecycle_stages: lifecycleStages as CanonicalCommandId[] } : {}),
      ...(classification !== undefined ? { classification } : {}),
      ...(appliesTo !== undefined ? { applies_to: appliesTo } : {}),
      ...(inputs !== undefined ? { inputs } : {}),
      ...(outputs !== undefined ? { outputs } : {}),
      ...(ranking !== undefined ? { ranking } : {}),
      ...(provenance !== undefined ? { provenance } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
  };
}

export function readNexusSkillManifest(path: string): NexusSkillManifestReadResult {
  if (!existsSync(path)) {
    return { kind: 'missing' };
  }

  const source = readFileSync(path, 'utf8');
  if (source.trim().length === 0) {
    return { kind: 'parse_error', reason: 'nexus.skill.yaml is empty' };
  }

  try {
    return validateManifest(loadYaml(source));
  } catch (error) {
    return {
      kind: 'parse_error',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
