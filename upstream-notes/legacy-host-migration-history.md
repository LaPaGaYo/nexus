# Legacy Host Migration History

Milestone 11 final state:

- Nexus is the only active host, helper, and runtime identity.
- `gstack` no longer participates in active setup, relink, uninstall, browse,
  or generated skill output.
- Remaining `gstack` mentions are historical only.

## Final compatibility record

- `removed_from_active_path`: `bin/gstack-config`, `bin/gstack-relink`, `bin/gstack-uninstall`, `bin/gstack-update-check`, `bin/gstack-analytics`, `bin/gstack-community-dashboard`, `bin/gstack-global-discover`, `bin/gstack-learnings-log`, `bin/gstack-learnings-search`, `bin/gstack-review-log`, `bin/gstack-review-read`, `bin/gstack-repo-mode`, `bin/gstack-slug`, `bin/gstack-telemetry-log`, `bin/gstack-telemetry-sync`, `bin/gstack-patch-names`, `bin/gstack-diff-scope`, `bin/gstack-platform-detect`, `bin/gstack-open-url`, `bin/gstack-extension`, `gstack-upgrade`, `~/.gstack`, `.gstack-worktrees`, `~/.gstack-dev`
- `historical_record_only`: `archived docs and closeouts`

| inventory_id | source_system | source_path_or_ref | capability_or_structure | classification | milestone_state | canonical_nexus_commands | nexus_adapter_seams | governed_artifact_boundaries | normalization_required | conflict_policy | conflict_artifact_paths | host_structure | current_host_role | truth_risk | host_disposition | cleanup_phase | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gstack-skill-shell-history | gstack | top-level command directories | historical shell lineage | adapt | verified | discover, frame, plan, handoff, build, review, qa, ship, closeout | none | none | host only; no governed writeback; historical only | block_or_refuse | .planning/current/conflicts/host-skill-shell.json | top-level command wrappers | historical lineage only | low | retain_as_host | completed_m11 | live wrapper meaning is Nexus-only; `gstack` remains only as host lineage in archived records |
| gstack-routing-history | gstack | scripts/resolvers/preamble.ts | host routing lineage | adapt | verified | discover, frame, plan, handoff, build, review, qa, ship, closeout | none | none | host only; no governed writeback; removed from active path | block_or_refuse | .planning/current/conflicts/host-routing.json | resolver preamble | Nexus-owned routing surface | low | retain_as_host | completed_m11 | active routing language is Nexus-only; historical `gstack` routing semantics are removed from the live path |
| gstack-setup-history | gstack | setup, bin/dev-setup, bin/dev-teardown | installer and dev-shell lineage | adapt | verified | none | none | none | host only; no governed writeback; removed from active path | block_or_refuse | .planning/current/conflicts/host-setup-surface.json | setup shell | Nexus-owned install and dev setup | low | retain_as_host | completed_m11 | active install/dev helpers point only at Nexus roots and names |
| gstack-helper-history | gstack | former `bin/gstack-*` helper shims | removed compatibility helpers | reject | verified | none | none | none | host only; removed from active path | block_or_refuse | .planning/current/conflicts/host-helper-entrypoints.json | helper binaries | removed compatibility layer | low | remove_after_cutover | completed_m11 | former `gstack-*` helper binaries are removed; only `nexus-*` helpers remain active |
| gstack-state-root-history | gstack | ~/.gstack | former host support state root | reject | verified | none | none | none | host only; historical only; no governed writeback | block_or_refuse | .planning/current/conflicts/host-state-root.json | host support state | historical record only | low | remove_after_cutover | completed_m11 | `~/.nexus` is the active host state root; `~/.gstack` is no longer read by active helpers |
| gstack-developer-substrate-history | gstack | .gstack-worktrees, ~/.gstack-dev | former developer substrate roots | reject | verified | none | none | none | host only; historical only; no governed writeback | block_or_refuse | .planning/current/conflicts/host-developer-substrate.json | developer substrate roots | historical record only | low | remove_after_cutover | completed_m11 | `.nexus-worktrees` and `~/.nexus-dev` are the only active developer substrate roots |
