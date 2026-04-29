import { generate } from "./generate";
import { checkCommand } from "./check";
import { compare } from "./compare";
import { variants } from "./variants";
import { iterate } from "./iterate";
import { extractDesignLanguage, updateDesignMd } from "./memory";
import { diffMockups, verifyAgainstMockup } from "./diff";
import { evolve } from "./evolve";
import { generateDesignToCodePrompt } from "./design-to-code";
import { serve } from "./serve";
import { gallery } from "./gallery";
import {
  runDesignNodeScript,
  runDesignPythonScript,
  runDesignShellScript,
} from "./runtime-tools";
import {
  buildDesignRuntimeDoctorReport,
  formatDesignRuntimeDoctorReport,
} from "./doctor";

export type CliFlags = Record<string, string | boolean>;

export class DesignCliUsageError extends Error {}

export interface DesignDispatchDeps {
  generate: typeof generate;
  checkCommand: typeof checkCommand;
  compare: typeof compare;
  variants: typeof variants;
  iterate: typeof iterate;
  extractDesignLanguage: typeof extractDesignLanguage;
  updateDesignMd: typeof updateDesignMd;
  diffMockups: typeof diffMockups;
  verifyAgainstMockup: typeof verifyAgainstMockup;
  evolve: typeof evolve;
  generateDesignToCodePrompt: typeof generateDesignToCodePrompt;
  serve: typeof serve;
  gallery: typeof gallery;
  runDesignNodeScript: typeof runDesignNodeScript;
  runDesignPythonScript: typeof runDesignPythonScript;
  runDesignShellScript: typeof runDesignShellScript;
  buildDesignRuntimeDoctorReport: typeof buildDesignRuntimeDoctorReport;
  formatDesignRuntimeDoctorReport: typeof formatDesignRuntimeDoctorReport;
  resolveImagePaths: typeof resolveImagePaths;
}

export const defaultDispatchDeps: DesignDispatchDeps = {
  generate,
  checkCommand,
  compare,
  variants,
  iterate,
  extractDesignLanguage,
  updateDesignMd,
  diffMockups,
  verifyAgainstMockup,
  evolve,
  generateDesignToCodePrompt,
  serve,
  gallery,
  runDesignNodeScript,
  runDesignPythonScript,
  runDesignShellScript,
  buildDesignRuntimeDoctorReport,
  formatDesignRuntimeDoctorReport,
  resolveImagePaths,
};

export async function dispatchDesignCommand(
  command: string,
  flags: CliFlags,
  deps: DesignDispatchDeps = defaultDispatchDeps,
): Promise<void> {
  switch (command) {
    case "generate":
      await deps.generate({
        brief: flags.brief as string,
        briefFile: flags["brief-file"] as string,
        output: (flags.output as string) || "/tmp/nexus-mockup.png",
        check: !!flags.check,
        retry: flags.retry ? parseInt(flags.retry as string) : 0,
        size: flags.size as string,
        quality: flags.quality as string,
      });
      break;

    case "check":
      await deps.checkCommand(flags.image as string, flags.brief as string, flags["brief-file"] as string);
      break;

    case "compare": {
      const imagesArg = flags.images as string;
      const images = await deps.resolveImagePaths(imagesArg);
      const outputPath = (flags.output as string) || "/tmp/nexus-design-board.html";
      deps.compare({ images, output: outputPath });
      if (flags.serve) {
        await deps.serve({
          html: outputPath,
          timeout: flags.timeout ? parseInt(flags.timeout as string) : 600,
        });
      }
      break;
    }

    case "prompt": {
      const promptImage = flags.image as string;
      if (!promptImage) {
        throw new DesignCliUsageError("--image is required");
      }
      console.error(`Generating implementation prompt from ${promptImage}...`);
      const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"]);
      const root = (await new Response(proc.stdout).text()).trim();
      const d2c = await deps.generateDesignToCodePrompt(promptImage, root || undefined);
      console.log(JSON.stringify(d2c, null, 2));
      break;
    }

    case "variants":
      await deps.variants({
        brief: flags.brief as string,
        briefFile: flags["brief-file"] as string,
        count: flags.count ? parseInt(flags.count as string) : 3,
        outputDir: (flags["output-dir"] as string) || "/tmp/nexus-variants/",
        size: flags.size as string,
        quality: flags.quality as string,
        viewports: flags.viewports as string,
      });
      break;

    case "iterate":
      await deps.iterate({
        session: flags.session as string,
        feedback: flags.feedback as string,
        output: (flags.output as string) || "/tmp/nexus-iterate.png",
      });
      break;

    case "extract": {
      const imagePath = flags.image as string;
      if (!imagePath) {
        throw new DesignCliUsageError("--image is required");
      }
      console.error(`Extracting design language from ${imagePath}...`);
      const extracted = await deps.extractDesignLanguage(imagePath);
      if (flags["write-design-md"]) {
        const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"]);
        const repoRoot = (await new Response(proc.stdout).text()).trim();
        if (repoRoot) {
          deps.updateDesignMd(repoRoot, extracted, imagePath);
        }
      }
      console.log(JSON.stringify(extracted, null, 2));
      break;
    }

    case "diff": {
      const before = flags.before as string;
      const after = flags.after as string;
      if (!before || !after) {
        throw new DesignCliUsageError("--before and --after are required");
      }
      console.error(`Comparing ${before} vs ${after}...`);
      const diffResult = await deps.diffMockups(before, after);
      console.log(JSON.stringify(diffResult, null, 2));
      break;
    }

    case "verify": {
      const mockup = flags.mockup as string;
      const screenshot = flags.screenshot as string;
      if (!mockup || !screenshot) {
        throw new DesignCliUsageError("--mockup and --screenshot are required");
      }
      console.error(`Verifying implementation against approved mockup...`);
      const verifyResult = await deps.verifyAgainstMockup(mockup, screenshot);
      console.error(`Match: ${verifyResult.matchScore}/100 — ${verifyResult.pass ? "PASS" : "FAIL"}`);
      console.log(JSON.stringify(verifyResult, null, 2));
      break;
    }

    case "evolve":
      await deps.evolve({
        screenshot: flags.screenshot as string,
        brief: flags.brief as string,
        briefFile: flags["brief-file"] as string,
        output: (flags.output as string) || "/tmp/nexus-evolved.png",
      });
      break;

    case "gallery":
      deps.gallery({
        designsDir: flags["designs-dir"] as string,
        output: (flags.output as string) || "/tmp/nexus-design-gallery.html",
      });
      break;

    case "export-pdf": {
      const html = flags.html as string | undefined;
      const slides = flags.slides as string | undefined;
      const out = flags.out as string | undefined;
      if (!out || (!html && !slides)) {
        throw new DesignCliUsageError("--out and either --slides or --html are required");
      }
      if (html) {
        await deps.runDesignNodeScript("export_deck_stage_pdf.mjs", [
          "--html",
          html,
          "--out",
          out,
          ...(flags.width ? ["--width", flags.width as string] : []),
          ...(flags.height ? ["--height", flags.height as string] : []),
        ]);
      } else {
        await deps.runDesignNodeScript("export_deck_pdf.mjs", [
          "--slides",
          slides!,
          "--out",
          out,
          ...(flags.width ? ["--width", flags.width as string] : []),
          ...(flags.height ? ["--height", flags.height as string] : []),
        ]);
      }
      break;
    }

    case "export-pptx": {
      const slides = flags.slides as string | undefined;
      const out = flags.out as string | undefined;
      if (!slides || !out) {
        throw new DesignCliUsageError("--slides and --out are required");
      }
      await deps.runDesignNodeScript("export_deck_pptx.mjs", ["--slides", slides, "--out", out]);
      break;
    }

    case "render-video": {
      const html = flags.html as string | undefined;
      if (!html) {
        throw new DesignCliUsageError("--html is required");
      }
      const args = [html];
      if (flags.duration) args.push(`--duration=${flags.duration as string}`);
      if (flags.width) args.push(`--width=${flags.width as string}`);
      if (flags.height) args.push(`--height=${flags.height as string}`);
      if (flags.trim) args.push(`--trim=${flags.trim as string}`);
      if (flags.fontwait) args.push(`--fontwait=${flags.fontwait as string}`);
      if (flags.readytimeout) args.push(`--readytimeout=${flags.readytimeout as string}`);
      if (flags["keep-chrome"]) args.push("--keep-chrome");
      await deps.runDesignNodeScript("render-video.js", args);
      break;
    }

    case "convert-video": {
      const input = flags.input as string | undefined;
      if (!input) {
        throw new DesignCliUsageError("--input is required");
      }
      const args = [input];
      if (flags["gif-width"]) args.push(flags["gif-width"] as string);
      if (flags.minterpolate) args.push("--minterpolate");
      await deps.runDesignShellScript("convert-formats.sh", args);
      break;
    }

    case "add-music": {
      const input = flags.input as string | undefined;
      if (!input) {
        throw new DesignCliUsageError("--input is required");
      }
      const args = [input];
      if (flags.mood) args.push(`--mood=${flags.mood as string}`);
      if (flags.music) args.push(`--music=${flags.music as string}`);
      if (flags.out) args.push(`--out=${flags.out as string}`);
      await deps.runDesignShellScript("add-music.sh", args);
      break;
    }

    case "verify-html": {
      const html = flags.html as string | undefined;
      if (!html) {
        throw new DesignCliUsageError("--html is required");
      }
      const args = [html];
      if (flags.viewports) args.push("--viewports", flags.viewports as string);
      if (flags.slides) args.push("--slides", flags.slides as string);
      if (flags.output) args.push("--output", flags.output as string);
      if (flags.show) args.push("--show");
      if (flags.wait) args.push("--wait", flags.wait as string);
      await deps.runDesignPythonScript("verify.py", args);
      break;
    }

    case "doctor": {
      const report = deps.buildDesignRuntimeDoctorReport();
      if (flags.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(deps.formatDesignRuntimeDoctorReport(report));
      }
      break;
    }

    case "serve":
      await deps.serve({
        html: flags.html as string,
        timeout: flags.timeout ? parseInt(flags.timeout as string) : 600,
      });
      break;
  }
}

export async function resolveImagePaths(input: string): Promise<string[]> {
  if (!input) {
    throw new DesignCliUsageError("--images is required. Provide glob pattern or comma-separated paths.");
  }

  if (input.includes("*")) {
    const glob = new Bun.Glob(input);
    const paths: string[] = [];
    for await (const match of glob.scan({ absolute: true })) {
      if (match.endsWith(".png") || match.endsWith(".jpg") || match.endsWith(".jpeg")) {
        paths.push(match);
      }
    }
    return paths.sort();
  }

  return input.split(",").map((p) => p.trim());
}
