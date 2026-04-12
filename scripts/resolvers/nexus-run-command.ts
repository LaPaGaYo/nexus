import type { TemplateContext } from './types';

function defaultRuntimeRoot(ctx: TemplateContext): string {
  switch (ctx.host) {
    case 'claude':
      return ctx.paths.skillRoot;
    case 'codex':
      return '${NEXUS_ROOT:-$HOME/.codex/skills/nexus}';
    case 'factory':
      return '${NEXUS_ROOT:-$HOME/.factory/skills/nexus}';
  }
}

export function generateNexusRunCommand(ctx: TemplateContext, args?: string[]): string {
  const command = args?.[0];
  if (!command || command === '') {
    throw new Error('{{NEXUS_RUN_COMMAND}} requires a command name, e.g. {{NEXUS_RUN_COMMAND:build}}');
  }

  return `_REPO_CWD="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
_NEXUS_ROOT="${defaultRuntimeRoot(ctx)}"
[ -d "$_REPO_CWD/${ctx.paths.localSkillRoot}" ] && _NEXUS_ROOT="$_REPO_CWD/${ctx.paths.localSkillRoot}"
cd "$_NEXUS_ROOT" && NEXUS_PROJECT_CWD="$_REPO_CWD" bun run bin/nexus.ts ${command}`;
}
