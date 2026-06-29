CREATE TABLE "cnpja_quota" (
	"id" serial PRIMARY KEY NOT NULL,
	"perpetual" double precision NOT NULL,
	"transient" double precision NOT NULL,
	"total" double precision NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
