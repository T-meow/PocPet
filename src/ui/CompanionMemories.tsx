import { BookHeart } from 'lucide-react';
import { activityText as L } from '../core/kitchenRecipes';
import { memoryText } from '../core/companionMemories';
import type { PetState } from '../core/pet';

export const CompanionMemories = ({ pet, actorId, compact = false }: { pet: PetState; actorId: string; compact?: boolean }) => {
  const entries = pet.companionMemories.entries.filter((entry) => entry.actorId === actorId);
  return <section className="together-memories">
    <div className="activity-section-title"><BookHeart size={20} /><h3>{L('我们的回忆', 'Our memories')}</h3><small>{entries.length}</small></div>
    {!entries.length && <p className="activity-muted">{L('一起做一顿饭、玩一会儿。小小的共同经历，会慢慢留在这里。', 'Make a meal or play together. Little shared memories will find a home here.')}</p>}
    <div className="memory-entries">{entries.slice().reverse().slice(0, compact ? 1 : undefined).map((entry) => <article key={entry.id} className={`memory-note memory-note--${entry.kind}`}>
      <span aria-hidden="true">{entry.kind === 'first_taste' ? '🍽️' : entry.kind === 'catch_record' ? '⚽' : '📸'}</span>
      <p>{memoryText(entry)}<time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleDateString()}</time></p>
    </article>)}</div>
  </section>;
};
