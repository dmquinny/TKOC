ALTER TABLE `Advisor`
  ADD COLUMN `effect2` VARCHAR(20) NULL,
  ADD COLUMN `bonus2` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `costGold` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `races` VARCHAR(80) NOT NULL DEFAULT 'Human,Elf,Orc,Dwarf,Undead,Giant';

-- Upgrade the six placeholder advisors in an existing modern database in
-- place. Keeping their IDs preserves current Province.councilId references.
UPDATE `Advisor` SET
  `name` = 'Raistlin Jamere',
  `title` = 'Black Robe Mage',
  `effect` = 'defense',
  `bonus` = 5,
  `effect2` = 'magic',
  `bonus2` = 10,
  `costGold` = 1500000,
  `races` = 'Orc,Undead,Giant',
  `description` = 'Adds 5% defense and 10% magic power.'
WHERE `name` = 'Raistlin';

UPDATE `Advisor` SET
  `name` = 'Ungrim Ironfist',
  `title` = 'Dwarven Warlord',
  `effect` = 'morale',
  `bonus` = 10,
  `effect2` = NULL,
  `bonus2` = 0,
  `costGold` = 1500000,
  `races` = 'Human,Elf,Dwarf',
  `description` = 'Adds 10% effective morale.'
WHERE `name` = 'Ungrim';

UPDATE `Advisor` SET
  `title` = 'Legendary Champion',
  `effect` = 'morale',
  `bonus` = 5,
  `effect2` = 'thieveryDefense',
  `bonus2` = 10,
  `costGold` = 1500000,
  `races` = 'Orc,Undead,Giant',
  `description` = 'Adds 5% effective morale and 10% thievery defense.'
WHERE `name` = 'Goliath';

UPDATE `Advisor` SET
  `name` = 'Lady Alustriel',
  `title` = 'Elven Spellcaster',
  `effect` = 'magic',
  `bonus` = 10,
  `effect2` = 'magicProtection',
  `bonus2` = 10,
  `costGold` = 1500000,
  `races` = 'Human,Elf,Dwarf',
  `description` = 'Adds 10% magic power and 10% magic protection.'
WHERE `name` = 'Alustriel';

UPDATE `Advisor` SET
  `name` = 'Melangult the Shadow',
  `title` = 'Master Thief',
  `effect` = 'thieveryOffense',
  `bonus` = 25,
  `effect2` = 'thieveryLoss',
  `bonus2` = -30,
  `costGold` = 1500000,
  `races` = 'Human,Elf,Dwarf',
  `description` = 'Adds 25% thievery offense and reduces thief losses by 30%.'
WHERE `name` = 'Shadow';

UPDATE `Advisor` SET
  `name` = 'Arrk Maneater',
  `title` = 'Troll General',
  `effect` = 'offense',
  `bonus` = 8,
  `effect2` = NULL,
  `bonus2` = 0,
  `costGold` = 1500000,
  `races` = 'Orc,Undead,Giant',
  `description` = 'Adds 8% attack.'
WHERE `name` = 'Arrk';
