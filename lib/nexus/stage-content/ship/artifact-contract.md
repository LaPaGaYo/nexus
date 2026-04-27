Writes `.planning/current/ship/release-gate-record.md`,
`.planning/current/ship/checklist.json`,
`.planning/current/ship/deploy-readiness.json`,
`.planning/current/ship/pull-request.json`,
`.planning/current/ship/status.json`, and optionally
`.planning/current/ship/learning-candidates.json` when ship raw output contains
valid reusable learning candidates. `/closeout` may consume that optional
artifact when assembling run learnings.
Requires QA design verification for design-bearing runs before recording a ready ship state.
Requires the ship branch to be pushed before PR creation. If the release gate is
merge-ready but `.planning/current/ship/pull-request.json` records
`status: "push_required"`, `/ship` remains not-ready and `/closeout` must not run
until the branch is pushed and `/ship` is rerun to create or reuse the PR handoff.

Follow-on support workflows may attach additional ship evidence without
changing canonical ship state, including
`.planning/current/ship/canary-status.json` from `/canary` and
`.planning/current/ship/deploy-result.json` from `/land-and-deploy`.
