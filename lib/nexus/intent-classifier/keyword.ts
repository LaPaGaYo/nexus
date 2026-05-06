import type { SkillRecord } from '../skill-registry/types';
import type { IntentCandidate } from './types';

/**
 * Phase 5 (Track D-D3): keyword-based intent classifier.
 *
 * Deterministic, offline, pure function. Same intent → same scoring across runs.
 * No NLP libs, no LLM calls — only normalized string matching.
 */

interface ScoringWeights {
  exactMatch: number;       // intent contains the exact keyword as a phrase
  substringMatch: number;   // keyword found as substring (whole-word boundary)
  stemMatch: number;        // keyword's stem found in intent (basic English suffix strip)
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  exactMatch: 5,
  substringMatch: 3,
  stemMatch: 2,
};

/**
 * Score a single skill against an intent string. Returns null if no keyword
 * matches (skill should be excluded from results).
 */
export function scoreSkillForIntent(
  skill: SkillRecord,
  intent: string,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): IntentCandidate | null {
  const normalizedIntent = normalize(intent);
  const intentWords = new Set(tokenize(normalizedIntent));

  if (skill.manifest) {
    return scoreManifest(skill, normalizedIntent, intentWords, weights);
  }

  // Heuristic fallback: skill has no manifest. Match against description.
  return scoreHeuristic(skill, normalizedIntent, weights);
}

function scoreManifest(
  skill: SkillRecord,
  normalizedIntent: string,
  intentWords: Set<string>,
  weights: ScoringWeights,
): IntentCandidate | null {
  const manifest = skill.manifest;
  if (!manifest) return null;

  let score = 0;
  const matched: string[] = [];

  for (const keyword of manifest.intent_keywords) {
    const normKw = normalize(keyword);
    const kwWords = tokenize(normKw);

    // Phrase match (exact substring of multi-word keyword)
    if (kwWords.length > 1 && normalizedIntent.includes(normKw)) {
      score += weights.exactMatch;
      matched.push(keyword);
      continue;
    }

    // Whole-word substring (single keyword inside intent)
    if (kwWords.length === 1) {
      if (intentWords.has(kwWords[0])) {
        score += weights.exactMatch;
        matched.push(keyword);
        continue;
      }
      // Stem match: kwWords[0] without suffix vs any intent word's stem
      const kwStem = stem(kwWords[0]);
      let stemMatched = false;
      for (const intentWord of intentWords) {
        if (stem(intentWord) === kwStem) {
          stemMatched = true;
          break;
        }
      }
      if (stemMatched) {
        score += weights.stemMatch;
        matched.push(keyword);
        continue;
      }
    }

    // Partial phrase: any kwWord found in intent
    if (kwWords.length > 1) {
      const partialMatches = kwWords.filter((w) => intentWords.has(w));
      if (partialMatches.length > 0) {
        score += weights.substringMatch * (partialMatches.length / kwWords.length);
        matched.push(keyword);
      }
    }
  }

  if (score === 0) return null;

  // Apply manifest base_score override
  if (manifest.ranking?.base_score !== undefined) {
    score += manifest.ranking.base_score;
  }

  // Apply manifest boosts
  if (manifest.ranking?.boosts) {
    for (const boost of manifest.ranking.boosts) {
      if (boost.tag && intentWords.has(normalize(boost.tag))) {
        score += boost.delta;
      }
    }
  }

  return {
    name: skill.name,
    surface: `/${skill.name}`,
    namespace: skill.manifest.classification?.namespace ?? skill.namespace,
    score,
    matched_keywords: matched,
    manifest_backed: true,
  };
}

function scoreHeuristic(
  skill: SkillRecord,
  normalizedIntent: string,
  _weights: ScoringWeights,
): IntentCandidate | null {
  const description = (skill.description ?? '').toLowerCase();
  if (!description) return null;

  // Crude heuristic: check if any noun-like word in intent appears in description
  const intentWords = tokenize(normalizedIntent).filter((w) => w.length > 3);
  let hits = 0;
  for (const word of intentWords) {
    if (description.includes(word)) hits++;
  }
  if (hits === 0) return null;

  return {
    name: skill.name,
    surface: `/${skill.name}`,
    namespace: skill.namespace,
    score: hits, // 1 point per word match for heuristic — capped low
    matched_keywords: [],
    manifest_backed: false,
  };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(/\s+/).filter(Boolean);
}

/**
 * Trivial English stemmer: strip common suffixes. Not full Porter stemmer —
 * sufficient for keyword matching, deterministic, no dependencies.
 */
function stem(word: string): string {
  const lower = word.toLowerCase();
  if (lower.length <= 3) return lower;
  for (const suffix of ['ing', 'ies', 'ed', 'es', 'ly', 's']) {
    if (lower.endsWith(suffix) && lower.length - suffix.length >= 3) {
      return lower.slice(0, -suffix.length);
    }
  }
  return lower;
}
