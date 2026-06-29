import { describe, expect, it } from "vitest";

import {
  AuthRequiredError,
  ForbiddenError,
  assertAdmin,
  assertSameOrganization,
  canProjectRole,
  isAdminRole,
  isBootstrapAdminEmail,
  isOrganizationAdmin,
  isUserLocked,
  type AppAuthContext,
} from "./auth-context";

const baseContext: AppAuthContext = {
  user: {
    id: "user-1",
    name: "Taylor",
    email: "taylor@example.com",
    role: "user",
    banned: false,
  },
  organization: {
    id: "org-1",
    name: "Acme",
  },
};

describe("auth context helpers", () => {
  it("treats users with admin in a comma-separated role list as admins", () => {
    expect(isAdminRole("user,admin")).toBe(true);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("user")).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });

  it("matches first-admin bootstrap emails case-insensitively", () => {
    expect(
      isBootstrapAdminEmail(
        { INITIAL_ADMIN_EMAILS: "owner@example.com, Admin@Example.com " },
        "admin@example.com",
      ),
    ).toBe(true);
    expect(
      isBootstrapAdminEmail(
        { INITIAL_ADMIN_EMAILS: "owner@example.com, Admin@Example.com " },
        "member@example.com",
      ),
    ).toBe(false);
  });

  it("treats banned users with no future expiry as locked", () => {
    expect(isUserLocked({ banned: true, banExpires: null })).toBe(true);
    expect(isUserLocked({ banned: false, banExpires: null })).toBe(false);
    expect(isUserLocked({ banned: true, banExpires: new Date(Date.now() + 60_000) })).toBe(true);
    expect(isUserLocked({ banned: true, banExpires: new Date(Date.now() - 60_000) })).toBe(false);
  });

  it("requires admin role for admin-only actions", () => {
    expect(() => assertAdmin(baseContext)).toThrow(ForbiddenError);

    expect(() =>
      assertAdmin({
        ...baseContext,
        user: { ...baseContext.user, role: "admin" },
      }),
    ).not.toThrow();
  });

  it("detects organization admin access", () => {
    expect(isOrganizationAdmin(baseContext)).toBe(false);
    expect(
      isOrganizationAdmin({
        ...baseContext,
        organization: { ...baseContext.organization, role: "admin" },
      }),
    ).toBe(true);
  });

  it("maps project member roles to permissions", () => {
    expect(canProjectRole("viewer", "read")).toBe(true);
    expect(canProjectRole("viewer", "edit")).toBe(false);
    expect(canProjectRole("editor", "restore")).toBe(true);
    expect(canProjectRole("editor", "share")).toBe(false);
    expect(canProjectRole("owner", "share")).toBe(true);
  });

  it("requires an authenticated context before tenant checks", () => {
    expect(() => assertSameOrganization(null, "org-1")).toThrow(AuthRequiredError);
  });

  it("denies cross-organization access", () => {
    expect(() => assertSameOrganization(baseContext, "org-2")).toThrow(ForbiddenError);
    expect(() => assertSameOrganization(baseContext, "org-1")).not.toThrow();
  });
});
