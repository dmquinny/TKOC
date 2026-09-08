import type { PrismaClientLike } from '@/lib/transactions';
import { attackTypeName, parseBattleUnits, type BattleReportView, type BattleUnitLine } from '@/lib/combat';

export interface NewBattleReport {
  age: number;
  tick: number;
  attackerPID: number;
  defenderPID: number;
  attackerName: string;
  defenderName: string;
  attackerKiID: number;
  defenderKiID: number;
  attackType: number;
  won: boolean;
  attackPoints: number;
  defensePoints: number;
  attackerLost: number;
  defenderLost: number;
  acresSeized: number;
  acresGained: number;
  gold: number;
  food: number;
  metal: number;
  buildingsLost: number;
  moraleLoss: number;
  returnTicks: number;
  targetKilled: boolean;
  units: BattleUnitLine[];
}

const clampInt = (value: number) => Math.max(0, Math.min(2_147_483_647, Math.round(Number.isFinite(value) ? value : 0)));

export async function createBattleReport(db: PrismaClientLike, report: NewBattleReport) {
  return db.battleReport.create({
    data: {
      age: report.age,
      tick: report.tick,
      attackerPID: report.attackerPID,
      defenderPID: report.defenderPID,
      attackerName: report.attackerName.slice(0, 40),
      defenderName: report.defenderName.slice(0, 40),
      attackerKiID: report.attackerKiID,
      defenderKiID: report.defenderKiID,
      attackType: report.attackType,
      won: report.won,
      attackPoints: clampInt(report.attackPoints),
      defensePoints: clampInt(report.defensePoints),
      attackerLost: clampInt(report.attackerLost),
      defenderLost: clampInt(report.defenderLost),
      acresSeized: clampInt(report.acresSeized),
      acresGained: clampInt(report.acresGained),
      gold: clampInt(report.gold),
      food: clampInt(report.food),
      metal: clampInt(report.metal),
      buildingsLost: clampInt(report.buildingsLost),
      moraleLoss: clampInt(report.moraleLoss),
      returnTicks: clampInt(report.returnTicks),
      targetKilled: report.targetKilled,
      units: JSON.stringify(report.units.slice(0, 40)),
      // The attacker watches the result appear, so it is seen immediately.
      attackerSeenAt: new Date(),
    },
  });
}

type ReportRow = {
  id: number;
  age: number;
  tick: number;
  attackerPID: number;
  defenderPID: number;
  attackerName: string;
  defenderName: string;
  attackType: number;
  won: boolean;
  attackPoints: number;
  defensePoints: number;
  attackerLost: number;
  defenderLost: number;
  acresSeized: number;
  acresGained: number;
  gold: number;
  food: number;
  metal: number;
  buildingsLost: number;
  moraleLoss: number;
  returnTicks: number;
  targetKilled: boolean;
  units: string | null;
  attackerSeenAt: Date | null;
  defenderSeenAt: Date | null;
  createdAt: Date;
};

export function toBattleReportView(row: ReportRow, viewerPID: number): BattleReportView {
  const seen = row.attackerPID === viewerPID ? row.attackerSeenAt !== null : row.defenderSeenAt !== null;
  return {
    id: row.id,
    age: row.age,
    tick: row.tick,
    attackerPID: row.attackerPID,
    defenderPID: row.defenderPID,
    attackerName: row.attackerName,
    defenderName: row.defenderName,
    attackType: row.attackType,
    attackName: attackTypeName(row.attackType),
    won: row.won,
    attackPoints: row.attackPoints,
    defensePoints: row.defensePoints,
    attackerLost: row.attackerLost,
    defenderLost: row.defenderLost,
    acresSeized: row.acresSeized,
    acresGained: row.acresGained,
    gold: row.gold,
    food: row.food,
    metal: row.metal,
    buildingsLost: row.buildingsLost,
    moraleLoss: row.moraleLoss,
    returnTicks: row.returnTicks,
    targetKilled: row.targetKilled,
    units: parseBattleUnits(row.units),
    createdAt: row.createdAt.toISOString(),
    seen,
  };
}

export async function listBattleReports(db: PrismaClientLike, pID: number, limit = 30): Promise<BattleReportView[]> {
  const rows = await db.battleReport.findMany({
    where: { OR: [{ attackerPID: pID }, { defenderPID: pID }] },
    orderBy: { id: 'desc' },
    take: Math.min(200, Math.max(1, limit)),
  });
  return rows.map(row => toBattleReportView(row, pID));
}

export async function unseenBattleReportCount(db: PrismaClientLike, pID: number): Promise<number> {
  return db.battleReport.count({ where: { defenderPID: pID, defenderSeenAt: null } });
}

export async function markBattleReportsSeen(db: PrismaClientLike, pID: number): Promise<number> {
  const result = await db.battleReport.updateMany({
    where: { defenderPID: pID, defenderSeenAt: null },
    data: { defenderSeenAt: new Date() },
  });
  return result.count;
}
