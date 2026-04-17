Writes `.planning/current/build/build-request.json`, `.planning/current/build/build-result.md`, and `.planning/current/build/status.json`.

When `.planning/current/plan/design-contract.md` is present, `/build` treats it as part of the bounded implementation contract, passes it as a predecessor artifact, and records the design-bearing provenance on build status.
