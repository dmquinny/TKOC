-- Persist the wall-clock schedule and an immutable audit row for each committed
-- game tick. A unique scheduledFor value is the idempotency key.
ALTER TABLE `GameState`
    ADD COLUMN `lastTickAt` DATETIME(3) NULL,
    ADD COLUMN `nextTickAt` DATETIME(3) NULL,
    ADD COLUMN `lastTickDurationMs` INTEGER NULL;

CREATE TABLE `TickRun` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `age` INTEGER NOT NULL,
    `tick` INTEGER NOT NULL,
    `scheduledFor` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `durationMs` INTEGER NOT NULL,
    `provincesUpdated` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `TickRun_scheduledFor_key`(`scheduledFor`),
    INDEX `TickRun_age_tick_idx`(`age`, `tick`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
