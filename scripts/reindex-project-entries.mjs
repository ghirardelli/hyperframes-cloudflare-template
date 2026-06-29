#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = neon(databaseUrl);

const result = await sql`
  UPDATE project_entries
  SET search_text = trim(concat_ws(E'\n',
    path,
    artifact_role,
    content_type,
    text_content,
    metadata::text
  )),
  updated_at = now()
  WHERE deleted_at IS NULL
`;

console.log(`Reindexed project_entries search_text (${result.count ?? 0} rows).`);
