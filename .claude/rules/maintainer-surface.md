---
paths:
  - "CLAUDE.md"
  - "AGENTS.md"
  - "README.md"
  - "setup"
  - "bin/**"
  - "docs/**/*.md"
  - ".github/workflows/**"
  - "package.json"
  - "release.json"
  - "VERSION"
  - "test/**/*.ts"
  - "browse/**"
  - "design/**"
---

# Maintainer Surface Rules

- Keep Claude-facing behavior in `CLAUDE.md`; keep cross-project personal preferences in `~/.claude/CLAUDE.md`.
- Preserve multi-host support: Claude installs live under `.claude/skills/`; Codex sidecars live under `.agents/skills/`; other supported hosts keep their own install roots.
- Do not let Claude-facing docs or setup changes remove, rename, or demote Codex and Gemini sidecar/runtime roots.
- Nexus install and upgrade flows are release-based. Do not reintroduce `git pull`, `origin/main`, or `git reset --hard` instructions for managed installs.
- If documentation and runtime disagree, runtime contracts under `lib/nexus/` and repo-visible artifacts win.
- Do not commit platform-specific compiled binaries from `browse/dist/` or `design/dist/`; build them through setup or build scripts.
