-- Networth rank tracking for rank movement in the rankings screen.
ALTER TABLE `Province`
  ADD COLUMN `rankNetworth` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `rankNetworthDay` INTEGER NOT NULL DEFAULT 0;

-- Persistent battle reports so both participants can review an attack.
CREATE TABLE `BattleReport` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `age` INTEGER NOT NULL,
  `tick` INTEGER NOT NULL,
  `attackerPID` INTEGER NOT NULL,
  `defenderPID` INTEGER NOT NULL,
  `attackerName` VARCHAR(40) NOT NULL,
  `defenderName` VARCHAR(40) NOT NULL,
  `attackerKiID` INTEGER NOT NULL DEFAULT 0,
  `defenderKiID` INTEGER NOT NULL DEFAULT 0,
  `attackType` INTEGER NOT NULL,
  `won` BOOLEAN NOT NULL,
  `attackPoints` INTEGER NOT NULL DEFAULT 0,
  `defensePoints` INTEGER NOT NULL DEFAULT 0,
  `attackerLost` INTEGER NOT NULL DEFAULT 0,
  `defenderLost` INTEGER NOT NULL DEFAULT 0,
  `acresSeized` INTEGER NOT NULL DEFAULT 0,
  `acresGained` INTEGER NOT NULL DEFAULT 0,
  `gold` INTEGER NOT NULL DEFAULT 0,
  `food` INTEGER NOT NULL DEFAULT 0,
  `metal` INTEGER NOT NULL DEFAULT 0,
  `buildingsLost` INTEGER NOT NULL DEFAULT 0,
  `moraleLoss` INTEGER NOT NULL DEFAULT 0,
  `returnTicks` INTEGER NOT NULL DEFAULT 0,
  `targetKilled` BOOLEAN NOT NULL DEFAULT false,
  `units` TEXT NULL,
  `attackerSeenAt` DATETIME(3) NULL,
  `defenderSeenAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `BattleReport_attackerPID_id_idx` (`attackerPID`, `id`),
  INDEX `BattleReport_defenderPID_id_idx` (`defenderPID`, `id`),
  INDEX `BattleReport_defenderPID_defenderSeenAt_idx` (`defenderPID`, `defenderSeenAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
