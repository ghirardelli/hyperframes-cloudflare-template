import { trustedHyperframeComponentRegistryPublic } from "../generated/hyperframe-component-registry-public";
import {
  trustedHyperframeComponentRegistryMetadataSchema,
  type ComponentMaterializationState,
  type MaterializableHyperframeComponentMetadata,
  type TrustedHyperframeComponentRegistryMetadata,
} from "./hyperframe-component-registry-schema";
import type { GalleryComponent } from "./hyperframe-gallery-catalog-schema";

const CREDENTIAL_PATTERNS = [
  /github_pat_[A-Za-z0-9_]+/,
  /gh[pousr]_[A-Za-z0-9_]+/,
  /x-access-token/i,
  /BEGIN (?:OPENSSH|RSA|EC|DSA) PRIVATE KEY/,
  /\.ssh\//,
  /credential\.helper/i,
  /https:\/\/[^/\s]+@github\.com/i,
  /\/Users\/[^"'\s]+/,
];

let cachedRegistry: TrustedHyperframeComponentRegistryMetadata | null = null;

export function getTrustedHyperframeComponentRegistryMetadata(): TrustedHyperframeComponentRegistryMetadata {
  if (!cachedRegistry) {
    cachedRegistry = trustedHyperframeComponentRegistryMetadataSchema.parse(
      trustedHyperframeComponentRegistryPublic,
    );
    assertNoTrustedComponentCredentialLeaks(cachedRegistry);
  }
  return cachedRegistry;
}

export function listMaterializableHyperframeComponents(): Array<MaterializableHyperframeComponentMetadata> {
  return [...getTrustedHyperframeComponentRegistryMetadata().components];
}

export function getMaterializableHyperframeComponentMetadata(
  componentId: string,
): MaterializableHyperframeComponentMetadata | null {
  return (
    getTrustedHyperframeComponentRegistryMetadata().components.find(
      (component) => component.id === componentId,
    ) ?? null
  );
}

export function getComponentMaterializationState(
  component: Pick<GalleryComponent, "id">,
): ComponentMaterializationState {
  const materializable = getMaterializableHyperframeComponentMetadata(component.id);
  if (!materializable) return { state: "prompt-only" };
  return {
    state: "materializable",
    componentId: materializable.id,
    source: materializable.source,
    installCommand: materializable.installCommand,
    canonicalSnippet: materializable.canonicalSnippet,
    durationSec: materializable.durationSec,
    width: materializable.width,
    height: materializable.height,
    files: materializable.files,
  };
}

export function isMaterializableHyperframeComponent(componentId: string): boolean {
  return Boolean(getMaterializableHyperframeComponentMetadata(componentId));
}

export function assertNoTrustedComponentCredentialLeaks(value: unknown): void {
  const text = JSON.stringify(value);
  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`trusted HyperFrames component registry contains credential-like material: ${pattern}`);
    }
  }
}

export {
  componentMaterializationStateSchema,
  materializableComponentSelectionStateSchema,
  materializableHyperframeComponentMetadataSchema,
  promptOnlyComponentMaterializationStateSchema,
  trustedComponentFileMetadataSchema,
  trustedComponentFileSchema,
  trustedComponentSourceMetadataSchema,
  trustedHyperframeComponentRegistryMetadataSchema,
  trustedHyperframeComponentRegistrySchema,
  trustedMaterializableHyperframeComponentSchema,
  type ComponentMaterializationState,
  type MaterializableHyperframeComponentMetadata,
  type TrustedComponentFile,
  type TrustedComponentFileMetadata,
  type TrustedComponentSourceMetadata,
  type TrustedHyperframeComponentRegistry,
  type TrustedHyperframeComponentRegistryMetadata,
  type TrustedMaterializableHyperframeComponent,
} from "./hyperframe-component-registry-schema";
