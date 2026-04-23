import { describe, expect, test } from 'bun:test';
import { COMMANDS } from '../src/commands';

describe('design command registry', () => {
  test('generate and check commands describe the broader deliverable runtime', () => {
    const generate = COMMANDS.get('generate');
    const check = COMMANDS.get('check');
    const evolve = COMMANDS.get('evolve');

    expect(generate).toBeDefined();
    expect(generate?.description).toBe('Generate a design deliverable frame from a design brief');

    expect(check).toBeDefined();
    expect(check?.description).toBe('Vision-based quality check on a design deliverable');
    expect(check?.usage).toContain('--brief-file');
    expect(check?.flags).toContain('--brief-file');

    expect(evolve).toBeDefined();
    expect(evolve?.usage).toContain('--brief-file');
    expect(evolve?.flags).toContain('--brief-file');
  });

  test('extract stays non-persistent by default and exposes an explicit DESIGN.md write flag', () => {
    const extract = COMMANDS.get('extract');
    expect(extract).toBeDefined();
    expect(extract?.description).toBe('Extract design language from an approved mockup');
    expect(extract?.usage).toContain('--write-design-md');
    expect(extract?.flags).toContain('--write-design-md');
  });

  test('absorbed exporter and verification commands are user-visible', () => {
    expect(COMMANDS.get('export-pdf')?.description).toBe('Export an HTML slide deck to PDF');
    expect(COMMANDS.get('export-pptx')?.description).toBe('Export HTML slides to editable PPTX');
    expect(COMMANDS.get('render-video')?.description).toBe('Render an animation HTML file to MP4');
    expect(COMMANDS.get('convert-video')?.description).toBe('Derive 60fps MP4 and optimized GIF from a rendered MP4');
    expect(COMMANDS.get('add-music')?.description).toBe('Mix a BGM track into a rendered MP4');
    expect(COMMANDS.get('verify-html')?.description).toBe('Verify rendered HTML output via Playwright screenshots and console checks');
  });
});
