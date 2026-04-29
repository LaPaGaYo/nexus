# Nexus Runtime Facades

This directory is a navigation facade for repo taxonomy v2.

Active runtime source paths remain:

- `runtimes/browse/`
- `runtimes/design/`
- `design-html/`
- `careful/`
- `freeze/`

Do not execute or import runtime code from `runtimes/` unless the taxonomy
contract marks that path as migrated. `runtimes/browse/` and
`runtimes/design/` are migrated. Installed compatibility paths under
`$NEXUS_ROOT/...` remain authoritative.
