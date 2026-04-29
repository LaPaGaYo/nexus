/**
 * Nexus design CLI — stateless CLI for AI-powered design deliverables.
 *
 * Unlike the browse binary (persistent Chromium daemon), the design binary
 * is stateless: each invocation makes API calls and writes files. Session
 * state for multi-turn iteration is a JSON file in /tmp.
 *
 * Flow:
 *   1. Parse command + flags from argv
 *   2. Resolve auth (~/.nexus/openai.json → OPENAI_API_KEY → guided setup)
 *   3. Execute command (API call → write PNG/HTML)
 *   4. Print result JSON to stdout
 */

import { COMMANDS } from "./commands";
import { generate } from "./generate";
import { resolveApiKey, saveApiKey } from "./auth";
import { DesignCliUsageError, dispatchDesignCommand } from "./dispatch";

function parseArgs(argv: string[]): { command: string; flags: Record<string, string | boolean> } {
  const args = argv.slice(2); // skip bun/node and script path
  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }

  return { command, flags };
}

function printUsage(): void {
  console.log("nexus design — AI-powered design deliverables\n");
  console.log("Commands:");
  for (const [name, info] of COMMANDS) {
    console.log(`  ${name.padEnd(12)} ${info.description}`);
    console.log(`  ${"".padEnd(12)} ${info.usage}`);
  }
  console.log("\nAuth: ~/.nexus/openai.json or OPENAI_API_KEY env var");
  console.log("Setup: $D setup");
}

async function runSetup(): Promise<void> {
  const existing = resolveApiKey();
  if (existing) {
    console.log("Existing API key found. Running smoke test...");
  } else {
    console.log("No API key found. Please enter your OpenAI API key.");
    console.log("Get one at: https://platform.openai.com/api-keys");
    console.log("(Needs image generation permissions)\n");

    // Read from stdin
    process.stdout.write("API key: ");
    const reader = Bun.stdin.stream().getReader();
    const { value } = await reader.read();
    reader.releaseLock();
    const key = new TextDecoder().decode(value).trim();

    if (!key || !key.startsWith("sk-")) {
      console.error("Invalid key. Must start with 'sk-'.");
      process.exit(1);
    }

    saveApiKey(key);
    console.log("Key saved to ~/.nexus/openai.json (0600 permissions).");
  }

  // Smoke test
  console.log("\nRunning smoke test (generating a simple image)...");
  try {
    await generate({
      brief: "A simple blue square centered on a white background. Minimal, geometric, clean.",
      output: "/tmp/nexus-design-smoke-test.png",
      size: "1024x1024",
      quality: "low",
    });
    console.log("\nSmoke test PASSED. Design generation is working.");
  } catch (err: any) {
    console.error(`\nSmoke test FAILED: ${err.message}`);
    console.error("Check your API key and organization verification status.");
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv);

  if (!COMMANDS.has(command)) {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }

  if (command === "setup") {
    await runSetup();
    return;
  }

  await dispatchDesignCommand(command, flags);
}

if (import.meta.main) {
  main().catch((err) => {
    if (err instanceof DesignCliUsageError) {
      console.error(err.message || err);
      printUsage();
      process.exit(1);
    }
    console.error(err.message || err);
    process.exit(1);
  });
}
