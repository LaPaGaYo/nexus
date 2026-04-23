import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { briefToPrompt, parseBrief, type DesignBrief } from '../src/brief';

describe('design brief prompt generation', () => {
  test('includes absorbed governance fields in the generated prompt', () => {
    const brief: DesignBrief = {
      goal: 'Workspace dashboard for product teams',
      audience: 'PMs and designers',
      style: 'Warm editorial SaaS with strong hierarchy',
      elements: ['project summary', 'activity rail', 'primary CTA'],
      constraints: 'Desktop-first with mobile adaptation',
      reference: 'DESIGN.md excerpt',
      narrative: 'From orientation to confident next action',
      brandCore: 'Calm technical trust with one warm accent',
      assetContext: ['Use frozen logo lockup', 'Use real product screenshots'],
      reviewLenses: ['hierarchy', 'craft', 'functional fit', 'distinctiveness'],
      avoid: ['generic card grid', 'purple gradients'],
      screenType: 'desktop-dashboard',
    };

    const prompt = briefToPrompt(brief);
    expect(prompt).toContain('Narrative arc: From orientation to confident next action.');
    expect(prompt).toContain('Brand core: Calm technical trust with one warm accent.');
    expect(prompt).toContain('Asset context: Use frozen logo lockup, Use real product screenshots.');
    expect(prompt).toContain('Optimize for these design lenses: hierarchy, craft, functional fit, distinctiveness.');
    expect(prompt).toContain('Avoid these patterns: generic card grid, purple gradients.');
  });

  test('parses JSON brief files with the expanded structure', () => {
    const tmpDir = `/tmp/brief-test-${Date.now()}`;
    fs.mkdirSync(tmpDir, { recursive: true });
    const briefPath = path.join(tmpDir, 'brief.json');
    fs.writeFileSync(briefPath, JSON.stringify({
      goal: 'Marketing homepage',
      audience: 'Developers',
      style: 'Technical and brand-forward',
      elements: ['hero', 'feature proof', 'cta'],
      brandCore: 'Precise, warm, and credible',
      screenType: 'landing-page',
    }));

    const prompt = parseBrief(briefPath, true);
    expect(prompt).toContain('Brand core: Precise, warm, and credible.');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
