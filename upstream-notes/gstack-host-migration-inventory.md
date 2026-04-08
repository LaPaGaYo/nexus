# Gstack Host Migration Inventory

Milestone 9 cutover state:

- Nexus-primary host roots and helpers are now the default surface.
- `~/.nexus` is the primary host support state root.
- `~/.gstack`, `.gstack-worktrees`, `~/.gstack-dev`, and `gstack-*` remain compatibility-only substrate.

## Milestone 10 compatibility budget

- `removed_from_active_path`: `bin/gstack-patch-names`, `bin/gstack-diff-scope`, `bin/gstack-platform-detect`, `bin/gstack-open-url`, `bin/gstack-extension`, `gstack-upgrade`
- `retained_compatibility_shim`: `bin/gstack-config`, `bin/gstack-relink`, `bin/gstack-uninstall`, `bin/gstack-update-check`
- `deferred_final_removal`: `~/.gstack`, `.gstack-worktrees`, `~/.gstack-dev`, `repository remote naming`

`removed_from_active_path` surfaces are no longer part of the primary Nexus product
surface. `retained_compatibility_shim` surfaces remain boundary-only shims, and
`deferred_final_removal` surfaces stay deferred cleanup targets until the final
compatibility removal milestone.

| inventory_id | source_system | source_path_or_ref | capability_or_structure | classification | milestone_state | canonical_nexus_commands | nexus_adapter_seams | governed_artifact_boundaries | normalization_required | conflict_policy | conflict_artifact_paths | host_structure | current_host_role | truth_risk | host_disposition | cleanup_phase | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gstack-skill-shell | gstack | top-level command directories | generated skill shell | adapt | verified | discover, frame, plan, handoff, build, review, qa, ship, closeout | none | none | host only; no governed writeback | block_or_refuse | .planning/current/conflicts/host-skill-shell.json | top-level command wrappers | shell entrypoint | medium | retain_as_host | post-m8 | wrapper shell remains, but visible lifecycle meaning and primary roots are now Nexus-owned |
| gstack-scripts-routing | gstack | scripts/resolvers/preamble.ts | host routing preamble | adapt | integrating | discover, frame, plan, handoff, build, review, qa, ship, closeout | none | none | host only; alias routing must terminate in lib/nexus | block_or_refuse | .planning/current/conflicts/host-routing.json | resolver preamble | wrapper dispatch | medium | retain_until_adapter_stable | post-m8 | preamble copy is Nexus-primary and generated host assets resolve through nexus roots; the resolver substrate still lives in host code |
| gstack-setup-surface | gstack | setup | install and relink shell | adapt | verified | discover, frame, plan, handoff, build, review, qa, ship, closeout | none | none | host only; setup cannot define lifecycle truth | block_or_refuse | .planning/current/conflicts/host-setup-surface.json | install/setup shell | compatibility installer | low | retain_until_adapter_stable | post-m8 | setup now prefers `~/.claude/skills/nexus`, `~/.codex/skills/nexus`, `.agents/skills/nexus`, and `~/.factory/skills/nexus*`; `nexus-config` is the active helper path; gstack paths remain compatibility-only |
| gstack-helper-entrypoints | gstack | bin/gstack-config, bin/gstack-relink, bin/gstack-uninstall, bin/gstack-update-check | compatibility host helper scripts | adapt | verified | none | none | none | helpers only; no governed writeback | block_or_refuse | .planning/current/conflicts/host-helper-entrypoints.json | helper binaries | compatibility helper substrate | low | retain_until_adapter_stable | post-m8 | `nexus-*` host helpers are the preferred entrypoints; `gstack-*` binaries are shim wrappers only |
| gstack-state-root | gstack | ~/.gstack | legacy host support state root | adapt | verified | none | none | none | host only; no governed writeback; compatibility fallback only | block_or_refuse | .planning/current/conflicts/host-state-root.json | host support state | compatibility state substrate | medium | retain_until_adapter_stable | post-m8 | `~/.nexus` is primary for host support state; `~/.gstack` remains compatibility-only until a later cleanup milestone |
| gstack-developer-substrate | gstack | .gstack-worktrees, ~/.gstack-dev | legacy developer substrate roots | adapt | verified | none | none | none | host only; no governed writeback; read/cleanup fallback only | block_or_refuse | .planning/current/conflicts/host-developer-substrate.json | developer substrate roots | compatibility worktree and eval substrate | low | retain_until_adapter_stable | post-m8 | `.nexus-worktrees` and `~/.nexus-dev` are primary for worktree, harvest, and eval scratch state; legacy developer roots remain cleanup and compatibility read fallbacks only |
