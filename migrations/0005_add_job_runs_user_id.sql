ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "user_id" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
