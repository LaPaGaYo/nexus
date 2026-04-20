import type { NexusAdapterContext } from '../../adapters/types';
import { getAbsorbedStageSections, renderChecklist } from '../render';

export function buildQaReport(
  _ctx: NexusAdapterContext,
  ready: boolean,
  findings: string[],
  advisories: string[] = [],
): string {
  const sections = getAbsorbedStageSections('qa');

  return [
    '# QA Report',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderChecklist('Validation Checklist', sections.checklist).trimEnd(),
    '## Findings',
    '',
    ...(findings.length > 0 ? findings.map((finding) => `- ${finding}`) : ['- none']),
    '',
    '## Advisories',
    '',
    ...(advisories.length > 0 ? advisories.map((advisory) => `- ${advisory}`) : ['- none']),
    '',
    '## Canonical Artifact Contract',
    '',
    sections.artifact_contract,
    '',
    '## Routing and Governance',
    '',
    sections.routing,
    '',
    `Result: ${ready ? 'pass' : 'fail'}`,
    '',
  ].join('\n');
}
