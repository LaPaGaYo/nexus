# Nexus Host Facades

This directory is a navigation facade for repo taxonomy v2.

Active host source paths:

- `CLAUDE.md`
- `hosts/claude/rules/`
- `hosts/codex/openai.yaml`

Compatibility and generated output paths:

- `.claude/rules/` remains the Claude discovery compatibility surface.
- `agents/openai.yaml` remains the Codex root metadata compatibility path.
- `.agents/`, `.gemini/`, and `.factory/` remain generated host output roots.

The `hosts/` tree records the source-of-truth maintenance taxonomy without
breaking existing runtime discovery behavior.
