import { describe, expect, test } from 'bun:test';
import { ClaudeAPILLMClassifier } from '../../lib/nexus/intent-classifier/llm-claude';
import type { AnthropicLikeSDK } from '../../lib/nexus/intent-classifier/llm-claude';
import type { SkillRecord } from '../../lib/nexus/skill-registry/types';
import type { NexusSkillManifest } from '../../lib/nexus/skill-registry/manifest-schema';

function manifest(name: string, keywords: readonly string[]): NexusSkillManifest {
  return {
    schema_version: 1,
    name,
    summary: `${name} summary`,
    intent_keywords: keywords,
    classification: { namespace: 'nexus_canonical' },
  };
}

function skill(name: string, keywords: string[]): SkillRecord {
  return {
    name,
    surface: `/${name}`,
    description: null,
    path: `/tmp/${name}/SKILL.md`,
    source_root: '/tmp',
    namespace: 'nexus_canonical',
    tags: [],
    manifest: manifest(name, keywords),
  };
}

function mockSDK(textResponse: string, opts: { delayMs?: number; throwError?: Error } = {}): AnthropicLikeSDK {
  return {
    messages: {
      create: async () => {
        if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
        if (opts.throwError) throw opts.throwError;
        return { content: [{ type: 'text', text: textResponse }] };
      },
    },
  };
}

describe('ClaudeAPILLMClassifier', () => {
  test('returns confident_match when SDK selects a real candidate', async () => {
    const sdk = mockSDK('CHOICE: ship');
    const classifier = new ClaudeAPILLMClassifier({ sdkOverride: sdk, apiKey: 'sk-test' });
    const skills = [skill('build', ['implement']), skill('ship', ['release', 'merge'])];

    const result = await classifier.classify('release this to prod', skills);
    expect(result.kind).toBe('confident_match');
    if (result.kind === 'confident_match') {
      expect(result.chosen.name).toBe('ship');
      expect(result.chosen.namespace).toBe('nexus_canonical');
      expect(result.chosen.manifest_backed).toBe(true);
    }
  });

  test('returns no_match when SDK responds with NONE', async () => {
    const sdk = mockSDK('CHOICE: NONE');
    const classifier = new ClaudeAPILLMClassifier({ sdkOverride: sdk, apiKey: 'sk-test' });
    const skills = [skill('build', ['implement'])];

    const result = await classifier.classify('do my taxes', skills);
    expect(result.kind).toBe('no_match');
  });

  test('returns no_match when SDK hallucinates a name not in candidates', async () => {
    const sdk = mockSDK('CHOICE: nonexistent-skill');
    const classifier = new ClaudeAPILLMClassifier({ sdkOverride: sdk, apiKey: 'sk-test' });
    const skills = [skill('build', ['implement'])];

    const result = await classifier.classify('whatever', skills);
    expect(result.kind).toBe('no_match');
  });

  test('returns no_match when SDK response has no CHOICE line', async () => {
    const sdk = mockSDK('I think /ship is the right answer.');
    const classifier = new ClaudeAPILLMClassifier({ sdkOverride: sdk, apiKey: 'sk-test' });
    const skills = [skill('ship', ['ship'])];

    const result = await classifier.classify('ship it', skills);
    expect(result.kind).toBe('no_match');
  });

  test('returns no_match when SDK throws (network error / 5xx)', async () => {
    const sdk = mockSDK('', { throwError: new Error('network error') });
    const classifier = new ClaudeAPILLMClassifier({ sdkOverride: sdk, apiKey: 'sk-test' });
    const skills = [skill('ship', ['ship'])];

    const result = await classifier.classify('ship it', skills);
    expect(result.kind).toBe('no_match');
  });

  test('returns no_match on timeout', async () => {
    const sdk = mockSDK('CHOICE: ship', { delayMs: 100 });
    const classifier = new ClaudeAPILLMClassifier({
      sdkOverride: sdk,
      apiKey: 'sk-test',
      timeoutMs: 20,
    });
    const skills = [skill('ship', ['ship'])];

    const result = await classifier.classify('ship it', skills);
    expect(result.kind).toBe('no_match');
  });

  test('returns no_match when no apiKey AND no sdkOverride', async () => {
    const oldKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const classifier = new ClaudeAPILLMClassifier(); // no override, no key
      const skills = [skill('ship', ['ship'])];
      const result = await classifier.classify('ship it', skills);
      expect(result.kind).toBe('no_match');
    } finally {
      if (oldKey) process.env.ANTHROPIC_API_KEY = oldKey;
    }
  });

  test('verifies unmanifested skills are NOT sent to the model (privacy)', async () => {
    let capturedPrompt = '';
    const sdk: AnthropicLikeSDK = {
      messages: {
        create: async (params) => {
          capturedPrompt = params.messages.map((m) => m.content).join('\n');
          return { content: [{ type: 'text', text: 'CHOICE: NONE' }] };
        },
      },
    };
    const classifier = new ClaudeAPILLMClassifier({ sdkOverride: sdk, apiKey: 'sk-test' });
    const skills: SkillRecord[] = [
      // Unmanifested skill (must NOT be in prompt)
      {
        name: 'legacy-secret',
        surface: '/legacy-secret',
        description: 'Has secrets in description',
        path: '/tmp/legacy/SKILL.md',
        source_root: '/tmp',
        namespace: 'external_installed',
        tags: [],
      },
      // Manifested skill (should be in prompt)
      skill('build', ['implement', 'build']),
    ];

    await classifier.classify('do something', skills);
    // Only the manifested skill name appears in the prompt
    expect(capturedPrompt).toContain('build');
    expect(capturedPrompt).not.toContain('legacy-secret');
  });

  test('returns no_match when skills list is empty', async () => {
    const sdk = mockSDK('CHOICE: anything');
    const classifier = new ClaudeAPILLMClassifier({ sdkOverride: sdk, apiKey: 'sk-test' });
    const result = await classifier.classify('anything', []);
    expect(result.kind).toBe('no_match');
  });

  test('returns no_match when all skills are unmanifested (no candidates for prompt)', async () => {
    const sdk = mockSDK('CHOICE: x');
    const classifier = new ClaudeAPILLMClassifier({ sdkOverride: sdk, apiKey: 'sk-test' });
    const skills: SkillRecord[] = [
      {
        name: 'x',
        surface: '/x',
        description: null,
        path: '/tmp/x/SKILL.md',
        source_root: '/tmp',
        namespace: 'external_installed',
        tags: [],
      },
    ];

    const result = await classifier.classify('whatever', skills);
    // All candidates filtered out (no manifests) → empty prompt → no_match
    expect(result.kind).toBe('no_match');
  });
});

describe('autoRegisterLLMClassifier', () => {
  test('returns null when no API key in env', async () => {
    const { autoRegisterLLMClassifier, restoreLLMClassifier } = await import('../../lib/nexus/intent-classifier');
    restoreLLMClassifier();
    const result = autoRegisterLLMClassifier({});
    expect(result).toBeNull();
  });

  test('registers ClaudeAPILLMClassifier when ANTHROPIC_API_KEY set', async () => {
    const { autoRegisterLLMClassifier, getLLMClassifier, restoreLLMClassifier } = await import(
      '../../lib/nexus/intent-classifier'
    );
    restoreLLMClassifier();

    const result = autoRegisterLLMClassifier({ ANTHROPIC_API_KEY: 'sk-fake-test-key' });
    expect(result).toBe('claude-api');

    const classifier = getLLMClassifier();
    expect(classifier.name).toBe('claude-api');

    restoreLLMClassifier(); // clean up for other tests
  });
});
