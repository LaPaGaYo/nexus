import { buildReleasePreflightReport } from './release-publish';

export interface ReleasePublicationCommandSpec {
  argv: string[];
  cwd: string;
  env?: Record<string, string>;
}

export interface ReleasePublicationCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ReleasePublicationReport {
  schema_version: 1;
  status: 'published' | 'blocked';
  version: string;
  tag: string;
  issues: string[];
}

export interface ExecutePreparedReleasePublicationOptions {
  rootDir: string;
  releaseRepo?: string;
  gitStatusLines: string[];
  existingTags: string[];
  runCommand: (spec: ReleasePublicationCommandSpec) => Promise<ReleasePublicationCommandResult>;
}

const DEFAULT_RELEASE_REPO = 'LaPaGaYo/nexus' as const;
function blockedPublication(version: string, tag: string, issues: string[]): ReleasePublicationReport {
  return {
    schema_version: 1,
    status: 'blocked',
    version,
    tag,
    issues,
  };
}

function publishedPublication(version: string, tag: string): ReleasePublicationReport {
  return {
    schema_version: 1,
    status: 'published',
    version,
    tag,
    issues: [],
  };
}

async function runRequiredCommand(
  runCommand: ExecutePreparedReleasePublicationOptions['runCommand'],
  spec: ReleasePublicationCommandSpec,
  failureMessage: string,
): Promise<ReleasePublicationCommandResult> {
  const result = await runCommand(spec);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || failureMessage);
  }

  return result;
}

function parseStatusLines(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function executePreparedReleasePublication(
  options: ExecutePreparedReleasePublicationOptions,
): Promise<ReleasePublicationReport> {
  const { rootDir } = options;
  const releaseRepo = options.releaseRepo ?? DEFAULT_RELEASE_REPO;
  const preflight = buildReleasePreflightReport({
    rootDir,
    gitStatusLines: options.gitStatusLines,
    existingTags: options.existingTags,
  });

  if (preflight.status !== 'ready') {
    return blockedPublication(preflight.version, preflight.tag, preflight.issues);
  }

  try {
    const branchResult = await runRequiredCommand(
      options.runCommand,
      {
        argv: ['git', 'branch', '--show-current'],
        cwd: rootDir,
      },
      'failed to determine the current branch',
    );

    if (branchResult.stdout.trim() !== 'main') {
      return blockedPublication(preflight.version, preflight.tag, [
        `Release publication must run from main; current branch is ${branchResult.stdout.trim() || '<unknown>'}.`,
      ]);
    }

    for (const argv of [
      ['bun', 'run', 'gen:skill-docs'],
      ['bun', 'run', 'gen:skill-docs', '--host', 'codex'],
      ['bun', 'run', 'gen:skill-docs', '--host', 'factory'],
    ]) {
      await runRequiredCommand(
        options.runCommand,
        { argv, cwd: rootDir },
        `failed to run ${argv.join(' ')}`,
      );
    }

    const postSkillDocsStatus = await runRequiredCommand(
      options.runCommand,
      {
        argv: ['git', 'status', '--short'],
        cwd: rootDir,
      },
      'failed to verify skill docs freshness',
    );
    if (parseStatusLines(postSkillDocsStatus.stdout).length > 0) {
      return blockedPublication(preflight.version, preflight.tag, [
        'Generated skill docs are stale; run the skill doc generators and commit the results before publishing.',
      ]);
    }

    await runRequiredCommand(
      options.runCommand,
      {
        argv: ['git', 'push', 'origin', 'main'],
        cwd: rootDir,
      },
      'failed to push main before tagging',
    );

    await runRequiredCommand(
      options.runCommand,
      {
        argv: ['git', 'tag', preflight.tag],
        cwd: rootDir,
      },
      `failed to create tag ${preflight.tag}`,
    );

    await runRequiredCommand(
      options.runCommand,
      {
        argv: ['git', 'push', 'origin', preflight.tag],
        cwd: rootDir,
      },
      `failed to push tag ${preflight.tag}`,
    );

    await runRequiredCommand(
      options.runCommand,
      {
        argv: [
          'gh',
          'release',
          'create',
          preflight.tag,
          '--repo',
          releaseRepo,
          '--title',
          `Nexus ${preflight.tag}`,
          '--notes-file',
          preflight.release_notes_path,
        ],
        cwd: rootDir,
      },
      `failed to create GitHub release for ${preflight.tag}`,
    );

    await runRequiredCommand(
      options.runCommand,
      {
        argv: ['./bin/nexus-release-smoke'],
        cwd: rootDir,
      },
      'published release smoke failed',
    );

    return publishedPublication(preflight.version, preflight.tag);
  } catch (error) {
    return blockedPublication(preflight.version, preflight.tag, [
      error instanceof Error ? error.message : String(error),
    ]);
  }
}
