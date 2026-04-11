# Nexus Telemetry Backend Cutover

This runbook defines the maintainer procedure for cutting Nexus telemetry off
the inherited Supabase project and onto a Nexus-owned backend.

## Current state

As of April 11, 2026:

- Nexus telemetry binaries and payload contracts are Nexus-owned
- the active backend config in `supabase/config.sh` still points at the
  inherited Supabase project historically shared with legacy Gstack
  infrastructure
- user-facing copy must describe that state explicitly until cutover is
  complete

Do not describe the backend as fully Nexus-owned until the steps below are
complete and the committed config has been rotated.

## Cutover prerequisites

You need all of the following before starting:

- a new Nexus-owned Supabase project
- the new project URL
- the new anon key
- the new service-role key
- access to deploy Supabase Edge Functions
- access to run the Nexus telemetry migrations against the new project

If any of those are missing, stop. Do not partially rotate the repo config.

## Authoritative files

These files define the active telemetry backend contract:

- `supabase/config.sh`
- `supabase/functions/telemetry-ingest/index.ts`
- `supabase/functions/community-pulse/index.ts`
- `supabase/migrations/001_telemetry.sql`
- `supabase/migrations/002_tighten_rls.sql`
- `supabase/verify-rls.sh`
- `bin/nexus-telemetry-sync`
- `bin/nexus-community-dashboard`
- `bin/nexus-update-check`

Cutover is not complete until code, config, and verification all point at the
new backend.

## Cutover procedure

1. Provision the new Nexus-owned Supabase project.
2. Export or record the new project URL, anon key, and service-role key.
3. Run the Nexus telemetry migrations against the new project.
4. Deploy `telemetry-ingest` and `community-pulse` to the new project.
5. Run `supabase/verify-rls.sh` against the new project and confirm the same
   allow/deny behavior expected by Nexus.
6. Rotate `NEXUS_SUPABASE_URL` and `NEXUS_SUPABASE_ANON_KEY` in
   `supabase/config.sh`.
7. Run targeted local verification:
   - `bun test test/telemetry.test.ts`
   - `./bin/nexus-community-dashboard`
   - `./bin/nexus-update-check`
8. Run one real telemetry smoke event against the new backend and verify it is
   visible in the new project's telemetry tables.
9. Update user-facing copy so it no longer says the backend is inherited or
   shared with legacy Gstack infrastructure.
10. Write a release note and closeout before shipping the config rotation.

## Blocking conditions

Stop and block the cutover if any of the following happens:

- migrations fail or diverge from the expected Nexus schema
- RLS verification does not match the committed policy expectations
- `community-pulse` or `telemetry-ingest` still read or write the old backend
- `supabase/config.sh` is rotated before the new project is verified
- user-facing telemetry copy still claims full Nexus ownership before the
  backend is actually cut over

## Completion standard

The telemetry backend cutover is complete only when:

- `supabase/config.sh` points at the new Nexus-owned project
- telemetry ingestion and community dashboard requests succeed against the new
  project
- RLS verification passes against the new project
- user-facing copy no longer mentions the inherited/shared backend
- a release and closeout record exist for the cutover
