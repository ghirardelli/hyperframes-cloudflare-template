import startHandler from "@tanstack/react-start/server-entry";

import { RenderContainer } from "./container";
import { handleWorkerApi, type WorkerEnv } from "./worker/render-api";

export { RenderContainer };

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
  ): Promise<Response> {
    const apiResponse = await handleWorkerApi(request, env);
    if (apiResponse) return apiResponse;
    return startHandler.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;
