CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"skill_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"phase" text DEFAULT 'preflight' NOT NULL,
	"input_url" text NOT NULL,
	"options" jsonb,
	"progress" jsonb,
	"artifact_manifest" jsonb,
	"error" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_runs_org_created_idx" ON "workflow_runs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "workflow_runs_org_status_idx" ON "workflow_runs" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "workflow_runs_project_idx" ON "workflow_runs" USING btree ("project_id");