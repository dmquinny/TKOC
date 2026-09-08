import { Prisma } from '@prisma/client';
import type { TransactionClient } from '@/lib/transactions';

/**
 * Store every living province's networth rank. The daily reference rank is
 * captured every 24 ticks (and whenever it has never been set) so rankings
 * can show movement over the last in-game day.
 */
export async function refreshNetworthRanks(tx: TransactionClient, tick: number): Promise<void> {
  const captureDaily = tick % 24 === 0 ? 1 : 0;
  await tx.$executeRaw(Prisma.sql`
    UPDATE \`Province\` AS p
    JOIN (
      SELECT \`pID\`, ROW_NUMBER() OVER (ORDER BY \`networth\` DESC, \`acres\` DESC, \`pID\` ASC) AS rnk
      FROM \`Province\`
      WHERE \`status\` = 'Alive' AND \`acres\` > 0
    ) AS r ON r.\`pID\` = p.\`pID\`
    SET p.\`rankNetworth\` = r.rnk,
        p.\`rankNetworthDay\` = IF(p.\`rankNetworthDay\` = 0 OR ${captureDaily} = 1, r.rnk, p.\`rankNetworthDay\`)
  `);
}
