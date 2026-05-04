-- Self-service billing columns for per-value-stream LLM key + token quotas
ALTER TABLE `valueStreams` ADD COLUMN `llmApiKey` text;
ALTER TABLE `valueStreams` ADD COLUMN `monthlyTokenBudget` int;
ALTER TABLE `valueStreams` ADD COLUMN `monthlyTokenUsed` int DEFAULT 0;
ALTER TABLE `valueStreams` ADD COLUMN `billingPeriod` varchar(7);
