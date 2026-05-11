# Phase 5 / Track E: Team Mode

**Status:** RFC — gap analysis only. Not for implementation.
**Created:** 2026-05-04
**Trigger:** After Phase 4 (D1-D4) technical debt cleanup completes.
**Companion docs:**
- `phase-4-plan.md` — current execution focus
- `track-d-d1-brief.md`, `track-d-d2-rfc.md`, `track-d-d3-rfc.md`, `track-d-d3-phase-1-brief.md` — current sub-tracks

---

## Why this RFC exists

Nexus today is **sufficient for individual use**. A single operator can drive
`/discover` → `/closeout` on local artifacts, with a clean skill ecology and
multi-host support. The skill packages cover the full lifecycle.

But team usage exposes structural gaps that **cannot be patched into Phase 4**.
They require new subsystems (identity, events, integration adapters, approval
engine), which would balloon Phase 4's tech-debt focus and risk both halves.

**Decision (May 4, 2026):** Path C. Finish Phase 4 cleanup first; park team-mode
analysis here. When Phase 4 D1-D3 lands and the technical surface is
consolidated, this RFC becomes the seed of Phase 5 work.

This RFC does **not** propose implementations. It identifies axes, draws
boundaries, and sets priorities so that future Phase 5 work has a defensible
starting point.

---

## What works today (individual mode)

Before listing gaps, name the surfaces Nexus already gets right. Phase 5 is
**additive** to these — none of them are on the chopping block.

| Surface | Status |
|---|---|
| 9 canonical lifecycle commands (`/discover` … `/closeout`) | Stable |
| Artifact-driven state (`.planning/*.md`, git-tracked) | Stable |
| Skill ecology (post-D3: `lib/nexus/skill-registry/`) | Maturing |
| Multi-host install (claude, codex, gemini-cli, factory) | Stable |
| Append-only ledger with schema versioning (post-#47) | Stable |
| Stage packs (per-command guidance) | Stable |
| Adapter lifecycle separation (post-D1: discovery/planning/execution) | Stable |
| Host skill roots registry (post-#47) | Stable |

The individual-operator workflow is the **stable contract**. Phase 5 must not
break it.

---

## Gap inventory: 5 axes

### Axis 1 — Identity & ownership

**Symptom:** Nexus has no concept of "who is doing what."

- `HANDOFF.md` says "handed off" — to whom? No actor field.
- `/build`, `/review`, etc. don't check assignee.
- Ledger records stage transitions, not actor.
- Two team members running the same command on the same milestone produce no
  conflict warning.

**Root cause:** Nexus's data model is single-actor by construction. Adding
identity touches every artifact schema, every command handler, and the ledger.

**Reference comparison:** Linear/Jira/GitHub Issues all put `assignee` as a
first-class field on every work item. Nexus puts zero.

### Axis 2 — Async / multi-person handoff

**Symptom:** Nexus assumes one operator from `/discover` to `/closeout`.

Real teams split roles:
- PM: `/discover` + `/frame`
- Tech lead: `/plan` + `/handoff`
- IC: `/build`
- Reviewer: `/review`
- Release manager: `/ship` + `/closeout`

Today this requires:
- Manual git push/pull between actors
- No "waiting on Bob's review" state
- No notification when stage transitions
- No way to express "blocked on external dependency"

**Root cause:** Stage transitions are synchronous, in-memory, single-process.
True async needs the ledger to become an **event stream** that other actors
subscribe to.

### Axis 3 — External system integration

Teams will not abandon their existing tool stack for Nexus. Bridges needed:

| External system | Current Nexus support | What's missing |
|---|---|---|
| Issue tracker (Linear / Jira / GitHub Issues) | None | One-way (artifact → issue) or two-way sync |
| PR / code review | `REVIEW.md` exists | Cannot post review comments to PR |
| CI / status checks | `/ship` doesn't verify | No CI gate before `/ship` allows transition |
| Deployment | Out of scope today | Decide whether `/ship` extends past merge |
| Notification (Slack / email) | None | Stage transitions emit nothing |

**Root cause:** No integration adapter framework. Each bridge is a separate
design problem, but they share a common shape (auth, mapping, sync direction,
conflict resolution).

### Axis 4 — Multi-stream / parallel milestone

**Symptom:** Nexus implicitly assumes one active milestone per repo.

- `.planning/current/` is singular
- Ledger is single-track
- No expression of "M1 in /build, M2 in /frame, M3 in /qa"

Teams always run N streams in parallel. Even Nexus's own development in this
session ran 4 tracks (A/B/C/D) with sub-phases — and **Nexus could not be used
to manage Nexus's own development**, because it cannot model parallelism.

**Root cause:** Ledger and `.planning/` directory layout assume single track.
Multi-stream requires a milestone identifier in every artifact + ledger entry.

### Axis 5 — Governance / approval

**Symptom:** "Governed release gate" (`/ship`) is artistic naming. There is
no real gate logic — anyone running the command transitions the stage.

Missing:
- Stage-level required approvers (e.g., "PM must sign off on `/frame`")
- Role-based command access (e.g., "only release manager can `/ship`")
- 4-eyes review enforcement
- Dispute mechanism (what if reviewer disagrees with `/review` output?)

**Root cause:** No identity model (Axis 1) ⇒ no approval model possible.
Approval is downstream of identity.

---

## Axis dependency graph

```
Axis 1 (Identity) ─┬─→ Axis 5 (Governance)
                   ├─→ Axis 2 (Async handoff)
                   └─→ Axis 4 (Multi-stream, partially)

Axis 3 (Integration) ── independent foundation, but consumes Axis 1 actors

Axis 4 (Multi-stream) ── partially independent (data model change),
                          partially needs Axis 1 (per-stream owners)

Axis 2 (Async) ─── needs Axis 1 + event substrate
```

**Implication:** Identity (Axis 1) is the keystone. Everything else either
needs it or is more useful with it. Phase 5 must start there.

---

## Second-order gaps (smaller but real)

| Dimension | Gap |
|---|---|
| **Observability** | No metrics: cycle time, stage duration, rework rate, velocity |
| **Onboarding** | 9 commands × multi-host × adapter system has steep concept curve |
| **Recoverability** | Ledger is append-only but no transaction / rollback semantics |
| **Customizability** | Teams cannot add custom stages (e.g., `/security-review`) |
| **Multi-repo** | Nexus is per-repo; cross-repo projects have no coordination |

These are P2 — useful when team mode is mature, but not blockers for entry.

---

## Sub-track proposals (E1 — E7)

Numbering parallels Track D structure. Each sub-track is a future RFC scope.

### E1 — Identity layer
- Add `actor` field to ledger entries and artifact frontmatter
- Define identity providers (git author email? OAuth? plugin?)
- Migration path for existing single-actor ledgers
- **Out of scope for E1:** approval logic (that's E4)

### E2 — Async event model
- Convert ledger from passive log to active event stream
- Subscriber registration (in-process to start; webhook later)
- Stage-transition events (`onHandoff`, `onShip`, etc.)
- **Depends on:** E1

### E3 — Integration adapters
- Adapter framework (auth, mapping, sync direction, conflict resolution)
- First adapter: GitHub Issues (lowest friction, covers most teams)
- Second adapter: PR / status checks
- Third adapter: CI gate for `/ship`
- **Independent foundation**, but enriched by E1

### E4 — Approval engine
- Stage-level required approver declarations (in `.planning/governance.yaml`?)
- Role-based command access
- Sign-off recording in ledger
- **Depends on:** E1

### E5 — Multi-stream
- Milestone identifier in every artifact + ledger entry
- `.planning/streams/<id>/` layout (or similar)
- Stream-level state queries
- **Partially independent** of E1 (could ship without identity, but degrades)

### E6 — Observability
- Metrics emission from stage transitions
- Stage duration / cycle time tracking
- Local report command (`/nexus metrics` or similar)
- **Depends on:** E1 + E5

### E7 — Multi-repo
- Cross-repo milestone coordination
- Federation model (shared `.planning/` upstream? Linked repos?)
- **Depends on:** E1, E2, E5

---

## Design constraints (non-negotiable)

1. **Individual mode stays unchanged.** Single-operator workflow continues to
   work; team features are opt-in. A solo developer should not have to deal
   with identity / approval / multi-stream concepts.

2. **Local-first.** Artifacts remain source of truth in git. Any cloud sync
   (if it appears) is optional projection, not authority.

3. **No vendor lock-in.** Tracker / CI integrations are pluggable adapters,
   not hardcoded. Team can swap GitHub Issues for Linear without touching
   Nexus core.

4. **Repo-visible.** Team state stays in git where possible (e.g.,
   `.planning/governance.yaml`, `.planning/streams/`). Out-of-band state
   (network calls, cached external state) is the exception, justified
   per-feature.

5. **Phase 4 sequencing respected.** No Phase 5 implementation work begins
   until Phase 4 D1-D3 land.

6. **Additive over restructuring.** Phase 5 adds; it does not refactor the
   command set, the artifact schema, or the host install model.

---

## Priority sequencing

| Tier | Sub-tracks | Rationale |
|---|---|---|
| **P0 (Phase 5 entry)** | E1 + E5 + E3a (one tracker) | Without these, "team mode" is a slogan. Identity unlocks everything; multi-stream removes the single-active blocker; one tracker bridge proves the integration framework. |
| **P1 (Phase 5 expansion)** | E2 + E4 + E3b (CI / PR) | Async handoff and approval are the second-order team needs. CI bridge makes `/ship` real. |
| **P2 (Phase 5 polish)** | E6 + E7 | Metrics and multi-repo are mature-team concerns. Defer until P0+P1 prove out. |

**Critical path:** E1 must land first. Everything else either depends on it
or is improved by it.

---

## Non-goals for Track E

> **TODO — needs Henry's call.** This is the strategic boundary. Below is a
> strawman of candidate non-goals. Pick which to keep / strike / add.

Candidate non-goals (strike or keep each):

- [ ] **No SaaS hosting.** Nexus stays a CLI / library. No cloud product.
- [ ] **No replacement of Linear / Jira / GitHub Issues.** Nexus integrates
      with them; it does not replace them. The artifact remains primary.
- [ ] **No real-time collaboration.** No live cursors, no concurrent editing.
      Team mode is async-by-design (commit-based handoff).
- [ ] **No web UI.** All interaction stays CLI / terminal. Optional read-only
      dashboards may exist but are not Nexus core.
- [ ] **No org-wide features.** No multi-team policy engine, no enterprise
      SSO. Team mode is single-team scope.
- [ ] **No deploy / runtime ops.** `/ship` ends at merge boundary. Deployment,
      monitoring, rollback are out of scope.
- [ ] **No AI-mediated approval.** Approvers are humans. Sign-off cannot be
      delegated to the agent itself.
- [ ] (others?)

**Why this matters:** Each "we will never do X" is a constraint that
sharpens design. Without explicit non-goals, every E-sub-track risks
sprawl during implementation.

---

## Trigger criteria: when does Phase 5 open?

> **TODO — needs Henry's call.** Below is a strawman bar. Pick / adjust.

Strawman criteria for Phase 5 entry:

1. **Phase 4 D1 landed and stable** (adapters renamed, no symbol leaks).
2. **Phase 4 D2 landed** (`vendor/upstream/` and `lib/nexus/absorption/`
   deleted; thesis complete).
3. **Phase 4 D3 Phase 1 landed** (SkillRegistry consolidated; routing layer
   stable).
4. **Phase 4 D3 Phase 5 landed** (`/nexus do` dispatcher operational; intent
   routing proven).
5. **No open critical inventory issue** (`bun run repo:inventory:check`
   passes; no convergent regressions in the last 14 days).
6. **At least 1 real solo-user has dogfooded a full milestone** with current
   stack and given written feedback on what worked / didn't.
7. (others?)

Open question: Is Phase 4 D4 (lifecycle hooks) a Phase 5 prerequisite, or can
it interleave with Phase 5 P0?

---

## Open questions (deferred to Phase 5 entry)

These do not need answers now. Recording them keeps Phase 5 from re-discovering them.

1. **Identity provider scope:** Git author email is cheapest but tied to
   commits. OAuth is universal but adds infrastructure. Plugin-based is most
   flexible but most surface. Pick at E1 design time.

2. **Ledger event substrate:** In-process pub/sub is simplest. Webhooks add
   reach. File-watch (a la `chokidar`) is git-friendly. Pick at E2 design.

3. **Multi-stream layout:** `.planning/streams/<id>/` vs.
   `.planning/<id>/.../` vs. branch-per-stream. Each has trade-offs for
   merge conflicts and discoverability.

4. **Integration adapter framework shape:** Should adapters live in
   `lib/nexus/adapters/integrations/`? Or a separate `lib/nexus/bridges/`?
   Naming matters — D1 just renamed adapters by lifecycle role; integrations
   are a third axis.

5. **Approval declaration language:** YAML in `.planning/governance.yaml`?
   Inline frontmatter in artifacts? Code-side declaration? Pick at E4.

6. **Backwards compatibility for existing solo users:** If someone has
   `.planning/` artifacts written under v1 schema, how does Phase 5 read
   them? Migration command? Auto-detection? Explicit opt-in flag?

---

## What this RFC does NOT do

- Does not propose any code changes.
- Does not create any GitHub Issues.
- Does not block Phase 4 work in any way.
- Does not promise Phase 5 will happen on any timeline.
- Does not commit to any specific E-sub-track ordering until Phase 4 lands.

This is **a parking document**. Its job is to hold gap analysis stable until
Phase 4 completes, so Phase 5 can start from a written baseline rather than
re-deriving the gaps from scratch.

---

## Acceptance criteria for this RFC itself

This RFC (the document, not the work it describes) is **complete** when:

1. ✅ Gap inventory covers all 5 axes (identity, async, integration,
   multi-stream, governance).
2. ✅ Each axis names symptom + root cause.
3. ✅ Sub-tracks E1-E7 are scoped (1 paragraph each is enough).
4. ✅ Priorities P0/P1/P2 are sequenced.
5. ✅ Design constraints are explicit.
6. ⏳ **Non-goals filled in by Henry** (strawman provided; awaiting decision).
7. ⏳ **Phase 5 trigger criteria filled in by Henry** (strawman provided;
       awaiting decision).
8. ✅ Open questions are recorded for Phase 5 entry.

Once items 6 and 7 are resolved, this RFC freezes until Phase 4 D1-D3 land.

---

## References

- `phase-4-plan.md` — current parent plan
- `track-d-d1-brief.md` — D1 mechanical rename
- `track-d-d2-rfc.md` — D2 upstream deletion
- `track-d-d3-rfc.md` — D3 SkillRegistry + intent router
- `track-d-d3-phase-1-brief.md` — D3 Phase 1 (SkillRegistry consolidation)
- `context-diagram.md` — system overview
- `repo-taxonomy-v2.md` — current repo organization
