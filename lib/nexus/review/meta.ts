import { join } from 'path';
import { warnOnUnexpectedLedgerSchemaVersion, withLedgerSchemaVersion } from '../governance/ledger-schema';
import type { ReviewMetaRecord } from '../contracts/types';
import { readJsonFile } from '../io/validation-helpers';

export const CURRENT_REVIEW_META_PATH = '.planning/audits/current/meta.json';

export function buildReviewMetaWrite(record: ReviewMetaRecord): { path: string; content: string } {
  return {
    path: CURRENT_REVIEW_META_PATH,
    content: JSON.stringify(withLedgerSchemaVersion(record), null, 2) + '\n',
  };
}

export function readCurrentReviewMeta(
  cwd: string,
  path: string = CURRENT_REVIEW_META_PATH,
): ReviewMetaRecord | null {
  return readJsonFile(join(cwd, path), (value) => {
    warnOnUnexpectedLedgerSchemaVersion(value, path);
    return value as ReviewMetaRecord;
  });
}
