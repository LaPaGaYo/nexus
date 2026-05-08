import { existsSync, readFileSync } from 'fs';

/** True for plain objects (not null, not arrays). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Throws if `value` is not a non-empty string. */
export function assertString(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

/** Throws if `value` is neither null nor a non-empty string. */
export function assertNullableString(
  value: unknown,
  label: string,
): asserts value is string | null {
  if (value !== null) {
    assertString(value, label);
  }
}

/** Throws if `value` is not an array of non-empty strings (only the type is checked, emptiness is not). */
export function assertStringArray(
  value: unknown,
  label: string,
): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be an array of strings`);
  }
}

/** Throws if `value` is not a boolean. */
export function assertBoolean(
  value: unknown,
  label: string,
): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
}

/**
 * Read a JSON file from disk and run it through a validator. Returns null
 * when the file does not exist. The validator narrows the parsed `unknown`
 * to the desired type and is expected to throw on schema failure.
 */
export function readJsonFile<T>(
  path: string,
  validate: (value: unknown) => T,
): T | null {
  if (!existsSync(path)) {
    return null;
  }
  return validate(JSON.parse(readFileSync(path, 'utf8')));
}

/**
 * Lenient JSON read primitive: never throws. Returns a discriminated result
 * carrying the failure reason and (for parse errors) the underlying Error so
 * callers can log, distinguish missing-vs-malformed, or self-heal.
 *
 * For callsites that don't care about the reason, prefer `readJsonPartial`
 * or `readJsonPartialOr` — both are thin wrappers around this function.
 */
export type JsonReadResult<T> =
  | { ok: true; value: Partial<T> }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'parse_error'; error: Error };

export function readJsonResult<T>(path: string): JsonReadResult<T> {
  if (!existsSync(path)) {
    return { ok: false, reason: 'missing' };
  }
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as Partial<T>;
    return { ok: true, value };
  } catch (error) {
    return { ok: false, reason: 'parse_error', error: error as Error };
  }
}

/**
 * Lenient JSON read: missing file or parse error → null. Callers that defensively
 * normalize fields downstream can treat both failure modes as "use the default".
 *
 * If you need to distinguish missing from malformed (for telemetry, self-healing,
 * or user-facing errors), use `readJsonResult` instead.
 */
export function readJsonPartial<T>(path: string): Partial<T> | null {
  const result = readJsonResult<T>(path);
  return result.ok ? result.value : null;
}

/**
 * Lenient JSON read with typed fallback: always returns T, never throws.
 * Missing file or parse error → `fallback()` is invoked. Otherwise the parsed
 * `Partial<T>` is passed to `normalize` so the caller can fill in missing
 * fields from defaults.
 *
 * If you need access to the raw failure reason, use `readJsonResult` instead.
 */
export function readJsonPartialOr<T>(
  path: string,
  fallback: () => T,
  normalize: (raw: Partial<T>) => T,
): T {
  const partial = readJsonPartial<T>(path);
  return partial === null ? fallback() : normalize(partial);
}
