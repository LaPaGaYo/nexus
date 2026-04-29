import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function resolveFromModule(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function resolveFromExecPath(): string | null {
  const execDir = path.dirname(process.execPath);
  const candidate = path.resolve(execDir, "..");
  return fs.existsSync(path.join(candidate, "scripts")) ? candidate : null;
}

export function resolveDesignRuntimeRoot(): string {
  if (process.env.NEXUS_DESIGN_ROOT) {
    return process.env.NEXUS_DESIGN_ROOT;
  }

  const execCandidate = resolveFromExecPath();
  if (execCandidate) {
    return execCandidate;
  }

  return resolveFromModule();
}

export function resolveDesignRuntimePath(...segments: string[]): string {
  return path.join(resolveDesignRuntimeRoot(), ...segments);
}

export function requireDesignRuntimePath(...segments: string[]): string {
  const resolved = resolveDesignRuntimePath(...segments);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Missing Nexus design runtime asset: ${resolved}`);
  }
  return resolved;
}

function inheritOrPipe(): "inherit" | "pipe" {
  return process.env.NEXUS_OUTPUT_MODE === "json" ? "pipe" : "inherit";
}

async function runCommand(command: string, args: string[]): Promise<void> {
  const proc = Bun.spawn([command, ...args], {
    stdout: inheritOrPipe(),
    stderr: inheritOrPipe(),
    stdin: "inherit",
  });

  const exitCode = await proc.exited;
  let stdout = "";
  let stderr = "";

  if (proc.stdout) {
    try {
      stdout = await new Response(proc.stdout).text();
    } catch {
      stdout = "";
    }
  }

  if (proc.stderr) {
    try {
      stderr = await new Response(proc.stderr).text();
    } catch {
      stderr = "";
    }
  }

  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `${command} exited with code ${exitCode}`);
  }
}

function preferredCommand(name: string): string {
  const resolved = Bun.which(name);
  if (!resolved) {
    throw new Error(`Required command not found on PATH: ${name}`);
  }
  return resolved;
}

export async function runDesignNodeScript(scriptName: string, args: string[]): Promise<void> {
  const node = preferredCommand("node");
  const script = requireDesignRuntimePath("scripts", scriptName);
  await runCommand(node, [script, ...args]);
}

export async function runDesignShellScript(scriptName: string, args: string[]): Promise<void> {
  const bash = preferredCommand("bash");
  const script = requireDesignRuntimePath("scripts", scriptName);
  await runCommand(bash, [script, ...args]);
}

export async function runDesignPythonScript(scriptName: string, args: string[]): Promise<void> {
  const python = preferredCommand("python3");
  const script = requireDesignRuntimePath("scripts", scriptName);
  await runCommand(python, [script, ...args]);
}
