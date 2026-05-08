import { NEXUS_LEDGER_SCHEMA_VERSION, type NexusLedgerSchemaVersion } from '../contracts/types';
import { isRecord } from '../io/validation-helpers';

export function withLedgerSchemaVersion<T extends object>(
  record: T,
): T & { schema_version: NexusLedgerSchemaVersion } {
  const { schema_version: _ignored, ...rest } = record as T & { schema_version?: unknown };
  return {
    schema_version: NEXUS_LEDGER_SCHEMA_VERSION,
    ...rest,
  } as T & { schema_version: NexusLedgerSchemaVersion };
}

const warnedUnexpectedLedgerSchemaArtifacts = new Set<string>();

export function __resetMemoizedSchemaWarnings(): void {
  warnedUnexpectedLedgerSchemaArtifacts.clear();
}

export function warnOnUnexpectedLedgerSchemaVersion(
  value: unknown,
  artifactLabel: string,
): void {
  if (!isRecord(value) || !('schema_version' in value)) {
    // v1 readers deliberately treat missing schema_version as current so
    // legacy artifacts remain readable. Revisit this when v2 reader semantics land.
    return;
  }

  const version = value.schema_version;
  if (version === NEXUS_LEDGER_SCHEMA_VERSION) {
    return;
  }
  if (warnedUnexpectedLedgerSchemaArtifacts.has(artifactLabel)) {
    return;
  }
  warnedUnexpectedLedgerSchemaArtifacts.add(artifactLabel);

  console.warn(
    `[nexus] ${artifactLabel} schema_version=${String(version)}, expected ${NEXUS_LEDGER_SCHEMA_VERSION}`,
  );
}
