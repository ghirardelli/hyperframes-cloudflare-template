import { z } from "zod";

import {
  MAX_DURATION_SEC,
  MIN_DURATION_SEC,
  normalizeDurationSec,
  type ExportResolutionId,
  type RenderFormat,
} from "./main-page-creation-flow";

export const loginFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const organizationModeSchema = z.enum(["existing", "new"]);
export type OrganizationMode = z.infer<typeof organizationModeSchema>;

export const adminCreateUserFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name.").max(160, "Name is too long."),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    role: z.enum(["user", "admin"]),
    organizationMode: organizationModeSchema,
    organizationId: z.string().trim().optional(),
    organizationName: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.organizationMode === "existing" && !value.organizationId) {
      ctx.addIssue({
        code: "custom",
        path: ["organizationId"],
        message: "Select an organization.",
      });
    }
    if (value.organizationMode === "new" && !value.organizationName) {
      ctx.addIssue({
        code: "custom",
        path: ["organizationName"],
        message: "Enter an organization name.",
      });
    }
  });

export type AdminCreateUserFormValues = z.infer<typeof adminCreateUserFormSchema>;

export const profileFormSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(160, "Name is too long."),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

export type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export const projectMetadataFormSchema = z.object({
  title: z.string().trim().min(1, "Enter a project name.").max(120, "Name is too long."),
  description: z.string().trim().max(260, "Description is too long."),
});

export type ProjectMetadataFormValues = z.infer<typeof projectMetadataFormSchema>;

export const creationIntakeFormSchema = z.object({
  prompt: z.string().trim().min(1, "Enter a prompt.").max(8_000, "Prompt is too long."),
  durationSec: z.number().min(MIN_DURATION_SEC).max(MAX_DURATION_SEC).transform((value) =>
    normalizeDurationSec(value),
  ),
  exportResolutionId: z.enum(["1080p", "4k"]),
  renderFormat: z.enum(["mp4", "webm", "mov"]),
});

export type CreationIntakeFormValues = z.input<typeof creationIntakeFormSchema> & {
  exportResolutionId: ExportResolutionId;
  renderFormat: RenderFormat;
};

export type ParsedCreationIntake = z.output<typeof creationIntakeFormSchema>;

export const workflowIntakeFormSchema = z.object({
  prompt: z.string().trim().min(1, "Enter a prompt.").max(8_000, "Prompt is too long."),
  durationSec: z.number().min(MIN_DURATION_SEC).max(MAX_DURATION_SEC).transform((value) =>
    normalizeDurationSec(value),
  ),
});

export type WorkflowIntakeFormValues = z.input<typeof workflowIntakeFormSchema>;
