# Nexus Repo Taxonomy v2

The root `/nexus` source template has moved into the skill taxonomy. The Chrome
extension source has moved under the browse runtime taxonomy. Other runtime,
reference, vendor, and host source paths remain in their compatibility locations
until a migration explicitly updates setup, generated host surfaces, runtime
path rewrites, and tests.

Phase 3 adds documentation-only facades under `runtimes/`, `references/`, and
`hosts/`. These facades improve repo navigation, but they are not executable
runtime roots, not installable reference sources, and not generated host output.

## Target Tree

```text
nexus/
  skills/
    root/nexus/
    canonical/
    support/
    safety/
    aliases/

  runtimes/
    browse/
      extension/
    design/
    design-html/
    safety/

  references/
    review/
    qa/
    design/
    cso/

  lib/
    nexus/

  hosts/
    claude/
    codex/
    gemini-cli/
    factory/
    kiro/

  vendor/
    upstream/
    upstream-notes/

  bin/
  scripts/
  docs/
  test/
```

## Current Policy

Most current paths remain the active source of truth until a migration
explicitly updates setup, generated host surfaces, runtime path rewrites, and
tests. The root `/nexus` source template now lives under
`skills/root/nexus/`; root `SKILL.md` remains a generated compatibility mirror.
The Chrome extension source now lives under `runtimes/browse/extension/`, while
installed hosts keep `$NEXUS_ROOT/extension` as a compatibility path.

Representative current-to-target mappings:

- `skills/root/nexus/SKILL.md.tmpl` -> `skills/root/nexus/SKILL.md.tmpl`
- `SKILL.md` -> `skills/root/nexus/SKILL.md` (generated compatibility mirror)
- `browse` -> `runtimes/browse`
- `runtimes/browse/extension` -> `runtimes/browse/extension`
- `design` -> `runtimes/design`
- `design/references` -> `references/design`
- `review` -> `references/review`
- `qa` -> `references/qa`
- `upstream` -> `vendor/upstream`
- `.agents` -> `hosts/codex`
- `agents/openai.yaml` -> `hosts/codex/openai.yaml`
- `.factory` -> `hosts/factory`

Compatibility matters more than visual cleanup. Any future move must preserve
installed runtime paths such as:

- `$NEXUS_ROOT/browse/dist`
- `$NEXUS_ROOT/browse/bin`
- `$NEXUS_ROOT/extension/manifest.json`
- `$NEXUS_ROOT/design/dist`
- `$NEXUS_ROOT/design/references`
- `$NEXUS_ROOT/review/checklist.md`
- `$NEXUS_ROOT/review/specialists/testing.md`
- `$NEXUS_ROOT/qa/templates/qa-report-template.md`

## Phase 4 First Reference Move

The first physical reference batch has moved low-risk sidecars into
`references/` while preserving installed runtime paths through setup compatibility
links:

- `review/checklist.md` -> `references/review/checklist.md`
- `review/design-checklist.md` -> `references/review/design-checklist.md`
- `review/greptile-triage.md` -> `references/review/greptile-triage.md`
- `review/TODOS-format.md` -> `references/review/TODOS-format.md`
- `qa/templates/` -> `references/qa/templates/`
- `qa/references/` -> `references/qa/references/`
- `cso/ACKNOWLEDGEMENTS.md` -> `references/cso/ACKNOWLEDGEMENTS.md`

Generated skills may still reference historical install paths like
`$NEXUS_ROOT/review/checklist.md`; setup maps those paths to the moved source
paths.

## Phase 5 Design Reference Move

The design methodology sidecars have moved under the real reference taxonomy
root:

- `design/references/` -> `references/design/`

Generated design skills may still reference `$NEXUS_ROOT/design/references/...`;
setup maps that installed compatibility path to the moved `references/design/`
source directory.

## Phase 6 Review Specialist Move

The review specialist prompts have moved under the review reference taxonomy
root:

- `review/specialists/` -> `references/review/specialists/`

Generated review skills may still reference
`$NEXUS_ROOT/review/specialists/...`; setup maps that installed compatibility
path to the moved `references/review/specialists/` source directory.

## Phase 7 Browse Extension Runtime Move

The Chrome side panel extension source has moved under the browse runtime
taxonomy:

- `extension/` -> `runtimes/browse/extension/`

Generated and installed skills still use `$NEXUS_ROOT/extension/...` for Chrome
auto-load and manual install flows. Setup maps that installed compatibility
path to `runtimes/browse/extension/`, while runtime resolvers still accept the
legacy source path for older installed branches.

## Remaining Conservative Facades

The remaining facade slice is intentionally conservative:

- `runtimes/*.md` points to active runtime roots. `runtimes/browse/extension/`
  is a migrated source path; the compiled browse runtime still lives at
  `browse/`.
- `references/review/README.md`, `references/qa/README.md`,
  `references/design/README.md`, and `references/cso/README.md` document active
  reference roots and the runtime compatibility paths that still point at
  historical install locations.
- `hosts/*/README.md` records intended host categories while `.claude/`,
  `.agents/`, `.gemini/`, and `.factory/` remain active host surfaces.
- `hosts/codex/openai.yaml` is a compatibility mirror for future Codex host
  metadata. The active legacy compatibility path remains `agents/openai.yaml`
  until setup/install switches deliberately.

Guarded future paths must stay absent until their migration batch moves assets
and updates compatibility logic. Remaining examples are runtime-focused, such
as `runtimes/design` and `runtimes/safety/careful`.

## First-Class Host Targets

`hosts/` is a host taxonomy, not just a mirror of current generated output.
The intended host set is:

- `hosts/claude`
- `hosts/codex`
- `hosts/gemini-cli`
- `hosts/factory`
- `hosts/kiro`

Gemini CLI is included even though current repo output is not yet generated
under a dedicated Gemini host tree. It should not be added later as an ad hoc
exception.

## Move Policies

- `keep_in_place`: current path already matches the target taxonomy or is a
  stable top-level utility root.
- `compat_required`: path can move only after setup creates compatibility
  links/copies for the existing `$NEXUS_ROOT/...` runtime paths.
- `future_move`: intended target is recorded, but moving now would require
  coordinated generator, setup, docs, and test changes.

The executable taxonomy contract lives in `lib/nexus/repo-taxonomy.ts`, with
coverage in `test/nexus/repo-taxonomy.test.ts`.

The exhaustive tracked-file inventory is generated by
`scripts/repo-path-inventory.ts` and committed at
`docs/architecture/repo-path-inventory.md`. Regenerate it after taxonomy rule
changes with:

```bash
bun run repo:inventory
```
