CREATE TABLE IF NOT EXISTS "ugc_discovery_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "category" text DEFAULT 'General' NOT NULL,
  "source_url" text NOT NULL,
  "source_type" text DEFAULT 'AUTO' NOT NULL,
  "keywords" text DEFAULT '' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "last_checked_at" timestamptz,
  "last_status" text,
  "last_error" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ugc_discovery_target_source_unique" ON "ugc_discovery_targets" ("source_url");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ugc_discovery_target_enabled_idx" ON "ugc_discovery_targets" ("enabled", "updated_at");
--> statement-breakpoint
ALTER TABLE "ugc_brand_leads" ADD COLUMN IF NOT EXISTS "discovery_target_id" uuid;
--> statement-breakpoint
ALTER TABLE "ugc_brand_leads" ADD COLUMN IF NOT EXISTS "discovered_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "ugc_brand_leads" ADD COLUMN IF NOT EXISTS "last_verified_at" timestamptz;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ugc_brand_leads_discovery_target_id_ugc_discovery_targets_id_fk'
  ) THEN
    ALTER TABLE "ugc_brand_leads"
      ADD CONSTRAINT "ugc_brand_leads_discovery_target_id_ugc_discovery_targets_id_fk"
      FOREIGN KEY ("discovery_target_id")
      REFERENCES "public"."ugc_discovery_targets"("id")
      ON DELETE set null
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ugc_brand_discovery_target_idx" ON "ugc_brand_leads" ("discovery_target_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ugc_brand_verified_idx" ON "ugc_brand_leads" ("last_verified_at");
