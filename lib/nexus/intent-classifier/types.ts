import type { InstalledSkillNamespace } from '../types';

/**
 * Phase 5 (Track D-D3): intent classification for `nexus do <intent>`.
 *
 * The classifier is a pure function over intent string + skill registry.
 * Determinism is the design goal — same input → same output.
 */

export interface IntentCandidate {
  /** Skill name (matches manifest.name and SKILL.md frontmatter). */
  name: string;
  /** Slash-form for display. */
  surface: string;
  /** Manifest namespace (or 'external_installed' for unmanifested skills). */
  namespace: InstalledSkillNamespace;
  /** Final score after keyword matching + boosts. Higher = more relevant. */
  score: number;
  /** Which `intent_keywords` from the manifest matched. */
  matched_keywords: readonly string[];
  /** True if scoring used a manifest; false if heuristic fallback (description match). */
  manifest_backed: boolean;
}

export type IntentOutcome =
  | { kind: 'confident_match'; chosen: IntentCandidate; candidates: readonly IntentCandidate[] }
  | { kind: 'ambiguous'; candidates: readonly IntentCandidate[] }
  | { kind: 'no_match'; closest: readonly IntentCandidate[] };

export interface ClassifyOptions {
  /**
   * Top score must exceed this to be considered a confident match.
   * Default 10 (per Phase 5 brief).
   */
  confidentThreshold?: number;
  /**
   * Minimum score for any candidate to be surfaced.
   * Below this, candidate is filtered out entirely.
   * Default 5 (per Phase 5 brief).
   */
  minScore?: number;
  /**
   * Top-1 must be this many times higher than top-2 to be confident.
   * Default 1.5 (per Phase 5 brief).
   */
  topRatio?: number;
  /**
   * Limit on number of candidates returned in ambiguous / no_match outcomes.
   * Default 5.
   */
  candidateLimit?: number;
}
