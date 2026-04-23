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
import type { DesignImpact, DesignIntentRecord, ReviewScopeMode, VerificationMatrixRecord } from './types';

function defaultDesignIntent(): DesignIntentRecord {
  return {
    impact: 'none',
    affected_surfaces: [],
    design_system_source: 'none',
    contract_required: false,
    verification_required: false,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
        if (!isObject(record)) {
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
    support_skill_signals: {
      design_review: {
        suggested: designImpact !== 'none',
        reason: designImpact !== 'none'
          ? 'Design-bearing work should expose `/design-review` as a first-class follow-on.'
          : null,
      },
      browse: {
        suggested: browserFacing,
        reason: browserFacing
          ? 'Browser-facing surfaces changed, so `/browse` should be available from the advisor.'
          : null,
      },
      benchmark: {
        suggested: true,
        reason: 'The verification matrix supports benchmark evidence for this run.',
      },
      cso: {
        suggested: securitySensitive,
        reason: securitySensitive
          ? 'Auth, permission, webhook, or security-sensitive surfaces changed, so `/cso` should be available.'
          : null,
      },
      connect_chrome: {
        suggested: browserFacing,
        reason: browserFacing
          ? 'A browser-facing flow exists, so real-browser verification through `/connect-chrome` is available.'
          : null,
      },
      setup_browser_cookies: {
        suggested: browserFacing && authFacing,
        reason: browserFacing && authFacing
          ? 'Authenticated browser verification is likely relevant, so `/setup-browser-cookies` should be available.'
          : null,
      },
    },
  };
}

function readFrameDesignIntent(cwd: string): DesignIntentRecord {
  const path = join(cwd, frameDesignIntentPath());
  if (!existsSync(path)) {
    return defaultDesignIntent();
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<DesignIntentRecord>;
  if (!isObject(parsed)) {
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
  if (!isObject(raw)) {
    return fallback;
  }

  const obligations = isObject(raw.obligations) ? raw.obligations : {};
  const build = isObject(obligations.build) ? obligations.build : {};
  const review = isObject(obligations.review) ? obligations.review : {};
  const qa = isObject(obligations.qa) ? obligations.qa : {};
  const ship = isObject(obligations.ship) ? obligations.ship : {};
  const attachedEvidence = isObject(raw.attached_evidence) ? raw.attached_evidence : {};
  const supportSkillSignals = isObject(raw.support_skill_signals) ? raw.support_skill_signals : {};

  function normalizeSkillSignal(
    value: unknown,
    fallbackSignal: VerificationMatrixRecord['support_skill_signals'][keyof VerificationMatrixRecord['support_skill_signals']],
  ) {
    const signal = isObject(value) ? value : {};
    return {
      suggested: normalizeBoolean(signal.suggested, fallbackSignal.suggested),
      reason: typeof signal.reason === 'string' ? signal.reason : fallbackSignal.reason,
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
          isObject(attachedEvidence.benchmark) ? attachedEvidence.benchmark.supported : undefined,
          fallback.attached_evidence.benchmark.supported,
        ),
        required: normalizeBoolean(
          isObject(attachedEvidence.benchmark) ? attachedEvidence.benchmark.required : undefined,
          fallback.attached_evidence.benchmark.required,
        ),
      },
      canary: {
        supported: normalizeBoolean(
          isObject(attachedEvidence.canary) ? attachedEvidence.canary.supported : undefined,
          fallback.attached_evidence.canary.supported,
        ),
        required: normalizeBoolean(
          isObject(attachedEvidence.canary) ? attachedEvidence.canary.required : undefined,
          fallback.attached_evidence.canary.required,
        ),
      },
      qa_only: {
        supported: normalizeBoolean(
          isObject(attachedEvidence.qa_only) ? attachedEvidence.qa_only.supported : undefined,
          fallback.attached_evidence.qa_only.supported,
        ),
        required: normalizeBoolean(
          isObject(attachedEvidence.qa_only) ? attachedEvidence.qa_only.required : undefined,
          fallback.attached_evidence.qa_only.required,
        ),
      },
    },
    support_skill_signals: {
      design_review: normalizeSkillSignal(supportSkillSignals.design_review, fallback.support_skill_signals.design_review),
      browse: normalizeSkillSignal(supportSkillSignals.browse, fallback.support_skill_signals.browse),
      benchmark: normalizeSkillSignal(supportSkillSignals.benchmark, fallback.support_skill_signals.benchmark),
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
  if (!existsSync(path)) {
    return null;
  }

  const fallback = buildDefaultVerificationMatrix(cwd, 'unknown', new Date(0).toISOString(), readFrameDesignIntent(cwd), 'full_acceptance');
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  return normalizeMatrix(parsed, fallback);
}

export function resolveVerificationMatrix(
  cwd: string,
  runId: string,
  generatedAt: string,
  reviewMode: ReviewScopeMode = 'full_acceptance',
): VerificationMatrixRecord {
  const fallback = buildDefaultVerificationMatrix(cwd, runId, generatedAt, readFrameDesignIntent(cwd), reviewMode);
  const path = join(cwd, planVerificationMatrixPath());
  if (!existsSync(path)) {
    return fallback;
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  return normalizeMatrix(parsed, fallback);
}
