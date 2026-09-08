-- Reconcile installations where 20260726090000 was manually resolved after
-- MySQL committed only part of its DDL. Conditional ALTERs use prepared SQL so
-- this remains compatible with MySQL versions without ADD ... IF NOT EXISTS.

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'sessionVersion'
  ),
  'SELECT 1',
  'ALTER TABLE `User` ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

UPDATE `User` u
JOIN `User` keeper
  ON u.`username` = keeper.`username`
 AND u.`username` IS NOT NULL
 AND u.`userID` > keeper.`userID`
SET u.`username` = LEFT(CONCAT(LEFT(u.`username`, 8), '_', u.`userID`), 16);
UPDATE `User` u
JOIN `User` keeper
  ON u.`email` = keeper.`email`
 AND u.`email` IS NOT NULL
 AND u.`userID` > keeper.`userID`
SET u.`email` = CONCAT('duplicate-', u.`userID`, '@invalid.local');

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND INDEX_NAME = 'User_username_key'
  ),
  'SELECT 1',
  'ALTER TABLE `User` ADD UNIQUE INDEX `User_username_key` (`username`)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND INDEX_NAME = 'User_email_key'
  ),
  'SELECT 1',
  'ALTER TABLE `User` ADD UNIQUE INDEX `User_email_key` (`email`)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Province' AND COLUMN_NAME = 'status'
  ),
  'SELECT 1',
  'ALTER TABLE `Province` ADD COLUMN `status` VARCHAR(12) NOT NULL DEFAULT ''Alive'''
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Province' AND COLUMN_NAME = 'attackPressure'
  ),
  'SELECT 1',
  'ALTER TABLE `Province` ADD COLUMN `attackPressure` INTEGER NOT NULL DEFAULT 0'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

UPDATE `Province` p
JOIN `Province` keeper
  ON p.`provinceName` = keeper.`provinceName`
 AND p.`provinceName` IS NOT NULL
 AND p.`pID` > keeper.`pID`
SET p.`provinceName` = LEFT(CONCAT(LEFT(p.`provinceName`, 28), ' #', p.`pID`), 40);

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Province' AND INDEX_NAME = 'Province_provinceName_key'
  ),
  'SELECT 1',
  'ALTER TABLE `Province` ADD UNIQUE INDEX `Province_provinceName_key` (`provinceName`)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

DELETE later_order
FROM `ResearchOrder` later_order
JOIN `ResearchOrder` keeper
  ON later_order.`pID` = keeper.`pID`
 AND later_order.`id` > keeper.`id`;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ResearchOrder' AND INDEX_NAME = 'ResearchOrder_pID_key'
  ),
  'SELECT 1',
  'ALTER TABLE `ResearchOrder` ADD UNIQUE INDEX `ResearchOrder_pID_key` (`pID`)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ResearchOrder' AND INDEX_NAME = 'ResearchOrder_pID_scID_key'
  ),
  'ALTER TABLE `ResearchOrder` DROP INDEX `ResearchOrder_pID_scID_key`',
  'SELECT 1'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ResearchOrder' AND INDEX_NAME = 'ResearchOrder_pID_scID_idx'
  ),
  'SELECT 1',
  'ALTER TABLE `ResearchOrder` ADD INDEX `ResearchOrder_pID_scID_idx` (`pID`, `scID`)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

ALTER TABLE `Kingdom` MODIFY `password` VARCHAR(255) NULL;
UPDATE `Kingdom` kingdom_row
JOIN `Kingdom` keeper
  ON kingdom_row.`name` = keeper.`name`
 AND kingdom_row.`name` IS NOT NULL
 AND kingdom_row.`kiID` > keeper.`kiID`
SET kingdom_row.`name` = LEFT(CONCAT(LEFT(kingdom_row.`name`, 28), ' #', kingdom_row.`kiID`), 40);

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Kingdom' AND INDEX_NAME = 'Kingdom_name_key'
  ),
  'SELECT 1',
  'ALTER TABLE `Kingdom` ADD UNIQUE INDEX `Kingdom_name_key` (`name`)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'KingdomRelation' AND COLUMN_NAME = 'initiatorKiId'
  ),
  'SELECT 1',
  'ALTER TABLE `KingdomRelation` ADD COLUMN `initiatorKiId` INTEGER NULL'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

UPDATE `KingdomRelation`
SET `initiatorKiId` = COALESCE(`initiatorKiId`, `fromKiId`);
UPDATE `KingdomRelation`
SET `fromKiId` = LEAST(`initiatorKiId`, `toKiId`),
    `toKiId` = GREATEST(`initiatorKiId`, `toKiId`);
DELETE later_relation
FROM `KingdomRelation` later_relation
JOIN `KingdomRelation` keeper
  ON later_relation.`fromKiId` = keeper.`fromKiId`
 AND later_relation.`toKiId` = keeper.`toKiId`
 AND later_relation.`id` > keeper.`id`;
ALTER TABLE `KingdomRelation` MODIFY `initiatorKiId` INTEGER NOT NULL;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'KingdomRelation'
      AND INDEX_NAME = 'KingdomRelation_fromKiId_toKiId_key'
  ),
  'SELECT 1',
  'ALTER TABLE `KingdomRelation` ADD UNIQUE INDEX `KingdomRelation_fromKiId_toKiId_key` (`fromKiId`, `toKiId`)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

CREATE TABLE IF NOT EXISTS `RateLimitBucket` (
  `key` VARCHAR(191) NOT NULL,
  `windowStart` DATETIME(3) NOT NULL,
  `count` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `OperationalEvent` (
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

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'OperationalEvent'
      AND INDEX_NAME = 'OperationalEvent_createdAt_idx'
  ),
  'SELECT 1',
  'ALTER TABLE `OperationalEvent` ADD INDEX `OperationalEvent_createdAt_idx` (`createdAt`)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'OperationalEvent'
      AND INDEX_NAME = 'OperationalEvent_kind_createdAt_idx'
  ),
  'SELECT 1',
  'ALTER TABLE `OperationalEvent` ADD INDEX `OperationalEvent_kind_createdAt_idx` (`kind`, `createdAt`)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'OperationalEvent'
      AND INDEX_NAME = 'OperationalEvent_severity_createdAt_idx'
  ),
  'SELECT 1',
  'ALTER TABLE `OperationalEvent` ADD INDEX `OperationalEvent_severity_createdAt_idx` (`severity`, `createdAt`)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

UPDATE `Province` SET
  `mana` = GREATEST(0, COALESCE(`mana`, 0)),
  `influence` = GREATEST(0, COALESCE(`influence`, 0)),
  `acres` = GREATEST(0, COALESCE(`acres`, 0)),
  `peasants` = GREATEST(0, COALESCE(`peasants`, 0)),
  `gold` = GREATEST(0, COALESCE(`gold`, 0)),
  `food` = GREATEST(0, COALESCE(`food`, 0)),
  `metal` = GREATEST(0, COALESCE(`metal`, 0)),
  `morale` = GREATEST(0, COALESCE(`morale`, 0)),
  `attackPressure` = GREATEST(0, COALESCE(`attackPressure`, 0));
UPDATE `Military` SET `num` = GREATEST(0, `num`);

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'Province'
      AND CONSTRAINT_NAME = 'Province_mana_nonnegative'
  ),
  'SELECT 1',
  'ALTER TABLE `Province` ADD CONSTRAINT `Province_mana_nonnegative` CHECK (`mana` IS NULL OR `mana` >= 0)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'Province'
      AND CONSTRAINT_NAME = 'Province_influence_nonnegative'
  ),
  'SELECT 1',
  'ALTER TABLE `Province` ADD CONSTRAINT `Province_influence_nonnegative` CHECK (`influence` IS NULL OR `influence` >= 0)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'Province'
      AND CONSTRAINT_NAME = 'Province_acres_nonnegative'
  ),
  'SELECT 1',
  'ALTER TABLE `Province` ADD CONSTRAINT `Province_acres_nonnegative` CHECK (`acres` IS NULL OR `acres` >= 0)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'Province'
      AND CONSTRAINT_NAME = 'Province_peasants_nonnegative'
  ),
  'SELECT 1',
  'ALTER TABLE `Province` ADD CONSTRAINT `Province_peasants_nonnegative` CHECK (`peasants` IS NULL OR `peasants` >= 0)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'Province'
      AND CONSTRAINT_NAME = 'Province_gold_nonnegative'
  ),
  'SELECT 1',
  'ALTER TABLE `Province` ADD CONSTRAINT `Province_gold_nonnegative` CHECK (`gold` IS NULL OR `gold` >= 0)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'Province'
      AND CONSTRAINT_NAME = 'Province_food_nonnegative'
  ),
  'SELECT 1',
  'ALTER TABLE `Province` ADD CONSTRAINT `Province_food_nonnegative` CHECK (`food` IS NULL OR `food` >= 0)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'Province'
      AND CONSTRAINT_NAME = 'Province_metal_nonnegative'
  ),
  'SELECT 1',
  'ALTER TABLE `Province` ADD CONSTRAINT `Province_metal_nonnegative` CHECK (`metal` IS NULL OR `metal` >= 0)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'Province'
      AND CONSTRAINT_NAME = 'Province_morale_nonnegative'
  ),
  'SELECT 1',
  'ALTER TABLE `Province` ADD CONSTRAINT `Province_morale_nonnegative` CHECK (`morale` IS NULL OR `morale` >= 0)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'Province'
      AND CONSTRAINT_NAME = 'Province_attackPressure_nonnegative'
  ),
  'SELECT 1',
  'ALTER TABLE `Province` ADD CONSTRAINT `Province_attackPressure_nonnegative` CHECK (`attackPressure` >= 0)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'Military'
      AND CONSTRAINT_NAME = 'Military_num_nonnegative'
  ),
  'SELECT 1',
  'ALTER TABLE `Military` ADD CONSTRAINT `Military_num_nonnegative` CHECK (`num` >= 0)'
);
PREPARE reconcile_stmt FROM @ddl;
EXECUTE reconcile_stmt;
DEALLOCATE PREPARE reconcile_stmt;
