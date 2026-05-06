import { discoverInstalledSkills } from '../skill-registry/discovery';
import { classifyIntent, classifyIntentAsync, formatOutcomeForTerminal, isLLMEnabled } from '../intent-classifier';
import type { IntentOutcome, ClassifyOptions } from '../intent-classifier/types';

/**
 * Phase 5 (Track D-D3): `nexus do "<free-form intent>"` dispatcher handler.
 *
 * This is a META-command, NOT a canonical lifecycle stage. It does NOT:
 *   - Write a stage artifact under `.planning/current/<stage>/`
 *   - Trigger governed adapters
 *   - Require user confirmation by itself (the dispatched skill may)
 *
 * It DOES:
 *   - Classify the intent against the skill registry's manifest keywords
 *   - Return a routing decision for the operator (or downstream code) to act on
 *   - Optionally write a `do-history.json` entry for transparency (caller's choice)
 */

export interface DoCommandOptions {
  /** The free-form intent string from the user. */
  intent: string;
  /** Working directory for skill discovery. */
  cwd: string;
  /** Override home dir for skill discovery (test-only). */
  home?: string;
  /** Override classification thresholds. */
  classify?: ClassifyOptions;
  /** When true, output is JSON; when false, human-readable. Default JSON. */
  json?: boolean;
}

export interface DoCommandResult {
  intent: string;
  outcome: IntentOutcome;
  /** Pre-formatted text for human display. */
  text: string;
}

export function runDoCommand(options: DoCommandOptions): DoCommandResult {
  const { intent, cwd, home, classify } = options;

  const skills = discoverInstalledSkills({ cwd, home });
  const outcome = classifyIntent(intent, skills, classify);
  const text = formatOutcomeForTerminal(outcome, intent);

  return {
    intent,
    outcome,
    text,
  };
}

/**
 * Async variant: optionally consults the LLM classifier when enabled
 * (NEXUS_INTENT_LLM=1 and not in local_provider mode). Falls through to
 * keyword-only path otherwise.
 *
 * Use this when the caller wants the LLM tiebreaker; otherwise prefer the
 * synchronous `runDoCommand` (faster, deterministic, no I/O).
 */
export async function runDoCommandAsync(options: DoCommandOptions): Promise<DoCommandResult> {
  const { intent, cwd, home, classify } = options;

  const skills = discoverInstalledSkills({ cwd, home });
  const outcome = isLLMEnabled()
    ? await classifyIntentAsync(intent, skills, classify)
    : classifyIntent(intent, skills, classify);
  const text = formatOutcomeForTerminal(outcome, intent);

  return {
    intent,
    outcome,
    text,
  };
}
