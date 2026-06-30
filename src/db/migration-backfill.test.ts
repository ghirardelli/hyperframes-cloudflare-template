import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guards the multi-file migration's data backfill: every existing project must
// gain an index.html source file seeded from current_html, without disturbing
// renders/publish links (it only inserts into project_files, idempotently).
describe("project_files migration backfill", () => {
  const sql = readFileSync(
    new URL("../../drizzle/0002_messy_silver_fox.sql", import.meta.url),
    "utf8",
  );

  it("creates the project_files table", () => {
    expect(sql).toMatch(/CREATE TABLE "project_files"/);
  });

  it("backfills index.html from current_html for existing projects", () => {
    expect(sql).toMatch(/INSERT INTO "project_files"/);
    expect(sql).toMatch(/'index\.html'/);
    expect(sql).toMatch(/COALESCE\("current_html", ''\)/);
    expect(sql).toMatch(/FROM "projects"/);
  });

  it("is idempotent and does not touch other tables", () => {
    expect(sql).toMatch(/ON CONFLICT \("project_id", "path"\) DO NOTHING/);
    expect(sql).not.toMatch(/DELETE FROM/i);
    expect(sql).not.toMatch(/INSERT INTO "renders"/);
    expect(sql).not.toMatch(/INSERT INTO "published_projects"/);
  });
});

describe("project_entries migration backfill", () => {
  const sql = readFileSync(
    new URL("../../drizzle/0004_bright_mandarin.sql", import.meta.url),
    "utf8",
  );

  it("does not create a btree index on large search_text content", () => {
    expect(sql).toMatch(/"search_text" text/);
    expect(sql).not.toMatch(/CREATE INDEX "project_entries_search_idx"/);
    expect(sql).not.toMatch(/USING btree \("search_text"\)/);
  });
});
