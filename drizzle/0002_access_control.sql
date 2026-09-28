ALTER TABLE "user" ADD COLUMN "creative_circle_access" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "user" SET "creative_circle_access" = true;
