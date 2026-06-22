CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"cnpj" char(14) NOT NULL,
	"razao_social" text,
	"nome_fantasia" text,
	"situacao" text NOT NULL,
	"porte" text,
	"regime" text,
	"simples_optante" boolean,
	"data_abertura" date,
	"cnae_principal" text,
	"cnae_descricao" text,
	"municipio" text,
	"uf" char(2),
	"telefone" text,
	"email" text,
	"socios" jsonb,
	"raw_data" jsonb NOT NULL,
	"icp_aprovado" boolean DEFAULT false NOT NULL,
	"icp_motivo" text,
	"score" integer,
	"tier" text,
	"status_pipeline" text DEFAULT 'novo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_name" text NOT NULL,
	"config_id" integer,
	"config_snapshot" jsonb,
	"trigger_type" text DEFAULT 'scheduled' NOT NULL,
	"status" text NOT NULL,
	"total_fetched" integer DEFAULT 0,
	"total_approved" integer DEFAULT 0,
	"total_rejected" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "search_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"municipio" text DEFAULT 'São Luís' NOT NULL,
	"uf" char(2) DEFAULT 'MA' NOT NULL,
	"portes" text DEFAULT 'ME,EPP,MEI' NOT NULL,
	"situacao" text DEFAULT 'ATIVA' NOT NULL,
	"simples_nacional" boolean,
	"fundacao_de" date,
	"fundacao_ate" date,
	"cron_schedule" text DEFAULT '0 8 * * 1-5' NOT NULL,
	"agendamento_ativo" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_config_id_search_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."search_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_companies_situacao" ON "companies" USING btree ("situacao");--> statement-breakpoint
CREATE INDEX "idx_companies_porte" ON "companies" USING btree ("porte");--> statement-breakpoint
CREATE INDEX "idx_companies_icp" ON "companies" USING btree ("icp_aprovado");--> statement-breakpoint
CREATE INDEX "idx_companies_tier" ON "companies" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "idx_companies_municipio" ON "companies" USING btree ("municipio");--> statement-breakpoint
CREATE INDEX "idx_companies_created_at" ON "companies" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_search_configs_default" ON "search_configs" USING btree ("is_default") WHERE "search_configs"."is_default" = true;
--> statement-breakpoint
INSERT INTO "search_configs" ("nome", "municipio", "uf", "is_default") VALUES ('Padrão São Luís', 'São Luís', 'MA', true);