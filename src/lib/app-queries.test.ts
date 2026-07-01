import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import {
  clearProtectedCaches,
  hasActiveRenderStatus,
  invalidateProjectCaches,
  isRenderPollingStatus,
  isWorkflowPollingStatus,
} from "./app-queries";
import { queryKeys } from "./query-keys";

describe("isWorkflowPollingStatus", () => {
  it("polls only while workflow runs are active", () => {
    expect(isWorkflowPollingStatus("intake")).toBe(true);
    expect(isWorkflowPollingStatus("queued")).toBe(true);
    expect(isWorkflowPollingStatus("running")).toBe(true);
    expect(isWorkflowPollingStatus("awaiting_approval")).toBe(true);
    expect(isWorkflowPollingStatus("succeeded")).toBe(false);
    expect(isWorkflowPollingStatus("failed")).toBe(false);
    expect(isWorkflowPollingStatus("cancelled")).toBe(false);
    expect(isWorkflowPollingStatus(undefined)).toBe(false);
  });
});

describe("render polling status", () => {
  it("polls only while render stream status is non-terminal", () => {
    expect(isRenderPollingStatus("processing")).toBe(true);
    expect(isRenderPollingStatus("encoding")).toBe(true);
    expect(isRenderPollingStatus("ready")).toBe(false);
    expect(isRenderPollingStatus("failed")).toBe(false);
    expect(isRenderPollingStatus("cancelled")).toBe(false);
    expect(isRenderPollingStatus("unavailable")).toBe(false);
    expect(isRenderPollingStatus(null)).toBe(false);
  });

  it("detects active render lists for project render metadata polling", () => {
    expect(hasActiveRenderStatus([{ streamStatus: "processing" }])).toBe(true);
    expect(hasActiveRenderStatus([{ streamStatus: "ready" }, { streamStatus: null }])).toBe(false);
  });
});

describe("project cache helpers", () => {
  it("invalidates project list/detail/renders cache entries after project work", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.projects.list(), { projects: [] });
    queryClient.setQueryData(queryKeys.projects.detail("project-1"), { project: { id: "project-1" } });
    queryClient.setQueryData(queryKeys.projects.renders("project-1"), { renders: [] });

    invalidateProjectCaches(queryClient, "project-1");

    expect(queryClient.getQueryState(queryKeys.projects.list())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.projects.detail("project-1"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.projects.renders("project-1"))?.isInvalidated).toBe(true);
  });

  it("clears protected cache data on sign-out", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.me(), { user: { id: "user-1" } });

    clearProtectedCaches(queryClient);

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
