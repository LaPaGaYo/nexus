import type { SkillRecord } from '../skill-registry/types';
import type { IntentCandidate, IntentOutcome, LLMClassifier } from './llm';

/**
 * Real LLM classifier backed by the Anthropic Claude API.
 *
 * Privacy contract:
 *   - Sends ONLY the user's intent string + a compact list of
 *     candidate skill names with their intent_keywords. No SKILL.md
 *     content, no PRD prose, no run state, no advisor records.
 *   - The Anthropic API call is on a network path the user has already
 *     opted into via their host (Claude Code, Codex CLI with Claude
 *     backend, etc.) — see Phase 5 brief § "Cross-host behavior".
 *
 * Cost discipline:
 *   - Default model: claude-haiku-4-5 (fast, cheap)
 *   - Default timeout: 5000ms
 *   - Skill list capped at 50 candidates (the keyword tiebreaker only
 *     fires on `ambiguous` outcomes which already have ≤candidateLimit
 *     candidates anyway)
 *
 * Failure mode:
 *   - Any network/parse/timeout error returns no_match. The caller
 *     (classifyIntentAsync) treats that as "keyword outcome wins."
 *   - SDK is required; if `@anthropic-ai/sdk` is not installed, this
 *     module's load will throw — register the classifier from a path
 *     that's only imported when LLM is enabled.
 */

export interface ClaudeAPILLMClassifierOptions {
  /** Anthropic API key. Defaults to ANTHROPIC_API_KEY env var. */
  apiKey?: string;
  /** Model to use. Defaults to claude-haiku-4-5. */
  model?: string;
  /** Timeout in milliseconds. Defaults to 5000. */
  timeoutMs?: number;
  /** Override the SDK module (test-only). */
  sdkOverride?: AnthropicLikeSDK;
}

/**
 * Minimal SDK shape we depend on. Defined as an interface so tests can
 * mock without relying on the real SDK's internals.
 */
export interface AnthropicLikeSDK {
  messages: {
    create: (params: AnthropicCreateParams) => Promise<AnthropicMessage>;
  };
}

interface AnthropicCreateParams {
  model: string;
  max_tokens: number;
  messages: Array<{ role: 'user'; content: string }>;
  system?: string;
}

interface AnthropicMessage {
  content: Array<{ type: string; text?: string }>;
}

const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_CANDIDATES_IN_PROMPT = 50;

const SYSTEM_PROMPT = `You are routing a free-form user intent to one of a list of named skills. Each skill has a list of "intent_keywords" describing when it applies.

Rules:
1. Respond with EXACTLY one line in this format: CHOICE: <skill_name>
2. The skill_name MUST be one of the names in the candidates list. Do NOT invent skill names.
3. If no skill is a clear match, respond: CHOICE: NONE
4. No explanation. No preamble. Just the CHOICE line.`;

export class ClaudeAPILLMClassifier implements LLMClassifier {
  readonly name = 'claude-api';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly sdkOverride: AnthropicLikeSDK | undefined;

  constructor(options: ClaudeAPILLMClassifierOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    this.model = options.model ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.sdkOverride = options.sdkOverride;
  }

  async classify(intent: string, skills: readonly SkillRecord[]): Promise<IntentOutcome> {
    if (!this.apiKey && !this.sdkOverride) {
      // No API key and no test override → nothing we can do.
      return { kind: 'no_match', closest: [] };
    }

    const candidates = buildCandidatePromptList(skills, MAX_CANDIDATES_IN_PROMPT);
    if (candidates.length === 0) {
      return { kind: 'no_match', closest: [] };
    }

    let sdk: AnthropicLikeSDK;
    if (this.sdkOverride) {
      sdk = this.sdkOverride;
    } else {
      try {
        // Dynamic import keeps the SDK out of the require graph for users
        // who never enable LLM classification.
        const mod = await import('@anthropic-ai/sdk');
        const Anthropic = (mod.default ?? (mod as unknown as { Anthropic: new (init: { apiKey: string }) => AnthropicLikeSDK }).Anthropic);
        // eslint-disable-next-line new-cap
        sdk = new (Anthropic as unknown as { new (init: { apiKey: string }): AnthropicLikeSDK })({ apiKey: this.apiKey });
      } catch {
        return { kind: 'no_match', closest: [] };
      }
    }

    const userMessage = formatUserMessage(intent, candidates);
    let response: AnthropicMessage;
    try {
      response = await withTimeout(
        sdk.messages.create({
          model: this.model,
          max_tokens: 64,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }),
        this.timeoutMs,
      );
    } catch {
      return { kind: 'no_match', closest: [] };
    }

    const text = extractTextFromResponse(response);
    const chosenName = parseChoiceLine(text);
    if (chosenName === null) {
      return { kind: 'no_match', closest: [] };
    }

    const chosen = skills.find((s) => s.name === chosenName);
    if (!chosen) {
      // Model hallucinated a name not in the candidate list. Fail closed.
      return { kind: 'no_match', closest: [] };
    }

    const candidate: IntentCandidate = {
      name: chosen.name,
      surface: `/${chosen.name}`,
      namespace: chosen.manifest?.classification?.namespace ?? chosen.namespace,
      score: 100, // synthetic; LLM doesn't return calibrated scores
      matched_keywords: [],
      manifest_backed: chosen.manifest !== undefined,
    };

    return {
      kind: 'confident_match',
      chosen: candidate,
      candidates: [candidate],
    };
  }
}

function buildCandidatePromptList(
  skills: readonly SkillRecord[],
  maxCount: number,
): Array<{ name: string; intent_keywords: readonly string[] }> {
  const result: Array<{ name: string; intent_keywords: readonly string[] }> = [];
  for (const skill of skills) {
    if (result.length >= maxCount) break;
    if (!skill.manifest) continue; // only manifest-backed skills are LLM candidates
    result.push({ name: skill.name, intent_keywords: skill.manifest.intent_keywords });
  }
  return result;
}

function formatUserMessage(
  intent: string,
  candidates: ReadonlyArray<{ name: string; intent_keywords: readonly string[] }>,
): string {
  const lines: string[] = [];
  lines.push(`User intent: "${intent}"`);
  lines.push('');
  lines.push('Candidates:');
  for (const c of candidates) {
    const keywords = c.intent_keywords.slice(0, 8).map((k) => `"${k}"`).join(', ');
    lines.push(`  ${c.name}: ${keywords}`);
  }
  return lines.join('\n');
}

function extractTextFromResponse(response: AnthropicMessage): string {
  const blocks = response.content ?? [];
  for (const block of blocks) {
    if (block.type === 'text' && typeof block.text === 'string') {
      return block.text;
    }
  }
  return '';
}

function parseChoiceLine(text: string): string | null {
  const match = text.match(/CHOICE:\s*(\S+)/);
  if (!match) return null;
  const value = match[1].trim();
  if (!value || value === 'NONE') return null;
  return value;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`LLM call exceeded ${timeoutMs}ms timeout`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
