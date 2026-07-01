/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => {
  const template = {
    id: "template-1",
    title: "Launch Template",
    description: "A compact launch rhythm.",
    sourceKind: "root-video" as const,
    durationSec: 8,
    width: 1280,
    height: 720,
    tags: ["launch"],
    sourceUrl: "https://example.com/template",
    sourceRevision: "main",
    previewMedia: {
      type: "image" as const,
      src: "https://example.com/template.png",
      alt: "Launch template",
    },
    promptText: "Use a launch video structure.",
  };
  const component = {
    id: "component-1",
    name: "Hero Component",
    kind: "component" as const,
    category: "Layout",
    description: "A reusable hero block.",
    detail: "Hero block details.",
    tags: ["hero"],
    sourceUrl: "https://example.com/component",
    previewMedia: {
      type: "image" as const,
      src: "https://example.com/component.png",
      alt: "Hero component",
    },
    promptText: "Use the hero component.",
  };
  const componentMaterialization = {
    state: "materializable" as const,
    componentId: "component-1",
    source: {
      registryId: "component-1",
      url: "https://example.com/component",
      revision: "main",
    },
    installCommand: "npx hyperframes add hero",
    canonicalSnippet: "<Hero />",
    files: [],
  };
  return {
    routeOptions: undefined as undefined | { component: ComponentType },
    navigate: vi.fn(),
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
    useConfigQuery: vi.fn(),
    useMeQuery: vi.fn(),
    useStartWebsiteToVideoWorkflowMutation: vi.fn(),
    startWorkflowMutateAsync: vi.fn(),
    template,
    component,
    componentMaterialization,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => routeMocks.queryClient,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => {
    routeMocks.routeOptions = options;
    return { options };
  },
  useNavigate: () => routeMocks.navigate,
}));

vi.mock("@/components/hyperframe-gallery-workspace", () => ({
  buildPromptContextFromIds: ({
    exampleIds,
    componentIds,
    componentPlacementIntents,
  }: {
    exampleIds: Array<string>;
    componentIds: Array<string>;
    componentPlacementIntents: Record<string, string>;
  }) => ({
    examples: exampleIds.includes(routeMocks.template.id)
      ? [
          {
            id: routeMocks.template.id,
            kind: "example",
            name: routeMocks.template.title,
            sourceUrl: routeMocks.template.sourceUrl,
            promptText: routeMocks.template.promptText,
            materialization: { state: "prompt-only" },
          },
        ]
      : [],
    components: componentIds.includes(routeMocks.component.id)
      ? [
          {
            id: routeMocks.component.id,
            kind: "component",
            name: routeMocks.component.name,
            sourceUrl: routeMocks.component.sourceUrl,
            promptText: routeMocks.component.promptText,
            materialization: {
              ...routeMocks.componentMaterialization,
              placementIntent: componentPlacementIntents[routeMocks.component.id],
            },
          },
        ]
      : [],
  }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => routeMocks.toast,
}));

vi.mock("@/lib/app-queries", () => ({
  clearProtectedCaches: vi.fn(),
  useConfigQuery: routeMocks.useConfigQuery,
  useMeQuery: routeMocks.useMeQuery,
  useStartWebsiteToVideoWorkflowMutation: routeMocks.useStartWebsiteToVideoWorkflowMutation,
}));

vi.mock("@/lib/hyperframe-component-registry", () => ({
  getComponentMaterializationState: () => routeMocks.componentMaterialization,
}));

vi.mock("@/lib/hyperframe-gallery-catalog", () => ({
  GALLERY_COMPONENT_SELECTION_LIMIT: 12,
  GALLERY_EXAMPLE_SELECTION_LIMIT: 8,
  countSelectedGalleryItems: (context: { examples: Array<unknown>; components: Array<unknown> }) =>
    context.examples.length + context.components.length,
  filterGalleryComponents: (components: Array<typeof routeMocks.component>, category: string) =>
    !category || category === "All"
      ? components
      : components.filter((component) => component.category === category),
  listGalleryComponentCategories: () => [{ category: "Layout", count: 1 }],
  listGalleryComponents: () => [routeMocks.component],
  listGalleryExamples: () => [routeMocks.template],
  removeGallerySelectionId: (currentIds: ReadonlyArray<string>, id: string) =>
    currentIds.filter((currentId) => currentId !== id),
  toggleGallerySelectionId: (currentIds: ReadonlyArray<string>, id: string, limit: number) =>
    currentIds.includes(id)
      ? currentIds.filter((currentId) => currentId !== id)
      : [...currentIds, id].slice(-limit),
}));

import "./index";

beforeEach(() => {
  routeMocks.navigate.mockResolvedValue(undefined);
  routeMocks.startWorkflowMutateAsync.mockResolvedValue({ id: "run-1" });
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
      websiteToVideoWorkflowEnabled: true,
    },
    isPending: false,
  });
  routeMocks.useStartWebsiteToVideoWorkflowMutation.mockReturnValue({
    isPending: false,
    mutateAsync: routeMocks.startWorkflowMutateAsync,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("main page chat-first intake", () => {
  function renderHome() {
    const Home = routeMocks.routeOptions?.component;
    if (!Home) throw new Error("Expected route component to be registered");
    render(<Home />);
  }

  it("renders the compact composer and template rail instead of the old tabbed workbench", () => {
    renderHome();

    expect(screen.getByRole("heading", { name: /what do you want to create/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/workflow prompt/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /start with a template/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /launch template/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /manual prompt/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/default preview/i)).not.toBeInTheDocument();
  });

  it("selects templates and components, removes context, then sends the workflow intake", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: /launch template/i }));
    expect(screen.getByText("Selected context")).toBeInTheDocument();
    expect(screen.getAllByText("Launch Template").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /components/i }));
    await user.click(screen.getByRole("button", { name: /hero component/i }));
    expect(screen.getAllByText("Hero Component").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /remove hero component/i }));
    expect(screen.queryByRole("button", { name: /remove hero component/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/workflow prompt/i), "Make a polished website launch video");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(routeMocks.startWorkflowMutateAsync).toHaveBeenCalledWith({
        prompt: "Make a polished website launch video",
        durationSec: 6,
        title: "Make a polished website launch video",
        selectedGalleryContext: {
          examples: [
            expect.objectContaining({
              id: "template-1",
              kind: "example",
              name: "Launch Template",
            }),
          ],
          components: [],
        },
      });
    });
    expect(routeMocks.navigate).toHaveBeenCalledWith({
      to: "/workflows/$runId",
      params: { runId: "run-1" },
    });
  });

  it("shows recoverable feedback when Send fails", async () => {
    const user = userEvent.setup();
    routeMocks.startWorkflowMutateAsync.mockRejectedValueOnce(new Error("Unable to start workflow"));
    renderHome();

    await user.type(screen.getByLabelText(/workflow prompt/i), "Make a homepage launch video");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(routeMocks.toast.error).toHaveBeenCalledWith("Unable to start workflow");
    });
    expect(routeMocks.navigate).not.toHaveBeenCalled();
  });
});
