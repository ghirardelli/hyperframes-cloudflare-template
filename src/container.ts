import { Container } from "@cloudflare/containers";

export class RenderContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
  manualStart = false;
}

export class WorkflowContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "60s";
  manualStart = false;
}
