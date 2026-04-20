import {
  CONTINUATION_MODES,
  REVIEW_ADVISORY_DISPOSITIONS,
  type ContinuationMode,
  type ReviewAdvisoryDisposition,
} from './types';

function parseContinuationMode(value: string | undefined | null): ContinuationMode | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  if ((CONTINUATION_MODES as readonly string[]).includes(normalized)) {
    return normalized as ContinuationMode;
  }

  throw new Error(
    `Invalid continuation mode "${normalized}". Expected one of: ${CONTINUATION_MODES.join(', ')}`,
  );
}

function parseReviewAdvisoryDisposition(value: string | undefined | null): ReviewAdvisoryDisposition | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  if ((REVIEW_ADVISORY_DISPOSITIONS as readonly string[]).includes(normalized)) {
    return normalized as ReviewAdvisoryDisposition;
  }

  throw new Error(
    `Invalid review advisory disposition "${normalized}". Expected one of: ${REVIEW_ADVISORY_DISPOSITIONS.join(', ')}`,
  );
}

export interface RuntimeInvocation {
  command: string;
  continuationModeOverride: ContinuationMode | null;
  reviewAdvisoryDispositionOverride: ReviewAdvisoryDisposition | null;
}

export function resolveRuntimeInvocation(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): RuntimeInvocation {
  const [command, ...rest] = argv;
  if (!command) {
    throw new Error('Usage: bun run bin/nexus.ts <command>');
  }

  let cliContinuationMode: ContinuationMode | null = null;
  let cliReviewAdvisoryDisposition: ReviewAdvisoryDisposition | null = null;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--continuation-mode') {
      cliContinuationMode = parseContinuationMode(rest[index + 1] ?? null);
      if (!cliContinuationMode) {
        throw new Error('--continuation-mode requires a value');
      }
      index += 1;
      continue;
    }
    if (arg === '--review-advisory-disposition') {
      cliReviewAdvisoryDisposition = parseReviewAdvisoryDisposition(rest[index + 1] ?? null);
      if (!cliReviewAdvisoryDisposition) {
        throw new Error('--review-advisory-disposition requires a value');
      }
      index += 1;
      continue;
    }

    throw new Error(`Unknown Nexus argument: ${arg}`);
  }

  const envContinuationMode = parseContinuationMode(env.NEXUS_CONTINUATION_MODE ?? null);
  const envReviewAdvisoryDisposition = parseReviewAdvisoryDisposition(env.NEXUS_REVIEW_ADVISORY_DISPOSITION ?? null);
  const continuationModeOverride = cliContinuationMode ?? envContinuationMode;
  const reviewAdvisoryDispositionOverride = cliReviewAdvisoryDisposition ?? envReviewAdvisoryDisposition;

  if (continuationModeOverride && command !== 'discover') {
    throw new Error('Continuation mode override is only supported for discover');
  }
  if (
    reviewAdvisoryDispositionOverride
    && !['build', 'qa', 'ship', 'closeout'].includes(command)
  ) {
    throw new Error('Review advisory disposition override is only supported for build, qa, ship, or closeout');
  }

  return {
    command,
    continuationModeOverride,
    reviewAdvisoryDispositionOverride,
  };
}
