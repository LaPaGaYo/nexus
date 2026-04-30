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
