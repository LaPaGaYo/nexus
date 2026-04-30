import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  frameDesignIntentPath,
  planVerificationMatrixPath,
  qaDesignVerificationPath,
  qaReportPath,
  shipChecklistPath,
  shipDeployReadinessPath,
  shipPullRequestPath,
  shipReleaseGateRecordPath,
  stageStatusPath,
} from './artifacts';
import {
  VERIFICATION_CHECKLIST_CATEGORIES,
  type DesignImpact,
  type DesignIntentRecord,
  type ReviewScopeMode,
  type VerificationChecklistCategory,
  type VerificationMatrixChecklistRecord,
  type VerificationMatrixChecklistRationaleRecord,
  type VerificationMatrixRecord,
  type VerificationMatrixSupportSkillSignalRecord,
} from './types';
import { isRecord, readJsonPartial, readJsonPartialOr } from './validation-helpers';

function defaultDesignIntent(): DesignIntentRecord {
  return {
    impact: 'none',
    affected_surfaces: [],
    design_system_source: 'none',
    contract_required: false,
    verification_required: false,
  };
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const strings = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  return strings.length > 0 ? strings : [...fallback];
}

function normalizeStringArrayAllowEmpty(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function normalizeDesignImpact(value: unknown): DesignImpact {
  return value === 'touchup' || value === 'material' ? value : 'none';
}

function normalizeReviewMode(value: unknown): ReviewScopeMode {
  return value === 'bounded_fix_cycle' ? 'bounded_fix_cycle' : 'full_acceptance';
}

const BROWSER_SURFACE_TOKENS = new Set([
  'app',
  'apps',
  'client',
  'component',
  'components',
  'frontend',
  'layout',
  'page',
  'pages',
  'route',
  'routes',
  'screen',
  'screens',
  'site',
  'ui',
  'view',
  'views',
  'web',
]);

const AUTH_SURFACE_TOKENS = new Set([
  'account',
  'auth',
  'clerk',
  'identity',
  'login',
  'middleware',
  'oauth',
  'session',
  'signup',
]);

const SECURITY_SURFACE_TOKENS = new Set([
  'admin',
  'auth',
  'clerk',
  'identity',
  'middleware',
  'oauth',
  'permission',
  'permissions',
  'rbac',
  'secret',
  'security',
  'server',
  'session',
  'token',
  'webhook',
]);

const BACKEND_SURFACE_TOKENS = new Set([
  'api',
  'backend',
  'database',
  'db',
  'handler',
  'migration',
  'repository',
  'server',
  'service',
  'services',
  'worker',
  'workers',
]);

const BROWSER_SURFACE_EXTENSIONS = new Set([
  'astro',
  'css',
  'html',
  'jsx',
  'scss',
  'svelte',
  'tsx',
  'vue',
]);

const BROWSER_ROOT_CANDIDATES = [
  'app',
  'apps/web',
  'client',
  'frontend',
  'pages',
  'routes',
  'site',
  'src/app',
  'src/components',
  'src/pages',
  'src/routes',
  'web',
] as const;

const AUTH_ROOT_CANDIDATES = [
  'api/auth',
  'app/api/auth',
  'auth',
  'lib/auth',
  'middleware.js',
  'middleware.ts',
  'server/auth',
  'src/auth',
  'src/lib/auth',
  'src/server/auth',
] as const;

const SECURITY_ROOT_CANDIDATES = [
  'api/admin',
  'app/api/admin',
  'app/api/webhooks',
  'middleware.js',
  'middleware.ts',
  'server',
  'src/app/api/webhooks',
  'src/server',
  'src/server/api',
  'webhooks',
] as const;

const BACKEND_ROOT_CANDIDATES = [
  'api',
  'db',
  'migrations',
  'packages/db',
  'server',
  'services',
  'src/api',
  'src/db',
  'src/server',
  'src/services',
  'worker',
  'workers',
] as const;

const BROWSER_FRAMEWORK_DEPENDENCIES = new Set([
  '@remix-run/react',
  'next',
  'react',
  'solid-js',
  'svelte',
  'vue',
]);

const AUTH_DEPENDENCIES = new Set([
  '@auth/core',
  '@clerk/nextjs',
  '@supabase/supabase-js',
  'auth0',
  'better-auth',
  'firebase',
  'next-auth',
  'passport',
]);

function surfaceTokens(surface: string): string[] {
  return surface
    .split(/[\/._-]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function filenameExtension(surface: string): string | null {
  const lastDot = surface.lastIndexOf('.');
  if (lastDot === -1 || lastDot === surface.length - 1) {
    return null;
  }

  return surface.slice(lastDot + 1).toLowerCase();
}

function surfaceHasAnyToken(surface: string, tokens: ReadonlySet<string>): boolean {
  return surfaceTokens(surface).some((token) => tokens.has(token));
}

function browserFacingSurface(surface: string): boolean {
  return surfaceHasAnyToken(surface, BROWSER_SURFACE_TOKENS)
    || BROWSER_SURFACE_EXTENSIONS.has(filenameExtension(surface) ?? '');
}

function authFacingSurface(surface: string): boolean {
  return surfaceHasAnyToken(surface, AUTH_SURFACE_TOKENS);
}

function securitySensitiveSurface(surface: string): boolean {
  return surfaceHasAnyToken(surface, SECURITY_SURFACE_TOKENS);
}

function backendFacingSurface(surface: string): boolean {
  return surfaceHasAnyToken(surface, BACKEND_SURFACE_TOKENS);
}

function repoHasAnyPath(cwd: string, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => existsSync(join(cwd, candidate)));
}

function collectPackageManifestPaths(dir: string, depth: number, output: string[]): void {
  if (depth < 0) {
    return;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.planning' || entry.name === 'dist' || entry.name === 'build') {
      continue;
    }

    const fullPath = join(dir, entry.name);
    if (entry.isFile() && entry.name === 'package.json') {
      output.push(fullPath);
      continue;
    }

    if (entry.isDirectory()) {
      collectPackageManifestPaths(fullPath, depth - 1, output);
    }
  }
}

function collectRepoDependencyNames(cwd: string): Set<string> {
  const manifestPaths: string[] = [];
  collectPackageManifestPaths(cwd, 3, manifestPaths);

  const dependencies = new Set<string>();
  for (const manifestPath of manifestPaths) {
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
      for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
        const record = parsed[field];
        if (!isRecord(record)) {
          continue;
        }
        for (const name of Object.keys(record)) {
          dependencies.add(name);
        }
      }
    } catch {
      continue;
    }
  }

  return dependencies;
}

function repoHasAnyDependency(
  dependencies: ReadonlySet<string>,
  candidates: ReadonlySet<string>,
): boolean {
  for (const dependency of dependencies) {
    if (candidates.has(dependency)) {
      return true;
    }
  }
  return false;
}

const CHECKLIST_DEFINITIONS: Record<VerificationChecklistCategory, {
  source_path: string;
  rationale: string;
  support_surfaces: string[];
}> = {
  testing: {
    source_path: 'references/review/specialists/testing.md',
    rationale: 'Testing checklist is always-on for negative paths, edge cases, isolation, and regression coverage.',
    support_surfaces: ['/browse', '/connect-chrome'],
  },
  security: {
    source_path: 'references/review/specialists/security.md',
    rationale: 'Security checklist applies to auth, authorization, backend, webhook, secret, and trust-boundary changes.',
    support_surfaces: ['/cso', '/setup-browser-cookies'],
  },
  maintainability: {
    source_path: 'references/review/specialists/maintainability.md',
    rationale: 'Maintainability checklist is always-on for complexity, readability, and behavior-preserving cleanup.',
    support_surfaces: ['/simplify'],
  },
  performance: {
    source_path: 'references/review/specialists/performance.md',
    rationale: 'Performance checklist applies to frontend or backend execution paths where rendering, query, bundle, or latency regressions are plausible.',
    support_surfaces: ['/benchmark'],
  },
  accessibility: {
    source_path: 'review/design-checklist.md',
    rationale: 'Accessibility checklist applies to browser-facing UI, keyboard focus, interaction states, and touch targets.',
    support_surfaces: ['/browse', '/connect-chrome', '/setup-browser-cookies', '/design-review'],
  },
  design: {
    source_path: 'review/design-checklist.md',
    rationale: 'Design checklist applies to design-bearing UI work and visual-system consistency.',
    support_surfaces: ['/design-review', '/plan-design-review'],
  },
};

function checklistRecord(
  category: VerificationChecklistCategory,
  applies: boolean,
  triggers: string[],
): VerificationMatrixChecklistRecord {
  const definition = CHECKLIST_DEFINITIONS[category];
  return {
    category,
    source_path: definition.source_path,
    applies,
    rationale: definition.rationale,
    triggers,
    support_surfaces: definition.support_surfaces,
  };
}

function checklistRationale(
  checklists: Record<VerificationChecklistCategory, VerificationMatrixChecklistRecord>,
  categories: VerificationChecklistCategory[],
): VerificationMatrixChecklistRationaleRecord[] {
  return categories
    .map((category) => checklists[category])
    .filter((checklist) => checklist.applies)
    .map((checklist) => ({
      category: checklist.category,
      source_path: checklist.source_path,
      rationale: checklist.rationale,
    }));
}

function renderChecklistBackedReason(
  baseReason: string,
  rationale: VerificationMatrixChecklistRationaleRecord[],
): string {
  if (rationale.length === 0) {
    return baseReason;
  }

  const rendered = rationale
    .map((entry) => `${entry.category} ${entry.source_path} - ${entry.rationale}`)
    .join('; ');
  return `${baseReason} Checklist-backed rationale: ${rendered}`;
}

function skillSignal(
  suggested: boolean,
  baseReason: string,
  rationale: VerificationMatrixChecklistRationaleRecord[],
): VerificationMatrixSupportSkillSignalRecord {
  return {
    suggested,
    reason: suggested ? renderChecklistBackedReason(baseReason, rationale) : null,
    checklist_rationale: suggested ? rationale : [],
  };
}

function buildDefaultVerificationMatrix(
  cwd: string,
  runId: string,
  generatedAt: string,
  designIntent: DesignIntentRecord,
  reviewMode: ReviewScopeMode,
): VerificationMatrixRecord {
  const designImpact = designIntent.impact;
  const verificationRequired = designIntent.verification_required;
  const qaRequired = verificationRequired || designImpact !== 'none';
  const designVerificationRequired = designImpact !== 'none';
  const repoDependencyNames = collectRepoDependencyNames(cwd);
  const browserFacing = designImpact !== 'none'
    || designIntent.affected_surfaces.some(browserFacingSurface)
    || repoHasAnyPath(cwd, BROWSER_ROOT_CANDIDATES)
    || repoHasAnyDependency(repoDependencyNames, BROWSER_FRAMEWORK_DEPENDENCIES);
  const authFacing = designIntent.affected_surfaces.some(authFacingSurface)
    || repoHasAnyPath(cwd, AUTH_ROOT_CANDIDATES)
    || repoHasAnyDependency(repoDependencyNames, AUTH_DEPENDENCIES);
  const securitySensitive = designIntent.affected_surfaces.some(securitySensitiveSurface)
    || repoHasAnyPath(cwd, SECURITY_ROOT_CANDIDATES)
    || repoHasAnyDependency(repoDependencyNames, AUTH_DEPENDENCIES);
  const backendFacing = designIntent.affected_surfaces.some(backendFacingSurface)
    || repoHasAnyPath(cwd, BACKEND_ROOT_CANDIDATES);
  const performanceSensitive = browserFacing || backendFacing;
  const checklists: Record<VerificationChecklistCategory, VerificationMatrixChecklistRecord> = {
    testing: checklistRecord('testing', true, ['always_on']),
    security: checklistRecord(
      'security',
      securitySensitive,
      [
        ...(authFacing ? ['auth_surface'] : []),
        ...(securitySensitive ? ['security_sensitive_surface'] : []),
      ],
    ),
    maintainability: checklistRecord('maintainability', true, ['always_on']),
    performance: checklistRecord(
      'performance',
      performanceSensitive,
      [
        ...(browserFacing ? ['browser_facing'] : []),
        ...(backendFacing ? ['backend_surface'] : []),
      ],
    ),
    accessibility: checklistRecord(
      'accessibility',
      browserFacing,
      [
        ...(browserFacing ? ['browser_facing'] : []),
        ...(designImpact !== 'none' ? ['design_impact'] : []),
      ],
    ),
    design: checklistRecord(
      'design',
      designImpact !== 'none',
      designImpact !== 'none' ? ['design_impact'] : [],
    ),
  };

  return {
    schema_version: 1,
    run_id: runId,
    generated_at: generatedAt,
    design_impact: designImpact,
    verification_required: verificationRequired,
    obligations: {
      build: {
        owner_stage: 'build',
        required: true,
        gate_affecting: true,
        expected_artifacts: [
          '.planning/current/build/build-result.md',
          stageStatusPath('build'),
        ],
      },
      review: {
        owner_stage: 'review',
        required: true,
        gate_affecting: true,
        mode: reviewMode,
        expected_artifacts: [
          '.planning/audits/current/codex.md',
          '.planning/audits/current/gemini.md',
          '.planning/audits/current/synthesis.md',
          '.planning/audits/current/gate-decision.md',
          '.planning/audits/current/meta.json',
          stageStatusPath('review'),
        ],
      },
      qa: {
        owner_stage: 'qa',
        required: qaRequired,
        gate_affecting: qaRequired,
        design_verification_required: designVerificationRequired,
        expected_artifacts: [
          qaReportPath(),
          stageStatusPath('qa'),
          ...(designVerificationRequired ? [qaDesignVerificationPath()] : []),
        ],
      },
      ship: {
        owner_stage: 'ship',
        required: true,
        gate_affecting: true,
        deploy_readiness_required: true,
        expected_artifacts: [
          shipReleaseGateRecordPath(),
          shipChecklistPath(),
          shipDeployReadinessPath(),
          shipPullRequestPath(),
          stageStatusPath('ship'),
        ],
      },
    },
    attached_evidence: {
      benchmark: {
        supported: true,
        required: false,
      },
      canary: {
        supported: true,
        required: false,
      },
      qa_only: {
        supported: true,
        required: false,
      },
    },
    checklists,
    support_skill_signals: {
      design_review: skillSignal(
        designImpact !== 'none',
        'Design-bearing work should expose `/design-review` as a first-class follow-on.',
        checklistRationale(checklists, ['design', 'accessibility']),
      ),
      browse: skillSignal(
        browserFacing,
        'Browser-facing surfaces changed, so `/browse` should be available from the advisor.',
        checklistRationale(checklists, ['testing', 'accessibility']),
      ),
      benchmark: skillSignal(
        performanceSensitive,
        'The verification matrix supports benchmark evidence for this run.',
        checklistRationale(checklists, ['performance']),
      ),
      simplify: skillSignal(
        true,
        'Maintainability review supports a behavior-preserving simplification pass when complexity advisories appear.',
        checklistRationale(checklists, ['maintainability']),
      ),
      cso: skillSignal(
        securitySensitive,
        'Auth, permission, webhook, or security-sensitive surfaces changed, so `/cso` should be available.',
        checklistRationale(checklists, ['security']),
      ),
      connect_chrome: skillSignal(
        browserFacing,
        'A browser-facing flow exists, so real-browser verification through `/connect-chrome` is available.',
        checklistRationale(checklists, ['testing', 'accessibility']),
      ),
      setup_browser_cookies: skillSignal(
        browserFacing && authFacing,
        'Authenticated browser verification is likely relevant, so `/setup-browser-cookies` should be available.',
        checklistRationale(checklists, ['security', 'accessibility']),
      ),
    },
  };
}

function readFrameDesignIntent(cwd: string): DesignIntentRecord {
  const path = join(cwd, frameDesignIntentPath());
  if (!existsSync(path)) {
    return defaultDesignIntent();
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<DesignIntentRecord>;
  if (!isRecord(parsed)) {
    return defaultDesignIntent();
  }

  return {
    impact: normalizeDesignImpact(parsed.impact),
    affected_surfaces: Array.isArray(parsed.affected_surfaces)
      ? parsed.affected_surfaces.filter((surface): surface is string => typeof surface === 'string')
      : [],
    design_system_source:
      parsed.design_system_source === 'design_md'
      || parsed.design_system_source === 'support_skill'
      || parsed.design_system_source === 'mixed'
        ? parsed.design_system_source
        : 'none',
    contract_required: normalizeBoolean(parsed.contract_required, false),
    verification_required: normalizeBoolean(parsed.verification_required, false),
  };
}

function normalizeMatrix(raw: unknown, fallback: VerificationMatrixRecord): VerificationMatrixRecord {
  if (!isRecord(raw)) {
    return fallback;
  }

  const obligations = isRecord(raw.obligations) ? raw.obligations : {};
  const build = isRecord(obligations.build) ? obligations.build : {};
  const review = isRecord(obligations.review) ? obligations.review : {};
  const qa = isRecord(obligations.qa) ? obligations.qa : {};
  const ship = isRecord(obligations.ship) ? obligations.ship : {};
  const attachedEvidence = isRecord(raw.attached_evidence) ? raw.attached_evidence : {};
  const checklists = isRecord(raw.checklists) ? raw.checklists : {};
  const supportSkillSignals = isRecord(raw.support_skill_signals) ? raw.support_skill_signals : {};

  function normalizeChecklist(
    category: VerificationChecklistCategory,
    value: unknown,
    fallbackChecklist: VerificationMatrixChecklistRecord,
  ): VerificationMatrixChecklistRecord {
    const checklist = isRecord(value) ? value : {};
    return {
      category,
      source_path: typeof checklist.source_path === 'string' ? checklist.source_path : fallbackChecklist.source_path,
      applies: normalizeBoolean(checklist.applies, fallbackChecklist.applies),
      rationale: typeof checklist.rationale === 'string' ? checklist.rationale : fallbackChecklist.rationale,
      triggers: normalizeStringArrayAllowEmpty(checklist.triggers, fallbackChecklist.triggers),
      support_surfaces: normalizeStringArrayAllowEmpty(checklist.support_surfaces, fallbackChecklist.support_surfaces),
    };
  }

  const normalizedChecklists = Object.fromEntries(
    VERIFICATION_CHECKLIST_CATEGORIES.map((category) => [
      category,
      normalizeChecklist(category, checklists[category], fallback.checklists[category]),
    ]),
  ) as Record<VerificationChecklistCategory, VerificationMatrixChecklistRecord>;

  function normalizeChecklistRationale(
    value: unknown,
    fallbackRationale: VerificationMatrixChecklistRationaleRecord[],
  ): VerificationMatrixChecklistRationaleRecord[] {
    if (!Array.isArray(value)) {
      return [...fallbackRationale];
    }

    const normalized: VerificationMatrixChecklistRationaleRecord[] = [];
    for (const entry of value) {
      if (!isRecord(entry) || !VERIFICATION_CHECKLIST_CATEGORIES.includes(entry.category as VerificationChecklistCategory)) {
        continue;
      }
      normalized.push({
        category: entry.category as VerificationChecklistCategory,
        source_path: typeof entry.source_path === 'string'
          ? entry.source_path
          : normalizedChecklists[entry.category as VerificationChecklistCategory].source_path,
        rationale: typeof entry.rationale === 'string'
          ? entry.rationale
          : normalizedChecklists[entry.category as VerificationChecklistCategory].rationale,
      });
    }

    return normalized.length > 0 ? normalized : [...fallbackRationale];
  }

  function normalizeSkillSignal(
    value: unknown,
    fallbackSignal: VerificationMatrixRecord['support_skill_signals'][keyof VerificationMatrixRecord['support_skill_signals']],
  ) {
    const signal = isRecord(value) ? value : {};
    const suggested = normalizeBoolean(signal.suggested, fallbackSignal.suggested);
    return {
      suggested,
      reason: typeof signal.reason === 'string' ? signal.reason : fallbackSignal.reason,
      checklist_rationale: suggested
        ? normalizeChecklistRationale(signal.checklist_rationale, fallbackSignal.checklist_rationale)
        : [],
    };
  }

  return {
    schema_version: 1,
    run_id: typeof raw.run_id === 'string' ? raw.run_id : fallback.run_id,
    generated_at: typeof raw.generated_at === 'string' ? raw.generated_at : fallback.generated_at,
    design_impact: normalizeDesignImpact(raw.design_impact),
    verification_required: normalizeBoolean(raw.verification_required, fallback.verification_required),
    obligations: {
      build: {
        owner_stage: 'build',
        required: normalizeBoolean(build.required, fallback.obligations.build.required),
        gate_affecting: normalizeBoolean(build.gate_affecting, fallback.obligations.build.gate_affecting),
        expected_artifacts: normalizeStringArray(build.expected_artifacts, fallback.obligations.build.expected_artifacts),
      },
      review: {
        owner_stage: 'review',
        required: normalizeBoolean(review.required, fallback.obligations.review.required),
        gate_affecting: normalizeBoolean(review.gate_affecting, fallback.obligations.review.gate_affecting),
        mode: normalizeReviewMode(review.mode),
        expected_artifacts: normalizeStringArray(review.expected_artifacts, fallback.obligations.review.expected_artifacts),
      },
      qa: {
        owner_stage: 'qa',
        required: normalizeBoolean(qa.required, fallback.obligations.qa.required),
        gate_affecting: normalizeBoolean(qa.gate_affecting, fallback.obligations.qa.gate_affecting),
        design_verification_required: normalizeBoolean(
          qa.design_verification_required,
          fallback.obligations.qa.design_verification_required,
        ),
        expected_artifacts: normalizeStringArray(qa.expected_artifacts, fallback.obligations.qa.expected_artifacts),
      },
      ship: {
        owner_stage: 'ship',
        required: normalizeBoolean(ship.required, fallback.obligations.ship.required),
        gate_affecting: normalizeBoolean(ship.gate_affecting, fallback.obligations.ship.gate_affecting),
        deploy_readiness_required: normalizeBoolean(
          ship.deploy_readiness_required,
          fallback.obligations.ship.deploy_readiness_required,
        ),
        expected_artifacts: normalizeStringArray(ship.expected_artifacts, fallback.obligations.ship.expected_artifacts),
      },
    },
    attached_evidence: {
      benchmark: {
        supported: normalizeBoolean(
          isRecord(attachedEvidence.benchmark) ? attachedEvidence.benchmark.supported : undefined,
          fallback.attached_evidence.benchmark.supported,
        ),
        required: normalizeBoolean(
          isRecord(attachedEvidence.benchmark) ? attachedEvidence.benchmark.required : undefined,
          fallback.attached_evidence.benchmark.required,
        ),
      },
      canary: {
        supported: normalizeBoolean(
          isRecord(attachedEvidence.canary) ? attachedEvidence.canary.supported : undefined,
          fallback.attached_evidence.canary.supported,
        ),
        required: normalizeBoolean(
          isRecord(attachedEvidence.canary) ? attachedEvidence.canary.required : undefined,
          fallback.attached_evidence.canary.required,
        ),
      },
      qa_only: {
        supported: normalizeBoolean(
          isRecord(attachedEvidence.qa_only) ? attachedEvidence.qa_only.supported : undefined,
          fallback.attached_evidence.qa_only.supported,
        ),
        required: normalizeBoolean(
          isRecord(attachedEvidence.qa_only) ? attachedEvidence.qa_only.required : undefined,
          fallback.attached_evidence.qa_only.required,
        ),
      },
    },
    checklists: normalizedChecklists,
    support_skill_signals: {
      design_review: normalizeSkillSignal(supportSkillSignals.design_review, fallback.support_skill_signals.design_review),
      browse: normalizeSkillSignal(supportSkillSignals.browse, fallback.support_skill_signals.browse),
      benchmark: normalizeSkillSignal(supportSkillSignals.benchmark, fallback.support_skill_signals.benchmark),
      simplify: normalizeSkillSignal(supportSkillSignals.simplify, fallback.support_skill_signals.simplify),
      cso: normalizeSkillSignal(supportSkillSignals.cso, fallback.support_skill_signals.cso),
      connect_chrome: normalizeSkillSignal(
        supportSkillSignals.connect_chrome,
        fallback.support_skill_signals.connect_chrome,
      ),
      setup_browser_cookies: normalizeSkillSignal(
        supportSkillSignals.setup_browser_cookies,
        fallback.support_skill_signals.setup_browser_cookies,
      ),
    },
  };
}

export function buildVerificationMatrix(
  cwd: string,
  runId: string,
  generatedAt: string,
  reviewMode: ReviewScopeMode = 'full_acceptance',
): VerificationMatrixRecord {
  return buildDefaultVerificationMatrix(cwd, runId, generatedAt, readFrameDesignIntent(cwd), reviewMode);
}

export function readVerificationMatrix(cwd: string): VerificationMatrixRecord | null {
  const path = join(cwd, planVerificationMatrixPath());
  const partial = readJsonPartial<VerificationMatrixRecord>(path);
  if (partial === null) {
    return null;
  }

  const fallback = buildDefaultVerificationMatrix(cwd, 'unknown', new Date(0).toISOString(), readFrameDesignIntent(cwd), 'full_acceptance');
  return normalizeMatrix(partial, fallback);
}

export function resolveVerificationMatrix(
  cwd: string,
  runId: string,
  generatedAt: string,
  reviewMode: ReviewScopeMode = 'full_acceptance',
): VerificationMatrixRecord {
  const fallback = buildDefaultVerificationMatrix(cwd, runId, generatedAt, readFrameDesignIntent(cwd), reviewMode);
  const path = join(cwd, planVerificationMatrixPath());
  return readJsonPartialOr(
    path,
    () => fallback,
    (raw) => normalizeMatrix(raw, fallback),
  );
}
