/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PromptAgentPanel } from "./prompt-agent-panel";
import type { SelectedGalleryPromptContext } from "@/lib/hyperframe-gallery-catalog";

const aiReactMocks = vi.hoisted(() => ({
  useAudioRecorder: vi.fn(),
  useChat: vi.fn(),
  useTranscription: vi.fn(),
}));

const aiClientMocks = vi.hoisted(() => ({
  bodyFactory: undefined as undefined | (() => unknown),
  clientTools: vi.fn((...tools: Array<unknown>) => tools),
  fetchServerSentEvents: vi.fn((_url: string, bodyFactory: () => unknown) => {
    aiClientMocks.bodyFactory = bodyFactory;
    return { connect: vi.fn() };
  }),
}));

const appQueryMocks = vi.hoisted(() => ({
  invalidateProjectCaches: vi.fn(),
  useWorkflowRunQuery: vi.fn(() => ({ data: null })),
}));

const queryClientMock = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

vi.mock("@tanstack/ai-react", () => aiReactMocks);
vi.mock("@tanstack/ai-client", () => ({
  clientTools: aiClientMocks.clientTools,
  fetchServerSentEvents: aiClientMocks.fetchServerSentEvents,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => queryClientMock,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock("@/lib/app-queries", () => appQueryMocks);

const emptyGalleryContext: SelectedGalleryPromptContext = {
  examples: [],
  components: [],
};

const recording = {
  base64: "cmVjb3JkaW5n",
  blob: new Blob(["recording"], { type: "audio/webm" }),
  durationMs: 1200,
  mimeType: "audio/webm",
  part: {
    type: "audio",
    source: {
      type: "data",
      value: "cmVjb3JkaW5n",
      mimeType: "audio/webm",
    },
  },
};

let sendMessage: ReturnType<typeof vi.fn>;
let startRecording: ReturnType<typeof vi.fn>;
let stopRecording: ReturnType<typeof vi.fn>;
let transcribeAudio: ReturnType<typeof vi.fn>;
let transcriptionOptions: { onResult?: (result: { text: string }) => unknown } = {};
let audioState: { isRecording: boolean; isSupported: boolean };

beforeEach(() => {
  sendMessage = vi.fn().mockResolvedValue(undefined);
  startRecording = vi.fn().mockResolvedValue(undefined);
  stopRecording = vi.fn().mockResolvedValue(recording);
  transcribeAudio = vi.fn().mockImplementation(async () => {
    transcriptionOptions.onResult?.({ text: "Talked prompt" });
  });
  transcriptionOptions = {};
  audioState = { isRecording: false, isSupported: true };
  aiClientMocks.bodyFactory = undefined;
  aiClientMocks.fetchServerSentEvents.mockClear();
  appQueryMocks.invalidateProjectCaches.mockClear();
  queryClientMock.invalidateQueries.mockClear();

  aiReactMocks.useChat.mockReturnValue({
    addToolApprovalResponse: vi.fn(),
    clear: vi.fn(),
    error: undefined,
    final: null,
    isLoading: false,
    messages: [],
    partial: null,
    reload: vi.fn(),
    sendMessage,
    stop: vi.fn(),
  });
  aiReactMocks.useAudioRecorder.mockImplementation(() => ({
    cancel: vi.fn(),
    isRecording: audioState.isRecording,
    isSupported: audioState.isSupported,
    recording: null,
    start: startRecording,
    stop: stopRecording,
  }));
  aiReactMocks.useTranscription.mockImplementation((options: typeof transcriptionOptions) => {
    transcriptionOptions = options;
    return {
      error: undefined,
      generate: transcribeAudio,
      isLoading: false,
      reset: vi.fn(),
      result: null,
      status: "idle",
      stop: vi.fn(),
    };
  });
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PromptAgentPanel media inputs", () => {
  it("disables voice input when provider config is unavailable or browser recording is unsupported", () => {
    const unavailable = renderPanel({ voiceInputEnabled: false });
    expect(
      screen.getByRole("button", { name: /voice input unavailable/i }),
    ).toBeDisabled();

    unavailable.unmount();
    audioState.isSupported = false;
    renderPanel({ voiceInputEnabled: true });

    expect(
      screen.getByRole("button", { name: /microphone unavailable/i }),
    ).toBeDisabled();
  });

  it("records audio, transcribes it into editable text, and sends the reviewed transcript", async () => {
    const user = userEvent.setup();
    const view = renderPanel({ voiceInputEnabled: true });

    await user.click(screen.getByRole("button", { name: /start voice input/i }));
    expect(startRecording).toHaveBeenCalledTimes(1);

    audioState.isRecording = true;
    view.rerender(renderPromptAgentPanel({ voiceInputEnabled: true }));
    await user.click(screen.getByRole("button", { name: /stop recording/i }));

    expect(stopRecording).toHaveBeenCalledTimes(1);
    expect(transcribeAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: "data:audio/webm;base64,cmVjb3JkaW5n",
        durationMs: 1200,
        mimeType: "audio/webm",
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Ask the agent")).toHaveValue("Talked prompt"),
    );

    await user.clear(screen.getByLabelText("Ask the agent"));
    await user.type(screen.getByLabelText("Ask the agent"), "Edited transcript prompt");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(sendMessage).toHaveBeenCalledWith("Edited transcript prompt");
  });

  it("uploads attachments, forwards their asset metadata with the next message, and clears them after send", async () => {
    const user = userEvent.setup();
    let forwardedBody: unknown;
    sendMessage.mockImplementation(async () => {
      forwardedBody = aiClientMocks.bodyFactory?.();
    });
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          path: "assets/logo.png",
          url: "/api/projects/project-1/assets/assets/logo.png",
          contentType: "image/png",
          size: 4,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    renderPanel({ activeProjectId: "project-1" });
    await user.upload(
      screen.getByLabelText("Attach files"),
      new File(["logo"], "Logo Final!.PNG", { type: "image/png" }),
    );

    expect(await screen.findByText("assets/logo.png")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/project-1/agent-assets?filename=Logo%20Final!.PNG",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "image/png" },
      }),
    );

    await user.type(screen.getByLabelText("Ask the agent"), "Use the uploaded logo");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(sendMessage).toHaveBeenCalledWith("Use the uploaded logo");
    expect(forwardedBody).toMatchObject({
      body: {
        attachedAssets: [
          expect.objectContaining({
            originalName: "Logo Final!.PNG",
            path: "assets/logo.png",
          }),
        ],
      },
    });
    await waitFor(() => expect(screen.queryByText("assets/logo.png")).not.toBeInTheDocument());
    expect(appQueryMocks.invalidateProjectCaches).toHaveBeenCalledWith(queryClientMock, "project-1");
  });

  it("keeps text chat usable while attachment upload is disabled without an active project", async () => {
    const user = userEvent.setup();
    renderPanel({ activeProjectId: "" });

    expect(screen.getByLabelText("Attach files")).toBeDisabled();

    await user.type(screen.getByLabelText("Ask the agent"), "Help with the prompt");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(sendMessage).toHaveBeenCalledWith("Help with the prompt");
  });

  it("shows attachment upload errors without blocking text submission", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "unsupported attachment type" }), {
        status: 415,
        headers: { "content-type": "application/json" },
      }),
    );

    renderPanel({ activeProjectId: "project-1" });
    await user.upload(
      screen.getByLabelText("Attach files"),
      new File(["bad"], "malware.exe", { type: "application/x-msdownload" }),
    );

    expect(await screen.findByText("unsupported attachment type")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Ask the agent"), "Keep chatting");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(sendMessage).toHaveBeenCalledWith("Keep chatting");
  });
});

function renderPanel(overrides: Partial<PromptAgentPanelPropsForTest> = {}) {
  return render(renderPromptAgentPanel(overrides));
}

function renderPromptAgentPanel(overrides: Partial<PromptAgentPanelPropsForTest> = {}) {
  const props: PromptAgentPanelPropsForTest = {
    activeProjectId: "project-1",
    activeProjectTitle: "Launch Reel",
    aiEnabled: true,
    durationSec: 8,
    isConfigReady: true,
    isGenerating: false,
    isRendering: false,
    modelLabel: "openrouter/test",
    onDurationChange: vi.fn(),
    onGenerated: vi.fn(),
    onPromptChange: vi.fn(),
    prompt: "Existing prompt",
    selectedGalleryContext: emptyGalleryContext,
    transcriptionProviderLabel: "whisper-1",
    voiceInputEnabled: true,
    ...overrides,
  };
  return <PromptAgentPanel {...props} />;
}

type PromptAgentPanelPropsForTest = Parameters<typeof PromptAgentPanel>[0];
