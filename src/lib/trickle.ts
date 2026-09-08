// Faithful port of the legacy getRandomArray (military/Misc.class.inc.php): spread
// `total` units across `size` ticks with randomness, so completions trickle in over
// the whole window rather than all arriving at the end. Returns a map of
// ticksLeft (1..size) -> amount, only for non-empty buckets. Sum always equals total.
export function distributeAcrossTicks(
  total: number,
  size: number,
  random: () => number = Math.random,
): Map<number, number> {
  const out = new Map<number, number>();
  total = Math.floor(total);
  size = Math.floor(size);
  if (total <= 0 || size <= 0) return out;

  const buckets = new Array<number>(size).fill(0);
  let left = total;
  const eachRound = total > size ? Math.floor(total / size) : 1;
  const randomInt = (maxInclusive: number) =>
    Math.floor(random() * (Math.floor(maxInclusive) + 1));

  if (eachRound === 1) {
    while (left > 0) {
      buckets[randomInt(size - 1)] += 1;
      left -= 1;
    }
  } else {
    let index = 0;
    let nextRound = 0;
    while (index < size && left > 0) {
      let amount = eachRound - nextRound;
      const thisRound = randomInt(eachRound / 2);
      amount = Math.max(0, amount + thisRound);
      buckets[index] += amount;
      left -= amount;
      nextRound = thisRound;
      index += 1;
    }

    index -= 1;
    buckets[index] -= nextRound;
    left += nextRound;
    while (left > 0) {
      buckets[randomInt(size - 1)] += 1;
      left -= 1;
    }
  }

  buckets.forEach((amount, index) => {
    if (amount > 0) out.set(index + 1, amount);
  });
  return out;
}
