// HTTP server inside the Cloudflare Container.
// POST /render { files: [{ path, content: base64 }], format?, width?, height? } → video bytes | 500 json{error}
// GET  /healthz → 200 "ok"

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

const PORT = Number(process.env.PORT ?? 8080);
const RENDER_TIMEOUT_MS = 10 * 60 * 1000;
const WORKFLOW_TIMEOUT_MS = 4 * 60 * 1000;
const KILL_GRACE_MS = 5_000;
const HYPERFRAMES_BIN = resolve("node_modules/.bin/hyperframes");
const SUPPORTED_FORMATS = new Set(["mp4", "webm", "mov"]);
const CONTENT_TYPES = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

function readBody(req, max = 200 * 1024 * 1024) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > max) {
        reject(new Error(`request body exceeded ${max} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Reject paths that escape the workdir before any fs touch — the Worker's
// file list is trusted, but path traversal is the kind of footgun that's
// cheaper to reject everywhere than to reason about per-caller.
function safeJoin(root, rel) {
  const abs = resolve(root, rel);
  const rootSep = root.endsWith(sep) ? root : root + sep;
  if (!abs.startsWith(rootSep)) {
    throw new Error(`path escapes root: ${rel}`);
  }
  return abs;
}

function writeFiles(workdir, files) {
  return Promise.all(
    files.map(async (f) => {
      const abs = safeJoin(workdir, f.path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, Buffer.from(f.content, "base64"));
    }),
  );
}

function runRender(compDir, outFile, opts = {}) {
  return new Promise((resolveRun, reject) => {
    const args = ["render", compDir, "-o", outFile, "--workers", "auto", "--format", opts.format ?? "mp4"];
    if (opts.resolution) args.push("--resolution", opts.resolution);

    const child = spawn(
      HYPERFRAMES_BIN,
      args,
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    const stderrChunks = [];
    child.stdout.on("data", (d) => process.stdout.write(d));
    child.stderr.on("data", (d) => {
      stderrChunks.push(d);
      process.stderr.write(d);
    });

    let killTimer = null;
    const timeoutTimer = setTimeout(() => {
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
      reject(new Error(`render timed out after ${RENDER_TIMEOUT_MS}ms`));
    }, RENDER_TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      if (code === 0) resolveRun();
      else reject(new Error(`hyperframes render exited ${code}\n${Buffer.concat(stderrChunks).toString()}`));
    });
  });
}

function runCommand(args, opts = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(HYPERFRAMES_BIN, args, {
      cwd: opts.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout.on("data", (d) => {
      stdoutChunks.push(d);
      if (opts.echo) process.stdout.write(d);
    });
    child.stderr.on("data", (d) => {
      stderrChunks.push(d);
      if (opts.echo) process.stderr.write(d);
    });

    let settled = false;
    let killTimer = null;
    const timeoutMs = opts.timeoutMs ?? WORKFLOW_TIMEOUT_MS;
    const timeoutTimer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
      settled = true;
      reject(new Error(`hyperframes ${args[0]} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      reject(err);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      const stdout = Buffer.concat(stdoutChunks).toString();
      const stderr = Buffer.concat(stderrChunks).toString();
      if (code === 0) resolveRun({ stdout, stderr });
      else reject(new Error(`hyperframes ${args[0]} exited ${code}\n${stderr}`));
    });
  });
}

function normalizeFormat(format) {
  if (format === undefined || format === null || format === "") return "mp4";
  if (typeof format !== "string" || !SUPPORTED_FORMATS.has(format)) {
    throw new Error("format must be one of mp4, webm, mov");
  }
  return format;
}

function resolutionFor(width, height) {
  if (width === undefined && height === undefined) return undefined;
  if (width === 1920 && height === 1080) return "1080p";
  if (width === 3840 && height === 2160) return "4k";
  throw new Error("resolution must be 1920x1080 or 3840x2160");
}

async function handleRender(req, res) {
  const t0 = Date.now();
  const workRoot = await mkdtemp(join(tmpdir(), "render-"));
  const compDir = join(workRoot, "composition");
  await mkdir(compDir, { recursive: true });

  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(body?.files) || body.files.length === 0) {
      throw new Error("body.files must be a non-empty array");
    }
    const format = normalizeFormat(body.format);
    const resolution = resolutionFor(body.width, body.height);
    const outFile = join(workRoot, `out.${format}`);
    await writeFiles(compDir, body.files);

    await runRender(compDir, outFile, { format, resolution });
    const { size } = await stat(outFile);

    res.writeHead(200, {
      "content-type": CONTENT_TYPES[format],
      "content-length": size,
      "x-render-duration-ms": String(Date.now() - t0),
    });
    createReadStream(outFile)
      .on("error", (err) => res.destroy(err))
      .pipe(res)
      .on("close", () => {
        rm(workRoot, { recursive: true, force: true }).catch(() => {});
      });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[render] failed", message);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: message }));
    rm(workRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function handleWorkflowCapture(req, res) {
  const workRoot = await mkdtemp(join(tmpdir(), "workflow-capture-"));
  try {
    const raw = await readBody(req, 2 * 1024 * 1024);
    const body = JSON.parse(raw.toString("utf8"));
    if (!body?.url || typeof body.url !== "string") throw new Error("body.url is required");
    const outputDir = join(workRoot, "capture");
    const args = [
      "capture",
      "--json",
      "--output",
      outputDir,
      "--max-screenshots",
      String(Math.max(1, Math.min(24, Number(body.maxScreenshots ?? 8)))),
      "--timeout",
      String(Math.max(1_000, Math.min(120_000, Number(body.timeoutMs ?? 90_000)))),
      body.url,
    ];
    const result = await runCommand(args, { cwd: workRoot, timeoutMs: Number(body.timeoutMs ?? WORKFLOW_TIMEOUT_MS) });
    const parsed = parseJsonOrFallback(result.stdout, { url: body.url });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      url: parsed.url ?? body.url,
      title: parsed.title ?? parsed.name ?? new URL(body.url).hostname,
      description: parsed.description ?? parsed.summary ?? "",
      text: parsed.text ?? parsed.markdown ?? parsed.content ?? "",
      screenshots: parsed.screenshots ?? [],
      assets: parsed.assets ?? [],
      warnings: result.stderr ? [truncate(result.stderr, 2_000)] : [],
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[workflow:capture] failed", message);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  } finally {
    rm(workRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function handleWorkflowValidate(req, res) {
  const workRoot = await mkdtemp(join(tmpdir(), "workflow-validate-"));
  const compDir = join(workRoot, "composition");
  try {
    const raw = await readBody(req, 20 * 1024 * 1024);
    const body = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(body?.files) || body.files.length === 0) {
      throw new Error("body.files must be a non-empty array");
    }
    await mkdir(compDir, { recursive: true });
    await writeFiles(compDir, body.files);
    const timeoutMs = Math.max(1_000, Math.min(120_000, Number(body.timeoutMs ?? 15_000)));
    const lint = await runCommand(["lint", "--json", compDir], { cwd: workRoot, timeoutMs });
    const validate = await runCommand(["validate", "--json", compDir, "--timeout", String(timeoutMs)], { cwd: workRoot, timeoutMs });
    let snapshot = { stdout: "", stderr: "" };
    try {
      snapshot = await runCommand(["snapshot", compDir, "--frames", "3", "--timeout", String(timeoutMs), "--describe", "false"], { cwd: workRoot, timeoutMs });
    } catch (err) {
      snapshot = { stdout: "", stderr: err instanceof Error ? err.message : String(err) };
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      lint: parseJsonOrFallback(lint.stdout, { raw: truncate(lint.stdout, 4_000) }),
      validate: parseJsonOrFallback(validate.stdout, { raw: truncate(validate.stdout, 4_000) }),
      warnings: [lint.stderr, validate.stderr, snapshot.stderr].filter(Boolean).map((text) => truncate(text, 2_000)),
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[workflow:validate] failed", message);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  } finally {
    rm(workRoot, { recursive: true, force: true }).catch(() => {});
  }
}

function parseJsonOrFallback(value, fallback) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    const lastLine = trimmed.split("\n").reverse().find((line) => line.trim().startsWith("{"));
    if (lastLine) {
      try {
        return JSON.parse(lastLine);
      } catch {}
    }
    return fallback;
  }
}

function truncate(value, max) {
  const text = String(value || "");
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  if (req.method === "POST" && req.url === "/render") {
    await handleRender(req, res);
    return;
  }
  if (req.method === "POST" && req.url === "/workflow/capture") {
    await handleWorkflowCapture(req, res);
    return;
  }
  if (req.method === "POST" && req.url === "/workflow/validate") {
    await handleWorkflowValidate(req, res);
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`[render-server] listening on :${PORT}`);
});
