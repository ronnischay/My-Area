ALTER TABLE "report_media" DROP CONSTRAINT "report_media_size_bytes_ck";--> statement-breakpoint
ALTER TABLE "report_media" DROP CONSTRAINT "report_media_dimensions_ck";--> statement-breakpoint
ALTER TABLE "report_media" DROP COLUMN "size_bytes";--> statement-breakpoint
ALTER TABLE "report_media" DROP COLUMN "width";--> statement-breakpoint
ALTER TABLE "report_media" DROP COLUMN "height";--> statement-breakpoint
ALTER TABLE "report_media" DROP COLUMN "original_filename";