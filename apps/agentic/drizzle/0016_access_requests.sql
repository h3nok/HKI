CREATE TABLE IF NOT EXISTS `accessRequests` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `department` varchar(255) NOT NULL,
  `valueStream` varchar(255),
  `justification` text NOT NULL,
  `managerEmail` varchar(255),
  `status` enum('pending','approved','denied') NOT NULL DEFAULT 'pending',
  `reviewedBy` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `accessRequests_id` PRIMARY KEY(`id`)
);
