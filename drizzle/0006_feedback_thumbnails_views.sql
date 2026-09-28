ALTER TABLE "feedback_videos" ADD COLUMN "thumbnail_url" text;
--> statement-breakpoint
CREATE TABLE "feedback_views" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "video_id" uuid NOT NULL REFERENCES "feedback_videos"("id") ON DELETE cascade,
  "viewer_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "seen_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_view_unique" ON "feedback_views" ("video_id","viewer_user_id");
--> statement-breakpoint
CREATE INDEX "feedback_view_viewer_idx" ON "feedback_views" ("viewer_user_id","seen_at");
