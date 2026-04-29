import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';
import { COMMANDS } from '../src/commands';

const ROOT = join(import.meta.dir, '..');
const REFERENCES_ROOT = join(ROOT, '..', '..', 'references', 'design');

describe('absorbed design runtime assets', () => {
  test('registers absorbed exporter and verification commands', () => {
    for (const command of ['export-pdf', 'export-pptx', 'render-video', 'convert-video', 'add-music', 'verify-html']) {
      expect(COMMANDS.has(command)).toBe(true);
    }
  });

  test('ships absorbed runtime scripts, references, and starter assets', () => {
    const requiredPaths = [
      'scripts/html2pptx.js',
      'scripts/export_deck_pptx.mjs',
      'scripts/export_deck_pdf.mjs',
      'scripts/export_deck_stage_pdf.mjs',
      'scripts/render-video.js',
      'scripts/convert-formats.sh',
      'scripts/add-music.sh',
      'scripts/verify.py',
      'assets/design_canvas.jsx',
      'assets/deck_stage.js',
      'assets/ios_frame.jsx',
      'assets/android_frame.jsx',
      'assets/browser_window.jsx',
      'assets/macos_window.jsx',
      'assets/animations.jsx',
      'assets/deck_index.html',
      'assets/bgm-ad.mp3',
      'assets/bgm-tech.mp3',
      'assets/bgm-tutorial.mp3',
    ];

    for (const relativePath of requiredPaths) {
      expect(existsSync(join(ROOT, relativePath))).toBe(true);
    }

    for (const relativePath of [
      'editable-pptx.md',
      'video-export.md',
      'verification.md',
      'slide-decks.md',
      'tweaks-system.md',
      'animations.md',
      'design-context.md',
    ]) {
      expect(existsSync(join(REFERENCES_ROOT, relativePath))).toBe(true);
    }
  });

  test('render-video script loads under the repo ESM package boundary', () => {
    const proc = Bun.spawnSync({
      cmd: ['node', join(ROOT, 'scripts/render-video.js')],
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stderr = proc.stderr.toString();
    expect(proc.exitCode).toBe(1);
    expect(stderr).toContain('Usage: node render-video.js <html-file>');
    expect(stderr).not.toContain('ReferenceError: require is not defined');
  });
});
