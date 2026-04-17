Writes `.planning/audits/current/*` and `.planning/current/review/status.json`.

When `.planning/current/plan/design-contract.md` is present for a material design-bearing run, `/review` treats it as required provenance, passes it as a predecessor artifact, and limits visual findings to explicit contract violations. Missing design-contract provenance blocks review instead of silently proceeding.
