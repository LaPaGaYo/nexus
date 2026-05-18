// lib/nexus/learning/context/match.ts
import { basename } from 'path';
import type { NormalizedEntry } from '../normalize';
import type { LearningContextStage } from './types';

const LIFECYCLE_ORDER: LearningContextStage[] = [
  'discover', 'frame', 'plan', 'handoff', 'build', 'review', 'qa', 'ship', 'closeout',
];

/** |changedFiles ∩ entry.files| / |entry.files|, 0 when entry.files empty. */
export function fileOverlap(entryFiles: string[], changedFiles: string[]): number {
  if (!entryFiles || entryFiles.length === 0) return 0;
  const changed = new Set(changedFiles);
  let hit = 0;
  for (const f of entryFiles) if (changed.has(f)) hit += 1;
  return hit / entryFiles.length;
}

/** 1 exact, 0.5 immediately adjacent in canonical lifecycle, else 0. */
export function stageMatch(ctxStage: LearningContextStage, subjectStage: string | undefined): number {
  if (!subjectStage) return 0;
  if (subjectStage === ctxStage) return 1;
  const ci = LIFECYCLE_ORDER.indexOf(ctxStage);
  const si = LIFECYCLE_ORDER.indexOf(subjectStage as LearningContextStage);
  if (ci < 0 || si < 0) return 0;
  return Math.abs(ci - si) === 1 ? 0.5 : 0;
}

function tokens(s: string): Set<string> {
  return new Set(
    (s || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3),
  );
}

export interface RelevanceCtx {
  stage: LearningContextStage;
  changedFiles: string[];
  skillNames: string[];
}

/** Jaccard of entry {key,insight,subject_skill} tokens vs ctx {stage, file basenames, skill names}. */
export function relevance(entry: NormalizedEntry, ctx: RelevanceCtx): number {
  const left = tokens(
    [entry.key, entry.insight, (entry as { subject_skill?: string }).subject_skill ?? ''].join(' '),
  );
  const right = tokens(
    [ctx.stage, ...ctx.changedFiles.map((f) => basename(f)), ...ctx.skillNames].join(' '),
  );
  if (left.size === 0 || right.size === 0) return 0;
  let inter = 0;
  for (const t of left) if (right.has(t)) inter += 1;
  const union = left.size + right.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 1 if any other entry in the set supersedes this entry's id; else 0. */
export function contradictionRisk(entry: NormalizedEntry, all: NormalizedEntry[]): number {
  const id = entry.id;
  if (!id) return 0;
  for (const other of all) {
    if (other === entry) continue;
    const sup = (other as { supersedes?: string[] }).supersedes;
    if (Array.isArray(sup) && sup.includes(id)) return 1;
  }
  return 0;
}
