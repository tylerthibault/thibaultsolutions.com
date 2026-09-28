ALTER TABLE "feedback_comments" ALTER COLUMN "author_id" DROP NOT NULL;
ALTER TABLE "feedback_comments" DROP CONSTRAINT IF EXISTS "feedback_comments_author_id_user_id_fk";
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_author_id_user_id_fk"
  FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "feedback_comments" ADD COLUMN IF NOT EXISTS "display_name" text;
ALTER TABLE "feedback_comments" ADD COLUMN IF NOT EXISTS "reviewer_key" text;
ALTER TABLE "feedback_comments" ADD COLUMN IF NOT EXISTS "timestamp_end_ms" integer;
ALTER TABLE "feedback_comments" ADD COLUMN IF NOT EXISTS "ip_address" text;
ALTER TABLE "feedback_comments" ADD COLUMN IF NOT EXISTS "user_agent" text;
ALTER TABLE "feedback_comments" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'visible' NOT NULL;

ALTER TABLE "feedback_comments" DROP CONSTRAINT IF EXISTS "feedback_comments_timestamp_end_ms_check";
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_timestamp_end_ms_check"
  CHECK ("timestamp_end_ms" IS NULL OR "timestamp_end_ms" >= 0);
ALTER TABLE "feedback_comments" DROP CONSTRAINT IF EXISTS "feedback_comments_timestamp_range_check";
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_timestamp_range_check"
  CHECK ("timestamp_end_ms" IS NULL OR "timestamp_ms" IS NOT NULL AND "timestamp_end_ms" >= "timestamp_ms");

CREATE INDEX IF NOT EXISTS "feedback_comment_ip_idx" ON "feedback_comments" ("ip_address", "created_at");
CREATE INDEX IF NOT EXISTS "feedback_comment_reviewer_idx" ON "feedback_comments" ("reviewer_key", "created_at");

CREATE TABLE IF NOT EXISTS "blocked_feedback_ips" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ip_address" text NOT NULL UNIQUE,
  "reason" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
