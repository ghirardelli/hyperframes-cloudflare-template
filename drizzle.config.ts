import { existsSync, readFileSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit runs outside the Worker, so it doesn't see Cloudflare bindings.
 * Read DATABASE_URL from the shell env, falling back to `.dev.vars` (the same
 * file `wrangler dev` uses) so `npm run db:migrate` / `db:generate` work without
 * exporting the variable manually.
 */
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(".dev.vars")) return "";
  for (const line of readFileSync(".dev.vars", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() !== "DATABASE_URL") continue;
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (value) return value; // last non-empty wins
  }
  return "";
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
  strict: true,
  verbose: true,
});
