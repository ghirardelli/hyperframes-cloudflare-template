#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_REPO_URL = "https://github.com/aaronpie/hyperframes.git";
const DEFAULT_REF = "main";
const DEFAULT_OUTPUT = "src/generated/hyperframes-skills.ts";
const REQUIRED_SKILL_IDS = [
  "hyperframes",
  "hyperframes-core",
  "hyperframes-animation",
  "hyperframes-creative",
  "website-to-video",
  "product-launch-video",
];
const WORKFLOW_SKILL_IDS = new Set([
  "website-to-video",
  "product-launch-video",
  "faceless-explainer",
  "motion-graphics",
  "general-video",
]);

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const repoUrl = options.repo ?? process.env.HYPERFRAMES_SKILLS_REPO_URL ?? DEFAULT_REPO_URL;
const sourceRepoUrl =
  options.sourceUrl ?? process.env.HYPERFRAMES_SKILLS_SOURCE_URL ?? repoUrl;
const ref = options.ref ?? process.env.HYPERFRAMES_SKILLS_REF ?? DEFAULT_REF;
const outputPath = resolve(options.output ?? process.env.HYPERFRAMES_SKILLS_OUTPUT ?? DEFAULT_OUTPUT);
const token =
  options.token ??
  process.env.HYPERFRAMES_SKILLS_GITHUB_TOKEN ??
  process.env.GH_TOKEN ??
  process.env.GITHUB_TOKEN;

const tempRoot = mkdtempSync(join(tmpdir(), "hyperframes-skills-"));
const cloneDir = join(tempRoot, "repo");

try {
  cloneRepository(repoUrl, cloneDir, ref, token);
  const commitSha = git(["-C", cloneDir, "rev-parse", "HEAD"], { silent: true }).stdout.trim();
  const catalog = buildCatalog({
    repoDir: cloneDir,
    sourceRepoUrl: sanitizeRepoUrl(sourceRepoUrl),
    ref,
    commitSha,
  });
  const rendered = renderArtifact(catalog);
  assertNoCredentialLeaks(rendered, token);

  if (options.check) {
    const existing = readExistingArtifact(outputPath);
    const normalizedExisting = JSON.stringify({ ...existing, generatedAt: catalog.generatedAt }, null, 2);
    const normalizedNext = JSON.stringify(catalog, null, 2);
    if (normalizedExisting !== normalizedNext) {
      throw new Error(
        `Committed HyperFrames skill catalog is out of sync with ${sanitizeRepoUrl(sourceRepoUrl)}#${commitSha}. Run npm run sync:hyperframes-skills.`,
      );
    }
    console.log(`HyperFrames skill catalog is in sync with ${commitSha}.`);
  } else {
    writeFileSync(outputPath, rendered);
    console.log(`Wrote ${relative(process.cwd(), outputPath)} from ${commitSha}.`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function buildCatalog({ repoDir, sourceRepoUrl, ref, commitSha }) {
  const skillsRoot = join(repoDir, "skills");
  if (!existsSync(skillsRoot)) {
    throw new Error(`Expected skills directory at ${skillsRoot}`);
  }

  const skills = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readSkill(join(skillsRoot, entry.name), entry.name))
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));

  const missing = REQUIRED_SKILL_IDS.filter((id) => !skills.some((skill) => skill.id === id));
  if (missing.length) {
    throw new Error(`Missing required HyperFrames skill ids: ${missing.join(", ")}`);
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      repoUrl: sourceRepoUrl,
      ref,
      commitSha,
    },
    requiredSkillIds: REQUIRED_SKILL_IDS,
    skills,
  };
}

function readSkill(skillDir, fallbackId) {
  const skillPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillPath)) return null;

  const raw = normalizeMarkdown(readFileSync(skillPath, "utf8"));
  const { frontmatter, body } = splitFrontmatter(raw);
  const id = normalizeSkillId(frontmatter.name ?? fallbackId);
  const title = frontmatter.title ?? titleize(id);
  const description = frontmatter.description ?? extractDescription(body);

  return {
    id,
    title,
    group: classifySkill(id),
    description,
    path: slash(relative(join(skillDir, ".."), skillPath)),
    metadata: {
      name: frontmatter.name ?? id,
    },
    markdown: body.trimEnd(),
    contentHash: `sha256:${hash(body.trimEnd())}`,
    referenceIndex: listReferenceIndex(skillDir),
  };
}

function splitFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) {
    return { frontmatter: {}, body: markdown.trimStart() };
  }

  const end = markdown.indexOf("\n---\n", 4);
  if (end === -1) return { frontmatter: {}, body: markdown.trimStart() };

  return {
    frontmatter: parseFrontmatter(markdown.slice(4, end)),
    body: markdown.slice(end + "\n---\n".length).trimStart(),
  };
}

function parseFrontmatter(frontmatter) {
  const parsed = {};
  const lines = frontmatter.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[index]);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (rawValue === ">" || rawValue === "|") {
      const valueLines = [];
      index += 1;
      while (index < lines.length && /^\s+/.test(lines[index])) {
        valueLines.push(lines[index].trim());
        index += 1;
      }
      index -= 1;
      parsed[key] = valueLines.join(rawValue === ">" ? " " : "\n").trim();
    } else {
      parsed[key] = rawValue.replace(/^["']|["']$/g, "").trim();
    }
  }
  return parsed;
}

function listReferenceIndex(skillDir) {
  const referencesDir = join(skillDir, "references");
  if (!existsSync(referencesDir)) return [];

  return walk(referencesDir)
    .filter((filePath) => statSync(filePath).isFile())
    .map((filePath) => {
      const content = readFileSync(filePath);
      return {
        path: slash(relative(skillDir, filePath)),
        bytes: content.byteLength,
        contentHash: `sha256:${hash(content)}`,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function cloneRepository(rawRepoUrl, destination, ref, token) {
  const repoForClone = withReadOnlyToken(rawRepoUrl, token);
  const branchClone = git([
    "clone",
    "--depth",
    "1",
    "--branch",
    ref,
    repoForClone,
    destination,
  ], { silent: true, allowFailure: true });

  if (branchClone.status === 0) return;

  rmSync(destination, { recursive: true, force: true });
  git(["clone", "--depth", "1", repoForClone, destination], { silent: true });
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

function withReadOnlyToken(rawRepoUrl, token) {
  if (!token || !rawRepoUrl.startsWith("https://")) return rawRepoUrl;
  const url = new URL(rawRepoUrl);
  if (url.hostname !== "github.com") return rawRepoUrl;
  url.username = "x-access-token";
  url.password = token;
  return url.toString();
}

function sanitizeRepoUrl(rawRepoUrl) {
  if (rawRepoUrl.startsWith("https://")) {
    const url = new URL(rawRepoUrl);
    url.username = "";
    url.password = "";
    return url.toString();
  }
  return rawRepoUrl.replace(/^https:\/\/[^/@\s]+@/i, "https://");
}

function assertNoCredentialLeaks(text, token) {
  const checks = [
    /github_pat_[A-Za-z0-9_]+/,
    /gh[pousr]_[A-Za-z0-9_]+/,
    /x-access-token/i,
    /BEGIN (?:OPENSSH|RSA|EC|DSA) PRIVATE KEY/,
    /\.ssh\//,
    /credential\.helper/i,
    /https:\/\/[^/\s]+@github\.com/i,
  ];

  if (token && text.includes(token)) {
    throw new Error("Generated catalog would include the GitHub token; refusing to write.");
  }

  for (const pattern of checks) {
    if (pattern.test(text)) {
      throw new Error(`Generated catalog appears to include credential material: ${pattern}`);
    }
  }
}

function redactForLog(value) {
  return String(value)
    .replace(/https:\/\/x-access-token:[^@\s]+@github\.com/gi, "https://x-access-token:[redacted]@github.com")
    .replace(/https:\/\/[^:/\s]+:[^@\s]+@github\.com/gi, "https://[redacted]@github.com")
    .replace(/https:\/\/[^/@\s]+@github\.com/gi, "https://[redacted]@github.com");
}

function readExistingArtifact(outputPath) {
  if (!existsSync(outputPath)) {
    throw new Error(`Cannot check missing artifact ${outputPath}`);
  }

  const text = readFileSync(outputPath, "utf8");
  const match = /export const hyperframesSkillsCatalog = ([\s\S]*?) as const;/.exec(text);
  if (!match) {
    throw new Error(`Could not parse ${outputPath} as a generated HyperFrames skill artifact.`);
  }
  return JSON.parse(match[1]);
}

function renderArtifact(catalog) {
  return `// Generated by scripts/sync-hyperframes-skills.mjs. Do not edit by hand.\n` +
    `// Source: ${catalog.source.repoUrl} @ ${catalog.source.commitSha}\n\n` +
    `export const hyperframesSkillsCatalog = ${JSON.stringify(catalog, null, 2)} as const;\n\n` +
    `export type HyperframesSkillsCatalogArtifact = typeof hyperframesSkillsCatalog;\n`;
}

function classifySkill(id) {
  if (id === "hyperframes") return "router";
  if (WORKFLOW_SKILL_IDS.has(id)) return "workflow";
  return "domain";
}

function normalizeSkillId(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractDescription(body) {
  const line = body
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("#"));
  return line ? line.replace(/^[-*> ]+/, "").slice(0, 240) : "";
}

function titleize(id) {
  return id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeMarkdown(value) {
  return value.replace(/\r\n?/g, "\n").trim() + "\n";
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function slash(pathName) {
  return pathName.split(sep).join("/");
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--repo") parsed.repo = requireValue(args, ++index, arg);
    else if (arg === "--source-url") parsed.sourceUrl = requireValue(args, ++index, arg);
    else if (arg === "--ref") parsed.ref = requireValue(args, ++index, arg);
    else if (arg === "--output") parsed.output = requireValue(args, ++index, arg);
    else if (arg === "--token") parsed.token = requireValue(args, ++index, arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function requireValue(args, index, flag) {
  const value = args[index];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

function printHelp() {
  console.log(`Sync HyperFrames skills into a generated local catalog.

Usage:
  node scripts/sync-hyperframes-skills.mjs [--check] [--repo <url-or-path>] [--ref <ref>] [--output <path>]

Defaults:
  repo:   ${DEFAULT_REPO_URL}
  ref:    ${DEFAULT_REF}
  output: ${DEFAULT_OUTPUT}

Environment:
  HYPERFRAMES_SKILLS_REPO_URL     Private fork URL or local checkout path.
  HYPERFRAMES_SKILLS_SOURCE_URL   Sanitized source URL to record when using a local mirror.
  HYPERFRAMES_SKILLS_REF          Branch, tag, or commit to sync.
  HYPERFRAMES_SKILLS_OUTPUT       Generated artifact path.
  HYPERFRAMES_SKILLS_GITHUB_TOKEN Read-only GitHub token for CI HTTPS clones.
  GH_TOKEN or GITHUB_TOKEN        Fallback read-only token names.

Local development can rely on existing git credentials, SSH agent, or gh auth.
No tokens, SSH paths, credential helper paths, or credential-bearing URLs are written.`);
}
