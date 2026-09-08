import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import * as dotenv from 'dotenv'
import { ORIGINAL_BUILDINGS } from '../src/lib/buildings'
import { ORIGINAL_MILITARY_TYPES } from '../src/lib/military'
import { ORIGINAL_SCIENCES } from '../src/lib/science'
dotenv.config()

const databaseUrl = process.env.DATABASE_URL?.replace(/^mysql:/, 'mariadb:');
if (!databaseUrl) throw new Error('DATABASE_URL environment variable must be set');
const adapter = new PrismaMariaDb(databaseUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding Building Types...')
  for (const building of ORIGINAL_BUILDINGS) {
    const data = {
      className: building.name,
      costGold: building.costGold,
      costMetal: building.costMetal,
      buildTicks: building.buildTicks,
    }
    await prisma.buildingType.upsert({ where: { className: building.name }, update: data, create: data })
  }

  console.log('Seeding Military Types...')
  for (const military of ORIGINAL_MILITARY_TYPES) {
    await prisma.militaryType.upsert({
      where: { className: military.className },
      update: military,
      create: military,
    })
  }

  console.log('Seeding Races...')
  const races = [
    { name: 'Human',  offenseBonus: 100, defenseBonus: 100, incomeBonus: 100, magicBonus: 100, foodUpkeep: 100, description: 'Faster construction and research, superior thievery, larger housing, and 110 influence.' },
    { name: 'Elf',    offenseBonus: 100, defenseBonus: 100, incomeBonus: 100, magicBonus: 120, foodUpkeep: 100, description: 'Superior magic, faster construction, slower growth, and 10% more food production.' },
    { name: 'Dwarf',  offenseBonus: 100, defenseBonus: 105, incomeBonus: 105, magicBonus: 100, foodUpkeep: 100, description: 'More gold, metal, housing and defense, but slower attacks.' },
    { name: 'Orc',    offenseBonus: 109, defenseBonus: 106, incomeBonus: 100, magicBonus: 100, foodUpkeep: 100, description: 'Stronger, faster attacks and extra morale, but slower research.' },
    { name: 'Giant',  offenseBonus: 115, defenseBonus: 115, incomeBonus: 100, magicBonus: 100, foodUpkeep: 100, description: 'Strong and fast in war, with less housing, growth and food production.' },
    { name: 'Undead', offenseBonus: 100, defenseBonus: 100, incomeBonus: 100, magicBonus: 120, foodUpkeep: 100, description: 'Superior magic, faster construction, slower research and 50% more food production.' },
  ]
  for (const r of races) {
    await prisma.race.upsert({ where: { name: r.name }, update: r, create: r })
  }

  console.log('Seeding Science Types...')
  for (const science of ORIGINAL_SCIENCES) {
    const { races: _races, hidden: _hidden, ...data } = science
    void _races
    void _hidden
    await prisma.scienceType.upsert({
      where: { name: science.name },
      update: data,
      create: data,
    })
  }

  console.log('Seeding Advisors...')
  const advisors = [
    { name: 'Lady Brienne', title: 'Basic Advisor', effect: 'none', bonus: 0, effect2: null, bonus2: 0, costGold: 0, races: 'Human,Elf,Orc,Dwarf,Undead,Giant', description: 'A loyal advisor available to every race.' },
    { name: 'Lady Alustriel', title: 'Elven Spellcaster', effect: 'magic', bonus: 10, effect2: 'magicProtection', bonus2: 10, costGold: 1_500_000, races: 'Human,Elf,Dwarf', description: 'Adds 10% magic power and 10% magic protection.' },
    { name: 'Raistlin Jamere', title: 'Black Robe Mage', effect: 'defense', bonus: 5, effect2: 'magic', bonus2: 10, costGold: 1_500_000, races: 'Orc,Undead,Giant', description: 'Adds 5% defense and 10% magic power.' },
    { name: 'Ungrim Ironfist', title: 'Dwarven Warlord', effect: 'morale', bonus: 10, effect2: null, bonus2: 0, costGold: 1_500_000, races: 'Human,Elf,Dwarf', description: 'Adds 10% effective morale.' },
    { name: 'Arrk Maneater', title: 'Troll General', effect: 'offense', bonus: 8, effect2: null, bonus2: 0, costGold: 1_500_000, races: 'Orc,Undead,Giant', description: 'Adds 8% attack.' },
    { name: 'Goliath', title: 'Legendary Champion', effect: 'morale', bonus: 5, effect2: 'thieveryDefense', bonus2: 10, costGold: 1_500_000, races: 'Orc,Undead,Giant', description: 'Adds 5% effective morale and 10% thievery defense.' },
    { name: 'Melangult the Shadow', title: 'Master Thief', effect: 'thieveryOffense', bonus: 25, effect2: 'thieveryLoss', bonus2: -30, costGold: 1_500_000, races: 'Human,Elf,Dwarf', description: 'Adds 25% thievery offense and reduces thief losses by 30%.' },
  ]
  for (const a of advisors) {
    await prisma.advisor.upsert({ where: { name: a.name }, update: a, create: a })
  }

  console.log('Seeding Game State...')
  await prisma.gameState.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
