import {
  BookOpen,
  Castle,
  Compass,
  Crown,
  Eye,
  FlaskConical,
  HandCoins,
  Hammer,
  Home,
  Mail,
  Medal,
  MessagesSquare,
  Settings,
  Shield,
  SlidersHorizontal,
  Swords,
  Trophy,
  WandSparkles,
} from 'lucide-react';
import type { MobileNavId } from '@/lib/mobile-nav';

const ICONS = {
  overview: Home,
  guide: BookOpen,
  buildings: Hammer,
  science: FlaskConical,
  council: Crown,
  preferences: SlidersHorizontal,
  rankings: Trophy,
  'hall-of-fame': Medal,
  explore: Compass,
  kingdom: Castle,
  aid: HandCoins,
  chat: MessagesSquare,
  messages: Mail,
  military: Shield,
  'war-room': Swords,
  thievery: Eye,
  magic: WandSparkles,
  admin: Settings,
} satisfies Record<MobileNavId, typeof Home>;

export default function MobileNavIcon({ id }: { id: MobileNavId }) {
  const Icon = ICONS[id];
  return <Icon aria-hidden="true" />;
}

