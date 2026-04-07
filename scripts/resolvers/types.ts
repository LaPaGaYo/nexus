export type Host = 'claude' | 'codex' | 'factory';

export interface HostPaths {
  skillRoot: string;
  localSkillRoot: string;
  binDir: string;
  browseDir: string;
  designDir: string;
}

export const HOST_PATHS: Record<Host, HostPaths> = {
  claude: {
    skillRoot: '~/.claude/skills/nexus',
    localSkillRoot: '.claude/skills/nexus',
    binDir: '~/.claude/skills/nexus/bin',
    browseDir: '~/.claude/skills/nexus/browse/dist',
    designDir: '~/.claude/skills/nexus/design/dist',
  },
  codex: {
    skillRoot: '$NEXUS_ROOT',
    localSkillRoot: '.agents/skills/nexus',
    binDir: '$NEXUS_BIN',
    browseDir: '$NEXUS_BROWSE',
    designDir: '$NEXUS_DESIGN',
  },
  factory: {
    skillRoot: '$NEXUS_ROOT',
    localSkillRoot: '.factory/skills/nexus',
    binDir: '$NEXUS_BIN',
    browseDir: '$NEXUS_BROWSE',
    designDir: '$NEXUS_DESIGN',
  },
};

export interface TemplateContext {
  skillName: string;
  tmplPath: string;
  benefitsFrom?: string[];
  host: Host;
  paths: HostPaths;
  preambleTier?: number;  // 1-4, controls which preamble sections are included
}

/** Resolver function signature. args is populated for parameterized placeholders like {{INVOKE_SKILL:name}}. */
export type ResolverFn = (ctx: TemplateContext, args?: string[]) => string;
