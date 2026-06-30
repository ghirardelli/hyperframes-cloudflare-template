import {
  BunnyApiError,
  BunnyConfigError,
  BunnyStorageClient,
  getBunnyStorageConfig,
  sha256Hex,
  type BunnyEnv,
} from "./bunny";
import { basename } from "./project-paths";

export type StorageProvider = "postgres" | "r2" | "bunny-storage" | "bunny-stream";

export interface StorageEnv extends BunnyEnv {
  RENDERS: R2Bucket;
}

export interface StoredObjectPointer {
  provider: StorageProvider;
  key: string | null;
  sha256?: string | null;
}

export function projectWorkspaceKey(input: {
  organizationId: string;
  ownerId: string;
  projectId: string;
  path: string;
}): string {
  return `orgs/${input.organizationId}/users/${input.ownerId}/projects/${input.projectId}/workspace/${input.path}`;
}

export function projectVersionKey(input: {
  organizationId: string;
  ownerId: string;
  projectId: string;
  versionId: string;
  path: string;
}): string {
  return `orgs/${input.organizationId}/users/${input.ownerId}/projects/${input.projectId}/versions/${input.versionId}/${basename(input.path)}`;
}

export function projectRenderArchiveKey(input: {
  organizationId: string;
  ownerId: string;
  projectId: string;
  renderId: string;
  filename: string;
}): string {
  return `orgs/${input.organizationId}/users/${input.ownerId}/projects/${input.projectId}/renders/${input.renderId}/${input.filename}`;
}

export async function writeProjectObject(
  env: StorageEnv,
  input: {
    key: string;
    bytes: Uint8Array;
    contentType: string;
  },
): Promise<StoredObjectPointer> {
  const checksum = await sha256Hex(input.bytes);
  const bunny = getBunnyStorageConfig(env);
  if (bunny) {
    try {
      await new BunnyStorageClient(bunny).uploadFile({
        path: input.key,
        body: toArrayBuffer(input.bytes),
        contentType: input.contentType,
        sha256: checksum,
      });
    } catch (err) {
      console.error("Bunny Storage upload failed", {
        key: input.key,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
    return { provider: "bunny-storage", key: input.key, sha256: checksum };
  }

  const legacyKey = input.key.startsWith("assets/") ? input.key : `assets/${input.key}`;
  await env.RENDERS.put(legacyKey, toArrayBuffer(input.bytes), { httpMetadata: { contentType: input.contentType } });
  return { provider: "r2", key: legacyKey, sha256: checksum };
}

export async function readProjectObject(
  env: StorageEnv,
  pointer: StoredObjectPointer,
): Promise<Response | null> {
  if (!pointer.key) return null;
  if (pointer.provider === "bunny-storage") {
    const config = getBunnyStorageConfig(env);
    if (!config) return null;
    return new BunnyStorageClient(config).getFile(pointer.key);
  }
  if (pointer.provider === "r2") {
    const object = await env.RENDERS.get(pointer.key);
    if (!object) return null;
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    return new Response(object.body, { headers });
  }
  return null;
}

export async function deleteProjectObject(
  env: StorageEnv,
  pointer: StoredObjectPointer,
): Promise<void> {
  if (!pointer.key) return;
  if (pointer.provider === "bunny-storage") {
    const config = getBunnyStorageConfig(env);
    if (!config) {
      throw new BunnyConfigError(
        "Bunny Storage is required to delete this project's stored files.",
      );
    }
    try {
      await new BunnyStorageClient(config).deleteFile(pointer.key);
    } catch (err) {
      if (err instanceof BunnyApiError && err.status === 404) return;
      throw err;
    }
    return;
  }
  if (pointer.provider === "r2") {
    await env.RENDERS.delete(pointer.key);
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
