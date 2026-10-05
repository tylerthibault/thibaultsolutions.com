CREATE TABLE IF NOT EXISTS "variation_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "variation_segments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "owner_id" text NOT NULL,
  "kind" text NOT NULL,
  "position" integer NOT NULL,
  "storage_key" text NOT NULL,
  "original_name" text NOT NULL,
  "mime_type" text DEFAULT 'video/mp4' NOT NULL,
  "size_bytes" bigint NOT NULL,
  "duration_ms" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "variation_renders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "owner_id" text NOT NULL,
  "hook_position" integer NOT NULL,
  "body_position" integer NOT NULL,
  "cta_position" integer NOT NULL,
  "storage_key" text NOT NULL,
  "file_name" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "duration_ms" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'variation_sessions_owner_id_user_id_fk') THEN
    ALTER TABLE "variation_sessions"
      ADD CONSTRAINT "variation_sessions_owner_id_user_id_fk"
      FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'variation_segments_session_id_variation_sessions_id_fk') THEN
    ALTER TABLE "variation_segments"
      ADD CONSTRAINT "variation_segments_session_id_variation_sessions_id_fk"
      FOREIGN KEY ("session_id") REFERENCES "public"."variation_sessions"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'variation_segments_owner_id_user_id_fk') THEN
    ALTER TABLE "variation_segments"
      ADD CONSTRAINT "variation_segments_owner_id_user_id_fk"
      FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'variation_renders_session_id_variation_sessions_id_fk') THEN
    ALTER TABLE "variation_renders"
      ADD CONSTRAINT "variation_renders_session_id_variation_sessions_id_fk"
      FOREIGN KEY ("session_id") REFERENCES "public"."variation_sessions"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'variation_renders_owner_id_user_id_fk') THEN
    ALTER TABLE "variation_renders"
      ADD CONSTRAINT "variation_renders_owner_id_user_id_fk"
      FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "variation_session_owner_idx" ON "variation_sessions" ("owner_id", "updated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "variation_segment_slot_unique" ON "variation_segments" ("session_id", "kind", "position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "variation_segment_session_idx" ON "variation_segments" ("session_id", "kind", "position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "variation_segment_owner_idx" ON "variation_segments" ("owner_id", "updated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "variation_render_combo_unique" ON "variation_renders" ("session_id", "hook_position", "body_position", "cta_position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "variation_render_session_idx" ON "variation_renders" ("session_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "variation_render_owner_idx" ON "variation_renders" ("owner_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "variation_segment_storage_unique" ON "variation_segments" ("storage_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "variation_render_storage_unique" ON "variation_renders" ("storage_key");
