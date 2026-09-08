# Legacy gameplay parity

The authoritative reference is the PHP application in
`../The-Kingdoms-Of-Chaos-stable/stable/www` and its shipped
`tkoc_stable.sql`. The modern application intentionally preserves rules that
look unusual when the old server actually executed them.

## Matched systems

- The 1,500-tick age consists of 1,000 normal ticks and 500 Apocalypse ticks.
- Seasons last 96 ticks and use the original Spring, Summer, Autumn, Winter
  modifiers.
- Protection lasts 50 active ticks. Vacation freezes economy, protection,
  exploration, construction, and training, but not research, spell timers, or
  mana/influence regeneration. Vacation exit requires more than 48 ticks.
- Exploration uses the old cost formula and exact random 24-tick distribution.
- All 14 buildings use the original names, costs, build times, requirements,
  race restrictions, and production/combat effects.
- All 36 race-specific military units use their original costs, statistics,
  categories, and train times. Trainees count toward upkeep immediately but are
  unavailable until their bucket completes.
- All 23 science definitions use the original one-time knowledge-bit tree,
  costs, times, race variants, and unlocks. Dwarves alone begin with Mining;
  Dwarves cannot research magic and Giants cannot research thievery.
- Attacks resolve immediately, enforce protection/morale/research restrictions,
  use the original casualty ranges and land/pillage formulas, and return after
  10 ticks (ordinary/massacre) or 6 (pillage), modified by race, season, and
  buildings.
- New provinces receive the old resource defaults, 20 Farms, 20 Homes, and 300
  race-specific soldiers. Kingdoms are capped at three provinces.
- Province names are chosen when founding a province and cannot be renamed
  during the age. Age rollover removes the old province and permits a new name.
- The seven original advisors, race restrictions, hire prices, and bonuses are
  represented.
- All 31 active SpellT classes are available with their original per-acre
  costs, mana/wizard calculations, race and science gates, targeting rules,
  success checks, selectable 1–24 tick duration, stacking, and direct/timed
  effects. The disabled `CleansingSpell` class is correctly excluded.
- All 14 active ThieveryT operations are available with their original
  influence threshold/costs, science gates, difficulty-based TPA contest,
  failure losses, reports, resource limits, destructive effects, and lasting
  operations. The unused `RetributiveStrike` class is correctly excluded.
- Homes, Inns, Wizard Towers, Docks, and Walls use separate peasant, thief,
  and wizard housing rules, and overpopulated provinces cannot attack, cast,
  or conduct thievery.
- Networth, campaign income, military experience, attack statistics, magic
  reputation, and thievery reputation use the shipped legacy values.
- Aid sends all four resource types in one caravan and applies race,
  Marketplace, and Resource Teleportation loss modifiers independently.
- Kingdom banners, signatures, voting, diplomacy, allied merges, kingdom news,
  world/kingdom forums, private messages, live rankings, and complete age
  results are represented in the modern interface.
- The tick order through resource production is Attack, Military, triggered
  queues, Explore, Buildings, Science, then economy. Research continues during
  vacation and completed buildings/science affect the same tick.

## Compatibility notes

The modern schema combines old triggered effects and active spells into one
timed-effect table. Their countdown is kept after production so spells receive
their full displayed duration. The original source used separate tables and
two different countdown stages.

Magic and thievery keep an accessible modern presentation while using the
original playable catalogs and engine rules. Wizards committed to timed spells
remain unavailable until those spells expire, and all ready thieves participate
in each operation as they did in the PHP game. The per-unit `DeadMilitary`
ledger retains recoverable casualties for 24 ticks, allowing `Resurrect` to
restore the actual fallen unit categories.

The September 2026 interface work added presentation-only systems that sit
beside the legacy rules without changing them: persisted battle reports
(`BattleReport`), per-tick networth rank tracking on `Province`
(`rankNetworth`, `rankNetworthDay`), enriched target intelligence, the
economy forecast derived from the deltas the tick already records, the
first-steps checklist, the age outlook, and the standalone control panel.
None of them feed back into combat, economy, magic, or thievery outcomes.

Run `npm run parity` to validate constants and catalogs, and `npm run check` for
type and lint validation. Database deployments require both `npm run db:deploy`
and `npm run db:seed`.
