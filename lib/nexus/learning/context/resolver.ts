// lib/nexus/learning/context/resolver.ts
import { join } from 'path';
import { homedir } from 'os';
import {
  readLearningsJsonl, readStageCandidatesFile, readCanonicalLearningsFile, walkArchiveRunLearnings,
} from '../../index';
import type { NormalizedEntry } from '../normalize';
import { scoreEntry, computeBoostDeltas, applyBoost } from './ranking';
import { capPacket } from './packet';
import { buildLearningContextRecord, writeLearningContextRecord } from './record';
import {
  DEFAULT_LEARNING_CONTEXT_CONFIG, type LearningContextInput, type LearningContextResult,
  type ScoredEntry,
} from './types';

function gatherEntries(input: LearningContextInput, home: string, warnings: string[]): NormalizedEntry[] {
  const out: NormalizedEntry[] = [];
  const jsonlPath = join(home, '.nexus', 'projects', input.projectSlug, 'learnings.jsonl');
  try { out.push(...readLearningsJsonl(jsonlPath)); }
  catch (e) { warnings.push(`jsonl read failed: ${(e as Error).message}`); }

  try {
    const canon = readCanonicalLearningsFile(join(input.cwd, '.planning', 'current', 'closeout', 'learnings.json'));
    if (canon) out.push(...(canon.learnings as unknown as NormalizedEntry[]));
  } catch (e) { warnings.push(`canonical read failed: ${(e as Error).message}`); }

  try {
    const stageRec = readStageCandidatesFile(
      join(input.cwd, '.planning', 'current', input.stage, 'learning-candidates.json'),
    );
    if (stageRec) out.push(...(stageRec.candidates as unknown as NormalizedEntry[]));
  } catch (e) { warnings.push(`stage candidates read failed: ${(e as Error).message}`); }

  try { for (const r of walkArchiveRunLearnings(input.cwd)) out.push(...(r.learnings as unknown as NormalizedEntry[])); }
  catch (e) { warnings.push(`archive walk failed: ${(e as Error).message}`); }

  return out;
}

export function resolveLearningContext(input: LearningContextInput): LearningContextResult {
  const home = input.home ?? homedir();
  const config = input.config ?? DEFAULT_LEARNING_CONTEXT_CONFIG;
  const warnings: string[] = [];
  const stage = input.stage;

  try {
    if (!config || !config.weights || typeof config.weights.relevance !== 'number') {
      throw new Error('invalid learning_context config');
    }
    const all = gatherEntries(input, home, warnings);
    const skillNames = input.naturalRanking.map((s) => s.name);
    const ctx = { stage, changedFiles: input.changedFiles, skillNames, now: input.now };

    const scored: ScoredEntry[] = all.map((e) => scoreEntry(e, all, ctx, config));
    const { packet, dropped } = capPacket(scored, {
      score_floor: config.score_floor, max_entries: config.max_entries, token_budget: config.token_budget,
    });

    const boosts = computeBoostDeltas(packet, { boost_cap: config.boost_cap, boost_scale: config.boost_scale });
    const { boosted, disagreements } = applyBoost(input.naturalRanking, boosts);

    const status = warnings.length > 0 ? 'degraded' : 'ok';
    const record = buildLearningContextRecord({
      stage, runId: input.runId, projectSlug: input.projectSlug, config, status, warnings,
      packet, dropped, boosts, disagreements,
      generatedAt: new Date(input.now ?? Date.now()).toISOString(),
    });
    const recordPath = writeLearningContextRecord(input.cwd, stage, record);
    return { boostedRanking: boosted, packet, recordPath, status, warnings };
  } catch (e) {
    const failPath = join(input.cwd, '.planning', 'current', stage, 'learning-context.json');
    try {
      const rec = buildLearningContextRecord({
        stage, runId: input.runId, projectSlug: input.projectSlug,
        config: config ?? DEFAULT_LEARNING_CONTEXT_CONFIG,
        status: 'failed', warnings: [...warnings, `resolver failed: ${(e as Error).message}`],
        packet: [], dropped: { below_floor: 0, over_cap: 0 }, boosts: [], disagreements: [],
        generatedAt: new Date(input.now ?? Date.now()).toISOString(),
      });
      writeLearningContextRecord(input.cwd, stage, rec);
    } catch { /* never let evidence-write block degrade path */ }
    return {
      boostedRanking: input.naturalRanking, packet: [], recordPath: failPath,
      status: 'failed', warnings: [...warnings, `resolver failed: ${(e as Error).message}`],
    };
  }
}
