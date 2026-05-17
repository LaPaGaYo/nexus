import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { load as parseYaml } from 'js-yaml';

type NexusLearningConfig = {
  learning?: {
    mirror_on_closeout?: unknown;
  };
};

function resolveStateDir(): string {
  return process.env.NEXUS_STATE_DIR ?? `${process.env.HOME}/.nexus`;
}

/**
 * Read `learning.mirror_on_closeout` from `~/.nexus/config.yaml` (or NEXUS_STATE_DIR override).
 * Strict: only the boolean literal `true` enables; anything else (false, string, number, absent,
 * malformed) returns false. Mirroring is opt-in by design — see SP1 spec §6.
 */
export function isMirrorEnabled(): boolean {
  const configPath = join(resolveStateDir(), 'config.yaml');
  if (!existsSync(configPath)) return false;
  try {
    const config = parseYaml(readFileSync(configPath, 'utf8')) as NexusLearningConfig | null;
    return config?.learning?.mirror_on_closeout === true;
  } catch {
    return false;
  }
}
