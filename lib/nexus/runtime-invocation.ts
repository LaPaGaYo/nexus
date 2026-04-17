import { CONTINUATION_MODES, type ContinuationMode } from './types';

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

export interface RuntimeInvocation {
  command: string;
  continuationModeOverride: ContinuationMode | null;
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

    throw new Error(`Unknown Nexus argument: ${arg}`);
  }

  const envContinuationMode = parseContinuationMode(env.NEXUS_CONTINUATION_MODE ?? null);
  const continuationModeOverride = cliContinuationMode ?? envContinuationMode;

  if (continuationModeOverride && command !== 'discover') {
    throw new Error('Continuation mode override is only supported for discover');
  }

  return {
    command,
    continuationModeOverride,
  };
}
