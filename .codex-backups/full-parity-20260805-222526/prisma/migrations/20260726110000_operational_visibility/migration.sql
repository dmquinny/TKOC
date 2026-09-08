CREATE TABLE `OperationalEvent` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `kind` VARCHAR(32) NOT NULL,
  `severity` VARCHAR(12) NOT NULL,
  `requestId` VARCHAR(64) NULL,
  `route` VARCHAR(120) NULL,
  `userId` INTEGER NULL,
  `pID` INTEGER NULL,
  `summary` VARCHAR(255) NOT NULL,
  `detail` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `OperationalEvent_createdAt_idx` (`createdAt`),
  INDEX `OperationalEvent_kind_createdAt_idx` (`kind`, `createdAt`),
  INDEX `OperationalEvent_severity_createdAt_idx` (`severity`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
