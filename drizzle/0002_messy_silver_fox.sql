CREATE TABLE "project_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"path" text NOT NULL,
	"r2_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_assets_r2_key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
CREATE TABLE "project_files" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"path" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_assets_project_id_path_unique" ON "project_assets" USING btree ("project_id","path");--> statement-breakpoint
CREATE UNIQUE INDEX "project_files_project_id_path_unique" ON "project_files" USING btree ("project_id","path");--> statement-breakpoint
-- Backfill: seed each existing project's index.html from its current_html.
-- currentHtml is retained as a mirror during the transition; renders/publish
-- links are untouched.
INSERT INTO "project_files" ("id", "project_id", "organization_id", "path", "content", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", "organization_id", 'index.html', COALESCE("current_html", ''), now(), now()
FROM "projects"
WHERE "current_html" IS NOT NULL
ON CONFLICT ("project_id", "path") DO NOTHING;