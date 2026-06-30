import { describe, expect, it } from "vitest";

import {
  adminCreateUserFormSchema,
  creationIntakeFormSchema,
  loginFormSchema,
  passwordFormSchema,
  profileFormSchema,
  projectMetadataFormSchema,
} from "./form-schemas";

describe("form schemas", () => {
  it("validates login credentials before sign-in", () => {
    expect(loginFormSchema.safeParse({ email: "not-email", password: "" }).success).toBe(false);
    expect(loginFormSchema.parse({ email: " USER@example.com ", password: "secret" })).toEqual({
      email: "USER@example.com",
      password: "secret",
    });
  });

  it("validates admin organization mode conditionally", () => {
    expect(
      adminCreateUserFormSchema.safeParse({
        name: "Ada",
        email: "ada@example.com",
        password: "password1",
        role: "user",
        organizationMode: "existing",
        organizationId: "",
        organizationName: "",
      }).success,
    ).toBe(false);

    expect(
      adminCreateUserFormSchema.safeParse({
        name: "Ada",
        email: "ada@example.com",
        password: "password1",
        role: "admin",
        organizationMode: "new",
        organizationId: "",
        organizationName: "Acme",
      }).success,
    ).toBe(true);
  });

  it("validates profile, password, and project metadata forms", () => {
    expect(profileFormSchema.safeParse({ name: "" }).success).toBe(false);
    expect(passwordFormSchema.safeParse({ currentPassword: "old", newPassword: "short" }).success).toBe(false);
    expect(projectMetadataFormSchema.safeParse({ title: "", description: "" }).success).toBe(false);
    expect(projectMetadataFormSchema.parse({ title: " Launch ", description: " Test " })).toEqual({
      title: "Launch",
      description: "Test",
    });
  });

  it("validates creation intake and normalizes duration", () => {
    expect(
      creationIntakeFormSchema.parse({
        prompt: " Make a launch reel ",
        durationSec: 6.4,
        exportResolutionId: "1080p",
        renderFormat: "mp4",
      }),
    ).toEqual({
      prompt: "Make a launch reel",
      durationSec: 6,
      exportResolutionId: "1080p",
      renderFormat: "mp4",
    });
  });
});
