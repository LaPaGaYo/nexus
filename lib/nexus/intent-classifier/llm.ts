import type { SkillRecord } from '../skill-registry/types';
import type { IntentCandidate, IntentOutcome } from './types';

/**
 * Phase 5 LLM classifier hook (Track D-D3).
 *
 * The LLM classifier is **opt-in** via `NEXUS_INTENT_LLM=1`. It is purely
 * additive — the keyword classifier (deterministic, offline, no I/O) is the
 * baseline. LLM is only consulted as a tiebreaker when the keyword classifier
 * returns `ambiguous`.
 *
 * Cross-host behavior (per Phase 5 brief § "Cross-host behavior"):
 *
 *   - LLM defaults to the user's *active host's* provider (Claude → Claude
 *     API, Codex → OpenAI API, Gemini → Gemini API). This is NOT a new
 *     privacy boundary — the user is already talking to that provider via
 *     the host. The classifier is one extra small call on a path the user
 *     is already using.
 *   - Cross-provider routing via CCB is explicitly OPT-IN (a future env var,
 *     not in this PR's scope).
 *   - `local_provider` mode forces keyword-only path (see `isLocalProviderMode`).
 *
 * Implementation strategy:
 *
 *   1. Define a generic `LLMClassifier` interface (this file).
 *   2. Default implementation is a no-op that returns `no_match`. This
 *      preserves the keyword-only outcome when no real LLM classifier is
 *      registered.
 *   3. Real implementations (e.g., Claude API caller, OpenAI caller) are
 *      injected via `registerLLMClassifier()` at runtime — typically by
 *      the host adapter that knows which provider to target.
 *   4. Tests verify the wiring (no-op fallback, env-gating, registration)
 *      without requiring a real network call.
 */

export interface LLMClassifier {
  /**
   * Given an intent string and the candidate skill set, return a routing
   * outcome. Implementations are async because LLM calls are network I/O.
   *
   * Implementations SHOULD:
   *   - Use the host's existing provider (no cross-provider by default)
   *   - Bound the call with a short timeout (e.g., 5s)
   *   - Return `no_match` on any error (fail closed; never hide errors)
   */
  classify(intent: string, skills: readonly SkillRecord[]): Promise<IntentOutcome>;

  /** Human-readable identifier (for logs / advisor records). */
  readonly name: string;
}

/**
 * No-op classifier returned when nothing is registered. Preserves the
 * keyword-classifier outcome unchanged.
 */
export const NO_OP_LLM_CLASSIFIER: LLMClassifier = {
  name: 'no-op',
  async classify(_intent: string, _skills: readonly SkillRecord[]): Promise<IntentOutcome> {
    return { kind: 'no_match', closest: [] };
  },
};

let registeredClassifier: LLMClassifier = NO_OP_LLM_CLASSIFIER;

/**
 * Register a real LLM classifier. Called by the host adapter at startup
 * after the provider is determined. Subsequent `classifyIntentAsync` calls
 * route through the registered implementation.
 *
 * Idempotent: re-registering replaces the previous classifier. Useful for
 * tests via `restoreLLMClassifier()`.
 */
export function registerLLMClassifier(classifier: LLMClassifier): void {
  registeredClassifier = classifier;
}

/**
 * Reset to the no-op classifier. Used by tests.
 */
export function restoreLLMClassifier(): void {
  registeredClassifier = NO_OP_LLM_CLASSIFIER;
}

export function getLLMClassifier(): LLMClassifier {
  return registeredClassifier;
}

/**
 * Whether the LLM classifier path is enabled for this run.
 *
 * Default: false (keyword-only path).
 *
 * Enabled when `NEXUS_INTENT_LLM=1` AND `local_provider` mode is NOT active.
 * `local_provider` mode is the user's explicit "minimize calls" choice;
 * the LLM call is incompatible with that choice.
 */
export function isLLMEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NEXUS_INTENT_LLM !== '1') return false;
  if (isLocalProviderMode(env)) return false;
  return true;
}

/**
 * Detect `local_provider` execution mode (vs `governed_ccb`).
 *
 * Reads `NEXUS_EXECUTION_MODE=local_provider` if set explicitly. When unset,
 * defaults to false (treat as governed_ccb). Real callers should consult the
 * full ledger state via `lib/nexus/adapters/registry`, but for the LLM
 * env-gating use-case the env var is sufficient and avoids an I/O dependency.
 */
export function isLocalProviderMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NEXUS_EXECUTION_MODE === 'local_provider';
}

/**
 * Decide whether the LLM tiebreaker should be invoked given the keyword
 * outcome. Currently: only when keyword is `ambiguous`. Confident matches
 * stand on their own; no_match is preserved (the LLM cannot rescue truly
 * out-of-scope intents).
 */
export function shouldConsultLLM(keywordOutcome: IntentOutcome): boolean {
  return keywordOutcome.kind === 'ambiguous';
}

/**
 * Choose between the keyword outcome and the LLM outcome.
 *
 * Policy: prefer LLM only if it returned `confident_match` AND the chosen
 * skill is among the keyword candidates. This keeps LLM as a tiebreaker
 * within the keyword-shortlisted set; the LLM cannot inject a skill the
 * keyword classifier didn't see.
 */
export function mergeLLMOutcome(
  keywordOutcome: IntentOutcome,
  llmOutcome: IntentOutcome,
): IntentOutcome {
  if (llmOutcome.kind !== 'confident_match') {
    return keywordOutcome;
  }
  if (keywordOutcome.kind !== 'ambiguous') {
    return keywordOutcome;
  }
  const inShortlist = keywordOutcome.candidates.some(
    (c: IntentCandidate) => c.name === llmOutcome.chosen.name,
  );
  if (!inShortlist) {
    return keywordOutcome;
  }
  return {
    kind: 'confident_match',
    chosen: llmOutcome.chosen,
    candidates: keywordOutcome.candidates,
  };
}
