# Design Reference Facade

Active source: `design/references/`

Installed compatibility path:

- `$NEXUS_ROOT/design/references`

Planned target: `references/design`

This facade is intentionally a file, not a `references/design/` directory.
The setup script treats `references/design` as a real future source when it
exists, so creating that directory before migration would break installed
design reference links.

