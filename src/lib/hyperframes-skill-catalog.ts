import { hyperframesSkillsCatalog } from "../generated/hyperframes-skills";
import {
  REQUIRED_HYPERFRAMES_SKILL_IDS,
  hyperframesSkillCatalogSchema,
  type HyperframesLoadSkillInput,
  type HyperframesLoadSkillOutput,
  type HyperframesSkill,
  type HyperframesSkillCatalog,
  type HyperframesSkillSummary,
  type HyperframesWorkflowRouteOutput,
  type HyperframesWorkflowRouteRequest,
} from "./hyperframes-skill-catalog-schema";

export {
  HYPERFRAMES_WORKFLOW_RUNNER_BOUNDARY,
  REQUIRED_HYPERFRAMES_SKILL_IDS,
  hyperframesCatalogListOutputSchema,
  hyperframesCatalogSourceSchema,
  hyperframesLoadedSkillOutputSchema,
  hyperframesLoadSkillInputSchema,
  hyperframesLoadSkillOutputSchema,
  hyperframesSkillCatalogSchema,
  hyperframesSkillGroupSchema,
  hyperframesSkillMetadataSchema,
  hyperframesSkillNotFoundOutputSchema,
  hyperframesSkillReferenceSchema,
  hyperframesSkillSchema,
  hyperframesSkillSummarySchema,
  hyperframesWorkflowRouteOutputSchema,
  hyperframesWorkflowRouteRequestSchema,
  type HyperframesLoadSkillInput,
  type HyperframesLoadSkillOutput,
  type HyperframesSkill,
  type HyperframesSkillCatalog,
  type HyperframesSkillSummary,
  type HyperframesWorkflowRouteOutput,
  type HyperframesWorkflowRouteRequest,
} from "./hyperframes-skill-catalog-schema";

const CREDENTIAL_PATTERNS = [
  /github_pat_[A-Za-z0-9_]+/,
  /gh[pousr]_[A-Za-z0-9_]+/,
  /x-access-token/i,
  /BEGIN (?:OPENSSH|RSA|EC|DSA) PRIVATE KEY/,
  /\.ssh\//,
  /credential\.helper/i,
  /https:\/\/[^/\s]+@github\.com/i,
];

const ROUTER_SKILL_ID = "hyperframes";
const DEFAULT_DOMAIN_SKILL_IDS = [
  "hyperframes-core",
  "hyperframes-animation",
  "hyperframes-creative",
] as const;
const MEDIA_DOMAIN_SKILL_ID = "hyperframes-media";
const RUNNER_REQUIRED_WORKFLOW_IDS = new Set([
  "website-to-video",
  "product-launch-video",
  "faceless-explainer",
  "embedded-captions",
  "music-to-video",
  "talking-head-recut",
  "pr-to-video",
]);

let cachedCatalog: HyperframesSkillCatalog | null = null;

export function getHyperframesSkillCatalog(): HyperframesSkillCatalog {
  if (!cachedCatalog) {
    cachedCatalog = validateHyperframesSkillCatalog(hyperframesSkillsCatalog);
  }
  return cachedCatalog;
}

export function validateHyperframesSkillCatalog(value: unknown): HyperframesSkillCatalog {
  const parsed = hyperframesSkillCatalogSchema.parse(value);
  const missing = findMissingRequiredHyperframesSkills(parsed);
  if (missing.length) {
    throw new Error(`Missing required HyperFrames skill ids: ${missing.join(", ")}`);
  }
  assertNoCatalogCredentialLeaks(parsed);
  return parsed;
}

export function findMissingRequiredHyperframesSkills(
  catalog: Pick<HyperframesSkillCatalog, "skills">,
): Array<string> {
  const ids = new Set(catalog.skills.map((skill) => skill.id));
  return REQUIRED_HYPERFRAMES_SKILL_IDS.filter((id) => !ids.has(id));
}

export function assertNoCatalogCredentialLeaks(value: unknown): void {
  const text = JSON.stringify(value);
  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`HyperFrames skill catalog contains credential-like material: ${pattern}`);
    }
  }
}

export function listHyperframesSkillCatalog() {
  const catalog = getHyperframesSkillCatalog();
  const groups = groupHyperframesSkills(catalog);
  return {
    generatedAt: catalog.generatedAt,
    source: catalog.source,
    totalSkills: catalog.skills.length,
    requiredSkillIds: [...catalog.requiredSkillIds],
    groups: {
      router: groups.router.map(toSummary),
      workflow: groups.workflow.map(toSummary),
      domain: groups.domain.map(toSummary),
    },
  };
}

export function groupHyperframesSkills(catalog = getHyperframesSkillCatalog()) {
  return {
    router: catalog.skills.filter((skill) => skill.group === "router"),
    workflow: catalog.skills.filter((skill) => skill.group === "workflow"),
    domain: catalog.skills.filter((skill) => skill.group === "domain"),
  };
}

export function findHyperframesSkill(skillId: string): HyperframesSkill | null {
  const normalized = normalizeSkillId(skillId);
  return getHyperframesSkillCatalog().skills.find((skill) => skill.id === normalized) ?? null;
}

export function loadHyperframesSkill({
  skillId,
  maxChars = 6_000,
}: HyperframesLoadSkillInput): HyperframesLoadSkillOutput {
  const catalog = getHyperframesSkillCatalog();
  const normalized = normalizeSkillId(skillId);
  const skill = catalog.skills.find((item) => item.id === normalized);

  if (!skill) {
    return {
      found: false,
      skillId: normalized,
      availableSkillIds: catalog.skills.map((item) => item.id),
      sourceRevision: sourceRevision(catalog),
    };
  }

  const boundedMax = Math.max(500, Math.min(12_000, maxChars));
  const markdown = skill.markdown.slice(0, boundedMax);
  return {
    found: true,
    skillId: skill.id,
    title: skill.title,
    group: skill.group,
    description: compactText(skill.description, 400),
    path: skill.path,
    markdown,
    truncated: skill.markdown.length > boundedMax,
    originalChars: skill.markdown.length,
    returnedChars: markdown.length,
    contentHash: skill.contentHash,
    referenceIndex: skill.referenceIndex,
    sourceRevision: sourceRevision(catalog),
  };
}

export function routeHyperframesWorkflow(
  request: HyperframesWorkflowRouteRequest,
): HyperframesWorkflowRouteOutput {
  const catalog = getHyperframesSkillCatalog();
  const text = [
    request.message,
    request.currentPrompt,
    request.activeProjectTitle,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  const signals = collectSignals(text);

  if (!signals.hasVideoIntent) {
    return {
      shouldLoadSkills: false,
      workflowId: null,
      routerSkillId: null,
      domainSkillIds: [],
      loadSkillIds: [],
      fullPipelineAvailable: true,
      requiresWorkflowRunner: false,
      capabilityNotice: "",
      confidence: 0.15,
      matchedSignals: signals.matchedSignals,
      rationale: "No HyperFrames, video, animation, motion graphic, render, composition, URL, or website signal was detected.",
      sourceRevision: sourceRevision(catalog),
    };
  }

  const workflowId = selectWorkflowId(signals);
  const requiresWorkflowRunner = RUNNER_REQUIRED_WORKFLOW_IDS.has(workflowId);
  const domainSkillIds = selectDomainSkillIds(signals);
  const loadSkillIds = [
    ROUTER_SKILL_ID,
    workflowId,
    ...domainSkillIds,
  ].filter((id, index, ids) => Boolean(findHyperframesSkill(id)) && ids.indexOf(id) === index);

  return {
    shouldLoadSkills: true,
    workflowId,
    routerSkillId: ROUTER_SKILL_ID,
    domainSkillIds,
    loadSkillIds,
    fullPipelineAvailable: !requiresWorkflowRunner,
    requiresWorkflowRunner,
    capabilityNotice: requiresWorkflowRunner ? runnerUnavailableNotice(workflowId) : "",
    confidence: confidenceForWorkflow(workflowId, signals.matchedSignals.length),
    matchedSignals: signals.matchedSignals,
    rationale: rationaleForWorkflow(workflowId, requiresWorkflowRunner),
    sourceRevision: sourceRevision(catalog),
  };
}

function collectSignals(text: string) {
  const matchedSignals: Array<string> = [];
  const hasUrl = matchSignal(text, matchedSignals, "url", /https?:\/\/|www\./);
  const hasWebsite = matchSignal(
    text,
    matchedSignals,
    "website",
    /\b(website|site|homepage|landing page|web page|url|browser|screenshot)\b/,
  );
  const hasProduct = matchSignal(
    text,
    matchedSignals,
    "product-launch",
    /\b(product launch|launch|release|new feature|new product|app launch|waitlist|saas|startup|product page)\b/,
  );
  const hasFaceless = matchSignal(
    text,
    matchedSignals,
    "faceless-explainer",
    /\b(faceless|explainer|educational|lesson|tutorial|documentary|narrated)\b/,
  );
  const hasMotionGraphic = matchSignal(
    text,
    matchedSignals,
    "motion-graphics",
    /\b(motion graphic|logo sting|logo reveal|lower third|kinetic type|typography|infographic|data visual|stat|animated graphic)\b/,
  );
  const hasMedia = matchSignal(
    text,
    matchedSignals,
    "media-or-voice",
    /\b(voice|voiceover|narration|audio|music|caption|subtitle|upload|file|webcam|microphone)\b/,
  );
  const hasVideoIntent = matchSignal(
    text,
    matchedSignals,
    "video-intent",
    /\b(video|animation|animate|motion|hyperframe|hyperframes|render|mp4|composition|clip|reel|storyboard|scene|timeline)\b/,
  ) || hasUrl || hasWebsite || hasProduct || hasFaceless || hasMotionGraphic;

  return {
    hasUrl,
    hasWebsite,
    hasProduct,
    hasFaceless,
    hasMotionGraphic,
    hasMedia,
    hasVideoIntent,
    matchedSignals,
  };
}

function matchSignal(
  text: string,
  matchedSignals: Array<string>,
  signal: string,
  pattern: RegExp,
): boolean {
  if (!pattern.test(text)) return false;
  matchedSignals.push(signal);
  return true;
}

function selectWorkflowId(signals: ReturnType<typeof collectSignals>): string {
  if (signals.hasProduct) return "product-launch-video";
  if (signals.hasWebsite || signals.hasUrl) return "website-to-video";
  if (signals.hasFaceless) return "faceless-explainer";
  if (signals.hasMotionGraphic) return "motion-graphics";
  return "general-video";
}

function selectDomainSkillIds(signals: ReturnType<typeof collectSignals>): Array<string> {
  const ids: Array<string> = [...DEFAULT_DOMAIN_SKILL_IDS];
  if (signals.hasMedia && findHyperframesSkill(MEDIA_DOMAIN_SKILL_ID)) {
    ids.push(MEDIA_DOMAIN_SKILL_ID);
  }
  return ids;
}

function runnerUnavailableNotice(workflowId: string): string {
  if (workflowId === "website-to-video") {
    return "Selected /website-to-video. This first pass can load the synced skill and prepare a grounded HyperFrames prompt, but the full pipeline is not available here yet: no website capture, DESIGN.md, SCRIPT.md, STORYBOARD.md, VO/timing, multi-file build, lint/validate, snapshots, or Studio delivery will be created.";
  }

  if (workflowId === "product-launch-video") {
    return "Selected /product-launch-video. This first pass can use the skill catalog to shape a prompt package, but the full workflow runner is not available here yet: no URL capture, artifacts, voice/timing, multi-file build, validation snapshots, or Studio delivery will be created.";
  }

  return "The selected HyperFrames workflow requires the future container-backed runner. This first pass can only prepare a catalog-informed prompt package and must not claim capture, generated artifacts, voice/timing, validation snapshots, or Studio delivery.";
}

function rationaleForWorkflow(workflowId: string, requiresWorkflowRunner: boolean): string {
  const suffix = requiresWorkflowRunner
    ? " It requires the future workflow runner for full pipeline parity."
    : " It can be used with the existing approved single-composition generation path.";
  return `Routed to /${workflowId} based on the detected request signals.${suffix}`;
}

function confidenceForWorkflow(workflowId: string, signalCount: number): number {
  if (workflowId === "general-video") return signalCount > 1 ? 0.7 : 0.55;
  return signalCount > 1 ? 0.86 : 0.72;
}

function toSummary(skill: HyperframesSkill): HyperframesSkillSummary {
  return {
    id: skill.id,
    title: skill.title,
    group: skill.group,
    description: compactText(skill.description, 260),
    path: skill.path,
    contentHash: skill.contentHash,
    referenceCount: skill.referenceIndex.length,
  };
}

function sourceRevision(catalog: HyperframesSkillCatalog): string {
  return `${catalog.source.repoUrl}#${catalog.source.commitSha}`;
}

function normalizeSkillId(skillId: string): string {
  return skillId
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function compactText(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, Math.max(0, max - 3))}...` : normalized;
}
