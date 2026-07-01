import {
  useMutation,
  useQuery,
  useQueryClient,
  queryOptions,
  type QueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiJson } from "./api-client";
import type { SelectedGalleryPromptContext } from "./hyperframe-gallery-catalog";
import type { WorkflowIntakePayload } from "./workflow-intake";
import {
  buildRenderRequestBody,
  type ExportResolutionId,
  type RenderFormat,
} from "./main-page-creation-flow";
import type { ProjectLibraryProject, ProjectLibraryRender } from "./my-projects-gallery";
import type { WorkflowRunOutput } from "./prompt-agent-client";
import type {
  WizardStageArtifactContent,
  WizardStageId,
  WizardStagePlan,
  WizardStageValidationResult,
} from "./pipeline-wizard";
import { queryKeys } from "./query-keys";

export interface CurrentUserResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role?: string | null;
  };
  organization: {
    id: string;
    name: string;
  };
}

export interface ConfigResponse {
  aiGenEnabled: boolean;
  websiteToVideoWorkflowEnabled?: boolean;
  voiceInputEnabled?: boolean;
  transcriptionProviderLabel?: string | null;
  modelLabel: string;
}

export interface ProfileResponse {
  user: {
    id?: string;
    name: string;
    email: string;
    role?: string | null;
  };
  organization: {
    id?: string;
    name: string;
  };
}

export interface Organization {
  id: string;
  name: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  organizationId?: string | null;
  organizationName?: string | null;
}

export type Project = ProjectLibraryProject & {
  prompt?: string | null;
  visibility?: string | null;
  status?: string | null;
};

export interface CatalogItem {
  id: string;
  title: string;
  description?: string | null;
  durationSec?: number;
  width?: number;
  height?: number;
  projectId?: string;
}

export interface GenerateHyperframeRequest {
  prompt: string;
  durationSec: number;
  projectId?: string;
  selectedGalleryContext?: SelectedGalleryPromptContext;
}

export interface GenerateHyperframeResponse {
  html?: string;
  project?: { id: string; title: string };
  model?: string;
  attempts?: number;
  durationMs?: number;
  lintOk?: boolean;
  lintErrors?: Array<string | { code?: string; message?: string }>;
}

export interface RenderResponse {
  url?: string;
  durationMs?: number;
  source?: "bundled" | "html";
}

export interface StartWebsiteToVideoWorkflowRequest {
  prompt?: string;
  url?: string;
  durationSec?: number;
  title?: string;
  projectId?: string;
  selectedGalleryContext?: SelectedGalleryPromptContext;
}

export function useMeQuery(): UseQueryResult<CurrentUserResponse> {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => apiJson<CurrentUserResponse>("/api/me"),
  });
}

export function useConfigQuery(): UseQueryResult<ConfigResponse> {
  return useQuery({
    queryKey: queryKeys.config(),
    queryFn: () => apiJson<ConfigResponse>("/api/config"),
    staleTime: 60_000,
  });
}

export function useProfileQuery(): UseQueryResult<ProfileResponse> {
  return useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => apiJson<ProfileResponse>("/api/profile"),
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiJson<ProfileResponse>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile(), profile);
      queryClient.setQueryData(queryKeys.me(), profile);
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      apiJson<{ ok: true }>("/api/profile/password", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function useAdminOrganizationsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.organizations(),
    queryFn: () => apiJson<{ organizations: Array<Organization> }>("/api/admin/organizations"),
    enabled,
  });
}

export function useAdminUsersQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: () => apiJson<{ users: Array<AdminUser> }>("/api/admin/users"),
    enabled,
  });
}

export function useCreateAdminUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      email: string;
      password: string;
      role: string;
      organizationId?: string;
      organizationName?: string;
    }) =>
      apiJson("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateAdminCaches(queryClient),
  });
}

export function useSetUserLockedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; locked: boolean }) =>
      apiJson(`/api/admin/users/${encodeURIComponent(input.userId)}`, {
        method: "PATCH",
        body: JSON.stringify({ locked: input.locked }),
      }),
    onSuccess: () => invalidateAdminCaches(queryClient),
  });
}

export function useProjectsQuery(): UseQueryResult<{ projects: Array<Project> }> {
  return useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: () => apiJson<{ projects: Array<Project> }>("/api/projects"),
  });
}

export function useProjectRendersQuery(projectId: string, enabled = true) {
  return useQuery({
    ...projectRendersQueryOptions(projectId),
    enabled: enabled && projectId.length > 0,
  });
}

export function projectRendersQueryOptions(projectId: string) {
  return queryOptions({
    queryKey: queryKeys.projects.renders(projectId),
    queryFn: () =>
      apiJson<{ renders: Array<ProjectLibraryRender> }>(
        `/api/projects/${encodeURIComponent(projectId)}/renders`,
      ),
    enabled: projectId.length > 0,
    staleTime: 15_000,
    refetchInterval: (query) =>
      hasActiveRenderStatus(query.state.data?.renders) ? 3_000 : false,
  });
}

export function useUpdateProjectMetadataMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; title: string; description: string }) =>
      apiJson<{ project: Project }>(`/api/projects/${encodeURIComponent(input.projectId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: input.title,
          description: input.description,
        }),
      }),
    onSuccess: ({ project }) => {
      queryClient.setQueryData<{ projects: Array<Project> }>(queryKeys.projects.list(), (current) =>
        current
          ? { projects: current.projects.map((item) => (item.id === project.id ? project : item)) }
          : current,
      );
      queryClient.setQueryData(queryKeys.projects.detail(project.id), { project });
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiJson<{ ok: true }>(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, projectId) => {
      queryClient.setQueryData<{ projects: Array<Project> }>(queryKeys.projects.list(), (current) =>
        current ? { projects: current.projects.filter((project) => project.id !== projectId) } : current,
      );
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
}

export function useCatalogQuery() {
  return useQuery({
    queryKey: queryKeys.catalog(),
    queryFn: () =>
      apiJson<{
        catalogCount: number;
        examples: Array<CatalogItem>;
        publishedProjects: Array<CatalogItem>;
      }>("/api/catalog"),
    staleTime: 60_000,
  });
}

export function useRemixPublishedProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publishedId: string) =>
      apiJson<{ project: { id: string } }>(
        `/api/published/${encodeURIComponent(publishedId)}/remix`,
        { method: "POST" },
      ),
    onSuccess: (data) => {
      invalidateProjectCaches(queryClient, data.project.id);
    },
  });
}

export function useGenerateHyperframeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateHyperframeRequest) =>
      apiJson<GenerateHyperframeResponse>("/api/generate", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      invalidateProjectCaches(queryClient, data.project?.id);
    },
  });
}

export function useRenderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      html: string;
      projectId: string;
      resolutionId: ExportResolutionId;
      format: RenderFormat;
    }) =>
      apiJson<RenderResponse>("/api/render", {
        method: "POST",
        body: JSON.stringify(
          buildRenderRequestBody({
            html: input.html,
            projectId: input.projectId,
            resolutionId: input.resolutionId,
            format: input.format,
          }),
        ),
      }),
    onSuccess: (_data, input) => {
      invalidateProjectCaches(queryClient, input.projectId);
    },
  });
}

export function useStartWebsiteToVideoWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartWebsiteToVideoWorkflowRequest) =>
      apiJson<{ workflowRun: WorkflowRunOutput }>("/api/workflows/website-to-video", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((data) => data.workflowRun),
    onSuccess: (workflowRun) => {
      queryClient.setQueryData(queryKeys.workflows.run(workflowRun.id), workflowRun);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workflows.root() });
    },
  });
}

export function useWorkflowRunQuery(runId: string | null | undefined, status?: string | null) {
  return useQuery({
    queryKey: queryKeys.workflows.run(runId ?? ""),
    queryFn: () =>
      apiJson<{ workflowRun: WorkflowRunOutput }>(`/api/workflows/${encodeURIComponent(runId ?? "")}`)
        .then((data) => data.workflowRun),
    enabled: Boolean(runId) && isWorkflowPollingStatus(status),
    refetchInterval: (query) =>
      isWorkflowPollingStatus(query.state.data?.status ?? status) ? 2_500 : false,
  });
}

export function useWorkflowStagePlanQuery(runId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workflows.stages(runId ?? ""),
    queryFn: () =>
      apiJson<{ stagePlan: WizardStagePlan }>(
        `/api/workflows/${encodeURIComponent(runId ?? "")}/stages`,
      ).then((data) => data.stagePlan),
    enabled: enabled && Boolean(runId),
  });
}

export function useWorkflowStageArtifactQuery(
  input: {
    runId: string | null | undefined;
    stageId: WizardStageId | null | undefined;
    path: string | null | undefined;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.workflows.artifact(input.runId ?? "", input.path ?? ""),
    queryFn: () =>
      apiJson<{ artifact: WizardStageArtifactContent }>(
        `/api/workflows/${encodeURIComponent(input.runId ?? "")}/stages/${encodeURIComponent(
          input.stageId ?? "",
        )}/artifacts/${encodeURIComponent(input.path ?? "")}`,
      ).then((data) => data.artifact),
    enabled: enabled && Boolean(input.runId && input.stageId && input.path),
  });
}

export function useSaveWorkflowStageArtifactMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      runId: string;
      stageId: WizardStageId;
      path: string;
      content: string;
      revision?: string | null;
    }) =>
      apiJson<{ artifact: WizardStageArtifactContent }>(
        `/api/workflows/${encodeURIComponent(input.runId)}/stages/${encodeURIComponent(
          input.stageId,
        )}/artifacts/${encodeURIComponent(input.path)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            content: input.content,
            revision: input.revision ?? null,
          }),
        },
      ).then((data) => data.artifact),
    onSuccess: (artifact, input) => {
      queryClient.setQueryData(queryKeys.workflows.artifact(input.runId, input.path), artifact);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workflows.stages(input.runId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workflows.run(input.runId) });
      invalidateProjectCaches(queryClient, artifact.projectId);
    },
  });
}

export function useSaveWorkflowIntakeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { runId: string; intake: WorkflowIntakePayload }) =>
      apiJson<{ workflowRun: WorkflowRunOutput }>(
        `/api/workflows/${encodeURIComponent(input.runId)}/intake`,
        {
          method: "PATCH",
          body: JSON.stringify(input.intake),
        },
      ).then((data) => data.workflowRun),
    onSuccess: (workflowRun) => {
      queryClient.setQueryData(queryKeys.workflows.run(workflowRun.id), workflowRun);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workflows.stages(workflowRun.id) });
    },
  });
}

export function useContinueWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      apiJson<{ workflowRun: WorkflowRunOutput }>(
        `/api/workflows/${encodeURIComponent(runId)}/continue`,
        { method: "POST" },
      ).then((data) => data.workflowRun),
    onSuccess: (workflowRun) => {
      queryClient.setQueryData(queryKeys.workflows.run(workflowRun.id), workflowRun);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workflows.stages(workflowRun.id) });
    },
  });
}

export function useValidateWorkflowStageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { runId: string; stageId: WizardStageId }) =>
      apiJson<{ validation: WizardStageValidationResult }>(
        `/api/workflows/${encodeURIComponent(input.runId)}/stages/${encodeURIComponent(
          input.stageId,
        )}/validate`,
        { method: "POST" },
      ).then((data) => data.validation),
    onSuccess: (validation, input) => {
      queryClient.setQueryData(
        queryKeys.workflows.validation(input.runId, input.stageId),
        validation,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.workflows.stages(input.runId) });
    },
  });
}

export function useRenderStatusQuery(renderId: string | null | undefined, active = false) {
  return useQuery({
    queryKey: queryKeys.renders.status(renderId ?? ""),
    queryFn: () => apiJson<Response>(`/api/renders/${encodeURIComponent(renderId ?? "")}`),
    enabled: Boolean(renderId) && active,
    refetchInterval: active ? 3_000 : false,
  });
}

export function invalidateProjectCaches(queryClient: QueryClient, projectId?: string | null): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() });
  if (!projectId) return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects.renders(projectId) });
}

export function clearProtectedCaches(queryClient: QueryClient): void {
  queryClient.clear();
}

export function isWorkflowPollingStatus(status: string | null | undefined): boolean {
  return status ? ACTIVE_WORKFLOW_STATUSES.has(status) : false;
}

export function hasActiveRenderStatus(
  renders: ReadonlyArray<Pick<ProjectLibraryRender, "streamStatus">> | null | undefined,
): boolean {
  return Boolean(renders?.some((render) => isRenderPollingStatus(render.streamStatus)));
}

export function isRenderPollingStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return !TERMINAL_RENDER_STATUSES.has(status.toLowerCase());
}

const ACTIVE_WORKFLOW_STATUSES = new Set(["intake", "queued", "running", "awaiting_approval"]);
const TERMINAL_RENDER_STATUSES = new Set(["ready", "failed", "cancelled", "unavailable"]);

function invalidateAdminCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.admin.root() });
}
