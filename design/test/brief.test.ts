import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { briefToPrompt, parseBrief, qualityChecklistForBrief, resolveBriefInput, type DesignBrief } from '../src/brief';

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

  test('prototype briefs add interaction-oriented guidance', () => {
    const brief: DesignBrief = {
      goal: 'Mobile workspace prototype',
      audience: 'Operations managers',
      style: 'Quiet, iOS-native, confidence-building',
      elements: ['bottom nav', 'detail sheet', 'primary action'],
      screenType: 'mobile-app',
      deliverableType: 'prototype',
      interactionModel: 'Bottom nav with drill-in detail panel',
      exportTargets: ['png', 'html'],
    };

    const prompt = briefToPrompt(brief);
    expect(prompt).toContain('Generate a pixel-perfect product prototype frame');
    expect(prompt).toContain('Interaction model: Bottom nav with drill-in detail panel.');
    expect(prompt).toContain('Treat this as a believable interactive product prototype, not a marketing poster.');
  });

  test('motion briefs produce storyboard guidance instead of app-screen guidance', () => {
    const brief: DesignBrief = {
      goal: 'Launch film for a productivity feature',
      audience: 'Product marketers',
      style: 'Luminous, atmospheric, cinematic',
      elements: ['title card', 'feature reveal', 'product payoff'],
      screenType: 'storyboard-panel',
      deliverableType: 'motion',
      storyBeats: ['hook', 'reveal', 'payoff'],
      exportTargets: ['png', 'mp4', 'gif'],
    };

    const prompt = briefToPrompt(brief);
    expect(prompt).toContain('Generate a motion-design storyboard or keyframe composition');
    expect(prompt).toContain('Story beats: hook, reveal, payoff.');
    expect(prompt).toContain('Treat this as a motion-design storyboard or keyframe sheet, not a dashboard screenshot.');
  });

  test('infographic briefs produce information-design guidance and checklist', () => {
    const brief: DesignBrief = {
      goal: 'Quarterly revenue mix infographic',
      audience: 'Investors',
      style: 'Editorial, precise, sober',
      elements: ['headline metric', 'segment chart', 'source note'],
      screenType: 'editorial-infographic',
      deliverableType: 'infographic',
      dataContext: 'Revenue split by segment with year-over-year deltas',
    };

    const prompt = briefToPrompt(brief);
    expect(prompt).toContain('Generate a polished infographic composition');
    expect(prompt).toContain('Data context: Revenue split by segment with year-over-year deltas.');
    expect(prompt).toContain('Treat this as information design, not a product screen.');

    const checklist = qualityChecklistForBrief(brief);
    expect(checklist.at(-1)).toContain('data hierarchy');
  });

  test('resolveBriefInput returns structured brief metadata for file-based deliverables', () => {
    const tmpDir = `/tmp/brief-resolve-${Date.now()}`;
    fs.mkdirSync(tmpDir, { recursive: true });
    const briefPath = path.join(tmpDir, 'brief.json');
    fs.writeFileSync(briefPath, JSON.stringify({
      goal: 'Executive keynote slide',
      audience: 'Board members',
      style: 'Restrained premium editorial',
      elements: ['title', 'single chart', 'takeaway'],
      screenType: 'presentation-slide',
      deliverableType: 'slides',
      canvas: '16:9 keynote slide',
      exportTargets: ['png', 'pptx'],
    }));

    const resolved = resolveBriefInput(briefPath, true);
    expect(resolved.structuredBrief?.deliverableType).toBe('slides');
    expect(resolved.prompt).toContain('presentation slide');
    expect(resolved.prompt).toContain('Canvas: 16:9 keynote slide.');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
