ALTER TABLE "users" DROP CONSTRAINT "users_society_required_ck";--> statement-breakpoint
-- Hand-added data step (D028): admins leave their society. Fails (FK) if an admin authored a report.
UPDATE "users" SET "society_id" = NULL WHERE "role" = 'ADMIN';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_society_required_ck" CHECK (("users"."role" = 'ADMIN') = ("users"."society_id" IS NULL));
