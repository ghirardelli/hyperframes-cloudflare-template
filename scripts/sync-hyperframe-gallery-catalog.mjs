#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_LAUNCH_REPO_URL = "https://github.com/heygen-com/hyperframes-launches.git";
const DEFAULT_LAUNCH_REPO_SOURCE_URL = "https://github.com/heygen-com/hyperframes-launches";
const DEFAULT_LAUNCH_REF = "main";
const DEFAULT_CATALOG_INDEX_URL = "https://hyperframes.heygen.com/llms.txt";
const DEFAULT_CATALOG_SEED_URL = "https://hyperframes.heygen.com/catalog/blocks/code-3d-extrude.md";
const DEFAULT_OUTPUT = "src/generated/hyperframe-gallery-catalog.ts";
const DEFAULT_COMPONENT_LIMIT = 160;
const MAX_DETAIL_CHARS = 1_500;
const MAX_USAGE_CHARS = 2_000;
const MAX_PROMPT_CHARS = 1_500;

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const launchRepoUrl =
  options.launchRepo ?? process.env.HYPERFRAME_GALLERY_LAUNCH_REPO_URL ?? DEFAULT_LAUNCH_REPO_URL;
const launchSourceUrl =
  options.launchSourceUrl ??
  process.env.HYPERFRAME_GALLERY_LAUNCH_SOURCE_URL ??
  DEFAULT_LAUNCH_REPO_SOURCE_URL;
const launchRef =
  options.launchRef ?? process.env.HYPERFRAME_GALLERY_LAUNCH_REF ?? DEFAULT_LAUNCH_REF;
const catalogIndexUrl =
  options.catalogIndex ?? process.env.HYPERFRAME_GALLERY_CATALOG_INDEX_URL ?? DEFAULT_CATALOG_INDEX_URL;
const catalogSeedUrl =
  options.catalogSeed ?? process.env.HYPERFRAME_GALLERY_CATALOG_SEED_URL ?? DEFAULT_CATALOG_SEED_URL;
const outputPath = resolve(
  options.output ?? process.env.HYPERFRAME_GALLERY_OUTPUT ?? DEFAULT_OUTPUT,
);
const componentLimit = Number(
  options.limit ?? process.env.HYPERFRAME_GALLERY_COMPONENT_LIMIT ?? DEFAULT_COMPONENT_LIMIT,
);

const tempRoot = mkdtempSync(join(tmpdir(), "hyperframe-gallery-"));
const cloneDir = join(tempRoot, "launches");

try {
  cloneRepository(launchRepoUrl, cloneDir, launchRef);
  const launchRevision = git(["-C", cloneDir, "rev-parse", "HEAD"], {
    silent: true,
  }).stdout.trim();
  const launchExamples = buildLaunchExamples({
    repoDir: cloneDir,
    sourceUrl: sanitizeRepoUrl(launchSourceUrl),
    ref: launchRef,
    revision: launchRevision,
  });

  const indexMarkdown = await fetchText(catalogIndexUrl);
  const catalogEntries = await buildCatalogEntries({
    indexUrl: catalogIndexUrl,
    seedUrl: catalogSeedUrl,
    indexMarkdown,
    limit: componentLimit,
  });

  const catalog = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sources: [
      {
        id: "hyperframes-launches",
        type: "launch-video-repo",
        url: sanitizeRepoUrl(launchSourceUrl),
        ref: launchRef,
        revision: launchRevision,
        contentHash: hashString(launchExamples.sourceText),
      },
      {
        id: "hyperframes-catalog-index",
        type: "catalog-index",
        url: catalogIndexUrl,
        revision: hash(indexMarkdown).slice(0, 16),
        contentHash: hashString(indexMarkdown),
      },
      ...catalogEntries.sources,
    ],
    examples: launchExamples.examples,
    components: catalogEntries.components,
  };

  const rendered = renderArtifact(catalog);
  assertNoCredentialLeaks(rendered);

  if (options.check) {
    const existing = readExistingCatalog(outputPath);
    const normalizedExisting = normalizeForCheck(existing, catalog.generatedAt);
    const normalizedNext = normalizeForCheck(catalog, catalog.generatedAt);
    if (JSON.stringify(normalizedExisting, null, 2) !== JSON.stringify(normalizedNext, null, 2)) {
      throw new Error(
        `Committed HyperFrame gallery catalog is out of sync. Run npm run sync:hyperframe-gallery.`,
      );
    }
    console.log("HyperFrame gallery catalog is in sync.");
  } else {
    writeFileSync(outputPath, rendered);
    console.log(`Wrote ${relative(process.cwd(), outputPath)}.`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function buildLaunchExamples({ repoDir, sourceUrl, ref, revision }) {
  const rawBase = `${sourceUrl.replace("github.com", "raw.githubusercontent.com")}/${revision}`;
  const failures = [];
  const examples = [];
  const sourceText = [];

  for (const entry of readdirSync(repoDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const folderDir = join(repoDir, entry.name);
    const indexPath = join(folderDir, "index.html");
    if (!existsSync(indexPath)) continue;
    try {
      const example = buildLaunchFolderExample({
        folderName: entry.name,
        folderDir,
        sourceUrl,
        rawBase,
        revision,
      });
      examples.push(example.example);
      sourceText.push(example.sourceText);
    } catch (err) {
      failures.push(`${entry.name} (${messageFromError(err)})`);
    }
  }

  if (!examples.length) {
    throw new Error(`No launch folders could be parsed. First failure: ${failures[0] ?? "none"}`);
  }

  if (failures.length) {
    console.warn(`Skipped ${failures.length} launch folder(s): ${failures.slice(0, 4).join("; ")}`);
  }

  return {
    examples: examples.sort((a, b) => a.title.localeCompare(b.title)),
    sourceText: sourceText.join("\n"),
  };
}

function buildLaunchFolderExample({ folderName, folderDir, sourceUrl, rawBase, revision }) {
  const meta = readOptionalJson(join(folderDir, "meta.json")) ?? {};
  const readme = readOptional(join(folderDir, "README.md"));
  const storyboard = readOptional(join(folderDir, "STORYBOARD.md"));
  const design = readOptional(join(folderDir, "DESIGN.md"));
  const handoff = readOptional(join(folderDir, "HANDOFF.md"));
  const indexHtml = readFileSync(join(folderDir, "index.html"), "utf8");
  const dimensions = extractLaunchDimensions(indexHtml, meta);
  const durationSec = Number(meta.duration) || extractLaunchDuration(indexHtml, readme, storyboard) || 30;
  const fps = Number(meta.fps) || extractLaunchFps(readme, storyboard) || undefined;
  const title = decodeBasicHtmlEntities(
    extractTitle(readme) ||
    extractHtmlTitle(indexHtml) ||
    (typeof meta.name === "string" && titleize(meta.name)) ||
    titleize(folderName),
  );
  const description =
    (typeof meta.description === "string" && meta.description) ||
    extractReadmeDescription(readme) ||
    extractReadmeDescription(storyboard) ||
    extractReadmeDescription(design) ||
    `Standalone HyperFrames launch video project for ${title}.`;
  const folderSourceUrl = `${sourceUrl}/tree/${revision}/${encodePath(folderName)}`;
  const previewMedia = findLaunchPreviewMedia({
    folderDir,
    folderName,
    rawBase,
    sourceUrl,
    revision,
    title,
  });

  return {
    example: {
      id: slugify(folderName),
      title: compact(title, 180),
      description: compact(description, 600),
      sourceKind: "launch-folder",
      durationSec,
      width: dimensions.width,
      height: dimensions.height,
      fps,
      tags: unique(["launch-video", "official", "html-video", ...tagsForSlug(folderName)]).slice(0, 16),
      sourceUrl: folderSourceUrl,
      sourceRevision: revision,
      previewMedia,
      promptText: compact(
        `Use "${title}" from the official HyperFrames launches repository as inspiration: a ${formatSeconds(durationSec)} ${dimensions.width}x${dimensions.height} launch-video composition with folder-specific source, assets, and motion language.`,
        MAX_PROMPT_CHARS,
      ),
    },
    sourceText: [folderName, JSON.stringify(meta), readme, storyboard, design, handoff, indexHtml].join("\n"),
  };
}

function extractLaunchDimensions(indexHtml, meta) {
  const width =
    Number(meta.resolution?.width) ||
    Number(meta.width) ||
    Number(/data-width="([0-9]+)"/i.exec(indexHtml)?.[1]) ||
    Number(/width=([0-9]+)/i.exec(indexHtml)?.[1]) ||
    1920;
  const height =
    Number(meta.resolution?.height) ||
    Number(meta.height) ||
    Number(/data-height="([0-9]+)"/i.exec(indexHtml)?.[1]) ||
    Number(/height=([0-9]+)/i.exec(indexHtml)?.[1]) ||
    1080;
  return { width, height };
}

function extractLaunchDuration(indexHtml, ...markdowns) {
  const durations = [...indexHtml.matchAll(/data-duration="([0-9]+(?:\.[0-9]+)?)"/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (durations.length) return Math.max(...durations);
  for (const markdown of markdowns) {
    const duration = parseDurationSec(markdown);
    if (duration) return duration;
    const minuteMatch = /([0-9]+(?:\.[0-9]+)?)\s*(?:minutes?|mins?|m)\b/i.exec(markdown);
    if (minuteMatch) return Number(minuteMatch[1]) * 60;
  }
  return undefined;
}

function extractLaunchFps(...markdowns) {
  for (const markdown of markdowns) {
    const match = /([0-9]+(?:\.[0-9]+)?)\s*fps\b/i.exec(markdown);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function extractHtmlTitle(html) {
  return /<title>\s*([^<]+?)\s*<\/title>/i.exec(html)?.[1]?.trim();
}

function findLaunchPreviewMedia({ folderDir, folderName, rawBase, sourceUrl, revision, title }) {
  const files = listFilesRecursive(folderDir, 4)
    .filter((file) => /\.(?:gif|png|jpe?g|webp|mp4|webm|mov)$/i.test(file))
    .sort((a, b) => previewRank(a) - previewRank(b) || a.localeCompare(b));
  const selected = files[0];
  if (!selected) {
    return {
      type: "image",
      src: githubOpenGraphImageUrl(sourceUrl, revision, folderName),
      alt: `${title} launch folder preview.`,
    };
  }
  const ext = extname(selected).toLowerCase();
  return {
    type: ext === ".gif" ? "gif" : [".mp4", ".webm", ".mov"].includes(ext) ? "video" : "image",
    src: `${rawBase}/${encodePath(folderName)}/${encodePath(selected)}`,
    alt: `${title} preview media.`,
  };
}

function listFilesRecursive(dir, maxDepth, prefix = "") {
  if (maxDepth < 0) return [];
  const files = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(dir, maxDepth - 1, rel));
    } else if (entry.isFile()) {
      files.push(rel);
    }
  }
  return files;
}

function previewRank(path) {
  const lower = path.toLowerCase();
  if (/docs\/preview\.(?:gif|png|jpe?g|webp|mp4)$/.test(lower)) return 0;
  if (/^preview\.(?:gif|png|jpe?g|webp|mp4)$/.test(lower)) return 1;
  if (/og-image\.(?:png|jpe?g|webp)$/.test(lower)) return 2;
  if (/contact-sheet.*\.(?:png|jpe?g|webp)$/.test(lower)) return 3;
  if (/snapshots?\/frame-?0.*\.(?:png|jpe?g|webp)$/.test(lower)) return 4;
  if (/renders?\/.*\.(?:mp4|webm|mov)$/.test(lower)) return 5;
  if (/\.(?:webp|png|jpe?g|gif)$/.test(lower)) return 6;
  return 7;
}

function githubOpenGraphImageUrl(sourceUrl, revision, folderName) {
  const url = new URL(sourceUrl);
  const repoPath = url.pathname.replace(/^\/|\/$/g, "");
  return `https://opengraph.githubassets.com/${revision.slice(0, 12)}-${slugify(folderName)}/${repoPath}/tree/${revision}/${encodePath(folderName)}`;
}

async function buildCatalogEntries({ indexUrl, seedUrl, indexMarkdown, limit }) {
  const links = extractCatalogLinks(indexMarkdown);
  if (!links.length) {
    links.push({ title: "Code 3D Extrude", url: seedUrl, description: "" });
  }

  const boundedLinks = links.slice(0, Math.max(1, Math.min(500, limit)));
  const components = [];
  const sources = [];
  const failures = [];
  const fetched = await mapConcurrent(boundedLinks, 10, async (link) => {
    try {
      const markdown = await fetchText(link.url);
      return { link, markdown };
    } catch (err) {
      failures.push({ url: link.url, error: messageFromError(err) });
      return null;
    }
  });

  for (const item of fetched) {
    if (!item) continue;
    try {
      const component = parseCatalogMarkdown(item.link, item.markdown);
      components.push(component);
      sources.push({
        id: `catalog-page-${component.id}`,
        type: "catalog-page",
        url: item.link.url,
        revision: hash(item.markdown).slice(0, 16),
        contentHash: hashString(item.markdown),
      });
    } catch (err) {
      failures.push({ url: item.link.url, error: messageFromError(err) });
    }
  }

  if (!components.length) {
    throw new Error(
      `No catalog components could be parsed. First failure: ${failures[0]?.url ?? "none"}`,
    );
  }

  if (failures.length) {
    console.warn(
      `Skipped ${failures.length} catalog page(s): ${failures
        .slice(0, 3)
        .map((failure) => `${failure.url} (${failure.error})`)
        .join("; ")}`,
    );
  }

  return {
    components: components.sort((a, b) => a.name.localeCompare(b.name)),
    sources: sources.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function parseCatalogMarkdown(link, markdown) {
  const sourceUrl = link.url.replace(/\.md$/, "");
  const slug = sourceUrl.split("/").pop() || slugify(link.title);
  const kind = sourceUrl.includes("/components/") ? "component" : "block";
  const title = extractTitle(markdown) || link.title || titleize(slug);
  const description = compact(extractDescription(markdown) || link.description || title, 800);
  const tags = extractTags(markdown, slug, kind);
  const media = extractVideoMedia(markdown, kind, slug, title);
  const installCommand = extractInstallCommand(markdown) || `npx hyperframes add ${slug}`;
  const details = extractDetails(markdown);
  const usageSnippet = extractUsageSnippet(markdown);
  const fileTarget = extractFileTarget(markdown);
  const width = details.dimensions?.width;
  const height = details.dimensions?.height;
  const durationSec = details.durationSec;
  const category = inferCategory({ slug, title, tags, kind });
  const usageText = usageSnippet
    ? `Usage snippet: ${compact(usageSnippet, 520)}`
    : fileTarget
      ? `Install it and use ${fileTarget}.`
      : `Install with ${installCommand}.`;
  const detail = compact(
    [description, tags.length ? `Tags: ${tags.join(", ")}.` : "", usageText]
      .filter(Boolean)
      .join(" "),
    MAX_DETAIL_CHARS,
  );

  return {
    id: slug,
    name: title,
    kind,
    category,
    description,
    detail,
    tags,
    sourceUrl,
    installCommand,
    usageSnippet: usageSnippet ? compact(usageSnippet, MAX_USAGE_CHARS) : undefined,
    durationSec,
    width,
    height,
    previewMedia: media,
    promptText: compact(
      `Use the HyperFrames ${kind} "${title}" (${slug}). ${description} ${usageText}`,
      MAX_PROMPT_CHARS,
    ),
  };
}

function extractCatalogLinks(markdown) {
  const links = [];
  const seen = new Set();
  const pattern = /- \[([^\]]+)\]\((https:\/\/hyperframes\.heygen\.com\/catalog\/(?:blocks|components)\/[^)]+?\.md)\)(?::\s*([^\n]+))?/g;
  for (const match of markdown.matchAll(pattern)) {
    const [, title, url, description = ""] = match;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ title: title.trim(), url, description: description.trim() });
  }
  return links;
}

function extractTitle(markdown) {
  return markdown
    .split("\n")
    .map((line) => /^#\s+(.+)$/.exec(line)?.[1]?.trim())
    .filter(Boolean)
    .find((title) => title !== "HyperFrames");
}

function extractDescription(markdown) {
  const quoted = markdown
    .split("\n")
    .map((line) => /^>\s+(.+)$/.exec(line)?.[1]?.trim())
    .filter(Boolean)
    .filter((line) => !line.includes("Documentation Index") && !line.includes("llms.txt"));
  if (quoted[0]) return quoted[0];

  const lines = markdown.split("\n");
  const firstTitleIndex = lines.findIndex((line) => line.startsWith("# "));
  for (const line of lines.slice(firstTitleIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("`") || trimmed.startsWith("<")) {
      continue;
    }
    return trimmed;
  }
  return "";
}

function extractTags(markdown, slug, kind) {
  const tagLine = markdown
    .split("\n")
    .find((line) => {
      const matches = [...line.matchAll(/`([^`]+)`/g)];
      return matches.length >= 2 && !line.includes("|") && !line.includes("npx ");
    });
  const tags = tagLine ? [...tagLine.matchAll(/`([^`]+)`/g)].map((match) => match[1]) : [];
  return unique([kind, ...tags, ...tagsForSlug(slug)]).slice(0, 20);
}

function extractVideoMedia(markdown, kind, slug, title) {
  const video = /<video[^>]+src="([^"]+)"[^>]*(?:poster="([^"]+)")?/i.exec(markdown);
  if (video?.[1]) {
    const poster = /poster="([^"]+)"/i.exec(video[0])?.[1];
    return {
      type: "video",
      src: video[1],
      poster,
      alt: `${title} preview video.`,
    };
  }
  const base = `https://static.heygen.ai/hyperframes-oss/docs/images/catalog/${kind}s/${slug}`;
  return {
    type: "video",
    src: `${base}.mp4`,
    poster: `${base}.png`,
    alt: `${title} preview video.`,
  };
}

function extractInstallCommand(markdown) {
  return /npx\s+hyperframes\s+add\s+([^\s`]+)/.exec(markdown)?.[0]?.trim();
}

function extractDetails(markdown) {
  const detailsSection = sectionBetween(markdown, "## Details", "## Files");
  const duration = /\|\s*Duration\s*\|\s*([^|]+)\|/i.exec(detailsSection)?.[1]?.trim();
  const dimensions = /\|\s*Dimensions\s*\|\s*([0-9]+)\s*(?:x|\u00d7)\s*([0-9]+)\s*\|/i.exec(
    detailsSection,
  );
  return {
    durationSec: parseDurationSec(duration),
    dimensions: dimensions
      ? { width: Number(dimensions[1]), height: Number(dimensions[2]) }
      : undefined,
  };
}

function extractUsageSnippet(markdown) {
  const usageSection = sectionBetween(markdown, "## Usage", "##");
  return /```(?:html[^\n]*)?\n([\s\S]*?)```/.exec(usageSection)?.[1]?.trim();
}

function extractFileTarget(markdown) {
  const filesSection = sectionBetween(markdown, "## Files", "## Usage");
  const row = /\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*([^|]+)\|/.exec(filesSection);
  return row?.[2]?.trim();
}

function sectionBetween(markdown, startHeading, endHeading) {
  const start = markdown.indexOf(startHeading);
  if (start === -1) return "";
  const from = start + startHeading.length;
  const end = markdown.indexOf(endHeading, from);
  return end === -1 ? markdown.slice(from) : markdown.slice(from, end);
}

function parseDurationSec(value) {
  if (!value) return undefined;
  const match = /([0-9]+(?:\.[0-9]+)?)\s*s/i.exec(value);
  return match ? Number(match[1]) : undefined;
}

function extractCompositionSlots(indexHtml) {
  const slots = [];
  const pattern = /<div\b[^>]*data-composition-id="([^"]+)"[^>]*>/g;
  for (const match of indexHtml.matchAll(pattern)) {
    const tag = match[0];
    const id = match[1];
    slots.push({
      id,
      src: attr(tag, "data-composition-src"),
      durationSec: Number(attr(tag, "data-duration") || "0") || undefined,
    });
  }
  return slots;
}

function attr(tag, name) {
  return new RegExp(`${name}="([^"]+)"`).exec(tag)?.[1] ?? "";
}

function inferCategory({ slug, title, tags, kind }) {
  const text = `${slug} ${title} ${tags.join(" ")}`.toLowerCase();
  if (text.includes("caption")) return "Captions";
  if (text.includes("transition") || text.includes("wipe") || text.includes("dissolve")) {
    return "Transitions";
  }
  if (text.includes("code") || text.includes("terminal")) return "Code";
  if (text.includes("lower third") || text.includes("ticker")) return "Lower Thirds";
  if (text.includes("map")) return "Maps";
  if (text.includes("data") || text.includes("chart") || text.includes("flowchart")) {
    return "Data";
  }
  if (text.includes("vfx") || text.includes("shader") || text.includes("liquid")) return "VFX";
  if (text.includes("instagram") || text.includes("tiktok") || text.includes("youtube") || text.includes("post")) {
    return "Social";
  }
  return kind === "block" ? "Showcase" : "Effects";
}

function tagsForSlug(slug) {
  const tags = [];
  if (slug.includes("code")) tags.push("code");
  if (slug.includes("caption")) tags.push("captions");
  if (slug.includes("transition") || slug.includes("wipe")) tags.push("transition");
  if (slug.includes("map")) tags.push("map");
  if (slug.includes("shader")) tags.push("shader");
  if (slug.includes("vfx")) tags.push("vfx");
  return tags;
}

function tagsForLaunchSection(id) {
  const text = id.toLowerCase();
  if (text.includes("css")) return ["css"];
  if (text.includes("gsap")) return ["gsap"];
  if (text.includes("shader")) return ["shader"];
  if (text.includes("three")) return ["three-js", "3d"];
  if (text.includes("footage")) return ["footage"];
  if (text.includes("music")) return ["music"];
  if (text.includes("sfx")) return ["sfx"];
  if (text.includes("cta")) return ["cta"];
  if (text.includes("engine")) return ["technical"];
  return ["motion"];
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "motion-frames-gallery-sync/1.0" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function cloneRepository(rawRepoUrl, destination, ref) {
  const branchClone = git([
    "clone",
    "--depth",
    "1",
    "--filter=blob:none",
    "--branch",
    ref,
    rawRepoUrl,
    destination,
  ], { silent: true, allowFailure: true });

  if (branchClone.status === 0) return;

  rmSync(destination, { recursive: true, force: true });
  git(["clone", "--depth", "1", "--filter=blob:none", rawRepoUrl, destination], { silent: true });
  git(["-C", destination, "checkout", "--detach", ref], { silent: true });
}

function git(args, { silent = false, allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    env: { ...process.env, GIT_LFS_SKIP_SMUDGE: "1" },
    stdio: silent ? "pipe" : "inherit",
  });
  if (result.status !== 0 && !allowFailure) {
    const stderr = result.stderr ? `\n${redactForLog(result.stderr.trim())}` : "";
    throw new Error(`git ${args.map(redactForLog).join(" ")} failed.${stderr}`);
  }
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readOptionalJson(path) {
  return existsSync(path) ? readJson(path) : null;
}

function readOptional(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function readExistingCatalog(path) {
  const source = readFileSync(path, "utf8");
  const start = source.indexOf("{");
  const end = source.lastIndexOf("} as const");
  if (start === -1 || end === -1) throw new Error(`Unable to parse ${path}`);
  return JSON.parse(source.slice(start, end + 1));
}

function normalizeForCheck(catalog, generatedAt) {
  return { ...catalog, generatedAt };
}

function renderArtifact(catalog) {
  return `// Generated by scripts/sync-hyperframe-gallery-catalog.mjs. Do not edit by hand.
// Sources: ${catalog.sources.map((source) => `${source.url} @ ${source.revision}`).join(", ")}

export const hyperframeGalleryCatalog = ${JSON.stringify(catalog, null, 2)} as const;
`;
}

function extractReadmeDescription(readme) {
  const lines = readme.split("\n");
  const paragraph = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("<") || trimmed.startsWith("-")) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(trimmed);
  }
  return paragraph.join(" ");
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") parsed.check = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      parsed[key] = args[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/sync-hyperframe-gallery-catalog.mjs [options]

Options:
  --check                         Compare generated output with the committed artifact
  --output <path>                 Output TypeScript artifact path
  --launch-repo <url>             Launch-video git repository URL
  --launch-source-url <url>       Public source URL for launch-video cards
  --launch-ref <ref>              Launch-video git ref
  --catalog-index <url>           HyperFrames llms.txt URL
  --catalog-seed <url>            Fallback catalog markdown URL
  --limit <n>                     Maximum catalog pages to fetch
`);
}

function compact(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}

function unique(values) {
  return [...new Set(values.map((value) => compact(value, 80)).filter(Boolean))];
}

function titleize(value) {
  return value
    .replace(/^c-/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bCss\b/g, "CSS")
    .replace(/\bGsap\b/g, "GSAP")
    .replace(/\bCta\b/g, "CTA")
    .replace(/\bSfx\b/g, "SFX")
    .replace(/\bUi\b/g, "UI")
    .replace(/\bVfx\b/g, "VFX");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function encodePath(value) {
  return String(value).split("/").map(encodeURIComponent).join("/");
}

function decodeBasicHtmlEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function formatSeconds(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}s` : "timed";
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashString(value) {
  return `sha256:${hash(value)}`;
}

function sanitizeRepoUrl(rawRepoUrl) {
  return rawRepoUrl.replace(/https:\/\/[^/@]+@github\.com/i, "https://github.com");
}

function redactForLog(value) {
  return String(value)
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[REDACTED]")
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[REDACTED]")
    .replace(/https:\/\/[^/@]+@github\.com/gi, "https://[REDACTED]@github.com");
}

function assertNoCredentialLeaks(value) {
  const patterns = [
    /github_pat_[A-Za-z0-9_]+/,
    /gh[pousr]_[A-Za-z0-9_]+/,
    /x-access-token/i,
    /BEGIN (?:OPENSSH|RSA|EC|DSA) PRIVATE KEY/,
    /\.ssh\//,
    /credential\.helper/i,
    /https:\/\/[^/\s]+@github\.com/i,
  ];
  for (const pattern of patterns) {
    if (pattern.test(value)) {
      throw new Error(`Generated gallery catalog contains credential-like material: ${pattern}`);
    }
  }
}

function messageFromError(err) {
  return err instanceof Error ? err.message : String(err);
}
