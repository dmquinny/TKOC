-- Restore the original TKOC building catalogue while preserving existing provinces.

START TRANSACTION;

-- Gold Mines become the original combined Mine.
SET @mine_id = (
  SELECT `bID` FROM `BuildingT`
  WHERE `className` IN ('Mine', 'Gold Mines')
  ORDER BY (`className` = 'Mine') DESC
  LIMIT 1
);
UPDATE `BuildingT`
SET `className` = 'Mine'
WHERE `className` = 'Gold Mines'
  AND NOT EXISTS (
    SELECT 1 FROM (SELECT `className` FROM `BuildingT`) AS existing
    WHERE existing.`className` = 'Mine'
  );

-- Merge old Metal Mines into Mine without losing built or queued structures.
SET @metal_mine_id = (SELECT `bID` FROM `BuildingT` WHERE `className` = 'Metal Mines' LIMIT 1);

-- Provinces which already have both types receive the sum in their Mine row.
UPDATE `Buildings` AS target
INNER JOIN `Buildings` AS source
  ON source.`pID` = target.`pID`
  AND source.`bID` = @metal_mine_id
SET target.`num` = target.`num` + source.`num`
WHERE target.`bID` = @mine_id
  AND @mine_id IS NOT NULL
  AND @metal_mine_id IS NOT NULL;

-- Provinces which only have Metal Mines receive a new Mine row.
INSERT INTO `Buildings` (`bID`, `pID`, `num`)
SELECT @mine_id, source.`pID`, source.`num`
FROM `Buildings` AS source
WHERE source.`bID` = @metal_mine_id
  AND @mine_id IS NOT NULL
  AND @metal_mine_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `Buildings` AS target
    WHERE target.`pID` = source.`pID`
      AND target.`bID` = @mine_id
  );
DELETE FROM `Buildings` WHERE `bID` = @metal_mine_id;
UPDATE `BuildOrder` SET `bID` = @mine_id WHERE `bID` = @metal_mine_id AND @mine_id IS NOT NULL;
DELETE FROM `BuildingT` WHERE `bID` = @metal_mine_id;

UPDATE `BuildingT` SET `className` = 'Farm' WHERE `className` = 'Farms';
UPDATE `BuildingT` SET `className` = 'Home' WHERE `className` = 'Town Homes';
UPDATE `BuildingT` SET `className` = 'Barrack' WHERE `className` = 'Barracks';
UPDATE `BuildingT` SET `className` = 'Wall' WHERE `className` = 'Guard Towers';
UPDATE `BuildingT` SET `className` = 'Wizard Tower' WHERE `className` = 'Wizard Towers';
UPDATE `BuildingT` SET `className` = 'Temple' WHERE `className` = 'Temples';
UPDATE `BuildingT` SET `className` = 'Beast den' WHERE `className` = 'Beast Dens';

INSERT INTO `BuildingT` (`className`, `costGold`, `costMetal`, `buildTicks`) VALUES
  ('Barrack', 750, 50, 10),
  ('Beast den', 2000, 150, 20),
  ('Blacksmith', 1000, 500, 24),
  ('Crypt', 1500, 0, 20),
  ('Dock', 1500, 1500, 20),
  ('Farm', 1000, 0, 10),
  ('Home', 1000, 0, 10),
  ('Inn', 750, 50, 20),
  ('Marketplace', 2200, 250, 20),
  ('Mine', 1500, 0, 15),
  ('Stable', 2000, 150, 20),
  ('Temple', 1500, 0, 20),
  ('Wall', 200, 250, 20),
  ('Wizard Tower', 750, 0, 20)
ON DUPLICATE KEY UPDATE
  `costGold` = VALUES(`costGold`),
  `costMetal` = VALUES(`costMetal`),
  `buildTicks` = VALUES(`buildTicks`);

-- Architecture is the original construction science: one discovery, 30% faster builds.
INSERT INTO `ScienceT`
  (`name`, `effect`, `costGold`, `bonusPerLevel`, `maxLevel`, `researchTicks`, `description`)
VALUES
  ('Architecture', 'buildTime', 3000000, 30, 1, 36, 'Reduces construction time by 30%.')
ON DUPLICATE KEY UPDATE
  `effect` = VALUES(`effect`),
  `costGold` = VALUES(`costGold`),
  `bonusPerLevel` = VALUES(`bonusPerLevel`),
  `maxLevel` = VALUES(`maxLevel`),
  `researchTicks` = VALUES(`researchTicks`),
  `description` = VALUES(`description`);

COMMIT;
