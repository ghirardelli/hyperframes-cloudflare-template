const root = ["motion-frames"] as const;

export const queryKeys = {
  root,
  me: () => [...root, "me"] as const,
  config: () => [...root, "config"] as const,
  profile: () => [...root, "profile"] as const,
  admin: {
    root: () => [...root, "admin"] as const,
    organizations: () => [...queryKeys.admin.root(), "organizations"] as const,
    users: () => [...queryKeys.admin.root(), "users"] as const,
  },
  projects: {
    root: () => [...root, "projects"] as const,
    list: () => [...queryKeys.projects.root(), "list"] as const,
    detail: (projectId: string) => [...queryKeys.projects.root(), "detail", projectId] as const,
    renders: (projectId: string) => [...queryKeys.projects.detail(projectId), "renders"] as const,
  },
  catalog: () => [...root, "catalog"] as const,
  workflows: {
    root: () => [...root, "workflows"] as const,
    run: (runId: string) => [...queryKeys.workflows.root(), "run", runId] as const,
    stages: (runId: string) => [...queryKeys.workflows.run(runId), "stages"] as const,
    artifact: (runId: string, path: string) =>
      [...queryKeys.workflows.stages(runId), "artifact", path] as const,
    validation: (runId: string, stageId: string) =>
      [...queryKeys.workflows.stages(runId), "validation", stageId] as const,
  },
  renders: {
    root: () => [...root, "renders"] as const,
    status: (renderId: string) => [...queryKeys.renders.root(), "status", renderId] as const,
  },
};
