-- Migration 0024: feature flag presets
-- Purpose: store org-scoped editable rollout presets for MVP and later phases.

CREATE TABLE IF NOT EXISTS `featureFlagPresets` (
  `id` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `sourceTemplateKey` varchar(64) DEFAULT NULL,
  `name` varchar(128) NOT NULL,
  `description` text,
  `overrides` text NOT NULL,
  `createdBy` int DEFAULT NULL,
  `updatedBy` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_featureFlagPresets_orgId` (`orgId`),
  KEY `idx_featureFlagPresets_sourceTemplateKey` (`sourceTemplateKey`),
  KEY `idx_featureFlagPresets_updatedBy` (`updatedBy`),
  CONSTRAINT `fk_featureFlagPresets_createdBy`
    FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_featureFlagPresets_updatedBy`
    FOREIGN KEY (`updatedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
