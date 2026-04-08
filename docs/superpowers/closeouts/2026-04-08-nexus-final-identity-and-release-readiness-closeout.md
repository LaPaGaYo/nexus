# Nexus Final Identity And Release Readiness Closeout

Date: 2026-04-08
Branch: `codex/nexus-final-identity-release-readiness`
Status: `completed_with_real_ccb_dispatch_gap`

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

## Remaining Gap

The local CCB installation is now healthy for this repository:

```bash
/Users/henry/.local/share/codex-dual/bin/ccb-mounted --autostart
/Users/henry/.local/bin/ccb-ping claude
/Users/henry/.local/bin/ccb-ping codex
/Users/henry/.local/bin/ccb-ping gemini
```

Observed status:

- mounted providers: `claude`, `codex`, `gemini`
- project session files present in `.ccb/`
- all three `ccb-ping` checks return success

The remaining release-readiness gap is now inside Nexus integration, not local
bridge health:

- `lib/nexus/adapters/ccb.ts` still uses Nexus-owned default stage-pack outputs
  and synthetic receipts
- governed `handoff/build/review/qa` flows record CCB-shaped provenance, but do
  not yet invoke the external `ccb` CLI or consume real dispatch receipts

That means the current repo is Nexus-complete at the product and contract
surface, but it is not yet fully complete at the real external dispatch layer.
The next milestone is real CCB dispatch integration for governed execution and
audit paths.

## Final State

- Nexus is the only active live product identity.
- Nexus-owned repo artifacts remain the only governed truth source.
- Compatibility is now historical record only, not active surface.
- The remaining blocker for full dispatch-path release readiness is real CCB
  dispatch wiring inside Nexus, not repository structure or local bridge
  installation health.
