-- Migration 0022: HVSI contribution stream backfill
-- Purpose: convert legacy null-stream contribution rows into explicit
-- runtime stream identity before strict HVSI cutover.

UPDATE `knowledgeContributions`
SET `valueStreamId` = 'global'
WHERE `valueStreamId` IS NULL OR TRIM(`valueStreamId`) = '';
