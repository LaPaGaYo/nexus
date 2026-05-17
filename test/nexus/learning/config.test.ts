import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { isMirrorEnabled } from '../../../lib/nexus/learning/config';

let stateDir: string;
beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), 'sp1-cfg-'));
  process.env.NEXUS_STATE_DIR = stateDir;
});
afterEach(() => {
  delete process.env.NEXUS_STATE_DIR;
  rmSync(stateDir, { recursive: true, force: true });
});

describe('isMirrorEnabled', () => {
  test('default: disabled when no config file', () => {
    expect(isMirrorEnabled()).toBe(false);
  });

  test('explicit true enables', () => {
    writeFileSync(join(stateDir, 'config.yaml'), 'learning:\n  mirror_on_closeout: true\n');
    expect(isMirrorEnabled()).toBe(true);
  });

  test('explicit false disables', () => {
    writeFileSync(join(stateDir, 'config.yaml'), 'learning:\n  mirror_on_closeout: false\n');
    expect(isMirrorEnabled()).toBe(false);
  });

  test('learning key absent: disabled (default off)', () => {
    writeFileSync(join(stateDir, 'config.yaml'), 'something_else: value\n');
    expect(isMirrorEnabled()).toBe(false);
  });

  test('learning key present but mirror_on_closeout absent: disabled', () => {
    writeFileSync(join(stateDir, 'config.yaml'), 'learning:\n  other_key: value\n');
    expect(isMirrorEnabled()).toBe(false);
  });

  test('malformed yaml: fail soft to false', () => {
    writeFileSync(join(stateDir, 'config.yaml'), 'learning:\n  mirror_on_closeout: [\n');
    expect(isMirrorEnabled()).toBe(false);
  });

  test('string "true" (truthy but not boolean): rejected as not-strict-true', () => {
    writeFileSync(join(stateDir, 'config.yaml'), 'learning:\n  mirror_on_closeout: "true"\n');
    expect(isMirrorEnabled()).toBe(false);
  });

  test('non-string non-boolean (e.g., number 1): rejected', () => {
    writeFileSync(join(stateDir, 'config.yaml'), 'learning:\n  mirror_on_closeout: 1\n');
    expect(isMirrorEnabled()).toBe(false);
  });
});
