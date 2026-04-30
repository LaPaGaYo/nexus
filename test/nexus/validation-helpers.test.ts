import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  assertBoolean,
  assertNullableString,
  assertString,
  assertStringArray,
  isRecord,
  readJsonFile,
} from '../../lib/nexus/validation-helpers';

describe('isRecord', () => {
  test('accepts plain objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ key: 'value' })).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
  });

  test('rejects null, undefined, primitives, arrays', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord(0)).toBe(false);
    expect(isRecord('')).toBe(false);
    expect(isRecord(false)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2])).toBe(false);
  });
});

describe('assertString', () => {
  test('accepts non-empty strings', () => {
    expect(() => assertString('hello', 'value')).not.toThrow();
    expect(() => assertString(' ', 'value')).not.toThrow();
  });

  test('rejects empty string, non-strings, null, undefined', () => {
    expect(() => assertString('', 'value')).toThrow('value must be a non-empty string');
    expect(() => assertString(123, 'count')).toThrow('count must be a non-empty string');
    expect(() => assertString(null, 'name')).toThrow('name must be a non-empty string');
    expect(() => assertString(undefined, 'name')).toThrow('name must be a non-empty string');
  });
});

describe('assertNullableString', () => {
  test('accepts null and non-empty strings', () => {
    expect(() => assertNullableString(null, 'value')).not.toThrow();
    expect(() => assertNullableString('hello', 'value')).not.toThrow();
  });

  test('rejects empty string, undefined, non-strings', () => {
    expect(() => assertNullableString('', 'value')).toThrow();
    expect(() => assertNullableString(undefined, 'value')).toThrow();
    expect(() => assertNullableString(0, 'value')).toThrow();
  });
});

describe('assertStringArray', () => {
  test('accepts arrays of strings (including empty)', () => {
    expect(() => assertStringArray([], 'list')).not.toThrow();
    expect(() => assertStringArray(['a'], 'list')).not.toThrow();
    expect(() => assertStringArray(['a', 'b', ''], 'list')).not.toThrow();
  });

  test('rejects non-arrays and arrays containing non-strings', () => {
    expect(() => assertStringArray('a', 'list')).toThrow('list must be an array of strings');
    expect(() => assertStringArray(null, 'list')).toThrow();
    expect(() => assertStringArray(['a', 1], 'list')).toThrow();
    expect(() => assertStringArray([null], 'list')).toThrow();
  });
});

describe('assertBoolean', () => {
  test('accepts true and false', () => {
    expect(() => assertBoolean(true, 'flag')).not.toThrow();
    expect(() => assertBoolean(false, 'flag')).not.toThrow();
  });

  test('rejects non-booleans', () => {
    expect(() => assertBoolean(0, 'flag')).toThrow('flag must be a boolean');
    expect(() => assertBoolean(1, 'flag')).toThrow();
    expect(() => assertBoolean('true', 'flag')).toThrow();
    expect(() => assertBoolean(null, 'flag')).toThrow();
  });
});

describe('readJsonFile', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'nexus-validation-helpers-'));

  test('returns null when the file does not exist', () => {
    const result = readJsonFile(join(fixtureRoot, 'missing.json'), () => {
      throw new Error('validator should not run on missing file');
    });
    expect(result).toBeNull();
  });

  test('passes parsed unknown to the validator and returns its result', () => {
    const path = join(fixtureRoot, 'present.json');
    writeFileSync(path, JSON.stringify({ name: 'nexus', version: 1 }));

    const result = readJsonFile(path, (value) => {
      if (!isRecord(value)) {
        throw new Error('expected object');
      }
      return value;
    });

    expect(result).toEqual({ name: 'nexus', version: 1 });
  });

  test('lets the validator throw on schema mismatch', () => {
    const path = join(fixtureRoot, 'bad.json');
    writeFileSync(path, JSON.stringify({ kind: 'array' }));

    expect(() =>
      readJsonFile(path, (value) => {
        if (!Array.isArray(value)) {
          throw new Error('expected array');
        }
        return value;
      }),
    ).toThrow('expected array');
  });

  test('throws on malformed JSON', () => {
    const path = join(fixtureRoot, 'malformed.json');
    writeFileSync(path, '{not-json');

    expect(() => readJsonFile(path, (v) => v)).toThrow();
  });

  // Cleanup is registered as a no-op test so it always runs even if earlier tests fail.
  test('cleanup', () => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });
});
