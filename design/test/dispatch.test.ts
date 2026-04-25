import { describe, expect, test } from 'bun:test';
import { dispatchDesignCommand, DesignCliUsageError, type DesignDispatchDeps } from '../src/dispatch';
import type { DesignRuntimeDoctorReport } from '../src/doctor';

interface RecordedCall {
  kind: string;
  script?: string;
  args?: string[];
}

function createDeps() {
  const calls: RecordedCall[] = [];
  const doctorReport: DesignRuntimeDoctorReport = {
    status: 'ready',
    checks: {},
    capabilities: {
      slides_export: { status: 'ready', detail: 'slides ok' },
      motion_export: { status: 'ready', detail: 'motion ok' },
      html_verification: { status: 'ready', detail: 'verify ok' },
    },
    remediation: [],
  };

  const deps: DesignDispatchDeps = {
    generate: async () => undefined as never,
    checkCommand: async () => undefined as never,
    compare: () => undefined as never,
    variants: async () => undefined as never,
    iterate: async () => undefined as never,
    extractDesignLanguage: async () => ({}) as never,
    updateDesignMd: () => undefined as never,
    diffMockups: async () => ({}) as never,
    verifyAgainstMockup: async () => ({ matchScore: 100, pass: true }) as never,
    evolve: async () => undefined as never,
    generateDesignToCodePrompt: async () => ({}) as never,
    serve: async () => undefined as never,
    gallery: () => undefined as never,
    runDesignNodeScript: async (script, args) => {
      calls.push({ kind: 'node', script, args });
      return undefined as never;
    },
    runDesignPythonScript: async (script, args) => {
      calls.push({ kind: 'python', script, args });
      return undefined as never;
    },
    runDesignShellScript: async (script, args) => {
      calls.push({ kind: 'shell', script, args });
      return undefined as never;
    },
    buildDesignRuntimeDoctorReport: () => doctorReport,
    formatDesignRuntimeDoctorReport: () => 'FORMATTED REPORT',
    resolveImagePaths: async () => [],
  };

  return { deps, calls, doctorReport };
}

async function captureStdout(run: () => Promise<void>): Promise<string[]> {
  const messages: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    messages.push(args.map((arg) => String(arg)).join(' '));
  };
  try {
    await run();
  } finally {
    console.log = originalLog;
  }
  return messages;
}

describe('design command dispatch', () => {
  test('routes html pdf export through the stage pdf helper', async () => {
    const { deps, calls } = createDeps();

    await dispatchDesignCommand('export-pdf', {
      html: '/tmp/deck.html',
      out: '/tmp/deck.pdf',
      width: '1920',
    }, deps);

    expect(calls).toEqual([
      {
        kind: 'node',
        script: 'export_deck_stage_pdf.mjs',
        args: ['--html', '/tmp/deck.html', '--out', '/tmp/deck.pdf', '--width', '1920'],
      },
    ]);
  });

  test('routes slides pdf export through the slide deck helper', async () => {
    const { deps, calls } = createDeps();

    await dispatchDesignCommand('export-pdf', {
      slides: '/tmp/slides',
      out: '/tmp/deck.pdf',
      height: '1080',
    }, deps);

    expect(calls).toEqual([
      {
        kind: 'node',
        script: 'export_deck_pdf.mjs',
        args: ['--slides', '/tmp/slides', '--out', '/tmp/deck.pdf', '--height', '1080'],
      },
    ]);
  });

  test('doctor prints a human report by default', async () => {
    const { deps } = createDeps();

    const output = await captureStdout(() => dispatchDesignCommand('doctor', {}, deps));
    expect(output).toEqual(['FORMATTED REPORT']);
  });

  test('doctor can emit machine-readable json', async () => {
    const { deps, doctorReport } = createDeps();

    const output = await captureStdout(() => dispatchDesignCommand('doctor', { json: true }, deps));
    expect(JSON.parse(output[0])).toEqual(doctorReport);
  });

  test('verify-html requires html input', async () => {
    const { deps } = createDeps();

    await expect(dispatchDesignCommand('verify-html', {}, deps)).rejects.toBeInstanceOf(DesignCliUsageError);
  });
});
