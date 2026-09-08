-- Restore the original TKOC basic recruit and new-province protection values.
INSERT INTO `MilitaryT` (`className`, `costGold`, `costMetal`, `attack`, `defense`)
VALUES ('Recruits', 200, 0, 1, 1)
ON DUPLICATE KEY UPDATE
  `costGold` = VALUES(`costGold`),
  `costMetal` = VALUES(`costMetal`),
  `attack` = VALUES(`attack`),
  `defense` = VALUES(`defense`);

ALTER TABLE `Province`
  MODIFY COLUMN `protection` INTEGER NULL DEFAULT 50;
