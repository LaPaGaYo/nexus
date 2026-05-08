import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ReviewScopeRecord, StageStatus } from '../contracts/types';

const GENERIC_FIX_CYCLE_ITEM = 'Resolve the failing review findings recorded in .planning/audits/current/ before rerunning /build.';
const GENERIC_QA_FIX_CYCLE_ITEM = 'Resolve the failing QA findings recorded in .planning/current/qa/qa-report.md before rerunning /build.';

export function fullAcceptanceReviewScope(): ReviewScopeRecord {
  return {
    mode: 'full_acceptance',
    source_stage: 'plan',
    blocking_items: [],
    advisory_policy: 'out_of_scope_advisory',
  };
}

function normalizeLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeSignature(text: string): string {
  return normalizeLine(text)
    .replace(/`/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTaskSignature(text: string): string | null {
  const taskMatch = text.match(/\b(?:phase\s+\d+\s+)?task\s+`?(\d+(?:\.\d+)*)`?/i);
  if (taskMatch) {
    return `task:${taskMatch[1]}`;
  }

  const conditionMatch = text.match(/\bcondition\s+`?(\d+(?:\.\d+)*)`?/i);
  if (conditionMatch) {
    return `condition:${conditionMatch[1]}`;
  }

  return null;
}

function extractRequirementSignature(text: string): string | null {
  const requirementMatch = text.match(/\brequires?\s+(.+?)(?:(?:,|\.)\s*|$)/i);
  if (requirementMatch) {
    return normalizeSignature(requirementMatch[1]!.replace(/^that\s+/i, ''));
  }

  if (/\bblank page at localhost\b/i.test(text)) {
    return 'blank page at localhost';
  }

  return null;
}

function canonicalBlockingItemKey(text: string): string {
  const normalized = normalizeLine(text);
  const taskSignature = extractTaskSignature(normalized);
  if (taskSignature) {
    return taskSignature;
  }

  const requirementSignature = extractRequirementSignature(normalized);
  if (/\bexit criterion\b/i.test(normalized) && requirementSignature) {
    return `exit:${requirementSignature}`;
  }

  if (requirementSignature) {
    return `requires:${requirementSignature}`;
  }

  return `line:${normalizeSignature(normalized)}`;
}

function dedupeBlockingItems(items: string[]): string[] {
  const deduped = new Map<string, string>();

  for (const item of items) {
    const normalized = normalizeLine(item);
    if (!normalized || normalized.toLowerCase() === 'none') {
      continue;
    }

    const key = canonicalBlockingItemKey(normalized);
    if (!deduped.has(key)) {
      deduped.set(key, normalized);
    }
  }

  return [...deduped.values()];
}

function extractFindingsSection(markdown: string): string[] {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const sectionMatch = normalized.match(/(?:^|\n)Findings:\s*\n([\s\S]*?)(?:\n[A-Z][A-Za-z ]+:\s*\n|$)/);
  if (!sectionMatch) {
    return [];
  }

  return sectionMatch[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => normalizeLine(line.slice(2)))
    .filter((line) => line.length > 0 && line.toLowerCase() !== 'none');
}

export function extractAdvisoriesSection(markdown: string): string[] {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const sectionMatch = normalized.match(/(?:^|\n)Advisories:\s*\n([\s\S]*?)(?:\n[A-Z][A-Za-z ]+:\s*\n|$)/i);
  const advisories: string[] = [];

  if (sectionMatch) {
    advisories.push(...sectionMatch[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => normalizeLine(line.slice(2)))
      .filter((line) => line.length > 0 && line.toLowerCase() !== 'none'));
  }

  for (const rawLine of normalized.split('\n')) {
    const bullet = rawLine.trim().match(/^[-*]\s+(.+)$/)?.[1];
    if (!bullet) {
      continue;
    }

    const advisoryMatch = bullet.match(/^advisory(?:\s+for\s+[^:]+)?(?:\s*\([^)]*\))?\s*:\s*(.+)$/i);
    if (advisoryMatch?.[1]) {
      advisories.push(normalizeLine(advisoryMatch[1]));
    }
  }

  return advisories.filter((line) => line.length > 0 && line.toLowerCase() !== 'none');
}

export function boundedFixCycleReviewScopeFromAudits(codexMarkdown: string, geminiMarkdown: string): ReviewScopeRecord {
  const blockingItems = dedupeBlockingItems([
    ...extractFindingsSection(codexMarkdown),
    ...extractFindingsSection(geminiMarkdown),
  ]);

  return normalizeReviewScopeRecord({
    mode: 'bounded_fix_cycle',
    source_stage: 'review',
    blocking_items: blockingItems.length > 0 ? blockingItems : [GENERIC_FIX_CYCLE_ITEM],
    advisory_policy: 'out_of_scope_advisory',
  });
}

export function boundedFixCycleReviewScopeFromQaFindings(findings: string[]): ReviewScopeRecord {
  const blockingItems = dedupeBlockingItems(findings);

  return normalizeReviewScopeRecord({
    mode: 'bounded_fix_cycle',
    source_stage: 'qa',
    blocking_items: blockingItems.length > 0 ? blockingItems : [GENERIC_QA_FIX_CYCLE_ITEM],
    advisory_policy: 'out_of_scope_advisory',
  });
}

export function boundedFixCycleReviewScopeFromAdvisories(codexMarkdown: string, geminiMarkdown: string): ReviewScopeRecord {
  const advisoryItems = dedupeBlockingItems([
    ...extractAdvisoriesSection(codexMarkdown),
    ...extractAdvisoriesSection(geminiMarkdown),
  ]);

  return normalizeReviewScopeRecord({
    mode: 'bounded_fix_cycle',
    source_stage: 'review',
    blocking_items: advisoryItems.length > 0 ? advisoryItems : [GENERIC_FIX_CYCLE_ITEM],
    advisory_policy: 'out_of_scope_advisory',
  });
}

export function normalizeReviewScopeRecord(reviewScope: ReviewScopeRecord): ReviewScopeRecord {
  const blockingItems = dedupeBlockingItems(reviewScope.blocking_items);

  return {
    ...reviewScope,
    blocking_items: blockingItems.length > 0 || reviewScope.mode !== 'bounded_fix_cycle'
      ? blockingItems
      : [GENERIC_FIX_CYCLE_ITEM],
  };
}

export function resolveFixCycleReviewScope(cwd: string, reviewStatus: StageStatus | null | undefined): ReviewScopeRecord {
  if (reviewStatus?.review_scope?.mode === 'bounded_fix_cycle') {
    return normalizeReviewScopeRecord(reviewStatus.review_scope);
  }

  const codexPath = join(cwd, '.planning/audits/current/codex.md');
  const geminiPath = join(cwd, '.planning/audits/current/gemini.md');
  const codexMarkdown = existsSync(codexPath) ? readFileSync(codexPath, 'utf8') : '';
  const geminiMarkdown = existsSync(geminiPath) ? readFileSync(geminiPath, 'utf8') : '';

  return boundedFixCycleReviewScopeFromAudits(codexMarkdown, geminiMarkdown);
}

export function resolveAdvisoryFixReviewScope(cwd: string): ReviewScopeRecord {
  const codexPath = join(cwd, '.planning/audits/current/codex.md');
  const geminiPath = join(cwd, '.planning/audits/current/gemini.md');
  const codexMarkdown = existsSync(codexPath) ? readFileSync(codexPath, 'utf8') : '';
  const geminiMarkdown = existsSync(geminiPath) ? readFileSync(geminiPath, 'utf8') : '';

  return boundedFixCycleReviewScopeFromAdvisories(codexMarkdown, geminiMarkdown);
}
