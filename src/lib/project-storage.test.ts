import { describe, expect, it, vi } from "vitest";

import { deleteProjectObject, projectWorkspaceKey, writeProjectObject } from "./project-storage";

describe("project storage service", () => {
  it("builds immutable org/user/project workspace keys", () => {
    expect(
      projectWorkspaceKey({
        organizationId: "org-1",
        ownerId: "user-1",
        projectId: "project-1",
        path: "assets/logo.png",
      }),
    ).toBe("orgs/org-1/users/user-1/projects/project-1/workspace/assets/logo.png");
  });

  it("falls back to R2 when Bunny Storage is not configured", async () => {
    const put = vi.fn(async () => undefined);
    const pointer = await writeProjectObject(
      { RENDERS: { put } as unknown as R2Bucket },
      {
        key: "orgs/org-1/users/user-1/projects/project-1/workspace/assets/logo.png",
        bytes: new TextEncoder().encode("bytes"),
        contentType: "image/png",
      },
    );

    expect(pointer.provider).toBe("r2");
    expect(pointer.key).toContain("orgs/org-1/users/user-1/projects/project-1/workspace/assets/logo.png");
    expect(put).toHaveBeenCalled();
  });

  it("deletes stored project objects from R2 and Bunny Storage", async () => {
    const r2Delete = vi.fn(async () => undefined);
    await deleteProjectObject(
      { RENDERS: { delete: r2Delete } as unknown as R2Bucket },
      { provider: "r2", key: "assets/orgs/org-1/users/user-1/projects/project-1/workspace/assets/logo.png" },
    );

    expect(r2Delete).toHaveBeenCalledWith(
      "assets/orgs/org-1/users/user-1/projects/project-1/workspace/assets/logo.png",
    );

    const fetcher = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetcher);
    await deleteProjectObject(
      {
        RENDERS: { delete: vi.fn() } as unknown as R2Bucket,
        BUNNY_STORAGE_ZONE_NAME: "zone",
        BUNNY_STORAGE_ACCESS_KEY: "storage-secret",
        BUNNY_STORAGE_ENDPOINT: "https://la.storage.bunnycdn.com",
      },
      { provider: "bunny-storage", key: "orgs/org-1/users/user-1/projects/project-1/workspace/assets/logo.png" },
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://la.storage.bunnycdn.com/zone/orgs/org-1/users/user-1/projects/project-1/workspace/assets/logo.png",
      expect.objectContaining({ method: "DELETE" }),
    );
    vi.unstubAllGlobals();
  });
});
