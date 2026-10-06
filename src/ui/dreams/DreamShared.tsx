import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, ChefHat, Coins, Footprints, Gift, Heart, Sparkles, Sprout, X } from 'lucide-react';
import { getDreamStageReward, type PartnerScheduleCategory, type PetState } from '../../core/pet';
import { t } from '../../i18n';
import { DialogShell, useCloseDialogScope } from '../DialogShell';
import { formatInteger } from '../numberFormat';

export const dreamIcons = { study: BookOpen, cooking: ChefHat, garden: Sprout, exercise: Footprints };
export const dreamTitle = (category: PartnerScheduleCategory) => t(`ui.classicEndgame.projects.${category}.title`);
export const dreamCategoryLabel = (category: PartnerScheduleCategory) => t(`ui.classicEndgame.layout.categories.${category}`);
export const dreamStageName = (category: PartnerScheduleCategory, stage: number) => t(`ui.classicEndgame.projects.${category}.stages.${stage}`);
export const dreamNumber = (value: number) => Number(formatInteger(value)).toLocaleString();
export const dreamText = (key: string, params?: Record<string, string | number>) => t(`ui.classicEndgame.layout.${key}`, params);

export interface DreamArtwork {
  portrait: string;
  projectImages: Record<PartnerScheduleCategory, string>;
  itemIconMap: Record<string, string>;
}

interface DreamDialogProps {
  title: string;
  labelId: string;
  onClose: () => void;
  onBack?: () => void;
  children: ReactNode;
  footer: ReactNode;
  controls?: ReactNode;
  alert?: boolean;
  viewKey?: string;
}

export const DreamDialog = ({ title, labelId, onClose, onBack, children, footer, controls, alert, viewKey }: DreamDialogProps) => {
  const closeAll = useCloseDialogScope();
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => { if (body.current) body.current.scrollTop = 0; }, [viewKey]);
  return <DialogShell className="dreams-dialog" backdropClassName="dreams-backdrop" labelId={labelId}
    onClose={onClose} historyNavigation closeOnBackdrop role={alert ? 'alertdialog' : 'dialog'}>
    <div className="dreams-dialog-grip" aria-hidden="true" />
    <header className="dreams-dialog-header">
      {onBack ? <button type="button" className="dreams-icon" onClick={onBack} aria-label={dreamText('back')}><ArrowLeft size={18} /></button> : <Sparkles size={20} aria-hidden="true" />}
      <h2 id={labelId}>{title}</h2>
      <button type="button" className="dreams-icon" onClick={closeAll ?? onClose} aria-label={dreamText('close')}><X size={19} /></button>
    </header>
    {controls}
    <div className="dreams-dialog-body" ref={body}>{children}</div>
    <footer className="dreams-dialog-footer">{footer}</footer>
  </DialogShell>;
};

export const DreamConfirmation = ({ title, message, disabled, onCancel, onConfirm, children, confirmLabel }: {
  title: string; message: string; disabled?: boolean; onCancel: () => void; onConfirm: () => void; children?: ReactNode; confirmLabel?: string;
}) => <DreamDialog title={title} labelId="dream-confirmation-title" onClose={onCancel} onBack={onCancel} alert
  footer={<div className="dreams-confirm-actions"><button type="button" className="dreams-secondary" onClick={onCancel}>{dreamText('back')}</button><button type="button" className="dreams-primary" disabled={disabled} onClick={onConfirm}>{confirmLabel ?? t('ui.classicEndgame.confirm.confirm')}</button></div>}>
  <div className="dreams-confirmation"><Coins size={34} aria-hidden="true" /><p>{message}</p>{children}</div>
</DreamDialog>;

export const DreamBar = ({ value, total }: { value: number; total: number }) => <div className="dreams-bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, total > 0 ? value / total * 100 : 100))}%` }} /></div>;

export const DreamRequirement = ({ icon, label, current, target, level = false }: {
  icon: ReactNode; label: string; current: number; target: number; level?: boolean;
}) => <div className={`dreams-requirement ${current >= target ? 'is-met' : 'is-missing'}`}>
  {icon}<span>{label}</span><strong>{level ? 'Lv.' : ''}{dreamNumber(current)} <small>/ {dreamNumber(target)}</small></strong>
  {current >= target ? <CheckCircle2 size={15} aria-label={dreamText('completedStage')} /> : <span className="dreams-missing" aria-hidden="true">!</span>}
</div>;

export const DreamReward = ({ stage, itemIconMap }: { stage: number; itemIconMap: Record<string, string> }) => {
  const reward = getDreamStageReward(stage);
  if (!reward) return null;
  return <div className="dreams-reward"><Gift size={15} aria-hidden="true" /><span>{dreamText('stageReward')}</span>
    <span><Heart size={13} aria-hidden="true" />+{dreamNumber(reward.hearts)}</span>
    {reward.itemId && <span>{itemIconMap[reward.itemId] && <img src={itemIconMap[reward.itemId]} alt="" />}{t(`pet.shop.items.${reward.itemId}.name`)} ×{dreamNumber(reward.itemAmount ?? 1)}</span>}
  </div>;
};

export const useDreamInvestment = (cost: number, invested: number, coins: number) => {
  const [choice, setChoice] = useState('fill');
  const remaining = Math.max(0, cost - invested);
  const available = Math.max(0, Math.floor(coins));
  const choices = [
    { key: 'ten', amount: Math.min(remaining, available, Math.max(1, Math.floor(cost * .1))) },
    { key: 'quarter', amount: Math.min(remaining, available, Math.max(1, Math.floor(cost * .25))) },
    { key: 'fill', amount: Math.min(remaining, available) },
  ];
  return { choice, setChoice, choices, amount: choices.find(item => item.key === choice)!.amount, remaining };
};

export const DreamFunding = ({ cost, invested, coins, selection }: {
  cost: number; invested: number; coins: number; selection: ReturnType<typeof useDreamInvestment>;
}) => <div className="dreams-funding">
  <div><span>{dreamText('stageFunding')}</span><strong>{dreamNumber(invested)} <small>/ {dreamNumber(cost)}</small></strong></div>
  <DreamBar value={invested} total={cost} />
  {selection.remaining > 0 ? <><div className="dreams-investments" role="group" aria-label={dreamText('selectInvestment')}>
    {selection.choices.map(item => <button type="button" key={item.key} aria-pressed={selection.choice === item.key} className={selection.choice === item.key ? 'is-selected' : ''} onClick={() => selection.setChoice(item.key)}>
      {dreamText(item.key)}<strong>{dreamNumber(item.amount)}</strong>
    </button>)}
  </div><p className="dreams-funding-note"><Coins size={13} aria-hidden="true" />{dreamText('wallet', { coins: dreamNumber(coins) })}</p></> : <p className="dreams-funding-note"><CheckCircle2 size={13} aria-hidden="true" />{dreamText('funded')}</p>}
</div>;

// Display the real action result only after the controller has committed a new state.
export const useDreamAction = (pet: PetState) => {
  const pending = useRef<PetState | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (pending.current && pending.current !== pet) {
      if (pet.recentEvent !== pending.current.recentEvent) setMessage(pet.recentEvent);
      pending.current = null;
    }
  }, [pet]);
  return { message, run: (action: () => void) => { pending.current = pet; setMessage(''); action(); } };
};

export const DreamFeedback = ({ message }: { message: string }) => message ? <p className="dreams-feedback" role="status">{message}</p> : null;
