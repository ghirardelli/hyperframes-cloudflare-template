import { useCallback, useEffect, useState } from "react";
import {
  FileTree,
  Player,
  PlayerControls,
  SourceEditor,
  Timeline,
  formatTime,
  useElementPicker,
  useTimelinePlayer,
  usePlayerStore,
} from "@hyperframes/studio";

export interface StudioRenderItem {
  id: string;
  url: string;
  createdAt?: string;
  format?: string;
  streamStatus?: string | null;
}

export interface StudioRenderOptions {
  html: string;
  width?: number;
  height?: number;
  durationSec?: number;
  format?: string;
}

export interface StudioAssetItem {
  path: string;
  url: string;
  contentType?: string;
  size?: number;
}

export interface StudioFileEntry {
  path: string;
  kind: string;
  artifactRole?: string;
  contentType?: string | null;
  size?: number;
  updatedAt?: string | Date;
}

interface StudioShareState {
  visibility: "private" | "organization";
  ownerId: string;
  canManage: boolean;
  members: Array<{ userId: string; role: string }>;
}

interface StudioVersionItem {
  id: string;
  path: string;
  changeKind?: string;
  createdAt?: string;
  createdById?: string;
}

interface StudioSearchResponse {
  projects: Array<{ id: string; title: string }>;
  entries: StudioFileEntry[];
}

export interface StudioEditorProps {
  /** When set, the Player previews `/api/projects/<id>/preview`. */
  projectId?: string;
  /** Static preview URL (used by the dev harness in place of projectId). */
  directUrl?: string;
  title: string;
  initialHtml: string;
  renders?: StudioRenderItem[];
  /** Enables the multi-file left region (file tree, compositions, assets). Requires projectId. */
  multiFile?: boolean;
  onSave?: (html: string) => Promise<void> | void;
  onRender?: (opts: StudioRenderOptions) => Promise<StudioRenderItem | void> | void;
  onPublish?: (html: string) => Promise<void> | void;
}

type Tone = "idle" | "busy" | "ok" | "error";
type LeftTab = "code" | "compositions" | "assets";
type RightTab = "properties" | "renders" | "share" | "versions" | "search";

const RESOLUTIONS: Array<{ label: string; width: number; height: number }> = [
  { label: "1920×1080", width: 1920, height: 1080 },
  { label: "1080×1920", width: 1080, height: 1920 },
  { label: "1280×720", width: 1280, height: 720 },
  { label: "1080×1080", width: 1080, height: 1080 },
];

const FORMATS = ["mp4", "webm", "mov"] as const;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401 && typeof window !== "undefined") window.location.assign("/login");
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function StudioEditor({
  projectId,
  directUrl,
  title,
  initialHtml,
  renders: initialRenders = [],
  multiFile = false,
  onSave,
  onRender,
  onPublish,
}: StudioEditorProps) {
  const fileMode = multiFile && !!projectId;
  const apiBase = projectId ? `/api/projects/${encodeURIComponent(projectId)}` : "";

  const [html, setHtml] = useState(initialHtml);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ tone: Tone; message: string }>({ tone: "idle", message: "" });
  const [renders, setRenders] = useState<StudioRenderItem[]>(initialRenders);
  const [resolution, setResolution] = useState(RESOLUTIONS[0]);
  const [durationSec, setDurationSec] = useState(6);
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("mp4");
  const [busy, setBusy] = useState(false);

  // Multi-file state
  const [files, setFiles] = useState<string[]>([]);
  const [entries, setEntries] = useState<StudioFileEntry[]>([]);
  const [activeFile, setActiveFile] = useState("index.html");
  const [leftTab, setLeftTab] = useState<LeftTab>("code");
  const [assets, setAssets] = useState<StudioAssetItem[]>([]);
  const [activeCompositionPath, setActiveCompositionPath] = useState<string | null>(null);
  const [share, setShare] = useState<StudioShareState | null>(null);
  const [versions, setVersions] = useState<StudioVersionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudioSearchResponse>({ projects: [], entries: [] });

  const [rightTab, setRightTab] = useState<RightTab>("renders");

  const { iframeRef, togglePlay, seek, onIframeLoad, refreshPlayer } = useTimelinePlayer();
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);

  const picker = useElementPicker(iframeRef, {
    workspaceFiles: { [activeFile]: html },
    onSyncFiles: (f) => {
      const next = f[activeFile];
      if (typeof next === "string") {
        setHtml(next);
        setDirty(true);
      }
    },
  });
  const picked = picker.pickedElement;

  const reload = useCallback(() => refreshPlayer(), [refreshPlayer]);

  useEffect(() => {
    if (picked) setRightTab("properties");
  }, [picked]);

  useEffect(() => {
    setHtml(initialHtml);
    setDirty(false);
  }, [initialHtml]);

  // Load file list + assets in multi-file mode.
  useEffect(() => {
    if (!fileMode) return;
    api<{ files: string[]; entries?: StudioFileEntry[] }>(`${apiBase}/files`)
      .then((d) => {
        setFiles(d.files.length ? d.files : ["index.html"]);
        setEntries(d.entries ?? d.files.map((path) => ({ path, kind: "text" })));
      })
      .catch((err) => setStatus({ tone: "error", message: messageFromError(err) }));
    api<{ assets: StudioAssetItem[] }>(`${apiBase}/assets`)
      .then((d) => setAssets(d.assets))
      .catch(() => {});
    void loadShare();
    void loadVersions("index.html");
  }, [fileMode, apiBase]);

  async function loadFile(path: string) {
    if (!fileMode) return;
    try {
      const d = await api<{ path: string; content: string }>(
        `${apiBase}/files/${encodeURIComponent(path)}`,
      );
      setActiveFile(path);
      setHtml(d.content);
      setDirty(false);
      setActiveCompositionPath(path === "index.html" ? null : path);
      await loadVersions(path);
    } catch (err) {
      setStatus({ tone: "error", message: messageFromError(err) });
    }
  }

  async function loadShare() {
    if (!fileMode) return;
    const data = await api<{ share: StudioShareState }>(`${apiBase}/share`);
    setShare(data.share);
  }

  async function loadVersions(path = activeFile) {
    if (!fileMode) return;
    const data = await api<{ versions: StudioVersionItem[] }>(
      `${apiBase}/versions?path=${encodeURIComponent(path)}`,
    );
    setVersions(data.versions);
  }

  const handleSourceChange = useCallback((next: string) => {
    setHtml(next);
    setDirty(true);
  }, []);

  async function save(): Promise<boolean> {
    try {
      setBusy(true);
      setStatus({ tone: "busy", message: "Saving…" });
      if (fileMode) {
        await api(`${apiBase}/files/${encodeURIComponent(activeFile)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: html }),
        });
        // Keep currentHtml mirrored when editing the entry file (used by render).
        if (activeFile === "index.html" && onSave) await onSave(html);
        await loadVersions(activeFile);
      } else if (onSave) {
        await onSave(html);
      }
      setDirty(false);
      setStatus({ tone: "ok", message: "Saved." });
      reload();
      return true;
    } catch (err) {
      setStatus({ tone: "error", message: messageFromError(err) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function render() {
    if (!onRender) return;
    if (dirty && !(await save())) return;
    try {
      setBusy(true);
      setStatus({ tone: "busy", message: "Rendering…" });
      const result = await onRender({
        html,
        width: resolution.width,
        height: resolution.height,
        durationSec,
        format,
      });
      if (result && result.url) setRenders((prev) => [result, ...prev]);
      setStatus({ tone: "ok", message: "Render complete." });
    } catch (err) {
      setStatus({ tone: "error", message: messageFromError(err) });
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!onPublish) return;
    if (dirty && !(await save())) return;
    try {
      setBusy(true);
      setStatus({ tone: "busy", message: "Publishing…" });
      await onPublish(html);
      setStatus({ tone: "ok", message: "Published to your organization." });
    } catch (err) {
      setStatus({ tone: "error", message: messageFromError(err) });
    } finally {
      setBusy(false);
    }
  }

  async function createFile(path: string) {
    if (!fileMode || !path) return;
    try {
      await api(`${apiBase}/files`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path, content: "" }),
      });
      setFiles((prev) => Array.from(new Set([...prev, path])).sort());
      setEntries((prev) => Array.from(new Map([...prev, { path, kind: "text" }].map((e) => [e.path, e])).values()).sort((a, b) => a.path.localeCompare(b.path)));
      await loadFile(path);
    } catch (err) {
      setStatus({ tone: "error", message: messageFromError(err) });
    }
  }

  async function deleteFile(path: string) {
    if (!fileMode || path === "index.html") return;
    try {
      await api(`${apiBase}/files/${encodeURIComponent(path)}`, { method: "DELETE" });
      setFiles((prev) => prev.filter((p) => p !== path));
      setEntries((prev) => prev.filter((entry) => entry.path !== path));
      if (activeFile === path) await loadFile("index.html");
    } catch (err) {
      setStatus({ tone: "error", message: messageFromError(err) });
    }
  }

  async function uploadAsset(file: File) {
    if (!fileMode) return;
    const path = `assets/${file.name}`;
    try {
      setStatus({ tone: "busy", message: `Uploading ${file.name}…` });
      const item = await api<StudioAssetItem>(
        `${apiBase}/assets?path=${encodeURIComponent(path)}`,
        { method: "POST", headers: { "content-type": file.type || "application/octet-stream" }, body: file },
      );
      setAssets((prev) => [item, ...prev.filter((a) => a.path !== item.path)]);
      setEntries((prev) =>
        Array.from(new Map([...prev, { path: item.path, kind: "binary", artifactRole: "asset", contentType: item.contentType, size: item.size }].map((e) => [e.path, e])).values()).sort((a, b) => a.path.localeCompare(b.path)),
      );
      setStatus({ tone: "ok", message: `Uploaded ${file.name}` });
    } catch (err) {
      setStatus({ tone: "error", message: messageFromError(err) });
    }
  }

  async function updateShareVisibility(visibility: "private" | "organization") {
    if (!fileMode || !share?.canManage) return;
    try {
      const data = await api<{ project: { visibility: "private" | "organization" } }>(`${apiBase}/share`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
      setShare((prev) => (prev ? { ...prev, visibility: data.project.visibility } : prev));
      setStatus({ tone: "ok", message: visibility === "organization" ? "Shared with organization." : "Project is private." });
    } catch (err) {
      setStatus({ tone: "error", message: messageFromError(err) });
    }
  }

  async function restoreVersion(versionId: string) {
    if (!fileMode) return;
    try {
      await api(`${apiBase}/versions/${encodeURIComponent(versionId)}/restore`, { method: "POST" });
      await loadFile(activeFile);
      setStatus({ tone: "ok", message: "Version restored." });
    } catch (err) {
      setStatus({ tone: "error", message: messageFromError(err) });
    }
  }

  async function searchProject() {
    if (!fileMode || searchQuery.trim().length < 2) return;
    try {
      const data = await api<StudioSearchResponse>(`/api/projects/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(data);
    } catch (err) {
      setStatus({ tone: "error", message: messageFromError(err) });
    }
  }

  const compositions = files.filter((f) => /\.html?$/i.test(f));
  const playerDirectUrl = fileMode
    ? activeCompositionPath
      ? `${apiBase}/preview/${activeCompositionPath}`
      : undefined
    : directUrl;

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/" className="text-sm text-neutral-400 hover:text-neutral-100" title="Workspace">
            ← Workspace
          </a>
          <span className="truncate text-sm font-medium">{title}</span>
          {dirty ? (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-300">Unsaved</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={resolution.label}
            onChange={(e) => setResolution(RESOLUTIONS.find((r) => r.label === e.target.value) ?? RESOLUTIONS[0])}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
            title="Resolution"
          >
            {RESOLUTIONS.map((r) => (
              <option key={r.label} value={r.label}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={300}
            value={durationSec}
            onChange={(e) => setDurationSec(Number(e.target.value) || 1)}
            className="w-16 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
            title="Duration (seconds)"
          />
          <div className="flex overflow-hidden rounded-md border border-neutral-700 text-xs">
            {FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={"px-2 py-1 uppercase " + (format === f ? "bg-[#0066cc] text-white" : "bg-neutral-900 text-neutral-400 hover:text-neutral-100")}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => (picker.isPickMode ? picker.disablePick() : picker.enablePick())}
            className={"rounded-md border px-3 py-1 text-xs font-medium " + (picker.isPickMode ? "border-[#0066cc] bg-[#0066cc]/20 text-[#7cc0ff]" : "border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-600")}
            title="Select an element on the canvas"
          >
            {picker.isPickMode ? "Selecting…" : "Select"}
          </button>
          <button type="button" onClick={() => void save()} disabled={busy} className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs font-medium hover:border-neutral-600 disabled:opacity-50">
            Save
          </button>
          <button type="button" onClick={() => void render()} disabled={busy || !onRender} className="rounded-md bg-[#0066cc] px-3 py-1 text-xs font-medium text-white hover:bg-[#0a73db] disabled:opacity-50">
            Render
          </button>
          <button type="button" onClick={() => void publish()} disabled={busy || !onPublish} className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs font-medium hover:border-neutral-600 disabled:opacity-50">
            Publish
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(280px,28%)_minmax(0,1fr)_minmax(240px,22%)]">
        {/* Left region */}
        <section className="flex min-h-0 flex-col border-r border-neutral-800">
          {fileMode ? (
            <div className="flex flex-shrink-0 border-b border-neutral-800 text-[11px] uppercase tracking-wide">
              {(["code", "compositions", "assets"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setLeftTab(tab)}
                  className={"px-3 py-1.5 " + (leftTab === tab ? "border-b-2 border-[#0066cc] text-neutral-100" : "text-neutral-500 hover:text-neutral-300")}
                >
                  {tab}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-shrink-0 items-center gap-2 border-b border-neutral-800 px-3 py-1.5 text-[11px] uppercase tracking-wide text-neutral-500">
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-300">index.html</span>
            </div>
          )}

          {fileMode && leftTab === "compositions" ? (
            <div className="min-h-0 flex-1 space-y-1 overflow-auto p-2 text-xs">
              {compositions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => void loadFile(c)}
                  className={"block w-full truncate rounded px-2 py-1 text-left " + (activeFile === c ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:bg-neutral-900")}
                >
                  {c}
                </button>
              ))}
            </div>
          ) : fileMode && leftTab === "assets" ? (
            <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3 text-xs">
              <label className="block cursor-pointer rounded-md border border-dashed border-neutral-700 px-3 py-2 text-center text-neutral-400 hover:border-neutral-500">
                Upload asset
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAsset(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {assets.length === 0 ? (
                <p className="text-neutral-600">No assets yet</p>
              ) : (
                assets.map((a) => (
                  <div key={a.path} className="flex items-center justify-between gap-2 rounded border border-neutral-800 px-2 py-1">
                    <span className="truncate text-neutral-300">{a.path}</span>
                    <button
                      type="button"
                      onClick={() => handleSourceChange(html.replace(/<\/body>/i, `  <img src="${a.path}" />\n</body>`))}
                      className="text-[10px] text-[#7cc0ff] hover:underline"
                      title="Insert reference"
                    >
                      insert
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              {fileMode ? (
                <div className="max-h-48 flex-shrink-0 overflow-auto border-b border-neutral-800">
                  <FileTree
                    files={files}
                    activeFile={activeFile}
                    onSelectFile={(p) => void loadFile(p)}
                    onCreateFile={(p) => void createFile(p)}
                    onDeleteFile={(p) => void deleteFile(p)}
                  />
                </div>
              ) : null}
              <div className="min-h-0 flex-1 overflow-hidden">
                <SourceEditor content={html} filePath={activeFile} language="html" onChange={handleSourceChange} />
              </div>
            </>
          )}
        </section>

        {/* Center */}
        <section className="flex min-h-0 flex-col">
          <div className="relative min-h-0 flex-1 overflow-hidden bg-neutral-950">
            <div className="absolute inset-0">
              <Player
                ref={iframeRef}
                projectId={playerDirectUrl ? undefined : projectId}
                directUrl={playerDirectUrl}
                onLoad={onIframeLoad}
              />
            </div>
          </div>
          <div className="flex-shrink-0 border-t border-neutral-800 bg-neutral-950">
            <div className="flex items-center justify-end gap-2 px-3 pt-1 text-[11px] tabular-nums text-neutral-500">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <PlayerControls onTogglePlay={togglePlay} onSeek={seek} />
          </div>
          <div className="h-[240px] flex-shrink-0 border-t border-neutral-800 bg-neutral-950">
            <Timeline onSeek={seek} />
          </div>
        </section>

        {/* Right */}
        <aside className="flex min-h-0 flex-col border-l border-neutral-800">
          <div className="flex flex-shrink-0 border-b border-neutral-800 text-[11px] uppercase tracking-wide">
            {(["properties", "renders", "share", "versions", "search"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRightTab(tab)}
                className={"px-3 py-1.5 " + (rightTab === tab ? "border-b-2 border-[#0066cc] text-neutral-100" : "text-neutral-500 hover:text-neutral-300")}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {rightTab === "properties" ? (
              picked ? (
                <PropertyControls picked={picked} setStyle={picker.setStyle} setTextContent={picker.setTextContent} onClear={() => picker.clearPick()} />
              ) : (
                <p className="text-xs text-neutral-600">
                  Click <span className="text-neutral-300">Select</span>, then pick an element on the canvas to edit its properties.
                </p>
              )
            ) : rightTab === "renders" ? (
              renders.length === 0 ? (
              <p className="text-xs text-neutral-600">No renders yet</p>
              ) : (
              <div className="space-y-2">
                {renders.map((r) => (
                  <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="block rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs hover:border-neutral-700">
                    <span className="font-medium uppercase text-neutral-300">{r.format || "mp4"}</span>
                    {r.streamStatus ? <span className="ml-2 text-neutral-500">{r.streamStatus}</span> : null}
                    {r.createdAt ? <span className="ml-2 text-neutral-500">{new Date(r.createdAt).toLocaleString()}</span> : null}
                  </a>
                ))}
              </div>
              )
            ) : rightTab === "share" ? (
              <SharePanel share={share} onSetVisibility={(v) => void updateShareVisibility(v)} />
            ) : rightTab === "versions" ? (
              <VersionsPanel versions={versions} onRestore={(id) => void restoreVersion(id)} />
            ) : (
              <SearchPanel
                query={searchQuery}
                setQuery={setSearchQuery}
                results={searchResults}
                onSearch={() => void searchProject()}
                onOpenEntry={(path) => {
                  setLeftTab("code");
                  void loadFile(path);
                }}
              />
            )}
          </div>
        </aside>
      </div>

      <footer className="flex-shrink-0 border-t border-neutral-800 px-4 py-1.5 text-xs">
        <span className={statusClass(status.tone)}>{status.message || "Ready"}</span>
      </footer>
    </div>
  );
}

function SharePanel({
  share,
  onSetVisibility,
}: {
  share: StudioShareState | null;
  onSetVisibility: (visibility: "private" | "organization") => void;
}) {
  if (!share) return <p className="text-xs text-neutral-600">Share state unavailable</p>;
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
        <p className="text-neutral-500">Visibility</p>
        <p className="mt-1 font-medium text-neutral-200">{share.visibility === "organization" ? "Organization" : "Private"}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={!share.canManage || share.visibility === "private"} onClick={() => onSetVisibility("private")} className="rounded-md border border-neutral-700 px-2 py-1 text-neutral-200 disabled:opacity-40">
          Private
        </button>
        <button type="button" disabled={!share.canManage || share.visibility === "organization"} onClick={() => onSetVisibility("organization")} className="rounded-md border border-neutral-700 px-2 py-1 text-neutral-200 disabled:opacity-40">
          Organization
        </button>
      </div>
      <div className="space-y-1">
        <p className="text-neutral-500">Members</p>
        {share.members.length === 0 ? (
          <p className="text-neutral-600">No explicit members</p>
        ) : (
          share.members.map((m) => (
            <div key={m.userId} className="flex justify-between rounded border border-neutral-800 px-2 py-1">
              <span className="truncate text-neutral-300">{m.userId}</span>
              <span className="text-neutral-500">{m.role}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function VersionsPanel({
  versions,
  onRestore,
}: {
  versions: StudioVersionItem[];
  onRestore: (versionId: string) => void;
}) {
  if (versions.length === 0) return <p className="text-xs text-neutral-600">No versions yet</p>;
  return (
    <div className="space-y-2 text-xs">
      {versions.map((v) => (
        <div key={v.id} className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-neutral-300">{v.path}</p>
              <p className="text-neutral-500">{v.changeKind || "save"}{v.createdAt ? ` · ${new Date(v.createdAt).toLocaleString()}` : ""}</p>
            </div>
            <button type="button" onClick={() => onRestore(v.id)} className="rounded border border-neutral-700 px-2 py-1 text-neutral-300 hover:border-neutral-500">
              Restore
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchPanel({
  query,
  setQuery,
  results,
  onSearch,
  onOpenEntry,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: StudioSearchResponse;
  onSearch: () => void;
  onOpenEntry: (path: string) => void;
}) {
  return (
    <div className="space-y-3 text-xs">
      <div className="flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100" />
        <button type="button" onClick={onSearch} className="rounded-md border border-neutral-700 px-2 py-1 text-neutral-200">
          Search
        </button>
      </div>
      <div className="space-y-1">
        {results.entries.map((entry) => (
          <button key={entry.path} type="button" onClick={() => onOpenEntry(entry.path)} className="block w-full rounded border border-neutral-800 px-2 py-1 text-left text-neutral-300 hover:border-neutral-600">
            <span className="block truncate">{entry.path}</span>
            <span className="text-neutral-500">{entry.artifactRole || entry.kind}</span>
          </button>
        ))}
        {results.projects.map((project) => (
          <div key={project.id} className="rounded border border-neutral-800 px-2 py-1 text-neutral-300">
            {project.title}
          </div>
        ))}
      </div>
    </div>
  );
}

interface PickedLike {
  tagName: string;
  label: string;
  textContent: string | null;
  computedStyles: Record<string, string>;
}

function cssValue(styles: Record<string, string>, prop: string): string {
  const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return styles[prop] ?? styles[camel] ?? "";
}

function PropertyControls({
  picked,
  setStyle,
  setTextContent,
  onClear,
}: {
  picked: PickedLike;
  setStyle: (prop: string, value: string) => void;
  setTextContent: (text: string) => void;
  onClear: () => void;
}) {
  const cs = picked.computedStyles ?? {};
  const fontSizePx = parseInt(cssValue(cs, "font-size"), 10);
  const opacity = parseFloat(cssValue(cs, "opacity"));

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium text-neutral-200">{picked.label || picked.tagName}</span>
        <button type="button" onClick={onClear} className="text-neutral-500 hover:text-neutral-200">
          Clear
        </button>
      </div>
      {picked.textContent != null ? (
        <label className="block space-y-1">
          <span className="text-neutral-500">Text</span>
          <textarea defaultValue={picked.textContent} onChange={(e) => setTextContent(e.target.value)} className="min-h-16 w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100" />
        </label>
      ) : null}
      <label className="block space-y-1">
        <span className="text-neutral-500">Color</span>
        <input type="text" defaultValue={cssValue(cs, "color")} onChange={(e) => setStyle("color", e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100" />
      </label>
      <label className="block space-y-1">
        <span className="text-neutral-500">Background</span>
        <input type="text" defaultValue={cssValue(cs, "background-color")} onChange={(e) => setStyle("background-color", e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100" />
      </label>
      <label className="block space-y-1">
        <span className="text-neutral-500">Font size (px)</span>
        <input type="number" defaultValue={Number.isFinite(fontSizePx) ? fontSizePx : undefined} onChange={(e) => setStyle("font-size", `${e.target.value}px`)} className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100" />
      </label>
      <label className="block space-y-1">
        <span className="text-neutral-500">Opacity</span>
        <input type="range" min={0} max={1} step={0.05} defaultValue={Number.isFinite(opacity) ? opacity : 1} onChange={(e) => setStyle("opacity", e.target.value)} className="w-full" />
      </label>
    </div>
  );
}

function statusClass(tone: Tone): string {
  if (tone === "error") return "text-red-400";
  if (tone === "ok") return "text-emerald-400";
  if (tone === "busy") return "text-neutral-300";
  return "text-neutral-500";
}

function messageFromError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
