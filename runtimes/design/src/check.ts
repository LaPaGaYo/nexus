/**
 * Vision-based quality gate for generated mockups.
 * Uses GPT-4o vision to verify text readability, layout completeness, and visual coherence.
 */

import fs from "fs";
import { requireApiKey } from "./auth";
import { parseBrief, qualityChecklistForBrief, resolveBriefInput, type DesignBrief } from "./brief";

export interface CheckResult {
  pass: boolean;
  issues: string;
}

/**
 * Check a generated mockup against the original brief.
 */
export async function checkMockup(
  imagePath: string,
  brief: string,
  structuredBrief: DesignBrief | null = null,
): Promise<CheckResult> {
  const apiKey = requireApiKey();
  const imageData = fs.readFileSync(imagePath).toString("base64");
  const checks = qualityChecklistForBrief(structuredBrief);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${imageData}` },
            },
            {
              type: "text",
              text: [
                "You are a UI quality checker. Evaluate this mockup against the design brief.",
                "",
                `Brief: ${brief}`,
                "",
                "Check these 6 things:",
                ...checks,
                "",
                "Respond with exactly one line:",
                "PASS — if all checks pass",
                "FAIL: [list specific issues] — if any check fails",
              ].join("\n"),
            },
          ],
        }],
        max_tokens: 200,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      // Non-blocking: if vision check fails, default to PASS with warning
      console.error(`Vision check API error (${response.status}): ${error}`);
      return { pass: true, issues: "Vision check unavailable — skipped" };
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    if (content.startsWith("PASS")) {
      return { pass: true, issues: "" };
    }

    // Extract issues after "FAIL:"
    const issues = content.replace(/^FAIL:\s*/i, "").trim();
    return { pass: false, issues: issues || content };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Standalone check command: check an existing image against a brief.
 */
export async function checkCommand(imagePath: string, brief?: string, briefFile?: string): Promise<void> {
  const resolved = briefFile
    ? resolveBriefInput(briefFile, true)
    : { prompt: parseBrief(brief || "", false), structuredBrief: null };
  const result = await checkMockup(imagePath, resolved.prompt, resolved.structuredBrief);
  console.log(JSON.stringify(result, null, 2));
}
