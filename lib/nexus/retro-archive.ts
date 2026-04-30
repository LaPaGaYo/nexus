import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  discoverRetroContinuityJsonPath,
  discoverRetroContinuityMarkdownPath,
  retroArchiveRootPath,
} from './artifacts';
import { readJsonPartial } from './validation-helpers';
import type {
  ArtifactPointer,
  DiscoverRetroContinuityRecord,
  RepoRetroArchiveRecord,
} from './types';

type RetroArchiveCandidate = {
  path: string;
  mtimeMs: number;
};

type ParsedRetroArchive = {
  path: string;
  summary: string;
  keyFindings: string[];
  recommendedAttentionAreas: string[];
};

function artifactPointerFor(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

function listCanonicalRetroArchiveCandidates(cwd: string): RetroArchiveCandidate[] {
  const archiveRoot = join(cwd, retroArchiveRootPath());
  if (!existsSync(archiveRoot)) {
    return [];
  }

  return readdirSync(archiveRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const path = `${retroArchiveRootPath()}/${entry.name}/retro.json`;
      const absolutePath = join(archiveRoot, entry.name, 'retro.json');
      if (!existsSync(absolutePath)) {
        return [];
      }

      return [{
        path,
        mtimeMs: statSync(absolutePath).mtimeMs,
      }];
    });
}

function listLegacyRetroArchiveCandidates(cwd: string): RetroArchiveCandidate[] {
  const legacyRoot = join(cwd, '.context', 'retros');
  if (!existsSync(legacyRoot)) {
    return [];
  }

  return readdirSync(legacyRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => ({
      path: `.context/retros/${entry.name}`,
      mtimeMs: statSync(join(legacyRoot, entry.name)).mtimeMs,
    }));
}

function parseCanonicalRetroArchiveRecord(
  path: string,
  parsed: Partial<RepoRetroArchiveRecord>,
): ParsedRetroArchive | null {
  if (
    parsed.schema_version !== 1
    || typeof parsed.retro_id !== 'string'
    || typeof parsed.summary !== 'string'
    || !Array.isArray(parsed.key_findings)
    || !Array.isArray(parsed.recommended_attention_areas)
  ) {
    return null;
  }

  return {
    path,
    summary: parsed.summary,
    keyFindings: parsed.key_findings.filter((finding): finding is string => typeof finding === 'string'),
    recommendedAttentionAreas: parsed.recommended_attention_areas.filter(
      (area): area is string => typeof area === 'string',
    ),
  };
}

function parseLegacyRetroArchiveRecord(path: string, parsed: Record<string, unknown>): ParsedRetroArchive | null {
  const tweetable = typeof parsed.tweetable === 'string' ? parsed.tweetable : null;
  const date = typeof parsed.date === 'string' ? parsed.date : null;
  const window = typeof parsed.window === 'string' ? parsed.window : null;
  const summary = tweetable ?? (date || window
    ? `Legacy retrospective snapshot${date ? ` from ${date}` : ''}${window ? ` (${window})` : ''}.`
    : null);

  if (!summary) {
    return null;
  }

  return {
    path,
    summary,
    keyFindings: tweetable ? [tweetable] : [],
    recommendedAttentionAreas: [],
  };
}

function readParsedRetroArchive(cwd: string, path: string): ParsedRetroArchive | null {
  const parsed = readJsonPartial<RepoRetroArchiveRecord>(join(cwd, path));
  if (parsed === null) {
    return null;
  }
  return parseCanonicalRetroArchiveRecord(path, parsed)
    ?? parseLegacyRetroArchiveRecord(path, parsed as Record<string, unknown>);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export function buildDiscoverRetroContinuity(input: {
  cwd: string;
  runId: string;
  generatedAt: string;
  limit?: number;
}): {
  record: DiscoverRetroContinuityRecord;
  sourceArtifacts: ArtifactPointer[];
  outputArtifacts: ArtifactPointer[];
} | null {
  const selected = [
    ...listCanonicalRetroArchiveCandidates(input.cwd),
    ...listLegacyRetroArchiveCandidates(input.cwd),
  ]
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .map((candidate) => readParsedRetroArchive(input.cwd, candidate.path))
    .filter((record): record is ParsedRetroArchive => record !== null)
    .slice(0, input.limit ?? 3);

  if (selected.length === 0) {
    return null;
  }

  const sourceArtifacts = selected.map((record) => artifactPointerFor(record.path));
  const recentFindings = uniqueStrings(selected.flatMap((record) => record.keyFindings)).slice(0, 6);
  const recommendedAttentionAreas = uniqueStrings(
    selected.flatMap((record) => record.recommendedAttentionAreas),
  ).slice(0, 6);

  return {
    record: {
      schema_version: 1,
      run_id: input.runId,
      generated_at: input.generatedAt,
      source_retro_artifacts: sourceArtifacts.map((artifact) => artifact.path),
      recent_findings: recentFindings,
      recommended_attention_areas: recommendedAttentionAreas,
      summary: `Fresh run is continuing with ${selected.length} recent retrospective${selected.length === 1 ? '' : 's'} as historical context.`,
    },
    sourceArtifacts,
    outputArtifacts: [
      artifactPointerFor(discoverRetroContinuityJsonPath()),
      artifactPointerFor(discoverRetroContinuityMarkdownPath()),
    ],
  };
}

export function renderDiscoverRetroContinuityMarkdown(record: DiscoverRetroContinuityRecord): string {
  const findings = record.recent_findings.length > 0
    ? record.recent_findings.map((finding) => `- ${finding}`)
    : ['- none'];
  const attentionAreas = record.recommended_attention_areas.length > 0
    ? record.recommended_attention_areas.map((area) => `- ${area}`)
    : ['- none'];

  return [
    '# Retro Continuity',
    '',
    `- Source retros: ${record.source_retro_artifacts.length}`,
    '',
    '## Summary',
    '',
    record.summary,
    '',
    '## Recent Findings',
    '',
    ...findings,
    '',
    '## Recommended Attention Areas',
    '',
    ...attentionAreas,
    '',
    '## Source Retro Artifacts',
    '',
    ...record.source_retro_artifacts.map((artifact) => `- ${artifact}`),
    '',
  ].join('\n');
}
