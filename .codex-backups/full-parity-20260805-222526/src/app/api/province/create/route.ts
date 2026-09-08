import { NextRequest, NextResponse } from 'next/server';
import { Prisma, type Kingdom } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { LEGACY_PROTECTION_TICKS } from '@/lib/legacy-rules';
import {
  KINGDOM_CAP,
  hashKingdomPassword,
  kingdomPasswordMatches,
} from '@/lib/kingdom-rules';
import {
  lockKingdomRows,
  lockUserRows,
  withSerializableTransaction,
} from '@/lib/transactions';
import { internalErrorResponse } from '@/lib/operational-events';

// Starting loadout for a new province (keyed by seed classNames). Mirrors the
// legacy Register class, which granted starting buildings and 300 soldiers so a
// province is self-sufficient (produces enough food) from tick one.
const STARTING_BUILDINGS: Record<string, number> = {
  'Farm': 20,
  'Home': 20,
};
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { provinceName, rulerName, race, gender, kingdom: kd } = await request.json();
    const cleanProvinceName = String(provinceName ?? '').trim();
    const cleanRulerName = String(rulerName ?? '').trim();

    if (!cleanProvinceName || !cleanRulerName) {
      return NextResponse.json({ error: 'Province name and ruler name are required' }, { status: 400 });
    }
    if (cleanProvinceName.length > 40 || cleanRulerName.length > 40) {
      return NextResponse.json({ error: 'Province and ruler names can be up to 40 characters.' }, { status: 400 });
    }
    const rawMode = kd?.mode;
    const kingdomMode: 'random' | 'join' | 'new' =
      rawMode === 'join' || rawMode === 'new' ? rawMode : 'random';

    const raceId = Number(race) || 0;
    const raceRow = raceId ? await prisma.race.findUnique({ where: { id: raceId } }) : null;
    if (!raceRow) {
      return NextResponse.json({ error: 'Please choose a race' }, { status: 400 });
    }

    const [buildingTypes, militaryTypes, miningScience] = await Promise.all([
      prisma.buildingType.findMany(),
      prisma.militaryType.findMany({ where: { raceName: raceRow.name } }),
      prisma.scienceType.findUnique({ where: { className: 'MiningScience' } }),
    ]);

    // Create the province, its starting assets, its kingdom membership, and the
    // user link atomically so a failure can't leave the game in a broken state.
    const newProvince = await withSerializableTransaction(async (tx) => {
      await lockUserRows(tx, [userId]);
      const currentUser = await tx.user.findUnique({ where: { id: userId } });
      if (!currentUser) throw new Error('User not found');
      if (currentUser.pID) throw new Error('User already has a province');
      if (await tx.province.findUnique({ where: { provinceName: cleanProvinceName } })) {
        throw new Error('That province name is already taken');
      }

      // Resolve which kingdom this province joins based on the chosen mode.
      let kingdom: Kingdom | null = null;
      if (kingdomMode === 'new') {
        const name = String(kd?.name ?? '').trim();
        if (!name) throw new Error('Kingdom name is required');
        if (name.length > 40) throw new Error('Kingdom names can be up to 40 characters');
        const clash = await tx.kingdom.findUnique({ where: { name } });
        if (clash) throw new Error('That kingdom name is already taken');
        const hashedPassword = await hashKingdomPassword(kd?.password);
        kingdom = await tx.kingdom.create({
          data: { name, password: hashedPassword, numProvinces: 0 },
        });
      } else if (kingdomMode === 'join') {
        const kid = Number(kd?.id);
        if (!kid) throw new Error('Choose a kingdom to join');
        await lockKingdomRows(tx, [kid]);
        const target = await tx.kingdom.findUnique({ where: { id: kid } });
        if (!target) throw new Error('Kingdom not found');
        if (target.numProvinces >= KINGDOM_CAP) throw new Error('That kingdom is full');
        if (!(await kingdomPasswordMatches(target.password, kd?.password))) {
          throw new Error('Wrong kingdom password');
        }
        kingdom = target;
      } else {
        // random: emptiest open, password-free kingdom with room, else found a new one.
        kingdom = await tx.kingdom.findFirst({
          where: { numProvinces: { lt: KINGDOM_CAP }, OR: [{ password: null }, { password: '' }] },
          orderBy: [{ numProvinces: 'asc' }, { id: 'asc' }],
        });
        if (kingdom) {
          await lockKingdomRows(tx, [kingdom.id]);
          kingdom = await tx.kingdom.findUnique({ where: { id: kingdom.id } });
          if (kingdom && kingdom.numProvinces >= KINGDOM_CAP) kingdom = null;
        }
        if (!kingdom) {
          kingdom = await tx.kingdom.create({
            data: { name: `Realm ${userId}-${Date.now().toString(36)}`.slice(0, 40), numProvinces: 0 },
          });
        }
      }

      const province = await tx.province.create({
        data: {
          provinceName: cleanProvinceName,
          rulerName: cleanRulerName,
          gender: gender === 'F' ? 'F' : 'M',
          raceId,
          spID: raceId,
          kiID: kingdom ? kingdom.id : 0,
          networth: 1000,
          protection: LEGACY_PROTECTION_TICKS,
          aliveTicks: -1,
          influence: raceRow.name === 'Human' ? 110 : 100,
          mana: raceRow.name === 'Elf' ? 110 : 100,
        },
      });

      const buildingRows = buildingTypes
        .filter(t => t.className && STARTING_BUILDINGS[t.className] != null)
        .map(t => ({ pID: province.id, bID: t.id, num: STARTING_BUILDINGS[t.className!] }));
      if (buildingRows.length) await tx.building.createMany({ data: buildingRows });

      const soldiers = militaryTypes.find(t => t.category === 'soldiers');
      if (!soldiers) throw new Error(`Starting soldiers are not configured for ${raceRow.name}`);
      await tx.militaryUnit.create({ data: { pID: province.id, mID: soldiers.id, num: 300 } });

      // The legacy Dwarf race begins with Mining; every other race begins with
      // no completed science and discovers the tree one node at a time.
      if (raceRow.name === 'Dwarf' && miningScience) {
        await tx.science.create({ data: { pID: province.id, scID: miningScience.id, level: 1 } });
      }

      // First province in a fresh kingdom becomes its king (income bonus in the tick).
      if (kingdom) {
        const kingdomUpdate: { numProvinces: { increment: number }; king?: number } = {
          numProvinces: { increment: 1 },
        };
        if (kingdom.numProvinces === 0) kingdomUpdate.king = province.id;
        await tx.kingdom.update({ where: { id: kingdom.id }, data: kingdomUpdate });
      }

      await tx.news.create({
        data: { pID: province.id, message: `The province of ${cleanProvinceName} was founded. Long may ${cleanRulerName} reign!` },
      });

      await tx.user.update({ where: { id: userId }, data: { pID: province.id } });

      return province;
    });

    return NextResponse.json({ message: 'Province created successfully', provinceId: newProvince.id }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    const known = [
      'Kingdom name is required',
      'That kingdom name is already taken',
      'Choose a kingdom to join',
      'Kingdom not found',
      'That kingdom is full',
      'Wrong kingdom password',
      'User not found',
      'User already has a province',
      'That province name is already taken',
      'Kingdom names can be up to 40 characters',
    ];
    if (known.includes(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'That province or kingdom name is already taken' }, { status: 409 });
    }
    return internalErrorResponse(request, '/api/province/create', error);
  }
}
