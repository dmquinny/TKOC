/**
 * First-hour guidance for a new province. Every item is derived from real
 * state so it completes itself as the player acts; nothing is tracked by
 * hand. Once every item is done the list disappears for good.
 */
export interface ChecklistInput {
  acres: number;
  landUsed: number;
  buildOrders: number;
  researchOrders: number;
  sciences: number;
  raceName: string;
  militaryOrders: number;
  militaryTotal: number;
  exploreOrders: number;
  councilId: number;
  inKingdom: boolean;
  kingdomChatMessages: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  href: string;
  done: boolean;
}

/** Dwarves alone start with Mining already known. */
export function startingScienceCount(raceName: string): number {
  return raceName === 'Dwarf' ? 1 : 0;
}

export const STARTING_SOLDIERS = 300;
export const STARTING_ACRES = 300;

export function buildChecklist(input: ChecklistInput): ChecklistItem[] {
  const freeAcres = Math.max(0, input.acres - input.landUsed);
  const items: ChecklistItem[] = [
    {
      id: 'build',
      label: 'Build on your free land',
      detail: freeAcres > 0
        ? `${freeAcres.toLocaleString()} acres are empty. Farms feed people; Homes house them.`
        : 'Every acre is developed or under construction.',
      href: '/dashboard/buildings',
      done: freeAcres === 0 || input.buildOrders > 0,
    },
    {
      id: 'research',
      label: 'Start a research project',
      detail: 'Only one science at a time. Mining unlocks Mines; Basic Attacking unlocks war.',
      href: '/dashboard/science',
      done: input.researchOrders > 0 || input.sciences > startingScienceCount(input.raceName),
    },
    {
      id: 'train',
      label: 'Train your first troops',
      detail: 'Recruits take 12 ticks. Protection ends after 50 ticks, so start early.',
      href: '/dashboard/military',
      done: input.militaryOrders > 0 || input.militaryTotal > STARTING_SOLDIERS,
    },
    {
      id: 'explore',
      label: 'Send an expedition for land',
      detail: 'Soldiers settle new acres over 24 ticks. More land means more buildings and housing.',
      href: '/dashboard/explore',
      done: input.exploreOrders > 0 || input.acres > STARTING_ACRES,
    },
    {
      id: 'council',
      label: 'Appoint an advisor',
      detail: 'Lady Brienne serves for free. Specialists cost gold but grant standing bonuses.',
      href: '/dashboard/council',
      done: input.councilId > 0,
    },
  ];
  if (input.inKingdom) {
    items.push({
      id: 'kingdom',
      label: 'Greet your kingdom',
      detail: 'Say hello in kingdom chat. Your kingdom-mates can send aid and vote for a King.',
      href: '/dashboard/chat',
      done: input.kingdomChatMessages > 0,
    });
  }
  return items;
}

export function checklistComplete(items: ChecklistItem[]): boolean {
  return items.every(item => item.done);
}
