import { describe, expect, test } from 'bun:test';
import { shellQuotePosix } from '../../../lib/nexus/io/shell-quote';

describe('shellQuotePosix', () => {
  test('returns common git refs unquoted', () => {
    expect(shellQuotePosix('origin')).toBe('origin');
    expect(shellQuotePosix('main')).toBe('main');
    expect(shellQuotePosix('feature/phase-2-auth')).toBe('feature/phase-2-auth');
    expect(shellQuotePosix('release/2026.04.30')).toBe('release/2026.04.30');
    expect(shellQuotePosix('user@host:repo.git')).toBe('user@host:repo.git');
    expect(shellQuotePosix('o')).toBe('o');
  });

  test('quotes the empty string', () => {
    expect(shellQuotePosix('')).toBe(`''`);
  });

  test('quotes shell metacharacters', () => {
    expect(shellQuotePosix('foo;ls -la')).toBe(`'foo;ls -la'`);
    expect(shellQuotePosix('foo bar')).toBe(`'foo bar'`);
    expect(shellQuotePosix('foo&bar')).toBe(`'foo&bar'`);
    expect(shellQuotePosix('foo|bar')).toBe(`'foo|bar'`);
    expect(shellQuotePosix('$FOO')).toBe(`'$FOO'`);
    expect(shellQuotePosix('`whoami`')).toBe(`'\`whoami\`'`);
    expect(shellQuotePosix('foo>bar')).toBe(`'foo>bar'`);
    expect(shellQuotePosix('foo<bar')).toBe(`'foo<bar'`);
    expect(shellQuotePosix('foo*bar')).toBe(`'foo*bar'`);
    expect(shellQuotePosix('foo?bar')).toBe(`'foo?bar'`);
    expect(shellQuotePosix('foo(bar)')).toBe(`'foo(bar)'`);
  });

  test('escapes embedded single quotes', () => {
    expect(shellQuotePosix(`it's`)).toBe(`'it'\\''s'`);
    expect(shellQuotePosix(`'`)).toBe(`''\\'''`);
    expect(shellQuotePosix(`a'b'c`)).toBe(`'a'\\''b'\\''c'`);
  });

  test('quotes leading dash so the value cannot be parsed as a flag', () => {
    expect(shellQuotePosix('-rf')).toBe(`'-rf'`);
    expect(shellQuotePosix('--upload-pack=evil')).toBe(`'--upload-pack=evil'`);
  });

  test('rejects whitespace and control characters', () => {
    expect(shellQuotePosix('foo\nbar')).toBe(`'foo\nbar'`);
    expect(shellQuotePosix('foo\tbar')).toBe(`'foo\tbar'`);
  });
});
