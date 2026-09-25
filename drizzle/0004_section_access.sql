ALTER TABLE "user" ADD COLUMN "creative_circle_lab_access" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "creative_circle_feedback_access" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "user"
SET
  "creative_circle_lab_access" = "creative_circle_access",
  "creative_circle_feedback_access" = "creative_circle_access";
--> statement-breakpoint
ALTER TABLE "creative_circle_invitations" ADD COLUMN "lab_access" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "creative_circle_invitations" ADD COLUMN "feedback_access" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "creative_circle_invitations"
SET "lab_access" = true, "feedback_access" = true;
