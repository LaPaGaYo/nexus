import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
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
    const installSection = readme.split('### Step 1: Install Nexus on your machine')[1]?.split('### Step 2: Add Nexus to your repo so teammates get it')[0] ?? '';

    expect(readme).toContain('# Nexus');
    expect(readme).toContain('Nexus is the only command surface.');
    expect(readme).toContain('Upstream maintenance is handled by Nexus maintainers.');
    expect(readme).toContain('Users upgrade Nexus versions, not upstream repos.');
    expect(readme).toContain('`/nexus-upgrade` and automatic upgrade are the only user-facing update paths.');
    expect(readme).toContain('~/.claude/skills/nexus');
    expect(readme).toContain('~/.nexus/config.yaml');
    expect(readme).toContain('whether you want to install CCB now');
    expect(readme).toContain('continue without CCB and use `local_provider`');
    expect(readme).toContain('does not silently time out into');
    expect(readme).toContain('the first post-upgrade');
    expect(readme).toContain('repo mode and execution mode separately');
    expect(readme).toContain('asks whether to persist');
    expect(readme).toContain('the current Claude session with `local_provider`');
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
    expect(readme).toContain('git clone --single-branch --depth 1 https://github.com/LaPaGaYo/nexus.git ~/.claude/skills/nexus');
    expect(readme).toContain('Never use **`mcp__claude-in-chrome__*`** tools unless the user explicitly asks for them.');
    expect(installSection).toContain('/nexus-upgrade');
    expect(readme).not.toContain('git pull');
    expect(installSection).not.toContain('git pull --ff-only');
    expect(readme).not.toContain('published Nexus releases');
    expect(readme).not.toContain('compatibility shims');

    expect(skills).toContain('Nexus is the only command surface.');
    expect(skills).toContain('Nexus-owned stage packs');
    expect(skills).toContain('Upstream maintenance is handled by Nexus maintainers.');
    expect(skills).toContain('Users upgrade Nexus versions, not upstream repos.');
    expect(skills).toContain('`/nexus-upgrade` and automatic upgrade are the only user-facing update paths.');
    expect(skills).toContain('/nexus-upgrade');
    expect(skills).toContain('Upgrade Nexus itself through the supported release-based update flow.');
    expect(skills).not.toContain('Manage what gstack learned');
    expect(skills).not.toContain('controlled by gstack');
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
    expect(readme).toContain('| `/discover` |');
    expect(readme).toContain('| `/frame` |');
    expect(readme).toContain('| `/plan` |');
    expect(readme).toContain('| `/handoff` |');
    expect(readme).toContain('| `/build` |');
    expect(readme).toContain('## Nexus support surface');
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
    expect(skills).toContain('## Legacy compatibility deep dives');
    expect(skills).not.toContain('## `/office-hours`');
    expect(skills).not.toContain('## `/plan-ceo-review`');
    expect(skills).not.toContain('## `/plan-eng-review`');
    expect(skills).not.toContain('This is where every project should start.');
    expect(skills).not.toContain('Brian Chesky mode');
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
    expect(setup).not.toContain('.claude/skills/gstack');
    expect(setup).not.toContain('.gstack-worktrees');
  });

  test('only nexus helper entrypoints exist in the active bin surface', () => {
    for (const helper of ['nexus-clean-claude-hooks', 'nexus-config', 'nexus-relink', 'nexus-uninstall', 'nexus-update-check']) {
      expect(existsSync(join(ROOT, 'bin', helper))).toBe(true);
    }

    for (const helper of REMOVED_COMPATIBILITY_BOUNDARY_SHIMS) {
      expect(existsSync(join(ROOT, helper))).toBe(false);
    }
  });

  test('active nexus helper entrypoints are executable', () => {
    for (const helper of ['nexus-clean-claude-hooks', 'nexus-config', 'nexus-relink', 'nexus-uninstall', 'nexus-update-check']) {
      const mode = statSync(join(ROOT, 'bin', helper)).mode;
      expect(mode & 0o111).not.toBe(0);
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

  test('maintainer runbooks and workflow route through the unified Nexus maintainer check', () => {
    const upstreamRunbook = readFileSync(join(ROOT, 'docs', 'superpowers', 'runbooks', 'upstream-refresh.md'), 'utf8');
    const releaseRunbook = readFileSync(join(ROOT, 'docs', 'superpowers', 'runbooks', 'nexus-release-publish.md'), 'utf8');
    const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'maintainer-loop.yml'), 'utf8');

    expect(upstreamRunbook).toContain('bun run maintainer:check');
    expect(upstreamRunbook).toContain('upstream-notes/maintainer-status.json');
    expect(upstreamRunbook).toContain('upstream-notes/maintainer-status.md');

    expect(releaseRunbook).toContain('bun run maintainer:check');
    expect(releaseRunbook).toContain('./bin/nexus-release-preflight');
    expect(releaseRunbook).toContain('./bin/nexus-release-smoke');

    expect(workflow).toContain('workflow_dispatch');
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain('bun run upstream:check');
    expect(workflow).toContain('bun run maintainer:check');
    expect(workflow).toContain('NEXUS_REMOTE_RELEASE_MODE: live');
    expect(workflow).toContain('does not define repository truth');
  });
});
