# Track D-D3 Phase 2.4 Brief: opt-in external skill installers

**Status:** Ready for implementation. Scope: add opt-in setup flags that
delegate external skill installation to the owning ecosystem's installer or
plugin manager.

**Type:** Setup integration. Nexus does not host, vendor, or rewrite external
skill bundles.

**Parent plan:** `docs/architecture/track-d-d3-rfc.md` Phase 3.2.d.
**Predecessor:** D3 Phase 2.a (#65) defines the manifest contract.
**Independent of:** Phase 2.2 (#74) registry consumption and Phase 2.3 (#75)
catalog examples.

**Issue:** #76.

---

## Goal

Add convenience flags to Nexus setup so users can opt into installing external
skill ecosystems through their official install paths:

- `--with-pm-skills`
- `--with-superpowers`
- `--with-gsd`

The setup flow delegates installation. Nexus owns the discovery and manifest
contract, not the external skill bits.

---

## Design principles

1. Opt-in only. No external bundle is installed by default.
2. Delegate to the upstream installer or plugin manager.
3. Fail visibly when the required plugin manager is missing.
4. Do not clone or vendor third-party skill repositories into Nexus.
5. Keep setup idempotent. Re-running setup should not duplicate installs.
6. Keep repo-local setup safe. External global installs should not happen from
   `./setup --local` unless the user explicitly asks and the implementation
   accepts that mode.
7. Support dry-run testing so CI can verify command selection without installing
   third-party tools.

---

## Surface map

### Files to modify

```text
setup
package.json
docs/skill-manifest-schema.md
docs/architecture/repo-path-inventory.md
```

### Files to create

```text
scripts/
`-- external-skill-installers.ts

test/nexus/
`-- setup-external-installers.test.ts
```

The root `setup` shell script remains the user-facing entry point. The TypeScript
helper owns command planning and dry-run behavior so tests can cover it without
executing real marketplace installs.

### Files not to modify

- `skills/**` - no external skill content is copied into Nexus.
- `vendor/**` - do not restore deleted upstream snapshots.
- `lib/nexus/skill-registry/*` - installer convenience is separate from
  registry discovery.

---

## CLI contract

Supported flags:

```bash
./setup --with-pm-skills
./setup --with-superpowers
./setup --with-gsd
./setup --with-pm-skills --with-superpowers --with-gsd
```

Test-only or maintainer-only flags:

```bash
./setup --external-skill-install-dry-run
./setup --external-skill-install-plan-json
```

`--external-skill-install-dry-run` prints the commands Nexus would run and exits
after normal setup validation without invoking external installers.

`--external-skill-install-plan-json` prints machine-readable command plans from
`scripts/external-skill-installers.ts`; it is intended for tests.

---

## Installer planning helper

`scripts/external-skill-installers.ts` exports a pure planner:

```typescript
export type ExternalSkillBundle = 'pm-skills' | 'superpowers' | 'gsd';

export interface ExternalSkillInstallerPlan {
  bundle: ExternalSkillBundle;
  host: 'claude' | 'codex' | 'gemini';
  available: boolean;
  command: string[];
  reason?: string;
}

export function planExternalSkillInstallers(input: {
  bundles: ExternalSkillBundle[];
  hostAvailability: Record<'claude' | 'codex' | 'gemini', boolean>;
  env?: Record<string, string | undefined>;
}): ExternalSkillInstallerPlan[];
```

The helper must be conservative. If the repo does not contain a verified command
for a bundle/host pair, return `available: false` with a clear reason instead
of guessing. Implementation should verify exact commands from the owning
project or plugin manager documentation before enabling non-dry-run execution.

The issue preview gives the intended direction:

- PM Skills installs through the Claude Code marketplace path.
- Superpowers installs through `claude-plugins-official`.
- GSD installs through the GSD-provided installer.

The implementation PR must capture the verified command strings in code
comments or docs near the command table.

---

## Setup shell integration

Add option parsing near the existing `--local`, `--claude`, `--codex`, and
`--gemini` flags:

```sh
WITH_PM_SKILLS=0
WITH_SUPERPOWERS=0
WITH_GSD=0
EXTERNAL_SKILL_INSTALL_DRY_RUN=0
EXTERNAL_SKILL_INSTALL_PLAN_JSON=0
```

After host detection and before final success output:

1. Build the requested bundle list.
2. Ask `scripts/external-skill-installers.ts` for a plan.
3. If any requested bundle has no available installer, print all reasons and
   exit non-zero before partial installation.
4. If dry-run or plan-json mode is active, print the plan and do not install.
5. Execute installers sequentially.
6. If any installer exits non-zero, stop and report which bundle failed.
7. Print next-step guidance that the user can run Nexus discovery after
   installation.

Do not run these installers from implicit `auto` detection. Only explicit flags
activate them.

---

## Failure modes

| Failure | Required behavior |
|---|---|
| Required host CLI missing | Block before any external bundle install starts. |
| Installer command unknown | Block with a message that the installer contract has not been verified. |
| Installer exits non-zero | Stop, show command label and stderr, exit non-zero. |
| Multiple bundles requested and one unsupported | Block before installing any bundle. |
| Re-run after previous install | Let upstream installer handle idempotency; Nexus should not duplicate local files. |
| `--local` with global installer flags | Block unless implementation explicitly supports local external installs. |

---

## Tests

Add `test/nexus/setup-external-installers.test.ts` around the TypeScript planner
and setup plan-json path.

Required cases:

1. No bundle flags produce an empty install plan.
2. Each flag maps to the intended bundle id.
3. Missing required host CLI blocks that bundle.
4. Unknown installer command blocks instead of guessing.
5. Multiple bundle flags are all planned before any execution.
6. Dry-run prints commands and performs no install.
7. Plan-json output is stable and parseable.
8. `--local` plus external bundle flags blocks with a clear message.
9. Non-zero installer result stops later installers.
10. No command plan includes retired upstream snapshot paths or copies external skill bodies
    into Nexus.

If direct shell integration tests are too heavy on Windows, test the pure
planner first and add one smoke test that invokes `bash setup
--external-skill-install-plan-json --with-pm-skills` with fake host binaries on
`PATH`.

---

## Documentation

Update `docs/skill-manifest-schema.md` or add a short setup section that says:

- These flags install external skill bundles through their owners' installers.
- Nexus does not bundle or redistribute those skills.
- Installed skills are discovered only after their `SKILL.md` exists in a host
  install root.
- `nexus.skill.yaml` manifests improve routing when the external skill provides
  one.
- Users can inspect what would run with dry-run before installing.

---

## Verification

```bash
bun test test/nexus/setup-external-installers.test.ts
bun run skill:check
bun run repo:inventory:check
git grep -F "retired upstream snapshot" -- setup scripts/external-skill-installers.ts test/nexus/setup-external-installers.test.ts
```

The final grep must return no matches.

---

## Acceptance criteria

1. `setup` accepts `--with-pm-skills`, `--with-superpowers`, and `--with-gsd`.
2. External install planning is isolated in a testable TypeScript helper.
3. Missing or unverified plugin manager commands block before partial installs.
4. Dry-run and plan-json modes exist for CI and reviewer inspection.
5. Tests cover supported, unsupported, dry-run, and partial-failure behavior.
6. Documentation explains that Nexus delegates installation and does not host
   these skill bundles.
7. `docs/architecture/repo-path-inventory.md` is regenerated.
8. No external skill content or upstream snapshot is added to Nexus.

---

## Out of scope

- Writing catalog templates. That is Phase 2.3.
- Making SkillRegistry consume manifests. That is Phase 2.2.
- Installing CCB. Existing CCB setup logic remains separate.
- Implementing `/nexus do`.
- Replacing any external marketplace or plugin manager.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Exact external install command is guessed incorrectly | Planner blocks unknown commands until implementation verifies them from source documentation. |
| Setup partially installs one bundle then blocks another | Plan all requested bundles before executing any installer. |
| CI accidentally installs external tools | Use dry-run and plan-json tests. |
| Nexus starts hosting third-party bits again | Keep installer as shell-out only; add grep/test guard against retired upstream snapshot paths and copied skill bodies. |
| Host-specific installer behavior diverges | Keep per-host command plans explicit and covered by tests. |

---

## References

- Issue #76.
- `docs/architecture/track-d-d3-rfc.md` Phase 3.2.d.
- `docs/architecture/track-d-d3-phase-2-brief.md`.
- Root `setup` script.
