ALTER TABLE "user" ADD COLUMN "username" text;
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");
--> statement-breakpoint
ALTER TABLE "creative_circle_invitations" ADD COLUMN "username" text;
--> statement-breakpoint
ALTER TABLE "creative_circle_invitations" ADD CONSTRAINT "creative_circle_invitations_username_unique" UNIQUE("username");
