# Upstream Refresh Candidate: pm-skills

Refreshed at: `2026-04-10T03:30:25.200Z`
Previous pinned commit: `4aa4196c14873b84f5af7316e7f66328cb6dee4c`
New pinned commit: `4aa4196c14873b84f5af7316e7f66328cb6dee4c`

## Changed upstream paths

- none

## Impacted `lib/nexus/absorption/*/source-map.ts` references

- none

## Likely affected stage-content areas

- none

## Likely affected stage-pack areas

- none

## Tests to rerun before review

- `bun test test/nexus/upstream-refresh.test.ts test/nexus/upstream-check.test.ts test/nexus/inventory.test.ts`

## Absorption decision placeholder

- `ignore`
- `defer`
- `absorb_partial`
- `absorb_full`
- `reject`

## Guardrails

- Refresh stages imported source material and maintenance metadata only.
- Refresh does not edit absorption review logic, stage-content, stage-packs, release docs, or `VERSION`.
- Refresh uses the checked commit recorded in `upstream-notes/upstream-lock.json` as its target.
