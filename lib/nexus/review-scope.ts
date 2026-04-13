import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ReviewScopeRecord, StageStatus } from './types';

const GENERIC_FIX_CYCLE_ITEM = 'Resolve the failing review findings recorded in .planning/audits/current/ before rerunning /build.';

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

export function boundedFixCycleReviewScopeFromAudits(codexMarkdown: string, geminiMarkdown: string): ReviewScopeRecord {
  const blockingItems = [...new Set([
    ...extractFindingsSection(codexMarkdown),
    ...extractFindingsSection(geminiMarkdown),
  ])];

  return {
    mode: 'bounded_fix_cycle',
    source_stage: 'review',
    blocking_items: blockingItems.length > 0 ? blockingItems : [GENERIC_FIX_CYCLE_ITEM],
    advisory_policy: 'out_of_scope_advisory',
  };
}

export function resolveFixCycleReviewScope(cwd: string, reviewStatus: StageStatus | null | undefined): ReviewScopeRecord {
  if (reviewStatus?.review_scope?.mode === 'bounded_fix_cycle') {
    return reviewStatus.review_scope;
  }

  const codexPath = join(cwd, '.planning/audits/current/codex.md');
  const geminiPath = join(cwd, '.planning/audits/current/gemini.md');
  const codexMarkdown = existsSync(codexPath) ? readFileSync(codexPath, 'utf8') : '';
  const geminiMarkdown = existsSync(geminiPath) ? readFileSync(geminiPath, 'utf8') : '';

  return boundedFixCycleReviewScopeFromAudits(codexMarkdown, geminiMarkdown);
}
