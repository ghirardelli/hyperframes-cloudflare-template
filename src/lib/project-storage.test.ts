import { describe, expect, it, vi } from "vitest";

import { projectWorkspaceKey, writeProjectObject } from "./project-storage";

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
});
