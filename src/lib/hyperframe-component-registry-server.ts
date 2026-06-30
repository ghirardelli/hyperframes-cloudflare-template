import { trustedHyperframeComponentRegistryServer } from "../generated/hyperframe-component-registry-server";
import {
  assertNoTrustedComponentCredentialLeaks,
  type TrustedMaterializableHyperframeComponent,
} from "./hyperframe-component-registry";
import {
  trustedHyperframeComponentRegistrySchema,
  type TrustedHyperframeComponentRegistry,
} from "./hyperframe-component-registry-schema";

let cachedRegistry: TrustedHyperframeComponentRegistry | null = null;

export function getTrustedHyperframeComponentRegistry(): TrustedHyperframeComponentRegistry {
  if (!cachedRegistry) {
    cachedRegistry = trustedHyperframeComponentRegistrySchema.parse(
      trustedHyperframeComponentRegistryServer,
    );
    assertNoTrustedComponentCredentialLeaks(cachedRegistry);
  }
  return cachedRegistry;
}

export function getTrustedMaterializableHyperframeComponent(
  componentId: string,
): TrustedMaterializableHyperframeComponent | null {
  return (
    getTrustedHyperframeComponentRegistry().components.find(
      (component) => component.id === componentId,
    ) ?? null
  );
}

export function validateTrustedHyperframeComponentRegistry(): {
  ok: true;
  componentCount: number;
} {
  const registry = getTrustedHyperframeComponentRegistry();
  return { ok: true, componentCount: registry.components.length };
}
