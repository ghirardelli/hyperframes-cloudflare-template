import { describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  betterAuth: vi.fn((config) => ({ config })),
  dash: vi.fn((config) => ({ plugin: "dash", config })),
  admin: vi.fn((config) => ({ plugin: "admin", config })),
  drizzleAdapter: vi.fn(() => "drizzle-adapter"),
  tanstackStartCookies: vi.fn(() => ({ plugin: "tanstack-start-cookies" })),
}));

vi.mock("better-auth", () => ({
  betterAuth: authMocks.betterAuth,
}));

vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: authMocks.drizzleAdapter,
}));

vi.mock("@better-auth/infra", () => ({
  dash: authMocks.dash,
}));

vi.mock("better-auth/plugins", () => ({
  admin: authMocks.admin,
}));

vi.mock("better-auth/tanstack-start", () => ({
  tanstackStartCookies: authMocks.tanstackStartCookies,
}));

vi.mock("./db", () => ({
  createDb: () => "db",
}));

import { createAuth } from "./auth";

describe("Better Auth configuration", () => {
  it("disables public email/password signup", () => {
    createAuth({
      DATABASE_URL: "postgresql://example",
      BETTER_AUTH_SECRET: "secret",
      BETTER_AUTH_URL: "https://motion-frames.test",
    });

    const config = authMocks.betterAuth.mock.calls.at(-1)?.[0];
    expect(config.emailAndPassword).toMatchObject({
      enabled: true,
      disableSignUp: true,
    });
  });

  it("registers the admin plugin for invited users and account locks", () => {
    createAuth({
      DATABASE_URL: "postgresql://example",
      BETTER_AUTH_SECRET: "secret",
      BETTER_AUTH_URL: "https://motion-frames.test",
    });

    expect(authMocks.admin).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultRole: "user",
        adminRoles: ["admin"],
      }),
    );
  });

  it("registers the Better Auth Dash infrastructure plugin", () => {
    createAuth({
      DATABASE_URL: "postgresql://example",
      BETTER_AUTH_SECRET: "secret",
      BETTER_AUTH_URL: "https://motion-frames.test",
      BETTER_AUTH_API_URL: "https://dash.better-auth.com",
      BETTER_AUTH_KV_URL: "https://kv.better-auth.com",
      BETTER_AUTH_API_KEY: "dash-key",
    });

    expect(authMocks.dash).toHaveBeenCalledWith(
      expect.objectContaining({
        apiUrl: "https://dash.better-auth.com",
        kvUrl: "https://kv.better-auth.com",
        apiKey: "dash-key",
      }),
    );
  });
});
