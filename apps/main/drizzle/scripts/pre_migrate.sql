-- Ensure required schemas exist before running migrations
CREATE SCHEMA IF NOT EXISTS auth;

-- Ensure required extensions are enabled
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS vector;

