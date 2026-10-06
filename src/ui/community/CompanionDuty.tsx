import { useState } from 'react';
import { Users } from 'lucide-react';
import type { CompanionPortrait } from '../companionRoster';

export const CompanionDuty = ({ actor, label, className = '' }: { actor: CompanionPortrait; label: string; className?: string }) => {
  const [failedSource, setFailedSource] = useState('');
  return <div className={`community-companion-duty ${className}`} aria-label={`${actor.name} · ${label}`}>
    {actor.portrait && failedSource !== actor.portrait
      ? <img src={actor.portrait} alt="" draggable={false} onError={() => setFailedSource(actor.portrait)} />
      : <span className="community-companion-placeholder"><Users aria-hidden="true" /></span>}
    <span className="community-companion-name"><strong>{actor.name}</strong><small>{label}</small></span>
  </div>;
};
