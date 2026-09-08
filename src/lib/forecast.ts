/**
 * Per-tick economic outlook derived from the deltas the tick engine records
 * on the province row. These are the actual results of the last tick, which
 * is the most honest forecast available without re-running the economy.
 */
export interface ForecastInput {
  gold: number;
  food: number;
  metal: number;
  peasants: number;
  incomeChange: number;
  foodChange: number;
  metalChange: number;
  peasantChange: number;
  aliveTicks: number;
  vacation: boolean;
}

export interface Forecast {
  /** False until the province has lived through at least one tick. */
  hasTicked: boolean;
  vacation: boolean;
  gold: number;
  food: number;
  metal: number;
  peasants: number;
  /** Ticks until food runs out at the current rate, or null when not falling. */
  foodRunwayTicks: number | null;
  goldRunwayTicks: number | null;
  /** 'starving' when food is already empty and falling. */
  foodStatus: 'stable' | 'falling' | 'critical' | 'starving';
}

export function runwayTicks(stock: number, changePerTick: number): number | null {
  if (changePerTick >= 0) return null;
  return Math.max(0, Math.floor(Math.max(0, stock) / Math.abs(changePerTick)));
}

export function buildForecast(input: ForecastInput): Forecast {
  const hasTicked = input.aliveTicks > 0;
  const foodRunwayTicks = hasTicked ? runwayTicks(input.food, input.foodChange) : null;
  const goldRunwayTicks = hasTicked ? runwayTicks(input.gold, input.incomeChange) : null;
  let foodStatus: Forecast['foodStatus'] = 'stable';
  if (foodRunwayTicks !== null) {
    if (input.food <= 0) foodStatus = 'starving';
    else if (foodRunwayTicks <= 24) foodStatus = 'critical';
    else foodStatus = 'falling';
  }
  return {
    hasTicked,
    vacation: input.vacation,
    gold: input.incomeChange,
    food: input.foodChange,
    metal: input.metalChange,
    peasants: input.peasantChange,
    foodRunwayTicks,
    goldRunwayTicks,
    foodStatus,
  };
}

export function describeTicks(ticks: number): string {
  if (ticks <= 0) return 'now';
  if (ticks === 1) return '1 tick';
  if (ticks < 24) return `${ticks} ticks`;
  const days = Math.floor(ticks / 24);
  const rest = ticks % 24;
  const dayText = `${days} day${days === 1 ? '' : 's'}`;
  return rest ? `${dayText} ${rest}t` : dayText;
}
