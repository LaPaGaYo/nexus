# Nexus Runtime Facades

This directory is a navigation facade for repo taxonomy v2.

Active runtime source paths remain:

- `browse/`
- `runtimes/browse/extension/`
- `runtimes/design/`
- `design-html/`
- `careful/`
- `freeze/`

Do not execute or import runtime code from `runtimes/` unless the taxonomy
contract marks that path as migrated. `runtimes/browse/extension/` and
`runtimes/design/` are migrated; the rest of the browse runtime still lives at
`browse/`. Installed compatibility paths under `$NEXUS_ROOT/...` remain
authoritative.
