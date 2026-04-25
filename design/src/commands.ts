/**
 * Command registry — single source of truth for all design commands.
 *
 * Dependency graph:
 *   commands.ts ──▶ cli.ts (runtime dispatch)
 *              ──▶ gen-skill-docs.ts (doc generation)
 *              ──▶ tests (validation)
 *
 * Zero side effects. Safe to import from build scripts and tests.
 */

export const COMMANDS = new Map<string, {
  description: string;
  usage: string;
  flags?: string[];
}>([
  ["generate", {
    description: "Generate a design deliverable frame from a design brief",
    usage: "generate --brief \"...\" --output /path.png",
    flags: ["--brief", "--brief-file", "--output", "--check", "--retry", "--size", "--quality"],
  }],
  ["variants", {
    description: "Generate N design variants from a brief",
    usage: "variants --brief \"...\" --count 3 --output-dir /path/",
    flags: ["--brief", "--brief-file", "--count", "--output-dir", "--size", "--quality", "--viewports"],
  }],
  ["iterate", {
    description: "Iterate on an existing mockup with feedback",
    usage: "iterate --session /path/session.json --feedback \"...\" --output /path.png",
    flags: ["--session", "--feedback", "--output"],
  }],
  ["check", {
    description: "Vision-based quality check on a design deliverable",
    usage: "check --image /path.png (--brief \"...\" | --brief-file /path/brief.json)",
    flags: ["--image", "--brief", "--brief-file"],
  }],
  ["compare", {
    description: "Generate HTML comparison board for user review",
    usage: "compare --images /path/*.png --output /path/board.html [--serve]",
    flags: ["--images", "--output", "--serve", "--timeout"],
  }],
  ["diff", {
    description: "Visual diff between two mockups",
    usage: "diff --before old.png --after new.png",
    flags: ["--before", "--after", "--output"],
  }],
  ["evolve", {
    description: "Generate improved mockup from existing screenshot",
    usage: "evolve --screenshot current.png (--brief \"make it calmer\" | --brief-file /path/brief.json) --output /path.png",
    flags: ["--screenshot", "--brief", "--brief-file", "--output"],
  }],
  ["verify", {
    description: "Compare live site screenshot against approved mockup",
    usage: "verify --mockup approved.png --screenshot live.png",
    flags: ["--mockup", "--screenshot", "--output"],
  }],
  ["prompt", {
    description: "Generate structured implementation prompt from approved mockup",
    usage: "prompt --image approved.png",
    flags: ["--image"],
  }],
  ["extract", {
    description: "Extract design language from an approved mockup",
    usage: "extract --image approved.png [--write-design-md]",
    flags: ["--image", "--write-design-md"],
  }],
  ["gallery", {
    description: "Generate HTML timeline of all design explorations for a project",
    usage: "gallery --designs-dir ~/.nexus/projects/$SLUG/designs/ --output /path/gallery.html",
    flags: ["--designs-dir", "--output"],
  }],
  ["export-pdf", {
    description: "Export an HTML slide deck to PDF",
    usage: "export-pdf (--slides /path/slides/ | --html /path/deck.html) --out /path/output.pdf",
    flags: ["--slides", "--html", "--out", "--width", "--height"],
  }],
  ["export-pptx", {
    description: "Export HTML slides to editable PPTX",
    usage: "export-pptx --slides /path/slides/ --out /path/output.pptx",
    flags: ["--slides", "--out"],
  }],
  ["render-video", {
    description: "Render an animation HTML file to MP4",
    usage: "render-video --html /path/animation.html [--duration 30] [--width 1920] [--height 1080]",
    flags: ["--html", "--duration", "--width", "--height", "--trim", "--fontwait", "--readytimeout", "--keep-chrome"],
  }],
  ["convert-video", {
    description: "Derive 60fps MP4 and optimized GIF from a rendered MP4",
    usage: "convert-video --input /path/input.mp4 [--gif-width 960] [--minterpolate]",
    flags: ["--input", "--gif-width", "--minterpolate"],
  }],
  ["add-music", {
    description: "Mix a BGM track into a rendered MP4",
    usage: "add-music --input /path/input.mp4 [--mood tech] [--music /path/track.mp3] [--out /path/output.mp4]",
    flags: ["--input", "--mood", "--music", "--out"],
  }],
  ["verify-html", {
    description: "Verify rendered HTML output via Playwright screenshots and console checks",
    usage: "verify-html --html /path/output.html [--viewports 1920x1080,375x667] [--slides 10]",
    flags: ["--html", "--viewports", "--slides", "--output", "--show", "--wait"],
  }],
  ["doctor", {
    description: "Check whether the absorbed design runtime is ready for slides, motion, and HTML verification",
    usage: "doctor [--json]",
    flags: ["--json"],
  }],
  ["serve", {
    description: "Serve comparison board over HTTP and collect user feedback",
    usage: "serve --html /path/board.html [--timeout 600]",
    flags: ["--html", "--timeout"],
  }],
  ["setup", {
    description: "Guided API key setup + smoke test",
    usage: "setup",
    flags: [],
  }],
]);
