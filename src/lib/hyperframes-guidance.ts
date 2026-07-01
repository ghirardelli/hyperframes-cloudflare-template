import { HF_SKILL_DEFAULTS } from "./hyperframes-skill";
import type { HyperframesGuidelines } from "./prompt-agent-contract";

export function getHyperframesGuidelines(): HyperframesGuidelines {
  return {
    canvas: {
      width: HF_SKILL_DEFAULTS.width,
      height: HF_SKILL_DEFAULTS.height,
      defaultDurationSec: HF_SKILL_DEFAULTS.defaultDuration,
    },
    requiredStructure: [
      'Root element uses class "composition" with data-composition-id="main".',
      `Canvas attributes are data-width="${HF_SKILL_DEFAULTS.width}" and data-height="${HF_SKILL_DEFAULTS.height}".`,
      "Root includes data-start=\"0\" and data-duration matching the requested seconds.",
      "GSAP 3.14.2 loads before the HyperFrames runtime script.",
      'The timeline is registered with window.__timelines["main"] = tl.',
    ],
    timelineRules: [
      "Use a paused GSAP timeline as the single source of animation truth.",
      "Prefer tl.fromTo() for entrances so seeking is deterministic.",
      "Attach every tween to tl; standalone gsap.to() calls do not scrub reliably.",
      "Avoid stacking multiple transform tweens on the same element.",
      "End with several individually-timed exits instead of a blanket fade.",
    ],
    visualRules: [
      "Design for a layered 1920x1080 scene, not a flat card.",
      "Use a CSS gradient background and explicit z-index layering.",
      "Create 8-14 semantic visual elements.",
      "Pace the animation in build, breathe, and resolve phases.",
      "Use typography, palette, and motion vocabulary that match the user's brief.",
    ],
    allowedResources: [
      "GSAP CDN",
      "HyperFrames runtime CDN",
      "Google Fonts via a stylesheet link",
      "Project-scoped assets/ files uploaded through the chat attachment flow",
    ],
    forbiddenPatterns: [
      "External images, video, audio, or arbitrary CDN assets.",
      "Math.random(), Date.now(), setTimeout(), or setInterval().",
      "Infinite repeats such as repeat: -1.",
      "Audio elements in generated prompt-to-video compositions.",
      "Returning prose or markdown fences from the generation prompt.",
    ],
  };
}

export function summarizeHtmlForAgent(html: string | null | undefined): string {
  if (!html) return "No composition HTML is currently saved.";
  const tagMatches = html.match(/<([a-z][a-z0-9-]*)\b/gi) ?? [];
  const tags = [...new Set(tagMatches.map((tag) => tag.slice(1).toLowerCase()))].slice(0, 12);
  const duration = html.match(/data-duration=["']([^"']+)["']/i)?.[1];
  const compositionId = html.match(/data-composition-id=["']([^"']+)["']/i)?.[1];
  const classCount = new Set(
    [...html.matchAll(/class=["']([^"']+)["']/gi)].flatMap((match) =>
      match[1].split(/\s+/).filter(Boolean),
    ),
  ).size;

  return [
    `HTML length: ${html.length} characters.`,
    compositionId ? `Composition id: ${compositionId}.` : "Composition id not detected.",
    duration ? `Duration: ${duration} seconds.` : "Duration not detected.",
    tags.length ? `Tags: ${tags.join(", ")}.` : "No HTML tags detected.",
    `Unique class names detected: ${classCount}.`,
  ].join(" ");
}
