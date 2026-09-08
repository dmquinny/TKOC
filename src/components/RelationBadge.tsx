import { RELATION_LABEL, type TargetRelation } from '@/lib/targets';

export default function RelationBadge({ relation }: { relation: TargetRelation }) {
  return <span className={`relation-badge is-${relation}`}>{RELATION_LABEL[relation]}</span>;
}
