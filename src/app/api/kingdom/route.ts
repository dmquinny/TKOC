import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import {
  canonicalKingdomPair,
  KINGDOM_MEMBERSHIP_FIXED_FOR_AGE,
  requiredKingVotes,
} from '@/lib/kingdom-rules';
import {
  lockKingdomRows,
  lockProvinceRows,
  type TransactionClient,
  withSerializableTransaction,
} from '@/lib/transactions';
import { internalErrorResponse } from '@/lib/operational-events';

async function getProvinceId(request: NextRequest): Promise<number | null> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
  return user?.pID && user.pID !== 0 ? user.pID : null;
}

// The original only changes the king when a candidate reaches half the
// kingdom's membership; a simple plurality is not enough.
async function recomputeKing(tx: TransactionClient, kiID: number) {
  const [members, kingdom] = await Promise.all([
    tx.province.findMany({
      where: { kiID, status: 'Alive' },
      select: { id: true, voteFor: true, networth: true },
    }),
    tx.kingdom.findUnique({ where: { id: kiID }, select: { king: true } }),
  ]);
  if (members.length === 0) return;
  const tally = new Map<number, number>();
  for (const m of members) {
    const v = m.voteFor ?? 0;
    if (v && members.some(x => x.id === v)) tally.set(v, (tally.get(v) ?? 0) + 1);
  }
  let bestId = members[0].id, bestVotes = 0, bestNw = -1;
  for (const m of members) {
    const votes = tally.get(m.id) ?? 0;
    const nw = m.networth ?? 0;
    if (votes > bestVotes || (votes === bestVotes && nw > bestNw)) { bestVotes = votes; bestNw = nw; bestId = m.id; }
  }
  const memberIds = new Set(members.map(member => member.id));
  const elected = bestVotes >= requiredKingVotes(members.length)
    ? bestId
    : memberIds.has(kingdom?.king ?? 0)
      ? kingdom!.king
      : members.sort((a, b) => (b.networth ?? 0) - (a.networth ?? 0))[0].id;
  await tx.kingdom.update({ where: { id: kiID }, data: { king: elected } });
}

// Ensure the caller is the King of their kingdom; returns the kingdom id.
async function requireKing(tx: TransactionClient, pID: number): Promise<number> {
  const me = await tx.province.findUnique({ where: { id: pID }, select: { kiID: true, status: true } });
  if (!me?.kiID) throw new Error('You are not in a kingdom');
  if (me.status !== 'Alive') throw new Error('Your province is not active');
  await lockKingdomRows(tx, [me.kiID]);
  const kd = await tx.kingdom.findUnique({ where: { id: me.kiID }, select: { king: true } });
  if (kd?.king !== pID) throw new Error('Only the King can manage diplomacy');
  return me.kiID;
}

export async function GET(request: NextRequest) {
  try {
    const pID = await getProvinceId(request);
    if (!pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const me = await prisma.province.findUnique({ where: { id: pID }, select: { kiID: true } });
    if (!me?.kiID) {
      return NextResponse.json({ inKingdom: false, kingdom: null, members: [] }, { status: 200 });
    }

    const [kingdom, members, races, kingdomNews] = await Promise.all([
      prisma.kingdom.findUnique({
        where: { id: me.kiID },
        select: {
          id: true,
          name: true,
          king: true,
          banner: true,
          signature: true,
          numProvinces: true,
          relationWar: true,
          relationAlly: true,
          relationMerge: true,
          relationWarTick: true,
        },
      }),
      prisma.province.findMany({
        where: { kiID: me.kiID, status: 'Alive' },
        select: { id: true, provinceName: true, rulerName: true, networth: true, acres: true, raceId: true, voteFor: true },
        orderBy: { networth: 'desc' },
      }),
      prisma.race.findMany(),
      prisma.kingdomNews.findMany({
        where: { kiID: me.kiID },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const raceName = new Map(races.map(r => [r.id, r.name]));
    const tally = new Map<number, number>();
    for (const m of members) {
      const v = m.voteFor ?? 0;
      if (v && members.some(x => x.id === v)) tally.set(v, (tally.get(v) ?? 0) + 1);
    }
    const myVote = members.find(m => m.id === pID)?.voteFor ?? 0;
    const memberList = members.map(m => ({
      id: m.id, provinceName: m.provinceName, rulerName: m.rulerName, networth: m.networth, acres: m.acres,
      race: raceName.get(m.raceId ?? 0) ?? 'Unknown',
      votes: tally.get(m.id) ?? 0,
      isKing: kingdom?.king === m.id,
      isMe: m.id === pID,
    }));

    // --- Diplomacy ---
    const relations = await prisma.kingdomRelation.findMany({ where: { OR: [{ fromKiId: me.kiID }, { toKiId: me.kiID }] } });
    const allKingdoms = await prisma.kingdom.findMany({ select: { id: true, name: true } });
    const kName = new Map(allKingdoms.map(k => [k.id, k.name ?? `Kingdom ${k.id}`]));
    const other = (r: { fromKiId: number; toKiId: number }) => (r.fromKiId === me.kiID ? r.toKiId : r.fromKiId);

    const allies = relations.filter(r => r.type === 'ally' && r.status === 'active').map(r => ({ relationId: r.id, kiId: other(r), name: kName.get(other(r)) }));
    const wars = relations.filter(r => r.type === 'war' && r.status === 'active').map(r => ({ relationId: r.id, kiId: other(r), name: kName.get(other(r)), declaredByMe: r.initiatorKiId === me.kiID }));
    const incomingProposals = relations
      .filter(r => r.type === 'ally' && r.status === 'pending' && r.initiatorKiId !== me.kiID)
      .map(r => ({ relationId: r.id, name: kName.get(other(r)) }));
    const outgoingProposals = relations
      .filter(r => r.type === 'ally' && r.status === 'pending' && r.initiatorKiId === me.kiID)
      .map(r => ({ relationId: r.id, name: kName.get(other(r)) }));
    const relatedIds = new Set(relations.map(other));
    const otherKingdoms = allKingdoms.filter(k => k.id !== me.kiID && !relatedIds.has(k.id)).map(k => ({ id: k.id, name: k.name }));

    const diplomacy = { isKing: kingdom?.king === pID, allies, wars, incomingProposals, outgoingProposals, otherKingdoms };

    return NextResponse.json({ inKingdom: true, kingdom, members: memberList, myVote, diplomacy, kingdomNews }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/kingdom GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const pID = await getProvinceId(request);
    if (!pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const body = await request.json();
    const { action, kingdomId, targetPID, relationId } = body;

    if (action === 'updateKingdom') {
      const name = String(body.name ?? '').trim();
      const signature = String(body.signature ?? '').trim();
      const banner = String(body.banner ?? '').trim();
      if (!name || name.length > 40) throw new Error('Kingdom name must be between 1 and 40 characters');
      if (signature.length > 100) throw new Error('Kingdom signature cannot exceed 100 characters');
      if (banner.length > 100 || (banner && !/^https?:\/\//i.test(banner))) {
        throw new Error('Kingdom banner must be an HTTP or HTTPS image URL');
      }
      await withSerializableTransaction(async tx => {
        await lockProvinceRows(tx, [pID]);
        const kiID = await requireKing(tx, pID);
        await tx.kingdom.update({ where: { id: kiID }, data: { name, signature, banner } });
        await tx.kingdomNews.create({ data: { kiID, message: 'The King updated the kingdom profile.' } });
      });
      return NextResponse.json({ message: 'Kingdom profile updated.' });
    }

    if (action === 'toggleMerge') {
      const enabled = Boolean(body.enabled);
      const merge = await withSerializableTransaction(async tx => {
        await lockProvinceRows(tx, [pID]);
        const kiID = await requireKing(tx, pID);
        await tx.kingdom.update({ where: { id: kiID }, data: { relationMerge: enabled ? 'true' : 'false' } });
        if (!enabled) return false;
        const alliances = await tx.kingdomRelation.findMany({
          where: {
            type: 'ally',
            status: 'active',
            OR: [{ fromKiId: kiID }, { toKiId: kiID }],
          },
        });
        for (const alliance of alliances) {
          const allyID = alliance.fromKiId === kiID ? alliance.toKiId : alliance.fromKiId;
          const ally = await tx.kingdom.findUnique({ where: { id: allyID } });
          if (ally?.relationMerge !== 'true') continue;
          await lockKingdomRows(tx, [kiID, allyID]);
          const total = await tx.province.count({
            where: { kiID: { in: [kiID, allyID] }, status: 'Alive' },
          });
          if (total > 3) throw new Error('The merged kingdom would exceed the three-province limit');
          const survivor = Math.min(kiID, allyID);
          const absorbed = survivor === kiID ? allyID : kiID;
          await tx.province.updateMany({ where: { kiID: absorbed }, data: { kiID: survivor } });
          await tx.kingdom.update({
            where: { id: survivor },
            data: { numProvinces: total, relationMerge: 'false', relationWar: 0, relationAlly: 0 },
          });
          await tx.kingdom.update({
            where: { id: absorbed },
            data: { numProvinces: 0, name: `Merged with #${survivor}`, password: '', banner: '', signature: '', relationMerge: 'false', relationAlly: 0 },
          });
          await tx.kingdomRelation.deleteMany({
            where: { OR: [{ fromKiId: { in: [survivor, absorbed] } }, { toKiId: { in: [survivor, absorbed] } }] },
          });
          await tx.kingdomNews.create({ data: { kiID: survivor, message: `The kingdoms have merged under kingdom #${survivor}.` } });
          await tx.kingdomNews.create({ data: { kiID: absorbed, message: `This kingdom merged with kingdom #${survivor}.` } });
          return true;
        }
        return false;
      });
      return NextResponse.json({ message: merge ? 'The allied kingdoms have merged.' : enabled ? 'Merge consent enabled; awaiting an allied kingdom.' : 'Merge consent disabled.' });
    }

    if (action === 'declareWar' || action === 'proposeAlly') {
      const target = Number(kingdomId);
      if (!target) throw new Error('Choose a kingdom');
      await withSerializableTransaction(async tx => {
        await lockProvinceRows(tx, [pID]);
        const kiID = await requireKing(tx, pID);
        if (target === kiID) throw new Error('Choose a kingdom');
        await lockKingdomRows(tx, [kiID, target]);
        const tk = await tx.kingdom.findUnique({ where: { id: target } });
        if (!tk) throw new Error('Kingdom not found');
        const [fromKiId, toKiId] = canonicalKingdomPair(kiID, target);
        const existing = await tx.kingdomRelation.findUnique({
          where: { fromKiId_toKiId: { fromKiId, toKiId } },
        });
        if (action === 'proposeAlly' && existing) {
          throw new Error('You already have a relation with that kingdom');
        }
        if (existing) {
          await tx.kingdomRelation.update({
            where: { id: existing.id },
            data: { type: 'war', status: 'active', initiatorKiId: kiID, createdAt: new Date() },
          });
        } else {
          await tx.kingdomRelation.create({
            data: {
              fromKiId,
              toKiId,
              initiatorKiId: kiID,
              type: action === 'declareWar' ? 'war' : 'ally',
              status: action === 'declareWar' ? 'active' : 'pending',
            },
          });
        }
      });
      if (action === 'declareWar') {
        return NextResponse.json({ message: 'War has been declared!' }, { status: 200 });
      }
      return NextResponse.json({ message: 'Alliance proposed.' }, { status: 200 });
    }

    if (action === 'acceptRelation') {
      await withSerializableTransaction(async tx => {
        await lockProvinceRows(tx, [pID]);
        const kiID = await requireKing(tx, pID);
        const rel = await tx.kingdomRelation.findUnique({ where: { id: Number(relationId) } });
        if (
          !rel
          || (rel.fromKiId !== kiID && rel.toKiId !== kiID)
          || rel.initiatorKiId === kiID
          || rel.status !== 'pending'
          || rel.type !== 'ally'
        ) throw new Error('Relation not found');
        await lockKingdomRows(tx, [rel.fromKiId, rel.toKiId]);
        await tx.kingdomRelation.update({ where: { id: rel.id }, data: { status: 'active' } });
      });
      return NextResponse.json({ message: 'Alliance formed.' }, { status: 200 });
    }

    if (action === 'cancelRelation') {
      await withSerializableTransaction(async tx => {
        await lockProvinceRows(tx, [pID]);
        const kiID = await requireKing(tx, pID);
        const rel = await tx.kingdomRelation.findUnique({ where: { id: Number(relationId) } });
        if (!rel || (rel.fromKiId !== kiID && rel.toKiId !== kiID)) throw new Error('Relation not found');
        await lockKingdomRows(tx, [rel.fromKiId, rel.toKiId]);
        await tx.kingdomRelation.delete({ where: { id: rel.id } });
      });
      return NextResponse.json({ message: 'Relation ended.' }, { status: 200 });
    }

    if (action === 'vote') {
      const target = Number(targetPID);
      if (!target) throw new Error('Choose who to vote for');
      await withSerializableTransaction(async tx => {
        await lockProvinceRows(tx, [pID, target]);
        const me = await tx.province.findUnique({ where: { id: pID }, select: { kiID: true } });
        if (!me?.kiID) throw new Error('You are not in a kingdom');
        await lockKingdomRows(tx, [me.kiID]);
        const targetProv = await tx.province.findUnique({ where: { id: target }, select: { kiID: true } });
        if (!targetProv || targetProv.kiID !== me.kiID) throw new Error('You can only vote for a kingdom-mate');
        await tx.province.update({ where: { id: pID }, data: { voteFor: target } });
        await recomputeKing(tx, me.kiID);
      });
      return NextResponse.json({ message: 'Your vote has been cast.' }, { status: 200 });
    }

    if (KINGDOM_MEMBERSHIP_FIXED_FOR_AGE && ['leave', 'join', 'create'].includes(String(action))) {
      throw new Error('Kingdom membership is fixed for the age and can only be chosen when founding a province');
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    const known = [
      'Choose a kingdom to join', 'You are already in that kingdom', 'Kingdom not found',
      'That kingdom is full', 'Wrong kingdom password', 'Kingdom name is required',
      'That kingdom name is already taken',
      'Choose who to vote for', 'You are not in a kingdom', 'You can only vote for a kingdom-mate',
      'Only the King can manage diplomacy', 'Choose a kingdom', 'You already have a relation with that kingdom', 'Relation not found',
      'Kingdom membership is fixed for the age and can only be chosen when founding a province',
      'Your province is not active',
      'Kingdom name must be between 1 and 40 characters', 'Kingdom signature cannot exceed 100 characters',
      'Kingdom banner must be an HTTP or HTTPS image URL', 'The merged kingdom would exceed the three-province limit',
    ];
    if (known.includes(message)) return NextResponse.json({ error: message }, { status: 400 });
    return internalErrorResponse(request, '/api/kingdom POST', error);
  }
}
