CREATE TYPE "public"."media_purpose" AS ENUM('SUBMISSION', 'RESOLUTION');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('IMAGE', 'VIDEO');--> statement-breakpoint
CREATE TYPE "public"."report_category" AS ENUM('ROADS', 'STREETLIGHTS', 'WASTE', 'WATER_DRAINAGE', 'PARKS', 'NOISE', 'SAFETY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "report_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"purpose" "media_purpose" DEFAULT 'SUBMISSION' NOT NULL,
	"media_type" "media_type" NOT NULL,
	"url" text NOT NULL,
	"provider_public_id" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"original_filename" varchar(255),
	"uploaded_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_media_size_bytes_ck" CHECK ("report_media"."size_bytes" > 0),
	CONSTRAINT "report_media_dimensions_ck" CHECK (("report_media"."width" IS NULL OR "report_media"."width" > 0) AND ("report_media"."height" IS NULL OR "report_media"."height" > 0))
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" text NOT NULL,
	"category" "report_category" NOT NULL,
	"location_text" varchar(255) NOT NULL,
	"status" "report_status" DEFAULT 'OPEN' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_resolved_at_ck" CHECK (("reports"."status" = 'RESOLVED') = ("reports"."resolved_at" IS NOT NULL))
);
--> statement-breakpoint
-- Hand-moved above the FKs: reports_created_by_same_society_fk needs this unique constraint to exist first.
ALTER TABLE "users" ADD CONSTRAINT "users_society_id_id_uq" UNIQUE("society_id","id");--> statement-breakpoint
ALTER TABLE "report_media" ADD CONSTRAINT "report_media_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_media" ADD CONSTRAINT "report_media_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_same_society_fk" FOREIGN KEY ("society_id","created_by_id") REFERENCES "public"."users"("society_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_media_report_id_idx" ON "report_media" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_media_provider_public_id_uq" ON "report_media" USING btree ("provider_public_id");--> statement-breakpoint
CREATE INDEX "reports_society_id_status_created_at_idx" ON "reports" USING btree ("society_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_society_id_created_at_idx" ON "reports" USING btree ("society_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_created_by_id_idx" ON "reports" USING btree ("created_by_id");