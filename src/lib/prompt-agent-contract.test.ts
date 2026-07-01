import { describe, expect, it } from "vitest";

import {
  normalizePromptAgentForwardedProps,
  promptAgentAttachedAssetSchema,
  promptAgentForwardedPropsSchema,
  promptAgentTranscriptionRequestSchema,
  promptAgentTranscriptionResultSchema,
} from "./prompt-agent-contract";

describe("prompt agent media contracts", () => {
  it("normalizes attached project assets in forwarded props", () => {
    const forwarded = normalizePromptAgentForwardedProps({
      projectId: "project-1",
      attachedAssets: [
        {
          path: "assets/logo.png",
          url: "/api/projects/project-1/assets/assets/logo.png",
          contentType: "image/png",
          size: 1234,
          originalName: "Logo.png",
        },
      ],
    });

    expect(forwarded.attachedAssets).toEqual([
      {
        path: "assets/logo.png",
        url: "/api/projects/project-1/assets/assets/logo.png",
        contentType: "image/png",
        size: 1234,
        originalName: "Logo.png",
      },
    ]);
    expect(promptAgentForwardedPropsSchema.parse(forwarded)).toMatchObject({
      attachedAssets: expect.arrayContaining([
        expect.objectContaining({ path: "assets/logo.png", contentType: "image/png" }),
      ]),
    });
  });

  it("rejects attachment metadata outside the project asset namespace", () => {
    expect(() =>
      promptAgentAttachedAssetSchema.parse({
        path: "http://example.com/logo.png",
        contentType: "image/png",
        size: 100,
      }),
    ).toThrow();
    expect(() =>
      promptAgentAttachedAssetSchema.parse({
        path: "../logo.png",
        contentType: "image/png",
        size: 100,
      }),
    ).toThrow();
  });

  it("validates transcription request and result payloads", () => {
    expect(
      promptAgentTranscriptionRequestSchema.parse({
        audio: "data:audio/webm;base64,AAAA",
        mimeType: "audio/webm",
        durationMs: 1200,
      }),
    ).toMatchObject({ mimeType: "audio/webm", durationMs: 1200 });

    expect(
      promptAgentTranscriptionResultSchema.parse({
        text: "Make the launch video feel warmer",
        language: "en",
        durationSec: 1.2,
      }),
    ).toEqual({
      text: "Make the launch video feel warmer",
      language: "en",
      durationSec: 1.2,
    });
  });
});
