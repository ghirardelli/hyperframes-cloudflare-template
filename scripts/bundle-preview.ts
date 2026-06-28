// Run via tsx, not node. Usage: tsx bundle-preview.ts <dir>
//
// HyperFrames 0.7.17's compiler bundle path imports a generated inline-runtime
// artifact that is not present in the published package. This template only
// needs a single self-contained browser preview for the static composition, so
// keep the bundling behavior local and conservative: inline relative assets and
// inject the packaged runtime IIFE.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";

const projectDir = process.argv[2];
if (!projectDir) {
  console.error("Usage: tsx scripts/bundle-preview.ts <project-dir>");
  process.exit(1);
}

const MIME_TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".json": "application/json",
  ".txt": "text/plain",
};

function isRelativeAsset(value: string): boolean {
  return (
    value.length > 0 &&
    !value.startsWith("#") &&
    !value.startsWith("/") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(value)
  );
}

function splitSuffix(value: string): { path: string; suffix: string } {
  const query = value.indexOf("?");
  const hash = value.indexOf("#");
  const cut =
    query < 0 && hash < 0
      ? -1
      : query < 0
        ? hash
        : hash < 0
          ? query
          : Math.min(query, hash);
  return cut < 0
    ? { path: value, suffix: "" }
    : { path: value.slice(0, cut), suffix: value.slice(cut) };
}

async function toDataUrl(rawValue: string): Promise<string | null> {
  if (!isRelativeAsset(rawValue)) return null;
  const { path, suffix } = splitSuffix(rawValue.trim());
  const filePath = resolve(projectDir, path);
  const root = resolve(projectDir);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (filePath !== root && !filePath.startsWith(rootPrefix)) return null;
  if (!existsSync(filePath)) return null;

  const mime = MIME_TYPES[extname(filePath).toLowerCase()];
  if (!mime) return null;

  const bytes = await readFile(filePath);
  return `data:${mime};base64,${bytes.toString("base64")}${suffix}`;
}

async function inlineHtmlAttrs(source: string): Promise<string> {
  const attrPattern = /\b(src|href)=("([^"]+)"|'([^']+)')/gi;
  const replacements: Array<{ from: string; to: string }> = [];

  for (const match of source.matchAll(attrPattern)) {
    const full = match[0];
    const attr = match[1];
    const quoteWrapped = match[2];
    const value = match[3] ?? match[4] ?? "";
    const dataUrl = await toDataUrl(value);
    if (dataUrl) {
      const quote = quoteWrapped.startsWith("'") ? "'" : '"';
      replacements.push({ from: full, to: `${attr}=${quote}${dataUrl}${quote}` });
    }
  }

  return replacements.reduce((html, { from, to }) => html.replace(from, to), source);
}

async function inlineCssUrls(source: string): Promise<string> {
  const urlPattern = /url\(\s*(["']?)([^)"']+)\1\s*\)/gi;
  const replacements: Array<{ from: string; to: string }> = [];

  for (const match of source.matchAll(urlPattern)) {
    const full = match[0];
    const value = match[2] ?? "";
    const dataUrl = await toDataUrl(value);
    if (dataUrl) replacements.push({ from: full, to: `url("${dataUrl}")` });
  }

  return replacements.reduce((html, { from, to }) => html.replace(from, to), source);
}

function injectRuntime(source: string, runtime: string): string {
  if (source.includes("hyperframe.runtime.iife.js") || source.includes("data-hyperframes-runtime")) {
    return source;
  }
  const safeRuntime = runtime.replace(/<\/(script)/gi, "<\\/$1");
  const tag = `<script data-hyperframes-runtime="1">${safeRuntime}</script>`;
  return source.includes("</head>")
    ? source.replace("</head>", () => `${tag}\n</head>`)
    : `${tag}\n${source}`;
}

let html = await readFile(join(projectDir, "index.html"), "utf8");
html = await inlineHtmlAttrs(html);
html = await inlineCssUrls(html);

const runtime = await readFile("node_modules/@hyperframes/core/dist/hyperframe.runtime.iife.js", "utf8");
html = injectRuntime(html, runtime);

process.stdout.write(html);
