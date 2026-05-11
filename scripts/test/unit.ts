export const DEFAULT_UNIT_TEST_ARGS = [
  'test',
  'runtimes/browse/test/',
  'test/',
  '--ignore',
  'test/skill-e2e-*.test.ts',
  '--ignore',
  'test/skill-llm-eval.test.ts',
  '--ignore',
  'test/skill-routing-e2e.test.ts',
  '--ignore',
  'test/codex-e2e.test.ts',
  '--ignore',
  'test/gemini-e2e.test.ts',
] as const;

type ChunkSink = (chunk: Uint8Array) => void | Promise<void>;

export interface FailMarkerGateResult {
  command: readonly string[];
  exitCode: number;
  failCount: number;
  gatedExitCode: number;
  stdout: string;
  stderr: string;
}

export function countBunFailMarkers(output: string): number {
  if (output.length === 0) return 0;

  return output.split(/\r?\n/).filter((line) => line.startsWith('(fail)')).length;
}

async function readPipe(
  stream: ReadableStream<Uint8Array>,
  sink: ChunkSink,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    output += decoder.decode(value, { stream: true });
    await sink(value);
  }

  output += decoder.decode();
  return output;
}

export async function runWithFailMarkerGate(
  command: readonly string[],
  options: {
    cwd?: string;
    stdout?: ChunkSink;
    stderr?: ChunkSink;
  } = {},
): Promise<FailMarkerGateResult> {
  const proc = Bun.spawn(command, {
    cwd: options.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdoutSink = options.stdout ?? ((chunk: Uint8Array) => { process.stdout.write(chunk); });
  const stderrSink = options.stderr ?? ((chunk: Uint8Array) => { process.stderr.write(chunk); });

  const [stdout, stderr, exitCode] = await Promise.all([
    readPipe(proc.stdout, stdoutSink),
    readPipe(proc.stderr, stderrSink),
    proc.exited,
  ]);
  const failCount = countBunFailMarkers(`${stdout}\n${stderr}`);
  const gatedExitCode = exitCode !== 0 ? exitCode : failCount > 0 ? 1 : 0;

  return {
    command,
    exitCode,
    failCount,
    gatedExitCode,
    stdout,
    stderr,
  };
}

export async function runDefaultUnitTests(): Promise<number> {
  const result = await runWithFailMarkerGate(['bun', ...DEFAULT_UNIT_TEST_ARGS]);

  if (result.exitCode === 0 && result.failCount > 0) {
    console.error(
      `Bun test emitted ${result.failCount} fail marker(s) while returning exit 0; failing local test gate. See #139.`,
    );
  }

  return result.gatedExitCode;
}

if (import.meta.main) {
  try {
    process.exit(await runDefaultUnitTests());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to run unit tests: ${message}`);
    process.exit(1);
  }
}
