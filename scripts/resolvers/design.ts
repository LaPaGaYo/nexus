import type { TemplateContext } from './types';
import { OPENAI_HARD_REJECTIONS, OPENAI_LITMUS_CHECKS } from './constants';

function designReference(ctx: TemplateContext, file: string): string {
  return `${ctx.paths.skillRoot}/design/references/${file}`;
}
export function generateDesignGovernance(ctx: TemplateContext): string {
  return `## Nexus Design Governance

Read the full governance reference before design-bearing work:
\`${designReference(ctx, 'governance.md')}\`

Apply these non-optional anchors:
- **Core asset protocol** for named brands/products: real assets first, verify fidelity, and freeze brand truth to \`brand-spec.md\`.
- Direction fallback: vague briefs get 3 genuinely different directions from different schools, not one generic mockup.
- Direction architecture: use named designer or studio anchors, clear visual traits, and explicit tradeoffs.
- Junior-designer discipline: show concrete work early, then tighten with real content, real assets, and constraints.
- **Five design lenses**: philosophical coherence, visual hierarchy, execution craft, functional fit, and distinctiveness.`;
}

export function generateDesignReviewLite(ctx: TemplateContext): string {
  const litmusList = OPENAI_LITMUS_CHECKS.map((item, i) => `${i + 1}. ${item}`).join(' ');
  const rejectionList = OPENAI_HARD_REJECTIONS.map((item, i) => `${i + 1}. ${item}`).join(' ');
  // Codex block only for Claude host
  const codexBlock = ctx.host === 'codex' ? '' : `

7. **Codex design voice** (optional, automatic only when allowed by the active Nexus provider route):

Respect the preamble provider state before checking the binary:
- If \`_EXECUTION_MODE=local_provider\` and \`_PRIMARY_PROVIDER\` is not \`codex\`, do not invoke \`codex exec\`, even if the binary exists.
- In that case, print \`CODEX_SKIPPED_LOCAL_PROVIDER: $_PRIMARY_PROVIDER\` and continue with the local review only.
- If the user explicitly asks for a Codex outside voice in this turn, that explicit request overrides the local-provider skip.

\`\`\`bash
if [ "\${_EXECUTION_MODE:-}" = "local_provider" ] && [ "\${_PRIMARY_PROVIDER:-}" != "codex" ]; then
  echo "CODEX_SKIPPED_LOCAL_PROVIDER: \${_PRIMARY_PROVIDER:-unknown}"
elif which codex >/dev/null 2>&1; then
  echo "CODEX_AVAILABLE"
else
  echo "CODEX_NOT_AVAILABLE"
fi
\`\`\`

If Codex is available and not skipped by the provider guard, run a lightweight design check on the diff:

\`\`\`bash
TMPERR_DRL=$(mktemp /tmp/codex-drl-XXXXXXXX)
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
codex exec "Review the git diff on this branch. Run 7 litmus checks (YES/NO each): ${litmusList} Flag any hard rejections: ${rejectionList} 5 most important design findings only. Reference file:line." -C "$_REPO_ROOT" -s read-only -c 'model_reasoning_effort="high"' --enable web_search_cached 2>"$TMPERR_DRL"
\`\`\`

Use a 5-minute timeout (\`timeout: 300000\`). After the command completes, read stderr:
\`\`\`bash
cat "$TMPERR_DRL" && rm -f "$TMPERR_DRL"
\`\`\`

**Error handling:** All errors are non-blocking. On auth failure, timeout, or empty response — skip with a brief note and continue.

Present Codex output under a \`CODEX (design):\` header, merged with the checklist findings above.`;

  return `## Design Review (conditional, diff-scoped)

Check if the diff touches frontend files using \`nexus-diff-scope\`:

\`\`\`bash
source <(${ctx.paths.binDir}/nexus-diff-scope <base> 2>/dev/null)
\`\`\`

**If \`SCOPE_FRONTEND=false\`:** Skip design review silently. No output.

**If \`SCOPE_FRONTEND=true\`:**

1. **Check for design constraints.** If \`DESIGN.md\`, \`design-system.md\`, or \`brand-spec.md\` exists in the repo root, read it. All design findings are calibrated against that design context — patterns blessed there are not flagged. If not found, use universal design principles.

2. **Read \`.claude/skills/review/design-checklist.md\`.** If the file cannot be read, skip design review with a note: "Design checklist not found — skipping design review."

3. **Read each changed frontend file** (full file, not just diff hunks). Frontend files are identified by the patterns listed in the checklist.

4. **Apply the design checklist** against the changed files. For each item:
   - **[HIGH] mechanical CSS fix** (\`outline: none\`, \`!important\`, \`font-size < 16px\`): classify as AUTO-FIX
   - **[HIGH/MEDIUM] design judgment needed**: classify as ASK
   - **[LOW] intent-based detection**: present as "Possible — verify visually or run /design-review"

5. **Include findings** in the review output under a "Design Review" header, following the output format in the checklist. Design findings merge with code review findings into the same Fix-First flow.

6. **Log the result** for the Review Readiness Dashboard:

\`\`\`bash
${ctx.paths.binDir}/nexus-review-log '{"skill":"design-review-lite","timestamp":"TIMESTAMP","status":"STATUS","findings":N,"auto_fixed":M,"commit":"COMMIT"}'
\`\`\`

Substitute: TIMESTAMP = ISO 8601 datetime, STATUS = "clean" if 0 findings or "issues_found", N = total findings, M = auto-fixed count, COMMIT = output of \`git rev-parse --short HEAD\`.${codexBlock}`;
}

// NOTE: design-checklist.md is a subset of this methodology for code-level detection.
// When adding items here, also update review/design-checklist.md, and vice versa.
export function generateDesignMethodology(ctx: TemplateContext): string {
  return `## Phases 1-6: Design Audit Baseline

Read the full audit methodology reference before running the rendered-site audit:
\`${designReference(ctx, 'design-review-methodology.md')}\`

Use this active checklist:
- Modes: Full, Quick, Deep, Diff-aware, Regression.
- Phase 1: First Impression.
- Phase 2: Design System Extraction.
- Phase 3: Page-by-page visual audit with the 10-category checklist.
- Phase 4: Interaction flow review.
- Phase 5: Cross-page consistency.
- Phase 6: Compile report, scores, screenshots, and regression output.

Important Rules: think like a designer, screenshots are evidence, be specific and actionable, evaluate the rendered site first, call out AI slop directly, include Quick Wins, use \`snapshot -C\` for tricky UIs, and show screenshots to the user.`;
}

export function generateDesignSketch(_ctx: TemplateContext): string {
  return `## Visual Sketch (UI ideas only)

If the chosen approach involves user-facing UI (screens, pages, forms, dashboards,
or interactive elements), generate a rough wireframe to help the user visualize it.
If the idea is backend-only, infrastructure, or has no UI component — skip this
section silently.

**Step 1: Gather design context**

1. Check if the design context exists in the repo root. Read \`DESIGN.md\` for
   system constraints (colors, typography, spacing, component patterns), and read
   \`brand-spec.md\` for frozen brand assets, palette limits, and product-specific
   fidelity constraints. Use both in the wireframe when present.
2. Apply core design principles:
   - **Information hierarchy** — what does the user see first, second, third?
   - **Interaction states** — loading, empty, error, success, partial
   - **Edge case paranoia** — what if the name is 47 chars? Zero results? Network fails?
   - **Subtraction default** — "as little design as possible" (Rams). Every element earns its pixels.
   - **Design for trust** — every interface element builds or erodes user trust.

**Step 2: Generate wireframe HTML**

Generate a single-page HTML file with these constraints:
- **Intentionally rough aesthetic** — use system fonts, thin gray borders, no color,
  hand-drawn-style elements. This is a sketch, not a polished mockup.
- Self-contained — no external dependencies, no CDN links, inline CSS only
- Show the core interaction flow (1-3 screens/states max)
- Include realistic placeholder content (not "Lorem ipsum" — use content that
  matches the actual use case)
- Add HTML comments explaining design decisions

Write to a temp file:
\`\`\`bash
SKETCH_FILE="/tmp/nexus-sketch-$(date +%s).html"
\`\`\`

**Step 3: Render and capture**

\`\`\`bash
$B goto "file://$SKETCH_FILE"
$B screenshot /tmp/nexus-sketch.png
\`\`\`

If \`$B\` is not available (browse binary not set up), skip the render step. Tell the
user: "Visual sketch requires the browse binary. Run the setup script to enable it."

**Step 4: Present and iterate**

Show the screenshot to the user. Ask: "Does this feel right? Want to iterate on the layout?"

If they want changes, regenerate the HTML with their feedback and re-render.
If they approve or say "good enough," proceed.

**Step 5: Include in design doc**

Reference the wireframe screenshot in the design doc's "Recommended Approach" section.
The screenshot file at \`/tmp/nexus-sketch.png\` can be referenced by downstream skills
(\`/plan-design-review\`, \`/design-review\`) to see what was originally envisioned.

**Step 6: Outside design voices** (optional)

After the wireframe is approved, offer outside design perspectives:

Respect the active Nexus provider route before checking Codex:
- If \`_EXECUTION_MODE=local_provider\` and \`_PRIMARY_PROVIDER\` is not \`codex\`, do not invoke \`codex exec\`, even if the binary exists.
- In that case, offer only the Claude/local design perspective and label Codex as skipped by provider policy.
- If the user explicitly asks for a Codex outside voice in this turn, that explicit request overrides the local-provider skip.

\`\`\`bash
if [ "\${_EXECUTION_MODE:-}" = "local_provider" ] && [ "\${_PRIMARY_PROVIDER:-}" != "codex" ]; then
  echo "CODEX_SKIPPED_LOCAL_PROVIDER: \${_PRIMARY_PROVIDER:-unknown}"
elif which codex >/dev/null 2>&1; then
  echo "CODEX_AVAILABLE"
else
  echo "CODEX_NOT_AVAILABLE"
fi
\`\`\`

If Codex is skipped by provider policy, use AskUserQuestion:
> "Want a local design perspective on the chosen approach? A Claude subagent proposes an alternative aesthetic direction."
>
> A) Yes — get local design perspective
> B) No — proceed without

If Codex is available and not skipped, use AskUserQuestion:
> "Want outside design perspectives on the chosen approach? Codex proposes a visual thesis, content plan, and interaction ideas. A Claude subagent proposes an alternative aesthetic direction."
>
> A) Yes — get outside design voices
> B) No — proceed without

If user chooses A and Codex is available and not skipped, launch both voices simultaneously:

1. **Codex** (via Bash, \`model_reasoning_effort="medium"\`):
\`\`\`bash
TMPERR_SKETCH=$(mktemp /tmp/codex-sketch-XXXXXXXX)
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
codex exec "For this product approach, provide: a visual thesis (one sentence — mood, material, energy), a content plan (hero → support → detail → CTA), and 2 interaction ideas that change page feel. Apply beautiful defaults: composition-first, brand-first, cardless, poster not document. Be opinionated." -C "$_REPO_ROOT" -s read-only -c 'model_reasoning_effort="medium"' --enable web_search_cached 2>"$TMPERR_SKETCH"
\`\`\`
Use a 5-minute timeout (\`timeout: 300000\`). After completion: \`cat "$TMPERR_SKETCH" && rm -f "$TMPERR_SKETCH"\`

2. **Claude subagent** (via Agent tool):
"For this product approach, what design direction would you recommend? What aesthetic, typography, and interaction patterns fit? What would make this approach feel inevitable to the user? Be specific — font names, hex colors, spacing values."

If Codex is skipped by provider policy, launch only the Claude subagent and present \`CODEX SAYS (design sketch): [skipped — local_provider uses $_PRIMARY_PROVIDER]\`.

Present Codex output under \`CODEX SAYS (design sketch):\` and subagent output under \`CLAUDE SUBAGENT (design direction):\`.
Error handling: all non-blocking. On failure, skip and continue.`;
}

export function generateDesignOutsideVoices(ctx: TemplateContext): string {
  if (ctx.host === 'codex') return '';

  const isPlanDesignReview = ctx.skillName === 'plan-design-review';
  const isDesignReview = ctx.skillName === 'design-review';
  const isDesignConsultation = ctx.skillName === 'design-consultation';
  if (!isPlanDesignReview && !isDesignReview && !isDesignConsultation) return '';

  const mode = isPlanDesignReview
    ? 'plan-design-review'
    : isDesignReview
      ? 'design-review'
      : 'design-consultation';
  const reasoningEffort = isDesignConsultation ? 'medium' : 'high';
  const directionLabel = isPlanDesignReview ? 'critique' : isDesignReview ? 'source audit' : 'direction';

  return `## Design Outside Voices (parallel)

Read the full outside-voices contract:
\`${designReference(ctx, 'outside-voices.md')}\`

Mode: \`${mode}\`
Reasoning: \`model_reasoning_effort="${reasoningEffort}"\`
Codex output header: \`CODEX SAYS (design ${directionLabel}):\`

**Runtime provider guard:** Codex outside voices are cross-provider assistance, not part of Claude local-provider execution. If \`_EXECUTION_MODE=local_provider\` and \`_PRIMARY_PROVIDER\` is not \`codex\`, do not invoke \`codex exec\`, even if the binary exists. Use only the host/local Claude voice and label the Codex line \`[skipped — local_provider uses $_PRIMARY_PROVIDER]\`. Only run Codex when the active route allows it: governed CCB, local-provider Codex, or an explicit user request for Codex in this turn.

${isDesignReview ? '**Automatic:** Outside voices run automatically only when Codex is allowed by the runtime provider guard and available. No opt-in needed.' : `Before asking, evaluate the runtime provider guard. If Codex is skipped by local-provider policy, offer a local-only design perspective instead of a Codex outside voice.

Use AskUserQuestion when Codex is allowed:
> "Want outside design voices${isPlanDesignReview ? ' before the detailed review' : ''}? Codex evaluates OpenAI hard rules and litmus checks; Claude subagent gives an independent ${isDesignConsultation ? 'design direction' : 'completeness review'}."
>
> A) Yes — run outside design voices
> B) No — proceed without

Use AskUserQuestion when Codex is skipped by local-provider policy:
> "Want a local ${isDesignConsultation ? 'design direction' : 'design review'} second pass? Claude will use an independent local perspective without Codex."
>
> A) Yes — run local second pass
> B) No — proceed without`}

**Check Codex availability and provider policy:**
\`\`\`bash
if [ "\${_EXECUTION_MODE:-}" = "local_provider" ] && [ "\${_PRIMARY_PROVIDER:-}" != "codex" ]; then
  echo "CODEX_SKIPPED_LOCAL_PROVIDER: \${_PRIMARY_PROVIDER:-unknown}"
elif which codex >/dev/null 2>&1; then
  echo "CODEX_AVAILABLE"
else
  echo "CODEX_NOT_AVAILABLE"
fi
\`\`\`

If Codex is available and not skipped by the provider guard, launch Codex and a Claude subagent simultaneously. In the Codex prompt, tell it to read \`${designReference(ctx, 'outside-voices.md')}\` and execute the \`${mode}\` section.

\`\`\`bash
TMPERR_DESIGN=$(mktemp /tmp/codex-design-XXXXXXXX)
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
codex exec "Read ${designReference(ctx, 'outside-voices.md')} and run the ${mode} Codex design voice. Return the required findings and LITMUS SCORECARD where applicable." -C "$_REPO_ROOT" -s read-only -c 'model_reasoning_effort="${reasoningEffort}"' --enable web_search_cached 2>"$TMPERR_DESIGN"
\`\`\`

After completion: \`cat "$TMPERR_DESIGN" && rm -f "$TMPERR_DESIGN"\`. On auth failure, timeout, or empty response, proceed with the available voice and tag it \`[single-model]\`.

If Codex is skipped by provider policy, do not run the command above. Launch only the Claude/local perspective and present \`CODEX SAYS (design ${directionLabel}): [skipped — local_provider uses $_PRIMARY_PROVIDER]\`.

**Synthesis:** Produce the \`DESIGN OUTSIDE VOICES — LITMUS SCORECARD\` for plan/review modes, merge findings with \`[codex]\`, \`[subagent]\`, or \`[cross-model]\` tags, and log \`design-outside-voices\` with \`nexus-review-log\`.`;
}

// ─── Design Hard Rules (OpenAI framework + Nexus slop blacklist) ───
export function generateDesignHardRules(_ctx: TemplateContext): string {
  const ctx = _ctx;
  return `### Design Hard Rules

Read the full hard-rules reference before scoring:
\`${designReference(ctx, 'hard-rules.md')}\`

**Classifier — determine rule set before evaluating:**
- **MARKETING/LANDING PAGE** → Landing page rules
- **APP UI** → App UI rules
- **HYBRID** → landing rules for marketing sections and app rules for functional sections

Rule sets covered in the reference: Landing page rules, App UI rules, Universal rules.

Mandatory examples to preserve in findings:
- AI slop blacklist: 3-column feature grid; Purple/violet/indigo.
- OpenAI hard rejection criteria: Generic SaaS card grid; Carousel with no narrative purpose.
- OpenAI litmus checks: Brand/product unmistakable; premium with all decorative shadows removed.`;
}

export function generateDesignSetup(ctx: TemplateContext): string {
  const designBinaryResolution = generateDesignBinaryResolution(ctx);
  return `## DESIGN SETUP (run this check BEFORE any design mockup command)

\`\`\`bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
${designBinaryResolution}
if [ -x "$D" ]; then
  echo "DESIGN_READY: $D"
else
  echo "DESIGN_NOT_AVAILABLE"
fi
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/${ctx.paths.localSkillRoot}/browse/dist/browse" ] && B="$_ROOT/${ctx.paths.localSkillRoot}/browse/dist/browse"
[ -z "$B" ] && B=${ctx.paths.browseDir}/browse
if [ -x "$B" ]; then
  echo "BROWSE_READY: $B"
else
  echo "BROWSE_NOT_AVAILABLE (will use 'open' to view comparison boards)"
fi
\`\`\`

If \`DESIGN_NOT_AVAILABLE\`: skip visual mockups and fall back to HTML wireframes.
If \`BROWSE_NOT_AVAILABLE\`: use \`open file://...\` for comparison boards.

Core commands: \`$D generate\`, \`$D variants\`, \`$D compare --serve\`, \`$D check\`, \`$D iterate\`.

**Critical path rule:** save mockups, comparison boards, and \`approved.json\` under
\`~/.nexus/projects/$SLUG/designs/\`, never under project-local paths.`;
}

export function generateDesignMockup(ctx: TemplateContext): string {
  const designBinaryResolution = generateDesignBinaryResolution(ctx);
  return `## Visual Design Exploration

\`\`\`bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
${designBinaryResolution}
[ -x "$D" ] && echo "DESIGN_READY" || echo "DESIGN_NOT_AVAILABLE"
\`\`\`

**If \`DESIGN_NOT_AVAILABLE\`:** Fall back to the HTML wireframe approach below
(the existing DESIGN_SKETCH section). Visual mockups require the design binary.

**If \`DESIGN_READY\`:** Generate visual mockup explorations for the user.

Generating visual mockups of the proposed design... (say "skip" if you don't need visuals)

**Step 1: Set up the design directory**

\`\`\`bash
eval "$(${ctx.paths.binDir}/nexus-slug 2>/dev/null)"
_DESIGN_DIR=~/.nexus/projects/$SLUG/designs/mockup-$(date +%Y%m%d)
mkdir -p "$_DESIGN_DIR"
echo "DESIGN_DIR: $_DESIGN_DIR"
\`\`\`

**Step 2: Construct the design brief**

Read the design context if it exists — use \`DESIGN.md\` to constrain the system-level
style and \`brand-spec.md\` to constrain frozen brand truth. If neither exists,
explore wide across diverse directions.

**Step 3: Generate 3 variants**

\`\`\`bash
$D variants --brief "<assembled brief>" --count 3 --output-dir "$_DESIGN_DIR/"
\`\`\`

This generates 3 style variations of the same brief (~40 seconds total).

**Step 4: Show variants inline, then open comparison board**

Show each variant to the user inline first (read the PNGs with Read tool), then
create and serve the comparison board:

\`\`\`bash
$D compare --images "$_DESIGN_DIR/variant-A.png,$_DESIGN_DIR/variant-B.png,$_DESIGN_DIR/variant-C.png" --output "$_DESIGN_DIR/design-board.html" --serve
\`\`\`

This opens the board in the user's default browser and blocks until feedback is
received. Read stdout for the structured JSON result. No polling needed.

If \`$D serve\` is not available or fails, fall back to AskUserQuestion:
"I've opened the design board. Which variant do you prefer? Any feedback?"

**Step 5: Handle feedback**

If the JSON contains \`"regenerated": true\`:
1. Read \`regenerateAction\` (or \`remixSpec\` for remix requests)
2. Generate new variants with \`$D iterate\` or \`$D variants\` using updated brief
3. Create new board with \`$D compare\`
4. POST the new HTML to the running server via \`curl -X POST http://localhost:PORT/api/reload -H 'Content-Type: application/json' -d '{"html":"$_DESIGN_DIR/design-board.html"}'\`
   (parse the port from stderr: look for \`SERVE_STARTED: port=XXXXX\`)
5. Board auto-refreshes in the same tab

If \`"regenerated": false\`: proceed with the approved variant.

**Step 6: Save approved choice**

\`\`\`bash
_APPROVED_VARIANT="<VARIANT>"
_APPROVED_LETTER=$(basename "$_APPROVED_VARIANT" | sed -E 's/.*variant-([A-Z]).*/\1/')
_APPROVED_BRIEF="$_DESIGN_DIR/brief-"$_APPROVED_LETTER".json"
bun -e '
const fs = require("fs");
const [dir, variant, feedback, screen, branch, briefPath] = process.argv.slice(1);
let brief = {};
try {
  if (briefPath && fs.existsSync(briefPath)) {
    brief = JSON.parse(fs.readFileSync(briefPath, "utf8"));
  }
} catch {}
const approved = {
  approved_variant: variant,
  feedback,
  date: new Date().toISOString(),
  screen,
  branch,
  deliverableType: brief.deliverableType ?? "ui-mockup",
  exportTargets: Array.isArray(brief.exportTargets) ? brief.exportTargets : ["png"],
  canvas: brief.canvas ?? null,
  interactionModel: brief.interactionModel ?? null,
  storyBeats: Array.isArray(brief.storyBeats) ? brief.storyBeats : [],
  dataContext: brief.dataContext ?? null,
  brief_file: briefPath && fs.existsSync(briefPath) ? briefPath : null,
};
fs.writeFileSync(dir + "/approved.json", JSON.stringify(approved, null, 2) + "\n");
' "$_DESIGN_DIR" "$_APPROVED_VARIANT" "<FEEDBACK>" "mockup" "$(git branch --show-current 2>/dev/null)" "$_APPROVED_BRIEF"
\`\`\`

Reference the saved mockup in the design doc or plan.`;
}

function generateDesignBinaryResolution(ctx: TemplateContext): string {
  return `D=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/${ctx.paths.localSkillRoot}/design/dist/design" ] && D="$_ROOT/${ctx.paths.localSkillRoot}/design/dist/design"
[ -n "$_ROOT" ] && [ -z "$D" ] && [ -x "$_ROOT/${ctx.paths.localSkillRoot}/runtimes/design/dist/design" ] && D="$_ROOT/${ctx.paths.localSkillRoot}/runtimes/design/dist/design"
_SOURCE_DESIGN=${ctx.paths.skillRoot}/runtimes/design/dist/design
[ -z "$D" ] && [ -x "$_SOURCE_DESIGN" ] && D="$_SOURCE_DESIGN"
[ -z "$D" ] && D=${ctx.paths.designDir}/design`;
}

export function generateDesignShotgunLoop(_ctx: TemplateContext): string {
  const ctx = _ctx;
  return `### Comparison Board + Feedback Loop

Read the full comparison-board loop:
\`${designReference(ctx, 'shotgun-loop.md')}\`

Minimum active flow:
1. Run \`$D compare --images "$_DESIGN_DIR/variant-A.png,$_DESIGN_DIR/variant-B.png,$_DESIGN_DIR/variant-C.png" --output "$_DESIGN_DIR/design-board.html" --serve\`.
2. Parse \`SERVE_STARTED: port=XXXXX\`, then use AskUserQuestion only as the blocking wait with the board URL.
3. Read \`feedback.json\` or \`feedback-pending.json\`.
4. If submitted, summarize preferred variant, ratings, comments, and direction.
5. If regenerate/remix/more-like-this, run \`$D iterate\` or \`$D variants\`, reload the same board, and wait again.
6. Save the final \`approved.json\` next to the board assets.`;
}
