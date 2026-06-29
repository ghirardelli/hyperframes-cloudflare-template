import { useCallback, useEffect, useRef, useState } from "react";
import {
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
}

export interface StudioRenderOptions {
  html: string;
  width?: number;
  height?: number;
  durationSec?: number;
  format?: string;
}

export interface StudioEditorProps {
  /** When set, the Player previews `/api/projects/<id>/preview`. */
  projectId?: string;
  /** Static preview URL (used by the dev harness in place of projectId). */
  directUrl?: string;
  title: string;
  initialHtml: string;
  renders?: StudioRenderItem[];
  onSave?: (html: string) => Promise<void> | void;
  onRender?: (opts: StudioRenderOptions) => Promise<StudioRenderItem | void> | void;
  onPublish?: (html: string) => Promise<void> | void;
}

type Tone = "idle" | "busy" | "ok" | "error";

const RESOLUTIONS: Array<{ label: string; width: number; height: number }> = [
  { label: "1920×1080", width: 1920, height: 1080 },
  { label: "1080×1920", width: 1080, height: 1920 },
  { label: "1280×720", width: 1280, height: 720 },
  { label: "1080×1080", width: 1080, height: 1080 },
];

const FORMATS = ["mp4", "webm", "mov"] as const;

export default function StudioEditor({
  projectId,
  directUrl,
  title,
  initialHtml,
  renders: initialRenders = [],
  onSave,
  onRender,
  onPublish,
}: StudioEditorProps) {
  const [html, setHtml] = useState(initialHtml);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ tone: Tone; message: string }>({
    tone: "idle",
    message: "",
  });
  const [renders, setRenders] = useState<StudioRenderItem[]>(initialRenders);
  const [resolution, setResolution] = useState(RESOLUTIONS[0]);
  const [durationSec, setDurationSec] = useState(6);
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("mp4");
  const [busy, setBusy] = useState(false);

  const [rightTab, setRightTab] = useState<"properties" | "renders">("renders");

  const { iframeRef, togglePlay, seek, onIframeLoad, refreshPlayer } = useTimelinePlayer();
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);

  // On-canvas element selection + source patching, scoped to our single file.
  const picker = useElementPicker(iframeRef, {
    workspaceFiles: { "index.html": html },
    onSyncFiles: (files) => {
      const next = files["index.html"];
      if (typeof next === "string") {
        setHtml(next);
        setDirty(true);
      }
    },
  });
  const picked = picker.pickedElement;

  // Surface the property panel as soon as something is selected.
  useEffect(() => {
    if (picked) setRightTab("properties");
  }, [picked]);

  // Soft-reload the preview after the source is saved so the iframe reflects edits.
  const reload = useCallback(() => refreshPlayer(), [refreshPlayer]);

  useEffect(() => {
    setHtml(initialHtml);
    setDirty(false);
  }, [initialHtml]);

  const handleSourceChange = useCallback((next: string) => {
    setHtml(next);
    setDirty(true);
  }, []);

  async function save(): Promise<boolean> {
    if (!onSave) return true;
    try {
      setBusy(true);
      setStatus({ tone: "busy", message: "Saving…" });
      await onSave(html);
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

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      {/* Top bar */}
      <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <a href="/" className="text-sm text-neutral-400 hover:text-neutral-100" title="Workspace">
            ← Workspace
          </a>
          <span className="truncate text-sm font-medium">{title}</span>
          {dirty ? (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-300">
              Unsaved
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={resolution.label}
            onChange={(e) =>
              setResolution(RESOLUTIONS.find((r) => r.label === e.target.value) ?? RESOLUTIONS[0])
            }
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
            max={120}
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
                className={
                  "px-2 py-1 uppercase " +
                  (format === f ? "bg-[#0066cc] text-white" : "bg-neutral-900 text-neutral-400 hover:text-neutral-100")
                }
              >
                {f}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => (picker.isPickMode ? picker.disablePick() : picker.enablePick())}
            className={
              "rounded-md border px-3 py-1 text-xs font-medium " +
              (picker.isPickMode
                ? "border-[#0066cc] bg-[#0066cc]/20 text-[#7cc0ff]"
                : "border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-600")
            }
            title="Select an element on the canvas"
          >
            {picker.isPickMode ? "Selecting…" : "Select"}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !onSave}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs font-medium hover:border-neutral-600 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void render()}
            disabled={busy || !onRender}
            className="rounded-md bg-[#0066cc] px-3 py-1 text-xs font-medium text-white hover:bg-[#0a73db] disabled:opacity-50"
          >
            Render
          </button>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={busy || !onPublish}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs font-medium hover:border-neutral-600 disabled:opacity-50"
          >
            Publish
          </button>
        </div>
      </header>

      {/* Body: 3 regions */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(280px,28%)_minmax(0,1fr)_minmax(240px,22%)]">
        {/* Left: source editor */}
        <section className="flex min-h-0 flex-col border-r border-neutral-800">
          <div className="flex flex-shrink-0 items-center gap-2 border-b border-neutral-800 px-3 py-1.5 text-[11px] uppercase tracking-wide text-neutral-500">
            <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-300">index.html</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <SourceEditor content={html} filePath="index.html" language="html" onChange={handleSourceChange} />
          </div>
        </section>

        {/* Center: preview + controls + timeline */}
        <section className="flex min-h-0 flex-col">
          <div className="relative min-h-0 flex-1 overflow-hidden bg-neutral-950">
            <div className="absolute inset-0">
              <Player
                ref={iframeRef}
                projectId={directUrl ? undefined : projectId}
                directUrl={directUrl}
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

        {/* Right: tabbed properties + renders panel */}
        <aside className="flex min-h-0 flex-col border-l border-neutral-800">
          <div className="flex flex-shrink-0 border-b border-neutral-800 text-[11px] uppercase tracking-wide">
            {(["properties", "renders"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRightTab(tab)}
                className={
                  "px-3 py-1.5 " +
                  (rightTab === tab
                    ? "border-b-2 border-[#0066cc] text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-300")
                }
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {rightTab === "properties" ? (
              picked ? (
                <PropertyControls
                  picked={picked}
                  setStyle={picker.setStyle}
                  setTextContent={picker.setTextContent}
                  onClear={() => picker.clearPick()}
                />
              ) : (
                <p className="text-xs text-neutral-600">
                  Click <span className="text-neutral-300">Select</span>, then pick an element on the
                  canvas to edit its properties.
                </p>
              )
            ) : renders.length === 0 ? (
              <p className="text-xs text-neutral-600">No renders yet</p>
            ) : (
              <div className="space-y-2">
                {renders.map((r) => (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs hover:border-neutral-700"
                  >
                    <span className="font-medium uppercase text-neutral-300">{r.format || "mp4"}</span>
                    {r.createdAt ? (
                      <span className="ml-2 text-neutral-500">
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    ) : null}
                  </a>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Status bar */}
      <footer className="flex-shrink-0 border-t border-neutral-800 px-4 py-1.5 text-xs">
        <span className={statusClass(status.tone)}>{status.message || "Ready"}</span>
      </footer>
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
        <span className="font-medium text-neutral-200">
          {picked.label || picked.tagName}
        </span>
        <button type="button" onClick={onClear} className="text-neutral-500 hover:text-neutral-200">
          Clear
        </button>
      </div>

      {picked.textContent != null ? (
        <label className="block space-y-1">
          <span className="text-neutral-500">Text</span>
          <textarea
            defaultValue={picked.textContent}
            onChange={(e) => setTextContent(e.target.value)}
            className="min-h-16 w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
          />
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="text-neutral-500">Color</span>
        <input
          type="text"
          defaultValue={cssValue(cs, "color")}
          onChange={(e) => setStyle("color", e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-neutral-500">Background</span>
        <input
          type="text"
          defaultValue={cssValue(cs, "background-color")}
          onChange={(e) => setStyle("background-color", e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-neutral-500">Font size (px)</span>
        <input
          type="number"
          defaultValue={Number.isFinite(fontSizePx) ? fontSizePx : undefined}
          onChange={(e) => setStyle("font-size", `${e.target.value}px`)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-neutral-500">Opacity</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          defaultValue={Number.isFinite(opacity) ? opacity : 1}
          onChange={(e) => setStyle("opacity", e.target.value)}
          className="w-full"
        />
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
