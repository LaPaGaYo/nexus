import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { planDesignContractPath } from './artifacts';

interface RepoDesignContextSource {
  path: 'DESIGN.md' | 'brand-spec.md';
  heading: string;
  content: string;
}

interface CanonicalWrite {
  path: string;
  content: string;
}

const DESIGN_CONTEXT_SOURCES: Array<Pick<RepoDesignContextSource, 'path' | 'heading'>> = [
  {
    path: 'DESIGN.md',
    heading: 'System-Level Design Rules',
  },
  {
    path: 'brand-spec.md',
    heading: 'Frozen Brand Truth',
  },
];

const MAX_SOURCE_CHARS = 2400;

function excerptDesignContext(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= MAX_SOURCE_CHARS) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_SOURCE_CHARS).trimEnd()}\n\n[truncated to ${MAX_SOURCE_CHARS} characters for canonical plan contract synthesis]`;
}

export function readRepoDesignContextSources(cwd: string): RepoDesignContextSource[] {
  const sources: RepoDesignContextSource[] = [];

  for (const source of DESIGN_CONTEXT_SOURCES) {
    const fullPath = join(cwd, source.path);
    if (!existsSync(fullPath)) {
      continue;
    }

    const content = readFileSync(fullPath, 'utf8').trim();
    if (!content) {
      continue;
    }

    sources.push({
      ...source,
      content,
    });
  }

  return sources;
}

export function synthesizePlanDesignContractFromRepoContext(cwd: string): CanonicalWrite | null {
  const sources = readRepoDesignContextSources(cwd);
  if (sources.length === 0) {
    return null;
  }

  const lines: string[] = [
    '# Design Contract',
    '',
    'This canonical design contract was synthesized from the repository design context because this run requires approved design guidance before handoff.',
    '',
    '## Sources',
    '',
    ...sources.map((source) => `- \`${source.path}\``),
  ];

  for (const source of sources) {
    lines.push(
      '',
      `## ${source.heading}`,
      '',
      `Source: \`${source.path}\``,
      '',
      excerptDesignContext(source.content),
    );
  }

  return {
    path: planDesignContractPath(),
    content: `${lines.join('\n').trimEnd()}\n`,
  };
}
