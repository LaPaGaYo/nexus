export interface NexusCommandSpec {
  argv: string[];
  cwd: string;
  env?: Record<string, string>;
}

export interface NexusCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type NexusCommandRunner = (spec: NexusCommandSpec) => Promise<NexusCommandResult>;

export async function runNexusCommand(spec: NexusCommandSpec): Promise<NexusCommandResult> {
  const result = Bun.spawnSync(spec.argv, {
    cwd: spec.cwd,
    env: spec.env ? { ...process.env, ...spec.env } : process.env,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}
