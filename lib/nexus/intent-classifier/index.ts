import type { SkillRecord } from '../skill-registry/types';
import { scoreSkillForIntent } from './keyword';
import {
  getLLMClassifier,
  isLLMEnabled,
  mergeLLMOutcome,
  shouldConsultLLM,
} from './llm';
import type { ClassifyOptions, IntentCandidate, IntentOutcome } from './types';

export type { IntentCandidate, IntentOutcome, ClassifyOptions } from './types';
export { scoreSkillForIntent } from './keyword';
export {
  NO_OP_LLM_CLASSIFIER,
  getLLMClassifier,
  isLLMEnabled,
  isLocalProviderMode,
  registerLLMClassifier,
  restoreLLMClassifier,
  type LLMClassifier,
} from './llm';

const DEFAULT_OPTIONS: Required<ClassifyOptions> = {
  // Tuned for the current Phase 4 manifest keyword density (4-5 keywords/skill).
  // A single exact keyword match scores 5 (per keyword.ts weights), which is
  // already a strong signal. As manifests expand to 8-12 keywords/skill, this
  // can tighten to 8-10 (per Phase 5 brief default proposal).
  confidentThreshold: 5,
  // Below this score, candidate is filtered as noise (heuristic ~1, single
  // partial-phrase ~3).
  minScore: 4,
  // Top-1 must be 1.5× top-2 to claim confident match.
  topRatio: 1.5,
  candidateLimit: 5,
};

/**
 * Phase 5 (Track D-D3): classify a free-form intent string into a routing
 * decision over the SkillRegistry. Pure function — same input → same output.
 *
 * Returns one of:
 *   - confident_match: clear winner (score ≥ confidentThreshold AND
 *     top-1 > top-2 × topRatio)
 *   - ambiguous: top score reached confidentThreshold but tie/cluster, OR
 *     top score reached minScore but is below confidentThreshold
 *   - no_match: no skill scored at minScore
 */
export function classifyIntent(
  intent: string,
  skills: readonly SkillRecord[],
  options: ClassifyOptions = {},
): IntentOutcome {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!intent.trim()) {
    return { kind: 'no_match', closest: [] };
  }

  const candidates: IntentCandidate[] = [];
  for (const skill of skills) {
    const candidate = scoreSkillForIntent(skill, intent);
    if (candidate !== null) {
      candidates.push(candidate);
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const passing = candidates.filter((c) => c.score >= opts.minScore);
  const closest = candidates.slice(0, opts.candidateLimit);

  if (passing.length === 0) {
    return { kind: 'no_match', closest };
  }

  const top = passing[0]!;
  const second = passing[1];

  // Confident: top score crossed confidentThreshold AND clearly beats #2
  if (top.score >= opts.confidentThreshold) {
    if (!second || top.score >= second.score * opts.topRatio) {
      return {
        kind: 'confident_match',
        chosen: top,
        candidates: passing.slice(0, opts.candidateLimit),
      };
    }
    // Confident threshold reached but cluster — fall through to ambiguous
  }

  return {
    kind: 'ambiguous',
    candidates: passing.slice(0, opts.candidateLimit),
  };
}

/**
 * Async classification: keyword path first, optionally consults the LLM
 * classifier as a tiebreaker on `ambiguous` outcomes (when LLM is enabled
 * via `NEXUS_INTENT_LLM=1` and not in `local_provider` mode).
 *
 * Returns the same `IntentOutcome` shape as the synchronous classifier.
 * Callers that don't need LLM should keep using `classifyIntent` directly
 * (faster, deterministic, no I/O).
 */
export async function classifyIntentAsync(
  intent: string,
  skills: readonly SkillRecord[],
  options: ClassifyOptions = {},
): Promise<IntentOutcome> {
  const keywordOutcome = classifyIntent(intent, skills, options);
  if (!isLLMEnabled() || !shouldConsultLLM(keywordOutcome)) {
    return keywordOutcome;
  }
  try {
    const llmOutcome = await getLLMClassifier().classify(intent, skills);
    return mergeLLMOutcome(keywordOutcome, llmOutcome);
  } catch {
    // Fail closed: if the LLM call throws, fall back to keyword outcome.
    // The LLM classifier itself is responsible for timeouts and error handling.
    return keywordOutcome;
  }
}

/**
 * Format an outcome for human-readable terminal output.
 * Caller controls display; this is the canonical English copy.
 */
export function formatOutcomeForTerminal(outcome: IntentOutcome, intent: string): string {
  if (outcome.kind === 'confident_match') {
    const c = outcome.chosen;
    return `Matched ${c.surface} (${c.namespace}, score ${c.score}).\nKeywords matched: ${c.matched_keywords.join(', ') || '(heuristic)'}`;
  }
  if (outcome.kind === 'ambiguous') {
    const lines = [`Multiple candidates for: "${intent}"`, ''];
    outcome.candidates.forEach((c, i) => {
      lines.push(`  ${i + 1}. ${c.surface}  (${c.namespace}, score ${c.score})`);
    });
    lines.push('', 'Pick one with --pick=N or refine the intent.');
    return lines.join('\n');
  }
  // no_match
  const lines = [`Out of scope.`, '', `I matched no skills with high confidence for: "${intent}"`];
  if (outcome.closest.length > 0) {
    lines.push('', 'Closest candidates (low confidence):');
    for (const c of outcome.closest) {
      lines.push(`  ${c.surface}    (score ${c.score}) — ${c.namespace}`);
    }
  }
  lines.push('', 'If this should be a Nexus skill, see docs/skill-manifest-schema.md.');
  return lines.join('\n');
}
