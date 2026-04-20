import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { reviewAdvisoriesPath, reviewAdvisoryDispositionPath } from './artifacts';
import { extractAdvisoriesSection } from './review-scope';
import {
  REVIEW_ADVISORY_DISPOSITIONS,
  type ReviewAdvisoriesRecord,
  type ReviewAdvisoryDisposition,
  type ReviewAdvisoryDispositionRecord,
  type StageStatus,
} from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeAdvisory(advisory: string): string {
  return advisory.replace(/\s+/g, ' ').trim();
}

function dedupeAdvisories(advisories: string[]): string[] {
  const deduped = new Map<string, string>();

  for (const advisory of advisories) {
    const normalized = normalizeAdvisory(advisory);
    if (!normalized || normalized.toLowerCase() === 'none') {
      continue;
    }

    const key = normalized.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, normalized);
    }
  }

  return [...deduped.values()];
}

export function buildReviewAdvisoriesRecord(
  runId: string,
  generatedAt: string,
  codexMarkdown: string,
  geminiMarkdown: string,
): ReviewAdvisoriesRecord | null {
  const advisories = dedupeAdvisories([
    ...extractAdvisoriesSection(codexMarkdown),
    ...extractAdvisoriesSection(geminiMarkdown),
  ]);

  if (advisories.length === 0) {
    return null;
  }

  return {
    schema_version: 1,
    run_id: runId,
    generated_at: generatedAt,
    advisories,
  };
}

export function buildReviewAdvisoryDispositionRecord(
  runId: string,
  advisoryCount: number,
  selected: ReviewAdvisoryDisposition | null,
  selectedAt: string | null,
): ReviewAdvisoryDispositionRecord {
  return {
    schema_version: 1,
    run_id: runId,
    advisory_count: advisoryCount,
    selected,
    selected_at: selectedAt,
    available_options: [...REVIEW_ADVISORY_DISPOSITIONS],
  };
}

export function readReviewAdvisoryDisposition(
  cwd: string,
): ReviewAdvisoryDispositionRecord | null {
  const path = join(cwd, reviewAdvisoryDispositionPath());
  if (!existsSync(path)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!isObject(parsed)) {
    return null;
  }

  const selected = typeof parsed.selected === 'string'
    && (REVIEW_ADVISORY_DISPOSITIONS as readonly string[]).includes(parsed.selected)
    ? parsed.selected as ReviewAdvisoryDisposition
    : parsed.selected === null
      ? null
      : null;
  const advisoryCount = typeof parsed.advisory_count === 'number' && Number.isFinite(parsed.advisory_count)
    ? parsed.advisory_count
    : 0;

  return {
    schema_version: 1,
    run_id: typeof parsed.run_id === 'string' ? parsed.run_id : '',
    advisory_count: advisoryCount,
    selected,
    selected_at: typeof parsed.selected_at === 'string' ? parsed.selected_at : null,
    available_options: [...REVIEW_ADVISORY_DISPOSITIONS],
  };
}

export function readReviewAdvisories(cwd: string): ReviewAdvisoriesRecord | null {
  const path = join(cwd, reviewAdvisoriesPath());
  if (!existsSync(path)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!isObject(parsed) || !Array.isArray(parsed.advisories)) {
    return null;
  }

  return {
    schema_version: 1,
    run_id: typeof parsed.run_id === 'string' ? parsed.run_id : '',
    generated_at: typeof parsed.generated_at === 'string' ? parsed.generated_at : '',
    advisories: dedupeAdvisories(parsed.advisories.filter((value): value is string => typeof value === 'string')),
  };
}

export function reviewHasAdvisories(reviewStatus: StageStatus | null | undefined): boolean {
  return (reviewStatus?.advisory_count ?? 0) > 0;
}

export function effectiveReviewAdvisoryDisposition(
  cwd: string,
  reviewStatus: StageStatus | null | undefined,
  override: ReviewAdvisoryDisposition | null | undefined,
): ReviewAdvisoryDisposition | null {
  if (override) {
    return override;
  }

  if (reviewStatus?.advisory_disposition) {
    return reviewStatus.advisory_disposition;
  }

  return readReviewAdvisoryDisposition(cwd)?.selected ?? null;
}

export function persistReviewAdvisoryDisposition(
  cwd: string,
  record: ReviewAdvisoryDispositionRecord,
): void {
  const path = join(cwd, reviewAdvisoryDispositionPath());
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(record, null, 2) + '\n');
}

export function advisoryDispositionPermitsStage(
  stage: 'build' | 'qa' | 'ship' | 'closeout',
  disposition: ReviewAdvisoryDisposition | null,
): boolean {
  if (stage === 'build') {
    return disposition === 'fix_before_qa';
  }

  return disposition === 'continue_to_qa' || disposition === 'defer_to_follow_on';
}

export function requiredReviewAdvisoryDispositionError(
  stage: 'build' | 'qa' | 'ship' | 'closeout',
): string {
  if (stage === 'build') {
    return 'Review advisories require an explicit fix decision before build. Re-run /build with --review-advisory-disposition fix_before_qa.';
  }

  return `Review advisories require an explicit disposition before ${stage}. Re-run /${stage} with --review-advisory-disposition continue_to_qa or --review-advisory-disposition defer_to_follow_on, or run /build with --review-advisory-disposition fix_before_qa.`;
}
