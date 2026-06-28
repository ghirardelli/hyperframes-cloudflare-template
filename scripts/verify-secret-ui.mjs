import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, worker, readme, devVars] = await Promise.all([
  readFile("public/index.html", "utf8"),
  readFile("src/index.ts", "utf8"),
  readFile("README.md", "utf8"),
  readFile(".dev.vars.example", "utf8"),
]);

for (const forbidden of [
  'id="api-key"',
  "OpenRouter API key",
  "BYOK",
  "sessionStorage",
  "openrouter-key",
  "JSON.stringify({ apiKey, prompt",
]) {
  assert.equal(
    html.includes(forbidden),
    false,
    `public/index.html must not expose browser-side OpenRouter key flow: ${forbidden}`,
  );
}

assert.match(worker, /OPENROUTER_API_KEY\??: string/, "Worker env must declare OPENROUTER_API_KEY");
assert.match(worker, /OPENROUTER_MODEL\??: string/, "Worker env must declare OPENROUTER_MODEL");
assert.equal(worker.includes("body.apiKey"), false, "Worker must not read apiKey from request body");
assert.match(worker, /apiKey: openRouterKey/, "Worker must use OpenRouter key from env");

assert.match(readme, /wrangler secret put OPENROUTER_API_KEY/, "README must document production secret setup");
assert.match(devVars, /OPENROUTER_API_KEY=/, ".dev.vars.example must document local OpenRouter key");
