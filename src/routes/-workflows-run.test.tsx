/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => {
  const selectedGalleryContext = {
    examples: [
      {
        id: "template-1",
        kind: "example" as const,
        name: "Launch Template",
        sourceUrl: "https://example.com/template",
        promptText: "Use a launch template.",
        materialization: { state: "prompt-only" as const },
      },
    ],
    components: [
      {
        id: "component-1",
        kind: "component" as const,
        name: "Hero Component",
        sourceUrl: "https://example.com/component",
        promptText: "Use a reusable hero.",
        materialization: {
          state: "materializable" as const,
          componentId: "component-1",
          source: {
            url: "https://example.com/component",
            packageName: "@hyperframes/components",
            packageVersion: "1.0.0",
            revision: "main",
          },
          installCommand: "npx hyperframes add hero",
          canonicalSnippet: "<Hero />",
          durationSec: 8,
          width: 1280,
          height: 720,
          files: [
            {
              path: "components/hero.html",
              contentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            },
          ],
        },
      },
    ],
  };
  const intakePlan = {
    runId: "run-1",
    projectId: null,
    workflowId: "website-to-video",
    status: "intake",
    options: {
      intake: {
        source: "main-page-chat",
        prompt: "Make a compact launch video",
        sourceUrl: "https://example.com",
        durationSec: 8,
        selectedGalleryContext,
      },
    },
    activeStageId: "capture",
    stages: [
      {
        id: "capture",
        label: "Brief",
        description: "Review prompt, selected templates, components, and source details.",
        status: "ready",
        required: true,
        editable: true,
        artifacts: [],
      },
      {
        id: "design",
        label: "Design",
        description: "Brand reference, colors, typography, components, and guardrails.",
        status: "not_started",
        required: true,
        editable: false,
        artifacts: [],
      },
    ],
    studioUrl: null,
    updatedAt: null,
  };
  const artifactPlan = {
    runId: "run-1",
    projectId: "project-1",
    workflowId: "website-to-video",
    status: "succeeded",
    options: {},
    activeStageId: "design",
    stages: [
      {
        id: "capture",
        label: "Capture",
        description: "Source screenshots, assets, fonts, and visual references.",
        status: "ready",
        required: false,
        editable: false,
        artifacts: [],
      },
      {
        id: "design",
        label: "Design",
        description: "Brand reference, colors, typography, components, and guardrails.",
        status: "ready",
        required: true,
        editable: true,
        artifacts: [
          {
            path: "DESIGN.md",
            label: "DESIGN.md",
            role: "design",
            contentType: "text/markdown",
            editable: true,
            size: 128,
          },
        ],
      },
    ],
    studioUrl: "/projects/project-1/studio",
    updatedAt: null,
  };
  return {
    routeOptions: undefined as undefined | { component: ComponentType },
    stagePlan: intakePlan as unknown,
    artifactQuery: { data: null, isError: false, error: null } as unknown,
    selectedGalleryContext,
    intakePlan,
    artifactPlan,
    toast: {
      error: vi.fn(),
      success: vi.fn(),
    },
    saveIntakeMutateAsync: vi.fn(),
    continueWorkflowMutateAsync: vi.fn(),
    saveArtifactMutateAsync: vi.fn(),
    validateStageMutate: vi.fn(),
  };
});

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => {
    routeMocks.routeOptions = options;
    return {
      options,
      useParams: () => ({ runId: "run-1" }),
    };
  },
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock("@/components/app-header", () => ({
  AppHeader: () => <header>App header</header>,
}));

vi.mock("@/components/prompt-agent-panel", () => ({
  PromptAgentPanel: (props: {
    prompt: string;
    activeWizardStageId?: string;
    selectedGalleryContext: { examples: Array<unknown>; components: Array<unknown> };
    workflowRunId?: string;
  }) => (
    <section aria-label="Agent chat">
      <span>{props.prompt}</span>
      <span>Stage {props.activeWizardStageId}</span>
      <span>Run {props.workflowRunId}</span>
      <span>
        Context {props.selectedGalleryContext.examples.length + props.selectedGalleryContext.components.length}
      </span>
    </section>
  ),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => routeMocks.toast,
}));

vi.mock("@/lib/app-queries", () => ({
  useConfigQuery: () => ({
    data: {
      aiGenEnabled: true,
      modelLabel: "openrouter/test",
      transcriptionProviderLabel: null,
      voiceInputEnabled: false,
    },
    isPending: false,
  }),
  useContinueWorkflowMutation: () => ({
    isPending: false,
    mutateAsync: routeMocks.continueWorkflowMutateAsync,
  }),
  useSaveWorkflowIntakeMutation: () => ({
    isPending: false,
    mutateAsync: routeMocks.saveIntakeMutateAsync,
  }),
  useSaveWorkflowStageArtifactMutation: () => ({
    isPending: false,
    mutateAsync: routeMocks.saveArtifactMutateAsync,
  }),
  useValidateWorkflowStageMutation: () => ({
    data: null,
    error: null,
    isError: false,
    isPending: false,
    mutate: routeMocks.validateStageMutate,
  }),
  useWorkflowStageArtifactQuery: () => routeMocks.artifactQuery,
  useWorkflowStagePlanQuery: () => ({
    data: routeMocks.stagePlan,
    isError: false,
    isPending: false,
  }),
}));

import "./workflows.$runId";

beforeEach(() => {
  routeMocks.stagePlan = routeMocks.intakePlan;
  routeMocks.artifactQuery = { data: null, isError: false, error: null };
  routeMocks.saveIntakeMutateAsync.mockImplementation(async (input) => ({
    id: "run-1",
    options: { intake: input.intake },
  }));
  routeMocks.continueWorkflowMutateAsync.mockResolvedValue({ id: "run-1", status: "queued" });
  routeMocks.saveArtifactMutateAsync.mockResolvedValue({
    runId: "run-1",
    projectId: "project-1",
    stageId: "design",
    path: "DESIGN.md",
    content: "# Saved",
    contentType: "text/markdown",
    revision: "rev-2",
    updatedAt: null,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("workflow wizard intake route", () => {
  function renderWizard() {
    const WorkflowWizard = routeMocks.routeOptions?.component;
    if (!WorkflowWizard) throw new Error("Expected route component to be registered");
    render(<WorkflowWizard />);
  }

  it("hydrates the intake brief and forwards workflow context to the agent", () => {
    renderWizard();

    expect(screen.getByRole("navigation", { name: /pipeline stages/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Brief" })).toBeInTheDocument();
    expect(screen.getByLabelText(/brief/i)).toHaveValue("Make a compact launch video");
    expect(screen.getByLabelText(/source url/i)).toHaveValue("https://example.com");
    expect(screen.getByText("Launch Template")).toBeInTheDocument();
    expect(screen.getByText("Hero Component")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /agent chat/i })).toHaveTextContent("Stage capture");
    expect(screen.getByRole("region", { name: /agent chat/i })).toHaveTextContent("Context 2");
  });

  it("supports discarding and saving creative brief edits", async () => {
    const user = userEvent.setup();
    renderWizard();

    const brief = screen.getByLabelText(/brief/i);
    await user.clear(brief);
    await user.type(brief, "A discarded edit");
    await user.click(screen.getByRole("button", { name: /discard/i }));
    expect(screen.getByLabelText(/brief/i)).toHaveValue("Make a compact launch video");

    await user.clear(screen.getByLabelText(/brief/i));
    await user.type(screen.getByLabelText(/brief/i), "Updated launch brief");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(routeMocks.saveIntakeMutateAsync).toHaveBeenCalledWith({
        runId: "run-1",
        intake: expect.objectContaining({
          source: "main-page-chat",
          prompt: "Updated launch brief",
          sourceUrl: "https://example.com",
          durationSec: 8,
          selectedGalleryContext: routeMocks.selectedGalleryContext,
        }),
      });
    });
    expect(routeMocks.continueWorkflowMutateAsync).not.toHaveBeenCalled();
  });

  it("saves the reviewed brief before continuing workflow execution", async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.clear(screen.getByLabelText(/source url/i));
    await user.type(screen.getByLabelText(/source url/i), "https://example.com/product");
    await user.click(screen.getByRole("button", { name: /start workflow/i }));

    await waitFor(() => {
      expect(routeMocks.saveIntakeMutateAsync).toHaveBeenCalledWith({
        runId: "run-1",
        intake: expect.objectContaining({
          sourceUrl: "https://example.com/product",
        }),
      });
    });
    expect(routeMocks.continueWorkflowMutateAsync).toHaveBeenCalledWith("run-1");
  });

  it("preserves raw artifact editing and validation for non-intake stages", () => {
    routeMocks.stagePlan = routeMocks.artifactPlan;
    routeMocks.artifactQuery = {
      data: {
        runId: "run-1",
        projectId: "project-1",
        stageId: "design",
        path: "DESIGN.md",
        content: "# Design",
        contentType: "text/markdown",
        revision: "rev-1",
        updatedAt: null,
      },
      isError: false,
      error: null,
    };

    renderWizard();

    expect(screen.getByRole("heading", { name: "Design" })).toBeInTheDocument();
    expect(screen.getByLabelText("DESIGN.md")).toHaveValue("# Design");
    expect(screen.getByRole("button", { name: /validate/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open studio/i })).toHaveAttribute(
      "href",
      "/projects/project-1/studio",
    );
  });
});
