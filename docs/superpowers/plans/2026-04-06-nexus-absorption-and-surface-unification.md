# Nexus Absorption and Surface Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current Gstack-hosted Nexus into a more fully absorbed Nexus surface by introducing Nexus-owned absorbed capability packs, reducing host semantic ownership, and enforcing that only canonical Nexus commands may advance governed lifecycle state.

**Architecture:** Keep `lib/nexus/` and canonical `.planning/` artifacts as the only governed source of truth, but move imported PM/GSD/Superpowers/CCB knowledge into Nexus-owned absorbed packs under `lib/nexus/absorption/`. Then thin the host shell so generated wrappers and `CLAUDE.md` guidance only route into canonical Nexus commands without reintroducing contract or transition semantics.

**Tech Stack:** Bun, TypeScript, generated `SKILL.md` wrappers, markdown inventories/specs/plans, repo-visible `.planning/` artifacts, imported upstream source snapshots under `upstream/`.

---

## File Map

### Nexus Runtime and Absorption Layer

- Create: `lib/nexus/absorption/types.ts`
- Create: `lib/nexus/absorption/index.ts`
- Create: `lib/nexus/absorption/pm/source-map.ts`
- Create: `lib/nexus/absorption/pm/discover.ts`
- Create: `lib/nexus/absorption/pm/frame.ts`
- Create: `lib/nexus/absorption/gsd/source-map.ts`
- Create: `lib/nexus/absorption/gsd/plan.ts`
- Create: `lib/nexus/absorption/gsd/closeout.ts`
- Create: `lib/nexus/absorption/superpowers/source-map.ts`
- Create: `lib/nexus/absorption/superpowers/build.ts`
- Create: `lib/nexus/absorption/ccb/source-map.ts`
- Create: `lib/nexus/absorption/ccb/handoff.ts`
- Create: `lib/nexus/absorption/ccb/build.ts`
- Create: `lib/nexus/migration-safety.ts`
- Modify: `lib/nexus/types.ts`
- Modify: `lib/nexus/adapters/types.ts`
- Modify: `lib/nexus/command-manifest.ts`
- Modify: `lib/nexus/adapters/pm.ts`
- Modify: `lib/nexus/adapters/gsd.ts`
- Modify: `lib/nexus/adapters/superpowers.ts`
- Modify: `lib/nexus/adapters/ccb.ts`
- Modify: `lib/nexus/adapters/registry.ts`
- Modify: `lib/nexus/commands/index.ts`
- Modify: `lib/nexus/commands/discover.ts`
- Modify: `lib/nexus/commands/frame.ts`
- Modify: `lib/nexus/commands/plan.ts`
- Modify: `lib/nexus/commands/handoff.ts`
- Modify: `lib/nexus/commands/build.ts`
- Modify: `lib/nexus/commands/closeout.ts`
- Modify: `lib/nexus/commands/review.ts`

### Host Reduction and Wrapper Surface

- Modify: `scripts/resolvers/preamble.ts`
- Modify: `scripts/gen-skill-docs.ts`
- Modify: `discover/SKILL.md.tmpl`
- Modify: `frame/SKILL.md.tmpl`
- Modify: `plan/SKILL.md.tmpl`
- Modify: `handoff/SKILL.md.tmpl`
- Modify: `build/SKILL.md.tmpl`
- Modify: `review/SKILL.md.tmpl`
- Modify: `qa/SKILL.md.tmpl`
- Modify: `ship/SKILL.md.tmpl`
- Modify: `closeout/SKILL.md.tmpl`
- Modify: `office-hours/SKILL.md.tmpl`
- Modify: `plan-ceo-review/SKILL.md.tmpl`
- Modify: `plan-eng-review/SKILL.md.tmpl`
- Modify: `autoplan/SKILL.md.tmpl`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/skills.md`

### Provenance and Imported Source Metadata

- Modify: `upstream/README.md`
- Modify: `upstream-notes/pm-skills-inventory.md`
- Modify: `upstream-notes/gsd-inventory.md`
- Modify: `upstream-notes/superpowers-inventory.md`
- Modify: `upstream-notes/ccb-inventory.md`
- Create: `upstream-notes/absorption-status.md`

### Tests

- Create: `test/nexus/absorption-source-map.test.ts`
- Create: `test/nexus/absorption-runtime.test.ts`
- Create: `test/nexus/migration-safety.test.ts`
- Create: `test/nexus/claude-boundary.test.ts`
- Modify: `test/nexus/inventory.test.ts`
- Modify: `test/nexus/manifest.test.ts`
- Modify: `test/nexus/alias-safety.test.ts`
- Modify: `test/nexus/discover-frame.test.ts`
- Modify: `test/nexus/plan-handoff-build.test.ts`
- Modify: `test/nexus/build-routing.test.ts`
- Modify: `test/nexus/build-discipline.test.ts`
- Modify: `test/nexus/closeout.test.ts`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: `test/skill-validation.test.ts`

## Task 1: Freeze Absorbed Capability Pack Contracts

**Files:**
- Create: `lib/nexus/absorption/types.ts`
- Create: `lib/nexus/absorption/index.ts`
- Create: `lib/nexus/absorption/pm/source-map.ts`
- Create: `lib/nexus/absorption/gsd/source-map.ts`
- Create: `lib/nexus/absorption/superpowers/source-map.ts`
- Create: `lib/nexus/absorption/ccb/source-map.ts`
- Modify: `lib/nexus/types.ts`
- Modify: `upstream/README.md`
- Test: `test/nexus/absorption-source-map.test.ts`
- Test: `test/nexus/inventory.test.ts`

- [ ] **Step 1: Write the failing absorption source-map tests**

```ts
import { describe, expect, test } from 'bun:test';
import {
  PM_SOURCE_MAP,
  GSD_SOURCE_MAP,
  SUPERPOWERS_SOURCE_MAP,
  CCB_SOURCE_MAP,
} from '../../lib/nexus/absorption';

describe('nexus absorbed source maps', () => {
  test('every absorbed source entry points at an imported upstream path', () => {
    for (const entry of [
      ...PM_SOURCE_MAP,
      ...GSD_SOURCE_MAP,
      ...SUPERPOWERS_SOURCE_MAP,
      ...CCB_SOURCE_MAP,
    ]) {
      expect(entry.imported_path.startsWith('upstream/')).toBe(true);
      expect(entry.upstream_file.startsWith(entry.imported_path)).toBe(true);
      expect(entry.canonical_stage.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the source-map tests to verify they fail**

Run: `bun test test/nexus/absorption-source-map.test.ts test/nexus/inventory.test.ts`

Expected: FAIL because the absorption source-map modules do not exist yet.

- [ ] **Step 3: Add shared absorbed-source contracts and source maps**

```ts
// lib/nexus/absorption/types.ts
import type { CanonicalCommandId } from '../types';

export interface AbsorbedSourceRef {
  system: 'pm-skills' | 'gsd' | 'superpowers' | 'ccb';
  imported_path: string;
  upstream_repo_url: string;
  pinned_commit: string;
  upstream_file: string;
  canonical_stage: CanonicalCommandId;
  absorbed_capability: string;
}
```

```ts
// lib/nexus/absorption/pm/source-map.ts
import type { AbsorbedSourceRef } from '../types';

export const PM_SOURCE_MAP: AbsorbedSourceRef[] = [
  {
    system: 'pm-skills',
    imported_path: 'upstream/pm-skills',
    upstream_repo_url: 'https://github.com/deanpeters/Product-Manager-Skills.git',
    pinned_commit: '4aa4196c14873b84f5af7316e7f66328cb6dee4c',
    upstream_file: 'upstream/pm-skills/commands/discover.md',
    canonical_stage: 'discover',
    absorbed_capability: 'pm-discover',
  },
];
```

- [ ] **Step 4: Export absorbed source maps from one Nexus-owned barrel**

```ts
// lib/nexus/absorption/index.ts
export * from './types';
export * from './pm/source-map';
export * from './gsd/source-map';
export * from './superpowers/source-map';
export * from './ccb/source-map';
```

- [ ] **Step 5: Run the absorption/inventory tests to verify they pass**

Run: `bun test test/nexus/absorption-source-map.test.ts test/nexus/inventory.test.ts`

Expected: PASS with imported-path and pinned-commit checks succeeding.

- [ ] **Step 6: Commit the contract freeze**

```bash
git add lib/nexus/absorption lib/nexus/types.ts lib/nexus/adapters/types.ts upstream/README.md test/nexus/absorption-source-map.test.ts test/nexus/inventory.test.ts
git commit -m "feat: add nexus absorption source maps"
```

## Task 2: Build PM and GSD Absorbed Packs for Active Stages

**Files:**
- Create: `lib/nexus/absorption/pm/discover.ts`
- Create: `lib/nexus/absorption/pm/frame.ts`
- Create: `lib/nexus/absorption/gsd/plan.ts`
- Create: `lib/nexus/absorption/gsd/closeout.ts`
- Modify: `lib/nexus/adapters/pm.ts`
- Modify: `lib/nexus/adapters/gsd.ts`
- Modify: `lib/nexus/commands/discover.ts`
- Modify: `lib/nexus/commands/frame.ts`
- Modify: `lib/nexus/commands/plan.ts`
- Modify: `lib/nexus/commands/closeout.ts`
- Test: `test/nexus/absorption-runtime.test.ts`
- Test: `test/nexus/discover-frame.test.ts`
- Test: `test/nexus/plan-handoff-build.test.ts`
- Test: `test/nexus/closeout.test.ts`

- [ ] **Step 1: Write failing tests that active PM/GSD seams route through Nexus-owned absorbed packs**

```ts
import { describe, expect, test } from 'bun:test';
import { createDefaultPmAdapter } from '../../lib/nexus/adapters/pm';
import { createDefaultGsdAdapter } from '../../lib/nexus/adapters/gsd';

describe('nexus absorbed runtime', () => {
  test('pm adapter reports absorbed capability ids', async () => {
    const adapter = createDefaultPmAdapter();
    const result = await adapter.discover({
      cwd: process.cwd(),
      command: 'discover',
      run_id: 'run-test',
      clock: () => new Date().toISOString(),
    });
    expect(result.traceability?.absorbed_capability).toBe('pm-discover');
  });
});
```

- [ ] **Step 2: Run the PM/GSD runtime and stage tests to verify they fail**

Run: `bun test test/nexus/absorption-runtime.test.ts test/nexus/discover-frame.test.ts test/nexus/plan-handoff-build.test.ts test/nexus/closeout.test.ts`

Expected: FAIL because adapters do not yet expose absorbed-pack provenance.

- [ ] **Step 3: Add Nexus-owned PM and GSD method-pack modules**

```ts
// lib/nexus/absorption/pm/discover.ts
import type { NexusAdapterContext } from '../../adapters/types';

export function buildPmDiscoverPrompt(ctx: NexusAdapterContext): string {
  return [
    'Nexus canonical stage: /discover',
    'Output must be normalized into docs/product/idea-brief.md only through Nexus writeback.',
    `Run id: ${ctx.run_id}`,
  ].join('\n');
}
```

```ts
// lib/nexus/absorption/gsd/plan.ts
import type { NexusAdapterContext } from '../../adapters/types';

export function buildGsdPlanRequest(ctx: NexusAdapterContext): string {
  return [
    'Nexus canonical stage: /plan',
    'Return readiness inputs only; Nexus owns ready/not_ready.',
    `Run id: ${ctx.run_id}`,
  ].join('\n');
}
```

- [ ] **Step 4: Route the PM/GSD adapters through absorbed packs and preserve Nexus-owned status writeback**

```ts
// lib/nexus/adapters/pm.ts
import { buildPmDiscoverPrompt } from '../absorption/pm/discover';

return {
  outcome: 'completed',
  adapter_id: 'pm',
  traceability: {
    absorbed_capability: 'pm-discover',
    source_map: ['upstream/pm-skills/commands/discover.md'],
  },
  raw_output: {
    prompt: buildPmDiscoverPrompt(ctx),
    idea_brief: '# Idea Brief\n\n...',
  },
};
```

```ts
// lib/nexus/adapters/types.ts
export interface AdapterTraceability {
  absorbed_capability: string;
  source_map: string[];
}

export interface AdapterResult<TRaw> {
  adapter_id: string;
  outcome: 'success' | 'blocked' | 'refused' | 'error';
  raw_output: TRaw;
  requested_route: RequestedRouteRecord | null;
  actual_route: ActualRouteRecord | null;
  notices: string[];
  conflict_candidates: ConflictRecord[];
  traceability?: AdapterTraceability;
}
```

- [ ] **Step 5: Run active PM/GSD stage tests to verify canonical behavior is unchanged**

Run: `bun test test/nexus/absorption-runtime.test.ts test/nexus/discover-frame.test.ts test/nexus/plan-handoff-build.test.ts test/nexus/closeout.test.ts`

Expected: PASS with existing canonical doc/status assertions still succeeding.

- [ ] **Step 6: Commit the PM/GSD absorption wiring**

```bash
git add lib/nexus/absorption/pm lib/nexus/absorption/gsd lib/nexus/adapters/pm.ts lib/nexus/adapters/gsd.ts lib/nexus/commands/discover.ts lib/nexus/commands/frame.ts lib/nexus/commands/plan.ts lib/nexus/commands/closeout.ts test/nexus/absorption-runtime.test.ts test/nexus/discover-frame.test.ts test/nexus/plan-handoff-build.test.ts test/nexus/closeout.test.ts
git commit -m "feat: route pm and gsd through absorbed packs"
```

## Task 3: Build Superpowers and CCB Absorbed Packs Without Activating Reserved Future Seams

**Files:**
- Create: `lib/nexus/absorption/superpowers/build.ts`
- Create: `lib/nexus/absorption/ccb/handoff.ts`
- Create: `lib/nexus/absorption/ccb/build.ts`
- Modify: `lib/nexus/adapters/superpowers.ts`
- Modify: `lib/nexus/adapters/ccb.ts`
- Modify: `lib/nexus/adapters/registry.ts`
- Modify: `lib/nexus/commands/handoff.ts`
- Modify: `lib/nexus/commands/build.ts`
- Modify: `lib/nexus/commands/review.ts`
- Test: `test/nexus/absorption-runtime.test.ts`
- Test: `test/nexus/build-routing.test.ts`
- Test: `test/nexus/build-discipline.test.ts`
- Test: `test/nexus/inventory.test.ts`

- [ ] **Step 1: Add failing tests for absorbed Superpowers/CCB provenance and reserved-future enforcement**

```ts
test('review and ship remain reserved even after absorption packs exist', () => {
  const registry = getDefaultAdapterRegistry();
  expect(registry.review.superpowers).toBe('reserved_future');
  expect(registry.review.ccb).toBe('reserved_future');
  expect(registry.ship.superpowers).toBe('reserved_future');
});
```

```ts
test('build traces absorbed discipline and transport capabilities', async () => {
  const status = await run.readJson('.planning/current/build/status.json');
  expect(status.actual_route).toBeDefined();
  expect(status.traceability.absorbed_capabilities).toEqual(['superpowers-build-discipline', 'ccb-build']);
});
```

- [ ] **Step 2: Run the Superpowers/CCB tests to verify they fail**

Run: `bun test test/nexus/absorption-runtime.test.ts test/nexus/build-routing.test.ts test/nexus/build-discipline.test.ts test/nexus/inventory.test.ts`

Expected: FAIL because absorbed capability tracing does not exist yet.

- [ ] **Step 3: Add absorbed Superpowers and CCB method packs**

```ts
// lib/nexus/absorption/superpowers/build.ts
export function buildDisciplineChecklist(): string[] {
  return [
    'Use TDD or explain why no test boundary exists.',
    'Do not allow completion claims without verification evidence.',
  ];
}
```

```ts
// lib/nexus/absorption/ccb/build.ts
import type { RequestedRouteRecord } from '../../types';

export function buildGeneratorDispatch(requested: RequestedRouteRecord) {
  return {
    provider: requested.generator,
    route: requested.route,
    substrate: requested.substrate,
  };
}
```

- [ ] **Step 4: Update the active Superpowers/CCB adapters to emit absorbed-pack traceability while keeping `/review` and `/ship` inactive**

```ts
traceability: {
  absorbed_capability: 'superpowers-build-discipline',
  source_map: ['upstream/superpowers/skills/test-driven-development/SKILL.md'],
}
```

```ts
export function getDefaultAdapterRegistry(): AdapterRegistry {
  return {
    handoff: { ccb: 'active' },
    build: { superpowers: 'active', ccb: 'active' },
    review: { superpowers: 'reserved_future', ccb: 'reserved_future' },
    ship: { superpowers: 'reserved_future' },
  };
}
```

- [ ] **Step 5: Run build/routing/inventory tests to verify active seams pass and reserved seams stay inactive**

Run: `bun test test/nexus/absorption-runtime.test.ts test/nexus/build-routing.test.ts test/nexus/build-discipline.test.ts test/nexus/inventory.test.ts`

Expected: PASS with requested-vs-actual route checks unchanged and review/ship still reserved.

- [ ] **Step 6: Commit the Superpowers/CCB absorption wiring**

```bash
git add lib/nexus/absorption/superpowers lib/nexus/absorption/ccb lib/nexus/adapters/superpowers.ts lib/nexus/adapters/ccb.ts lib/nexus/adapters/registry.ts lib/nexus/commands/handoff.ts lib/nexus/commands/build.ts lib/nexus/commands/review.ts test/nexus/absorption-runtime.test.ts test/nexus/build-routing.test.ts test/nexus/build-discipline.test.ts test/nexus/inventory.test.ts
git commit -m "feat: route active build and handoff through absorbed packs"
```

## Task 4: Enforce Backend Command Non-Authority and Migration Safety

**Files:**
- Create: `lib/nexus/migration-safety.ts`
- Modify: `lib/nexus/commands/index.ts`
- Modify: `lib/nexus/command-manifest.ts`
- Modify: `lib/nexus/commands/discover.ts`
- Modify: `lib/nexus/commands/frame.ts`
- Modify: `lib/nexus/commands/plan.ts`
- Modify: `lib/nexus/commands/handoff.ts`
- Modify: `lib/nexus/commands/build.ts`
- Modify: `lib/nexus/commands/closeout.ts`
- Create: `test/nexus/migration-safety.test.ts`
- Modify: `test/nexus/manifest.test.ts`
- Modify: `test/nexus/alias-safety.test.ts`

- [ ] **Step 1: Write failing tests that reject backend-native stage progression**

```ts
import { describe, expect, test } from 'bun:test';
import { assertCanonicalLifecycleEntrypoint } from '../../lib/nexus/migration-safety';

describe('nexus migration safety', () => {
  test('rejects upstream-native command names as governed lifecycle entrypoints', () => {
    expect(() => assertCanonicalLifecycleEntrypoint('gsd-plan-phase')).toThrow(/non-canonical/i);
    expect(() => assertCanonicalLifecycleEntrypoint('write-prd')).toThrow(/non-canonical/i);
  });
});
```

- [ ] **Step 2: Run migration-safety and manifest tests to verify they fail**

Run: `bun test test/nexus/migration-safety.test.ts test/nexus/manifest.test.ts test/nexus/alias-safety.test.ts`

Expected: FAIL because the non-authority guard does not exist yet.

- [ ] **Step 3: Add a runtime guard that only allows canonical commands and documented aliases to resolve into lifecycle handlers**

```ts
// lib/nexus/migration-safety.ts
import { CANONICAL_MANIFEST, LEGACY_ALIASES } from './command-manifest';

export function assertCanonicalLifecycleEntrypoint(name: string): void {
  if (name in CANONICAL_MANIFEST) return;
  if (name in LEGACY_ALIASES) return;
  throw new Error(`Non-canonical lifecycle entrypoint refused: ${name}`);
}
```

- [ ] **Step 4: Enforce the guard in command resolution and keep alias behavior unchanged**

```ts
// lib/nexus/commands/index.ts
import { assertCanonicalLifecycleEntrypoint } from '../migration-safety';

export function resolveInvocation(name: string): CommandInvocation {
  assertCanonicalLifecycleEntrypoint(name);
  const command = resolveCommandName(name);
  // existing canonical/alias resolution remains unchanged
}
```

- [ ] **Step 5: Run migration-safety tests to verify backend-native names are blocked while aliases still work**

Run: `bun test test/nexus/migration-safety.test.ts test/nexus/manifest.test.ts test/nexus/alias-safety.test.ts`

Expected: PASS with `start-work -> discover` and other aliases still resolving.

- [ ] **Step 6: Commit the migration-safety guard**

```bash
git add lib/nexus/migration-safety.ts lib/nexus/commands/index.ts lib/nexus/command-manifest.ts test/nexus/migration-safety.test.ts test/nexus/manifest.test.ts test/nexus/alias-safety.test.ts
git commit -m "feat: enforce canonical nexus entrypoints"
```

## Task 5: Reduce Host Preamble and `CLAUDE.md` Contract Leakage

**Files:**
- Modify: `scripts/resolvers/preamble.ts`
- Modify: `CLAUDE.md`
- Create: `test/nexus/claude-boundary.test.ts`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: `test/skill-validation.test.ts`

- [ ] **Step 1: Write failing tests that prove host routing text no longer defines Nexus contracts**

```ts
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';

describe('nexus claude boundary', () => {
  test('CLAUDE.md routing rules do not define governed artifact truth', () => {
    const content = readFileSync('CLAUDE.md', 'utf8');
    expect(content).not.toMatch(/current-run\.json|status\.json|ready\/blocked\/refused/i);
  });
});
```

```ts
test('generated canonical wrappers do not ship host-owned contract language', () => {
  const content = readFileSync('discover/SKILL.md', 'utf8');
  expect(content).not.toContain('gstack works best when');
  expect(content).toContain('bun run bin/nexus.ts discover');
});
```

- [ ] **Step 2: Run host-boundary tests to verify they fail**

Run: `bun test test/nexus/claude-boundary.test.ts test/gen-skill-docs.test.ts test/skill-validation.test.ts`

Expected: FAIL because `preamble.ts` still injects host-era routing semantics.

- [ ] **Step 3: Strip lifecycle and contract semantics out of `generateRoutingInjection(...)` and related preamble prose**

```ts
// scripts/resolvers/preamble.ts
return `If \`HAS_ROUTING\` is \`no\` ...:
Suggest adding invocation guidance for canonical Nexus commands only.
Do not describe governed artifacts, stage transitions, readiness, refusal, review completion, or closeout completion.
`;
```

- [ ] **Step 4: Rewrite repository `CLAUDE.md` routing guidance so it only helps invoke canonical Nexus commands**

```md
## Nexus Skill Routing

When the user's request matches a canonical Nexus command, invoke that command first.
This guidance helps with discovery only.
Contracts, transitions, governed artifacts, and lifecycle truth are owned by `lib/nexus/` and canonical `.planning/` artifacts.
```

- [ ] **Step 5: Run host-boundary tests to verify `CLAUDE.md` and generated wrappers no longer compete with Nexus contracts**

Run: `bun test test/nexus/claude-boundary.test.ts test/gen-skill-docs.test.ts test/skill-validation.test.ts`

Expected: PASS with generated wrapper checks and `CLAUDE.md` contract-boundary assertions succeeding.

- [ ] **Step 6: Commit the host-boundary reduction**

```bash
git add scripts/resolvers/preamble.ts CLAUDE.md test/nexus/claude-boundary.test.ts test/gen-skill-docs.test.ts test/skill-validation.test.ts
git commit -m "refactor: reduce host routing semantics"
```

## Task 6: Unify Wrapper Surface and Documentation Around Nexus-Only Discoverability

**Files:**
- Modify: `scripts/gen-skill-docs.ts`
- Modify: `discover/SKILL.md.tmpl`
- Modify: `frame/SKILL.md.tmpl`
- Modify: `plan/SKILL.md.tmpl`
- Modify: `handoff/SKILL.md.tmpl`
- Modify: `build/SKILL.md.tmpl`
- Modify: `review/SKILL.md.tmpl`
- Modify: `qa/SKILL.md.tmpl`
- Modify: `ship/SKILL.md.tmpl`
- Modify: `closeout/SKILL.md.tmpl`
- Modify: `office-hours/SKILL.md.tmpl`
- Modify: `plan-ceo-review/SKILL.md.tmpl`
- Modify: `plan-eng-review/SKILL.md.tmpl`
- Modify: `autoplan/SKILL.md.tmpl`
- Modify: `README.md`
- Modify: `docs/skills.md`
- Create: `upstream-notes/absorption-status.md`
- Test: `test/gen-skill-docs.test.ts`
- Test: `test/skill-validation.test.ts`

- [ ] **Step 1: Write failing tests for Nexus-first discoverability**

```ts
test('canonical wrapper descriptions stay Nexus-first even after upstream imports exist', () => {
  const content = readSkill('plan');
  expect(content).toContain('Canonical Nexus planning command');
  expect(content).not.toMatch(/GSD-native command|PM-native command|Superpowers-native command/);
});
```

```ts
test('README does not present backend-native skills as primary front doors', () => {
  const content = readFileSync('README.md', 'utf8');
  expect(content).toContain('/discover');
  expect(content).not.toMatch(/use GSD commands|use PM skills commands|use Superpowers commands/i);
});
```

- [ ] **Step 2: Run wrapper/doc tests to verify they fail**

Run: `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts`

Expected: FAIL because wrapper and README language still reflects transitional host-era framing.

- [ ] **Step 3: Update canonical and alias wrapper templates to present only Nexus-owned lifecycle semantics**

```md
# /plan — Nexus Planning

This command is the only supported planning lifecycle entrypoint.
Imported GSD methods may contribute planning logic behind the scenes, but they do not replace `/plan`.
```

```md
# /plan-eng-review — Transitional Alias

This alias routes to `/frame`.
It does not own separate artifacts, transitions, or lifecycle meaning.
```

- [ ] **Step 4: Update generated-doc tooling and top-level docs to reflect absorbed-Nexus language**

```md
## Nexus Commands

Nexus is the only command surface.
PM Skills, GSD, Superpowers, and CCB are absorbed internal capability sources or infrastructure.
```

- [ ] **Step 5: Run generation and validation tests to verify discoverability is Nexus-first**

Run: `bun run gen:skill-docs --host codex`

Expected: succeeds and rewrites generated `SKILL.md` files.

Run: `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts`

Expected: PASS with updated wrapper and README assertions.

- [ ] **Step 6: Commit the unified surface updates**

```bash
git add scripts/gen-skill-docs.ts discover/SKILL.md.tmpl frame/SKILL.md.tmpl plan/SKILL.md.tmpl handoff/SKILL.md.tmpl build/SKILL.md.tmpl review/SKILL.md.tmpl qa/SKILL.md.tmpl ship/SKILL.md.tmpl closeout/SKILL.md.tmpl office-hours/SKILL.md.tmpl plan-ceo-review/SKILL.md.tmpl plan-eng-review/SKILL.md.tmpl autoplan/SKILL.md.tmpl README.md docs/skills.md upstream-notes/absorption-status.md test/gen-skill-docs.test.ts test/skill-validation.test.ts
git commit -m "docs: unify nexus command surface language"
```

## Task 7: Run Full Regression and Lock the Migration Baseline

**Files:**
- Modify: `docs/superpowers/closeouts/2026-04-06-nexus-integration-seams-closeout.md`
- Create: `docs/superpowers/closeouts/2026-04-06-nexus-absorption-phase-1-closeout.md`
- Test: `test/nexus/*.test.ts`
- Test: `test/gen-skill-docs.test.ts`
- Test: `test/skill-validation.test.ts`
- Test: `test/skill-routing-e2e.test.ts`

- [ ] **Step 1: Run the Nexus regression suite**

Run: `bun test test/nexus/*.test.ts`

Expected: PASS with all Nexus lifecycle, absorption, inventory, and migration-safety tests green.

- [ ] **Step 2: Run the host/wrapper regression suite**

Run: `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts`

Expected: PASS with wrapper generation, validation, and routing behavior green.

- [ ] **Step 3: Run the generated wrapper command to ensure docs stay fresh**

Run: `bun run gen:skill-docs --host codex`

Expected: exits 0 with no unresolved placeholders in generated wrapper output.

- [ ] **Step 4: Record the absorption baseline in a closeout note**

```md
# Milestone 3 Phase 1 Closeout

- absorbed capability packs created under `lib/nexus/absorption/`
- host preamble reduced to shell/bootstrap role
- backend-native lifecycle entrypoints refused
- canonical Nexus commands remain the only governed front door
```

- [ ] **Step 5: Commit the verified Milestone 3 phase-1 baseline**

```bash
git add docs/superpowers/closeouts/2026-04-06-nexus-integration-seams-closeout.md docs/superpowers/closeouts/2026-04-06-nexus-absorption-phase-1-closeout.md
git commit -m "docs: add nexus absorption closeout"
```

## Self-Review Checklist

- Every Milestone 3 spec requirement is covered by at least one task.
- No task activates `/review` or `/ship` absorbed seams beyond `reserved_future`.
- No task introduces a second command surface or alternate artifact truth layer.
- No task allows backend-native commands to advance stage or write canonical status.
- Every task includes concrete file paths, test commands, and commit boundaries.
