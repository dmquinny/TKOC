-- CreateTable
CREATE TABLE `BuildOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pID` INTEGER NOT NULL,
    `bID` INTEGER NOT NULL,
    `num` INTEGER NOT NULL,
    `ticksLeft` INTEGER NOT NULL DEFAULT 4,

    INDEX `BuildOrder_pID_idx`(`pID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResearchOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pID` INTEGER NOT NULL,
    `scID` INTEGER NOT NULL,
    `ticksLeft` INTEGER NOT NULL DEFAULT 4,

    UNIQUE INDEX `ResearchOrder_pID_scID_key`(`pID`, `scID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BuildOrder` ADD CONSTRAINT `BuildOrder_pID_fkey` FOREIGN KEY (`pID`) REFERENCES `Province`(`pID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResearchOrder` ADD CONSTRAINT `ResearchOrder_pID_fkey` FOREIGN KEY (`pID`) REFERENCES `Province`(`pID`) ON DELETE RESTRICT ON UPDATE CASCADE;
