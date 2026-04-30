# Vendor Material

This directory contains absorbed upstream source material and maintainer metadata.

Active source-of-truth paths:

- `vendor/upstream/` - pinned upstream source snapshots used for absorption traceability.
- `vendor/upstream-notes/` - locks, inventories, refresh candidates, and maintainer reports.

Compatibility paths:

- `upstream` -> `vendor/upstream`
- `upstream-notes` -> `vendor/upstream-notes`

The compatibility symlinks preserve old maintainer and manual paths. Runtime code,
maintainer scripts, tests, and generated reports should use the `vendor/` paths.

Imported upstream material is source material only. It does not own governed
lifecycle truth or define user-facing Nexus command behavior.
