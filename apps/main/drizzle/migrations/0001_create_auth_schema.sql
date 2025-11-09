-- Create auth schema and minimal Auth.js tables (idempotent)
CREATE SCHEMA IF NOT EXISTS auth;

-- auth.user
CREATE TABLE IF NOT EXISTS auth."user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "email" text UNIQUE,
  "emailVerified" timestamp,
  "image" text
);

-- auth.account
CREATE TABLE IF NOT EXISTS auth."account" (
  "userId" text NOT NULL,
  "type" text NOT NULL,
  "provider" text NOT NULL,
  "providerAccountId" text NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" text,
  "scope" text,
  "id_token" text,
  "session_state" text,
  CONSTRAINT "account_provider_providerAccountId_pk"
    PRIMARY KEY("provider","providerAccountId")
);

-- FK (add if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='auth' AND constraint_name='account_userId_user_id_fk'
  ) THEN
    EXECUTE 'ALTER TABLE auth."account" ADD CONSTRAINT "account_userId_user_id_fk"
             FOREIGN KEY ("userId") REFERENCES auth."user"("id") ON DELETE CASCADE';
  END IF;
END $$;

