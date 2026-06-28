import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { createDb, type DbEnv } from "./db";
import * as schema from "./db/schema";

export interface AuthEnv extends DbEnv {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
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
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
        bannedUserMessage: "Your Motion Frames account is locked. Contact your administrator.",
      }),
      tanstackStartCookies(),
    ],
  });
}
