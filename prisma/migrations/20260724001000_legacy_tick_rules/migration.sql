-- Fields required by the original hourly server and race-specific military.
ALTER TABLE `Province`
  ADD COLUMN `aliveTicks` INTEGER NOT NULL DEFAULT 0 AFTER `protection`;

ALTER TABLE `MilitaryT`
  ADD COLUMN `costFood` INTEGER NOT NULL DEFAULT 0 AFTER `costMetal`,
  ADD COLUMN `displayName` VARCHAR(60) NULL AFTER `defense`,
  ADD COLUMN `raceName` VARCHAR(20) NULL AFTER `displayName`,
  ADD COLUMN `category` VARCHAR(20) NULL AFTER `raceName`;

ALTER TABLE `ScienceT`
  ADD COLUMN `costMetal` INTEGER NOT NULL DEFAULT 0 AFTER `costGold`,
  ADD COLUMN `className` VARCHAR(60) NULL AFTER `description`,
  ADD COLUMN `category` VARCHAR(20) NULL AFTER `className`,
  ADD COLUMN `reqMilitary` INTEGER NOT NULL DEFAULT 0 AFTER `category`,
  ADD COLUMN `reqInfrastructure` INTEGER NOT NULL DEFAULT 0 AFTER `reqMilitary`,
  ADD COLUMN `reqMagic` INTEGER NOT NULL DEFAULT 0 AFTER `reqInfrastructure`,
  ADD COLUMN `reqThievery` INTEGER NOT NULL DEFAULT 0 AFTER `reqMagic`,
  ADD COLUMN `givesMilitary` INTEGER NOT NULL DEFAULT 0 AFTER `reqThievery`,
  ADD COLUMN `givesInfrastructure` INTEGER NOT NULL DEFAULT 0 AFTER `givesMilitary`,
  ADD COLUMN `givesMagic` INTEGER NOT NULL DEFAULT 0 AFTER `givesInfrastructure`,
  ADD COLUMN `givesThievery` INTEGER NOT NULL DEFAULT 0 AFTER `givesMagic`,
  ADD UNIQUE INDEX `ScienceT_className_key` (`className`);
