/** Clamp one source exactly as the original Effect engine did. */
export function legacyEffectMultiplier(percent: number): number {
  return Math.max(0.0001, Math.min(2, 1 + percent / 100));
}

/**
 * Science, spells, buildings, race, council and season were independent
 * multiplicative groups in Effect::getEffect.
 */
export function combineLegacyEffectPercents(...sourcePercents: number[]): number {
  return sourcePercents.reduce(
    (multiplier, percent) => multiplier * legacyEffectMultiplier(percent),
    1,
  );
}
