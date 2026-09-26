CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "session_user_idx" ON "session" ("user_id");
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamptz,
  "refresh_token_expires_at" timestamptz,
  "scope" text,
  "password" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_user_idx" ON "account" ("user_id");
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "original_name" text NOT NULL,
  "storage_key" text NOT NULL UNIQUE,
  "thumbnail_key" text,
  "mime_type" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "width" integer NOT NULL CHECK ("width" > 0),
  "height" integer NOT NULL CHECK ("height" > 0),
  "duration_ms" integer NOT NULL CHECK ("duration_ms" > 0),
  "frame_rate" text NOT NULL,
  "codec" text NOT NULL,
  "has_audio" boolean DEFAULT false NOT NULL,
  "rotation" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "media_owner_idx" ON "media_assets" ("owner_id");

CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "asset_id" uuid REFERENCES "media_assets"("id") ON DELETE set null,
  "effect_stack" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "project_owner_updated_idx" ON "projects" ("owner_id", "updated_at");

CREATE TABLE IF NOT EXISTS "render_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "queue_job_id" text,
  "status" text DEFAULT 'queued' NOT NULL CHECK ("status" IN ('queued','preparing','rendering','encoding','complete','failed','canceled')),
  "progress" integer DEFAULT 0 NOT NULL CHECK ("progress" >= 0 AND "progress" <= 100),
  "resolution" text NOT NULL CHECK ("resolution" IN ('source','1080p','720p')),
  "quality" text NOT NULL CHECK ("quality" IN ('high','standard','small')),
  "keep_audio" boolean DEFAULT true NOT NULL,
  "error" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "render_project_idx" ON "render_jobs" ("project_id");
CREATE INDEX IF NOT EXISTS "render_status_idx" ON "render_jobs" ("status");

CREATE TABLE IF NOT EXISTS "exports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "render_job_id" uuid NOT NULL UNIQUE REFERENCES "render_jobs"("id") ON DELETE cascade,
  "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "storage_key" text NOT NULL UNIQUE,
  "resolution" text NOT NULL,
  "duration_ms" integer NOT NULL,
  "size_bytes" bigint NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "export_project_idx" ON "exports" ("project_id");
