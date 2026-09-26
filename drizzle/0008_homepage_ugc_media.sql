CREATE TABLE "homepage_ugc_slots" (
  "slot" text PRIMARY KEY NOT NULL,
  "asset_id" uuid REFERENCES "media_assets"("id") ON DELETE set null,
  "updated_by" text REFERENCES "user"("id") ON DELETE set null,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
