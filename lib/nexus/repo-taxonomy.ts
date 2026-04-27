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
    current_path: 'SKILL.md.tmpl',
    target_path: 'skills/root/nexus/SKILL.md.tmpl',
    move_policy: 'future_move',
    risk_level: 'medium',
    rationale: 'The root /nexus entrypoint remains at repo root until setup and docs can resolve a nested root skill template.',
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
    name: 'gemini-cli-host',
    category: 'hosts',
    current_path: 'N/A',
    target_path: 'hosts/gemini-cli',
    move_policy: 'future_move',
    risk_level: 'medium',
    rationale: 'Gemini CLI should be a first-class host target once host-specific generation exists.',
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

export function findRepoTaxonomyEntry(nameOrCurrentPath: string): RepoTaxonomyEntry | undefined {
  return REPO_TAXONOMY_ENTRIES.find((entry) =>
    entry.name === nameOrCurrentPath || entry.current_path === nameOrCurrentPath
  );
}
