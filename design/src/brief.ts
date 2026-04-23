/**
 * Structured design brief — the interface between skill prose and image generation.
 */

import fs from "fs";

export type DesignDeliverableType =
  | "ui-mockup"
  | "prototype"
  | "slides"
  | "motion"
  | "infographic";

export interface DesignBrief {
  goal: string;           // "Dashboard for coding assessment tool"
  audience: string;       // "Technical users, YC partners"
  style: string;          // "Dark theme, cream accents, minimal"
  elements: string[];     // ["builder name", "score badge", "narrative letter"]
  constraints?: string;   // "Max width 1024px, mobile-first"
  reference?: string;     // DESIGN.md excerpt or style reference text
  narrative?: string;     // "From confused first visit to clear next action"
  brandCore?: string;     // "Calm technical trust with one warm accent"
  assetContext?: string[]; // ["Use frozen logo lockup", "Use real product render"]
  reviewLenses?: string[]; // ["hierarchy", "craft", "functional fit"]
  avoid?: string[];       // ["generic SaaS card grid", "purple gradients"]
  screenType: string;     // "desktop-dashboard" | "mobile-app" | "landing-page" | etc.
  deliverableType?: DesignDeliverableType;
  canvas?: string;        // "16:9 keynote slide" | "iPhone 15 Pro frame"
  interactionModel?: string; // "Tabbed workspace with inline detail panel"
  storyBeats?: string[];  // ["hook", "proof", "payoff"]
  exportTargets?: string[]; // ["png", "html", "pptx", "mp4", "gif"]
  dataContext?: string;   // "Revenue mix by segment with source labels"
}

export interface ResolvedBriefInput {
  prompt: string;
  structuredBrief: DesignBrief | null;
}

function normalizeDeliverableType(value?: string): DesignDeliverableType {
  switch (value) {
    case "prototype":
    case "slides":
    case "motion":
    case "infographic":
      return value;
    default:
      return "ui-mockup";
  }
}

function deliverableLead(brief: DesignBrief): string {
  switch (normalizeDeliverableType(brief.deliverableType)) {
    case "prototype":
      return `Generate a pixel-perfect product prototype frame for a ${brief.screenType} for: ${brief.goal}.`;
    case "slides":
      return `Generate a polished presentation slide concept for a ${brief.screenType} about: ${brief.goal}.`;
    case "motion":
      return `Generate a motion-design storyboard or keyframe composition for a ${brief.screenType} about: ${brief.goal}.`;
    case "infographic":
      return `Generate a polished infographic composition for a ${brief.screenType} about: ${brief.goal}.`;
    default:
      return `Generate a pixel-perfect UI mockup of a ${brief.screenType} for: ${brief.goal}.`;
  }
}

function deliverableGuidance(brief: DesignBrief): string[] {
  const deliverableType = normalizeDeliverableType(brief.deliverableType);
  const lines: string[] = [];

  if (brief.canvas) {
    lines.push(`Canvas: ${brief.canvas}.`);
  }

  if (brief.interactionModel) {
    lines.push(`Interaction model: ${brief.interactionModel}.`);
  }

  if (brief.storyBeats && brief.storyBeats.length > 0) {
    lines.push(`Story beats: ${brief.storyBeats.join(", ")}.`);
  }

  if (brief.exportTargets && brief.exportTargets.length > 0) {
    lines.push(`Intended deliverables: ${brief.exportTargets.join(", ")}.`);
  }

  if (brief.dataContext) {
    lines.push(`Data context: ${brief.dataContext}.`);
  }

  switch (deliverableType) {
    case "prototype":
      lines.push(
        "Treat this as a believable interactive product prototype, not a marketing poster.",
        "Show clear navigation, state affordances, and continuity cues that suggest the rest of the flow."
      );
      break;
    case "slides":
      lines.push(
        "Treat this as a presentation slide, not an application UI.",
        "Keep one dominant message, presentation-scale typography, and composition that reads clearly from a distance."
      );
      break;
    case "motion":
      lines.push(
        "Treat this as a motion-design storyboard or keyframe sheet, not a dashboard screenshot.",
        "Composition should imply timing, sequence, and emotional pacing in a single still."
      );
      break;
    case "infographic":
      lines.push(
        "Treat this as information design, not a product screen.",
        "Prioritize data hierarchy, labeling clarity, legends or annotation structure, and editorial composition."
      );
      break;
    default:
      lines.push(
        "Treat this as a real production UI, not a wireframe, concept art, presentation slide, or storyboard."
      );
      break;
  }

  return lines;
}

/**
 * Convert a structured brief to a prompt string for image generation.
 */
export function briefToPrompt(brief: DesignBrief): string {
  const lines: string[] = [
    deliverableLead(brief),
    `Target audience: ${brief.audience}.`,
    `Visual style: ${brief.style}.`,
    `Required elements: ${brief.elements.join(", ")}.`,
  ];

  if (brief.constraints) {
    lines.push(`Constraints: ${brief.constraints}.`);
  }

  if (brief.reference) {
    lines.push(`Design reference: ${brief.reference}`);
  }

  if (brief.narrative) {
    lines.push(`Narrative arc: ${brief.narrative}.`);
  }

  if (brief.brandCore) {
    lines.push(`Brand core: ${brief.brandCore}.`);
  }

  if (brief.assetContext && brief.assetContext.length > 0) {
    lines.push(`Asset context: ${brief.assetContext.join(", ")}.`);
  }

  if (brief.reviewLenses && brief.reviewLenses.length > 0) {
    lines.push(`Optimize for these design lenses: ${brief.reviewLenses.join(", ")}.`);
  }

  if (brief.avoid && brief.avoid.length > 0) {
    lines.push(`Avoid these patterns: ${brief.avoid.join(", ")}.`);
  }

  lines.push(...deliverableGuidance(brief));

  lines.push(
    "All text must be readable. Layout must be clean and intentional.",
    "1536x1024 pixels."
  );

  return lines.join(" ");
}

export function resolveBriefInput(input: string, isFile: boolean): ResolvedBriefInput {
  if (!isFile) {
    return {
      prompt: input,
      structuredBrief: null,
    };
  }

  const content = fs.readFileSync(input, "utf-8");
  const brief: DesignBrief = JSON.parse(content);
  return {
    prompt: briefToPrompt(brief),
    structuredBrief: brief,
  };
}

/**
 * Parse a brief from either a plain text string or a JSON file path.
 */
export function parseBrief(input: string, isFile: boolean): string {
  return resolveBriefInput(input, isFile).prompt;
}

export function qualityChecklistForBrief(brief: DesignBrief | null): string[] {
  const baseChecks = [
    "1. TEXT READABILITY: Are all labels, headings, and body text legible? Any misspellings?",
    "2. LAYOUT COMPLETENESS: Are all requested elements present? Anything missing?",
    "3. PHILOSOPHICAL COHERENCE: Does the design feel like one idea instead of stitched-together tropes?",
    "4. VISUAL HIERARCHY: Is attention directed intentionally?",
    "5. EXECUTION CRAFT: Do spacing, typography, color, and detail feel deliberate?",
  ];

  const deliverableType = normalizeDeliverableType(brief?.deliverableType);
  switch (deliverableType) {
    case "prototype":
      return [
        ...baseChecks,
        "6. INTERACTION CLARITY + PRODUCT FIT: Do navigation and state affordances suggest a believable interactive flow instead of a static poster?",
      ];
    case "slides":
      return [
        ...baseChecks,
        "6. PRESENTATION FIT + DISTINCTIVENESS: Is there one dominant takeaway with presentation-scale hierarchy instead of app-like clutter or generic slide tropes?",
      ];
    case "motion":
      return [
        ...baseChecks,
        "6. STORYBOARD FIT + DISTINCTIVENESS: Does the still imply sequence, timing, and emotional pacing instead of reading like a generic dashboard or poster?",
      ];
    case "infographic":
      return [
        ...baseChecks,
        "6. INFORMATION FIT + DISTINCTIVENESS: Are data hierarchy, annotations, and narrative explanation clear instead of decorative-only output?",
      ];
    default:
      return [
        ...baseChecks,
        "6. FUNCTIONAL FIT + DISTINCTIVENESS: Does it support the task and avoid generic AI-default output?",
      ];
  }
}
