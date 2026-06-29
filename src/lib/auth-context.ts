import { and, eq } from "drizzle-orm";

import { createAuth, type AuthEnv } from "../auth";
import { createDb } from "../db";
import {
  organizationMemberships,
  organizations,
  projectMembers,
  publishedProjects,
  projects,
} from "../db/schema";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  banExpires?: Date | string | null;
}

export interface AppOrganization {
  id: string;
  name: string;
  role?: string | null;
  isBootstrap?: boolean;
}

export interface AppAuthContext {
  user: AppUser;
  organization: AppOrganization;
}

export interface TenantAuthEnv extends AuthEnv {
  INITIAL_ADMIN_EMAILS?: string;
}

export class AuthRequiredError extends Error {
  status = 401;

  constructor(message = "authentication required") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class ForbiddenError extends Error {
  status = 403;

  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .includes("admin");
}

export function isBootstrapAdminEmail(
  env: Pick<TenantAuthEnv, "INITIAL_ADMIN_EMAILS">,
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (env.INITIAL_ADMIN_EMAILS ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

export function isUserLocked(
  user: Pick<AppUser, "banned" | "banExpires"> | null | undefined,
): boolean {
  if (!user?.banned) return false;
  if (!user.banExpires) return true;
  return new Date(user.banExpires).getTime() > Date.now();
}

export function assertAdmin(context: AppAuthContext | null): asserts context is AppAuthContext {
  if (!context) throw new AuthRequiredError();
  if (!isAdminRole(context.user.role)) throw new ForbiddenError("admin required");
}

export function assertSameOrganization(
  context: AppAuthContext | null,
  organizationId: string,
): asserts context is AppAuthContext {
  if (!context) throw new AuthRequiredError();
  if (context.organization.id !== organizationId) {
    throw new ForbiddenError("organization access denied");
  }
}

export type ProjectPermission = "read" | "edit" | "share" | "render" | "publish" | "restore";

export function isOrganizationAdmin(context: AppAuthContext): boolean {
  return isAdminRole(context.user.role) || isAdminRole(context.organization.role);
}

export function canProjectRole(role: string | null | undefined, permission: ProjectPermission): boolean {
  if (role === "owner") return true;
  if (role === "editor") return permission !== "share";
  if (role === "viewer") return permission === "read" || permission === "render";
  return false;
}

export async function requireAuthContext(
  request: Request,
  env: TenantAuthEnv,
): Promise<AppAuthContext> {
  const context = await getAuthContext(request, env);
  if (!context) throw new AuthRequiredError();
  if (isUserLocked(context.user)) throw new ForbiddenError("account locked");
  return context;
}

export async function getAuthContext(
  request: Request,
  env: TenantAuthEnv,
): Promise<AppAuthContext | null> {
  const session = await createAuth(env).api.getSession({
    headers: request.headers,
  });

  if (!session?.user) return null;

  const db = createDb(env);
  const memberships = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationRole: organizationMemberships.organizationRole,
    })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizationMemberships.organizationId, organizations.id),
    )
    .where(eq(organizationMemberships.userId, session.user.id))
    .limit(1);

  const membership = memberships[0];
  const rawUser = session.user as AppUser;
  const role = isBootstrapAdminEmail(env, rawUser.email) ? "admin" : rawUser.role;

  if (!membership && !isAdminRole(role)) return null;

  return {
    user: {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      role,
      banned: rawUser.banned ?? false,
      banExpires: rawUser.banExpires ?? null,
    },
    organization: membership
        ? {
          id: membership.organizationId,
          name: membership.organizationName,
          role: membership.organizationRole,
        }
      : {
          id: "__bootstrap__",
          name: "Bootstrap admin",
          role: "admin",
          isBootstrap: true,
        },
  };
}

export async function requireProjectAccess(
  context: AppAuthContext,
  projectId: string,
  env: TenantAuthEnv,
  permission: ProjectPermission = "read",
) {
  const db = createDb(env);
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const project = rows[0];
  if (!project) throw new ForbiddenError("project access denied");
  assertSameOrganization(context, project.organizationId);

  if (isOrganizationAdmin(context) || project.ownerId === context.user.id) {
    return project;
  }

  const visibility = project.visibility ?? "organization";
  const isLegacyRow = project.ownerId == null && project.visibility == null;
  if ((visibility === "organization" || isLegacyRow) && (permission === "read" || permission === "render")) {
    return project;
  }

  const memberRows = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, context.user.id)))
    .limit(1);
  if (canProjectRole(memberRows[0]?.role, permission)) {
    return project;
  }

  if (visibility === "organization" && permission === "publish") {
    return project;
  }

  console.warn("Project access denied", {
    projectId,
    organizationId: project.organizationId,
    userId: context.user.id,
    permission,
  });
  throw new ForbiddenError("project access denied");
}

export async function requirePublishedProjectAccess(
  context: AppAuthContext,
  publishedProjectId: string,
  env: TenantAuthEnv,
) {
  const db = createDb(env);
  const rows = await db
    .select()
    .from(publishedProjects)
    .where(eq(publishedProjects.id, publishedProjectId))
    .limit(1);
  const publishedProject = rows[0];
  if (!publishedProject) throw new ForbiddenError("published project access denied");
  assertSameOrganization(context, publishedProject.organizationId);
  return publishedProject;
}
