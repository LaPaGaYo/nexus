import { describe, test, expect } from 'bun:test';
import { COMMAND_DESCRIPTIONS } from '../browse/src/commands';
import { SNAPSHOT_FLAGS } from '../browse/src/snapshot';
import { CANONICAL_MANIFEST, LEGACY_ALIASES } from '../lib/nexus/command-manifest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const MAX_SKILL_DESCRIPTION_LENGTH = 1024;

function extractDescription(content: string): string {
  const fmEnd = content.indexOf('\n---', 4);
  expect(fmEnd).toBeGreaterThan(0);
  const frontmatter = content.slice(4, fmEnd);
  const lines = frontmatter.split('\n');
  let description = '';
  let inDescription = false;
  const descLines: string[] = [];

  for (const line of lines) {
    if (line.match(/^description:\s*\|?\s*$/)) {
      inDescription = true;
      continue;
    }
    if (line.match(/^description:\s*\S/)) {
      return line.replace(/^description:\s*/, '').trim();
    }
    if (inDescription) {
      if (line === '' || line.match(/^\s/)) {
        descLines.push(line.replace(/^  /, ''));
      } else {
        break;
      }
    }
  }

  if (descLines.length > 0) {
    description = descLines.join('\n').trim();
  }
  return description;
}

// Dynamic template discovery — matches the generator's findTemplates() behavior.
// New skills automatically get test coverage without updating a static list.
const ALL_SKILLS = (() => {
  const skills: Array<{ dir: string; name: string }> = [];
  if (fs.existsSync(path.join(ROOT, 'SKILL.md.tmpl'))) {
    skills.push({ dir: '.', name: 'root nexus' });
  }
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    if (fs.existsSync(path.join(ROOT, entry.name, 'SKILL.md.tmpl'))) {
      skills.push({ dir: entry.name, name: entry.name });
    }
  }
  return skills;
})();

const NEXUS_CANONICAL_SKILLS = new Set([
  'discover',
  'frame',
  'plan',
  'handoff',
  'build',
  'review',
  'qa',
  'ship',
  'closeout',
]);

const NEXUS_ALIAS_SKILLS = new Set([
  'office-hours',
  'plan-ceo-review',
  'plan-eng-review',
  'autoplan',
]);

function isNexusWrapperSkill(dir: string): boolean {
  return NEXUS_CANONICAL_SKILLS.has(dir) || NEXUS_ALIAS_SKILLS.has(dir);
}

function readSkill(dir: string): string {
  return fs.readFileSync(path.join(ROOT, dir, 'SKILL.md'), 'utf-8');
}

function readTemplate(dir: string): string {
  return fs.readFileSync(path.join(ROOT, dir, 'SKILL.md.tmpl'), 'utf-8');
}

const describeLegacyShip = isNexusWrapperSkill('ship') ? describe.skip : describe;
const describeLegacyReview = isNexusWrapperSkill('review') ? describe.skip : describe;
const describeLegacyOfficeHours = isNexusWrapperSkill('office-hours') ? describe.skip : describe;
const describeLegacyPlanAliases = (
  isNexusWrapperSkill('plan-ceo-review')
  || isNexusWrapperSkill('plan-eng-review')
  || isNexusWrapperSkill('autoplan')
) ? describe.skip : describe;

describe('gen-skill-docs', () => {
  test('creates the new canonical directories', () => {
    for (const dir of ['discover', 'frame', 'plan', 'handoff', 'build', 'closeout']) {
      expect(fs.existsSync(path.join(ROOT, dir, 'SKILL.md.tmpl'))).toBe(true);
    }
  });

  test('nexus canonical directories stay aligned with the manifest', () => {
    expect(new Set(Object.keys(CANONICAL_MANIFEST))).toEqual(NEXUS_CANONICAL_SKILLS);
    for (const dir of NEXUS_CANONICAL_SKILLS) {
      expect(fs.existsSync(path.join(ROOT, dir, 'SKILL.md.tmpl'))).toBe(true);
      expect(fs.existsSync(path.join(ROOT, dir, 'SKILL.md'))).toBe(true);
    }
  });

  test('nexus alias wrappers stay aligned with the alias map', () => {
    expect(new Set(Object.keys(LEGACY_ALIASES))).toEqual(
      new Set(['office-hours', 'plan-ceo-review', 'plan-eng-review', 'autoplan', 'start-work', 'execute-wave', 'governed-execute', 'verify-close']),
    );
    for (const dir of NEXUS_ALIAS_SKILLS) {
      expect(fs.existsSync(path.join(ROOT, dir, 'SKILL.md.tmpl'))).toBe(true);
      expect(fs.existsSync(path.join(ROOT, dir, 'SKILL.md'))).toBe(true);
    }
  });

  test('canonical lifecycle templates source their body from Nexus stage-content placeholders', () => {
    for (const dir of NEXUS_CANONICAL_SKILLS) {
      const template = readTemplate(dir);

      expect(template).toContain('{{NEXUS_STAGE_OVERVIEW}}');
      expect(template).toContain('{{NEXUS_STAGE_CHECKLIST}}');
      expect(template).toContain('{{NEXUS_STAGE_ARTIFACT_CONTRACT}}');
      expect(template).toContain('{{NEXUS_STAGE_ROUTING}}');
    }
  });

  test('design skills absorb the shared design governance model', () => {
    const consultation = fs.readFileSync(path.join(ROOT, 'design-consultation', 'SKILL.md'), 'utf-8');
    const shotgun = fs.readFileSync(path.join(ROOT, 'design-shotgun', 'SKILL.md'), 'utf-8');
    const review = fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md'), 'utf-8');
    const html = fs.readFileSync(path.join(ROOT, 'design-html', 'SKILL.md'), 'utf-8');

    for (const content of [consultation, shotgun, review, html]) {
      expect(content).toContain('Core asset protocol');
      expect(content).toContain('brand-spec.md');
      expect(content).toContain('Five design lenses');
    }

    expect(shotgun).toContain('different schools');
    expect(shotgun).toContain('named designer or studio anchor');
    expect(consultation).toContain('fan out 3 differentiated directions from distinct schools');
    expect(consultation).toContain('generates direction-ready briefs for UI mockups, prototypes, slides, motion, and');
    expect(shotgun).toContain('iterate across UI screens, prototypes, slide');
    expect(shotgun).toContain('--brief-file {_DESIGN_DIR}/brief-{letter}.json');
    expect(consultation).toContain('"deliverableType": "[ui-mockup|prototype|slides|motion|infographic]"');
  });

  test('design consultation and finalization treat design context as DESIGN.md plus brand-spec.md', () => {
    const consultation = fs.readFileSync(path.join(ROOT, 'design-consultation', 'SKILL.md'), 'utf-8');
    const html = fs.readFileSync(path.join(ROOT, 'design-html', 'SKILL.md'), 'utf-8');

    expect(consultation).toContain('Creates the project\'s integrated design context');
    expect(consultation).toContain('`DESIGN.md` captures system-level rules');
    expect(consultation).toContain('`brand-spec.md` captures frozen brand truth');
    expect(html).toContain('Read the design context');
    expect(html).toContain('Create `DESIGN.md` + `brand-spec.md`');
  });

  test('generated SKILL.md contains all command categories', () => {
    const content = fs.readFileSync(path.join(ROOT, 'browse', 'SKILL.md'), 'utf-8');
    const categories = new Set(Object.values(COMMAND_DESCRIPTIONS).map(d => d.category));
    for (const cat of categories) {
      expect(content).toContain(`### ${cat}`);
    }
  });

  test('generated SKILL.md contains all commands', () => {
    const content = fs.readFileSync(path.join(ROOT, 'browse', 'SKILL.md'), 'utf-8');
    for (const [cmd, meta] of Object.entries(COMMAND_DESCRIPTIONS)) {
      const display = meta.usage || cmd;
      expect(content).toContain(display);
    }
  });

  test('command table is sorted alphabetically within categories', () => {
    const content = fs.readFileSync(path.join(ROOT, 'browse', 'SKILL.md'), 'utf-8');
    // Extract command names from the Navigation section as a test
    const navSection = content.match(/### Navigation\n\|.*\n\|.*\n([\s\S]*?)(?=\n###|\n## )/);
    expect(navSection).not.toBeNull();
    const rows = navSection![1].trim().split('\n');
    const commands = rows.map(r => {
      const match = r.match(/\| `(\w+)/);
      return match ? match[1] : '';
    }).filter(Boolean);
    const sorted = [...commands].sort();
    expect(commands).toEqual(sorted);
  });

  test('generated header is present in SKILL.md', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).toContain('AUTO-GENERATED from SKILL.md.tmpl');
    expect(content).toContain('Regenerate: bun run gen:skill-docs');
  });

  test('generated header is present in browse/SKILL.md', () => {
    const content = fs.readFileSync(path.join(ROOT, 'browse', 'SKILL.md'), 'utf-8');
    expect(content).toContain('AUTO-GENERATED from SKILL.md.tmpl');
  });

  test('snapshot flags section contains all flags', () => {
    const content = fs.readFileSync(path.join(ROOT, 'browse', 'SKILL.md'), 'utf-8');
    for (const flag of SNAPSHOT_FLAGS) {
      expect(content).toContain(flag.short);
      expect(content).toContain(flag.description);
    }
  });

  test('root nexus skill is a workflow harness entrypoint instead of browse-first prose', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');

    expect(content).toContain('Nexus workflow harness entrypoint.');
    expect(content).toContain('Session Bootstrap');
    expect(content).toContain('Execution mode source: `EXECUTION_MODE_SOURCE`');
    expect(content).toContain('Mounted providers: `MOUNTED_PROVIDERS`');
    expect(content).toContain('Local provider candidate: `LOCAL_PROVIDER_CANDIDATE`');
    expect(content).toContain('If the user invoked bare `/nexus` with no narrower task, do not default to `/browse`.');
    expect(content).toContain('the canonical starting point is `/discover`');
    expect(content).not.toContain('# nexus browse: QA Testing & Dogfooding');
    expect(content).not.toContain('Persistent headless Chromium.');
  });

  test('every skill has a SKILL.md.tmpl template', () => {
    for (const skill of ALL_SKILLS) {
      const tmplPath = path.join(ROOT, skill.dir, 'SKILL.md.tmpl');
      expect(fs.existsSync(tmplPath)).toBe(true);
    }
  });

  test('every skill has a generated SKILL.md with auto-generated header', () => {
    for (const skill of ALL_SKILLS) {
      const mdPath = path.join(ROOT, skill.dir, 'SKILL.md');
      expect(fs.existsSync(mdPath)).toBe(true);
      const content = fs.readFileSync(mdPath, 'utf-8');
      expect(content).toContain('AUTO-GENERATED from SKILL.md.tmpl');
      expect(content).toContain('Regenerate: bun run gen:skill-docs');
    }
  });

  test('every generated SKILL.md has valid YAML frontmatter', () => {
    for (const skill of ALL_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      expect(content.startsWith('---\n')).toBe(true);
      expect(content).toContain('name:');
      expect(content).toContain('description:');
    }
  });

  test(`every generated SKILL.md description stays within ${MAX_SKILL_DESCRIPTION_LENGTH} chars`, () => {
    for (const skill of ALL_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      const description = extractDescription(content);
      expect(description.length).toBeLessThanOrEqual(MAX_SKILL_DESCRIPTION_LENGTH);
    }
  });

  test(`every Codex SKILL.md description stays within ${MAX_SKILL_DESCRIPTION_LENGTH} chars`, () => {
    const agentsDir = path.join(ROOT, '.agents', 'skills');
    if (!fs.existsSync(agentsDir)) return; // skip if not generated
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(agentsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, 'utf-8');
      const description = extractDescription(content);
      expect(description.length).toBeLessThanOrEqual(MAX_SKILL_DESCRIPTION_LENGTH);
    }
  });

  test('every Codex SKILL.md description stays under 900-char warning threshold', () => {
    const WARN_THRESHOLD = 900;
    const agentsDir = path.join(ROOT, '.agents', 'skills');
    if (!fs.existsSync(agentsDir)) return;
    const violations: string[] = [];
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(agentsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, 'utf-8');
      const description = extractDescription(content);
      if (description.length > WARN_THRESHOLD) {
        violations.push(`${entry.name}: ${description.length} chars (limit ${MAX_SKILL_DESCRIPTION_LENGTH}, ${MAX_SKILL_DESCRIPTION_LENGTH - description.length} remaining)`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('package.json version matches VERSION file', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
    const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf-8').trim();
    expect(pkg.version).toBe(version);
  });

  test('generated files are fresh (match --dry-run)', () => {
    const result = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--dry-run'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    // Every skill should be FRESH
    for (const skill of ALL_SKILLS) {
      const file = skill.dir === '.' ? 'SKILL.md' : `${skill.dir}/SKILL.md`;
      expect(output).toContain(`FRESH: ${file}`);
    }
    expect(output).not.toContain('STALE');
  });

  test('no generated SKILL.md contains unresolved placeholders', () => {
    for (const skill of ALL_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      const unresolved = content.match(/\{\{[A-Z_]+\}\}/g);
      expect(unresolved).toBeNull();
    }
  });

  test('templates contain placeholders', () => {
    const rootTmpl = fs.readFileSync(path.join(ROOT, 'SKILL.md.tmpl'), 'utf-8');
    expect(rootTmpl).toContain('{{PREAMBLE}}');

    const browseTmpl = fs.readFileSync(path.join(ROOT, 'browse', 'SKILL.md.tmpl'), 'utf-8');
    expect(browseTmpl).toContain('{{COMMAND_REFERENCE}}');
    expect(browseTmpl).toContain('{{SNAPSHOT_FLAGS}}');
    expect(browseTmpl).toContain('{{PREAMBLE}}');
  });

  test('generated SKILL.md contains contributor mode check', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).toContain('Contributor Mode');
    expect(content).toContain('nexus_contributor');
    expect(content).toContain('contributor-logs');
  });

  test('generated SKILL.md contains session awareness', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).toContain('_SESSIONS');
    expect(content).toContain('RECOMMENDATION');
  });

  test('generated SKILL.md contains branch detection', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).toContain('_BRANCH');
    expect(content).toContain('git branch --show-current');
  });

  test('tier 2+ skills contain ELI16 simplification rules (AskUserQuestion format)', () => {
    // Root SKILL.md is tier 1 (no AskUserQuestion format). Check a tier 2+ skill instead.
    const content = fs.readFileSync(path.join(ROOT, 'cso', 'SKILL.md'), 'utf-8');
    expect(content).toContain('No raw function names');
    expect(content).toContain('plain English');
  });

  test('tier 1 skills do NOT contain AskUserQuestion format', () => {
    // Use benchmark (tier 1) instead of root — root SKILL.md gets overwritten by Codex test setup
    const content = fs.readFileSync(path.join(ROOT, 'benchmark', 'SKILL.md'), 'utf-8');
    expect(content).not.toContain('## AskUserQuestion Format');
    expect(content).not.toContain('## Completeness Principle');
  });

  test('generated follow-on skills expose canonical attached-evidence paths', () => {
    const benchmark = fs.readFileSync(path.join(ROOT, 'benchmark', 'SKILL.md'), 'utf-8');
    const canary = fs.readFileSync(path.join(ROOT, 'canary', 'SKILL.md'), 'utf-8');
    const docRelease = fs.readFileSync(path.join(ROOT, 'document-release', 'SKILL.md'), 'utf-8');
    const landAndDeploy = fs.readFileSync(path.join(ROOT, 'land-and-deploy', 'SKILL.md'), 'utf-8');

    expect(benchmark).toContain('.planning/current/qa/perf-verification.md');
    expect(canary).toContain('.planning/current/ship/canary-status.json');
    expect(canary).toContain('nexus-refresh-follow-on-summary');
    expect(docRelease).toContain('.planning/current/closeout/documentation-sync.md');
    expect(docRelease).toContain('nexus-refresh-follow-on-summary');
    expect(landAndDeploy).toContain('.planning/current/ship/deploy-readiness.json');
    expect(landAndDeploy).toContain('.planning/current/ship/pull-request.json');
    expect(landAndDeploy).toContain('.planning/current/ship/deploy-result.json');
    expect(landAndDeploy).toContain('nexus-refresh-follow-on-summary');
    expect(landAndDeploy).toContain('headRefOid');
    expect(landAndDeploy).toContain('pre_merge_ci_failed');
    expect(landAndDeploy).toContain('rerun_build_review_qa_ship');
    expect(landAndDeploy).toContain('rerun_ship');
  });

  test('generated SKILL.md does not mention telemetry storage', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).not.toContain('skill-usage.jsonl');
    expect(content).not.toContain('~/.nexus/analytics');
  });

  test('preamble .pending-* glob is zsh-safe (uses find, not shell glob)', () => {
    for (const skill of ALL_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      if (!content.includes('.pending-')) continue;
      // Must NOT have a bare shell glob ".pending-*" outside of find's -name argument
      expect(content).not.toMatch(/for _PF in [^\n]*\/\.pending-\*/);
      // Must use find to avoid zsh NOMATCH error on glob expansion
      expect(content).toContain("find ~/.nexus/analytics -maxdepth 1 -name '.pending-*'");
    }
  });

  test('bash blocks with shell globs are zsh-safe (setopt guard or find)', () => {
    for (const skill of ALL_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      const bashBlocks = [...content.matchAll(/```bash\n([\s\S]*?)```/g)].map(m => m[1]);

      for (const block of bashBlocks) {
        const lines = block.split('\n');

        for (const line of lines) {
          const trimmed = line.trimStart();
          if (trimmed.startsWith('#')) continue;
          if (!trimmed.includes('*')) continue;
          // Skip lines where * is inside find -name, git pathspecs, or $(find)
          if (/\bfind\b/.test(trimmed)) continue;
          if (/\bgit\b/.test(trimmed)) continue;
          if (/\$\(find\b/.test(trimmed)) continue;

          // Check 1: "for VAR in <glob>" must use $(find ...) — caught above by the
          // $(find check, so any surviving for-in with a glob pattern is a violation
          if (/\bfor\s+\w+\s+in\b/.test(trimmed) && /\*\./.test(trimmed)) {
            throw new Error(
              `Unsafe for-in glob in ${skill.dir}/SKILL.md: "${trimmed}". ` +
              `Use \`for f in $(find ... -name '*.ext')\` for zsh compatibility.`
            );
          }

          // Check 2: ls/cat/rm/grep with glob file args must have setopt guard
          const isGlobCmd = /\b(?:ls|cat|rm|grep)\b/.test(trimmed) &&
                            /(?:\/\*[a-z.*]|\*\.[a-z])/.test(trimmed);
          if (isGlobCmd) {
            expect(block).toContain('setopt +o nomatch');
          }
        }
      }
    }
  });

  test('preamble-using skills do not emit telemetry scaffolding', () => {
    const PREAMBLE_SKILLS = [
      { dir: '.', name: 'nexus' },
      { dir: 'ship', name: 'ship' },
      { dir: 'review', name: 'review' },
      { dir: 'qa', name: 'qa' },
      { dir: 'retro', name: 'retro' },
    ];
    for (const skill of PREAMBLE_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      expect(content).not.toContain('_TEL_START');
      expect(content).not.toContain('nexus-telemetry-log');
      expect(content).not.toContain('set telemetry');
    }
  });

  test('qa and qa-only templates use QA_METHODOLOGY placeholder', () => {
    const qaTmpl = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md.tmpl'), 'utf-8');
    if (isNexusWrapperSkill('qa')) {
      expect(qaTmpl).not.toContain('{{QA_METHODOLOGY}}');
      expect(qaTmpl).toContain('{{NEXUS_RUN_COMMAND:qa}}');
      expect(qaTmpl).toContain('# /qa — Nexus Governed QA');
    } else {
      expect(qaTmpl).toContain('{{QA_METHODOLOGY}}');
    }

    const qaOnlyTmpl = fs.readFileSync(path.join(ROOT, 'qa-only', 'SKILL.md.tmpl'), 'utf-8');
    expect(qaOnlyTmpl).toContain('{{QA_METHODOLOGY}}');
  });

  test('QA_METHODOLOGY appears expanded in both qa and qa-only generated files', () => {
    const qaContent = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md'), 'utf-8');
    const qaOnlyContent = fs.readFileSync(path.join(ROOT, 'qa-only', 'SKILL.md'), 'utf-8');

    if (isNexusWrapperSkill('qa')) {
      expect(qaContent).toContain('_REPO_CWD="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"');
      expect(qaContent).toContain('NEXUS_PROJECT_CWD="$_REPO_CWD" bun run bin/nexus.ts qa');
      expect(qaContent).toContain('.planning/current/qa/status.json');
      expect(qaContent).toContain('Nexus-owned QA guidance for governed validation scope beyond code review.');
      expect(qaContent).toContain('CCB validation transport does not bypass Nexus-owned readiness decisions');
      expect(qaContent).not.toContain('Nexus QA Placeholder');
    } else {
      expect(qaContent).toContain('Health Score Rubric');
      expect(qaContent).toContain('Framework-Specific Guidance');
      expect(qaContent).toContain('Important Rules');
      expect(qaContent).toContain('Phase 1');
      expect(qaContent).toContain('Phase 6');
    }

    expect(qaOnlyContent).toContain('Health Score Rubric');
    expect(qaOnlyContent).toContain('Framework-Specific Guidance');
    expect(qaOnlyContent).toContain('Important Rules');
    expect(qaOnlyContent).toContain('Phase 1');
    expect(qaOnlyContent).toContain('Phase 6');
  });

  test('qa-only has no-fix guardrails', () => {
    const qaOnlyContent = fs.readFileSync(path.join(ROOT, 'qa-only', 'SKILL.md'), 'utf-8');
    expect(qaOnlyContent).toContain('Never fix bugs');
    expect(qaOnlyContent).toContain('NEVER fix anything');
    // Should not have Edit, Glob, or Grep in allowed-tools
    expect(qaOnlyContent).not.toMatch(/allowed-tools:[\s\S]*?Edit/);
    expect(qaOnlyContent).not.toMatch(/allowed-tools:[\s\S]*?Glob/);
    expect(qaOnlyContent).not.toMatch(/allowed-tools:[\s\S]*?Grep/);
  });

  test('qa has fix-loop tools and phases', () => {
    const qaContent = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md'), 'utf-8');
    if (isNexusWrapperSkill('qa')) {
      expect(qaContent).toContain('NEXUS_PROJECT_CWD="$_REPO_CWD" bun run bin/nexus.ts qa');
      expect(qaContent).not.toContain('Edit');
      expect(qaContent).not.toContain('Glob');
      expect(qaContent).not.toContain('Grep');
      expect(qaContent).not.toContain('Fix Loop');
    } else {
      expect(qaContent).toContain('Edit');
      expect(qaContent).toContain('Glob');
      expect(qaContent).toContain('Grep');
      expect(qaContent).toContain('Phase 7');
      expect(qaContent).toContain('Phase 8');
      expect(qaContent).toContain('Fix Loop');
      expect(qaContent).toContain('Triage');
      expect(qaContent).toContain('WTF');
    }
  });

  test('frame and plan SKILL.md surface runtime-owned completion advisors and design-aware follow-ons', () => {
    const frameContent = fs.readFileSync(path.join(ROOT, 'frame', 'SKILL.md'), 'utf-8');
    const planContent = fs.readFileSync(path.join(ROOT, 'plan', 'SKILL.md'), 'utf-8');

    expect(frameContent).toContain('.planning/current/frame/completion-advisor.json');
    expect(frameContent).toContain('prefer the runtime JSON field `completion_advisor`');
    expect(frameContent).toContain('completion_context.completion_advisor');
    expect(frameContent).toContain('interaction_mode');
    expect(frameContent).toContain('stop_action');
    expect(frameContent).toContain('If `interaction_mode` is `summary_only`, do not call AskUserQuestion.');
    expect(frameContent).toContain('If the session is interactive and `interaction_mode` is not `summary_only`');
    expect(frameContent).toContain('--output interactive');
    expect(frameContent).toContain('/plan-design-review');
    expect(frameContent).toContain('/design-consultation');
    expect(frameContent).toContain('suppressed_surfaces');
    expect(frameContent).toContain('Keep the canonical path anchored on');

    expect(planContent).toContain('.planning/current/plan/completion-advisor.json');
    expect(planContent).toContain('prefer the runtime JSON field `completion_advisor`');
    expect(planContent).toContain('completion_context.completion_advisor');
    expect(planContent).toContain('interaction_mode');
    expect(planContent).toContain('stop_action');
    expect(planContent).toContain('If `interaction_mode` is `summary_only`, do not call AskUserQuestion.');
    expect(planContent).toContain('If the session is interactive and `interaction_mode` is not `summary_only`');
    expect(planContent).toContain('--output interactive');
    expect(planContent).toContain('/plan-design-review');
    expect(planContent).toContain('design_impact');
    expect(planContent).toContain('verification matrix');
  });

  test('review SKILL.md routes advisory disposition through the runtime-owned completion advisor', () => {
    const reviewContent = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(reviewContent).toContain('## Completion Advisor');
    expect(reviewContent).toContain('.planning/current/review/completion-advisor.json');
    expect(reviewContent).toContain('prefer the runtime JSON field `completion_advisor`');
    expect(reviewContent).toContain('completion_context.completion_advisor');
    expect(reviewContent).toContain('interaction_mode');
    expect(reviewContent).toContain('stop_action');
    expect(reviewContent).toContain('If `interaction_mode` is `summary_only`, do not call AskUserQuestion.');
    expect(reviewContent).toContain('--output interactive');
    expect(reviewContent).toContain('Do not reconstruct advisory logic from `status.json`.');
    expect(reviewContent).toContain('AskUserQuestion');
    expect(reviewContent).toContain('/cso');
  });

  test('review SKILL.md maps each advisory choice to an exact Nexus command', () => {
    const reviewContent = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(reviewContent).toContain('/build --review-advisory-disposition fix_before_qa');
    expect(reviewContent).toContain('/qa --review-advisory-disposition continue_to_qa');
    expect(reviewContent).toContain('/qa --review-advisory-disposition defer_to_follow_on');
  });

  test('build SKILL.md consumes completion advisor output and keeps design-aware follow-ons behind review', () => {
    const buildContent = fs.readFileSync(path.join(ROOT, 'build', 'SKILL.md'), 'utf-8');
    expect(buildContent).toContain('## Completion Advisor');
    expect(buildContent).toContain('.planning/current/build/completion-advisor.json');
    expect(buildContent).toContain('prefer the runtime JSON field `completion_advisor`');
    expect(buildContent).toContain('completion_context.completion_advisor');
    expect(buildContent).toContain('interaction_mode');
    expect(buildContent).toContain('recommended_external_skills');
    expect(buildContent).toContain('--output interactive');
    expect(buildContent).toContain('AskUserQuestion');
    expect(buildContent).toContain('/review');
    expect(buildContent).toContain('/design-review');
    expect(buildContent).toContain('/browse');
  });

  test('qa SKILL.md offers advisor-driven next-step interaction and side-skill entrypoints', () => {
    const qaContent = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md'), 'utf-8');
    expect(qaContent).toContain('## Completion Advisor');
    expect(qaContent).toContain('.planning/current/qa/completion-advisor.json');
    expect(qaContent).toContain('prefer the runtime JSON field `completion_advisor`');
    expect(qaContent).toContain('completion_context.completion_advisor');
    expect(qaContent).toContain('interaction_mode');
    expect(qaContent).toContain('stop_action');
    expect(qaContent).toContain('If `interaction_mode` is `summary_only`, do not call AskUserQuestion.');
    expect(qaContent).toContain('--output interactive');
    expect(qaContent).toContain('/design-review');
    expect(qaContent).toContain('/benchmark');
    expect(qaContent).toContain('/browse');
    expect(qaContent).toContain('/connect-chrome');
    expect(qaContent).toContain('/setup-browser-cookies');
    expect(qaContent).toContain('/cso');
    expect(qaContent).toContain('/ship');
  });

  test('ship SKILL.md offers advisor-driven closeout and deploy-facing follow-on interaction', () => {
    const shipContent = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');
    expect(shipContent).toContain('## Completion Advisor');
    expect(shipContent).toContain('.planning/current/ship/completion-advisor.json');
    expect(shipContent).toContain('prefer the runtime JSON field `completion_advisor`');
    expect(shipContent).toContain('completion_context.completion_advisor');
    expect(shipContent).toContain('interaction_mode');
    expect(shipContent).toContain('stop_action');
    expect(shipContent).toContain('If `interaction_mode` is `summary_only`, do not call AskUserQuestion.');
    expect(shipContent).toContain('--output interactive');
    expect(shipContent).toContain('/closeout');
    expect(shipContent).toContain('/land-and-deploy');
    expect(shipContent).toContain('/setup-deploy');
  });

  test('closeout SKILL.md offers advisor-driven next-run and follow-on side-skill interaction', () => {
    const closeoutContent = fs.readFileSync(path.join(ROOT, 'closeout', 'SKILL.md'), 'utf-8');
    expect(closeoutContent).toContain('## Completion Advisor');
    expect(closeoutContent).toContain('.planning/current/closeout/completion-advisor.json');
    expect(closeoutContent).toContain('prefer the runtime JSON field `completion_advisor`');
    expect(closeoutContent).toContain('completion_context.completion_advisor');
    expect(closeoutContent).toContain('interaction_mode');
    expect(closeoutContent).toContain('stop_action');
    expect(closeoutContent).toContain('If `interaction_mode` is `summary_only`, do not call AskUserQuestion.');
    expect(closeoutContent).toContain('--output interactive');
    expect(closeoutContent).toContain('/discover');
    expect(closeoutContent).toContain('/land-and-deploy');
    expect(closeoutContent).toContain('/retro');
    expect(closeoutContent).toContain('/learn');
    expect(closeoutContent).toContain('/document-release');
  });
});

describe('nexus wrapper generation', () => {
  test('canonical wrappers invoke the Nexus runtime', () => {
    for (const dir of NEXUS_CANONICAL_SKILLS) {
      const content = readSkill(dir);
      expect(content).toContain('_REPO_CWD="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"');
      expect(content).toContain(`NEXUS_PROJECT_CWD="$_REPO_CWD" bun run bin/nexus.ts ${dir}`);
    }
  });

  test('alias wrappers route through the same Nexus runtime', () => {
    const aliases: Record<string, string> = {
      'office-hours': 'discover',
      'plan-ceo-review': 'frame',
      'plan-eng-review': 'frame',
      autoplan: 'plan',
    };

    for (const [alias, target] of Object.entries(aliases)) {
      const content = readSkill(alias);
      expect(content).toContain('_REPO_CWD="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"');
      expect(content).toContain(`NEXUS_PROJECT_CWD="$_REPO_CWD" bun run bin/nexus.ts ${alias}`);
      expect(content).toContain(`This alias routes to \`/${target}\`.`);
    }
  });
});

describeLegacyShip('BASE_BRANCH_DETECT resolver', () => {
  // Find a generated SKILL.md that uses the placeholder (ship is guaranteed to)
  const shipContent = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');

  test('resolver output contains PR base detection command', () => {
    expect(shipContent).toContain('gh pr view --json baseRefName');
  });

  test('resolver output contains repo default branch detection command', () => {
    expect(shipContent).toContain('gh repo view --json defaultBranchRef');
  });

  test('resolver output contains fallback to main', () => {
    expect(shipContent).toMatch(/fall\s*back\s+to\s+`main`/i);
  });

  test('resolver output uses "the base branch" phrasing', () => {
    expect(shipContent).toContain('the base branch');
  });

  test('resolver output contains GitLab CLI commands', () => {
    expect(shipContent).toContain('glab');
  });

  test('resolver output contains git-native fallback', () => {
    expect(shipContent).toContain('git symbolic-ref');
  });

  test('resolver output mentions GitLab platform', () => {
    expect(shipContent).toMatch(/gitlab/i);
  });
});

describeLegacyShip('GitLab support in generated skills', () => {
  const retroContent = fs.readFileSync(path.join(ROOT, 'retro', 'SKILL.md'), 'utf-8');
  const shipSkillContent = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');

  test('retro contains GitLab MR number extraction', () => {
    expect(retroContent).toContain('[#!]');
  });

  test('retro uses BASE_BRANCH_DETECT (contains glab)', () => {
    expect(retroContent).toContain('glab');
  });

  test('ship contains glab mr create', () => {
    expect(shipSkillContent).toContain('glab mr create');
  });

  test('ship checks .gitlab-ci.yml', () => {
    expect(shipSkillContent).toContain('.gitlab-ci.yml');
  });
});

/**
 * Quality evals — catch description regressions.
 *
 * These test that generated output is *useful for an AI agent*,
 * not just structurally valid. Each test targets a specific
 * regression we actually shipped and caught in review.
 */
describe('description quality evals', () => {
  // Regression: snapshot flags lost value hints (-d <N>, -s <sel>, -o <path>)
  test('snapshot flags with values include value hints in output', () => {
    const content = fs.readFileSync(path.join(ROOT, 'browse', 'SKILL.md'), 'utf-8');
    for (const flag of SNAPSHOT_FLAGS) {
      if (flag.takesValue) {
        expect(flag.valueHint).toBeDefined();
        expect(content).toContain(`${flag.short} ${flag.valueHint}`);
      }
    }
  });

  // Regression: "is" lost the valid states enum
  test('is command lists valid state values', () => {
    const desc = COMMAND_DESCRIPTIONS['is'].description;
    for (const state of ['visible', 'hidden', 'enabled', 'disabled', 'checked', 'editable', 'focused']) {
      expect(desc).toContain(state);
    }
  });

  // Regression: "press" lost common key examples
  test('press command lists example keys', () => {
    const desc = COMMAND_DESCRIPTIONS['press'].description;
    expect(desc).toContain('Enter');
    expect(desc).toContain('Tab');
    expect(desc).toContain('Escape');
  });

  // Regression: "console" lost --errors filter note
  test('console command describes --errors behavior', () => {
    const desc = COMMAND_DESCRIPTIONS['console'].description;
    expect(desc).toContain('--errors');
  });

  // Regression: snapshot -i lost "@e refs" context
  test('snapshot -i mentions @e refs', () => {
    const flag = SNAPSHOT_FLAGS.find(f => f.short === '-i')!;
    expect(flag.description).toContain('@e');
  });

  // Regression: snapshot -C lost "@c refs" context
  test('snapshot -C mentions @c refs', () => {
    const flag = SNAPSHOT_FLAGS.find(f => f.short === '-C')!;
    expect(flag.description).toContain('@c');
  });

  // Guard: every description must be at least 8 chars (catches empty or stub descriptions)
  test('all command descriptions have meaningful length', () => {
    for (const [cmd, meta] of Object.entries(COMMAND_DESCRIPTIONS)) {
      expect(meta.description.length).toBeGreaterThanOrEqual(8);
    }
  });

  // Guard: snapshot flag descriptions must be at least 10 chars
  test('all snapshot flag descriptions have meaningful length', () => {
    for (const flag of SNAPSHOT_FLAGS) {
      expect(flag.description.length).toBeGreaterThanOrEqual(10);
    }
  });

  // Guard: descriptions must not contain pipe (breaks markdown table cells)
  // Usage strings are backtick-wrapped in the table so pipes there are safe.
  test('no command description contains pipe character', () => {
    for (const [cmd, meta] of Object.entries(COMMAND_DESCRIPTIONS)) {
      expect(meta.description).not.toContain('|');
    }
  });

  // Guard: generated output uses → not ->
  test('generated SKILL.md uses unicode arrows', () => {
    const content = fs.readFileSync(path.join(ROOT, 'browse', 'SKILL.md'), 'utf-8');
    const body = content.split('\n').slice(20).join('\n');
    expect(body).toContain('→');
    expect(body).not.toContain('->');
  });
});

describeLegacyPlanAliases('REVIEW_DASHBOARD resolver', () => {
  const REVIEW_SKILLS = ['plan-ceo-review', 'plan-eng-review', 'plan-design-review'];

  for (const skill of REVIEW_SKILLS) {
    test(`review dashboard appears in ${skill} generated file`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).toContain('nexus-review');
      expect(content).toContain('REVIEW READINESS DASHBOARD');
    });
  }

  test('review dashboard appears in ship generated file', () => {
    const content = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');
    expect(content).toContain('reviews.jsonl');
    expect(content).toContain('REVIEW READINESS DASHBOARD');
  });

  test('dashboard treats review as a valid Eng Review source', () => {
    const content = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');
    expect(content).toContain('plan-eng-review, review, plan-design-review');
    expect(content).toContain('`review` (diff-scoped pre-landing review)');
    expect(content).toContain('`plan-eng-review` (plan-stage architecture review)');
    expect(content).toContain('from either \\`review\\` or \\`plan-eng-review\\`');
  });

  test('shared dashboard propagates review source to plan-eng-review', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-eng-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('plan-eng-review, review, plan-design-review');
    expect(content).toContain('`review` (diff-scoped pre-landing review)');
  });

  test('resolver output contains key dashboard elements', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('VERDICT');
    expect(content).toContain('CLEARED');
    expect(content).toContain('Eng Review');
    expect(content).toContain('7 days');
    expect(content).toContain('Design Review');
    expect(content).toContain('skip_eng_review');
  });

  test('dashboard bash block includes git HEAD for staleness detection', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('git rev-parse --short HEAD');
    expect(content).toContain('---HEAD---');
  });

  test('dashboard includes staleness detection prose', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Staleness detection');
    expect(content).toContain('commit');
  });

  for (const skill of REVIEW_SKILLS) {
    test(`${skill} contains review chaining section`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).toContain('Review Chaining');
    });

    test(`${skill} Review Log includes commit field`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).toContain('"commit"');
    });
  }

  test('plan-ceo-review chaining mentions eng and design reviews', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('/plan-eng-review');
    expect(content).toContain('/plan-design-review');
  });

  test('plan-eng-review chaining mentions design and ceo reviews', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-eng-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('/plan-design-review');
    expect(content).toContain('/plan-ceo-review');
  });

  test('plan-design-review chaining mentions eng, ceo, and design skills', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-design-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('/plan-eng-review');
    expect(content).toContain('/plan-ceo-review');
    expect(content).toContain('/design-shotgun');
    expect(content).toContain('/design-html');
  });

  test('ship does NOT contain review chaining', () => {
    const content = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');
    expect(content).not.toContain('Review Chaining');
  });
});

// ─── Test Coverage Audit Resolver Tests ─────────────────────

describeLegacyShip('TEST_COVERAGE_AUDIT placeholders', () => {
  const planSkill = fs.readFileSync(path.join(ROOT, 'plan-eng-review', 'SKILL.md'), 'utf-8');
  const shipSkill = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');
  const reviewSkill = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');

  test('plan and ship modes share codepath tracing methodology', () => {
    // Review mode delegates test coverage to the Testing specialist subagent (Review Army)
    const sharedPhrases = [
      'Trace data flow',
      'Diagram the execution',
      'Quality scoring rubric',
      '★★★',
      '★★',
      'GAP',
    ];
    for (const phrase of sharedPhrases) {
      expect(planSkill).toContain(phrase);
      expect(shipSkill).toContain(phrase);
    }
    // Plan mode traces the plan, not a git diff
    expect(planSkill).toContain('Trace every codepath in the plan');
    expect(planSkill).not.toContain('git diff origin');
    // Ship mode traces the diff
    expect(shipSkill).toContain('Trace every codepath changed');
  });

  test('review mode uses Review Army for specialist dispatch', () => {
    expect(reviewSkill).toContain('Review Army');
    expect(reviewSkill).toContain('Specialist Dispatch');
    expect(reviewSkill).toContain('testing.md');
  });

  test('plan and ship modes include E2E decision matrix', () => {
    // Review mode delegates to Testing specialist
    for (const skill of [planSkill, shipSkill]) {
      expect(skill).toContain('E2E Test Decision Matrix');
      expect(skill).toContain('→E2E');
      expect(skill).toContain('→EVAL');
    }
  });

  test('plan and ship modes include regression rule', () => {
    // Review mode delegates to Testing specialist
    for (const skill of [planSkill, shipSkill]) {
      expect(skill).toContain('REGRESSION RULE');
      expect(skill).toContain('IRON RULE');
    }
  });

  test('plan and ship modes include test framework detection', () => {
    // Review mode delegates to Testing specialist
    for (const skill of [planSkill, shipSkill]) {
      expect(skill).toContain('Test Framework Detection');
      expect(skill).toContain('CLAUDE.md');
    }
  });

  test('plan mode adds tests to plan + includes test plan artifact', () => {
    expect(planSkill).toContain('Add missing tests to the plan');
    expect(planSkill).toContain('eng-review-test-plan');
    expect(planSkill).toContain('Test Plan Artifact');
  });

  test('ship mode auto-generates tests + includes before/after count', () => {
    expect(shipSkill).toContain('Generate tests for uncovered paths');
    expect(shipSkill).toContain('Before/after test count');
    expect(shipSkill).toContain('30 code paths max');
    expect(shipSkill).toContain('ship-test-plan');
  });

  test('review mode uses Fix-First + Review Army for specialist coverage', () => {
    expect(reviewSkill).toContain('Fix-First');
    expect(reviewSkill).toContain('INFORMATIONAL');
    // Review Army handles test coverage via Testing specialist subagent
    expect(reviewSkill).toContain('Review Army');
    expect(reviewSkill).toContain('Testing');
  });

  test('plan mode does NOT include ship-specific content', () => {
    expect(planSkill).not.toContain('Before/after test count');
    expect(planSkill).not.toContain('30 code paths max');
    expect(planSkill).not.toContain('ship-test-plan');
  });

  test('review mode does NOT include test plan artifact', () => {
    expect(reviewSkill).not.toContain('Test Plan Artifact');
    expect(reviewSkill).not.toContain('eng-review-test-plan');
    expect(reviewSkill).not.toContain('ship-test-plan');
  });

  test('review/specialists/ directory has all expected checklist files', () => {
    const specDir = path.join(ROOT, 'review', 'specialists');
    const expected = [
      'testing.md',
      'maintainability.md',
      'security.md',
      'performance.md',
      'data-migration.md',
      'api-contract.md',
      'red-team.md',
    ];
    for (const f of expected) {
      expect(fs.existsSync(path.join(specDir, f))).toBe(true);
    }
  });

  test('each specialist file has standard header with scope and output format', () => {
    const specDir = path.join(ROOT, 'review', 'specialists');
    const files = fs.readdirSync(specDir).filter(f => f.endsWith('.md'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(specDir, f), 'utf-8');
      // All specialist files must have Scope and Output/JSON in header
      expect(content).toContain('Scope:');
      expect(content.toLowerCase()).toMatch(/output|json/);
      // Must define NO FINDINGS behavior
      expect(content).toContain('NO FINDINGS');
    }
  });

  // Regression guard: ship output contains key phrases from before the refactor
  test('ship SKILL.md regression guard — key phrases preserved', () => {
    const regressionPhrases = [
      '100% coverage is the goal',
      'ASCII coverage diagram',
      'processPayment',
      'refundPayment',
      'billing.test.ts',
      'checkout.e2e.ts',
      'COVERAGE:',
      'QUALITY:',
      'GAPS:',
      'Code paths:',
      'User flows:',
    ];
    for (const phrase of regressionPhrases) {
      expect(shipSkill).toContain(phrase);
    }
  });
});

// --- {{TEST_FAILURE_TRIAGE}} resolver tests ---

describeLegacyShip('TEST_FAILURE_TRIAGE resolver', () => {
  const shipSkill = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');

  test('contains all 4 triage steps', () => {
    expect(shipSkill).toContain('Step T1: Classify each failure');
    expect(shipSkill).toContain('Step T2: Handle in-branch failures');
    expect(shipSkill).toContain('Step T3: Handle pre-existing failures');
    expect(shipSkill).toContain('Step T4: Execute the chosen action');
  });

  test('T1 includes classification criteria (in-branch vs pre-existing)', () => {
    expect(shipSkill).toContain('In-branch');
    expect(shipSkill).toContain('Likely pre-existing');
    expect(shipSkill).toContain('git diff origin/');
  });

  test('T3 branches on REPO_MODE (solo vs collaborative)', () => {
    expect(shipSkill).toContain('REPO_MODE');
    expect(shipSkill).toContain('solo');
    expect(shipSkill).toContain('collaborative');
  });

  test('solo mode offers fix-now, TODO, and skip options', () => {
    expect(shipSkill).toContain('Investigate and fix now');
    expect(shipSkill).toContain('Add as P0 TODO');
    expect(shipSkill).toContain('Skip');
  });

  test('collaborative mode offers blame + assign option', () => {
    expect(shipSkill).toContain('Blame + assign GitHub issue');
    expect(shipSkill).toContain('gh issue create');
  });

  test('defaults ambiguous failures to in-branch (safety)', () => {
    expect(shipSkill).toContain('When ambiguous, default to in-branch');
  });
});

// --- {{PLAN_FILE_REVIEW_REPORT}} resolver tests ---

describe('PLAN_FILE_REVIEW_REPORT resolver', () => {
  const REVIEW_SKILLS = ['plan-ceo-review', 'plan-eng-review', 'plan-design-review', 'codex'];

  for (const skill of REVIEW_SKILLS) {
    test(`plan file review report appears in ${skill} generated file`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).toContain('NEXUS REVIEW REPORT');
    });
  }

  test('resolver output contains key report elements', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Trigger');
    expect(content).toContain('Findings');
    expect(content).toContain('VERDICT');
    expect(content).toContain('/plan-ceo-review');
    expect(content).toContain('/plan-eng-review');
    expect(content).toContain('/plan-design-review');
    expect(content).toContain('/codex review');
  });
});

// --- {{PLAN_COMPLETION_AUDIT}} resolver tests ---

describeLegacyShip('PLAN_COMPLETION_AUDIT placeholders', () => {
  const shipSkill = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');
  const reviewSkill = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');

  test('ship SKILL.md contains plan completion audit step', () => {
    expect(shipSkill).toContain('Plan Completion Audit');
    expect(shipSkill).toContain('Step 3.45');
  });

  test('review SKILL.md contains plan completion in scope drift', () => {
    expect(reviewSkill).toContain('Plan File Discovery');
    expect(reviewSkill).toContain('Actionable Item Extraction');
    expect(reviewSkill).toContain('Integration with Scope Drift Detection');
  });

  test('both modes share plan file discovery methodology', () => {
    expect(shipSkill).toContain('Plan File Discovery');
    expect(reviewSkill).toContain('Plan File Discovery');
    // Both should have conversation context first
    expect(shipSkill).toContain('Conversation context (primary)');
    expect(reviewSkill).toContain('Conversation context (primary)');
    // Both should have grep fallback
    expect(shipSkill).toContain('Content-based search (fallback)');
    expect(reviewSkill).toContain('Content-based search (fallback)');
  });

  test('ship mode has gate logic for NOT DONE items', () => {
    expect(shipSkill).toContain('NOT DONE');
    expect(shipSkill).toContain('Stop — implement the missing items');
    expect(shipSkill).toContain('Ship anyway — defer');
    expect(shipSkill).toContain('intentionally dropped');
  });

  test('review mode is INFORMATIONAL only', () => {
    expect(reviewSkill).toContain('INFORMATIONAL');
    expect(reviewSkill).toContain('MISSING REQUIREMENTS');
    expect(reviewSkill).toContain('SCOPE CREEP');
  });

  test('item extraction has 50-item cap', () => {
    expect(shipSkill).toContain('at most 50 items');
  });

  test('uses file-level traceability (not commit-level)', () => {
    expect(shipSkill).toContain('Cite the specific file');
    expect(shipSkill).not.toContain('commit-level traceability');
  });
});

// --- {{PLAN_VERIFICATION_EXEC}} resolver tests ---

describeLegacyShip('PLAN_VERIFICATION_EXEC placeholder', () => {
  const shipSkill = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');

  test('ship SKILL.md contains plan verification step', () => {
    expect(shipSkill).toContain('Step 3.47');
    expect(shipSkill).toContain('Plan Verification');
  });

  test('references /qa-only invocation', () => {
    expect(shipSkill).toContain('qa-only/SKILL.md');
    expect(shipSkill).toContain('qa-only');
  });

  test('contains localhost reachability check', () => {
    expect(shipSkill).toContain('localhost:3000');
    expect(shipSkill).toContain('NO_SERVER');
  });

  test('skips gracefully when no verification section', () => {
    expect(shipSkill).toContain('No verification steps found in plan');
  });

  test('skips gracefully when no dev server', () => {
    expect(shipSkill).toContain('No dev server detected');
  });
});

// --- Coverage gate tests ---

describeLegacyShip('Coverage gate in ship', () => {
  const shipSkill = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');
  const reviewSkill = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');

  test('ship SKILL.md contains coverage gate with thresholds', () => {
    expect(shipSkill).toContain('Coverage gate');
    expect(shipSkill).toContain('>= target');
    expect(shipSkill).toContain('< minimum');
  });

  test('ship SKILL.md supports configurable thresholds via CLAUDE.md', () => {
    expect(shipSkill).toContain('## Test Coverage');
    expect(shipSkill).toContain('Minimum:');
    expect(shipSkill).toContain('Target:');
  });

  test('coverage gate skips on parse failure (not block)', () => {
    expect(shipSkill).toContain('could not determine percentage — skipping');
  });

  test('review SKILL.md delegates coverage to Testing specialist', () => {
    // Coverage audit moved to Testing specialist subagent in Review Army
    expect(reviewSkill).toContain('testing.md');
    expect(reviewSkill).toContain('INFORMATIONAL');
  });
});

// --- Ship metrics logging ---

describeLegacyShip('Ship metrics logging', () => {
  const shipSkill = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');

  test('ship SKILL.md contains metrics persistence step', () => {
    expect(shipSkill).toContain('Step 8.75');
    expect(shipSkill).toContain('coverage_pct');
    expect(shipSkill).toContain('plan_items_total');
    expect(shipSkill).toContain('plan_items_done');
    expect(shipSkill).toContain('verification_result');
  });
});

// --- Plan file discovery shared helper ---

describeLegacyShip('Plan file discovery shared helper', () => {
  // The shared helper should appear in ship (via PLAN_COMPLETION_AUDIT_SHIP)
  // and in review (via PLAN_COMPLETION_AUDIT_REVIEW)
  const shipSkill = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');
  const reviewSkill = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');

  test('plan file discovery appears in both ship and review', () => {
    expect(shipSkill).toContain('Plan File Discovery');
    expect(reviewSkill).toContain('Plan File Discovery');
  });

  test('both include conversation context first', () => {
    expect(shipSkill).toContain('Conversation context (primary)');
    expect(reviewSkill).toContain('Conversation context (primary)');
  });

  test('both include content-based fallback', () => {
    expect(shipSkill).toContain('Content-based search (fallback)');
    expect(reviewSkill).toContain('Content-based search (fallback)');
  });
});

// --- Retro plan completion ---

describe('Retro plan completion section', () => {
  const retroSkill = fs.readFileSync(path.join(ROOT, 'retro', 'SKILL.md'), 'utf-8');

  test('retro SKILL.md contains plan completion section', () => {
    expect(retroSkill).toContain('### Plan Completion');
    expect(retroSkill).toContain('plan_items_total');
    expect(retroSkill).toContain('Plan Completion This Period');
  });
});

// --- Plan status footer in preamble ---

describe('Plan status footer in preamble', () => {
  test('preamble contains plan status footer', () => {
    // Read any skill that uses PREAMBLE
    const content = fs.readFileSync(path.join(ROOT, 'office-hours', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Plan Status Footer');
    expect(content).toContain('NEXUS REVIEW REPORT');
    expect(content).toContain('nexus-review-read');
    expect(content).toContain('ExitPlanMode');
    expect(content).toContain('NO REVIEWS YET');
  });
});

// --- {{SPEC_REVIEW_LOOP}} resolver tests ---

describeLegacyOfficeHours('SPEC_REVIEW_LOOP resolver', () => {
  const content = fs.readFileSync(path.join(ROOT, 'office-hours', 'SKILL.md'), 'utf-8');

  test('contains all 5 review dimensions', () => {
    for (const dim of ['Completeness', 'Consistency', 'Clarity', 'Scope', 'Feasibility']) {
      expect(content).toContain(dim);
    }
  });

  test('references Agent tool for subagent dispatch', () => {
    expect(content).toMatch(/Agent.*tool/i);
  });

  test('specifies max 3 iterations', () => {
    expect(content).toMatch(/3.*iteration|maximum.*3/i);
  });

  test('includes quality score', () => {
    expect(content).toContain('quality score');
  });

  test('includes metrics path', () => {
    expect(content).toContain('spec-review.jsonl');
  });

  test('includes convergence guard', () => {
    expect(content).toMatch(/[Cc]onvergence/);
  });

  test('includes graceful failure handling', () => {
    expect(content).toMatch(/skip.*review|unavailable/i);
  });
});

// --- {{DESIGN_SKETCH}} resolver tests ---

describeLegacyOfficeHours('DESIGN_SKETCH resolver', () => {
  const content = fs.readFileSync(path.join(ROOT, 'office-hours', 'SKILL.md'), 'utf-8');

  test('references integrated design context for design system constraints', () => {
    expect(content).toContain('DESIGN.md');
    expect(content).toContain('brand-spec.md');
  });

  test('contains wireframe or sketch terminology', () => {
    expect(content).toMatch(/wireframe|sketch/i);
  });

  test('references browse binary for rendering', () => {
    expect(content).toContain('$B goto');
  });

  test('references screenshot capture', () => {
    expect(content).toContain('$B screenshot');
  });

  test('specifies rough aesthetic', () => {
    expect(content).toMatch(/[Rr]ough|hand-drawn/);
  });

  test('includes skip conditions', () => {
    expect(content).toMatch(/no UI component|skip/i);
  });
});

// --- {{CODEX_SECOND_OPINION}} resolver tests ---

describeLegacyOfficeHours('CODEX_SECOND_OPINION resolver', () => {
  const content = fs.readFileSync(path.join(ROOT, 'office-hours', 'SKILL.md'), 'utf-8');
  const codexContent = fs.readFileSync(path.join(ROOT, '.agents', 'skills', 'nexus-office-hours', 'SKILL.md'), 'utf-8');

  test('Phase 3.5 section appears in office-hours SKILL.md', () => {
    expect(content).toContain('Phase 3.5: Cross-Model Second Opinion');
  });

  test('contains codex exec invocation', () => {
    expect(content).toContain('codex exec');
  });

  test('contains opt-in AskUserQuestion text', () => {
    expect(content).toContain('second opinion from an independent AI perspective');
  });

  test('contains cross-model synthesis instructions', () => {
    expect(content).toMatch(/[Ss]ynthesis/);
    expect(content).toContain('Where Claude agrees with the second opinion');
  });

  test('contains Claude subagent fallback', () => {
    expect(content).toContain('CODEX_NOT_AVAILABLE');
    expect(content).toContain('Agent tool');
    expect(content).toContain('SECOND OPINION (Claude subagent)');
  });

  test('contains premise revision check', () => {
    expect(content).toContain('Codex challenged premise');
  });

  test('contains error handling for auth, timeout, and empty', () => {
    expect(content).toMatch(/[Aa]uth.*fail/);
    expect(content).toMatch(/[Tt]imeout/);
    expect(content).toMatch(/[Ee]mpty response/);
  });

  test('Codex host variant does NOT contain the Phase 3.5 resolver output', () => {
    // The resolver returns '' for codex host, so the interactive section is stripped.
    // Static template references to "Phase 3.5" in prose/conditionals are fine.
    // Other resolvers (design review lite) may contain CODEX_NOT_AVAILABLE, so we
    // check for Phase 3.5-specific markers only.
    expect(codexContent).not.toContain('Phase 3.5: Cross-Model Second Opinion');
    expect(codexContent).not.toContain('TMPERR_OH');
    expect(codexContent).not.toContain('nexus-codex-oh-');
  });
});

// --- Codex filesystem boundary tests ---

describeLegacyPlanAliases('Codex filesystem boundary', () => {
  // Skills that call codex exec/review and should contain boundary text
  const CODEX_CALLING_SKILLS = [
    'codex',         // /codex skill — 3 modes
    'autoplan',      // /autoplan — CEO/design/eng voices
    'review',        // /review — adversarial step resolver
    'ship',          // /ship — adversarial step resolver
    'plan-eng-review',  // outside voice resolver
    'plan-ceo-review',  // outside voice resolver
    'office-hours',     // second opinion resolver
  ];

  const BOUNDARY_MARKER = 'Do NOT read or execute any';

  test('boundary instruction appears in all skills that call codex', () => {
    for (const skill of CODEX_CALLING_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).toContain(BOUNDARY_MARKER);
    }
  });

  test('codex skill has Filesystem Boundary section', () => {
    const content = fs.readFileSync(path.join(ROOT, 'codex', 'SKILL.md'), 'utf-8');
    expect(content).toContain('## Filesystem Boundary');
    expect(content).toContain('skill definitions meant for a different AI system');
  });

  test('codex skill has rabbit-hole detection rule', () => {
    const content = fs.readFileSync(path.join(ROOT, 'codex', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Detect skill-file rabbit holes');
    expect(content).toContain('nexus-update-check');
    expect(content).toContain('Consider retrying');
  });

  test('review.ts CODEX_BOUNDARY constant is interpolated into resolver output', () => {
    // The adversarial step resolver should include boundary text in codex exec prompts
    const reviewContent = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    // Boundary should appear near codex exec invocations
    const boundaryIdx = reviewContent.indexOf(BOUNDARY_MARKER);
    const codexExecIdx = reviewContent.indexOf('codex exec');
    // Both must exist and boundary must come before a codex exec call
    expect(boundaryIdx).toBeGreaterThan(-1);
    expect(codexExecIdx).toBeGreaterThan(-1);
  });

  test('autoplan boundary text avoids host-specific paths for cross-host compatibility', () => {
    const content = fs.readFileSync(path.join(ROOT, 'autoplan', 'SKILL.md.tmpl'), 'utf-8');
    // autoplan template uses generic 'skills/nexus' pattern instead of host-specific
    // paths like ~/.claude/ or .agents/skills (which break Codex/Claude output tests)
    const boundaryStart = content.indexOf('Filesystem Boundary');
    const boundaryEnd = content.indexOf('---', boundaryStart + 1);
    const boundarySection = content.slice(boundaryStart, boundaryEnd);
    expect(boundarySection).not.toContain('~/.claude/');
    expect(boundarySection).not.toContain('.agents/skills');
    expect(boundarySection).toContain('skills/nexus');
    expect(boundarySection).toContain(BOUNDARY_MARKER);
  });
});

// --- {{BENEFITS_FROM}} resolver tests ---

describeLegacyPlanAliases('BENEFITS_FROM resolver', () => {
  const ceoContent = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');
  const engContent = fs.readFileSync(path.join(ROOT, 'plan-eng-review', 'SKILL.md'), 'utf-8');

  test('plan-ceo-review contains prerequisite skill offer', () => {
    expect(ceoContent).toContain('Prerequisite Skill Offer');
    expect(ceoContent).toContain('/office-hours');
  });

  test('plan-eng-review contains prerequisite skill offer', () => {
    expect(engContent).toContain('Prerequisite Skill Offer');
    expect(engContent).toContain('/office-hours');
  });

  test('offer includes graceful decline', () => {
    expect(ceoContent).toContain('No worries');
  });

  test('skills without benefits-from do NOT have prerequisite offer', () => {
    const qaContent = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md'), 'utf-8');
    expect(qaContent).not.toContain('Prerequisite Skill Offer');
  });

  test('inline invocation — no "another window" language', () => {
    expect(ceoContent).not.toContain('another window');
    expect(engContent).not.toContain('another window');
  });

  test('inline invocation — read-and-follow path present', () => {
    expect(ceoContent).toContain('office-hours/SKILL.md');
    expect(engContent).toContain('office-hours/SKILL.md');
  });

  test('BENEFITS_FROM delegates to INVOKE_SKILL pattern', () => {
    // Should contain the INVOKE_SKILL-style loading prose (not the old manual skip list)
    expect(engContent).toContain('Follow its instructions from top to bottom');
    expect(engContent).toContain('skipping these sections');
    expect(ceoContent).toContain('Follow its instructions from top to bottom');
  });
});

// --- {{INVOKE_SKILL}} resolver tests ---

describeLegacyPlanAliases('INVOKE_SKILL resolver', () => {
  const ceoContent = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');

  test('plan-ceo-review uses INVOKE_SKILL for mid-session office-hours fallback', () => {
    // The mid-session detection path should use INVOKE_SKILL-generated prose
    expect(ceoContent).toContain('office-hours/SKILL.md');
    expect(ceoContent).toContain('Follow its instructions from top to bottom');
  });

  test('INVOKE_SKILL output includes default skip list', () => {
    expect(ceoContent).toContain('Preamble (run first)');
    expect(ceoContent).toContain('Telemetry (run last)');
    expect(ceoContent).toContain('AskUserQuestion Format');
  });

  test('INVOKE_SKILL output includes error handling', () => {
    expect(ceoContent).toContain('If unreadable');
    expect(ceoContent).toContain('Could not load');
  });

  test('template uses {{INVOKE_SKILL:office-hours}} placeholder', () => {
    const tmpl = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md.tmpl'), 'utf-8');
    expect(tmpl).toContain('{{INVOKE_SKILL:office-hours}}');
  });
});

// --- {{CHANGELOG_WORKFLOW}} resolver tests ---

describeLegacyShip('CHANGELOG_WORKFLOW resolver', () => {
  const shipContent = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');

  test('ship SKILL.md contains changelog workflow', () => {
    expect(shipContent).toContain('CHANGELOG (auto-generate)');
    expect(shipContent).toContain('git log <base>..HEAD --oneline');
  });

  test('changelog workflow includes cross-check step', () => {
    expect(shipContent).toContain('Cross-check');
    expect(shipContent).toContain('Every commit must map to at least one bullet point');
  });

  test('changelog workflow includes voice guidance', () => {
    expect(shipContent).toContain('Lead with what the user can now **do**');
  });

  test('template uses {{CHANGELOG_WORKFLOW}} placeholder', () => {
    const tmpl = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md.tmpl'), 'utf-8');
    expect(tmpl).toContain('{{CHANGELOG_WORKFLOW}}');
    // Should NOT contain the old inline changelog content
    expect(tmpl).not.toContain('Group commits by theme');
  });

  test('changelog workflow includes keep-changelog format', () => {
    expect(shipContent).toContain('### Added');
    expect(shipContent).toContain('### Fixed');
  });
});

// --- Parameterized resolver infrastructure tests ---

describe('parameterized resolver support', () => {
  test('gen-skill-docs regex handles colon-separated args', () => {
    // Verify the template containing {{INVOKE_SKILL:office-hours}} was processed
    // without leaving unresolved placeholders
    const ceoContent = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');
    expect(ceoContent).not.toMatch(/\{\{INVOKE_SKILL:[^}]+\}\}/);
  });

  test('templates with parameterized resolvers pass unresolved check', () => {
    // All generated SKILL.md files should have no unresolved {{...}} placeholders
    const skillDirs = fs.readdirSync(ROOT).filter(d =>
      fs.existsSync(path.join(ROOT, d, 'SKILL.md'))
    );
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(ROOT, dir, 'SKILL.md'), 'utf-8');
      const unresolved = content.match(/\{\{[A-Z_]+(?::[^}]*)?\}\}/g);
      if (unresolved) {
        throw new Error(`${dir}/SKILL.md has unresolved placeholders: ${unresolved.join(', ')}`);
      }
    }
  });
});

// --- Preamble routing injection tests ---

describe('preamble routing injection', () => {
  const shipContent = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');

  test('preamble bash checks for routing section or equivalent guidance in CLAUDE.md', () => {
    expect(shipContent).toContain('Nexus Skill Routing');
    expect(shipContent).toContain('HAS_ROUTING');
    expect(shipContent).toContain('route lifecycle work through');
  });

  test('preamble bash reads routing_declined config', () => {
    expect(shipContent).toContain('routing_declined');
    expect(shipContent).toContain('ROUTING_DECLINED');
  });

  test('preamble includes routing injection AskUserQuestion', () => {
    expect(shipContent).toContain('Add Nexus invocation guidance to CLAUDE.md');
    expect(shipContent).toContain("I'll invoke Nexus commands manually");
  });

  test('routing injection does not auto-commit project CLAUDE.md changes', () => {
    expect(shipContent).toContain('Do not auto-commit the file');
    expect(shipContent).not.toContain('git add CLAUDE.md && git commit');
  });

  test('routing injection respects prior decline', () => {
    expect(shipContent).toContain('ROUTING_DECLINED');
    expect(shipContent).toMatch(/routing_declined.*true/);
  });

  test('routing injection only fires when all conditions met', () => {
    // Must be: HAS_ROUTING=no AND ROUTING_DECLINED=false AND PROACTIVE_PROMPTED=yes
    expect(shipContent).toContain('HAS_ROUTING');
    expect(shipContent).toContain('ROUTING_DECLINED');
    expect(shipContent).toContain('PROACTIVE_PROMPTED');
  });

  test('routing section content includes only canonical Nexus routing rules', () => {
    expect(shipContent).toContain('invoke discover');
    expect(shipContent).toContain('invoke frame');
    expect(shipContent).toContain('invoke plan');
    expect(shipContent).toContain('invoke handoff');
    expect(shipContent).toContain('invoke build');
    expect(shipContent).toContain('invoke review');
    expect(shipContent).toContain('invoke ship');
    expect(shipContent).toContain('invoke qa');
    expect(shipContent).toContain('invoke closeout');
    expect(shipContent).not.toContain('invoke investigate');
  });

  test('routing injection skips when equivalent lifecycle guidance already exists', () => {
    expect(shipContent).toContain('existing instruction that routes lifecycle work through');
    expect(shipContent).toContain('as equivalent Nexus routing guidance');
  });
});

describe('preamble execution mode guidance', () => {
  const shipContent = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');

  test('preamble bash emits execution mode state separately from repo mode', () => {
    expect(shipContent).toContain('CCB_AVAILABLE:');
    expect(shipContent).toContain('EXECUTION_MODE:');
    expect(shipContent).toContain('EXECUTION_MODE_CONFIGURED:');
    expect(shipContent).toContain('PRIMARY_PROVIDER:');
    expect(shipContent).toContain('PROVIDER_TOPOLOGY:');
    expect(shipContent).toContain('EXECUTION_PATH:');
    expect(shipContent).toContain('CURRENT_SESSION_READY:');
    expect(shipContent).toContain('GOVERNED_READY:');
    expect(shipContent).toContain('MOUNTED_PROVIDERS:');
    expect(shipContent).toContain('MISSING_PROVIDERS:');
    expect(shipContent).toContain('REPO_MODE:');
  });

  test('upgrade guidance forbids treating repo mode as execution mode', () => {
    expect(shipContent).toContain('REPO_MODE');
    expect(shipContent).toContain('EXECUTION_MODE');
    expect(shipContent).toContain('always include the standardized runtime summary');
    expect(shipContent).toContain('EXECUTION_PATH');
    expect(shipContent).toContain('CURRENT_SESSION_READY');
    expect(shipContent).toContain('MOUNTED_PROVIDERS');
    expect(shipContent).toContain('MISSING_PROVIDERS');
    expect(shipContent).toContain('Never describe `solo` or `collaborative` as an execution mode');
    expect(shipContent).toContain('default derived from machine state, not a saved preference');
    expect(shipContent).toContain('nexus-config effective-execution');
    expect(shipContent).toContain('do not ask the user to configure `PRIMARY_PROVIDER` or `PROVIDER_TOPOLOGY`');
    expect(shipContent).toContain('Those are local-provider host preferences, not governed CCB config keys');
    expect(shipContent).toContain('Current session ready: `CURRENT_SESSION_READY`');
    expect(shipContent).toContain('If `EXECUTION_MODE=governed_ccb`: governed ready, mounted providers, missing providers');
  });

  test('claude post-upgrade guidance persists execution mode when CCB is already installed', () => {
    expect(shipContent).toContain('Nexus just upgraded, but this machine still has no saved execution-mode preference.');
    expect(shipContent).toContain('Stay in the current Claude session with local_provider');
    expect(shipContent).toContain('Persist governed_ccb and use mounted CCB providers');
    expect(shipContent).toContain('nexus-config set execution_mode governed_ccb');
    expect(shipContent).toContain('nexus-config set execution_mode local_provider');
    expect(shipContent).toContain('ccb codex gemini claude');
  });

  test('preamble prompts to switch saved governed preference when CCB is not runnable', () => {
    expect(shipContent).toContain('If `EXECUTION_MODE=governed_ccb` and `CURRENT_SESSION_READY` is `no` and `LOCAL_PROVIDER_READY` is `yes`');
    expect(shipContent).toContain('Switch this host to local_provider');
    expect(shipContent).toContain('Keep governed_ccb and mount the missing CCB providers');
    expect(shipContent).toContain('nexus-config set execution_mode local_provider');
    expect(shipContent).toContain('nexus-config set primary_provider "$_LOCAL_PROVIDER_CANDIDATE"');
    expect(shipContent).toContain('nexus-config set provider_topology "$_LOCAL_PROVIDER_TOPOLOGY"');
  });
});

describe('Nexus-first wrapper language', () => {
  test('canonical wrappers stay Nexus-first even after upstream imports exist', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan', 'SKILL.md'), 'utf-8');

    expect(content).toContain('Nexus-owned planning guidance for execution readiness and bounded scope.');
    expect(content).not.toMatch(/GSD-native command|PM-native command|Superpowers-native command/i);
  });

  test('transitional aliases remain compatibility-only wrappers', () => {
    const content = fs.readFileSync(path.join(ROOT, 'office-hours', 'SKILL.md'), 'utf-8');

    expect(content).toContain('This alias routes to `/discover`.');
    expect(content).toContain('does not own separate contract, artifact, or transition logic');
    expect(content).not.toMatch(/primary backend owner|source of truth/i);
  });
});

// --- {{DESIGN_OUTSIDE_VOICES}} resolver tests ---

describe('DESIGN_OUTSIDE_VOICES resolver', () => {
  test('plan-design-review contains outside voices section', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-design-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Design Outside Voices');
    expect(content).toContain('CODEX_AVAILABLE');
    expect(content).toContain('LITMUS SCORECARD');
  });

  test('design-review contains outside voices section', () => {
    const content = fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Design Outside Voices');
    expect(content).toContain('source audit');
  });

  test('design-consultation contains outside voices section', () => {
    const content = fs.readFileSync(path.join(ROOT, 'design-consultation', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Design Outside Voices');
    expect(content).toContain('design direction');
  });

  test('branches correctly per skillName — different prompts', () => {
    const planContent = fs.readFileSync(path.join(ROOT, 'plan-design-review', 'SKILL.md'), 'utf-8');
    const consultContent = fs.readFileSync(path.join(ROOT, 'design-consultation', 'SKILL.md'), 'utf-8');
    // plan-design-review uses analytical prompt (high reasoning)
    expect(planContent).toContain('model_reasoning_effort="high"');
    // design-consultation uses creative prompt (medium reasoning)
    expect(consultContent).toContain('model_reasoning_effort="medium"');
  });
});

// --- {{DESIGN_HARD_RULES}} resolver tests ---

describe('DESIGN_HARD_RULES resolver', () => {
  test('plan-design-review Pass 4 contains hard rules', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-design-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Design Hard Rules');
    expect(content).toContain('Classifier');
    expect(content).toContain('MARKETING/LANDING PAGE');
    expect(content).toContain('APP UI');
  });

  test('design-review contains hard rules', () => {
    const content = fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Design Hard Rules');
  });

  test('includes all 3 rule sets', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-design-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Landing page rules');
    expect(content).toContain('App UI rules');
    expect(content).toContain('Universal rules');
  });

  test('references shared AI slop blacklist items', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-design-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('3-column feature grid');
    expect(content).toContain('Purple/violet/indigo');
  });

  test('includes OpenAI hard rejection criteria', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-design-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Generic SaaS card grid');
    expect(content).toContain('Carousel with no narrative purpose');
  });

  test('includes OpenAI litmus checks', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-design-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Brand/product unmistakable');
    expect(content).toContain('premium with all decorative shadows removed');
  });
});

// --- Extended DESIGN_SKETCH resolver tests ---

describeLegacyOfficeHours('DESIGN_SKETCH extended with outside voices', () => {
  const content = fs.readFileSync(path.join(ROOT, 'office-hours', 'SKILL.md'), 'utf-8');

  test('contains outside design voices step', () => {
    expect(content).toContain('Outside design voices');
  });

  test('offers opt-in via AskUserQuestion', () => {
    expect(content).toContain('outside design perspectives');
  });

  test('still contains original wireframe steps', () => {
    expect(content).toContain('wireframe');
    expect(content).toContain('$B goto');
  });
});

// --- Extended DESIGN_REVIEW_LITE resolver tests ---

describeLegacyShip('DESIGN_REVIEW_LITE extended with Codex', () => {
  const content = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');

  test('contains Codex design voice block', () => {
    expect(content).toContain('Codex design voice');
    expect(content).toContain('CODEX (design)');
  });

  test('still contains original checklist steps', () => {
    expect(content).toContain('design-checklist.md');
    expect(content).toContain('SCOPE_FRONTEND');
  });

});

// ─── Codex Generation Tests ─────────────────────────────────

describe('Codex generation (--host codex)', () => {
  const AGENTS_DIR = path.join(ROOT, '.agents', 'skills');

  // .agents/ is gitignored (v0.11.2.0) — generate on demand for tests
  Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'codex'], {
    cwd: ROOT, stdout: 'pipe', stderr: 'pipe',
  });

  // Dynamic discovery of expected Codex skills: all templates except /codex
  // Also excludes skills where .agents/skills/{name} is a symlink back to the repo root
  // (vendored dev mode — gen-skill-docs skips these to avoid overwriting Claude SKILL.md)
  const CODEX_SKILLS = (() => {
    const skills: Array<{ dir: string; codexName: string }> = [];
    const isSymlinkLoop = (codexName: string): boolean => {
      const agentSkillDir = path.join(ROOT, '.agents', 'skills', codexName);
      try {
        return fs.realpathSync(agentSkillDir) === fs.realpathSync(ROOT);
      } catch { return false; }
    };
    if (fs.existsSync(path.join(ROOT, 'SKILL.md.tmpl'))) {
      if (!isSymlinkLoop('nexus')) {
        skills.push({ dir: '.', codexName: 'nexus' });
      }
    }
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.name === 'codex') continue; // /codex is excluded from Codex output
      if (!fs.existsSync(path.join(ROOT, entry.name, 'SKILL.md.tmpl'))) continue;
      const codexName = entry.name.startsWith('nexus-')
        ? entry.name
        : `nexus-${entry.name}`;
      if (isSymlinkLoop(codexName)) continue;
      skills.push({ dir: entry.name, codexName });
    }
    return skills;
  })();

  test('--host codex generates correct output paths', () => {
    for (const skill of CODEX_SKILLS) {
      const skillMd = path.join(AGENTS_DIR, skill.codexName, 'SKILL.md');
      expect(fs.existsSync(skillMd)).toBe(true);
    }
  });

  test('root nexus bundle has OpenAI metadata for Codex skill browsing', () => {
    const rootMetadata = path.join(ROOT, 'agents', 'openai.yaml');
    expect(fs.existsSync(rootMetadata)).toBe(true);
    const content = fs.readFileSync(rootMetadata, 'utf-8');
    expect(content).toContain('display_name: "nexus"');
    expect(content).toContain('Use $nexus to locate the bundled Nexus skills.');
    expect(content).toContain('allow_implicit_invocation: true');
  });

  test('externalSkillName mapping: root is nexus, others are nexus-{dir}', () => {
    expect(fs.existsSync(path.join(AGENTS_DIR, 'nexus', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(AGENTS_DIR, 'nexus-review', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(AGENTS_DIR, 'nexus-ship', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(AGENTS_DIR, 'nexus-upgrade', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(AGENTS_DIR, 'nexus-nexus-upgrade', 'SKILL.md'))).toBe(false);
  });

  test('Codex frontmatter has ONLY name + description', () => {
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(path.join(AGENTS_DIR, skill.codexName, 'SKILL.md'), 'utf-8');
      expect(content.startsWith('---\n')).toBe(true);
      const fmEnd = content.indexOf('\n---', 4);
      expect(fmEnd).toBeGreaterThan(0);
      const frontmatter = content.slice(4, fmEnd);
      // Must have name and description
      expect(frontmatter).toContain('name:');
      expect(frontmatter).toContain('description:');
      // Must NOT have allowed-tools, version, or hooks
      expect(frontmatter).not.toContain('allowed-tools:');
      expect(frontmatter).not.toContain('version:');
      expect(frontmatter).not.toContain('hooks:');
    }
  });

  test('all Codex skills have agents/openai.yaml metadata', () => {
    for (const skill of CODEX_SKILLS) {
      const metadata = path.join(AGENTS_DIR, skill.codexName, 'agents', 'openai.yaml');
      expect(fs.existsSync(metadata)).toBe(true);
      const content = fs.readFileSync(metadata, 'utf-8');
      expect(content).toContain(`display_name: "${skill.codexName}"`);
      expect(content).toContain('short_description:');
      expect(content).toContain('allow_implicit_invocation: true');
    }
  });

  test('no .claude/skills/ in Codex output', () => {
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(path.join(AGENTS_DIR, skill.codexName, 'SKILL.md'), 'utf-8');
      expect(content).not.toContain('.claude/skills');
    }
  });

  test('no ~/.claude/ paths in Codex output', () => {
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(path.join(AGENTS_DIR, skill.codexName, 'SKILL.md'), 'utf-8');
      expect(content).not.toContain('~/.claude/');
    }
  });

  test('/codex skill excluded from Codex output', () => {
    expect(fs.existsSync(path.join(AGENTS_DIR, 'nexus-codex', 'SKILL.md'))).toBe(false);
    expect(fs.existsSync(path.join(AGENTS_DIR, 'nexus-codex'))).toBe(false);
  });

  test('Codex review step stripped from Codex-host ship and review', () => {
    const shipContent = fs.readFileSync(path.join(AGENTS_DIR, 'nexus-ship', 'SKILL.md'), 'utf-8');
    expect(shipContent).not.toContain('codex review --base');
    expect(shipContent).not.toContain('CODEX_REVIEWS');

    const reviewContent = fs.readFileSync(path.join(AGENTS_DIR, 'nexus-review', 'SKILL.md'), 'utf-8');
    expect(reviewContent).not.toContain('codex review --base');
    expect(reviewContent).not.toContain('CODEX_REVIEWS');
  });

  test('--host codex --dry-run freshness', () => {
    const result = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'codex', '--dry-run'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    // Every Codex skill should be FRESH
    for (const skill of CODEX_SKILLS) {
      expect(output).toContain(`FRESH: .agents/skills/${skill.codexName}/SKILL.md`);
    }
    expect(output).not.toContain('STALE');
  });

  test('--host agents alias produces same output as --host codex', () => {
    const codexResult = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'codex', '--dry-run'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const agentsResult = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'agents', '--dry-run'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(codexResult.exitCode).toBe(0);
    expect(agentsResult.exitCode).toBe(0);
    // Both should produce the same output (same FRESH lines)
    expect(codexResult.stdout.toString()).toBe(agentsResult.stdout.toString());
  });

  test('multiline descriptions preserved in Codex output', () => {
    // office-hours remains a multiline description even as a Nexus alias wrapper.
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'nexus-office-hours', 'SKILL.md'), 'utf-8');
    const fmEnd = content.indexOf('\n---', 4);
    const frontmatter = content.slice(4, fmEnd);
    const descLines = frontmatter.split('\n').filter(l => l.startsWith('  '));
    expect(descLines.length).toBeGreaterThan(1);
    expect(frontmatter).toContain('canonical Nexus /discover command');
  });

  test('hook skills have safety prose and no hooks: in frontmatter', () => {
    const HOOK_SKILLS = ['nexus-careful', 'nexus-freeze', 'nexus-guard'];
    for (const skillName of HOOK_SKILLS) {
      const content = fs.readFileSync(path.join(AGENTS_DIR, skillName, 'SKILL.md'), 'utf-8');
      // Must have safety advisory prose
      expect(content).toContain('Safety Advisory');
      // Must NOT have hooks: in frontmatter
      const fmEnd = content.indexOf('\n---', 4);
      const frontmatter = content.slice(4, fmEnd);
      expect(frontmatter).not.toContain('hooks:');
    }
  });

  test('all Codex SKILL.md files have auto-generated header', () => {
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(path.join(AGENTS_DIR, skill.codexName, 'SKILL.md'), 'utf-8');
      expect(content).toContain('AUTO-GENERATED from SKILL.md.tmpl');
      expect(content).toContain('Regenerate: bun run gen:skill-docs');
    }
  });

  test('Codex preamble resolves runtime assets from repo-local or global nexus roots', () => {
    // Check a skill that has a preamble (review is a good candidate)
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'nexus-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('NEXUS_ROOT');
    expect(content).toContain('$_ROOT/.agents/skills/nexus');
    expect(content).toContain('$NEXUS_BIN/nexus-config');
    expect(content).toContain('$NEXUS_ROOT/nexus-upgrade/SKILL.md');
    expect(content).not.toContain('~/.codex/skills/nexus/bin/nexus-config get telemetry');
  });

  test('Codex preamble prompts plainly when saved governed preference is not runnable', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'nexus-ship', 'SKILL.md'), 'utf-8');
    expect(content).toContain('present a plain numbered choice and wait for the user response');
    expect(content).toContain('Switch this host to local_provider');
    expect(content).toContain('Keep governed_ccb and mount the missing CCB providers');
    expect(content).toContain('nexus-config set execution_mode local_provider');
    expect(content).toContain('nexus-config set primary_provider "$_LOCAL_PROVIDER_CANDIDATE"');
    expect(content).toContain('nexus-config set provider_topology "$_LOCAL_PROVIDER_TOPOLOGY"');
  });

  test('Codex root nexus skill describes blocked governed choice without Claude-only AskUserQuestion wording', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'nexus', 'SKILL.md'), 'utf-8');
    expect(content).toContain("preamble's blocked-governed route choice prompt");
    expect(content).not.toContain("preamble's blocked-governed AskUserQuestion");
  });

  // ─── Path rewriting regression tests ─────────────────────────

  test('sidecar paths point to .agents/skills/nexus/review/ (not nexus-review/)', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'nexus-review', 'SKILL.md'), 'utf-8');
    if (isNexusWrapperSkill('review')) {
      expect(content).not.toContain('checklist.md');
      expect(content).toContain('NEXUS_PROJECT_CWD="$_REPO_CWD" bun run bin/nexus.ts review');
      return;
    }

    expect(content).toContain('.agents/skills/nexus/review/checklist.md');
    expect(content).not.toContain('.agents/skills/nexus-review/checklist.md');
  });

  test('sidecar paths in ship skill point to nexus/review/ for pre-landing review', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'nexus-ship', 'SKILL.md'), 'utf-8');
    if (isNexusWrapperSkill('ship')) {
      expect(content).not.toContain('checklist.md');
      expect(content).toContain('NEXUS_PROJECT_CWD="$_REPO_CWD" bun run bin/nexus.ts ship');
      return;
    }

    if (content.includes('checklist.md')) {
      expect(content).toContain('.agents/skills/nexus/review/');
      expect(content).not.toContain('.agents/skills/nexus-review/checklist');
    }
  });

  test('greptile-triage sidecar path is correct', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'nexus-review', 'SKILL.md'), 'utf-8');
    if (isNexusWrapperSkill('review')) {
      expect(content).not.toContain('greptile-triage');
      return;
    }

    if (content.includes('greptile-triage')) {
      expect(content).toContain('.agents/skills/nexus/review/greptile-triage.md');
      expect(content).not.toContain('.agents/skills/nexus-review/greptile-triage');
    }
  });

  test('all four path rewrite rules produce correct output', () => {
    // Test each of the 4 path rewrite rules individually
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'nexus-review', 'SKILL.md'), 'utf-8');

    // Rule 1: ~/.claude/skills/nexus → $NEXUS_ROOT
    expect(content).not.toContain('~/.claude/skills/nexus');
    expect(content).toContain('$NEXUS_ROOT');

    // Rule 2: .claude/skills/nexus → .agents/skills/nexus
    expect(content).not.toContain('.claude/skills/nexus');

    // Rule 3: .claude/skills/review → .agents/skills/nexus/review
    expect(content).not.toContain('.claude/skills/review');

    // Rule 4: .claude/skills → .agents/skills (catch-all)
    expect(content).not.toContain('.claude/skills');
  });

  test('path rewrite rules apply to all Codex skills with sidecar references', () => {
    // Verify across ALL generated skills, not just review
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(path.join(AGENTS_DIR, skill.codexName, 'SKILL.md'), 'utf-8');
      // No skill should reference Claude paths
      expect(content).not.toContain('~/.claude/skills');
      expect(content).not.toContain('.claude/skills');
      if (content.includes('nexus-config') || content.includes('nexus-update-check')) {
        expect(content).toContain('$NEXUS_ROOT');
      }
      // If a skill references checklist.md, it must use the correct sidecar path
      if (content.includes('checklist.md') && !content.includes('design-checklist.md')) {
        expect(content).not.toContain('nexus-review/checklist.md');
      }
    }
  });

  // ─── Claude output regression guard ─────────────────────────

  test('Claude output unchanged: review skill still uses .claude/skills/ paths', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    if (isNexusWrapperSkill('review')) {
      expect(content).toContain('NEXUS_PROJECT_CWD="$_REPO_CWD" bun run bin/nexus.ts review');
      expect(content).not.toContain('.claude/skills/review/checklist.md');
    } else {
      expect(content).toContain('.claude/skills/review/checklist.md');
      expect(content).toContain('~/.claude/skills/nexus');
    }
    expect(content).not.toContain('.agents/skills');
    expect(content).not.toContain('~/.codex/');
  });

  test('Claude output unchanged: ship skill still uses .claude/skills/ paths', () => {
    const content = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');
    if (isNexusWrapperSkill('ship')) {
      expect(content).toContain('NEXUS_PROJECT_CWD="$_REPO_CWD" bun run bin/nexus.ts ship');
    } else {
      expect(content).toContain('~/.claude/skills/nexus');
    }
    expect(content).not.toContain('.agents/skills');
    expect(content).not.toContain('~/.codex/');
  });

  test('Claude output unchanged: all Claude skills have zero Codex paths', () => {
    for (const skill of ALL_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      expect(content).not.toContain('~/.codex/');
      expect(content).not.toContain('.agents/skills');
    }
  });

  // ─── Design outside voices: Codex host guard ─────────────────

  test('codex host produces empty outside voices in design-review', () => {
    const codexContent = fs.readFileSync(path.join(AGENTS_DIR, 'nexus-design-review', 'SKILL.md'), 'utf-8');
    expect(codexContent).not.toContain('Design Outside Voices');
  });

  test('codex host does not include Codex design block in ship', () => {
    const codexContent = fs.readFileSync(path.join(AGENTS_DIR, 'nexus-ship', 'SKILL.md'), 'utf-8');
    expect(codexContent).not.toContain('Codex design voice');
  });
});

// ─── Factory generation tests ────────────────────────────────

describe('Factory generation (--host factory)', () => {
  const FACTORY_DIR = path.join(ROOT, '.factory', 'skills');

  // Generate Factory output for tests
  Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'factory'], {
    cwd: ROOT, stdout: 'pipe', stderr: 'pipe',
  });

  const FACTORY_SKILLS = (() => {
    const skills: Array<{ dir: string; factoryName: string }> = [];
    const isSymlinkLoop = (name: string): boolean => {
      const factorySkillDir = path.join(ROOT, '.factory', 'skills', name);
      try { return fs.realpathSync(factorySkillDir) === fs.realpathSync(ROOT); }
      catch { return false; }
    };
    if (fs.existsSync(path.join(ROOT, 'SKILL.md.tmpl'))) {
      if (!isSymlinkLoop('nexus')) skills.push({ dir: '.', factoryName: 'nexus' });
    }
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.name === 'codex') continue;
      if (!fs.existsSync(path.join(ROOT, entry.name, 'SKILL.md.tmpl'))) continue;
      const factoryName = entry.name.startsWith('nexus-')
        ? entry.name
        : `nexus-${entry.name}`;
      if (isSymlinkLoop(factoryName)) continue;
      skills.push({ dir: entry.name, factoryName });
    }
    return skills;
  })();

  test('--host factory generates correct output paths', () => {
    for (const skill of FACTORY_SKILLS) {
      const skillMd = path.join(FACTORY_DIR, skill.factoryName, 'SKILL.md');
      expect(fs.existsSync(skillMd)).toBe(true);
    }
  });

  test('Factory frontmatter has name + description + user-invocable', () => {
    for (const skill of FACTORY_SKILLS) {
      const content = fs.readFileSync(path.join(FACTORY_DIR, skill.factoryName, 'SKILL.md'), 'utf-8');
      const fmEnd = content.indexOf('\n---', 4);
      const frontmatter = content.slice(4, fmEnd);
      expect(frontmatter).toContain('name:');
      expect(frontmatter).toContain('description:');
      expect(frontmatter).toContain('user-invocable: true');
      expect(frontmatter).not.toContain('allowed-tools:');
      expect(frontmatter).not.toContain('preamble-tier:');
      expect(frontmatter).not.toContain('sensitive:');
    }
  });

  test('sensitive skills have disable-model-invocation', () => {
    const SENSITIVE = ['nexus-ship', 'nexus-land-and-deploy', 'nexus-guard', 'nexus-careful', 'nexus-freeze', 'nexus-unfreeze'];
    for (const name of SENSITIVE) {
      const content = fs.readFileSync(path.join(FACTORY_DIR, name, 'SKILL.md'), 'utf-8');
      const fmEnd = content.indexOf('\n---', 4);
      const frontmatter = content.slice(4, fmEnd);
      expect(frontmatter).toContain('disable-model-invocation: true');
    }
  });

  test('non-sensitive skills lack disable-model-invocation', () => {
    const NON_SENSITIVE = ['nexus-qa', 'nexus-review', 'nexus-investigate', 'nexus-browse'];
    for (const name of NON_SENSITIVE) {
      const content = fs.readFileSync(path.join(FACTORY_DIR, name, 'SKILL.md'), 'utf-8');
      const fmEnd = content.indexOf('\n---', 4);
      const frontmatter = content.slice(4, fmEnd);
      expect(frontmatter).not.toContain('disable-model-invocation');
    }
  });

  test('no .claude/skills/ in Factory output', () => {
    for (const skill of FACTORY_SKILLS) {
      const content = fs.readFileSync(path.join(FACTORY_DIR, skill.factoryName, 'SKILL.md'), 'utf-8');
      expect(content).not.toContain('.claude/skills');
    }
  });

  test('no ~/.claude/skills/ paths in Factory output', () => {
    for (const skill of FACTORY_SKILLS) {
      const content = fs.readFileSync(path.join(FACTORY_DIR, skill.factoryName, 'SKILL.md'), 'utf-8');
      // ~/.claude/skills should be rewritten, but ~/.claude/plans is legitimate
      // (plan directory lookup) and ~/.claude/ in codex prompts is intentional
      expect(content).not.toContain('~/.claude/skills');
    }
  });

  test('/codex skill excluded from Factory output', () => {
    expect(fs.existsSync(path.join(FACTORY_DIR, 'nexus-codex', 'SKILL.md'))).toBe(false);
    expect(fs.existsSync(path.join(FACTORY_DIR, 'nexus-codex'))).toBe(false);
  });

  test('Factory keeps Codex integration blocks', () => {
    // Factory users CAN use Codex second opinions (codex exec is a standalone binary)
    const shipContent = fs.readFileSync(path.join(FACTORY_DIR, 'nexus-ship', 'SKILL.md'), 'utf-8');
    expect(shipContent).toContain('codex');
  });

  test('no agents/openai.yaml in Factory output', () => {
    for (const skill of FACTORY_SKILLS) {
      const yamlPath = path.join(FACTORY_DIR, skill.factoryName, 'agents', 'openai.yaml');
      expect(fs.existsSync(yamlPath)).toBe(false);
    }
  });

  test('--host droid alias works', () => {
    const factoryResult = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'factory', '--dry-run'], {
      cwd: ROOT, stdout: 'pipe', stderr: 'pipe',
    });
    const droidResult = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'droid', '--dry-run'], {
      cwd: ROOT, stdout: 'pipe', stderr: 'pipe',
    });
    expect(factoryResult.exitCode).toBe(0);
    expect(droidResult.exitCode).toBe(0);
    expect(factoryResult.stdout.toString()).toBe(droidResult.stdout.toString());
  });

  test('--host factory --dry-run freshness', () => {
    const result = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'factory', '--dry-run'], {
      cwd: ROOT, stdout: 'pipe', stderr: 'pipe',
    });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    for (const skill of FACTORY_SKILLS) {
      expect(output).toContain(`FRESH: .factory/skills/${skill.factoryName}/SKILL.md`);
    }
    expect(output).not.toContain('STALE');
  });

  test('Factory preamble uses .factory paths', () => {
    const content = fs.readFileSync(path.join(FACTORY_DIR, 'nexus-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('NEXUS_ROOT');
    expect(content).toContain('$_ROOT/.factory/skills/nexus');
    expect(content).toContain('$NEXUS_BIN/nexus-config');
  });
});

// ─── --host all tests ────────────────────────────────────────

describe('--host all', () => {
  test('--host all generates for claude, codex, and factory', () => {
    const result = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'all', '--dry-run'], {
      cwd: ROOT, stdout: 'pipe', stderr: 'pipe',
    });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    // All three hosts should appear in output
    expect(output).toContain('FRESH: SKILL.md');           // claude
    expect(output).toContain('FRESH: .agents/skills/');     // codex
    expect(output).toContain('FRESH: .factory/skills/');    // factory
  });
});

// ─── Setup script validation ─────────────────────────────────
// These tests verify the setup script's install layout matches
// what the generator produces — catching the bug where setup
// installed Claude-format source dirs for Codex users.

describe('setup script validation', () => {
  const setupContent = fs.readFileSync(path.join(ROOT, 'setup'), 'utf-8');

  test('setup has separate link functions for Claude and Codex', () => {
    expect(setupContent).toContain('link_claude_skill_dirs');
    expect(setupContent).toContain('link_codex_skill_dirs');
    // Old unified function must not exist
    expect(setupContent).not.toMatch(/^link_skill_dirs\(\)/m);
  });

  test('Claude install uses link_claude_skill_dirs', () => {
    // The Claude install section (section 4) should use the Claude function
    const claudeSection = setupContent.slice(
      setupContent.indexOf('# 4. Install for Claude'),
      setupContent.indexOf('# 5. Install for Codex')
    );
    expect(claudeSection).toContain('link_claude_skill_dirs');
    expect(claudeSection).not.toContain('link_codex_skill_dirs');
  });

  test('Codex install uses link_codex_skill_dirs', () => {
    // The Codex install section (section 5) should use the Codex function
    const codexSection = setupContent.slice(
      setupContent.indexOf('# 5. Install for Codex'),
      setupContent.indexOf('# 6. Create')
    );
    expect(codexSection).toContain('create_codex_runtime_root');
    expect(codexSection).toContain('link_codex_skill_dirs');
    expect(codexSection).not.toContain('link_claude_skill_dirs');
    expect(codexSection).not.toContain('ln -snf "$NEXUS_DIR" "$CODEX_NEXUS"');
  });

  test('Codex install prefers repo-local .agents/skills when setup runs from there', () => {
    expect(setupContent).toContain('SKILLS_PARENT_BASENAME');
    expect(setupContent).toContain('CODEX_REPO_LOCAL=0');
    expect(setupContent).toContain('[ "$SKILLS_PARENT_BASENAME" = ".agents" ]');
    expect(setupContent).toContain('CODEX_REPO_LOCAL=1');
    expect(setupContent).toContain('CODEX_SKILLS="$INSTALL_SKILLS_DIR"');
  });

  test('setup separates install path from source path for symlinked repo-local installs', () => {
    expect(setupContent).toContain('INSTALL_NEXUS_DIR=');
    expect(setupContent).toContain('SOURCE_NEXUS_DIR=');
    expect(setupContent).toContain('INSTALL_SKILLS_DIR=');
    expect(setupContent).toContain('CODEX_NEXUS="$INSTALL_NEXUS_DIR"');
    expect(setupContent).toContain('link_codex_skill_dirs "$SOURCE_NEXUS_DIR" "$CODEX_SKILLS"');
  });

  test('Codex installs always create sidecar runtime assets for the real skill target', () => {
    expect(setupContent).toContain('if [ "$INSTALL_CODEX" -eq 1 ]; then');
    expect(setupContent).toContain('create_agents_sidecar "$SOURCE_NEXUS_DIR"');
  });

  test('link_codex_skill_dirs reads from .agents/skills/', () => {
    // The Codex link function must reference .agents/skills for generated Codex skills
    const fnStart = setupContent.indexOf('link_codex_skill_dirs()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('linked[@]}', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('.agents/skills');
    expect(fnBody).toContain('nexus*');
  });

  test('link_claude_skill_dirs creates relative symlinks', () => {
    // Claude links should be relative: ln -snf "nexus/$dir_name"
    // Uses dir_name (not skill_name) because symlink target must point to the physical directory
    const fnStart = setupContent.indexOf('link_claude_skill_dirs()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('linked[@]}', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('ln -snf "nexus/$dir_name"');
  });

  test('setup supports --host auto|claude|codex|kiro', () => {
    expect(setupContent).toContain('--host');
    expect(setupContent).toContain('claude|codex|kiro|factory|auto');
  });

  test('auto mode detects claude, codex, and kiro binaries', () => {
    expect(setupContent).toContain('command -v claude');
    expect(setupContent).toContain('command -v codex');
    expect(setupContent).toContain('command -v kiro-cli');
  });

  // T1: Sidecar skip guard — prevents .agents/skills/nexus from being linked as a skill
  test('link_codex_skill_dirs skips the nexus sidecar directory', () => {
    const fnStart = setupContent.indexOf('link_codex_skill_dirs()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('done', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('[ "$skill_name" = "nexus" ] && continue');
  });

  // T2: Dynamic $NEXUS_ROOT paths in generated Codex preambles
  test('generated Codex preambles use dynamic NEXUS_ROOT paths', () => {
    const codexSkillDir = path.join(ROOT, '.agents', 'skills', 'nexus-ship');
    if (!fs.existsSync(codexSkillDir)) return; // skip if .agents/ not generated
    const content = fs.readFileSync(path.join(codexSkillDir, 'SKILL.md'), 'utf-8');
    expect(content).toContain('NEXUS_ROOT=');
    expect(content).toContain('$NEXUS_BIN/');
  });

  // T3: Kiro host support in setup script
  test('setup supports --host kiro with install section and sed rewrites', () => {
    expect(setupContent).toContain('INSTALL_KIRO=');
    expect(setupContent).toContain('kiro-cli');
    expect(setupContent).toContain('KIRO_SKILLS=');
    expect(setupContent).toContain('~/.kiro/skills/nexus');
  });

  test('create_agents_sidecar links runtime assets', () => {
    // Sidecar must link bin, browse, review, qa
    const fnStart = setupContent.indexOf('create_agents_sidecar()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('done', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('bin');
    expect(fnBody).toContain('browse');
    expect(fnBody).toContain('review');
    expect(fnBody).toContain('qa');
  });

  test('create_codex_runtime_root exposes only runtime assets', () => {
    const fnStart = setupContent.indexOf('create_codex_runtime_root()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('done', setupContent.indexOf('review/', fnStart)));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('nexus/SKILL.md');
    expect(fnBody).toContain('browse/dist');
    expect(fnBody).toContain('browse/bin');
    expect(fnBody).toContain('nexus-upgrade/SKILL.md');
    // Review runtime assets (individual files, not the whole dir)
    expect(fnBody).toContain('checklist.md');
    expect(fnBody).toContain('design-checklist.md');
    expect(fnBody).toContain('greptile-triage.md');
    expect(fnBody).toContain('TODOS-format.md');
    expect(fnBody).not.toContain('ln -snf "$gstack_dir" "$codex_gstack"');
  });

  test('direct Codex installs are migrated out of ~/.codex/skills/nexus', () => {
    expect(setupContent).toContain('migrate_direct_codex_install');
    expect(setupContent).toContain('$HOME/.nexus/repos/nexus');
    expect(setupContent).toContain('avoid duplicate skill discovery');
  });

  // --- Symlink prefix tests (PR #503) ---

  test('link_claude_skill_dirs applies nexus- prefix in namespaced mode', () => {
    const fnStart = setupContent.indexOf('link_claude_skill_dirs()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('linked[@]}', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('SKILL_PREFIX');
    expect(fnBody).toContain('link_name="nexus-$skill_name"');
  });

  test('link_claude_skill_dirs preserves already-prefixed dirs', () => {
    const fnStart = setupContent.indexOf('link_claude_skill_dirs()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('linked[@]}', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    // nexus-* dirs should keep their name (e.g., nexus-upgrade stays nexus-upgrade)
    expect(fnBody).toContain('nexus-*) link_name="$skill_name"');
  });

  test('setup supports --no-prefix flag', () => {
    expect(setupContent).toContain('--no-prefix');
    expect(setupContent).toContain('SKILL_PREFIX=0');
  });

  test('cleanup_old_claude_symlinks removes only nexus-pointing symlinks', () => {
    expect(setupContent).toContain('cleanup_old_claude_symlinks');
    const fnStart = setupContent.indexOf('cleanup_old_claude_symlinks()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('removed[@]}', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    // Should check readlink before removing
    expect(fnBody).toContain('readlink');
    expect(fnBody).toContain('nexus/*');
    // Should skip already-prefixed dirs
    expect(fnBody).toContain('nexus-*) continue');
  });

  test('cleanup runs before link when prefix is enabled', () => {
    // In the Claude install section, cleanup should happen before linking
    const claudeInstallSection = setupContent.slice(
      setupContent.indexOf('INSTALL_CLAUDE'),
      setupContent.lastIndexOf('link_claude_skill_dirs')
    );
    expect(claudeInstallSection).toContain('cleanup_old_claude_symlinks');
  });

  // --- Persistent config + interactive prompt tests ---

  test('setup reads skill_prefix from config', () => {
    expect(setupContent).toContain('get skill_prefix');
    expect(setupContent).toContain('NEXUS_CONFIG');
  });

  test('setup supports --prefix flag', () => {
    expect(setupContent).toContain('--prefix)');
    expect(setupContent).toContain('SKILL_PREFIX=1; SKILL_PREFIX_FLAG=1');
  });

  test('--prefix and --no-prefix persist to config', () => {
    expect(setupContent).toContain('set skill_prefix');
  });

  test('setup exposes global CLAUDE.md opt-in config', () => {
    expect(setupContent).toContain('global_claude_declined');
  });

  test('setup cleans stale Claude session transcripts that contain obsolete Nexus prompts', () => {
    expect(setupContent).toContain('nexus-clean-claude-sessions');
    expect(setupContent).toContain('maybe_clean_stale_claude_sessions');
    expect(setupContent).toContain('removed stale Nexus session transcript');
  });

  test('setup offers an execution-mode chooser when CCB is detected for Claude installs', () => {
    expect(setupContent).toContain('maybe_offer_execution_mode_choice');
    expect(setupContent).toContain('ask_available || return 0');
    expect(setupContent).toContain('Continue in the current Claude session (local_provider)');
    expect(setupContent).toContain('Use tmux + CCB for governed multi-model runs (governed_ccb)');
    expect(setupContent).toContain('set execution_mode local_provider');
    expect(setupContent).toContain('set execution_mode governed_ccb');
    expect(setupContent).toContain('Choice [1/2] (required):');
    expect(setupContent).toContain('explicit execution-mode choice required when CCB is detected');
  });

  test('setup offers to install CCB before falling back to local Claude mode', () => {
    expect(setupContent).toContain('maybe_offer_ccb_install_choice');
    expect(setupContent).toContain('CCB was not detected on this machine.');
    expect(setupContent).toContain('Install CCB now (recommended for governed multi-model runs)');
    expect(setupContent).toContain('claude_code_bridge repo and run ./install.sh install');
    expect(setupContent).toContain('Continue without CCB and use local_provider');
    expect(setupContent).toContain('CCB installation failed. Re-run ./setup after fixing the installer output above.');
    expect(setupContent).toContain('CCB install complete');
  });

  test('setup explains that governed_ccb needs mounted CCB providers and gives the standard tmux start path', () => {
    expect(setupContent).toContain('governed ready:');
    expect(setupContent).toContain('mounted providers:');
    expect(setupContent).toContain('missing providers:');
    expect(setupContent).toContain('Standard path: if CCB providers are not already mounted for this repo');
    expect(setupContent).toContain('standard start: tmux && ccb codex gemini claude');
    expect(setupContent).toContain("next: mount the missing providers, usually via tmux + 'ccb codex gemini claude'");
  });

  test('setup warns when local_provider is selected but the provider CLI is unavailable', () => {
    expect(setupContent).toContain('provider CLI available:');
    expect(setupContent).not.toContain('provider CLI missing');
    expect(setupContent).toContain('/handoff will block until');
    expect(setupContent).toContain('execution_mode is switched to governed_ccb');
  });

  test('setup only offers local Claude subagents when the installed CLI supports them', () => {
    expect(setupContent).toContain('supports_local_claude_subagents');
    expect(setupContent).toContain('if ! _claude_help="$(claude --help 2>&1)"; then');
    expect(setupContent).toContain('--agents');
    expect(setupContent).toContain('--agent');
    expect(setupContent).toContain('subagents are unavailable with the installed claude CLI');
    expect(setupContent).toContain('set provider_topology single_agent');
    expect(setupContent).not.toContain('claude --help 2>&1 || true');
  });

  test('setup exposes a Codex local topology path for subagents', () => {
    expect(setupContent).toContain('Local Codex topology');
    expect(setupContent).toContain('Codex role-specific local passes for build, review, and QA.');
    expect(setupContent).toContain('selected local_provider (codex, subagents)');
    expect(setupContent).toContain('selected local_provider (codex, multi_session)');
    expect(setupContent).toContain('use the installed nexus-* skills directly from Codex');
    expect(setupContent).toContain('Codex does not use a Nexus-managed global instruction file equivalent to ~/.claude/CLAUDE.md');
  });

  test('setup offers to update ~/.claude/CLAUDE.md during interactive Claude installs', () => {
    expect(setupContent).toContain('~/.claude/CLAUDE.md');
    expect(setupContent).toContain('nexus-global-claude');
    expect(setupContent).toContain('Add Nexus-first guidance to ~/.claude/CLAUDE.md');
  });

  test('setup cleans legacy GSD Claude hooks during Claude installs', () => {
    expect(setupContent).toContain('nexus-clean-claude-hooks');
    expect(setupContent).toContain('maybe_clean_legacy_claude_hooks');
    expect(setupContent).toContain('removed legacy GSD hook entries from');
  });

  test('interactive prompt shows when no config', () => {
    expect(setupContent).toContain('Short names');
    expect(setupContent).toContain('Namespaced');
    expect(setupContent).toContain('/nexus-qa');
    expect(setupContent).toContain('/nexus-ship');
    expect(setupContent).toContain('Choice [1/2]');
  });

  test('non-TTY defaults to flat names', () => {
    // Should check if stdin is a TTY before prompting
    expect(setupContent).toContain('-t 0');
  });

  test('cleanup_prefixed_claude_symlinks exists and uses readlink', () => {
    expect(setupContent).toContain('cleanup_prefixed_claude_symlinks');
    const fnStart = setupContent.indexOf('cleanup_prefixed_claude_symlinks()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('removed[@]}', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('readlink');
    expect(fnBody).toContain('nexus-$skill_name');
  });

  test('reverse cleanup runs before link when prefix is disabled', () => {
    const claudeInstallSection = setupContent.slice(
      setupContent.indexOf('INSTALL_CLAUDE'),
      setupContent.lastIndexOf('link_claude_skill_dirs')
    );
    expect(claudeInstallSection).toContain('cleanup_prefixed_claude_symlinks');
  });

  test('welcome message references SKILL_PREFIX', () => {
    expect(setupContent).toContain('Nexus ready');
    expect(setupContent).toContain('Run /nexus-upgrade anytime');
  });
});

describe('discover-skills hidden directory filtering', () => {
  test('discoverTemplates skips dot-prefixed directories', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-discover-'));
    try {
      // Create a hidden dir with a template (should be excluded)
      fs.mkdirSync(path.join(tmpDir, '.hidden'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.hidden', 'SKILL.md.tmpl'), '---\nname: evil\n---\ntest');
      // Create a visible dir with a template (should be included)
      fs.mkdirSync(path.join(tmpDir, 'visible'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'visible', 'SKILL.md.tmpl'), '---\nname: good\n---\ntest');

      const { discoverTemplates } = require('../scripts/discover-skills');
      const results = discoverTemplates(tmpDir);
      const dirs = results.map((r: { tmpl: string }) => r.tmpl);

      expect(dirs).toContain('visible/SKILL.md.tmpl');
      expect(dirs).not.toContain('.hidden/SKILL.md.tmpl');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('preamble privacy surface', () => {
  test('generated SKILL.md no longer contains telemetry start block', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).not.toContain('_TEL_START');
    expect(content).not.toContain('_SESSION_ID');
    expect(content).not.toContain('TELEMETRY:');
    expect(content).not.toContain('TEL_PROMPTED:');
    expect(content).not.toContain('nexus-config get telemetry');
  });

  test('generated SKILL.md no longer contains telemetry opt-in prompt', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).not.toContain('.telemetry-prompted');
    expect(content).not.toContain('Help Nexus get better');
    expect(content).not.toContain('community telemetry backend');
    expect(content).not.toContain('Supabase project while Nexus completes telemetry cutover');
    expect(content).not.toContain('nexus-config set telemetry community');
    expect(content).not.toContain('nexus-config set telemetry anonymous');
    expect(content).not.toContain('nexus-config set telemetry off');
  });

  test('generated SKILL.md no longer contains telemetry epilogue', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).not.toContain('Telemetry (run last)');
    expect(content).not.toContain('nexus-telemetry-log');
    expect(content).not.toContain('_TEL_END');
    expect(content).not.toContain('_TEL_DUR');
  });

  test('generated SKILL.md no longer contains telemetry pending markers', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).not.toContain('.pending');
    expect(content).not.toContain('_pending_finalize');
  });

  test('generated SKILL.md uses Nexus-primary preamble prose', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).toContain('Nexus follows the **Completeness Principle**');
    expect(content).toContain('Nexus can proactively figure out when you might need a skill while you work');
    expect(content).toContain('Running Nexus v{to} (just updated!)');
    expect(content).not.toContain('Running gstack v{to} (just updated!)');
    expect(content).not.toContain('garryslist.org');
  });

  test('telemetry blocks do not appear in skill files that use PREAMBLE', () => {
    const skills = ['qa', 'ship', 'review', 'plan-ceo-review', 'plan-eng-review', 'retro'];
    for (const skill of skills) {
      const skillPath = path.join(ROOT, skill, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, 'utf-8');
        expect(content).not.toContain('_TEL_START');
        expect(content).not.toContain('Telemetry (run last)');
      }
    }
  });
});

describe('community fixes wave', () => {
  // Helper to get all generated SKILL.md files
  function getAllSkillMds(): Array<{ name: string; content: string }> {
    const results: Array<{ name: string; content: string }> = [];
    const rootPath = path.join(ROOT, 'SKILL.md');
    if (fs.existsSync(rootPath)) {
      results.push({ name: 'root', content: fs.readFileSync(rootPath, 'utf-8') });
    }
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const skillPath = path.join(ROOT, entry.name, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        results.push({ name: entry.name, content: fs.readFileSync(skillPath, 'utf-8') });
      }
    }
    return results;
  }

  // #594 — Discoverability: every SKILL.md.tmpl description contains "Nexus"
  test('every SKILL.md.tmpl description contains "Nexus"', () => {
    for (const skill of ALL_SKILLS) {
      const tmplPath = skill.dir === '.' ? path.join(ROOT, 'SKILL.md.tmpl') : path.join(ROOT, skill.dir, 'SKILL.md.tmpl');
      const content = fs.readFileSync(tmplPath, 'utf-8');
      const desc = extractDescription(content);
      const normalized = desc.toLowerCase();
      expect(normalized.includes('nexus')).toBe(true);
    }
  });

  // #594 — Discoverability: first line of each description is under 120 chars
  test('every SKILL.md.tmpl description first line is under 120 chars', () => {
    for (const skill of ALL_SKILLS) {
      const tmplPath = skill.dir === '.' ? path.join(ROOT, 'SKILL.md.tmpl') : path.join(ROOT, skill.dir, 'SKILL.md.tmpl');
      const content = fs.readFileSync(tmplPath, 'utf-8');
      const desc = extractDescription(content);
      const firstLine = desc.split('\n')[0];
      expect(firstLine.length).toBeLessThanOrEqual(120);
    }
  });

  // #573 — Feature signals: ship/SKILL.md contains feature signal detection
  test('ship/SKILL.md contains feature signal detection in Step 4', () => {
    const content = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');
    if (isNexusWrapperSkill('ship')) {
      expect(content).toContain('Nexus Governed Ship');
      expect(content).toContain('.planning/current/ship/status.json');
      expect(content).toContain('Nexus-owned ship guidance for governed release gating and explicit merge readiness.');
    } else {
      expect(content.toLowerCase()).toContain('feature signal');
    }
  });

  // #510 — Context warnings: no SKILL.md contains "running low on context"
  test('no generated SKILL.md contains "running low on context"', () => {
    const skills = getAllSkillMds();
    for (const { name, content } of skills) {
      expect(content).not.toContain('running low on context');
    }
  });

  // #510 — Context warnings: plan-eng-review has explicit anti-warning
  test('plan-eng-review/SKILL.md contains "Do not preemptively warn"', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-eng-review', 'SKILL.md'), 'utf-8');
    if (isNexusWrapperSkill('plan-eng-review')) {
      expect(content).toContain('NEXUS_PROJECT_CWD="$_REPO_CWD" bun run bin/nexus.ts plan-eng-review');
      expect(content).toContain('This alias routes to `/frame`.');
    } else {
      expect(content).toContain('Do not preemptively warn');
    }
  });

  // #474 — Safety Net: no SKILL.md uses find with -delete
  test('no generated SKILL.md contains find with -delete flag', () => {
    const skills = getAllSkillMds();
    for (const { name, content } of skills) {
      // Match find commands that use -delete (but not prose mentioning the word "delete")
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes('find ') && line.includes('-delete')) {
          throw new Error(`${name}/SKILL.md contains find with -delete: ${line.trim()}`);
        }
      }
    }
  });

  // #467 — Privacy: preamble no longer writes telemetry JSONL files
  test('preamble contains no telemetry JSONL writes', () => {
    const preamble = fs.readFileSync(path.join(ROOT, 'scripts/resolvers/preamble.ts'), 'utf-8');
    expect(preamble).not.toContain('skill-usage.jsonl');
    expect(preamble).not.toContain('telemetry');
    expect(preamble).not.toContain('nexus-telemetry-log');
  });
});

describe('codex commands must not use inline $(git rev-parse --show-toplevel) for cwd', () => {
  // Regression test: inline $(git rev-parse --show-toplevel) in codex exec -C
  // or codex review without cd evaluates in whatever cwd the background shell
  // inherits, which may be a different project in Conductor workspaces.
  // The fix is to resolve _REPO_ROOT eagerly at the top of each bash block.

  // Scan all source files that could contain codex commands
  // Use Bun.Glob to avoid ELOOP from .claude/skills/nexus symlink back to ROOT
  const tmplGlob = new Bun.Glob('**/*.tmpl');
  const sourceFiles = [
    ...Array.from(tmplGlob.scanSync({ cwd: ROOT, followSymlinks: false })),
    ...fs.readdirSync(path.join(ROOT, 'scripts/resolvers'))
      .filter(f => f.endsWith('.ts'))
      .map(f => `scripts/resolvers/${f}`),
    'scripts/gen-skill-docs.ts',
  ];

  test('no codex exec command uses inline $(git rev-parse --show-toplevel) in -C flag', () => {
    const violations: string[] = [];
    for (const rel of sourceFiles) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('codex exec') && line.includes('-C') && line.includes('$(git rev-parse --show-toplevel)')) {
          violations.push(`${rel}:${i + 1}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('no generated SKILL.md has codex exec with inline $(git rev-parse --show-toplevel) in -C flag', () => {
    const violations: string[] = [];
    const skillMdGlob = new Bun.Glob('**/SKILL.md');
    const skillMdFiles = Array.from(skillMdGlob.scanSync({ cwd: ROOT, followSymlinks: false }));
    for (const rel of skillMdFiles) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('codex exec') && line.includes('-C') && line.includes('$(git rev-parse --show-toplevel)')) {
          violations.push(`${rel}:${i + 1}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('codex review commands must be preceded by cd "$_REPO_ROOT" (no -C support)', () => {
    // codex review does not support -C, so the pattern must be:
    //   _REPO_ROOT=$(git rev-parse --show-toplevel) || { ... }
    //   cd "$_REPO_ROOT"
    //   codex review ...
    // NOT: codex review ... with inline $(git rev-parse --show-toplevel)
    const allFiles = [
      ...Array.from(tmplGlob.scanSync({ cwd: ROOT, followSymlinks: false })),
      ...Array.from(new Bun.Glob('**/SKILL.md').scanSync({ cwd: ROOT, followSymlinks: false })),
      ...fs.readdirSync(path.join(ROOT, 'scripts/resolvers'))
        .filter(f => f.endsWith('.ts'))
        .map(f => `scripts/resolvers/${f}`),
      'scripts/gen-skill-docs.ts',
    ];
    const violations: string[] = [];
    for (const rel of allFiles) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip non-executable lines (markdown table cells, prose references)
        if (line.includes('|') && line.includes('`/codex review`')) continue;
        if (line.includes('`codex review`')) continue;
        // Check for codex review with inline $(git rev-parse)
        if (line.includes('codex review') && line.includes('$(git rev-parse --show-toplevel)')) {
          violations.push(`${rel}:${i + 1} — inline git rev-parse in codex review`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─── Learnings + Confidence Resolver Tests ─────────────────────

describeLegacyPlanAliases('LEARNINGS_SEARCH resolver', () => {
  const SEARCH_SKILLS = ['review', 'ship', 'plan-eng-review', 'investigate', 'office-hours', 'plan-ceo-review'];

  for (const skill of SEARCH_SKILLS) {
    test(`${skill} generated SKILL.md contains learnings search`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).toContain('Prior Learnings');
      expect(content).toContain('nexus-learnings-search');
    });
  }

  test('learnings search includes cross-project config check', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('cross_project_learnings');
    expect(content).toContain('--cross-project');
  });

  test('learnings search includes AskUserQuestion for first-time cross-project opt-in', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Enable cross-project learnings');
    expect(content).toContain('project-scoped only');
  });

  test('learnings search mentions prior learning applied display format', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Prior learning applied');
  });
});

describeLegacyReview('LEARNINGS_LOG resolver', () => {
  const LOG_SKILLS = ['review', 'retro', 'investigate'];

  for (const skill of LOG_SKILLS) {
    test(`${skill} generated SKILL.md contains learnings log`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).toContain('Capture Learnings');
      expect(content).toContain('nexus-learnings-log');
    });
  }

  test('learnings log documents all type values', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    for (const type of ['pattern', 'pitfall', 'preference', 'architecture', 'tool']) {
      expect(content).toContain(type);
    }
  });

  test('learnings log documents all source values', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    for (const source of ['observed', 'user-stated', 'inferred', 'cross-model']) {
      expect(content).toContain(source);
    }
  });

  test('learnings log includes files field for staleness detection', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('"files"');
    expect(content).toContain('staleness detection');
  });
});

describeLegacyReview('CONFIDENCE_CALIBRATION resolver', () => {
  const CONFIDENCE_SKILLS = ['review', 'ship', 'plan-eng-review', 'cso'];

  for (const skill of CONFIDENCE_SKILLS) {
    test(`${skill} generated SKILL.md contains confidence calibration`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).toContain('Confidence Calibration');
      expect(content).toContain('confidence score');
    });
  }

  test('confidence calibration includes scoring rubric with all tiers', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('9-10');
    expect(content).toContain('7-8');
    expect(content).toContain('5-6');
    expect(content).toContain('3-4');
    expect(content).toContain('1-2');
  });

  test('confidence calibration includes display rules', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Show normally');
    expect(content).toContain('Suppress from main report');
  });

  test('confidence calibration includes finding format example', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('[P1] (confidence:');
    expect(content).toContain('SQL injection');
  });

  test('confidence calibration includes calibration learning feedback loop', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('calibration event');
    expect(content).toContain('Log the corrected pattern');
  });

  test('skills without confidence calibration do NOT contain it', () => {
    // office-hours and retro do NOT use confidence calibration
    for (const skill of ['office-hours', 'retro']) {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).not.toContain('## Confidence Calibration');
    }
  });
});

describe('gen-skill-docs prefix warning (#620/#578)', () => {
  const { execSync } = require('child_process');

  test('warns about skill_prefix when config has prefix=true', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-prefix-warn-'));
    try {
      // Create a fake ~/.nexus/config.yaml with skill_prefix: true
      const fakeHome = tmpDir;
      const fakeNexus = path.join(fakeHome, '.nexus');
      fs.mkdirSync(fakeNexus, { recursive: true });
      fs.writeFileSync(path.join(fakeNexus, 'config.yaml'), 'skill_prefix: true\n');

      const output = execSync('bun run scripts/gen-skill-docs.ts', {
        cwd: ROOT,
        env: { ...process.env, HOME: fakeHome },
        encoding: 'utf-8',
        timeout: 30000,
      });
      expect(output).toContain('skill_prefix is true');
      expect(output).toContain('nexus-relink');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('no warning when skill_prefix is false or absent', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-prefix-warn-'));
    try {
      const fakeHome = tmpDir;
      const fakeNexus = path.join(fakeHome, '.nexus');
      fs.mkdirSync(fakeNexus, { recursive: true });
      fs.writeFileSync(path.join(fakeNexus, 'config.yaml'), 'skill_prefix: false\n');

      const output = execSync('bun run scripts/gen-skill-docs.ts', {
        cwd: ROOT,
        env: { ...process.env, HOME: fakeHome },
        encoding: 'utf-8',
        timeout: 30000,
      });
      expect(output).not.toContain('skill_prefix is true');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
