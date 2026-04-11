import { describe, expect, test } from 'bun:test';
import {
  buildMaintainerLoopReport,
  renderMaintainerLoopMarkdown,
  validateMaintainerLoopReport,
  type MaintainerLoopReport,
} from '../../lib/nexus/maintainer-loop';

describe('nexus maintainer loop contract', () => {
  test('freezes the maintainer report shape', () => {
    const report: MaintainerLoopReport = {
      schema_version: 1,
      generated_at: '2026-04-10T12:00:00.000Z',
      status: 'action_required',
      next_action: 'review_refresh_candidate',
      summary: '1 upstream refresh candidate needs maintainer review.',
      issues: ['pm-skills refresh candidate pending review'],
      recommendations: ['Review upstream-notes/refresh-candidates/pm-skills.md'],
      upstreams: {
        pending_refresh_candidates: ['pm-skills'],
        behind_upstreams: ['gsd'],
      },
      release: {
        current_version: '1.0.1',
        current_tag: 'v1.0.1',
        preflight_status: 'ready',
        remote_smoke_status: 'ready',
      },
    };

    expect(validateMaintainerLoopReport(report)).toEqual(report);
  });

  test('prefers refresh-candidate review before other maintainer actions', () => {
    const report = buildMaintainerLoopReport({
      generatedAt: '2026-04-10T12:00:00.000Z',
      upstreams: {
        pending_refresh_candidates: ['pm-skills'],
        behind_upstreams: ['gsd'],
      },
      release: {
        current_version: '1.0.1',
        current_tag: 'v1.0.1',
        preflight_status: 'ready',
        remote_smoke_status: 'ready',
      },
    });

    expect(report.status).toBe('action_required');
    expect(report.next_action).toBe('review_refresh_candidate');
    expect(report.summary).toContain('refresh candidate');
  });

  test('blocks when published release smoke is failing', () => {
    const report = buildMaintainerLoopReport({
      generatedAt: '2026-04-10T12:00:00.000Z',
      upstreams: {
        pending_refresh_candidates: [],
        behind_upstreams: [],
      },
      release: {
        current_version: '1.0.1',
        current_tag: 'v1.0.1',
        preflight_status: 'ready',
        remote_smoke_status: 'blocked',
      },
    });

    expect(report.status).toBe('blocked');
    expect(report.next_action).toBe('repair_published_release');
    expect(renderMaintainerLoopMarkdown(report)).toContain('# Nexus Maintainer Status');
  });

  test('requests upstream refresh when no candidate is pending and an upstream is behind', () => {
    const report = buildMaintainerLoopReport({
      generatedAt: '2026-04-10T12:00:00.000Z',
      upstreams: {
        pending_refresh_candidates: [],
        behind_upstreams: ['gsd'],
      },
      release: {
        current_version: '1.0.1',
        current_tag: 'v1.0.1',
        preflight_status: 'ready',
        remote_smoke_status: 'ready',
      },
      local_release_drift: false,
      published_release_missing: false,
    });

    expect(report.status).toBe('action_required');
    expect(report.next_action).toBe('refresh_upstream');
  });

  test('requests release publication when local release drift is ready but not published', () => {
    const report = buildMaintainerLoopReport({
      generatedAt: '2026-04-10T12:00:00.000Z',
      upstreams: {
        pending_refresh_candidates: [],
        behind_upstreams: [],
      },
      release: {
        current_version: '1.0.2',
        current_tag: 'v1.0.2',
        preflight_status: 'ready',
        remote_smoke_status: 'unknown',
      },
      unpublished_local_release: true,
      local_release_drift: true,
      published_release_missing: true,
    });

    expect(report.status).toBe('action_required');
    expect(report.next_action).toBe('publish_release');
  });

  test('requests release publication when local release markers are ready and the tag is not created yet', () => {
    const report = buildMaintainerLoopReport({
      generatedAt: '2026-04-10T12:00:00.000Z',
      upstreams: {
        pending_refresh_candidates: [],
        behind_upstreams: [],
      },
      release: {
        current_version: '1.0.2',
        current_tag: 'v1.0.2',
        preflight_status: 'ready',
        remote_smoke_status: 'unknown',
      },
      unpublished_local_release: true,
    });

    expect(report.status).toBe('action_required');
    expect(report.next_action).toBe('publish_release');
  });
});
