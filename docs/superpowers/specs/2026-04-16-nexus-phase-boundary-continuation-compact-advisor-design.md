# Nexus Phase Boundary Continuation + Compact Advisor Design

Date: 2026-04-16
Milestone: session continuity and phase-boundary ergonomics
Branch: `main`

## Goal

Make phase and run boundaries feel smooth without pretending Nexus controls the
host session directly.

The result should be:

- Nexus does not incorrectly imply that a fresh session is required by the
  lifecycle when it is only recommended by the host session state
- new phase and fresh-run boundaries expose explicit continuation guidance
- users can choose between continuing in the current session, compacting the
  current session, or resuming in a fresh session
- the guidance is repo-visible and driven by canonical run artifacts rather
  than hidden chat assumptions
- Nexus remains compatible with hosts that do not expose a programmatic compact
  API

## Scope

- define a canonical phase-boundary continuation advisory model
- define when Nexus should recommend current-session continuation versus compact
  versus fresh-session resume
- introduce repo-visible continuation advisory artifacts
- connect existing next-run bootstrap artifacts to the advisory model
- define host-facing UX guidance for long-session degradation
- keep lifecycle transitions unchanged

## Non-Goals

- adding a new canonical lifecycle stage
- making `/compact` a required part of the lifecycle
- assuming Nexus can directly trigger host-native compacting in all hosts
- replacing `/continue` or existing next-run bootstrap files
- building a fully automatic session migration system in this spec
- implementing host-specific APIs in this spec

## Problem Statement

Nexus lifecycle semantics and host session ergonomics are currently mixed
in user-facing guidance.

Two different truths exist:

1. the canonical lifecycle allows `discover -> frame` and does not require a
   new session between stages
2. long-running host sessions can degrade and make continuation risky, causing
   the active assistant to recommend a fresh session

When those two are not separated clearly, users hear a false rule:

- "you must exit and start a fresh session before `/frame`"

That creates friction at exactly the moment Nexus is supposed to feel smooth:

- after `/closeout`, when a new run begins
- at new phase boundaries, when continuation should feel guided rather than
  reset-heavy
- in long dogfood sessions, where the host model may self-degrade before Nexus
  lifecycle context is actually invalid

Nexus already has ingredients for structured continuity:

- `NEXT-RUN.md`
- `next-run-bootstrap.json`
- `continuation_mode`
- `/continue` loading the latest context-transfer file

But there is no canonical advisory layer that explains which continuation path
is best for the current boundary.

## Approaches Considered

### 1. Auto-compact by default at every new phase

Pros:

- simple mental model
- aggressively manages context growth

Cons:

- phase boundaries do not always require compaction
- risks dropping useful local conversational detail without user approval
- assumes the host exposes a reliable programmatic compact action
- creates surprising behavior and weakens user trust

### 2. User-choice advisor at phase boundaries, recommended

Pros:

- preserves user control
- separates lifecycle truth from host-session advice
- works even when the host cannot be controlled programmatically
- reuses existing continuity artifacts
- matches real-world variation in session quality

Cons:

- requires explicit UX and new advisory artifacts
- does not fully automate session management

### 3. Do nothing and keep relying on ad hoc assistant judgment

Pros:

- no implementation cost

Cons:

- preserves the current confusion
- keeps advice inconsistent across long sessions
- allows host degradation to masquerade as lifecycle law

## Recommendation

Use approach 2.

Nexus should introduce a canonical continuation advisory model at phase and
fresh-run boundaries.

The advisory must state:

- Nexus lifecycle allows continuation in the current session
- current host-session quality may still make a fresh session or compaction the
  better operator choice
- the recommended next step depends on the boundary type and available
  continuity artifacts

Nexus should not silently compact the host session.

If the host exposes a compact command, Nexus may recommend it explicitly as a
user-chosen path. If the host does not expose such a path, the advisory still
works by recommending current-session continuation or fresh-session resume.

## Core Rules

### 1. Lifecycle truth rule

Canonical lifecycle legality is independent from host-session quality.

If the lifecycle permits the next stage, Nexus must not claim that a fresh
session is required by the lifecycle.

### 2. Advisory boundary rule

Nexus should generate continuation advice at these boundaries:

- fresh run immediately after archived `/closeout`
- explicit `continuation_mode = phase`
- optional future phase markers inside the same long-running project

### 3. Advisory options rule

The canonical advisory model exposes exactly three normalized options:

- `continue_here`
- `compact_then_continue`
- `fresh_session_continue`

Definitions:

- `continue_here`: proceed in the current host session
- `compact_then_continue`: compact the current host session first, then run the
  next canonical command in the same session
- `fresh_session_continue`: start a new session and resume through repo-visible
  continuity artifacts

### 4. Recommendation rule

Nexus may recommend one of the three options, but must not imply the others are
illegal unless host or lifecycle constraints truly make them unavailable.

Typical defaults:

- healthy fresh run or short session: recommend `continue_here`
- new phase in long but still recoverable session: recommend
  `compact_then_continue`
- very long or clearly degraded session: recommend `fresh_session_continue`

### 5. Host capability rule

Nexus must treat host-native compact as an optional capability.

If the host cannot be controlled programmatically, `compact_then_continue`
remains a user-facing advisory option rather than an automatic runtime action.

### 6. Continuity artifact rule

A phase-boundary advisory must be backed by repo-visible continuity artifacts.

At minimum it should consume:

- `.planning/current/discover/NEXT-RUN.md`
- `.planning/current/discover/next-run-bootstrap.json`
- current ledger continuation mode
- optional newest `.ccb/history/*.md` context-transfer file when present

### 7. Messaging rule

User-facing messaging must distinguish between:

- lifecycle legality: "Nexus can continue here"
- session quality advice: "a fresh session or compaction is recommended"

It must not collapse them into a single false imperative.

## Proposed Artifacts

### New canonical advisory artifact

Add a repo-visible advisory artifact for fresh-run or phase-boundary discover:

- `.planning/current/discover/session-continuation-advice.json`

Suggested shape:

```json
{
  "schema_version": 1,
  "run_id": "run-...",
  "boundary_kind": "fresh_run_phase",
  "continuation_mode": "phase",
  "lifecycle_can_continue_here": true,
  "recommended_option": "compact_then_continue",
  "available_options": [
    "continue_here",
    "compact_then_continue",
    "fresh_session_continue"
  ],
  "host_compact_supported": false,
  "resume_artifacts": [
    ".planning/current/discover/NEXT-RUN.md",
    ".planning/current/discover/next-run-bootstrap.json"
  ],
  "recommended_next_command": "/frame",
  "summary": "Nexus can continue in the current session. Because this is a phase boundary and the session may be degraded, compacting first or resuming in a fresh session is recommended.",
  "generated_at": "..."
}
```

### Optional markdown companion

For user-facing readability, optionally emit:

- `.planning/current/discover/SESSION-CONTINUATION.md`

This should be a concise human-readable version of the advisory.

## Runtime Integration

### `/closeout`

No change to lifecycle end semantics.

`/closeout` continues to emit:

- `NEXT-RUN.md`
- `next-run-bootstrap.json`

These remain the continuity seed for the next run.

### Fresh `/discover`

When a new run starts from archived closeout context:

- seed the existing next-run bootstrap artifacts
- compute a continuation advisory
- record the advisory artifact under current discover

### `/frame` and later stages

No lifecycle gating changes.

The advisory is guidance, not a transition constraint.

## UX Contract

At a phase boundary, Nexus should communicate in this shape:

- `Nexus can continue in this session.`
- `Because this is a new phase boundary, recommended next actions are:`
  - `continue here`
  - `compact this session and continue`
  - `start a fresh session and run /continue`

If the session is obviously degraded, change only the recommendation, not the
lifecycle truth:

- `Nexus can continue here, but a fresh session is recommended.`

## Relationship to `/continue`

`/continue` remains the canonical resume helper for new sessions.

The new advisory layer should point to `/continue` when `fresh_session_continue`
is recommended or chosen.

## Open Questions

- whether the host can expose a reliable compact capability Nexus can invoke
  directly, rather than only recommending
- whether advisory generation should use explicit host session metrics or remain
  artifact-and-heuristic driven
- whether future phase-internal boundaries should emit the same advisory outside
  fresh-run discover

## Implementation Direction

A minimal implementation should:

1. add the advisory artifact type and artifact paths
2. generate discover-stage continuation advice for fresh runs seeded from
   archived closeout
3. render a concise markdown summary for humans
4. update README and lifecycle docs to distinguish lifecycle legality from
   session-quality advice
5. avoid any attempt to directly invoke host-native compact until a reliable
   host capability exists
