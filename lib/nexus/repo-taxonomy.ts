import { existsSync } from 'fs';
import { join } from 'path';

export type RepoTaxonomyCategory =
  | 'skills'
  | 'runtimes'
  | 'references'
  | 'lib'
  | 'hosts'
  | 'vendor'
  | 'bin'
  | 'scripts'
  | 'docs'
  | 'test';

export type RepoPathInventoryCategory = RepoTaxonomyCategory | 'root' | 'ci';
export type RepoMovePolicy = 'keep_in_place' | 'compat_required' | 'future_move';
export type RepoRiskLevel = 'low' | 'medium' | 'high';

export type RepoTaxonomyCategorySpec = {
  root: string;
  description: string;
  children?: string[];
};

export type RepoTaxonomyEntry = {
  name: string;
  category: RepoTaxonomyCategory;
  current_path: string;
  target_path: string;
  move_policy: RepoMovePolicy;
  risk_level: RepoRiskLevel;
  rationale: string;
  runtime_compat_paths?: string[];
};

export type ReferenceCompatMapping = {
  compat_path: string;
  future_source_path: string;
  current_source_path: string;
  kind: 'file' | 'directory';
};

export type RepoTaxonomyFacade = {
  facade_path: string;
  category: RepoTaxonomyCategory;
  kind: 'navigation_only';
  active_source_paths: string[];
  guarded_future_paths?: string[];
  note: string;
};

export type RepoPathClassification = {
  current_path: string;
  category: RepoPathInventoryCategory;
  target_path: string;
  move_policy: RepoMovePolicy;
  risk_level: RepoRiskLevel;
  rule: string;
  rationale: string;
};

export const REPO_TAXONOMY_CATEGORIES: Record<RepoTaxonomyCategory, RepoTaxonomyCategorySpec> = {
  skills: {
    root: 'skills',
    description: 'Generated and source skill surfaces, organized by lifecycle role.',
    children: ['root', 'canonical', 'support', 'safety', 'aliases'],
  },
  runtimes: {
    root: 'runtimes',
    description: 'Executable browser, design, and helper runtimes used by Nexus skills.',
    children: ['browse', 'design', 'design-html', 'safety'],
  },
  references: {
    root: 'references',
    description: 'Lazy-loaded checklists, templates, and methodology sidecars.',
    children: ['review', 'qa', 'design', 'cso'],
  },
  lib: {
    root: 'lib',
    description: 'Nexus runtime core, commands, adapters, advisors, ledger, and schemas.',
    children: ['nexus'],
  },
  hosts: {
    root: 'hosts',
    description: 'Host-specific generated surfaces and installation targets.',
    children: ['claude', 'codex', 'gemini-cli', 'factory', 'kiro'],
  },
  vendor: {
    root: 'vendor',
    description: 'Absorbed upstream snapshots and upstream maintenance metadata.',
    children: ['upstream', 'upstream-notes'],
  },
  bin: {
    root: 'bin',
    description: 'Stable executable entrypoints and maintainer helper binaries.',
  },
  scripts: {
    root: 'scripts',
    description: 'Repository maintenance scripts, generators, and resolvers.',
  },
  docs: {
    root: 'docs',
    description: 'Architecture, release, design, and maintainer documentation.',
  },
  test: {
    root: 'test',
    description: 'Nexus runtime, skill, maintainer, and taxonomy tests.',
  },
};

export const REPO_TAXONOMY_ENTRIES: RepoTaxonomyEntry[] = [
  {
    name: 'root-skill',
    category: 'skills',
    current_path: 'skills/root/nexus/SKILL.md.tmpl',
    target_path: 'skills/root/nexus/SKILL.md.tmpl',
    move_policy: 'keep_in_place',
    risk_level: 'low',
    rationale: 'The root /nexus source template now lives in the skills/root taxonomy while the root generated mirror preserves install compatibility.',
  },
  {
    name: 'root-skill-generated',
    category: 'skills',
    current_path: 'SKILL.md',
    target_path: 'skills/root/nexus/SKILL.md',
    move_policy: 'compat_required',
    risk_level: 'medium',
    rationale: 'The generated root /nexus skill is mirrored at repo root for legacy Claude install compatibility.',
  },
  {
    name: 'skills',
    category: 'skills',
    current_path: 'skills',
    target_path: 'skills',
    move_policy: 'keep_in_place',
    risk_level: 'low',
    rationale: 'Canonical, support, safety, and alias skill source templates already live in the target taxonomy.',
  },
  {
    name: 'browse',
    category: 'runtimes',
    current_path: 'browse',
    target_path: 'runtimes/browse',
    move_policy: 'future_move',
    risk_level: 'high',
    rationale: 'Browse is compiled, installed, referenced by setup, and used by many tests; moving it requires compatibility symlinks and generator updates.',
    runtime_compat_paths: ['$NEXUS_ROOT/browse/dist', '$NEXUS_ROOT/browse/bin'],
  },
  {
    name: 'design',
    category: 'runtimes',
    current_path: 'design',
    target_path: 'runtimes/design',
    move_policy: 'future_move',
    risk_level: 'high',
    rationale: 'Design owns a compiled runtime plus reference sidecars currently installed under $NEXUS_ROOT/design.',
    runtime_compat_paths: ['$NEXUS_ROOT/design/dist', '$NEXUS_ROOT/design/references'],
  },
  {
    name: 'design-references',
    category: 'references',
    current_path: 'design/references',
    target_path: 'references/design',
    move_policy: 'compat_required',
    risk_level: 'high',
    rationale: 'Design methodology sidecars are reference material, but installed design skills still load them from $NEXUS_ROOT/design/references.',
    runtime_compat_paths: ['$NEXUS_ROOT/design/references'],
  },
  {
    name: 'design-html',
    category: 'runtimes',
    current_path: 'design-html',
    target_path: 'runtimes/design-html',
    move_policy: 'future_move',
    risk_level: 'medium',
    rationale: 'The remaining design-html root stores runtime vendor assets after the skill source moved under skills/support.',
    runtime_compat_paths: ['$NEXUS_ROOT/design-html/vendor'],
  },
  {
    name: 'browse-extension',
    category: 'runtimes',
    current_path: 'extension',
    target_path: 'runtimes/browse/extension',
    move_policy: 'compat_required',
    risk_level: 'medium',
    rationale: 'The Chrome side panel extension is part of the browse runtime, but setup and launch helpers still expect $NEXUS_ROOT/extension.',
    runtime_compat_paths: ['$NEXUS_ROOT/extension/manifest.json'],
  },
  {
    name: 'careful',
    category: 'runtimes',
    current_path: 'careful',
    target_path: 'runtimes/safety/careful',
    move_policy: 'compat_required',
    risk_level: 'medium',
    rationale: 'Careful keeps hook helper binaries that must stay discoverable by installed safety skills.',
    runtime_compat_paths: ['$NEXUS_ROOT/careful/bin/check-careful.sh'],
  },
  {
    name: 'freeze',
    category: 'runtimes',
    current_path: 'freeze',
    target_path: 'runtimes/safety/freeze',
    move_policy: 'compat_required',
    risk_level: 'medium',
    rationale: 'Freeze keeps hook helper binaries that must stay discoverable by installed safety skills.',
    runtime_compat_paths: ['$NEXUS_ROOT/freeze/bin/check-freeze.sh'],
  },
  {
    name: 'review',
    category: 'references',
    current_path: 'review',
    target_path: 'references/review',
    move_policy: 'compat_required',
    risk_level: 'high',
    rationale: 'Review checklists and specialists are lazy-loaded by generated skills through $NEXUS_ROOT/review paths.',
    runtime_compat_paths: [
      '$NEXUS_ROOT/review/checklist.md',
      '$NEXUS_ROOT/review/design-checklist.md',
      '$NEXUS_ROOT/review/greptile-triage.md',
      '$NEXUS_ROOT/review/specialists/testing.md',
    ],
  },
  {
    name: 'qa',
    category: 'references',
    current_path: 'qa',
    target_path: 'references/qa',
    move_policy: 'compat_required',
    risk_level: 'high',
    rationale: 'QA templates and issue taxonomy are referenced by QA and QA-only flows.',
    runtime_compat_paths: [
      '$NEXUS_ROOT/qa/templates/qa-report-template.md',
      '$NEXUS_ROOT/qa/references/issue-taxonomy.md',
    ],
  },
  {
    name: 'cso',
    category: 'references',
    current_path: 'cso',
    target_path: 'references/cso',
    move_policy: 'compat_required',
    risk_level: 'medium',
    rationale: 'CSO acknowledgement/reference assets should move with reference material, while installed paths remain compatible.',
    runtime_compat_paths: ['$NEXUS_ROOT/cso/ACKNOWLEDGEMENTS.md'],
  },
  {
    name: 'lib-nexus',
    category: 'lib',
    current_path: 'lib/nexus',
    target_path: 'lib/nexus',
    move_policy: 'keep_in_place',
    risk_level: 'low',
    rationale: 'The runtime core is already in the intended lib/nexus location.',
  },
  {
    name: 'lib',
    category: 'lib',
    current_path: 'lib',
    target_path: 'lib',
    move_policy: 'keep_in_place',
    risk_level: 'low',
    rationale: 'Shared library helpers remain in the top-level lib root next to lib/nexus.',
  },
  {
    name: 'claude-host',
    category: 'hosts',
    current_path: '.claude',
    target_path: 'hosts/claude',
    move_policy: 'future_move',
    risk_level: 'medium',
    rationale: 'Claude project rules are host-specific, but current setup expects the .claude directory.',
  },
  {
    name: 'codex-host',
    category: 'hosts',
    current_path: '.agents',
    target_path: 'hosts/codex',
    move_policy: 'future_move',
    risk_level: 'medium',
    rationale: 'Codex host skill output is currently generated under .agents for compatibility with existing installs.',
  },
  {
    name: 'codex-openai-metadata',
    category: 'hosts',
    current_path: 'agents/openai.yaml',
    target_path: 'hosts/codex/openai.yaml',
    move_policy: 'future_move',
    risk_level: 'low',
    rationale: 'OpenAI/Codex metadata belongs with the Codex host surface, but the current setup still reads the agents/openai.yaml compatibility path.',
  },
  {
    name: 'gemini-cli-host',
    category: 'hosts',
    current_path: '.gemini',
    target_path: 'hosts/gemini-cli',
    move_policy: 'future_move',
    risk_level: 'medium',
    rationale: 'Gemini CLI host skill output is currently generated under .gemini for compatibility with Gemini CLI skill discovery.',
  },
  {
    name: 'factory-host',
    category: 'hosts',
    current_path: '.factory',
    target_path: 'hosts/factory',
    move_policy: 'future_move',
    risk_level: 'medium',
    rationale: 'Factory host output is currently generated under .factory for compatibility with existing installs.',
  },
  {
    name: 'upstream',
    category: 'vendor',
    current_path: 'upstream',
    target_path: 'vendor/upstream',
    move_policy: 'future_move',
    risk_level: 'medium',
    rationale: 'Absorbed upstream snapshots are vendor material, but upstream refresh tests and scripts still expect the current root.',
  },
  {
    name: 'upstream-notes',
    category: 'vendor',
    current_path: 'upstream-notes',
    target_path: 'vendor/upstream-notes',
    move_policy: 'future_move',
    risk_level: 'medium',
    rationale: 'Absorption metadata belongs with vendor material, but maintainer checks still read the current root.',
  },
  {
    name: 'bin',
    category: 'bin',
    current_path: 'bin',
    target_path: 'bin',
    move_policy: 'keep_in_place',
    risk_level: 'low',
    rationale: 'Executable entrypoints are already in the intended top-level command root.',
  },
  {
    name: 'scripts',
    category: 'scripts',
    current_path: 'scripts',
    target_path: 'scripts',
    move_policy: 'keep_in_place',
    risk_level: 'low',
    rationale: 'Repository maintenance scripts are already in the intended top-level script root.',
  },
  {
    name: 'docs',
    category: 'docs',
    current_path: 'docs',
    target_path: 'docs',
    move_policy: 'keep_in_place',
    risk_level: 'low',
    rationale: 'Documentation is already in the intended top-level docs root.',
  },
  {
    name: 'test',
    category: 'test',
    current_path: 'test',
    target_path: 'test',
    move_policy: 'keep_in_place',
    risk_level: 'low',
    rationale: 'Tests are already in the intended top-level test root.',
  },
];

export const REFERENCE_COMPAT_MAPPINGS: ReferenceCompatMapping[] = [
  {
    compat_path: 'review/checklist.md',
    future_source_path: 'references/review/checklist.md',
    current_source_path: 'review/checklist.md',
    kind: 'file',
  },
  {
    compat_path: 'review/design-checklist.md',
    future_source_path: 'references/review/design-checklist.md',
    current_source_path: 'review/design-checklist.md',
    kind: 'file',
  },
  {
    compat_path: 'review/greptile-triage.md',
    future_source_path: 'references/review/greptile-triage.md',
    current_source_path: 'review/greptile-triage.md',
    kind: 'file',
  },
  {
    compat_path: 'review/TODOS-format.md',
    future_source_path: 'references/review/TODOS-format.md',
    current_source_path: 'review/TODOS-format.md',
    kind: 'file',
  },
  {
    compat_path: 'review/specialists',
    future_source_path: 'references/review/specialists',
    current_source_path: 'review/specialists',
    kind: 'directory',
  },
  {
    compat_path: 'qa/templates',
    future_source_path: 'references/qa/templates',
    current_source_path: 'qa/templates',
    kind: 'directory',
  },
  {
    compat_path: 'qa/references',
    future_source_path: 'references/qa/references',
    current_source_path: 'qa/references',
    kind: 'directory',
  },
  {
    compat_path: 'design/references',
    future_source_path: 'references/design',
    current_source_path: 'design/references',
    kind: 'directory',
  },
  {
    compat_path: 'cso/ACKNOWLEDGEMENTS.md',
    future_source_path: 'references/cso/ACKNOWLEDGEMENTS.md',
    current_source_path: 'cso/ACKNOWLEDGEMENTS.md',
    kind: 'file',
  },
];

export const REPO_TAXONOMY_FACADES: RepoTaxonomyFacade[] = [
  {
    facade_path: 'runtimes/README.md',
    category: 'runtimes',
    kind: 'navigation_only',
    active_source_paths: ['browse', 'design', 'design-html', 'careful', 'freeze'],
    note: 'Runtime facade root. Existing runtime roots remain executable source of truth.',
  },
  {
    facade_path: 'runtimes/browse.md',
    category: 'runtimes',
    kind: 'navigation_only',
    active_source_paths: ['browse'],
    guarded_future_paths: ['runtimes/browse'],
    note: 'Browse runtime facade. Do not create runtimes/browse until setup and runtime resolvers are migrated.',
  },
  {
    facade_path: 'runtimes/design.md',
    category: 'runtimes',
    kind: 'navigation_only',
    active_source_paths: ['design'],
    guarded_future_paths: ['runtimes/design'],
    note: 'Design runtime facade. Do not create runtimes/design until compiled runtime and references are migrated together.',
  },
  {
    facade_path: 'runtimes/design-html.md',
    category: 'runtimes',
    kind: 'navigation_only',
    active_source_paths: ['design-html'],
    guarded_future_paths: ['runtimes/design-html'],
    note: 'Design HTML runtime facade. Vendor assets stay under design-html until resolver compatibility is updated.',
  },
  {
    facade_path: 'runtimes/safety.md',
    category: 'runtimes',
    kind: 'navigation_only',
    active_source_paths: ['careful', 'freeze'],
    guarded_future_paths: ['runtimes/safety/careful', 'runtimes/safety/freeze'],
    note: 'Safety runtime facade. Hook helper binaries stay under careful/ and freeze/ for installed skill compatibility.',
  },
  {
    facade_path: 'references/README.md',
    category: 'references',
    kind: 'navigation_only',
    active_source_paths: ['review', 'qa', 'design/references', 'cso'],
    note: 'Reference facade root. Do not place real installable assets here until setup compatibility is migrated.',
  },
  {
    facade_path: 'references/review/README.md',
    category: 'references',
    kind: 'navigation_only',
    active_source_paths: ['review'],
    guarded_future_paths: [
      'references/review/checklist.md',
      'references/review/design-checklist.md',
      'references/review/greptile-triage.md',
      'references/review/TODOS-format.md',
      'references/review/specialists',
    ],
    note: 'Review reference facade. Concrete checklists and specialists stay in review/ for installed compatibility.',
  },
  {
    facade_path: 'references/qa/README.md',
    category: 'references',
    kind: 'navigation_only',
    active_source_paths: ['qa'],
    guarded_future_paths: ['references/qa/templates', 'references/qa/references'],
    note: 'QA reference facade. Templates and issue taxonomy stay in qa/ until setup switches deliberately.',
  },
  {
    facade_path: 'references/design.md',
    category: 'references',
    kind: 'navigation_only',
    active_source_paths: ['design/references'],
    guarded_future_paths: ['references/design'],
    note: 'Design reference facade. It is intentionally a file, not references/design/, because setup treats that directory as a real future source.',
  },
  {
    facade_path: 'references/cso/README.md',
    category: 'references',
    kind: 'navigation_only',
    active_source_paths: ['cso'],
    guarded_future_paths: ['references/cso/ACKNOWLEDGEMENTS.md'],
    note: 'CSO reference facade. Acknowledgement assets stay in cso/ until compatibility links are migrated.',
  },
  {
    facade_path: 'hosts/README.md',
    category: 'hosts',
    kind: 'navigation_only',
    active_source_paths: ['CLAUDE.md', '.claude', '.agents', '.gemini', '.factory'],
    note: 'Host facade root. Generated host output remains in current discovery roots.',
  },
  {
    facade_path: 'hosts/claude/README.md',
    category: 'hosts',
    kind: 'navigation_only',
    active_source_paths: ['CLAUDE.md', '.claude'],
    note: 'Claude host facade. CLAUDE.md and .claude remain the active Claude host surface.',
  },
  {
    facade_path: 'hosts/codex/README.md',
    category: 'hosts',
    kind: 'navigation_only',
    active_source_paths: ['.agents'],
    note: 'Codex host facade. .agents remains the active Codex host surface.',
  },
  {
    facade_path: 'hosts/gemini-cli/README.md',
    category: 'hosts',
    kind: 'navigation_only',
    active_source_paths: ['.gemini'],
    note: 'Gemini CLI host facade. .gemini remains the active Gemini CLI host surface.',
  },
  {
    facade_path: 'hosts/factory/README.md',
    category: 'hosts',
    kind: 'navigation_only',
    active_source_paths: ['.factory'],
    note: 'Factory host facade. .factory remains the active Factory host surface.',
  },
];

const ROOT_FILES = new Set([
  '.env.example',
  '.gitignore',
  'AGENTS.md',
  'ARCHITECTURE.md',
  'BROWSER.md',
  'CHANGELOG.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'DESIGN.md',
  'ETHOS.md',
  'LICENSE',
  'README.md',
  'TODOS.md',
  'VERSION',
  'bun.lock',
  'conductor.json',
  'package.json',
  'release.json',
  'setup',
]);

function normalizeRepoPath(repoPath: string): string {
  return repoPath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function appendTargetSuffix(currentPath: string, currentRoot: string, targetRoot: string): string {
  if (currentPath === currentRoot) return targetRoot;
  return `${targetRoot}/${currentPath.slice(currentRoot.length + 1)}`;
}

function entryMatchesPath(entry: RepoTaxonomyEntry, repoPath: string): boolean {
  return repoPath === entry.current_path || repoPath.startsWith(`${entry.current_path}/`);
}

export function classifyRepoPath(repoPath: string): RepoPathClassification {
  const normalized = normalizeRepoPath(repoPath);

  const matchingEntry = [...REPO_TAXONOMY_ENTRIES]
    .filter((entry) => entryMatchesPath(entry, normalized))
    .sort((a, b) => b.current_path.length - a.current_path.length)[0];

  if (matchingEntry) {
    return {
      current_path: normalized,
      category: matchingEntry.category,
      target_path: appendTargetSuffix(normalized, matchingEntry.current_path, matchingEntry.target_path),
      move_policy: matchingEntry.move_policy,
      risk_level: matchingEntry.risk_level,
      rule: matchingEntry.name,
      rationale: matchingEntry.rationale,
    };
  }

  if (normalized === 'actionlint.yaml' || normalized.startsWith('.github/')) {
    return {
      current_path: normalized,
      category: 'ci',
      target_path: normalized,
      move_policy: 'keep_in_place',
      risk_level: 'low',
      rule: 'ci-surface',
      rationale: 'GitHub and actionlint configuration use tool-defined paths and should remain in place.',
    };
  }

  if (normalized.startsWith('runtimes/') || normalized.startsWith('references/') || normalized.startsWith('hosts/')) {
    const category = normalized.split('/')[0] as 'runtimes' | 'references' | 'hosts';
    return {
      current_path: normalized,
      category,
      target_path: normalized,
      move_policy: 'keep_in_place',
      risk_level: 'low',
      rule: `${category}-facade`,
      rationale: 'Navigation facade files already live in the intended taxonomy path.',
    };
  }

  if (ROOT_FILES.has(normalized)) {
    return {
      current_path: normalized,
      category: 'root',
      target_path: normalized,
      move_policy: 'keep_in_place',
      risk_level: 'low',
      rule: 'root-project-metadata',
      rationale: 'Project metadata, entry documentation, and package manifests stay at the repository root.',
    };
  }

  throw new Error(`No repo taxonomy classification for path: ${normalized}`);
}

export function plannedTopLevelRoots(): string[] {
  return [
    REPO_TAXONOMY_CATEGORIES.skills.root,
    REPO_TAXONOMY_CATEGORIES.runtimes.root,
    REPO_TAXONOMY_CATEGORIES.references.root,
    REPO_TAXONOMY_CATEGORIES.lib.root,
    REPO_TAXONOMY_CATEGORIES.hosts.root,
    REPO_TAXONOMY_CATEGORIES.vendor.root,
    REPO_TAXONOMY_CATEGORIES.bin.root,
    REPO_TAXONOMY_CATEGORIES.scripts.root,
    REPO_TAXONOMY_CATEGORIES.docs.root,
    REPO_TAXONOMY_CATEGORIES.test.root,
  ];
}

export function plannedFacadePaths(): string[] {
  return REPO_TAXONOMY_FACADES.map((facade) => facade.facade_path);
}

export function findRepoTaxonomyEntry(nameOrCurrentPath: string): RepoTaxonomyEntry | undefined {
  return REPO_TAXONOMY_ENTRIES.find((entry) =>
    entry.name === nameOrCurrentPath || entry.current_path === nameOrCurrentPath
  );
}

export function findRepoTaxonomyFacade(facadePath: string): RepoTaxonomyFacade | undefined {
  return REPO_TAXONOMY_FACADES.find((facade) => facade.facade_path === facadePath);
}

export function referenceCompatSourceCandidates(compatPath: string): string[] {
  const normalized = normalizeRepoPath(compatPath);
  const mapping = REFERENCE_COMPAT_MAPPINGS.find((entry) => entry.compat_path === normalized);
  if (!mapping) {
    throw new Error(`Unknown reference compatibility path: ${compatPath}`);
  }
  return [mapping.future_source_path, mapping.current_source_path];
}

export function resolveReferenceCompatSource(
  compatPath: string,
  repoRoot: string = process.cwd()
): string | null {
  for (const candidate of referenceCompatSourceCandidates(compatPath)) {
    if (existsSync(join(repoRoot, candidate))) {
      return candidate;
    }
  }
  return null;
}
