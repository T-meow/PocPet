import type { ReactNode } from 'react';
import { Pin } from 'lucide-react';

export const CommunityBoardNote = ({ summary, label, art, tone, active = false, ready = false, onClick }: {
  summary: string; label: string; art: ReactNode; tone: string;
  active?: boolean; ready?: boolean; onClick: () => void;
}) => <button type="button" className="community-pinned-note" data-tone={tone} data-active={active} data-ready={ready}
  aria-haspopup="dialog" aria-label={`${label}，${summary}，查看详情`} onClick={onClick}>
  <Pin className="community-note-pin" size={16} aria-hidden="true" />
  <span className="community-note-label">{label}</span>
  <span className="community-note-art" aria-hidden="true">{art}</span>
  <strong>{summary}</strong>
</button>;
