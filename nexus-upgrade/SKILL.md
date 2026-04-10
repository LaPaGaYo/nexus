---
name: nexus-upgrade
version: 1.1.0
description: |
  Upgrade Nexus from published release bundles. Use when asked to upgrade
  Nexus, update Nexus, or get the latest Nexus version.
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /nexus-upgrade

Upgrade Nexus to the latest published release and show what's new.

`/nexus-upgrade` follows the release contract resolved by `nexus-update-check`.
The installed version is the tagged Nexus release bundle for `v{version}`, not
branch head. Managed installs include both `managed_release` and
`managed_vendored`. The installer writes `.nexus-install.json`, and successful
upgrades record `just-upgraded.json` in the host update-state.

If the current project has a managed vendored install at `.claude/skills/nexus`
with `.nexus-install.json`, `/nexus-upgrade` targets that install. Otherwise it
targets the managed global install.

Set this once for the snippets below:
```bash
if [ -n "${NEXUS_DIR:-}" ]; then
  _NEXUS_DIR="$NEXUS_DIR"
else
  _ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd -P)
  if [ -f "$_ROOT/.claude/skills/nexus/.nexus-install.json" ]; then
    _NEXUS_DIR="$_ROOT/.claude/skills/nexus"
  else
    _NEXUS_DIR="${HOME:-}/.claude/skills/nexus"
  fi
fi
```

## Inline upgrade flow

This section is referenced by all skill preambles when they detect `UPGRADE_AVAILABLE`.

### Step 1: Ask the user, or auto-upgrade if enabled

First, check whether automatic upgrade is enabled:
```bash
_AUTO=""
[ "${NEXUS_AUTO_UPGRADE:-}" = "1" ] && _AUTO="true"
[ -z "$_AUTO" ] && _AUTO=$("$_NEXUS_DIR/bin/nexus-config" get auto_upgrade 2>/dev/null || true)
echo "AUTO_UPGRADE=$_AUTO"
```

If `AUTO_UPGRADE=true` or `AUTO_UPGRADE=1`, skip `AskUserQuestion`, log `Auto-upgrading Nexus v{old} -> v{new}...`, and proceed directly to Step 2.

Otherwise, ask:
- Question: `Nexus v{new} is available (you're on v{old}). Upgrade now?`
- Options: `["Yes, upgrade now", "Always keep me up to date", "Not now", "Never ask again"]`

If the user chooses `Yes, upgrade now`, proceed to Step 2.

If the user chooses `Always keep me up to date`:
```bash
"$_NEXUS_DIR/bin/nexus-config" set auto_upgrade true
```
Tell the user: `Auto-upgrade enabled. Future updates will install automatically.`

If the user chooses `Not now`, record snooze state with escalating backoff (24h, 48h, then 1 week) and continue with the current skill. Do not mention the upgrade again in this run.

If the user chooses `Never ask again`:
```bash
"$_NEXUS_DIR/bin/nexus-config" set update_check false
```
Tell the user: `Update checks disabled. Run "$_NEXUS_DIR/bin/nexus-config" set update_check true to re-enable.`

### Step 2: Install the approved release

Install the candidate release bundle through the Nexus-owned helper:
```bash
NEXUS_UPGRADE_TO_VERSION="{new}" \
NEXUS_UPGRADE_TO_TAG="v{new}" \
"$_NEXUS_DIR/bin/nexus-upgrade-install"
```

The helper resolves the candidate `release.json`, downloads the tagged tar.gz
bundle, backs up the current install, runs `./setup`, writes `.nexus-install.json`,
and clears stale update-state on success. It only accepts an already-managed
install with `.nexus-install.json`; legacy migration stays in Task 4.

### Step 3: Show what's new

Read the upgraded install's `CHANGELOG.md`. Summarize the entries between the
old version and the new version as 5-7 bullets grouped by theme. Focus on
user-facing changes.

Format:
```
Nexus v{new} — upgraded from v{old}!

What's new:
- [bullet 1]
- [bullet 2]
- ...

Happy shipping!
```

### Step 4: Continue

After showing what's new, continue with whatever skill the user originally invoked.

---

## Standalone usage

When invoked directly as `/nexus-upgrade`:

1. Force a fresh update check:
```bash
"$_NEXUS_DIR/bin/nexus-update-check" --force 2>/dev/null || \
"$_NEXUS_DIR/bin/nexus-update-check" --force 2>/dev/null || true
```

2. If the output is `UPGRADE_AVAILABLE <old> <new>`, follow Steps 1-4 above.

3. If there is no output, tell the user they are already on the latest version.
