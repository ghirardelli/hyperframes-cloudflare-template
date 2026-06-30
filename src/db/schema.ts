import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  banned: boolean("banned").notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "date" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const rateLimits = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationRole: text("organization_role").notNull().default("member"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userUnique: uniqueIndex("organization_memberships_user_id_unique").on(table.userId),
  }),
);

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  prompt: text("prompt"),
  currentHtml: text("current_html"),
  durationSec: integer("duration_sec").notNull().default(6),
  status: text("status").notNull().default("draft"),
  visibility: text("visibility").notNull().default("private"),
  sharedById: text("shared_by_id").references(() => users.id, { onDelete: "set null" }),
  sharedAt: timestamp("shared_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const projectMembers = pgTable(
  "project_members",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("viewer"),
    invitedById: text("invited_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    projectUserUnique: uniqueIndex("project_members_project_id_user_id_unique").on(
      table.projectId,
      table.userId,
    ),
    projectRoleIdx: index("project_members_project_role_idx").on(table.projectId, table.role),
  }),
);

export const projectPermissionAudits = pgTable(
  "project_permission_audits",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "set null" }),
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    projectAuditIdx: index("project_permission_audits_project_id_idx").on(table.projectId),
  }),
);

export const projectVersions = pgTable("project_versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sourceKind: text("source_kind").notNull().default("generated-html"),
  prompt: text("prompt"),
  html: text("html").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const renders = pgTable("renders", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  r2Key: text("r2_key").unique(),
  storageProvider: text("storage_provider").notNull().default("r2"),
  storageKey: text("storage_key"),
  contentType: text("content_type").notNull().default("video/mp4"),
  format: text("format").notNull().default("mp4"),
  streamLibraryId: text("stream_library_id"),
  streamVideoId: text("stream_video_id"),
  streamStatus: text("stream_status"),
  streamPlaybackUrl: text("stream_playback_url"),
  streamEmbedUrl: text("stream_embed_url"),
  bunnyStorageKey: text("bunny_storage_key"),
  snapshotId: text("snapshot_id"),
  sourceType: text("source_type").notNull(),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const projectEntries = pgTable(
  "project_entries",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    path: text("path").notNull(),
    kind: text("kind").notNull().default("text"),
    artifactRole: text("artifact_role").notNull().default("source"),
    storageProvider: text("storage_provider").notNull().default("postgres"),
    storageKey: text("storage_key"),
    streamLibraryId: text("stream_library_id"),
    streamVideoId: text("stream_video_id"),
    contentType: text("content_type"),
    size: integer("size").notNull().default(0),
    sha256: text("sha256"),
    textContent: text("text_content"),
    searchText: text("search_text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    projectPathUnique: uniqueIndex("project_entries_project_id_path_unique").on(
      table.projectId,
      table.path,
    ),
    orgProjectIdx: index("project_entries_org_project_idx").on(
      table.organizationId,
      table.projectId,
    ),
  }),
);

export const projectEntryVersions = pgTable(
  "project_entry_versions",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => projectEntries.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    kind: text("kind").notNull(),
    artifactRole: text("artifact_role").notNull().default("source"),
    storageProvider: text("storage_provider").notNull().default("postgres"),
    storageKey: text("storage_key"),
    contentType: text("content_type"),
    size: integer("size").notNull().default(0),
    sha256: text("sha256"),
    textContent: text("text_content"),
    changeKind: text("change_kind").notNull().default("save"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    entryCreatedIdx: index("project_entry_versions_entry_created_idx").on(
      table.entryId,
      table.createdAt,
    ),
    projectCreatedIdx: index("project_entry_versions_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  }),
);

export const projectSnapshots = pgTable(
  "project_snapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull().default("manual"),
    manifest: jsonb("manifest").$type<Array<{ path: string; versionId: string }>>().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    projectCreatedIdx: index("project_snapshots_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  }),
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    skillId: text("skill_id").notNull(),
    status: text("status").notNull().default("queued"),
    phase: text("phase").notNull().default("preflight"),
    inputUrl: text("input_url").notNull(),
    options: jsonb("options").$type<Record<string, unknown>>(),
    progress: jsonb("progress").$type<Record<string, unknown>>(),
    artifactManifest: jsonb("artifact_manifest").$type<Record<string, unknown>>(),
    error: jsonb("error").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
  },
  (table) => ({
    orgCreatedIdx: index("workflow_runs_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    orgStatusIdx: index("workflow_runs_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
    projectIdx: index("workflow_runs_project_idx").on(table.projectId),
  }),
);

// Multi-file project source. Each row is one text source file (index.html,
// compositions/*.html, etc.) keyed uniquely by (projectId, path). Organization
// id is denormalized for direct organization-scoped queries.
export const projectFiles = pgTable(
  "project_files",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull().default(""),
    entryId: text("entry_id").references(() => projectEntries.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    projectPathUnique: uniqueIndex("project_files_project_id_path_unique").on(
      table.projectId,
      table.path,
    ),
  }),
);

// Binary project assets. Bytes live in R2 under r2Key (organization/project
// prefixed); this table holds the metadata and logical path.
export const projectAssets = pgTable(
  "project_assets",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    r2Key: text("r2_key").unique(),
    entryId: text("entry_id").references(() => projectEntries.id, { onDelete: "set null" }),
    storageProvider: text("storage_provider").notNull().default("r2"),
    storageKey: text("storage_key"),
    artifactRole: text("artifact_role").notNull().default("asset"),
    sha256: text("sha256"),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull().default(0),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    projectPathUnique: uniqueIndex("project_assets_project_id_path_unique").on(
      table.projectId,
      table.path,
    ),
  }),
);

export const publishedProjects = pgTable("published_projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  posterKey: text("poster_key"),
  durationSec: integer("duration_sec").notNull().default(6),
  width: integer("width").notNull().default(1920),
  height: integer("height").notNull().default(1080),
  sourceHtml: text("source_html").notNull(),
  publishedById: text("published_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  publishedAt: timestamp("published_at", { mode: "date" }).notNull().defaultNow(),
  unpublishedAt: timestamp("unpublished_at", { mode: "date" }),
});
