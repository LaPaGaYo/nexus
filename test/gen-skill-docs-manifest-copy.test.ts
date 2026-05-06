import { describe, expect, test, beforeAll } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

/**
 * Phase 5.5 (Track D-D3): verify gen-skill-docs copies nexus.skill.yaml
 * manifests to host install paths so the SkillRegistry can discover them
 * outside the source repo.
 *
 * Self-bootstraps via beforeAll: ensures the host install paths have been
 * generated, so this test does not depend on prior test execution order or
 * external CI setup.
 */

beforeAll(() => {
  // If host outputs don't exist, regenerate them so this test can verify
  // manifest copying. In CI, freshness check (skill:check) already covers
  // staleness; this is the safety net for clean checkouts.
  const sentinel = path.join(ROOT, '.agents/skills/nexus-build/SKILL.md');
  if (!fs.existsSync(sentinel)) {
    const { execFileSync } = require('child_process');
    execFileSync('bun', ['run', 'gen:skill-docs', '--host', 'codex'], { cwd: ROOT, stdio: 'pipe' });
    execFileSync('bun', ['run', 'gen:skill-docs', '--host', 'factory'], { cwd: ROOT, stdio: 'pipe' });
    execFileSync('bun', ['run', 'gen:skill-docs', '--host', 'gemini-cli'], { cwd: ROOT, stdio: 'pipe' });
  }
});

describe('Phase 5.5 — manifest copy to host install paths', () => {
  test('codex host receives nexus.skill.yaml alongside SKILL.md for canonical skills', () => {
    const buildManifest = path.join(ROOT, '.agents/skills/nexus-build/nexus.skill.yaml');
    const buildSkill = path.join(ROOT, '.agents/skills/nexus-build/SKILL.md');
    expect(fs.existsSync(buildSkill)).toBe(true);
    expect(fs.existsSync(buildManifest)).toBe(true);

    const content = fs.readFileSync(buildManifest, 'utf-8');
    expect(content).toContain('schema_version: 1');
    expect(content).toContain('name: build');
    expect(content).toContain('intent_keywords:');
    expect(content).toContain('lifecycle_stages: [build]');
  });

  test('factory host receives manifests for canonical skills', () => {
    const planManifest = path.join(ROOT, '.factory/skills/nexus-plan/nexus.skill.yaml');
    expect(fs.existsSync(planManifest)).toBe(true);
    const content = fs.readFileSync(planManifest, 'utf-8');
    expect(content).toContain('name: plan');
  });

  test('gemini-cli host receives manifests for canonical skills', () => {
    const reviewManifest = path.join(ROOT, '.gemini/skills/nexus-review/nexus.skill.yaml');
    expect(fs.existsSync(reviewManifest)).toBe(true);
    const content = fs.readFileSync(reviewManifest, 'utf-8');
    expect(content).toContain('name: review');
  });

  test('host install paths receive manifests for support, safety, root skills too', () => {
    expect(fs.existsSync(path.join(ROOT, '.agents/skills/nexus-cso/nexus.skill.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, '.agents/skills/nexus-careful/nexus.skill.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, '.agents/skills/nexus/nexus.skill.yaml'))).toBe(true);
  });

  test('manifest content matches between source and host install path (no transformation)', () => {
    const source = fs.readFileSync(path.join(ROOT, 'skills/canonical/build/nexus.skill.yaml'), 'utf-8');
    const dest = fs.readFileSync(path.join(ROOT, '.agents/skills/nexus-build/nexus.skill.yaml'), 'utf-8');
    expect(dest).toBe(source);
  });

  test('all 9 canonical skills have manifests in all 3 external host install paths', () => {
    const canonical = ['discover', 'frame', 'plan', 'handoff', 'build', 'review', 'qa', 'ship', 'closeout'];
    for (const skill of canonical) {
      for (const hostDir of ['.agents/skills', '.factory/skills', '.gemini/skills']) {
        const manifestPath = path.join(ROOT, hostDir, `nexus-${skill}`, 'nexus.skill.yaml');
        expect(fs.existsSync(manifestPath), `${manifestPath} should exist`).toBe(true);
      }
    }
  });
});
