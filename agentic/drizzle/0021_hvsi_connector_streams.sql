-- Migration 0021: HVSI connector stream normalization
-- Purpose: make connector and connector-sync stream identity first-class,
-- explicit, and backfilled from legacy JSON config.

SET @connector_stream_column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'knowledgeConnectors'
    AND COLUMN_NAME = 'streamId'
);

SET @connector_stream_column_sql = IF(
  @connector_stream_column_exists = 0,
  'ALTER TABLE `knowledgeConnectors` ADD COLUMN `streamId` varchar(64) NULL AFTER `orgId`',
  'SELECT 1'
);

PREPARE hvsi_stmt FROM @connector_stream_column_sql;
EXECUTE hvsi_stmt;
DEALLOCATE PREPARE hvsi_stmt;

UPDATE `knowledgeConnectors`
SET
  `streamId` = COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`config`, '$.streamId')), ''),
    'global'
  );

UPDATE `knowledgeConnectors`
SET
  `config` = JSON_SET(
    COALESCE(`config`, JSON_OBJECT()),
    '$.streamId',
    `streamId`
  );

ALTER TABLE `knowledgeConnectors`
  MODIFY COLUMN `streamId` varchar(64) NOT NULL;

SET @connector_stream_index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'knowledgeConnectors'
    AND INDEX_NAME = 'idx_connectors_stream'
);

SET @connector_stream_index_sql = IF(
  @connector_stream_index_exists = 0,
  'CREATE INDEX `idx_connectors_stream` ON `knowledgeConnectors` (`streamId`)',
  'SELECT 1'
);

PREPARE hvsi_stmt FROM @connector_stream_index_sql;
EXECUTE hvsi_stmt;
DEALLOCATE PREPARE hvsi_stmt;

SET @sync_stream_column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'knowledgeConnectorSyncs'
    AND COLUMN_NAME = 'streamId'
);

SET @sync_stream_column_sql = IF(
  @sync_stream_column_exists = 0,
  'ALTER TABLE `knowledgeConnectorSyncs` ADD COLUMN `streamId` varchar(64) NULL AFTER `orgId`',
  'SELECT 1'
);

PREPARE hvsi_stmt FROM @sync_stream_column_sql;
EXECUTE hvsi_stmt;
DEALLOCATE PREPARE hvsi_stmt;

UPDATE `knowledgeConnectorSyncs` s
INNER JOIN `knowledgeConnectors` c ON c.`id` = s.`connectorId`
SET s.`streamId` = c.`streamId`
WHERE s.`streamId` IS NULL OR s.`streamId` = '';

ALTER TABLE `knowledgeConnectorSyncs`
  MODIFY COLUMN `streamId` varchar(64) NOT NULL;

SET @sync_stream_index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'knowledgeConnectorSyncs'
    AND INDEX_NAME = 'idx_syncs_stream'
);

SET @sync_stream_index_sql = IF(
  @sync_stream_index_exists = 0,
  'CREATE INDEX `idx_syncs_stream` ON `knowledgeConnectorSyncs` (`streamId`)',
  'SELECT 1'
);

PREPARE hvsi_stmt FROM @sync_stream_index_sql;
EXECUTE hvsi_stmt;
DEALLOCATE PREPARE hvsi_stmt;
