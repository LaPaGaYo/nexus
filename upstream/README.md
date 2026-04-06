# Upstream Source Imports

These directories are imported upstream source material for Nexus absorption work.

They are not runtime front doors, and they do not own governed lifecycle truth.

## Imported Sources

- `pm-skills`
  - repo: `https://github.com/deanpeters/Product-Manager-Skills.git`
  - pinned_commit: `4aa4196c14873b84f5af7316e7f66328cb6dee4c`
- `gsd`
  - repo: `https://github.com/gsd-build/get-shit-done.git`
  - pinned_commit: `caf337508fe9c84f4d1a0edb423b76b83f256e91`
- `superpowers`
  - repo: `https://github.com/obra/superpowers.git`
  - pinned_commit: `917e5f53b16b115b70a3a355ed5f4993b9f8b73d`
- `claude-code-bridge`
  - repo: `https://github.com/bfly123/claude_code_bridge.git`
  - pinned_commit: `2bb9a1b2f33ab258723de10412fd048690121bc2`

## Guardrails

- Only canonical Nexus commands may advance lifecycle stages.
- Only `lib/nexus/` and canonical `.planning/` artifacts may define governed truth.
- Imported upstream code may inform adapters, prompts, templates, and method extraction.
- Imported upstream code may not become a second command surface or write canonical stage state directly.
