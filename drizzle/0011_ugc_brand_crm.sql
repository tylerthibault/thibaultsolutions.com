CREATE TABLE IF NOT EXISTS "ugc_brand_leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "brand" text NOT NULL,
  "category" text DEFAULT 'General' NOT NULL,
  "signal" text DEFAULT '' NOT NULL,
  "source" text DEFAULT 'Manual' NOT NULL,
  "source_url" text,
  "compensation" text DEFAULT 'Not listed' NOT NULL,
  "creator_fit" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'RESEARCH' NOT NULL,
  "contact_name" text,
  "contact_email" text,
  "contact_url" text,
  "pitch_notes" text DEFAULT '' NOT NULL,
  "research_notes" text DEFAULT '' NOT NULL,
  "last_contacted_at" timestamptz,
  "next_follow_up_at" timestamptz,
  "researched_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ugc_brand_status_idx" ON "ugc_brand_leads" ("status", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ugc_brand_follow_up_idx" ON "ugc_brand_leads" ("next_follow_up_at");
