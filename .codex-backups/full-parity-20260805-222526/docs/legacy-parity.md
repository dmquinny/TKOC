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
  costs, times, race variants, and unlocks. Dwarves alone begin with Mining.
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
in each operation as they did in the PHP game. The modern database does not
retain the old per-unit death ledger, so `Resurrect` reconstructs its percentage
from the current soldier host instead of named dead-unit buckets.

Run `npm run parity` to validate constants and catalogs, and `npm run check` for
type and lint validation. Database deployments require both `npm run db:deploy`
and `npm run db:seed`.
