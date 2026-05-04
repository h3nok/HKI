-- Migration 0023: feature flag overrides
-- Purpose: store org-scoped admin overrides for client-visible feature flags.

CREATE TABLE IF NOT EXISTS `featureFlagOverrides` (
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `featureKey` varchar(128) NOT NULL,
  `enabled` tinyint NOT NULL,
  `updatedBy` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`orgId`, `featureKey`),
  KEY `idx_featureFlagOverrides_featureKey` (`featureKey`),
  KEY `idx_featureFlagOverrides_updatedBy` (`updatedBy`),
  CONSTRAINT `fk_featureFlagOverrides_updatedBy`
    FOREIGN KEY (`updatedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
