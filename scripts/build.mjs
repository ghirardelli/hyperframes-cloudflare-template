// Run by wrangler dev/deploy via build.command. The manifest exists because
// the ASSETS binding can fetch but not list. The bundle exists because the
// player can't stitch sub-compositions together at preview time without it.

import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

const COMP_DIR = process.env.PREVIEW_COMPOSITION_DIR ?? "compositions/cloudflare-intro";
const ROOT = "public";
const compRoot = join(ROOT, COMP_DIR);

async function listFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).replaceAll("\\", "/"))
    .sort();
}

async function readOptional(path, encoding) {
  try {
    return await readFile(path, encoding);
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw err;
  }
}

async function writeTextIfChanged(out, text, changedMessage) {
  await mkdir(dirname(out), { recursive: true });
  const existing = await readOptional(out, "utf8");
  if (existing === text) {
    console.log(`[build] ${out} unchanged`);
    return;
  }
  await writeFile(out, text);
  console.log(changedMessage);
}

async function copyIfChanged(src, dest) {
  await mkdir(dirname(dest), { recursive: true });
  const sourceBytes = await readFile(src);
  const existingBytes = await readOptional(dest);
  if (existingBytes && existingBytes.equals(sourceBytes)) {
    console.log(`[build] ${dest} unchanged`);
    return;
  }
  await copyFile(src, dest);
  console.log(`[build] copied ${dest}`);
}

async function writeManifest() {
  const files = (await listFiles(compRoot)).filter(
    (rel) => !rel.startsWith("_bundled/"),
  );
  const out = "src/composition-manifest.json";
  const text = JSON.stringify({ dir: COMP_DIR, files }, null, 2) + "\n";
  await writeTextIfChanged(out, text, `[build] wrote ${out} with ${files.length} files from ${compRoot}`);
}

async function bundlePreview() {
  const out = "public/_bundled/preview.html";
  const tsxBin = join("node_modules", ".bin", "tsx");

  const html = await new Promise((resolveBundle, reject) => {
    const child = spawn(tsxBin, ["scripts/bundle-preview.ts", compRoot], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    const chunks = [];
    child.stdout.on("data", (c) => chunks.push(c));
    child.on("close", (code) => {
      if (code === 0) resolveBundle(Buffer.concat(chunks).toString("utf8"));
      else reject(new Error(`bundle-preview.ts exited ${code}`));
    });
    child.on("error", reject);
  });

  await writeTextIfChanged(out, html, `[build] wrote ${out} (${html.length} bytes)`);
}

async function copyPlayer() {
  const src = "node_modules/@hyperframes/player/dist/hyperframes-player.global.js";
  const dest = "public/_hyperframes/player.js";
  await copyIfChanged(src, dest);
}

// The Studio editor components ship a prebuilt (Tailwind v3) stylesheet under a
// hash-named asset. The package `exports` map blocks deep CSS imports, so we copy
// it to a stable public path and load it via a route-scoped <link> on the Studio
// route only (keeps its preflight out of the rest of the Tailwind v4 app).
async function copyStudioCss() {
  const assetsDir = "node_modules/@hyperframes/studio/dist/assets";
  const entries = await readdir(assetsDir);
  const cssFile = entries.find((name) => name.endsWith(".css"));
  if (!cssFile) {
    console.warn("[build] no @hyperframes/studio CSS asset found; skipping");
    return;
  }
  await copyIfChanged(join(assetsDir, cssFile), "public/_studio/studio.css");
}

await writeManifest();
await bundlePreview();
await copyPlayer();
await copyStudioCss();
