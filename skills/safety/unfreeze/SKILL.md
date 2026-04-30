---
name: unfreeze
version: 0.1.0
description: |
  Clear the freeze boundary set by /freeze, allowing edits to all directories
  again. Use when you want to widen edit scope without ending the session.
  Use when asked to "unfreeze", "unlock edits", "remove freeze", or
  "allow all edits". (Nexus)
allowed-tools:
  - Bash
  - Read
sensitive: true
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /unfreeze — Clear Freeze Boundary

## Overview

This skill clears the session edit boundary created by `/freeze` or `/guard`.
It changes only the freeze state file; it does not disable other safety checks.

Remove the edit restriction set by `/freeze`, allowing edits to all directories.

## Workflow

1. Locate the freeze state directory.
2. If `freeze-dir.txt` exists, read the previous boundary for reporting.
3. Delete only `freeze-dir.txt`.
4. If no state file exists, report that no freeze boundary was active.
5. Tell the user whether edits are now unrestricted.

## Clear the boundary

```bash
STATE_DIR="${CLAUDE_PLUGIN_DATA:-$HOME/.nexus}"
if [ -f "$STATE_DIR/freeze-dir.txt" ]; then
  PREV=$(cat "$STATE_DIR/freeze-dir.txt")
  rm -f "$STATE_DIR/freeze-dir.txt"
  echo "Freeze boundary cleared (was: $PREV). Edits are now allowed everywhere."
else
  echo "No freeze boundary was set."
fi
```

Tell the user the result. Note that `/freeze` hooks are still registered for the
session — they will just allow everything since no state file exists. To re-freeze,
run `/freeze` again.

## Safety Boundaries

Do not remove any files except `freeze-dir.txt`. Do not claim `/careful` or other
session hooks were disabled; `/unfreeze` only clears the edit boundary.

## Output Contract

Return one of:

- `Freeze boundary cleared (was: <absolute-path>/). Edits are now allowed everywhere.`
- `No freeze boundary was set.`

Include the previous path when it existed so the user can audit what changed.

## Verification Evidence

After clearing, verify the state file is absent:

```bash
STATE_DIR="${CLAUDE_PLUGIN_DATA:-$HOME/.nexus}"
test ! -f "$STATE_DIR/freeze-dir.txt" && echo "FREEZE_CLEARED"
```

Do not report success until the file absence check succeeds or the command has
reported that no boundary was set.
