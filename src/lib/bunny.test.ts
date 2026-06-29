import { describe, expect, it, vi } from "vitest";

import {
  BunnyStorageClient,
  BunnyStreamClient,
  getBunnyStorageConfig,
  getBunnyStreamConfig,
  sha256Hex,
} from "./bunny";

describe("Bunny clients", () => {
  it("builds Storage API upload requests with AccessKey and checksum", async () => {
    const fetcher = vi.fn(async () => new Response("ok"));
    const client = new BunnyStorageClient(
      {
        zoneName: "motionframes-projects-staging",
        accessKey: "storage-secret",
        endpoint: "https://la.storage.bunnycdn.com",
      },
      fetcher as typeof fetch,
    );

    await client.uploadFile({
      path: "orgs/org-1/users/user-1/projects/project-1/workspace/assets/logo.png",
      body: new ArrayBuffer(0),
      contentType: "image/png",
      sha256: "abc123",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://la.storage.bunnycdn.com/motionframes-projects-staging/orgs/org-1/users/user-1/projects/project-1/workspace/assets/logo.png",
      expect.objectContaining({
        method: "PUT",
        headers: expect.any(Headers),
      }),
    );
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    const headers = init.headers as Headers;
    expect(headers.get("AccessKey")).toBe("storage-secret");
    expect(headers.get("Checksum")).toBe("ABC123");
    expect(headers.get("content-type")).toBe("image/png");
  });

  it("creates and uploads Stream videos with the library AccessKey", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ guid: "video-1", status: 0 })))
      .mockResolvedValueOnce(new Response("ok"));
    const client = new BunnyStreamClient(
      {
        libraryId: "123",
        accessKey: "stream-secret",
        apiBase: "https://video.bunnycdn.com",
        collectionId: "collection-1",
      },
      fetcher as typeof fetch,
    );

    const video = await client.createVideo({ title: "Render" });
    await client.uploadVideo(video.guid, new ArrayBuffer(0), "video/mp4");

    expect(video.guid).toBe("video-1");
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://video.bunnycdn.com/library/123/videos");
    expect(fetcher.mock.calls[1]?.[0]).toBe("https://video.bunnycdn.com/library/123/videos/video-1");
    expect((((fetcher.mock.calls[1] as unknown as [string, RequestInit])[1]).headers as Record<string, string>).AccessKey).toBe(
      "stream-secret",
    );
  });

  it("returns null for fully absent Bunny config and parses configured env", () => {
    expect(getBunnyStorageConfig({})).toBeNull();
    expect(getBunnyStreamConfig({})).toBeNull();
    expect(
      getBunnyStorageConfig({
        BUNNY_STORAGE_ZONE_NAME: "zone",
        BUNNY_STORAGE_ACCESS_KEY: "key",
        BUNNY_STORAGE_ENDPOINT: "https://storage.bunnycdn.com/",
      }),
    ).toMatchObject({ zoneName: "zone", endpoint: "https://storage.bunnycdn.com" });
  });

  it("computes uppercase SHA256 hex checksums", async () => {
    await expect(sha256Hex(new TextEncoder().encode("abc"))).resolves.toBe(
      "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD",
    );
  });
});
