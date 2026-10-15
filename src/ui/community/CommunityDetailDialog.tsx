import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { DialogShell } from '../DialogShell';

export const CommunityDetailDialog = ({ title, eyebrow, onClose, children, className = '' }: {
  title: string; eyebrow: string; onClose: () => void; children: ReactNode; className?: string;
}) => {
  const titleId = useId();
  return <DialogShell className={`community-detail-dialog ${className}`} backdropClassName="community-detail-backdrop" labelId={titleId} onClose={onClose}>
    <header><div><small>{eyebrow}</small><h2 id={titleId}>{title}</h2></div><button type="button" className="icon-button" aria-label="关闭详情" onClick={onClose}><X size={20} /></button></header>
    <div className="community-detail-body">{children}</div>
  </DialogShell>;
};
