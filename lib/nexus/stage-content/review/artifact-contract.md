Writes `.planning/audits/current/*`, `.planning/current/review/status.json`, and optionally `.planning/current/review/learning-candidates.json`.

When `.planning/current/plan/design-contract.md` is present for a material design-bearing run, `/review` treats it as required provenance, passes it as a predecessor artifact, and limits visual findings to explicit contract violations. Missing design-contract provenance blocks review instead of silently proceeding.

When the review audits return valid `learning_candidates`, `/review` persists them in the optional learning-candidates artifact and records the path in review status metadata and the ledger artifact index. `/closeout` may consume that artifact when assembling run learnings.
