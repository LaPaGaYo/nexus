# Root Skill Taxonomy

`skills/root/` is intentionally a single-child taxonomy bucket.

**Phase 4.4 ST8 decision (#87):** keep as documented single-child. The
"Drop" option (move `skills/root/nexus/` to `skills/nexus/`) and the
"Fold" option (rename `skills/root/` → `skills/entrypoint/`) were both
rejected because either would shift install paths that
`lib/nexus/io/host-roots.ts`, `lib/nexus/skills/structure.ts`, and the
host-side install layout depend on. The single-child shape is a
meaningful taxonomy signal — it isolates the root entrypoint skill from
the canonical/support/safety/alias buckets that have different install
behavior — so the generic "single-child anti-pattern" framing does not
apply here.

`test/nexus/skills/root-shape.test.ts` pins this decision: any future
contributor who adds a second sibling under `skills/root/` will trip
the test and have to revisit ST8 deliberately.

Active source:

- `skills/root/nexus/SKILL.md.tmpl`

Generated compatibility output:

- `SKILL.md`

The root `/nexus` entrypoint has different install behavior from canonical,
support, safety, and alias skills: it is generated from the structured source
tree but mirrored at the repository root for host compatibility. Keeping this
source under `skills/root/nexus/` lets `lib/nexus/skill-structure.ts`,
`lib/nexus/host-roots.ts`, and the skill generator classify that behavior
explicitly instead of hiding it as a special case in `skills/canonical/` or
`skills/support/`.
