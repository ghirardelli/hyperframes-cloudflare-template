import startHandler from "@tanstack/react-start/server-entry";

import { RenderContainer, WorkflowContainer } from "./container";
import { handleWorkerApi, type WorkerEnv } from "./worker/render-api";

export { RenderContainer, WorkflowContainer };

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const apiResponse = await handleWorkerApi(request, env, ctx);
    if (apiResponse) return apiResponse;
    return startHandler.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;
