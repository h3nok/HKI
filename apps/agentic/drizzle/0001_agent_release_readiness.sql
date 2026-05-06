CREATE TABLE `knowledgeAgentEvalRuns` (
  `id` varchar(64) NOT NULL,
  `valueStreamId` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `createdBy` int NOT NULL,
  `suiteName` varchar(128) NOT NULL,
  `status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
  `totalCases` int NOT NULL DEFAULT 0,
  `passedCases` int NOT NULL DEFAULT 0,
  `passRate` int NOT NULL DEFAULT 0,
  `averageConfidence` int NOT NULL DEFAULT 0,
  `averageGuardrailScore` int NOT NULL DEFAULT 0,
  `averageTraceSteps` int NOT NULL DEFAULT 0,
  `passed` tinyint NOT NULL DEFAULT 0,
  `results` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` timestamp NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_agent_eval_stream`
    FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_agent_eval_user`
    FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
);

CREATE INDEX `idx_agent_eval_stream`
  ON `knowledgeAgentEvalRuns` (`valueStreamId`);
CREATE INDEX `idx_agent_eval_org`
  ON `knowledgeAgentEvalRuns` (`orgId`);
CREATE INDEX `idx_agent_eval_status`
  ON `knowledgeAgentEvalRuns` (`status`);
CREATE INDEX `idx_agent_eval_time`
  ON `knowledgeAgentEvalRuns` (`valueStreamId`, `createdAt`);

CREATE TABLE `knowledgeReleases` (
  `id` varchar(64) NOT NULL,
  `valueStreamId` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `createdBy` int NOT NULL,
  `label` varchar(128) NOT NULL,
  `notes` text NULL,
  `status` enum('candidate','promoted','superseded','rolled_back') NOT NULL DEFAULT 'candidate',
  `basedOnEvalRunId` varchar(64) NULL,
  `snapshot` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `promotedAt` timestamp NULL,
  `rolledBackAt` timestamp NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_kb_release_stream`
    FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_kb_release_user`
    FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_kb_release_eval`
    FOREIGN KEY (`basedOnEvalRunId`) REFERENCES `knowledgeAgentEvalRuns`(`id`)
    ON DELETE SET NULL
);

CREATE INDEX `idx_kb_releases_stream`
  ON `knowledgeReleases` (`valueStreamId`);
CREATE INDEX `idx_kb_releases_org`
  ON `knowledgeReleases` (`orgId`);
CREATE INDEX `idx_kb_releases_status`
  ON `knowledgeReleases` (`status`);
CREATE INDEX `idx_kb_releases_time`
  ON `knowledgeReleases` (`valueStreamId`, `createdAt`);
