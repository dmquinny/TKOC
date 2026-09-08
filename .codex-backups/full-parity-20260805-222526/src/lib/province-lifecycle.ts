import type { TransactionClient } from '@/lib/transactions';

async function repairKingdom(tx: TransactionClient, kiID: number): Promise<void> {
  if (!kiID) return;
  const kingdom = await tx.kingdom.findUnique({ where: { id: kiID } });
  if (!kingdom) return;
  const members = await tx.province.findMany({
    where: { kiID, status: 'Alive' },
    orderBy: [{ networth: 'desc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (!members.length) {
    await tx.kingdomRelation.deleteMany({ where: { OR: [{ fromKiId: kiID }, { toKiId: kiID }] } });
    await tx.kingdom.delete({ where: { id: kiID } });
    return;
  }
  await tx.kingdom.update({
    where: { id: kiID },
    data: {
      numProvinces: members.length,
      king: members.some(member => member.id === kingdom.king) ? kingdom.king : members[0].id,
    },
  });
}

async function removeDevelopedLand(tx: TransactionClient, pID: number, quantity: number): Promise<number> {
  let remaining = Math.max(0, Math.floor(quantity));
  let removed = 0;
  if (!remaining) return 0;
  const orders = await tx.buildOrder.findMany({
    where: { pID },
    orderBy: [{ ticksLeft: 'desc' }, { id: 'asc' }],
  });
  for (const order of orders) {
    if (!remaining) break;
    const take = Math.min(remaining, order.num);
    if (take === order.num) await tx.buildOrder.delete({ where: { id: order.id } });
    else await tx.buildOrder.update({ where: { id: order.id }, data: { num: { decrement: take } } });
    remaining -= take;
    removed += take;
  }
  const buildings = await tx.building.findMany({
    where: { pID, num: { gt: 0 } },
    orderBy: [{ num: 'desc' }, { id: 'asc' }],
  });
  for (const building of buildings) {
    if (!remaining) break;
    const take = Math.min(remaining, building.num);
    if (take === building.num) await tx.building.delete({ where: { id: building.id } });
    else await tx.building.update({ where: { id: building.id }, data: { num: { decrement: take } } });
    remaining -= take;
    removed += take;
  }
  return removed;
}

export async function reconcileLandLoss(
  tx: TransactionClient,
  pID: number,
  previousAcres: number,
  acresLost: number,
): Promise<{ buildingsLost: number; killed: boolean }> {
  const province = await tx.province.findUnique({
    where: { id: pID },
    select: { acres: true, kiID: true, status: true },
  });
  if (!province) return { buildingsLost: 0, killed: false };
  const [built, queued] = await Promise.all([
    tx.building.aggregate({ where: { pID }, _sum: { num: true } }),
    tx.buildOrder.aggregate({ where: { pID }, _sum: { num: true } }),
  ]);
  const developed = (built._sum.num ?? 0) + (queued._sum.num ?? 0);
  const currentAcres = Math.max(0, province.acres ?? 0);
  const proportional = previousAcres > 0
    ? Math.round(developed * Math.max(0, acresLost) / previousAcres)
    : developed;
  const requiredForCapacity = Math.max(0, developed - currentAcres);
  const buildingsLost = await removeDevelopedLand(
    tx,
    pID,
    Math.min(developed, Math.max(proportional, requiredForCapacity)),
  );
  if (currentAcres > 0 || province.status !== 'Alive') return { buildingsLost, killed: false };

  const oldKingdom = province.kiID;
  await tx.province.update({
    where: { id: pID },
    data: {
      acres: 0,
      status: 'Killed',
      kiID: 0,
      voteFor: 0,
      councilId: 0,
      vacation: false,
    },
  });
  await tx.user.updateMany({ where: { pID }, data: { pID: 0 } });
  await tx.exploreOrder.deleteMany({ where: { pID } });
  await tx.buildOrder.deleteMany({ where: { pID } });
  await tx.researchOrder.deleteMany({ where: { pID } });
  await tx.militaryOrder.deleteMany({ where: { pID } });
  await tx.effect.deleteMany({ where: { OR: [{ pID }, { sourcePID: pID }] } });
  await repairKingdom(tx, oldKingdom);
  return { buildingsLost, killed: true };
}

export async function cleanupKilledProvinces(tx: TransactionClient): Promise<number> {
  const killed = await tx.province.findMany({
    where: {
      status: 'Killed',
      outgoingAttacks: { none: {} },
      incomingAttacks: { none: {} },
    },
    select: { id: true },
  });
  for (const province of killed) {
    await tx.news.deleteMany({ where: { pID: province.id } });
    await tx.science.deleteMany({ where: { pID: province.id } });
    await tx.building.deleteMany({ where: { pID: province.id } });
    await tx.militaryUnit.deleteMany({ where: { pID: province.id } });
    await tx.province.delete({ where: { id: province.id } });
  }
  return killed.length;
}
