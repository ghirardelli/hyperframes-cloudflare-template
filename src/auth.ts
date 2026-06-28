import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { dash } from "@better-auth/infra";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { createDb, type DbEnv } from "./db";
import * as schema from "./db/schema";

export interface AuthEnv extends DbEnv {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_API_URL?: string;
  BETTER_AUTH_KV_URL?: string;
  BETTER_AUTH_API_KEY?: string;
}

export function createAuth(env: AuthEnv) {
  return betterAuth({
    appName: "Motion Frames",
    basePath: "/api/auth",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(createDb(env), {
      provider: "pg",
      schema,
      usePlural: true,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
    },
    plugins: [
      dash({
        apiUrl: env.BETTER_AUTH_API_URL,
        kvUrl: env.BETTER_AUTH_KV_URL,
        apiKey: env.BETTER_AUTH_API_KEY,
      }),
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
        bannedUserMessage: "Your Motion Frames account is locked. Contact your administrator.",
      }),
      tanstackStartCookies(),
    ],
  });
}
