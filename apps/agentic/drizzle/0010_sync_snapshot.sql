-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 0010: Schema Sync Snapshot (no-op)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- This migration exists solely to establish a Drizzle snapshot baseline.
-- All prior manually-written migrations (0006–0009) were applied outside of
-- drizzle-kit generate, so the snapshot chain was broken at 0005.
--
-- The accompanying meta/0010_snapshot.json captures the full schema state
-- as of this point, ensuring future `drizzle-kit generate` calls produce
-- correct delta-only migrations.
--
-- On a FRESH database: migrations 0000–0009 create all tables.
--                       This migration is a harmless no-op (SELECT 1).
-- On EXISTING databases: This migration is tracked by __drizzle_migrations
--                        and simply validates the snapshot baseline.
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 1;