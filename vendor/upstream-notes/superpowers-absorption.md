# Superpowers Absorption Review

Nexus treats Superpowers as source material, not as a second command surface.
The current maintained Superpowers upstream reviewed for this note was
`obra/superpowers` at `6efe32c9e2dd002d0c394e861e0529675d1ab32e`; the vendored
Nexus snapshot remains pinned to `917e5f53b16b115b70a3a355ed5f4993b9f8b73d`
until the normal upstream refresh workflow imports a new snapshot.

## Absorbed Patterns

- Fresh verification evidence before completion claims maps to
  `.planning/current/<stage>/verification-evidence.json`.
- Test-first build discipline maps to
  `.planning/current/build/tdd-evidence.json`; it is evidence attached to
  `/build`, not a standalone lifecycle command.
- Two-stage implementation review maps to Nexus build and review orchestration:
  spec compliance must be settled before quality polish is treated as complete.
- External review reception maps to
  `.planning/current/review/review-feedback-triage.json`, where every review
  item is accepted, fixed, clarified, rejected with reason, or marked out of
  scope.
- Skill-trigger regression ideas map to Nexus advisor and routing tests rather
  than to Superpowers' global "invoke a skill before every response" rule.

## Intentionally Not Absorbed

- Nexus must not expose Superpowers skills as canonical commands.
- Nexus must not adopt a global skill-before-response rule; canonical lifecycle
  state and explicit user instructions remain higher priority.
- Nexus must not copy Superpowers hooks or marketplace packaging directly into
  runtime behavior. Codex plugin packaging can be evaluated separately as a
  distribution improvement.

## Current Upstream Delta

The live upstream adds Codex plugin packaging files and sync coverage after the
Nexus vendored snapshot:

- `.codex-plugin/plugin.json`
- `assets/app-icon.png`
- `assets/superpowers-small.svg`
- `scripts/sync-to-codex-plugin.sh`
- `tests/codex-plugin-sync/test-sync-to-codex-plugin.sh`

That delta is useful for discoverability, but it should enter Nexus through
release-channel-aware packaging work rather than by changing the governed
lifecycle.
