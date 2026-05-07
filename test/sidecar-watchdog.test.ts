/**
 * Tests for the sidebar-agent self-watchdog (issue #136).
 *
 * These exercise `startSelfWatchdog` from runtimes/browse/src/sidebar-agent.ts
 * with real filesystem operations on a temp file. The polling interval is
 * shrunk to keep tests fast; the production caller uses 60s.
 *
 * Lives under test/ (not runtimes/browse/test/) because the watchdog is
 * hermetic logic — no Chromium, no Playwright, no headed browser. The
 * unit-tests.yml workflow's top-level matrix cell picks it up.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startSelfWatchdog } from '../runtimes/browse/src/sidebar-agent';

function mkTempScript(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-sidecar-watchdog-'));
  const file = path.join(dir, 'fake-sidebar-agent.ts');
  fs.writeFileSync(file, '// fake sidebar agent for watchdog tests\n');
  return file;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('startSelfWatchdog (#136 sidecar orphan defense)', () => {
  let tempFile: string;
  let stops: Array<() => void>;

  beforeEach(() => {
    tempFile = mkTempScript();
    stops = [];
  });

  afterEach(() => {
    for (const stop of stops) stop();
    try {
      fs.rmSync(path.dirname(tempFile), { recursive: true, force: true });
    } catch { /* ignore cleanup failures */ }
  });

  test('does NOT fire onMissing while the file still exists', async () => {
    let fired = false;
    const { stop } = startSelfWatchdog({
      selfPath: tempFile,
      pollIntervalMs: 50,
      onMissing: () => { fired = true; },
    });
    stops.push(stop);

    await sleep(200); // 4 poll cycles
    expect(fired).toBe(false);
  });

  test('fires onMissing within one poll cycle when file is removed', async () => {
    let fired = false;
    const { stop } = startSelfWatchdog({
      selfPath: tempFile,
      pollIntervalMs: 50,
      onMissing: () => { fired = true; },
    });
    stops.push(stop);

    fs.unlinkSync(tempFile);
    await sleep(200); // a few poll cycles to be safe across fs.watch jitter
    expect(fired).toBe(true);
  });

  test('fires onMissing exactly once even if file remains gone across many polls', async () => {
    let fireCount = 0;
    const { stop } = startSelfWatchdog({
      selfPath: tempFile,
      pollIntervalMs: 25,
      onMissing: () => { fireCount += 1; },
    });
    stops.push(stop);

    fs.unlinkSync(tempFile);
    await sleep(300); // 12 poll cycles after removal
    expect(fireCount).toBe(1);
  });

  test('falls back to polling when fs.watch throws on the platform', async () => {
    // Simulate a platform / FS where fs.watch is unsupported (some
    // network mounts, certain Linux containers, etc.). The watchdog
    // should still detect removal via polling.
    const fsImpl = {
      existsSync: fs.existsSync,
      watch: ((..._args: unknown[]) => {
        throw new Error('simulated: fs.watch not supported');
      }) as unknown as typeof fs.watch,
    };

    let fired = false;
    const { stop } = startSelfWatchdog({
      selfPath: tempFile,
      pollIntervalMs: 25,
      onMissing: () => { fired = true; },
      fsImpl,
    });
    stops.push(stop);

    fs.unlinkSync(tempFile);
    await sleep(150);
    expect(fired).toBe(true);
  });

  test('stop() prevents firing even after the file disappears', async () => {
    let fired = false;
    const { stop } = startSelfWatchdog({
      selfPath: tempFile,
      pollIntervalMs: 25,
      onMissing: () => { fired = true; },
    });

    stop();
    fs.unlinkSync(tempFile);
    await sleep(150);
    expect(fired).toBe(false);
  });
});
