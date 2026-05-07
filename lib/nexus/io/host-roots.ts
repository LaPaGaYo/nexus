import { join } from 'path';

export const PRIMARY_STATE_ROOT = '.nexus' as const;
export const NEXUS_STATE_ENV_VAR = 'NEXUS_STATE_DIR' as const;

export const PRIMARY_HOST_ROOTS = {
  claude_global: '~/.claude/skills/nexus',
  claude_local: '.claude/skills/nexus',
  codex_sidecar: '.agents/skills/nexus',
  codex_global: '~/.codex/skills/nexus',
  gemini_cli_global: '~/.gemini/skills/nexus',
  kiro_global: '~/.kiro/skills/nexus',
  factory_global: '~/.factory/skills/nexus',
} as const;

export type HostSkillInstallHost = 'claude' | 'codex' | 'gemini-cli' | 'factory';
export type HostSkillInstallScope = 'project' | 'home';

export interface HostSkillInstallRoot {
  readonly host: HostSkillInstallHost;
  readonly scope: HostSkillInstallScope;
  readonly path: string;
  readonly label: string;
  readonly generate_command: string | null;
}

export const HOST_SKILL_INSTALL_ROOTS = [
  { host: 'claude', scope: 'project', path: '.claude/skills', label: 'Claude project skills', generate_command: 'bun run gen:skill-docs' },
  { host: 'codex', scope: 'project', path: '.agents/skills', label: 'Codex skills', generate_command: 'bun run gen:skill-docs --host codex' },
  { host: 'gemini-cli', scope: 'project', path: '.gemini/skills', label: 'Gemini CLI skills', generate_command: 'bun run gen:skill-docs --host gemini-cli' },
  { host: 'factory', scope: 'project', path: '.factory/skills', label: 'Factory skills', generate_command: 'bun run gen:skill-docs --host factory' },
  { host: 'claude', scope: 'home', path: '.claude/skills', label: 'Claude home skills', generate_command: null },
  { host: 'codex', scope: 'home', path: '.codex/skills', label: 'Codex home skills', generate_command: null },
  { host: 'codex', scope: 'home', path: '.agents/skills', label: 'Codex sidecar home skills', generate_command: null },
  { host: 'gemini-cli', scope: 'home', path: '.gemini/skills', label: 'Gemini CLI home skills', generate_command: null },
  { host: 'factory', scope: 'home', path: '.factory/skills', label: 'Factory home skills', generate_command: null },
] as const satisfies readonly HostSkillInstallRoot[];

export const PROJECT_HOST_SKILL_INSTALL_ROOTS = HOST_SKILL_INSTALL_ROOTS.filter(
  (root) => root.scope === 'project',
);

export function hostSkillInstallRootPaths(cwd: string, homeDir: string): string[] {
  return HOST_SKILL_INSTALL_ROOTS.map((root) =>
    join(root.scope === 'project' ? cwd : homeDir, root.path)
  );
}

export function projectHostSkillInstallRoot(host: HostSkillInstallHost): HostSkillInstallRoot {
  const root = PROJECT_HOST_SKILL_INSTALL_ROOTS.find((candidate) => candidate.host === host);
  if (!root) {
    throw new Error(`No project skill install root registered for host: ${host}`);
  }
  return root;
}

export type HostStateResolutionSource =
  | 'env:nexus'
  | 'existing:nexus'
  | 'init:nexus';

export type ResolveHostStateRootInput = {
  env: Partial<Record<typeof NEXUS_STATE_ENV_VAR, string | undefined>>;
  homeDir: string;
  nexusStateExists: boolean;
};

export type ResolveHostStateRootResult = {
  root: string;
  source: HostStateResolutionSource;
  migration_from: string | null;
};

export function getPrimaryStatePath(homeDir: string): string {
  return join(homeDir, PRIMARY_STATE_ROOT);
}

export function resolveHostStateRoot({
  env,
  homeDir,
  nexusStateExists,
}: ResolveHostStateRootInput): ResolveHostStateRootResult {
  const primaryStatePath = getPrimaryStatePath(homeDir);
  const nexusOverride = env[NEXUS_STATE_ENV_VAR];

  if (nexusOverride) {
    return {
      root: nexusOverride,
      source: 'env:nexus',
      migration_from: null,
    };
  }

  if (nexusStateExists) {
    return {
      root: primaryStatePath,
      source: 'existing:nexus',
      migration_from: null,
    };
  }

  return {
    root: primaryStatePath,
    source: 'init:nexus',
    migration_from: null,
  };
}
