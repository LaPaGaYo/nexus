import { randomBytes, createHash } from 'crypto';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(ms: number): string {
  let s = '';
  for (let i = 9; i >= 0; i--) {
    s = CROCKFORD[ms % 32] + s;
    ms = Math.floor(ms / 32);
  }
  return s;
}

function encodeRandom16(): string {
  const bytes = randomBytes(10);
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let s = '';
  for (let i = 0; i < 16; i++) {
    s = CROCKFORD[Number(bits & 31n)] + s;
    bits >>= 5n;
  }
  return s;
}

export function generateLearningId(): string {
  return 'lrn_' + encodeTime(Date.now()) + encodeRandom16();
}

export type ParsedLearningId =
  | { kind: 'ulid'; ulid: string }
  | { kind: 'legacy'; hash: string };

export function parseLearningId(id: string): ParsedLearningId {
  const ulidMatch = id.match(/^lrn_([0-9A-HJKMNP-TV-Z]{26})$/);
  if (ulidMatch) return { kind: 'ulid', ulid: ulidMatch[1] };
  const legacyMatch = id.match(/^legacy:([0-9a-f]{64})$/);
  if (legacyMatch) return { kind: 'legacy', hash: legacyMatch[1] };
  throw new Error(`invalid learning id: ${id}`);
}

export type LegacyEntryInput = {
  ts: string;
  skill?: string;
  type: string;
  key: string;
  insight: string;
  files?: string[];
};

export function deriveLegacyId(entry: LegacyEntryInput): string {
  const seed = [
    entry.ts,
    entry.skill ?? 'unknown',
    entry.type,
    entry.key,
    entry.insight,
    JSON.stringify(entry.files ?? []),
  ].join('|');
  const hash = createHash('sha256').update(seed).digest('hex');
  return `legacy:${hash}`;
}
