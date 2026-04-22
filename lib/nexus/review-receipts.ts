import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import {
  reviewAttemptsRootPath,
  reviewAttemptAuditMarkdownPath,
  reviewAttemptAuditReceiptPath,
} from './artifacts';
import type {
  ActualRouteRecord,
  ReviewAuditReceiptRecord,
  ReviewRequestedRouteRecord,
} from './types';

function writeJson(path: string, value: unknown): void {
  const tempPath = `${path}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tempPath, path);
}

function writeMarkdown(path: string, content: string): void {
  const tempPath = `${path}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tempPath, content.endsWith('\n') ? content : `${content}\n`);
  renameSync(tempPath, path);
}

export function buildReviewAuditReceiptRecord(input: {
  review_attempt_id: string;
  provider: 'codex' | 'gemini';
  request_id: string | null;
  generated_at: string;
  requested_route: ReviewRequestedRouteRecord;
  actual_route: ActualRouteRecord | null;
  verdict: 'pass' | 'fail';
  markdown_path: string;
}): ReviewAuditReceiptRecord {
  return {
    schema_version: 1,
    review_attempt_id: input.review_attempt_id,
    provider: input.provider,
    request_id: input.request_id,
    generated_at: input.generated_at,
    requested_route: input.requested_route,
    actual_route: input.actual_route,
    verdict: input.verdict,
    markdown_path: input.markdown_path,
  };
}

export function persistReviewAuditReceipt(input: {
  cwd: string;
  review_attempt_id: string;
  provider: 'codex' | 'gemini';
  markdown: string;
  record: ReviewAuditReceiptRecord;
}): { markdownPath: string; receiptPath: string } {
  const markdownPath = reviewAttemptAuditMarkdownPath(input.review_attempt_id, input.provider);
  const receiptPath = reviewAttemptAuditReceiptPath(input.review_attempt_id, input.provider);
  writeMarkdown(join(input.cwd, markdownPath), input.markdown);
  writeJson(join(input.cwd, receiptPath), input.record);
  return { markdownPath, receiptPath };
}

export function listReviewAttemptIds(cwd: string): string[] {
  const attemptsRoot = join(cwd, reviewAttemptsRootPath());
  if (!existsSync(attemptsRoot)) {
    return [];
  }

  return readdirSync(attemptsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function listReviewAttemptReceiptPaths(cwd: string, reviewAttemptId: string): string[] {
  return [
    reviewAttemptAuditMarkdownPath(reviewAttemptId, 'codex'),
    reviewAttemptAuditReceiptPath(reviewAttemptId, 'codex'),
    reviewAttemptAuditMarkdownPath(reviewAttemptId, 'gemini'),
    reviewAttemptAuditReceiptPath(reviewAttemptId, 'gemini'),
  ].filter((relativePath) => existsSync(join(cwd, relativePath)));
}

export function readReviewAuditReceipt(input: {
  cwd: string;
  review_attempt_id: string;
  provider: 'codex' | 'gemini';
}): { markdownPath: string; receiptPath: string; markdown: string; record: ReviewAuditReceiptRecord } | null {
  const markdownPath = reviewAttemptAuditMarkdownPath(input.review_attempt_id, input.provider);
  const receiptPath = reviewAttemptAuditReceiptPath(input.review_attempt_id, input.provider);
  const absoluteMarkdownPath = join(input.cwd, markdownPath);
  const absoluteReceiptPath = join(input.cwd, receiptPath);

  if (!existsSync(absoluteMarkdownPath) || !existsSync(absoluteReceiptPath)) {
    return null;
  }

  const record = JSON.parse(readFileSync(absoluteReceiptPath, 'utf8')) as ReviewAuditReceiptRecord;
  const markdown = readFileSync(absoluteMarkdownPath, 'utf8');

  return {
    markdownPath,
    receiptPath,
    markdown,
    record,
  };
}
