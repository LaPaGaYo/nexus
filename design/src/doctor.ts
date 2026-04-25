import fs from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);

export type DoctorStatus = "ready" | "degraded";
export type DoctorCheckStatus = "ready" | "missing";

export interface DesignRuntimeDoctorCheck {
  id: string;
  status: DoctorCheckStatus;
  detail: string;
}

export interface DesignRuntimeCapability {
  status: DoctorStatus;
  detail: string;
}

export interface DesignRuntimeDoctorReport {
  status: DoctorStatus;
  checks: Record<string, DesignRuntimeDoctorCheck>;
  capabilities: {
    slides_export: DesignRuntimeCapability;
    motion_export: DesignRuntimeCapability;
    html_verification: DesignRuntimeCapability;
  };
  remediation: string[];
}

export interface DesignRuntimeDoctorProbe {
  which(command: string): string | null;
  packageInstalled(pkg: string): boolean;
  playwrightBrowserInstalled(): boolean;
  pythonPlaywrightImportable(): boolean;
}

function defaultWhich(command: string): string | null {
  return Bun.which(command) ?? null;
}

function looksLikeNexusRuntimeRoot(candidate: string): boolean {
  return (
    fs.existsSync(path.join(candidate, "package.json")) &&
    fs.existsSync(path.join(candidate, "design", "scripts")) &&
    fs.existsSync(path.join(candidate, "design", "assets"))
  );
}

function walkUpForRuntimeRoot(start: string): string | null {
  let current = path.resolve(start);
  while (true) {
    if (looksLikeNexusRuntimeRoot(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function resolveDesignRuntimeRoot(candidateStarts: string[] = []): string | null {
  const candidates = [
    ...candidateStarts,
    process.cwd(),
    path.resolve(path.dirname(process.execPath), "../.."),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const root = walkUpForRuntimeRoot(candidate);
    if (root) {
      return root;
    }
  }
  return null;
}

function defaultPackageInstalled(pkg: string): boolean {
  const runtimeRoot = resolveDesignRuntimeRoot();
  if (runtimeRoot) {
    return fs.existsSync(path.join(runtimeRoot, "node_modules", pkg, "package.json"));
  }

  try {
    require.resolve(pkg);
    return true;
  } catch {
    return false;
  }
}

function defaultPlaywrightBrowserInstalled(): boolean {
  const runtimeRoot = resolveDesignRuntimeRoot();
  const bun = Bun.which("bun");
  if (!runtimeRoot || !bun) {
    return false;
  }

  const probe = Bun.spawnSync(
    [
      bun,
      "--eval",
      'import { chromium } from "playwright"; const executablePath = chromium.executablePath(); if (!executablePath) process.exit(1); console.log(executablePath);',
    ],
    { cwd: runtimeRoot },
  );

  if (probe.exitCode !== 0) {
    return false;
  }

  const executablePath = probe.stdout.toString().trim();
  return executablePath.length > 0 && fs.existsSync(executablePath);
}

function defaultPythonPlaywrightImportable(): boolean {
  const python = Bun.which("python3");
  if (!python) {
    return false;
  }

  const probe = Bun.spawnSync([python, "-c", "import playwright.sync_api"]);
  return probe.exitCode === 0;
}

export function detectDesignRuntimeProbe(): DesignRuntimeDoctorProbe {
  return {
    which: defaultWhich,
    packageInstalled: defaultPackageInstalled,
    playwrightBrowserInstalled: defaultPlaywrightBrowserInstalled,
    pythonPlaywrightImportable: defaultPythonPlaywrightImportable,
  };
}

function readyCheck(id: string, detail: string): DesignRuntimeDoctorCheck {
  return { id, status: "ready", detail };
}

function missingCheck(id: string, detail: string): DesignRuntimeDoctorCheck {
  return { id, status: "missing", detail };
}

export function buildDesignRuntimeDoctorReport(
  probe: DesignRuntimeDoctorProbe = detectDesignRuntimeProbe(),
): DesignRuntimeDoctorReport {
  const node = probe.which("node");
  const python3 = probe.which("python3");
  const ffmpeg = probe.which("ffmpeg");
  const playwrightPkg = probe.packageInstalled("playwright");
  const pdfLibPkg = probe.packageInstalled("pdf-lib");
  const pptxPkg = probe.packageInstalled("pptxgenjs");
  const sharpPkg = probe.packageInstalled("sharp");
  const browserInstalled = playwrightPkg && probe.playwrightBrowserInstalled();
  const pythonPlaywright = python3 ? probe.pythonPlaywrightImportable() : false;

  const checks: DesignRuntimeDoctorReport["checks"] = {
    node: node ? readyCheck("node", node) : missingCheck("node", "Install Node.js so export helpers can run."),
    python3: python3 ? readyCheck("python3", python3) : missingCheck("python3", "Install python3 for HTML verification."),
    ffmpeg: ffmpeg ? readyCheck("ffmpeg", ffmpeg) : missingCheck("ffmpeg", "Install ffmpeg on PATH for motion export."),
    playwright_package: playwrightPkg
      ? readyCheck("playwright_package", "Installed in Nexus dependencies.")
      : missingCheck("playwright_package", "Run `bun install` in the Nexus repo."),
    playwright_browser: browserInstalled
      ? readyCheck("playwright_browser", "Chromium is installed for Node Playwright.")
      : missingCheck("playwright_browser", "Run `bunx playwright install chromium`."),
    pdf_lib: pdfLibPkg
      ? readyCheck("pdf_lib", "Installed in Nexus dependencies.")
      : missingCheck("pdf_lib", "Run `bun install` in the Nexus repo."),
    pptxgenjs: pptxPkg
      ? readyCheck("pptxgenjs", "Installed in Nexus dependencies.")
      : missingCheck("pptxgenjs", "Run `bun install` in the Nexus repo."),
    sharp: sharpPkg
      ? readyCheck("sharp", "Installed in Nexus dependencies.")
      : missingCheck("sharp", "Run `bun install` in the Nexus repo."),
    python_playwright: pythonPlaywright
      ? readyCheck("python_playwright", "Python Playwright is importable.")
      : missingCheck("python_playwright", "Run `python3 -m pip install playwright && python3 -m playwright install chromium`."),
  };

  const slidesReady = !!node && playwrightPkg && browserInstalled && pdfLibPkg && pptxPkg && sharpPkg;
  const motionReady = !!node && playwrightPkg && browserInstalled && !!ffmpeg;
  const verifyReady = !!python3 && pythonPlaywright;

  const remediation: string[] = [];
  if (!slidesReady || !motionReady) {
    remediation.push("Run `bun install` and `bunx playwright install chromium` inside the Nexus repo.");
  }
  if (!pythonPlaywright) {
    remediation.push("Run `python3 -m pip install playwright && python3 -m playwright install chromium` for `verify-html`.");
  }
  if (!ffmpeg) {
    remediation.push("Install `ffmpeg` on PATH for MP4/GIF export and soundtrack mixing.");
  }

  return {
    status: slidesReady && motionReady && verifyReady ? "ready" : "degraded",
    checks,
    capabilities: {
      slides_export: slidesReady
        ? { status: "ready", detail: "HTML -> PDF/PPTX export is available." }
        : { status: "degraded", detail: "Slides export needs Node Playwright + Chromium + pdf-lib + pptxgenjs + sharp." },
      motion_export: motionReady
        ? { status: "ready", detail: "HTML -> MP4/GIF export is available." }
        : { status: "degraded", detail: "Motion export needs Node Playwright + Chromium + ffmpeg." },
      html_verification: verifyReady
        ? { status: "ready", detail: "Playwright-based HTML verification is available." }
        : { status: "degraded", detail: "HTML verification needs python3 plus Python Playwright." },
    },
    remediation,
  };
}

export function formatDesignRuntimeDoctorReport(report: DesignRuntimeDoctorReport): string {
  const lines = [
    `Nexus design runtime: ${report.status.toUpperCase()}`,
    `- slides export: ${report.capabilities.slides_export.status} — ${report.capabilities.slides_export.detail}`,
    `- motion export: ${report.capabilities.motion_export.status} — ${report.capabilities.motion_export.detail}`,
    `- html verification: ${report.capabilities.html_verification.status} — ${report.capabilities.html_verification.detail}`,
  ];

  const missing = Object.values(report.checks).filter((check) => check.status === "missing");
  if (missing.length > 0) {
    lines.push("Missing requirements:");
    for (const check of missing) {
      lines.push(`- ${check.id}: ${check.detail}`);
    }
  }

  if (report.remediation.length > 0) {
    lines.push("Suggested fixes:");
    for (const step of report.remediation) {
      lines.push(`- ${step}`);
    }
  }

  return lines.join("\n");
}
