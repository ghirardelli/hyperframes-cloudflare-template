import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@cloudflare/containers", () => ({
  Container: class {},
  getContainer: () => {
    throw new Error("container rendering is not used in this unit test");
  },
}));

vi.mock("../lib/generate", () => ({
  DEFAULT_MODEL: "google/gemini-3-flash-preview",
  GenerateError: class GenerateError extends Error {
    status = 500;
  },
  generateComposition: () => {
    throw new Error("generation is not used in this unit test");
  },
}));

const mocks = vi.hoisted(() => ({
  requireAuthContext: vi.fn(),
  selectRows: [] as Array<Array<Record<string, unknown>>>,
  inserts: [] as Array<Record<string, unknown>>,
  conflictUpdates: [] as Array<Record<string, unknown>>,
}));

function nextSelectRows() {
  return Promise.resolve(mocks.selectRows.shift() ?? []);
}

function selectChain() {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(nextSelectRows),
    limit: vi.fn(nextSelectRows),
  };
  return chain;
}

vi.mock("../db", () => ({
  createDb: () => ({
    select: vi.fn(selectChain),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        mocks.inserts.push(values);
        return {
          onConflictDoUpdate: vi.fn((cfg: { set: Record<string, unknown> }) => {
            mocks.conflictUpdates.push(cfg.set);
            return Promise.resolve();
          }),
          onConflictDoNothing: vi.fn(() => Promise.resolve()),
          returning: vi.fn(() => Promise.resolve([values])),
        };
      }),
    })),
    delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
  }),
}));

vi.mock("../auth", () => ({ createAuth: () => ({ handler: vi.fn() }) }));

vi.mock("../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth-context")>("../lib/auth-context");
  return { ...actual, requireAuthContext: mocks.requireAuthContext };
});

import { AuthRequiredError } from "../lib/auth-context";
import { handleWorkerApi, type WorkerEnv } from "./render-api";

const env = { ENABLE_AI_GEN: "true" } as WorkerEnv;
const member = {
  user: { id: "user-1", name: "Member", email: "m@e.com", role: "user" },
  organization: { id: "org-1", name: "Acme" },
};

function appShowcaseManifestJson(): string {
  return JSON.stringify({
    version: 1,
    updatedAt: "2026-06-30T12:00:00.000Z",
    actor: { id: "user-1", type: "user" },
    snapshotId: null,
    components: [
      {
        componentId: "app-showcase",
        name: "App Showcase",
        installCommand: "npx hyperframes add app-showcase",
        source: {
          url: "https://github.com/heygen-com/hyperframes/tree/main/packages/hyperframes/registry/blocks/app-showcase",
          packageName: "hyperframes",
          packageVersion: "0.7.21",
          revision: "hyperframes@0.7.21",
        },
        canonicalSnippet:
          '<div data-composition-id="app-showcase" data-composition-src="compositions/app-showcase.html" data-start="0" data-duration="5.5" data-track-index="1" data-width="1920" data-height="1080"></div>',
        installedPaths: ["compositions/app-showcase.html"],
        files: [
          {
            path: "compositions/app-showcase.html",
            contentHash: "sha256:226f722506968b574d84d19bee000aa0601819311971dea398db06b86a94fe8b",
          },
        ],
        placements: [
          {
            componentId: "app-showcase",
            startSec: 0,
            durationSec: 5.5,
            trackIndex: 1,
            width: 1920,
            height: 1080,
            hostSnippet:
              '<div data-composition-id="app-showcase" data-composition-src="compositions/app-showcase.html"></div>',
          },
        ],
        materializedAt: "2026-06-30T12:00:00.000Z",
      },
    ],
  });
}

describe("studio multi-file API", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mocks.requireAuthContext.mockReset();
    mocks.requireAuthContext.mockResolvedValue(member);
    mocks.selectRows = [];
    mocks.inserts = [];
    mocks.conflictUpdates = [];
  });

  it("rejects unauthenticated file access", async () => {
    mocks.requireAuthContext.mockRejectedValue(new AuthRequiredError());
    const res = await handleWorkerApi(
      new Request("https://mf.test/api/projects/p1/files"),
      env,
    );
    expect(res?.status).toBe(401);
  });

  it("denies cross-organization file access", async () => {
    mocks.selectRows = [[{ id: "p1", organizationId: "org-2" }]]; // requireProjectAccess
    const res = await handleWorkerApi(
      new Request("https://mf.test/api/projects/p1/files"),
      env,
    );
    expect(res?.status).toBe(403);
  });

  it("lists files for the owning organization", async () => {
    mocks.selectRows = [
      [{ id: "p1", organizationId: "org-1" }], // requireProjectAccess
      [], // project_entries list
      [], // materialized component manifest lookup
      [{ path: "index.html" }, { path: "compositions/intro.html" }], // list
    ];
    const res = await handleWorkerApi(
      new Request("https://mf.test/api/projects/p1/files"),
      env,
    );
    expect(res?.status).toBe(200);
    await expect(res?.json()).resolves.toMatchObject({
      files: ["index.html", "compositions/intro.html"],
      entries: [
        { path: "index.html", kind: "text" },
        { path: "compositions/intro.html", kind: "text" },
      ],
    });
  });

  it("tags registry-managed component files from the materialization manifest", async () => {
    mocks.selectRows = [
      [{ id: "p1", organizationId: "org-1" }], // requireProjectAccess
      [
        {
          path: "compositions/app-showcase.html",
          kind: "text",
          artifactRole: "composition",
          contentType: "text/html; charset=utf-8",
          size: 32411,
        },
      ], // project_entries list
      [{ content: appShowcaseManifestJson() }], // materialized component manifest lookup
    ];

    const res = await handleWorkerApi(
      new Request("https://mf.test/api/projects/p1/files"),
      env,
    );

    expect(res?.status).toBe(200);
    await expect(res?.json()).resolves.toMatchObject({
      entries: [
        {
          path: "compositions/app-showcase.html",
          artifactRole: "registry-component",
          registryComponent: {
            componentId: "app-showcase",
            sourceRevision: "hyperframes@0.7.21",
            contentHash: "sha256:226f722506968b574d84d19bee000aa0601819311971dea398db06b86a94fe8b",
          },
        },
      ],
    });
  });

  it("blocks direct saves to registry-managed component files", async () => {
    mocks.selectRows = [
      [{ id: "p1", organizationId: "org-1", ownerId: "user-1", visibility: "private" }], // requireProjectAccess
      [{ content: appShowcaseManifestJson() }], // registry-managed lookup
    ];

    const res = await handleWorkerApi(
      new Request("https://mf.test/api/projects/p1/files/compositions%2Fapp-showcase.html", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "<p>edited</p>" }),
      }),
      env,
    );

    expect(res?.status).toBe(409);
    await expect(res?.json()).resolves.toEqual({
      error: "registry-managed component files are read-only; duplicate the file to customize it",
    });
    expect(mocks.inserts).toEqual([]);
  });

  it("upserts a file's content", async () => {
    mocks.selectRows = [[{ id: "p1", organizationId: "org-1", ownerId: "user-1", visibility: "private" }]]; // requireProjectAccess
    const res = await handleWorkerApi(
      new Request("https://mf.test/api/projects/p1/files/index.html", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "<h1>hi</h1>" }),
      }),
      env,
    );
    expect(res?.status).toBe(200);
    await expect(res?.json()).resolves.toEqual({ path: "index.html" });
    expect(mocks.inserts[0]).toMatchObject({
      projectId: "p1",
      organizationId: "org-1",
      path: "index.html",
      content: "<h1>hi</h1>",
    });
    expect(mocks.conflictUpdates[0]).toMatchObject({ content: "<h1>hi</h1>" });
  });

  it("returns a single file's content", async () => {
    mocks.selectRows = [
      [{ id: "p1", organizationId: "org-1" }], // requireProjectAccess
      [{ path: "index.html", content: "<h1>hi</h1>" }], // file lookup
    ];
    const res = await handleWorkerApi(
      new Request("https://mf.test/api/projects/p1/files/index.html"),
      env,
    );
    expect(res?.status).toBe(200);
    await expect(res?.json()).resolves.toEqual({ path: "index.html", content: "<h1>hi</h1>" });
  });

  it("uploads new assets to Bunny Storage when configured", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    mocks.selectRows = [[{ id: "p1", organizationId: "org-1", ownerId: "user-1", visibility: "private" }]];

    const res = await handleWorkerApi(
      new Request("https://mf.test/api/projects/p1/assets?path=assets/logo.png", {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: "PNG",
      }),
      {
        ...env,
        BUNNY_STORAGE_ZONE_NAME: "zone",
        BUNNY_STORAGE_ACCESS_KEY: "storage-secret",
        BUNNY_STORAGE_ENDPOINT: "https://la.storage.bunnycdn.com",
      },
    );

    expect(res?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://la.storage.bunnycdn.com/zone/orgs/org-1/users/user-1/projects/p1/workspace/assets/logo.png",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(mocks.inserts).toContainEqual(
      expect.objectContaining({
        path: "assets/logo.png",
        storageProvider: "bunny-storage",
        storageKey: "orgs/org-1/users/user-1/projects/p1/workspace/assets/logo.png",
      }),
    );
  });
});
