#!/usr/bin/env bun
/**
 * Type-check ratchet gate.
 *
 * The repo adopted `tsc` on a codebase that never had it (~46 pre-existing
 * strict errors in lib/**). Fixing all of them first is milestone-scale, so
 * this gate uses the standard "ratchet baseline" pattern: it records the
 * current error set as a baseline and fails CI only on NEW errors beyond it.
 * Existing errors become a tracked burndown; new type errors cannot merge.
 *
 * Error signatures are `file|TScode|message` (NO line/column) so the baseline
 * is robust to line-number churn from unrelated edits.
 *
 *   bun run scripts/repo/typecheck.ts            # update the baseline
 *   bun run scripts/repo/typecheck.ts --check    # CI gate: fail on NEW errors
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..', '..');
const BASELINE_PATH = 'scripts/repo/typecheck-baseline.json';
const TSCONFIG = 'tsconfig.json';

function runTsc(): string {
  // Array argv (no shell) — same safe pattern as path-inventory.ts.
  const result = Bun.spawnSync(['bunx', 'tsc', '-p', TSCONFIG, '--noEmit'], { cwd: ROOT });
  return (
    new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr)
  );
}

const ERROR_LINE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;

/** Stable signature ignoring line/column so unrelated edits don't churn it. */
function toSignature(file: string, code: string, message: string): string {
  return `${file}|${code}|${message}`;
}

function parseSignatures(output: string): string[] {
  const sigs: string[] = [];
  for (const line of output.split('\n')) {
    const m = ERROR_LINE.exec(line.trim());
    if (!m) continue;
    const [, file, , , code, message] = m;
    sigs.push(toSignature(file, code, message));
  }
  return sigs;
}

/** Multiset excess: how many of each signature appear in `a` beyond `b`. */
function countExcess(a: string[], b: string[]): Map<string, number> {
  const bCounts = new Map<string, number>();
  for (const s of b) bCounts.set(s, (bCounts.get(s) ?? 0) + 1);
  const aCounts = new Map<string, number>();
  for (const s of a) aCounts.set(s, (aCounts.get(s) ?? 0) + 1);
  const excess = new Map<string, number>();
  for (const [s, n] of aCounts) {
    const over = n - (bCounts.get(s) ?? 0);
    if (over > 0) excess.set(s, over);
  }
  return excess;
}

const check = process.argv.includes('--check');
const output = runTsc();
const current = parseSignatures(output).sort();
const baselineAbs = join(ROOT, BASELINE_PATH);
const baseline: string[] = existsSync(baselineAbs)
  ? (JSON.parse(readFileSync(baselineAbs, 'utf8')).errors ?? [])
  : [];

if (check) {
  const added = countExcess(current, baseline);
  const fixed = countExcess(baseline, current);

  if (added.size > 0) {
    const total = [...added.values()].reduce((a, b) => a + b, 0);
    console.error(`x ${total} NEW type error(s) beyond the baseline:\n`);
    for (const sig of [...added.keys()].sort()) {
      const [file, code, message] = sig.split('|');
      console.error(`  ${file}: ${code} ${message}`);
    }
    console.error(`\nFix them, or (if intentional debt) run \`bun run typecheck\` to rebaseline.`);
    process.exit(1);
  }

  if (fixed.size > 0) {
    const total = [...fixed.values()].reduce((a, b) => a + b, 0);
    console.log(
      `ok no new type errors. ${total} baselined error(s) appear fixed — `
      + `run \`bun run typecheck\` to shrink the baseline.`,
    );
  } else {
    console.log(`ok no new type errors (baseline: ${baseline.length}).`);
  }
} else {
  writeFileSync(
    baselineAbs,
    JSON.stringify(
      {
        _comment:
          'Type-check ratchet baseline. Pre-existing strict errors tolerated by '
          + 'scripts/repo/typecheck.ts --check; new errors beyond this set fail CI. '
          + 'This list should only shrink. Do not hand-edit; run `bun run typecheck`.',
        config: TSCONFIG,
        count: current.length,
        errors: current,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Wrote ${BASELINE_PATH} (${current.length} baselined error(s)).`);
}
