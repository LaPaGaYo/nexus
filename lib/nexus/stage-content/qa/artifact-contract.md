Writes `.planning/current/qa/qa-report.md`,
`.planning/current/qa/design-verification.md`,
`.planning/current/qa/status.json`, and optionally
`.planning/current/qa/learning-candidates.json` when QA raw output contains
valid reusable learning candidates. `/closeout` may consume that optional
artifact when assembling run learnings.

Follow-on support workflows may attach additional QA evidence without changing
canonical QA state, including `.planning/current/qa/perf-verification.md` from
`/benchmark`.
