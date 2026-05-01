import { describe, expect, test } from 'bun:test';
import {
  assertCanonicalTailLedger,
  RunLedgerCanonicalError,
} from '../../lib/nexus/governance';
import type { RunLedger } from '../../lib/nexus/types';

describe('nexus governance canonical errors', () => {
  test('preserves gate wording while exposing a stable diagnostic code', () => {
    const ledger = {
      command_history: [
        { at: '2026-04-30T00:00:00.000Z', command: 'plan', via: null, extra: true },
      ],
      execution: { mode: 'local_provider' },
    } as unknown as RunLedger;

    try {
      assertCanonicalTailLedger(ledger, 'QA');
      throw new Error('expected canonical ledger assertion to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(RunLedgerCanonicalError);
      expect((error as RunLedgerCanonicalError).code).toBe('command_history_entry_keys');
      expect((error as Error).message).toContain('Run ledger is not canonical before QA');
    }
  });
});
