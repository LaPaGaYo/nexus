import { describe, it, expect } from 'bun:test';

// ─── BrowserManager basic unit tests ─────────────────────────────

describe('BrowserManager defaults', () => {
  it('getConnectionMode defaults to launched', async () => {
    const { BrowserManager } = await import('../src/browser-manager');
    const bm = new BrowserManager();
    expect(bm.getConnectionMode()).toBe('launched');
  });

  it('getRefMap returns empty array initially', async () => {
    const { BrowserManager } = await import('../src/browser-manager');
    const bm = new BrowserManager();
    expect(bm.getRefMap()).toEqual([]);
  });

  it('finds the moved extension source before legacy compatibility paths', async () => {
    const { BrowserManager } = await import('../src/browser-manager');
    const bm = new BrowserManager();
    const extensionPath = (bm as any).findExtensionPath();
    expect(extensionPath?.endsWith('runtimes/browse/extension')).toBe(true);
  });
});
