CREATE TABLE IF NOT EXISTS "circle_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "member_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "circle_member_unique" ON "circle_memberships" ("owner_id", "member_user_id");
CREATE INDEX IF NOT EXISTS "circle_member_owner_idx" ON "circle_memberships" ("owner_id");
CREATE INDEX IF NOT EXISTS "circle_member_user_idx" ON "circle_memberships" ("member_user_id");

CREATE TABLE IF NOT EXISTS "circle_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "accepted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "circle_invite_owner_email_unique" ON "circle_invitations" ("owner_id", "email");
CREATE INDEX IF NOT EXISTS "circle_invite_owner_idx" ON "circle_invitations" ("owner_id");

CREATE TABLE IF NOT EXISTS "feedback_videos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "source_type" text NOT NULL CHECK ("source_type" IN ('upload','link')),
  "asset_id" uuid REFERENCES "media_assets"("id") ON DELETE set null,
  "source_url" text,
  "provider" text,
  "duration_ms" integer,
  "status" text DEFAULT 'open' NOT NULL CHECK ("status" IN ('open','archived')),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "feedback_video_source_check" CHECK (
    ("source_type" = 'upload' AND "source_url" IS NULL) OR
    ("source_type" = 'link' AND "source_url" IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS "feedback_video_owner_idx" ON "feedback_videos" ("owner_id", "updated_at");

CREATE TABLE IF NOT EXISTS "feedback_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "video_id" uuid NOT NULL REFERENCES "feedback_videos"("id") ON DELETE cascade,
  "reviewer_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "seen_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "feedback_assignment_unique" ON "feedback_assignments" ("video_id", "reviewer_user_id");
CREATE INDEX IF NOT EXISTS "feedback_assignment_reviewer_idx" ON "feedback_assignments" ("reviewer_user_id", "created_at");

CREATE TABLE IF NOT EXISTS "feedback_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "video_id" uuid NOT NULL REFERENCES "feedback_videos"("id") ON DELETE cascade,
  "author_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "timestamp_ms" integer CHECK ("timestamp_ms" IS NULL OR "timestamp_ms" >= 0),
  "body" text NOT NULL,
  "resolved" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "feedback_comment_video_idx" ON "feedback_comments" ("video_id", "created_at");
