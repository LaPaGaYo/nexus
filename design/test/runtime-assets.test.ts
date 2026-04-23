import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';
import { COMMANDS } from '../src/commands';

const ROOT = join(import.meta.dir, '..');

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
      'references/editable-pptx.md',
      'references/video-export.md',
      'references/verification.md',
      'references/slide-decks.md',
      'references/tweaks-system.md',
      'references/animations.md',
      'references/design-context.md',
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
  });
});
