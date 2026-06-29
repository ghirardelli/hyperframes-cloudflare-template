CREATE TABLE "project_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"updated_by_id" text,
	"path" text NOT NULL,
	"kind" text DEFAULT 'text' NOT NULL,
	"artifact_role" text DEFAULT 'source' NOT NULL,
	"storage_provider" text DEFAULT 'postgres' NOT NULL,
	"storage_key" text,
	"stream_library_id" text,
	"stream_video_id" text,
	"content_type" text,
	"size" integer DEFAULT 0 NOT NULL,
	"sha256" text,
	"text_content" text,
	"search_text" text,
	"metadata" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_entry_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"path" text NOT NULL,
	"kind" text NOT NULL,
	"artifact_role" text DEFAULT 'source' NOT NULL,
	"storage_provider" text DEFAULT 'postgres' NOT NULL,
	"storage_key" text,
	"content_type" text,
	"size" integer DEFAULT 0 NOT NULL,
	"sha256" text,
	"text_content" text,
	"change_kind" text DEFAULT 'save' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"invited_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_permission_audits" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target_user_id" text,
	"previous_value" text,
	"new_value" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"reason" text DEFAULT 'manual' NOT NULL,
	"manifest" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_assets" ALTER COLUMN "r2_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "renders" ALTER COLUMN "r2_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN "entry_id" text;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN "storage_provider" text DEFAULT 'r2' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN "artifact_role" text DEFAULT 'asset' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_files" ADD COLUMN "entry_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "shared_by_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "shared_at" timestamp;--> statement-breakpoint
ALTER TABLE "renders" ADD COLUMN "storage_provider" text DEFAULT 'r2' NOT NULL;--> statement-breakpoint
ALTER TABLE "renders" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "renders" ADD COLUMN "content_type" text DEFAULT 'video/mp4' NOT NULL;--> statement-breakpoint
ALTER TABLE "renders" ADD COLUMN "format" text DEFAULT 'mp4' NOT NULL;--> statement-breakpoint
ALTER TABLE "renders" ADD COLUMN "stream_library_id" text;--> statement-breakpoint
ALTER TABLE "renders" ADD COLUMN "stream_video_id" text;--> statement-breakpoint
ALTER TABLE "renders" ADD COLUMN "stream_status" text;--> statement-breakpoint
ALTER TABLE "renders" ADD COLUMN "stream_playback_url" text;--> statement-breakpoint
ALTER TABLE "renders" ADD COLUMN "stream_embed_url" text;--> statement-breakpoint
ALTER TABLE "renders" ADD COLUMN "bunny_storage_key" text;--> statement-breakpoint
ALTER TABLE "renders" ADD COLUMN "snapshot_id" text;--> statement-breakpoint
ALTER TABLE "project_entries" ADD CONSTRAINT "project_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_entries" ADD CONSTRAINT "project_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_entries" ADD CONSTRAINT "project_entries_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_entries" ADD CONSTRAINT "project_entries_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_entries" ADD CONSTRAINT "project_entries_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_entry_versions" ADD CONSTRAINT "project_entry_versions_entry_id_project_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."project_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_entry_versions" ADD CONSTRAINT "project_entry_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_entry_versions" ADD CONSTRAINT "project_entry_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_entry_versions" ADD CONSTRAINT "project_entry_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_permission_audits" ADD CONSTRAINT "project_permission_audits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_permission_audits" ADD CONSTRAINT "project_permission_audits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_permission_audits" ADD CONSTRAINT "project_permission_audits_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_permission_audits" ADD CONSTRAINT "project_permission_audits_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_entries_project_id_path_unique" ON "project_entries" USING btree ("project_id","path");--> statement-breakpoint
CREATE INDEX "project_entries_org_project_idx" ON "project_entries" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX "project_entries_search_idx" ON "project_entries" USING btree ("search_text");--> statement-breakpoint
CREATE INDEX "project_entry_versions_entry_created_idx" ON "project_entry_versions" USING btree ("entry_id","created_at");--> statement-breakpoint
CREATE INDEX "project_entry_versions_project_created_idx" ON "project_entry_versions" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_project_id_user_id_unique" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_members_project_role_idx" ON "project_members" USING btree ("project_id","role");--> statement-breakpoint
CREATE INDEX "project_permission_audits_project_id_idx" ON "project_permission_audits" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_snapshots_project_created_idx" ON "project_snapshots" USING btree ("project_id","created_at");--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_entry_id_project_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."project_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_entry_id_project_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."project_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_shared_by_id_users_id_fk" FOREIGN KEY ("shared_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "project_assets" SET "storage_key" = "r2_key" WHERE "storage_key" IS NULL;--> statement-breakpoint
UPDATE "renders" SET "storage_key" = "r2_key" WHERE "storage_key" IS NULL;--> statement-breakpoint
INSERT INTO "project_members" ("id", "project_id", "organization_id", "user_id", "role", "invited_by_id", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", "organization_id", "owner_id", 'owner', "owner_id", now(), now()
FROM "projects"
ON CONFLICT ("project_id", "user_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "project_entries" (
  "id", "project_id", "organization_id", "owner_id", "created_by_id", "updated_by_id",
  "path", "kind", "artifact_role", "storage_provider", "content_type", "size",
  "text_content", "search_text", "created_at", "updated_at"
)
SELECT
  "project_files"."project_id" || ':' || "project_files"."path",
  "project_files"."project_id",
  "project_files"."organization_id",
  "projects"."owner_id",
  "projects"."owner_id",
  "projects"."owner_id",
  "project_files"."path",
  'text',
  CASE
    WHEN "project_files"."path" LIKE 'compositions/%' THEN 'composition'
    ELSE 'source'
  END,
  'postgres',
  CASE
    WHEN "project_files"."path" LIKE '%.css' THEN 'text/css; charset=utf-8'
    WHEN "project_files"."path" LIKE '%.js' THEN 'text/javascript; charset=utf-8'
    WHEN "project_files"."path" LIKE '%.json' THEN 'application/json; charset=utf-8'
    ELSE 'text/html; charset=utf-8'
  END,
  length("project_files"."content"),
  "project_files"."content",
  "project_files"."path" || E'\n' || "project_files"."content",
  "project_files"."created_at",
  "project_files"."updated_at"
FROM "project_files"
INNER JOIN "projects" ON "projects"."id" = "project_files"."project_id"
ON CONFLICT ("project_id", "path") DO NOTHING;--> statement-breakpoint
UPDATE "project_files"
SET "entry_id" = "project_files"."project_id" || ':' || "project_files"."path"
WHERE "entry_id" IS NULL;--> statement-breakpoint
INSERT INTO "project_entry_versions" (
  "id", "entry_id", "project_id", "organization_id", "created_by_id", "path",
  "kind", "artifact_role", "storage_provider", "content_type", "size",
  "text_content", "change_kind", "created_at"
)
SELECT
  gen_random_uuid(),
  "project_files"."project_id" || ':' || "project_files"."path",
  "project_files"."project_id",
  "project_files"."organization_id",
  "projects"."owner_id",
  "project_files"."path",
  'text',
  CASE
    WHEN "project_files"."path" LIKE 'compositions/%' THEN 'composition'
    ELSE 'source'
  END,
  'postgres',
  CASE
    WHEN "project_files"."path" LIKE '%.css' THEN 'text/css; charset=utf-8'
    WHEN "project_files"."path" LIKE '%.js' THEN 'text/javascript; charset=utf-8'
    WHEN "project_files"."path" LIKE '%.json' THEN 'application/json; charset=utf-8'
    ELSE 'text/html; charset=utf-8'
  END,
  length("project_files"."content"),
  "project_files"."content",
  'migration',
  "project_files"."updated_at"
FROM "project_files"
INNER JOIN "projects" ON "projects"."id" = "project_files"."project_id";--> statement-breakpoint
INSERT INTO "project_entries" (
  "id", "project_id", "organization_id", "owner_id", "created_by_id",
  "path", "kind", "artifact_role", "storage_provider", "storage_key",
  "content_type", "size", "search_text", "created_at", "updated_at"
)
SELECT
  "project_assets"."project_id" || ':' || "project_assets"."path",
  "project_assets"."project_id",
  "project_assets"."organization_id",
  "projects"."owner_id",
  "project_assets"."created_by_id",
  "project_assets"."path",
  'binary',
  'asset',
  'r2',
  "project_assets"."r2_key",
  "project_assets"."content_type",
  "project_assets"."size",
  "project_assets"."path",
  "project_assets"."created_at",
  "project_assets"."updated_at"
FROM "project_assets"
INNER JOIN "projects" ON "projects"."id" = "project_assets"."project_id"
ON CONFLICT ("project_id", "path") DO NOTHING;--> statement-breakpoint
UPDATE "project_assets"
SET "entry_id" = "project_assets"."project_id" || ':' || "project_assets"."path"
WHERE "entry_id" IS NULL;--> statement-breakpoint
INSERT INTO "project_entries" (
  "id", "project_id", "organization_id", "owner_id", "created_by_id",
  "path", "kind", "artifact_role", "storage_provider", "storage_key",
  "content_type", "size", "search_text", "created_at", "updated_at"
)
SELECT
  "renders"."project_id" || ':renders/' || "renders"."id" || '.mp4',
  "renders"."project_id",
  "renders"."organization_id",
  "projects"."owner_id",
  "renders"."user_id",
  'renders/' || "renders"."id" || '.mp4',
  'render',
  'render',
  'r2',
  "renders"."r2_key",
  "renders"."content_type",
  0,
  'renders/' || "renders"."id" || '.mp4',
  "renders"."created_at",
  "renders"."created_at"
FROM "renders"
INNER JOIN "projects" ON "projects"."id" = "renders"."project_id"
WHERE "renders"."project_id" IS NOT NULL
ON CONFLICT ("project_id", "path") DO NOTHING;
