import { getTrustedMaterializableHyperframeComponent } from "./hyperframe-component-registry-server";
import {
  MATERIALIZED_COMPONENT_MANIFEST_PATH,
  materializeTrustedHyperframeComponentsInputSchema,
  materializedComponentPlacementSchema,
  type MaterializeComponentPlacement,
  type MaterializedComponentManifest,
  type MaterializedComponentPlacement,
} from "./hyperframe-component-materializer-schema";
import type {
  TrustedComponentFile,
  TrustedMaterializableHyperframeComponent,
} from "./hyperframe-component-registry-schema";
import { normalizeProjectPath } from "./project-paths";

export {
  MATERIALIZED_COMPONENT_MANIFEST_PATH,
  materializeComponentPlacementSchema,
  materializeHyperframeComponentsToolInputSchema,
  materializeHyperframeComponentsToolOutputSchema,
  materializeTrustedHyperframeComponentsInputSchema,
  materializedComponentManifestSchema,
  materializedComponentPlacementSchema,
  type MaterializeComponentPlacement,
  type MaterializeHyperframeComponentsToolInput,
  type MaterializeHyperframeComponentsToolOutput,
  type MaterializeTrustedHyperframeComponentsInput,
  type MaterializedComponentManifest,
  type MaterializedComponentPlacement,
} from "./hyperframe-component-materializer-schema";

export interface MaterializedProjectFile {
  path: string;
  content: string;
  contentHash: string | null;
  role: "registry-component" | "registry-manifest";
}

export interface MaterializeTrustedHyperframeComponentsResult {
  indexHtml: string;
  files: Array<MaterializedProjectFile>;
  manifest: MaterializedComponentManifest;
  warnings: Array<string>;
}

export function materializeTrustedHyperframeComponents(
  value: unknown,
): MaterializeTrustedHyperframeComponentsResult {
  const input = materializeTrustedHyperframeComponentsInputSchema.parse(value);
  const materializedAt = input.materializedAt ?? new Date().toISOString();
  let indexHtml = input.indexHtml;
  const warnings: Array<string> = [];
  const filesByPath = new Map<string, MaterializedProjectFile>();
  const manifestComponents: MaterializedComponentManifest["components"] = [];

  for (const placement of input.placements) {
    const component = getTrustedMaterializableHyperframeComponent(placement.componentId);
    if (!component) {
      throw new Error(`HyperFrames component "${placement.componentId}" is not materializable`);
    }

    const trustedFiles = normalizeTrustedFiles(component);
    for (const file of trustedFiles) {
      filesByPath.set(file.path, {
        path: file.path,
        content: file.content,
        contentHash: file.contentHash,
        role: "registry-component",
      });
    }

    const normalizedPlacement = normalizePlacement(component, placement);
    const hostSnippet = buildHostSnippet(component, normalizedPlacement);
    const markedBlock = wrapHostSnippet(component.id, hostSnippet);
    indexHtml = upsertMarkedHostSnippet(indexHtml, component.id, markedBlock);

    manifestComponents.push({
      componentId: component.id,
      name: component.name,
      installCommand: component.installCommand,
      source: component.source,
      canonicalSnippet: component.canonicalSnippet,
      installedPaths: trustedFiles.map((file) => file.path),
      files: trustedFiles.map(({ path, contentHash }) => ({ path, contentHash })),
      placements: [{ ...normalizedPlacement, hostSnippet }],
      materializedAt,
    });
  }

  const manifest: MaterializedComponentManifest = {
    version: 1,
    updatedAt: materializedAt,
    actor: input.actor,
    snapshotId: input.snapshotId ?? null,
    components: manifestComponents,
  };

  filesByPath.set(MATERIALIZED_COMPONENT_MANIFEST_PATH, {
    path: MATERIALIZED_COMPONENT_MANIFEST_PATH,
    content: `${JSON.stringify(manifest, null, 2)}\n`,
    contentHash: null,
    role: "registry-manifest",
  });

  return {
    indexHtml,
    files: [...filesByPath.values()],
    manifest,
    warnings,
  };
}

function normalizeTrustedFiles(
  component: TrustedMaterializableHyperframeComponent,
): Array<TrustedComponentFile> {
  return component.files.map((file) => {
    const normalizedPath = normalizeProjectPath(file.path);
    if (normalizedPath !== file.path) {
      throw new Error(`trusted component path is not normalized: ${file.path}`);
    }
    if (!/^compositions\//.test(normalizedPath) && !/^assets\//.test(normalizedPath)) {
      throw new Error(`trusted component path must be under compositions/ or assets/: ${file.path}`);
    }
    return { ...file, path: normalizedPath };
  });
}

function normalizePlacement(
  component: TrustedMaterializableHyperframeComponent,
  placement: MaterializeComponentPlacement,
): MaterializedComponentPlacement {
  const normalized = {
    componentId: component.id,
    startSec: placement.startSec,
    durationSec: placement.durationSec ?? component.durationSec,
    trackIndex: placement.trackIndex ?? 1,
    width: placement.width ?? component.width,
    height: placement.height ?? component.height,
    placementNote: placement.placementNote,
    hostSnippet: "",
  };
  return materializedComponentPlacementSchema.parse(normalized);
}

function buildHostSnippet(
  component: TrustedMaterializableHyperframeComponent,
  placement: MaterializedComponentPlacement,
): string {
  const compositionFile = component.files.find((file) => file.path.startsWith("compositions/"));
  if (!compositionFile) {
    throw new Error(`materializable component "${component.id}" has no composition file`);
  }

  return [
    `<div data-composition-id="${escapeAttribute(component.id)}"`,
    `data-composition-src="${escapeAttribute(compositionFile.path)}"`,
    `data-start="${formatNumber(placement.startSec)}"`,
    `data-duration="${formatNumber(placement.durationSec)}"`,
    `data-track-index="${formatNumber(placement.trackIndex)}"`,
    `data-width="${formatNumber(placement.width)}"`,
    `data-height="${formatNumber(placement.height)}"></div>`,
  ].join(" ");
}

function wrapHostSnippet(componentId: string, hostSnippet: string): string {
  return [
    `<!-- hyperframes-materialized-component:${componentId}:begin -->`,
    hostSnippet,
    `<!-- hyperframes-materialized-component:${componentId}:end -->`,
  ].join("\n");
}

function upsertMarkedHostSnippet(html: string, componentId: string, block: string): string {
  const pattern = new RegExp(
    `\\s*<!--\\s*hyperframes-materialized-component:${escapeRegExp(componentId)}:begin\\s*-->[\\s\\S]*?<!--\\s*hyperframes-materialized-component:${escapeRegExp(componentId)}:end\\s*-->`,
    "g",
  );
  if (pattern.test(html)) return html.replace(pattern, `\n${block}`);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}\n</body>`);
  return `${html.trimEnd()}\n${block}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
