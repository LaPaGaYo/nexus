# Nexus Release Publish Runbook

This runbook is maintainer-only for Nexus releases. It describes the published-release workflow and does not define governed runtime truth.

## Release Contract

Before publishing a release, keep these version markers aligned:

- `release.json.version`
- `VERSION`
- `package.json.version`

Those three values must describe the same Nexus release. The release tag is `v{version}` and the release notes live at `docs/releases/{date}-nexus-v{version}.md`.

## Release Notes

Write or update the release notes for the release you are publishing before creating the tag.

- Use the `docs/releases/YYYY-MM-DD-nexus-vX.Y.Z.md` naming pattern.
- Include the user-facing changes that ship in the release.
- Keep the notes aligned with the `release.json.release_notes_path` field.

## Publish Steps

1. Update `VERSION`, `package.json.version`, and `release.json.version` together.
2. Update `release.json.tag` to `v{version}`.
3. Update `release.json.release_notes_path` to the matching release notes file.
4. Verify the release bundle metadata and compatibility fields are still correct.
5. Create the Git tag for the release.
6. Push the tag to the remote repository.
7. Publish the corresponding GitHub Release from that tag.

## Git Tag And GitHub Release

Use the published tag as the source of truth for the release artifact:

- the tag should be `v{version}`
- the GitHub Release should point at that tag
- the GitHub Release body should match the release notes file

Do not publish a release if the version markers disagree or if the release notes path in `release.json` does not match the notes you intend to ship.

## Maintainer Check

After publication, verify that the released `release.json` matches the tag and that the release notes are reachable from the GitHub Release page. If any mismatch appears, treat it as a maintainer publishing error, not a runtime upgrade issue.
