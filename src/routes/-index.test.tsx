/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  routeOptions: undefined as undefined | { component: ComponentType },
  queryClient: {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  },
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    show: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  invalidateProjectCaches: vi.fn(),
  useConfigQuery: vi.fn(),
  useGenerateHyperframeMutation: vi.fn(),
  useMeQuery: vi.fn(),
  useRenderMutation: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => routeMocks.queryClient,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => {
    routeMocks.routeOptions = options;
    return { options };
  },
}));

vi.mock("@/components/hyperframe-gallery-workspace", () => ({
  buildPromptContextFromIds: () => ({ examples: [], components: [] }),
  HyperframeGalleryWorkspace: () => (
    <section aria-label="Gallery workspace">Gallery workspace</section>
  ),
}));

vi.mock("@/components/prompt-agent-panel", () => ({
  PromptAgentPanel: () => <section aria-label="AI Agent panel">AI Agent panel</section>,
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => routeMocks.toast,
}));

vi.mock("@/lib/app-queries", () => ({
  invalidateProjectCaches: routeMocks.invalidateProjectCaches,
  useConfigQuery: routeMocks.useConfigQuery,
  useGenerateHyperframeMutation: routeMocks.useGenerateHyperframeMutation,
  useMeQuery: routeMocks.useMeQuery,
  useRenderMutation: routeMocks.useRenderMutation,
}));

import "./index";

beforeEach(() => {
  localStorage.clear();
  routeMocks.useMeQuery.mockReturnValue({
    data: {
      user: { id: "user-1", name: "Ada", email: "ada@example.com", role: "" },
      organization: { id: "org-1", name: "Acme" },
    },
    isError: false,
  });
  routeMocks.useConfigQuery.mockReturnValue({
    data: {
      aiGenEnabled: true,
      modelLabel: "openrouter/test",
      transcriptionProviderLabel: null,
      voiceInputEnabled: false,
    },
    isPending: false,
  });
  routeMocks.useGenerateHyperframeMutation.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  });
  routeMocks.useRenderMutation.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("main page creation flow", () => {
  it("does not show duration controls in AI Agent or Manual Prompt modes", async () => {
    const user = userEvent.setup();
    const Home = routeMocks.routeOptions?.component;
    if (!Home) throw new Error("Expected route component to be registered");

    render(<Home />);

    const creationPanel = screen.getByText("Create HyperFrame").closest("[data-slot='card']");
    expect(creationPanel).not.toBeNull();
    expect(within(creationPanel as HTMLElement).queryByLabelText("Duration")).not.toBeInTheDocument();
    expect(
      within(creationPanel as HTMLElement).queryByText(
        "Duration is used before generation so the motion timing and final beat fit the timeline.",
      ),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /manual prompt/i }));

    expect(within(creationPanel as HTMLElement).queryByLabelText("Duration")).not.toBeInTheDocument();
    expect(
      within(creationPanel as HTMLElement).queryByText(
        "Duration is used before generation so the motion timing and final beat fit the timeline.",
      ),
    ).not.toBeInTheDocument();
  });
});
