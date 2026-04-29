# Design Review Methodology Reference

Use this reference when `/design-review` lazy-loads its full audit method.

## Modes

- Full: 5-8 pages, complete checklist, responsive screenshots, interaction testing.
- Quick: homepage plus 2 key pages.
- Deep: 10-15 pages and every major flow.
- Diff-aware: map branch changes to affected routes and audit only those routes.
- Regression: compare against `design-baseline.json`.

## Phase 1: First Impression

Open the page, take a full screenshot, then write the gut critique before analysis:

- what the site communicates
- what stands out
- first 3 elements the eye goes to
- one-word gut verdict

## Phase 2: Design System Extraction

Extract rendered reality, not claimed intent:

- fonts in use
- color palette
- heading hierarchy
- touch target audit
- performance baseline

Offer to save observations into `DESIGN.md` and, for named brands/products, `brand-spec.md`.

## Phase 3: Page-by-Page Visual Audit

Audit each page against:

- first impression
- visual hierarchy
- typography
- color and contrast
- layout and spacing
- responsive behavior
- accessibility
- motion
- content and copy
- AI slop risk

Every finding needs screenshot evidence and a concrete fix.

## Phase 4: Interaction Flow Review

Test navigation, forms, modals, empty states, loading states, errors, success states, keyboard flow, hover/focus, and mobile behavior.

## Phase 5: Cross-Page Consistency

Check repeated components, spacing scale, color usage, button variants, headings, and route-level composition.

## Phase 6: Compile Report

Write:

- report path under `~/.nexus/projects/{slug}/`
- screenshots directory
- score and grade
- findings with severity
- quick wins
- regression deltas when available

## Important Rules

Think like a designer, not only a QA engineer. Screenshots are evidence. Be specific and actionable. Evaluate rendered UX before implementation. Call AI slop directly. Show screenshots to the user after capture.
