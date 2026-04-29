import { describe, expect, test } from 'bun:test';
import fs from 'fs';
import path from 'path';
import {
  buildDesignRuntimeDoctorReport,
  formatDesignRuntimeDoctorReport,
  resolveDesignRuntimeRoot,
  type DesignRuntimeDoctorProbe,
} from '../src/doctor';

function createProbe(overrides: Partial<DesignRuntimeDoctorProbe> = {}): DesignRuntimeDoctorProbe {
  return {
    which: () => '/usr/bin/fake',
    packageInstalled: () => true,
    playwrightBrowserInstalled: () => true,
    pythonPlaywrightImportable: () => true,
    ...overrides,
  };
}

describe('design runtime doctor', () => {
  test('finds the Nexus runtime root from nested design binary paths', () => {
    const tmpRoot = `/tmp/design-doctor-root-${Date.now()}`;
    fs.mkdirSync(path.join(tmpRoot, 'runtimes', 'design', 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'runtimes', 'design', 'assets'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'runtimes', 'design', 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'package.json'), '{"name":"nexus"}');

    const resolved = resolveDesignRuntimeRoot([path.join(tmpRoot, 'runtimes', 'design', 'dist', 'design')]);
    expect(resolved).toBe(tmpRoot);

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('reports ready when the absorbed runtime is fully available', () => {
    const report = buildDesignRuntimeDoctorReport(createProbe());

    expect(report.status).toBe('ready');
    expect(report.capabilities.slides_export.status).toBe('ready');
    expect(report.capabilities.motion_export.status).toBe('ready');
    expect(report.capabilities.html_verification.status).toBe('ready');
    expect(report.remediation).toEqual([]);
  });

  test('reports degraded capabilities and remediation when motion and verification deps are missing', () => {
    const report = buildDesignRuntimeDoctorReport(createProbe({
      which: (command) => {
        if (command === 'ffmpeg') return null;
        return '/usr/bin/fake';
      },
      pythonPlaywrightImportable: () => false,
    }));

    expect(report.status).toBe('degraded');
    expect(report.checks.ffmpeg.status).toBe('missing');
    expect(report.checks.python_playwright.status).toBe('missing');
    expect(report.capabilities.motion_export.status).toBe('degraded');
    expect(report.capabilities.html_verification.status).toBe('degraded');
    expect(report.remediation.some((step) => step.includes('ffmpeg'))).toBe(true);
    expect(report.remediation.some((step) => step.includes('python3 -m pip install playwright'))).toBe(true);

    const formatted = formatDesignRuntimeDoctorReport(report);
    expect(formatted).toContain('Nexus design runtime: DEGRADED');
    expect(formatted).toContain('Missing requirements:');
    expect(formatted).toContain('Suggested fixes:');
  });
});
