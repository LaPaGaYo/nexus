import { describe, expect, test } from 'bun:test';
import {
  generateAdversarialStep,
  generateCodexPlanReview,
  generateCodexSecondOpinion,
} from '../../../scripts/resolvers/review';
import { HOST_PATHS, type TemplateContext } from '../../../scripts/resolvers/types';

function ctx(skillName: string, host: TemplateContext['host'] = 'claude'): TemplateContext {
  return {
    skillName,
    tmplPath: `${skillName}/SKILL.md.tmpl`,
    host,
    paths: HOST_PATHS[host],
  };
}

describe('local-provider guards', () => {
  test('review Codex helpers check provider policy before checking the Codex binary', () => {
    for (const output of [
      generateCodexSecondOpinion(ctx('office-hours')),
      generateAdversarialStep(ctx('review')),
      generateCodexPlanReview(ctx('plan-eng-review')),
    ]) {
      expect(output).toContain('CODEX_SKIPPED_LOCAL_PROVIDER');
      expect(output).toContain('local_provider');
      expect(output).toContain('even if the binary exists');
      expect(output).toContain('elif which codex >/dev/null 2>&1');
    }
  });

  test('Codex host strips self-invoking Codex review helpers', () => {
    expect(generateCodexSecondOpinion(ctx('office-hours', 'codex'))).toBe('');
    expect(generateAdversarialStep(ctx('review', 'codex'))).toBe('');
    expect(generateCodexPlanReview(ctx('plan-eng-review', 'codex'))).toBe('');
  });
});
