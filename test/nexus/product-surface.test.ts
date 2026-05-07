import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { readSkill } from '../helpers/skill-paths';
import {
  PRIMARY_DEV_ROOT,
  PRIMARY_NAMESPACE,
  PRIMARY_PACKAGE_NAME,
  PRIMARY_PRODUCT_NAME,
  PRIMARY_SUPPORT_NAMESPACE,
  PRIMARY_WORKTREE_ROOT,
  PRODUCT_SURFACE_RULES,
} from '../../lib/nexus/product-surface';
import {
  HISTORICAL_LEGACY_REFERENCES,
  REMOVED_COMPATIBILITY_BOUNDARY_SHIMS,
  REMOVED_LEGACY_RUNTIME_IDENTITIES,
} from '../../lib/nexus/compatibility-surface';

const ROOT = join(import.meta.dir, '..', '..');

describe('nexus product surface contract', () => {
  test('freezes Nexus as the only active product identity', () => {
    expect(PRIMARY_PRODUCT_NAME).toBe('Nexus');
    expect(PRIMARY_PACKAGE_NAME).toBe('nexus');
    expect(PRIMARY_NAMESPACE).toBe('nexus');
    expect(PRIMARY_SUPPORT_NAMESPACE).toBe('nexus');
    expect(PRIMARY_WORKTREE_ROOT).toBe('.nexus-worktrees');
    expect(PRIMARY_DEV_ROOT).toBe('.nexus-dev');

    expect(PRODUCT_SURFACE_RULES.primary_state_root).toBe('.nexus');
    expect(PRODUCT_SURFACE_RULES.nexus_state_env_var).toBe('NEXUS_STATE_DIR');
    expect('legacy_compat_namespace' in PRODUCT_SURFACE_RULES).toBe(false);
    expect('legacy_state_root' in PRODUCT_SURFACE_RULES).toBe(false);
    expect('legacy_worktree_root' in PRODUCT_SURFACE_RULES).toBe(false);
    expect('legacy_dev_root' in PRODUCT_SURFACE_RULES).toBe(false);
  });

  test('readme and skills docs describe a Nexus-only active surface', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    const skills = readFileSync(join(ROOT, 'docs', 'skills.md'), 'utf8');
    const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
    const installSection = readme.split('### Step 1: Install Nexus on your machine')[1]?.split('### Step 2: Add Nexus to your repo so teammates get it')[0] ?? '';

    expect(readme).toContain('# Nexus');
    expect(readme).toContain('Nexus is the only command surface.');
    // Track D-D2 Phase 2.4 (PR #126) retired the "Upstream maintenance is
    // handled by Nexus maintainers." sentence as part of removing absorbed-
    // upstream framing. The remaining lines below still pin the load-bearing
    // contract that Nexus is the upgrade path, not upstream repos.
    expect(readme).toContain('Users upgrade Nexus versions, not upstream repos.');
    expect(readme).toContain('`/nexus-upgrade` and automatic upgrade are the only user-facing update paths.');
    expect(readme).toContain('~/.claude/skills/nexus');
    expect(readme).toContain('~/.nexus/config.yaml');
    expect(readme).toContain('whether you want to install CCB now');
    expect(readme).toContain('continue without CCB and use `local_provider`');
    expect(readme).toContain('does not silently time out into');
    expect(readme).toContain('the first post-upgrade');
    expect(readme).toContain('repo mode and execution mode separately');
    expect(readme).toContain('execution path');
    expect(readme).toContain('current session ready');
    expect(readme).toContain('mounted providers');
    expect(readme).toContain('missing providers');
    expect(readme).toContain('CCB installed');
    expect(readme).toContain('providers mounted for this repo right now');
    expect(readme).toContain('asks whether to persist');
    expect(readme).toContain('the current Claude session with `local_provider`');
    expect(readme).toContain('make sure CCB providers are mounted');
    expect(readme).toContain('typically via `tmux` + `ccb codex gemini claude`');
    expect(readme).toContain('nexus-config effective-execution');
    expect(readme).toContain('`governed_ccb`: normally only persist `execution_mode`');
    expect(readme).toContain('`primary_provider` and `provider_topology` are local-provider-only host preferences');
    expect(readme).toContain('governed requested/actual route truth lives in canonical `.planning/` artifacts');
    expect(readme).toContain('nexus-config set provider_topology subagents');
    expect(readme).toContain('`codex + subagents` is an active local topology');
    expect(readme).toContain('`codex + multi_session` is an active local topology');
    expect(readme).toContain('`gemini + subagents` is an active local topology');
    expect(readme).toContain('If you want Codex to do the install for you, open Codex and paste this:');
    expect(readme).toContain('Codex does not use a Nexus-managed global instruction file equivalent to **`~/.claude/CLAUDE.md`**.');
    expect(readme).toContain('Nexus does not ship usage telemetry.');
    expect(readme).toContain('no remote analytics backend');
    expect(readme).toContain('file an issue or PR on GitHub instead');
    expect(readme).toContain('Governed runs may publish canonical learnings at `/closeout`.');
    expect(readme).toContain('git clone --single-branch --depth 1 https://github.com/LaPaGaYo/nexus.git ~/.claude/skills/nexus');
    expect(readme).toContain('Never use **`mcp__claude-in-chrome__*`** tools unless the user explicitly asks for them.');
    expect(readme).toContain('Lifecycle continuation does not require a fresh session.');
    expect(readme).toContain('Nexus can continue in');
    expect(readme).toContain('the current session. That is a lifecycle rule, not a session-quality');
    expect(readme).toContain('When setup or a fresh-run discover boundary emits session continuation advice,');
    expect(readme).toContain('continue here (`continue_here`)');
    expect(readme).toContain('compact this session and continue (`compact_then_continue`)');
    expect(readme).toContain('start a fresh session and run `/continue` (`fresh_session_continue`)');
    expect(readme).toContain('`continue_here`');
    expect(readme).toContain('`compact_then_continue`');
    expect(readme).toContain('`fresh_session_continue`');
    expect(readme).toContain('Use `/continue` when you want to resume from a fresh session');
    expect(readme).toContain('recommended_external_skills');
    expect(readme).toContain('Nexus canonical commands always win name conflicts');
    expect(installSection).toContain('/nexus-upgrade');
    expect(readme).not.toContain('git pull');
    expect(installSection).not.toContain('git pull --ff-only');
    expect(readme).not.toContain('published Nexus releases');
    expect(readme).not.toContain('compatibility shims');

    expect(skills).toContain('Nexus is the only command surface.');
    expect(skills).toContain('Nexus-owned stage packs');
    // Per Track D-D2 Phase 2.4 (PR #126): "Upstream maintenance is handled
    // by Nexus maintainers." sentence retired with the absorbed-framing
    // language. Nexus-as-upgrade-path is still pinned via the next lines.
    expect(skills).toContain('Users upgrade Nexus versions, not upstream repos.');
    expect(skills).toContain('`/nexus-upgrade` and automatic upgrade are the only user-facing update paths.');
    expect(skills).toContain('/nexus-upgrade');
    expect(skills).toContain('Upgrade Nexus itself through the supported release-based update flow.');
    expect(skills).toContain('Fresh-run discover may emit session continuation advice at phase boundaries.');
    expect(skills).toContain('Nexus can continue here even when compaction or a fresh session is');
    expect(skills).toContain('`continue_here`');
    expect(skills).toContain('`compact_then_continue`');
    expect(skills).toContain('`fresh_session_continue`');
    expect(skills).toContain('`/continue` remains the');
    expect(skills).toContain('canonical fresh-session resume path.');
    expect(skills).toContain('`/learn` surfaces both operational JSONL learnings and canonical run learnings when available.');
    expect(skills).toContain('recommended_external_skills');
    expect(skills).toContain('they never override Nexus canonical commands');
    expect(skills).not.toContain('Manage what gstack learned');
    expect(skills).not.toContain('controlled by gstack');

    expect(changelog).toContain('## Nexus Patch Release Index');
    expect(changelog).toContain('docs/releases/2026-04-10-nexus-v1.0.1.md');
    expect(changelog).toContain('docs/releases/2026-04-12-nexus-v1.0.9.md');
  });

  test('agent-facing docs keep canonical Nexus lifecycle commands primary', () => {
    const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8');
    const claude = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    const skills = readFileSync(join(ROOT, 'docs', 'skills.md'), 'utf8');

    expect(claude).toContain('Claude-facing project instructions');
    expect(claude).toContain('## Nexus Skill Routing');
    expect(claude).toContain('invoke investigate');
    expect(claude).toContain('invoke browse');
    expect(claude).not.toContain('.agents/skills/');

    expect(agents).toContain('## Canonical Nexus lifecycle');
    expect(agents).toContain('| `/discover` |');
    expect(agents).toContain('| `/frame` |');
    expect(agents).toContain('| `/plan` |');
    expect(agents).toContain('| `/handoff` |');
    expect(agents).toContain('| `/build` |');
    expect(agents).toContain('| `/review` |');
    expect(agents).toContain('| `/qa` |');
    expect(agents).toContain('| `/ship` |');
    expect(agents).toContain('| `/closeout` |');
    expect(agents).toContain('| `/investigate` |');
    expect(agents).toContain('## Legacy compatibility aliases');
    expect(agents).not.toContain('Invoke them by name (e.g., `/office-hours`)');

    expect(readme).toContain('You:    /discover');
    expect(readme).toContain('You:    /frame');
    expect(readme).toContain('You:    /plan');
    expect(readme).toContain('You:    /handoff');
    expect(readme).toContain('You:    /build');
    expect(readme).toContain('`/frame` classifies design impact');
    expect(readme).toContain('`/plan` writes the canonical verification matrix');
    expect(readme).toContain('`/plan` writes the canonical verification matrix and requires a design contract for material UI work');
    expect(readme).toContain('`/qa` records visual verification before `/ship` for design-bearing runs');
    expect(readme).toContain('.planning/current/<stage>/completion-advisor.json');
    expect(readme).toContain('.planning/current/review/attempts/<review_attempt_id>/');
    expect(readme).toContain('providers author attempt-scoped receipts');
    expect(readme).toContain('late stale replies stay in attempt receipts');
    expect(readme).toContain('runtime-owned next-step contract');
    expect(readme).toContain('/plan-design-review');
    expect(readme).toContain('/design-review');
    expect(readme).toContain('/browse');
    expect(readme).toContain('| `/discover` |');
    expect(readme).toContain('| `/frame` |');
    expect(readme).toContain('| `/plan` |');
    expect(readme).toContain('| `/handoff` |');
    expect(readme).toContain('| `/build` |');
    expect(readme).toContain('## Nexus support surface');
    expect(readme).toContain('| `/design-consultation` | Create integrated design context and deliverable direction for UI, prototypes, decks, motion, and infographics. |');
    expect(readme).toContain('| `/design-shotgun` | Generate and compare multiple design directions for UI screens, prototypes, decks, motion boards, and infographics. |');
    expect(readme).toContain('| `/design-html` | Turn approved mockups into production HTML while honoring frozen design and brand context. |');
    expect(readme).toContain('The Nexus design runtime under `runtimes/design/` supports five deliverable');
    expect(readme).toContain('editable PPTX, MP4, GIF, and Playwright-based HTML verification');
    expect(readme).toContain('Enter `/nexus` once at session start');
    expect(readme).toContain('Bare `/nexus` is the workflow-harness entrypoint, not the browser tool.');
    expect(readme).toContain('`governed_ccb` when required CCB providers are actually mounted for this repo');
    expect(readme).toContain('`local_provider` when CCB is missing or not session-ready yet');
    expect(readme).not.toContain('You:    /office-hours');
    expect(readme).not.toContain('You:    /plan-ceo-review');
    expect(readme).not.toContain('You:    /plan-eng-review');

    expect(skills).toContain('## Canonical lifecycle commands');
    expect(skills).toContain('| [`/discover`](#discover) |');
    expect(skills).toContain('| [`/frame`](#frame) |');
    expect(skills).toContain('| [`/plan`](#plan) |');
    expect(skills).toContain('| [`/handoff`](#handoff) |');
    expect(skills).toContain('| [`/build`](#build) |');
    expect(skills).toContain('| [`/review`](#review) |');
    expect(skills).toContain('| [`/qa`](#qa) |');
    expect(skills).toContain('| [`/ship`](#ship) |');
    expect(skills).toContain('| [`/closeout`](#closeout) |');
    expect(skills).toContain('providers now author attempt-scoped receipts first');
    expect(skills).toContain('.planning/current/review/attempts/<review_attempt_id>/codex.md');
    expect(skills).toContain('providers own review receipt content; Nexus promotes and owns canonical current audit truth');
    expect(skills).toContain('.planning/current/plan/verification-matrix.json');
    expect(skills).toContain('.planning/current/<stage>/completion-advisor.json');
    expect(skills).toContain('runtime-owned next-step contract');
    expect(skills).toContain('/browse');
    expect(skills).toContain('| `/design-consultation` | Design-system discovery plus integrated deliverable direction for UI, prototype, slide, motion, and infographic work. |');
    expect(skills).toContain('| `/design-shotgun` | Design exploration and option generation across UI screens, prototypes, decks, motion boards, and infographics. |');
    expect(skills).toContain('| `/design-html` | Design-to-implementation handoff support that consumes frozen design and brand context for UI-bearing runs. |');
    expect(skills).toContain('| `/design-review` | Live-site visual audit and polish using an integrated five-lens design critique for UI-bearing runs. |');
    expect(skills).toContain('| `/plan-design-review` | Design-specific plan review support that feeds canonical lifecycle artifacts for UI-bearing runs. |');
    expect(skills).toContain('The Nexus design runtime under `runtimes/design/` supports five deliverable');
    expect(skills).toContain('editable PPTX, MP4, GIF, and Playwright-based HTML verification');
    expect(skills).toContain('## `/nexus` entrypoint');
    expect(skills).toContain('Bare `/nexus` should send the user toward `/discover`, not `/browse`.');
    expect(skills).toContain('## Legacy compatibility deep dives');
    expect(skills).not.toContain('## `/office-hours`');
    expect(skills).not.toContain('## `/plan-ceo-review`');
    expect(skills).not.toContain('## `/plan-eng-review`');
    expect(skills).not.toContain('This is where every project should start.');
    expect(skills).not.toContain('Brian Chesky mode');
  });

  test('land-and-deploy consumes ship PR handoff rather than assuming closeout-owned PR creation', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    const skills = readFileSync(join(ROOT, 'docs', 'skills.md'), 'utf8');
    const land = readSkill(ROOT, 'land');
    const deploy = readSkill(ROOT, 'deploy');
    const landAndDeploy = readSkill(ROOT, 'land-and-deploy');
    const setupDeploy = readSkill(ROOT, 'setup-deploy');
    const shipSkill = readSkill(ROOT, 'ship');

    expect(landAndDeploy).toContain('/ship` records merge readiness');
    expect(landAndDeploy).not.toContain('/ship` creates the PR');
    expect(landAndDeploy).toContain('.planning/deploy/deploy-contract.json');
    expect(landAndDeploy).not.toContain('CLAUDE.md and skips detection entirely');
    expect(landAndDeploy).toContain('primary deploy surface');
    expect(landAndDeploy).toContain('secondary deploy surface');
    expect(setupDeploy).toContain('.planning/deploy/deploy-contract.json');
    expect(setupDeploy).toContain('.planning/deploy/DEPLOY-CONTRACT.md');
    expect(setupDeploy).toContain('secondary_surfaces');
    expect(setupDeploy).toContain('primary deploy surface');
    expect(setupDeploy).not.toContain('CLAUDE.md is the source of truth');
    expect(landAndDeploy).toContain('.planning/current/ship/deploy-readiness.json');
    expect(landAndDeploy).toContain('.planning/current/ship/pull-request.json');
    expect(landAndDeploy).toContain('.planning/current/ship/canary-status.json');
    expect(landAndDeploy).toContain('.planning/current/ship/deploy-result.json');
    expect(land).toContain('Never deploy from `/land`');
    expect(land).toContain('.planning/current/ship/deploy-result.json');
    expect(deploy).toContain('Never merge from `/deploy`; use `/land`.');
    expect(deploy).toContain('.planning/deploy/deploy-contract.json');
    expect(shipSkill).toContain('.planning/current/ship/pull-request.json');
    expect(shipSkill).toContain('.planning/current/ship/deploy-readiness.json');
    expect(shipSkill).toContain('.planning/current/ship/deploy-result.json');
    expect(readme).toContain('`/document-release` | Sync docs after shipping and attach `.planning/current/closeout/documentation-sync.md`.');
    expect(readme).toContain('`/benchmark` | Performance baselining and regression checks attached to QA follow-on evidence via `.planning/current/qa/perf-verification.md`.');
    expect(readme).toContain('`/canary` | Post-deploy health monitoring attached to ship follow-on evidence via `.planning/current/ship/canary-status.json`.');
    expect(readme).toContain('`/land` | Merge a PR from the `/ship` handoff without assuming deployment');
    expect(readme).toContain('`/deploy` | Deploy and verify an already-landed change when the project has a production deploy surface.');
    expect(readme).toContain('`/land-and-deploy` | Compatibility shortcut that lands a PR and optionally continues into deploy verification.');
    expect(readme).toContain('asks whether this PR is');
    expect(readme).toContain('merge only, no deploy needed');
    expect(readme).toContain('`/qa-only` | Run QA in report-only mode as attached evidence without changing canonical lifecycle state.');
    expect(readme).toContain('landing evidence tells you');
    expect(readme).toContain('`rerun_land`, `rerun_ship`, or a');
    expect(readme).toContain('Early or unstable projects');
    expect(readme).toContain('deployment readiness is part of the');
    expect(skills).toContain('`/land` | Post-ship PR landing workflow that consumes ship handoff evidence');
    expect(skills).toContain('`/deploy` | Post-land deployment workflow that verifies a configured production surface');
    expect(skills).toContain('`/land-and-deploy` | Compatibility shortcut that consumes ship handoff evidence');
    expect(skills).toContain('`/benchmark` | Performance regression checks that attach `.planning/current/qa/perf-verification.md` as follow-on QA evidence.');
    expect(skills).toContain('`/canary` | Post-deploy monitoring that attaches `.planning/current/ship/canary-status.json` as follow-on ship evidence.');
    expect(skills).toContain('`/document-release` | Release-note and documentation sync that attaches `.planning/current/closeout/documentation-sync.md` as follow-on closeout evidence.');
    expect(landAndDeploy).toContain('head_sha');
    expect(landAndDeploy).toContain('ship_handoff_current');
    expect(landAndDeploy).toContain('Landing Mode Choice');
    expect(landAndDeploy).toContain('Merge only, no deploy needed');
    expect(landAndDeploy).toContain('deploy_status": "skipped"');
    expect(landAndDeploy).toContain('rerun_build_review_qa_ship');
    expect(landAndDeploy).toContain('rerun_ship');
  });

  test('active generated skills do not retain legacy GStack or Garry branding', () => {
    const setupDeploy = readSkill(ROOT, 'setup-deploy');
    const landAndDeploy = readSkill(ROOT, 'land-and-deploy');
    const codexSkill = readSkill(ROOT, 'codex');

    for (const content of [setupDeploy, landAndDeploy, codexSkill]) {
      expect(content).toContain('You are Nexus');
      expect(content).not.toContain('You are GStack');
      expect(content).not.toContain("Garry Tan's product");
      expect(content).not.toContain('Garry respects and wants to fund');
      expect(content).not.toContain('consider applying to YC');
    }
  });

  test('package metadata and setup are Nexus-primary', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const setup = readFileSync(join(ROOT, 'setup'), 'utf8');

    expect(pkg.name).toBe('nexus');
    expect(pkg.description).toContain('Nexus');
    expect(pkg.description).not.toContain('gstack');

    expect(setup).toContain('nexus setup');
    expect(setup).toContain('~/.claude/skills/nexus');
    expect(setup).toContain('selected local_provider (claude, subagents)');
    expect(setup).toContain('selected local_provider (codex, subagents)');
    expect(setup).toContain('selected local_provider (codex, multi_session)');
    expect(setup).toContain('maybe_offer_ccb_install_choice');
    expect(setup).toContain('Install CCB now (recommended for governed multi-model runs)');
    expect(setup).toContain('CCB installation failed. Re-run ./setup after fixing the installer output above.');
    expect(setup).toContain('Choice [1/2] (required):');
    expect(setup).toContain('explicit execution-mode choice required when CCB is detected');
    expect(setup).toContain('provider_topology subagents');
    expect(setup).toContain('removed legacy GSD hook entries from');
    expect(setup).toContain('removed stale Nexus session transcript');
    expect(setup).toContain('execution path:');
    expect(setup).toContain('current session ready:');
    expect(setup).toContain('governed ready:');
    expect(setup).toContain('mounted providers:');
    expect(setup).toContain('missing providers:');
    expect(setup).not.toContain('.claude/skills/gstack');
    expect(setup).not.toContain('.gstack-worktrees');
  });

  test('only nexus helper entrypoints exist in the active bin surface', () => {
    for (const helper of ['nexus-clean-claude-hooks', 'nexus-clean-claude-sessions', 'nexus-config', 'nexus-relink', 'nexus-uninstall', 'nexus-update-check']) {
      expect(existsSync(join(ROOT, 'bin', helper))).toBe(true);
    }

    for (const helper of REMOVED_COMPATIBILITY_BOUNDARY_SHIMS) {
      expect(existsSync(join(ROOT, helper))).toBe(false);
    }
  });

  test('active nexus helper entrypoints are executable', () => {
    for (const helper of ['nexus-clean-claude-hooks', 'nexus-clean-claude-sessions', 'nexus-config', 'nexus-release-publish', 'nexus-relink', 'nexus-uninstall', 'nexus-update-check']) {
      const mode = statSync(join(ROOT, 'bin', helper)).mode;

      if (process.platform === 'win32') {
        expect(mode).toBeGreaterThan(0);
      } else {
        expect(mode & 0o111).not.toBe(0);
      }
    }
  });

  test('active helper implementations are Nexus-only', () => {
    const nexusConfig = readFileSync(join(ROOT, 'bin', 'nexus-config'), 'utf8');
    const nexusRelink = readFileSync(join(ROOT, 'bin', 'nexus-relink'), 'utf8');
    const nexusUninstall = readFileSync(join(ROOT, 'bin', 'nexus-uninstall'), 'utf8');
    const nexusUpdateCheck = readFileSync(join(ROOT, 'bin', 'nexus-update-check'), 'utf8');

    expect(nexusConfig).not.toContain('GSTACK_STATE_DIR');
    expect(nexusConfig).not.toContain('GSTACK_SETUP_RUNNING');

    expect(nexusRelink).toContain('NEXUS_INSTALL_DIR');
    expect(nexusRelink).toContain('bin/nexus-patch-names');
    expect(nexusRelink).not.toContain('GSTACK_INSTALL_DIR');
    expect(nexusRelink).not.toContain('GSTACK_SKILLS_DIR');

    expect(nexusUninstall).not.toContain('~/.claude/skills/gstack');
    expect(nexusUninstall).not.toContain('$_GIT_ROOT/.gstack');

    expect(nexusUpdateCheck).toContain('NEXUS_RELEASE_REPO');
    expect(nexusUpdateCheck).toContain('NEXUS_RELEASE_DISCOVERY_URL');
    expect(nexusUpdateCheck).toContain('NEXUS_RELEASE_MANIFEST_URL');
    expect(nexusUpdateCheck).not.toContain('GSTACK_REMOTE_URL');
    expect(nexusUpdateCheck).not.toContain('GSTACK_STATE_DIR');
  });

  test('live command runtime does not retain the Milestone 1 placeholder dispatcher path', () => {
    const commandIndex = readFileSync(join(ROOT, 'lib', 'nexus', 'commands', 'index.ts'), 'utf8');

    expect(commandIndex).not.toContain('runPlaceholder');
    expect(commandIndex).not.toContain('not implemented in Nexus v0.1');
    expect(commandIndex).not.toContain('PLACEHOLDER_OUTCOME');
  });

  test('legacy runtime identity is constrained to removed or historical references only', () => {
    expect(REMOVED_LEGACY_RUNTIME_IDENTITIES).toContain('~/.gstack');
    expect(REMOVED_LEGACY_RUNTIME_IDENTITIES).toContain('.gstack-worktrees');
    expect(HISTORICAL_LEGACY_REFERENCES).toEqual(['archived docs and closeouts']);
  });

  test('retired upstream workflow is no longer an active automation surface', () => {
    const workflowNames = readdirSync(join(ROOT, '.github', 'workflows'));
    const retiredWorkflow = ['maintainer', 'loop.yml'].join('-');

    expect(workflowNames).not.toContain(retiredWorkflow);
  });

  test('active CI eval infrastructure uses Nexus-owned state roots', () => {
    const dockerfile = readFileSync(join(ROOT, '.github', 'docker', 'Dockerfile.ci'), 'utf8');
    const evalsWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'evals.yml'), 'utf8');
    const periodicWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'evals-periodic.yml'), 'utf8');

    expect(dockerfile).toContain('Nexus CI eval runner');
    expect(dockerfile).toContain('/home/runner/.nexus');
    expect(dockerfile).toContain('/home/runner/.nexus-dev');
    expect(dockerfile).not.toContain('/home/runner/.gstack');

    expect(evalsWorkflow).toContain('~/.nexus/projects/*/evals/*.json');
    expect(evalsWorkflow).toContain('~/.nexus-dev/evals/*.json');
    expect(periodicWorkflow).toContain('~/.nexus/projects/*/evals/*.json');
    expect(periodicWorkflow).toContain('~/.nexus-dev/evals/*.json');
    expect(evalsWorkflow).not.toContain('~/.gstack-dev/evals/*.json');
    expect(periodicWorkflow).not.toContain('~/.gstack-dev/evals/*.json');
  });
});
