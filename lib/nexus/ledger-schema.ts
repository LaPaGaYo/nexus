import { NEXUS_LEDGER_SCHEMA_VERSION, type NexusLedgerSchemaVersion } from './types';
import { isRecord } from './validation-helpers';

export function withLedgerSchemaVersion<T extends object>(
  record: T,
): T & { schema_version: NexusLedgerSchemaVersion } {
  const { schema_version: _ignored, ...rest } = record as T & { schema_version?: unknown };
  return {
    schema_version: NEXUS_LEDGER_SCHEMA_VERSION,
    ...rest,
  } as T & { schema_version: NexusLedgerSchemaVersion };
}

export function warnOnUnexpectedLedgerSchemaVersion(
  value: unknown,
  artifactLabel: string,
): void {
  if (!isRecord(value) || !('schema_version' in value)) {
    return;
  }

  const version = value.schema_version;
  if (version === NEXUS_LEDGER_SCHEMA_VERSION) {
    return;
  }

  console.warn(
    `[nexus] ${artifactLabel} schema_version=${String(version)}, expected ${NEXUS_LEDGER_SCHEMA_VERSION}`,
  );
}
