-- AlterTable: per-item construction / training / research times (faithful to the original game)
ALTER TABLE `BuildingT` ADD COLUMN `buildTicks` INTEGER NOT NULL DEFAULT 10;
ALTER TABLE `MilitaryT` ADD COLUMN `trainTicks` INTEGER NOT NULL DEFAULT 12;
ALTER TABLE `ScienceT` ADD COLUMN `researchTicks` INTEGER NOT NULL DEFAULT 4;

-- CreateTable: military training queue (per original ProgressMil)
CREATE TABLE `MilitaryOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pID` INTEGER NOT NULL,
    `mID` INTEGER NOT NULL,
    `num` INTEGER NOT NULL,
    `ticksLeft` INTEGER NOT NULL DEFAULT 12,

    INDEX `MilitaryOrder_pID_idx`(`pID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MilitaryOrder` ADD CONSTRAINT `MilitaryOrder_pID_fkey` FOREIGN KEY (`pID`) REFERENCES `Province`(`pID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Per-building construction times (Home/Farm/Barrack 10, Mine 15, Wall/WizTower/Temple/BeastDen 20)
UPDATE `BuildingT` SET `buildTicks` = 10 WHERE `className` IN ('Farms', 'Town Homes', 'Barracks');
UPDATE `BuildingT` SET `buildTicks` = 15 WHERE `className` IN ('Gold Mines', 'Metal Mines');
UPDATE `BuildingT` SET `buildTicks` = 20 WHERE `className` IN ('Guard Towers', 'Wizard Towers', 'Temples', 'Beast Dens');

-- Per-unit training times (Recruits 12, line units 18, elites/special 24; Peasants are not trained)
UPDATE `MilitaryT` SET `trainTicks` = 0  WHERE `className` = 'Peasants';
UPDATE `MilitaryT` SET `trainTicks` = 12 WHERE `className` = 'Recruits';
UPDATE `MilitaryT` SET `trainTicks` = 18 WHERE `className` IN ('Swordsmen', 'Archers', 'Cavalry', 'Pikemen');
UPDATE `MilitaryT` SET `trainTicks` = 24 WHERE `className` IN ('Thieves', 'Wizards', 'Knights', 'Catapults', 'Dragons');

-- Per-science research times (faithful to the original ScienceBase tick values)
UPDATE `ScienceT` SET `researchTicks` = 24 WHERE `name` = 'Agriculture';
UPDATE `ScienceT` SET `researchTicks` = 36 WHERE `name` = 'Metallurgy';
UPDATE `ScienceT` SET `researchTicks` = 35 WHERE `name` = 'Warfare';
UPDATE `ScienceT` SET `researchTicks` = 28 WHERE `name` = 'Fortifications';
UPDATE `ScienceT` SET `researchTicks` = 24 WHERE `name` = 'Sorcery';
UPDATE `ScienceT` SET `researchTicks` = 30 WHERE `name` = 'Alchemy';
UPDATE `ScienceT` SET `researchTicks` = 30 WHERE `name` = 'Husbandry';
UPDATE `ScienceT` SET `researchTicks` = 40 WHERE `name` = 'Banking';
