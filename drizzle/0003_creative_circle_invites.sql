CREATE TABLE IF NOT EXISTS "creative_circle_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "accepted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "creative_circle_invite_email_unique" ON "creative_circle_invitations" ("email");
CREATE INDEX IF NOT EXISTS "creative_circle_invite_admin_idx" ON "creative_circle_invitations" ("admin_id");
