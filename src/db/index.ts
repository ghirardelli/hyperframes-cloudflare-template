import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export interface DbEnv {
  DATABASE_URL?: string;
  HYPERDRIVE?: Hyperdrive;
}

export function createDb(env: DbEnv) {
  const sql = neon(getNeonHttpConnectionString(env));
  return drizzle(sql, { schema });
}

export function getNeonHttpConnectionString(env: DbEnv): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  throw new Error("DATABASE_URL is required for Neon HTTP database access.");
}

export type AppDb = ReturnType<typeof createDb>;
