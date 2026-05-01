import { describe, expect, test } from 'bun:test';
import type { NexusCommandRunner } from '../../lib/nexus/command-runner';
import { resolveShipPullRequest } from '../../lib/nexus/ship-pull-request';

describe('ship pull request discovery', () => {
  test('treats malformed gh pr view JSON as unavailable instead of reusing it', async () => {
    const commands: string[] = [];
    const runCommand: NexusCommandRunner = async (spec) => {
      commands.push(spec.argv.join(' '));

      if (spec.argv.join(' ') === 'git branch --show-current') {
        return { exitCode: 0, stdout: 'feature/harden-pr-json\n', stderr: '' };
      }

      if (spec.argv.join(' ') === 'git rev-parse HEAD') {
        return { exitCode: 0, stdout: 'abc123def456\n', stderr: '' };
      }

      if (spec.argv.join(' ') === 'gh pr view --json number,url,state,headRefName,headRefOid,baseRefName') {
        return {
          exitCode: 0,
          stdout: '{"number":"123","url":"https://github.example/pull/123","state":"OPEN"}\n',
          stderr: '',
        };
      }

      throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
    };

    await expect(resolveShipPullRequest('/tmp/nexus', true, runCommand)).resolves.toMatchObject({
      provider: 'github',
      status: 'unavailable',
      reason: 'gh pr view returned invalid JSON',
      head_branch: 'feature/harden-pr-json',
      head_sha: 'abc123def456',
    });
    expect(commands).toEqual([
      'git branch --show-current',
      'git rev-parse HEAD',
      'gh pr view --json number,url,state,headRefName,headRefOid,baseRefName',
    ]);
  });
});
