# Nexus Final Identity And Release Readiness Closeout

Date: 2026-04-08
Branch: `codex/nexus-final-identity-release-readiness`
Status: `completed`

## Outcome

Nexus is now the only active product, helper, runtime, and host identity in the
live repository surface.

This closeout completed the final repo-local release-readiness cutover:

- active compatibility contracts now use generic `legacy` naming instead of
  live `gstack`-branded identifiers
- the last active historical inventory filename moved to
  `upstream-notes/legacy-host-migration-history.md`
- `nexus-config --help` now behaves like a stable helper entrypoint and exits 0
- `bin/nexus-uninstall` is executable again and covered by regression tests
- live runtime helpers no longer rely on legacy root fallbacks

`gstack` now survives only inside historical record content, archived closeouts,
and source-history provenance. It is no longer present as an active filename,
helper entrypoint, install root, or runtime identity in the live Nexus path.

## Contract Updates

Files updated to finalize Nexus-only live identity:

- `lib/nexus/compatibility-surface.ts`
- `lib/nexus/host-roots.ts`
- `lib/nexus/product-surface.ts`
- `lib/nexus/support-surface.ts`
- `lib/worktree.ts`
- `scripts/eval-watch.ts`
- `test/helpers/eval-store.ts`
- `test/helpers/e2e-helpers.ts`
- `test/helpers/codex-session-runner.ts`
- `upstream-notes/legacy-host-migration-history.md`

Helper-surface fixes:

- `bin/nexus-config`
- `bin/nexus-uninstall`

Regression coverage added or updated:

- `browse/test/nexus-config.test.ts`
- `test/uninstall.test.ts`
- `test/nexus/compatibility-surface.test.ts`
- `test/nexus/inventory.test.ts`
- `test/nexus/product-surface.test.ts`

## Verification

Targeted release-readiness checks:

- `bun test browse/test/nexus-config.test.ts test/uninstall.test.ts test/nexus/compatibility-surface.test.ts test/nexus/inventory.test.ts test/nexus/product-surface.test.ts`
  Result: pass (`45 pass, 0 fail`)
- `./bin/nexus-config --help`
  Result: exit 0
- `./bin/nexus-relink --help`
  Result: exit 0
- `./bin/nexus-uninstall --help`
  Result: exit 0
- `./bin/nexus-update-check --help`
  Result: exit 0
- `find . -path './node_modules' -prune -o -path './.git' -prune -o -type f \( -name '*gstack*' -o -path '*gstack*' \) -print | sort`
  Result: no active filenames or paths remain

Broader regression:

- `bun run gen:skill-docs --host codex`
  Result: pass
- `bun test`
  Result: pass (exit 0)
- `git diff --check`
  Result: clean

CCB runtime dispatch verification:

- `bun test test/nexus/ccb-runtime-adapter.test.ts`
  Result: pass (`5 pass, 0 fail`)
- `bun test test/nexus/*.test.ts`
  Result: pass (`117 pass, 0 fail`)
- `printf 'Reply exactly with: Nexus live codex ok\n' | env CCB_CALLER=claude CCB_ASKD_AUTOSTART=1 CCB_ALLOW_FOREGROUND=1 CCB_SESSION_FILE=/Users/henry/Documents/nexus/.ccb/.codex-session /Users/henry/.local/share/codex-dual/bin/ask codex --foreground --no-wrap --timeout 60`
  Result: exit 0, output begins with `Nexus live codex ok`
- `printf 'Reply exactly with: Nexus live gemini ok\n' | env CCB_CALLER=claude CCB_ASKD_AUTOSTART=1 CCB_ALLOW_FOREGROUND=1 CCB_SESSION_FILE=/Users/henry/Documents/nexus/.ccb/.gemini-session /Users/henry/.local/share/codex-dual/bin/ask gemini --foreground --no-wrap --timeout 60`
  Result: exit 0, output begins with `Nexus live gemini ok`

## CCB Dispatch Completion

The local CCB installation is now healthy for this repository:

```bash
/Users/henry/.local/share/codex-dual/bin/ask codex --foreground --no-wrap
/Users/henry/.local/share/codex-dual/bin/ask gemini --foreground --no-wrap
```

Observed status:

- project session files are present in `.ccb/`
- live Codex and Gemini dispatch succeed through the external CCB `ask` entrypoint
- Nexus now invokes real CCB transport from `lib/nexus/adapters/ccb.ts` for governed `handoff/build/review/qa`
- requested and actual route records remain Nexus-owned and repo-visible after normalization/writeback

One environment note matters:

- local `ccb-mounted` still reflects legacy per-provider daemon detection and can
  report an empty mounted set under the newer unified `askd` runtime
- Nexus no longer treats that legacy mounted output as route truth
- `/handoff` now performs a real trivial dispatch ping through `ask` and still
  keeps approval separate from availability

## Final State

- Nexus is the only active live product identity.
- Nexus-owned repo artifacts remain the only governed truth source.
- Compatibility is now historical record only, not active surface.
- Real external CCB dispatch is wired into the governed Nexus runtime.
- CCB remains transport only; Nexus still owns lifecycle, artifacts, and governance.
