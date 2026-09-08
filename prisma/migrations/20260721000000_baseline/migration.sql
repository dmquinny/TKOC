-- CreateTable
CREATE TABLE `User` (
    `userID` INTEGER NOT NULL AUTO_INCREMENT,
    `password` VARCHAR(255) NULL,
    `username` VARCHAR(16) NULL,
    `name` VARCHAR(80) NULL,
    `email` VARCHAR(100) NULL,
    `dob` DATE NOT NULL,
    `country` VARCHAR(40) NULL,
    `pID` INTEGER NOT NULL DEFAULT 0,
    `created` DATE NOT NULL,
    `history` TEXT NULL,
    `activeSessions` INTEGER NULL DEFAULT 0,
    `access` INTEGER NULL DEFAULT 3,
    `nick` VARCHAR(90) NULL,
    `signature` TEXT NULL,
    `image` VARCHAR(255) NULL,
    `status` VARCHAR(12) NULL DEFAULT 'Active',
    `regIp` VARCHAR(45) NULL,

    PRIMARY KEY (`userID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Province` (
    `pID` INTEGER NOT NULL AUTO_INCREMENT,
    `provinceName` VARCHAR(40) NULL,
    `rulerName` VARCHAR(40) NULL,
    `gender` CHAR(1) NULL DEFAULT 'M',
    `mana` INTEGER NULL DEFAULT 100,
    `influence` INTEGER NULL DEFAULT 100,
    `acres` INTEGER NULL DEFAULT 300,
    `peasants` INTEGER NULL DEFAULT 1400,
    `gold` INTEGER NULL DEFAULT 280000,
    `food` INTEGER NULL DEFAULT 40000,
    `metal` INTEGER NULL DEFAULT 5000,
    `spID` INTEGER NOT NULL DEFAULT 0,
    `kiID` INTEGER NOT NULL DEFAULT 0,
    `networth` INTEGER NULL,
    `incomeChange` INTEGER NULL DEFAULT 0,
    `incomeTotal` INTEGER NULL DEFAULT 0,
    `peasantChange` INTEGER NULL DEFAULT 0,
    `peasantTotal` INTEGER NULL DEFAULT 0,
    `foodChange` INTEGER NULL DEFAULT 0,
    `foodTotal` INTEGER NULL DEFAULT 0,
    `raceId` INTEGER NULL DEFAULT 0,
    `morale` INTEGER NULL DEFAULT 100,
    `protection` INTEGER NULL DEFAULT 48,
    `vacation` BOOLEAN NOT NULL DEFAULT false,
    `vacationTicks` INTEGER NOT NULL DEFAULT 0,
    `voteFor` INTEGER NULL DEFAULT 0,
    `councilId` INTEGER NULL DEFAULT 0,
    `aidSentTick` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`pID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Race` (
    `rID` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(40) NOT NULL,
    `offenseBonus` INTEGER NOT NULL DEFAULT 100,
    `defenseBonus` INTEGER NOT NULL DEFAULT 100,
    `incomeBonus` INTEGER NOT NULL DEFAULT 100,
    `magicBonus` INTEGER NOT NULL DEFAULT 100,
    `foodUpkeep` INTEGER NOT NULL DEFAULT 100,
    `description` TEXT NULL,

    UNIQUE INDEX `Race_name_key`(`name`),
    PRIMARY KEY (`rID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScienceT` (
    `scID` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(60) NOT NULL,
    `effect` VARCHAR(40) NOT NULL,
    `costGold` INTEGER NOT NULL DEFAULT 5000,
    `bonusPerLevel` INTEGER NOT NULL DEFAULT 3,
    `maxLevel` INTEGER NOT NULL DEFAULT 10,
    `description` TEXT NULL,

    UNIQUE INDEX `ScienceT_name_key`(`name`),
    PRIMARY KEY (`scID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Science` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pID` INTEGER NOT NULL,
    `scID` INTEGER NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Science_pID_scID_key`(`pID`, `scID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExploreOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pID` INTEGER NOT NULL,
    `acres` INTEGER NOT NULL,
    `ticksLeft` INTEGER NOT NULL DEFAULT 3,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `News` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pID` INTEGER NOT NULL,
    `message` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `News_pID_idx`(`pID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scope` VARCHAR(10) NOT NULL,
    `kiID` INTEGER NOT NULL DEFAULT 0,
    `pID` INTEGER NOT NULL,
    `author` VARCHAR(40) NOT NULL,
    `message` VARCHAR(280) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatMessage_scope_kiID_id_idx`(`scope`, `kiID`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fromPID` INTEGER NOT NULL,
    `toPID` INTEGER NOT NULL,
    `fromName` VARCHAR(40) NOT NULL,
    `subject` VARCHAR(120) NOT NULL,
    `body` TEXT NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_toPID_id_idx`(`toPID`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameState` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `tick` INTEGER NOT NULL DEFAULT 0,
    `season` VARCHAR(10) NOT NULL DEFAULT 'Spring',
    `age` INTEGER NOT NULL DEFAULT 1,
    `phase` VARCHAR(12) NOT NULL DEFAULT 'Running',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Advisor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(40) NOT NULL,
    `title` VARCHAR(60) NOT NULL,
    `effect` VARCHAR(20) NOT NULL,
    `bonus` INTEGER NOT NULL DEFAULT 10,
    `description` TEXT NULL,

    UNIQUE INDEX `Advisor_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KingdomRelation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fromKiId` INTEGER NOT NULL,
    `toKiId` INTEGER NOT NULL,
    `type` VARCHAR(5) NOT NULL,
    `status` VARCHAR(8) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KingdomRelation_fromKiId_idx`(`fromKiId`),
    INDEX `KingdomRelation_toKiId_idx`(`toKiId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Effect` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pID` INTEGER NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `magnitude` INTEGER NOT NULL DEFAULT 0,
    `ticksLeft` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Effect_pID_idx`(`pID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgeResult` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `age` INTEGER NOT NULL,
    `rank` INTEGER NOT NULL,
    `provinceName` VARCHAR(40) NOT NULL,
    `rulerName` VARCHAR(40) NOT NULL,
    `networth` INTEGER NOT NULL,
    `kingdomName` VARCHAR(40) NULL,

    INDEX `AgeResult_age_idx`(`age`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Kingdom` (
    `kiID` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(40) NULL,
    `king` INTEGER NOT NULL DEFAULT 0,
    `password` VARCHAR(20) NULL,
    `banner` VARCHAR(100) NULL,
    `signature` VARCHAR(100) NULL,
    `numProvinces` INTEGER NOT NULL DEFAULT 0,
    `relationWar` INTEGER NULL DEFAULT 0,
    `relationAlly` INTEGER NULL DEFAULT 0,
    `relationMerge` VARCHAR(10) NULL DEFAULT 'false',
    `relationWarTick` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`kiID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BuildingT` (
    `bID` INTEGER NOT NULL AUTO_INCREMENT,
    `className` VARCHAR(100) NULL,
    `costGold` INTEGER NOT NULL DEFAULT 1000,
    `costMetal` INTEGER NOT NULL DEFAULT 100,

    UNIQUE INDEX `BuildingT_className_key`(`className`),
    PRIMARY KEY (`bID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Buildings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bID` INTEGER NOT NULL,
    `pID` INTEGER NOT NULL,
    `num` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Buildings_pID_bID_key`(`pID`, `bID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MilitaryT` (
    `mID` INTEGER NOT NULL AUTO_INCREMENT,
    `className` VARCHAR(100) NULL,
    `costGold` INTEGER NOT NULL DEFAULT 100,
    `costMetal` INTEGER NOT NULL DEFAULT 50,
    `attack` INTEGER NOT NULL DEFAULT 1,
    `defense` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `MilitaryT_className_key`(`className`),
    PRIMARY KEY (`mID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Military` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pID` INTEGER NOT NULL,
    `mID` INTEGER NOT NULL,
    `num` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Military_pID_mID_key`(`pID`, `mID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attack` (
    `attackID` INTEGER NOT NULL AUTO_INCREMENT,
    `pID` INTEGER NOT NULL,
    `targetID` INTEGER NOT NULL,
    `attackType` INTEGER NOT NULL DEFAULT 0,
    `totick` INTEGER NOT NULL DEFAULT 3,
    `staytick` INTEGER NOT NULL DEFAULT 0,
    `backtick` INTEGER NOT NULL DEFAULT 0,
    `acres` INTEGER NOT NULL DEFAULT 0,
    `gold` INTEGER NOT NULL DEFAULT 0,
    `metal` INTEGER NOT NULL DEFAULT 0,
    `food` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`attackID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Army` (
    `armyID` INTEGER NOT NULL AUTO_INCREMENT,
    `pID` INTEGER NOT NULL,
    `AttackID` INTEGER NOT NULL,
    `mID` INTEGER NOT NULL,
    `num` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`armyID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Science` ADD CONSTRAINT `Science_pID_fkey` FOREIGN KEY (`pID`) REFERENCES `Province`(`pID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Science` ADD CONSTRAINT `Science_scID_fkey` FOREIGN KEY (`scID`) REFERENCES `ScienceT`(`scID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExploreOrder` ADD CONSTRAINT `ExploreOrder_pID_fkey` FOREIGN KEY (`pID`) REFERENCES `Province`(`pID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `News` ADD CONSTRAINT `News_pID_fkey` FOREIGN KEY (`pID`) REFERENCES `Province`(`pID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Effect` ADD CONSTRAINT `Effect_pID_fkey` FOREIGN KEY (`pID`) REFERENCES `Province`(`pID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Buildings` ADD CONSTRAINT `Buildings_pID_fkey` FOREIGN KEY (`pID`) REFERENCES `Province`(`pID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Buildings` ADD CONSTRAINT `Buildings_bID_fkey` FOREIGN KEY (`bID`) REFERENCES `BuildingT`(`bID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Military` ADD CONSTRAINT `Military_pID_fkey` FOREIGN KEY (`pID`) REFERENCES `Province`(`pID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Military` ADD CONSTRAINT `Military_mID_fkey` FOREIGN KEY (`mID`) REFERENCES `MilitaryT`(`mID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attack` ADD CONSTRAINT `Attack_pID_fkey` FOREIGN KEY (`pID`) REFERENCES `Province`(`pID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attack` ADD CONSTRAINT `Attack_targetID_fkey` FOREIGN KEY (`targetID`) REFERENCES `Province`(`pID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Army` ADD CONSTRAINT `Army_AttackID_fkey` FOREIGN KEY (`AttackID`) REFERENCES `Attack`(`attackID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Army` ADD CONSTRAINT `Army_mID_fkey` FOREIGN KEY (`mID`) REFERENCES `MilitaryT`(`mID`) ON DELETE RESTRICT ON UPDATE CASCADE;
