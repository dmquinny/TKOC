ALTER TABLE `OperationalEvent`
  ADD COLUMN `acknowledgedAt` DATETIME(3) NULL,
  ADD COLUMN `acknowledgedBy` INTEGER NULL;

CREATE INDEX `OperationalEvent_acknowledgedAt_createdAt_idx`
  ON `OperationalEvent` (`acknowledgedAt`, `createdAt`);
