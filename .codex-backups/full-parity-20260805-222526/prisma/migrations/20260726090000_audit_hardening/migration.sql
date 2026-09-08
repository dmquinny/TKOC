-- Resolve legacy duplicates deterministically before adding invariant indexes.
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

UPDATE `Province` p
JOIN `Province` keeper
  ON p.`provinceName` = keeper.`provinceName`
 AND p.`provinceName` IS NOT NULL
 AND p.`pID` > keeper.`pID`
SET p.`provinceName` = LEFT(CONCAT(LEFT(p.`provinceName`, 28), ' #', p.`pID`), 40);

DELETE later_order
FROM `ResearchOrder` later_order
JOIN `ResearchOrder` keeper
  ON later_order.`pID` = keeper.`pID`
 AND later_order.`id` > keeper.`id`;

ALTER TABLE `User`
  ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0,
  ADD UNIQUE INDEX `User_username_key` (`username`),
  ADD UNIQUE INDEX `User_email_key` (`email`);

ALTER TABLE `Province`
  ADD COLUMN `status` VARCHAR(12) NOT NULL DEFAULT 'Alive',
  ADD COLUMN `attackPressure` INTEGER NOT NULL DEFAULT 0,
  ADD UNIQUE INDEX `Province_provinceName_key` (`provinceName`);

CREATE UNIQUE INDEX `ResearchOrder_pID_key` ON `ResearchOrder` (`pID`);
DROP INDEX `ResearchOrder_pID_scID_key` ON `ResearchOrder`;
CREATE INDEX `ResearchOrder_pID_scID_idx` ON `ResearchOrder` (`pID`, `scID`);

ALTER TABLE `Kingdom` MODIFY `password` VARCHAR(255) NULL;
UPDATE `Kingdom` kingdom_row
JOIN `Kingdom` keeper
  ON kingdom_row.`name` = keeper.`name`
 AND kingdom_row.`name` IS NOT NULL
 AND kingdom_row.`kiID` > keeper.`kiID`
SET kingdom_row.`name` = LEFT(CONCAT(LEFT(kingdom_row.`name`, 28), ' #', kingdom_row.`kiID`), 40);
ALTER TABLE `Kingdom` ADD UNIQUE INDEX `Kingdom_name_key` (`name`);

ALTER TABLE `KingdomRelation`
  ADD COLUMN `initiatorKiId` INTEGER NULL;
UPDATE `KingdomRelation` SET `initiatorKiId` = `fromKiId`;
UPDATE `KingdomRelation`
SET `fromKiId` = LEAST(`initiatorKiId`, `toKiId`),
    `toKiId` = GREATEST(`initiatorKiId`, `toKiId`);
DELETE later_relation
FROM `KingdomRelation` later_relation
JOIN `KingdomRelation` keeper
  ON later_relation.`fromKiId` = keeper.`fromKiId`
 AND later_relation.`toKiId` = keeper.`toKiId`
 AND later_relation.`id` > keeper.`id`;
ALTER TABLE `KingdomRelation`
  MODIFY `initiatorKiId` INTEGER NOT NULL,
  ADD UNIQUE INDEX `KingdomRelation_fromKiId_toKiId_key` (`fromKiId`, `toKiId`);

CREATE TABLE `RateLimitBucket` (
  `key` VARCHAR(191) NOT NULL,
  `windowStart` DATETIME(3) NOT NULL,
  `count` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

ALTER TABLE `Province`
  ADD CONSTRAINT `Province_mana_nonnegative` CHECK (`mana` IS NULL OR `mana` >= 0),
  ADD CONSTRAINT `Province_influence_nonnegative` CHECK (`influence` IS NULL OR `influence` >= 0),
  ADD CONSTRAINT `Province_acres_nonnegative` CHECK (`acres` IS NULL OR `acres` >= 0),
  ADD CONSTRAINT `Province_peasants_nonnegative` CHECK (`peasants` IS NULL OR `peasants` >= 0),
  ADD CONSTRAINT `Province_gold_nonnegative` CHECK (`gold` IS NULL OR `gold` >= 0),
  ADD CONSTRAINT `Province_food_nonnegative` CHECK (`food` IS NULL OR `food` >= 0),
  ADD CONSTRAINT `Province_metal_nonnegative` CHECK (`metal` IS NULL OR `metal` >= 0),
  ADD CONSTRAINT `Province_morale_nonnegative` CHECK (`morale` IS NULL OR `morale` >= 0);
ALTER TABLE `Military`
  ADD CONSTRAINT `Military_num_nonnegative` CHECK (`num` >= 0);
ALTER TABLE `Province`
  ADD CONSTRAINT `Province_attackPressure_nonnegative` CHECK (`attackPressure` >= 0);
