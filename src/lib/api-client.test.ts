import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiJson, messageFromError, setUnauthorizedHandler } from "./api-client";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

describe("apiJson", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    setUnauthorizedHandler(null);
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  it("returns parsed JSON for successful responses", async () => {
    globalThis.fetch = vi.fn(async () => Response.json({ ok: true })) as typeof fetch;

    await expect(apiJson<{ ok: boolean }>("/api/example")).resolves.toEqual({ ok: true });
  });

  it("throws ApiError with normalized server messages", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({ error: "Name is required" }, { status: 400 }),
    ) as typeof fetch;

    await expect(apiJson("/api/example")).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Name is required",
    } satisfies Partial<ApiError>);
  });

  it("clears protected cache and redirects on unauthorized responses", async () => {
    const clear = vi.fn();
    const assign = vi.fn();
    setUnauthorizedHandler(clear);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { pathname: "/", assign } },
    });
    globalThis.fetch = vi.fn(async () =>
      Response.json({ error: "auth required" }, { status: 401 }),
    ) as typeof fetch;

    await expect(apiJson("/api/me")).rejects.toMatchObject({ status: 401 });

    expect(clear).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/login");
  });
});

describe("messageFromError", () => {
  it("returns friendly messages from Error objects", () => {
    expect(messageFromError(new Error("Nope"))).toBe("Nope");
    expect(messageFromError("plain")).toBe("plain");
  });
});
