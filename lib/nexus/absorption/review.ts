import { getAbsorbedStageSections, renderChecklist } from './render';

type DefaultReviewAuditSlot = 'codex' | 'gemini' | 'local_a' | 'local_b';

function headerFor(slot: DefaultReviewAuditSlot): string {
  switch (slot) {
    case 'codex':
      return '# Codex Audit';
    case 'gemini':
      return '# Gemini Audit';
    case 'local_a':
      return '# Local Audit A';
    case 'local_b':
      return '# Local Audit B';
  }
}

export function buildReviewAuditMarkdown(slot: DefaultReviewAuditSlot): string {
  const sections = getAbsorbedStageSections('review');

  return [
    headerFor(slot),
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderChecklist('Audit Checklist', sections.checklist).trimEnd(),
    '## Findings',
    '',
    '- none',
    '',
    '## Routing and Governance',
    '',
    sections.routing,
    '',
    'Result: pass',
    '',
  ].join('\n');
}
