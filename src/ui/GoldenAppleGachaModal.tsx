import { useEffect, useRef, useState } from 'react';
import { Check, Coins, Dices, Download, FastForward, Gift, Heart, History, List as ListIcon, Package, Sparkles, Ticket, X } from 'lucide-react';
import {
  getInventoryItem,
  getGachaRewardItems,
  goldenAppleGachaRewards,
  goldenAppleGachaJackpotPityThreshold,
  goldenAppleGachaSingleCost,
  goldenAppleGachaStarterGiftRewardId,
  goldenAppleGachaStarterGiftTickets,
  goldenAppleGachaTenCost,
  goldenAppleHeartGachaRewards,
  goldenAppleHeartGachaSingleCost,
  goldenAppleHeartGachaTenCost,
  type GachaPaymentMethod,
  type GachaResult,
  type GoldenAppleGachaDrawOutcome,
  type GoldenAppleGachaState,
  type PetState,
} from '../core/pet';
import type { SfxId } from '../core/audio';
import { currencyIcon, unknownItemIcon } from '../assets';
import { t } from '../i18n';
import { DialogShell } from './DialogShell';
import { formatCompactNumber } from './numberFormat';
import { getGachaRewardContentLabels, getGachaRewardLabel, summarizeGachaResults, type GachaDisplayReward } from './gachaRewards';
import { features } from '../platform/edition';

type GachaAnimationPhase = 'idle' | 'charging' | 'burst' | 'revealing' | 'results';
type GachaDetailKind = 'probabilities' | 'history';
type GachaMachine = 'apple' | 'heart';
type PendingGachaDraw =
  | { machine: 'apple'; count: 1 | 10; payment: GachaPaymentMethod }
  | { machine: 'heart'; count: 1 | 10 };

export const GachaMachineArt = ({ machine, phase, itemIconMap }: { machine: GachaMachine; phase: GachaAnimationPhase; itemIconMap: Partial<Record<string, string>> }) => <div className={`v2-gacha-machine v2-gacha-machine--${machine}`} data-phase={phase} aria-hidden="true"><div className="v2-gacha-globe">{[0, 1, 2, 3, 4].map((index) => <span key={index} className="v2-gacha-prize">{machine === 'heart' ? <Heart size={42} /> : <img src={itemIconMap[['golden_apple', 'strawberry_milk', 'orange', 'apple', 'banana'][index]] ?? unknownItemIcon} alt="" />}</span>)}</div><div className="v2-gacha-base"><span className="v2-gacha-knob" /></div><div className="v2-gacha-slot" /></div>;

const gachaSkipDelayMs = 300;
const gachaBurstDelayMs = 650;
const gachaRevealDelayMs = 1050;
const gachaTenRevealIntervalMs = 440;
const gachaReducedMotionRevealIntervalMs = 120;

interface GoldenAppleGachaModalProps {
  pet: PetState;
  itemIconMap: Partial<Record<string, string>>;
  onClose: () => void;
  onDraw: (payment: GachaPaymentMethod, count: 1 | 10) => GoldenAppleGachaDrawOutcome;
  onHeartDraw: (count: 1 | 10) => GoldenAppleGachaDrawOutcome;
  onClaimStarterGift: () => boolean;
  isSavingResults: boolean;
  saveFeedback: string;
  onSaveResults: (machine: GachaMachine, results: readonly GachaResult[]) => void;
  onClearSaveFeedback: () => void;
  onPlaySfx: (id: SfxId) => void;
}

interface GachaDetailDialogProps {
  kind: GachaDetailKind;
  machine: GachaMachine;
  results: readonly GachaResult[];
  gachaState: Pick<GoldenAppleGachaState, 'jackpotPityMisses' | 'jackpotPityUsed'>;
  itemIconMap: Partial<Record<string, string>>;
  onClose: () => void;
}

interface GachaDrawConfirmDialogProps {
  draw: PendingGachaDraw;
  goldenAppleCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export const GachaRewardArtwork = ({ reward, itemIconMap }: { reward: GachaDisplayReward; itemIconMap: Partial<Record<string, string>> }) => (
  <span className="gacha-reward-artwork" data-kind={reward.kind} aria-hidden="true">
    {reward.kind === 'coins' ? <Coins size={32} /> : reward.kind === 'hearts' ? <Heart size={32} /> : (
      <span className="gacha-reward-artwork__items" data-count={getGachaRewardItems(reward).length}>
        {getGachaRewardItems(reward).slice(0, 3).map(({ itemId }) => <img key={itemId} src={itemIconMap[itemId] ?? unknownItemIcon} alt="" />)}
      </span>
    )}
    {reward.kind === 'bundle' ? <Package className="gacha-reward-artwork__badge" size={17} /> : null}
  </span>
);

export const GachaRewardContents = ({ reward }: { reward: GachaDisplayReward }) => reward.kind === 'bundle' ? (
  <span className="gacha-reward-contents">
    {getGachaRewardContentLabels(reward).map((label) => <span key={label}>{label}</span>)}
  </span>
) : null;

export const GachaResultsSummary = ({ results, itemIconMap }: { results: readonly GachaResult[]; itemIconMap: Partial<Record<string, string>> }) => {
  const summary = summarizeGachaResults(results);
  return (
    <section className="gacha-arrival-summary" aria-label={t('ui.gacha.arrivalTitle')}>
      <h3><Check size={17} aria-hidden="true" />{t('ui.gacha.arrivalTitle')}</h3>
      <ul>
        {summary.coins > 0 ? <li><Coins size={19} aria-hidden="true" />{t('ui.gacha.coinReward', { coins: formatCompactNumber(summary.coins) })}</li> : null}
        {summary.hearts > 0 ? <li><Heart size={19} aria-hidden="true" />{t('ui.gacha.heartReward', { hearts: formatCompactNumber(summary.hearts) })}</li> : null}
        {summary.items.map(({ itemId, amount }) => <li key={itemId}><img src={itemIconMap[itemId] ?? unknownItemIcon} alt="" />{getInventoryItem(itemId)?.name ?? itemId}<strong>×{amount}</strong></li>)}
      </ul>
    </section>
  );
};

const formatProbability = (weight: number) => {
  const percent = weight / 1000;
  return `${percent.toFixed(3).replace(/\.0+$|0+$/g, '').replace(/\.$/, '')}%`;
};

const supplyPoolGroups = [
  { key: 'supplies', matches: (reward: typeof goldenAppleGachaRewards[number]) => reward.kind === 'bundle' },
  { key: 'garden', matches: (reward: typeof goldenAppleGachaRewards[number]) => reward.kind === 'item' && Boolean(reward.itemId && ['normal_fertilizer', 'heart_fertilizer', 'harvest_nutrient'].includes(reward.itemId)) },
  { key: 'coins', matches: (reward: typeof goldenAppleGachaRewards[number]) => reward.kind === 'coins' },
  { key: 'apples', matches: (reward: typeof goldenAppleGachaRewards[number]) => reward.itemId === 'golden_apple' },
  { key: 'saplings', matches: (reward: typeof goldenAppleGachaRewards[number]) => Boolean(reward.itemId?.endsWith('_sapling')) },
].map(({ key, matches }) => ({ key, weight: goldenAppleGachaRewards.filter(matches).reduce((sum, reward) => sum + reward.weight, 0) }));

const GachaPrizePreview = ({ machine, itemIconMap, onOpenProbabilities, disabled }: {
  machine: GachaMachine; itemIconMap: Partial<Record<string, string>>; onOpenProbabilities: () => void; disabled: boolean;
}) => {
  const rewards = machine === 'heart' ? goldenAppleHeartGachaRewards : goldenAppleGachaRewards.filter((reward) => reward.kind === 'bundle');
  return (
    <section className="gacha-prize-preview" aria-labelledby="gacha-preview-title">
      <header><h3 id="gacha-preview-title">{t('ui.gacha.previewTitle')}</h3><button type="button" className="text-button" disabled={disabled} onClick={onOpenProbabilities}>{t('ui.gacha.probabilities')}</button></header>
      {machine === 'apple' ? <ul className="gacha-pool-groups">{supplyPoolGroups.map(({ key, weight }) => <li key={key}>{t(`ui.gacha.groups.${key}`)}<strong>{formatProbability(weight)}</strong></li>)}</ul> : null}
      <p className="gacha-preview-note">{t(machine === 'apple' ? 'ui.gacha.bundleDelivery' : 'ui.gacha.heartPreviewNote')}</p>
      <ul className="gacha-prize-list">
        {rewards.map((reward) => <li key={reward.id}>
          <GachaRewardArtwork reward={reward} itemIconMap={itemIconMap} />
          <span className="gacha-prize-copy"><strong>{getGachaRewardLabel(reward)}</strong><GachaRewardContents reward={reward} /></span>
          <strong className="gacha-prize-rate">{formatProbability(reward.weight)}</strong>
        </li>)}
      </ul>
    </section>
  );
};

const getRevealAllSfx = (results: readonly GachaResult[]): SfxId => {
  if (results.some((result) => result.rarity === 'jackpot')) return 'notification';
  if (results.some((result) => result.rarity === 'legendary')) return 'purchase';
  return 'open';
};

export const GachaDetailDialog = ({ kind, machine, results, gachaState, itemIconMap, onClose }: GachaDetailDialogProps) => {
  const isProbability = kind === 'probabilities';
  const rewards = machine === 'heart' ? goldenAppleHeartGachaRewards : goldenAppleGachaRewards;
  const titleId = isProbability ? 'gacha-probabilities-title' : 'gacha-history-title';
  const pityProgress = Math.min(goldenAppleGachaJackpotPityThreshold, Math.max(0, gachaState.jackpotPityMisses));
  return (
    <DialogShell
      className="gacha-detail-modal"
      backdropClassName="gacha-detail-backdrop"
      labelId={titleId}
      onClose={onClose}
    >
      <header className="dialog-header">
        <div className="dialog-title-group">
          <span className="dialog-title-icon" aria-hidden="true">
            {isProbability ? <ListIcon size={21} /> : <History size={21} />}
          </span>
          <h2 id={titleId}>{t(isProbability ? 'ui.gacha.probabilities' : 'ui.gacha.recentTitle')}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t('ui.gacha.closeDetails')} title={t('ui.gacha.closeDetails')}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      {isProbability ? (
        <div className="gacha-probability-content">
          <ul className="gacha-prize-list gacha-prize-list--full">
          {rewards.map((reward) => (
            <li key={reward.id}>
              <GachaRewardArtwork reward={reward} itemIconMap={itemIconMap} />
              <span className="gacha-prize-copy"><strong>{getGachaRewardLabel(reward)}</strong><GachaRewardContents reward={reward} /></span>
              <strong className="gacha-prize-rate">{formatProbability(reward.weight)}</strong>
            </li>
          ))}
          </ul>
          {machine === 'apple' ? <p className="gacha-preview-note">{t('ui.gacha.bundleDelivery')}</p> : null}
          <p className="gacha-detail-modal__note">
            {t(machine === 'heart' ? 'ui.gacha.heartGuaranteeNote' : 'ui.gacha.guaranteeNote')}
          </p>
          {machine === 'apple' && !gachaState.jackpotPityUsed ? (
            <aside className="gacha-pity-status">
              <strong>{t('ui.gacha.pityProgress', { current: pityProgress, threshold: goldenAppleGachaJackpotPityThreshold })}</strong>
              <p>{t('ui.gacha.pityRule', { threshold: goldenAppleGachaJackpotPityThreshold })}</p>
            </aside>
          ) : null}
        </div>
      ) : results.length > 0 ? (
        <ol className="gacha-history-list">
          {results.slice(0, 20).map((result) => (
            <li key={result.id} className={`gacha-history-item gacha-history-item--${result.rarity}`}>
              <GachaRewardArtwork reward={result} itemIconMap={itemIconMap} />
              <span className="gacha-history-item__copy">
                <strong>{getGachaRewardLabel(result)}</strong>
                <GachaRewardContents reward={result} />
                {result.guaranteed ? <small>{t(machine === 'heart' ? 'ui.gacha.heartGuaranteed' : 'ui.gacha.guaranteed')}</small> : null}
                {result.pityGuaranteed ? <small className="gacha-pity-label">{t('ui.gacha.pityGuaranteed')}</small> : null}
              </span>
              <span className="gacha-history-item__rarity">{t(`ui.gacha.rarity.${result.rarity}`)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="gacha-history-empty">{t('ui.gacha.recentEmpty')}</p>
      )}
    </DialogShell>
  );
};

const GachaDrawConfirmDialog = ({ draw, goldenAppleCount, onCancel, onConfirm }: GachaDrawConfirmDialogProps) => {
  const isHeartMachine = draw.machine === 'heart';
  const cost = isHeartMachine
    ? draw.count === 10 ? goldenAppleHeartGachaTenCost : goldenAppleHeartGachaSingleCost
    : draw.payment === 'coins'
      ? draw.count === 10 ? goldenAppleGachaTenCost : goldenAppleGachaSingleCost
      : draw.count;
  const messageKey = isHeartMachine
    ? 'ui.gacha.confirm.goldenApples'
    : draw.payment === 'coins' ? 'ui.gacha.confirm.coins' : 'ui.gacha.confirm.tickets';
  return (
    <DialogShell
      className="confirm-modal gacha-draw-confirm"
      backdropClassName="modal-backdrop--confirm"
      labelId="gacha-draw-confirm-title"
      onClose={onCancel}
      role="alertdialog"
    >
      <div className={`confirm-modal__icon gacha-draw-confirm__icon${isHeartMachine ? ' gacha-draw-confirm__icon--heart' : ''}`} aria-hidden="true">
        {isHeartMachine ? <Heart size={28} /> : <Dices size={28} />}
      </div>
      <div className="confirm-modal__copy">
        <h2 id="gacha-draw-confirm-title">{t(isHeartMachine ? 'ui.gacha.confirm.appleTitle' : 'ui.gacha.confirm.title')}</h2>
        <p>{t(messageKey, {
          count: draw.count,
          cost: formatCompactNumber(cost),
          remaining: formatCompactNumber(Math.max(0, goldenAppleCount - cost)),
        })}</p>
      </div>
      <div className="confirm-modal__actions">
        <button type="button" className="text-button confirm-modal__cancel" onClick={onCancel}>
          {t('ui.gacha.confirm.cancel')}
        </button>
        <button type="button" className="primary-button confirm-modal__confirm gacha-draw-confirm__submit" onClick={onConfirm}>
          {t('ui.gacha.confirm.submit')}
        </button>
      </div>
    </DialogShell>
  );
};

export const GoldenAppleGachaModal = ({
  pet,
  itemIconMap,
  onClose,
  onDraw,
  onHeartDraw,
  onClaimStarterGift,
  isSavingResults,
  saveFeedback,
  onSaveResults,
  onClearSaveFeedback,
  onPlaySfx,
}: GoldenAppleGachaModalProps) => {
  const [machine, setMachine] = useState<GachaMachine>('apple');
  const [payment, setPayment] = useState<GachaPaymentMethod>('coins');
  const [phase, setPhase] = useState<GachaAnimationPhase>('idle');
  const [results, setResults] = useState<GachaResult[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [starterFeedback, setStarterFeedback] = useState('');
  const [detailKind, setDetailKind] = useState<GachaDetailKind | null>(null);
  const [pendingDraw, setPendingDraw] = useState<PendingGachaDraw | null>(null);
  const timersRef = useRef<number[]>([]);
  const feedbackTimerRef = useRef<number>();
  const drawLockRef = useRef(false);
  const isAnimating = phase === 'charging' || phase === 'burst' || phase === 'revealing';
  const goldenAppleCount = pet.inventory.golden_apple ?? 0;
  const hasClaimedStarterGift = pet.claimedRewardIds.includes(goldenAppleGachaStarterGiftRewardId);
  const showingResults = phase === 'revealing' || phase === 'results';
  const availableCurrency = machine === 'heart' ? goldenAppleCount : payment === 'coins' ? pet.coins : pet.goldenAppleGacha.tickets;
  const singleCost = machine === 'heart' ? goldenAppleHeartGachaSingleCost : payment === 'coins' ? goldenAppleGachaSingleCost : 1;
  const tenCost = machine === 'heart' ? goldenAppleHeartGachaTenCost : payment === 'coins' ? goldenAppleGachaTenCost : 10;

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  useEffect(() => () => {
    clearTimers();
    if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
  }, []);

  const finishReveal = (drawResults = results) => {
    clearTimers();
    setCanSkip(false);
    setRevealedCount(drawResults.length);
    setPhase('results');
    drawLockRef.current = false;
  };

  const revealAll = () => {
    if (!canSkip || !isAnimating) return;
    finishReveal();
    onPlaySfx(getRevealAllSfx(results));
  };

  const beginReveal = (drawResults: GachaResult[], interval: number) => {
    setPhase('revealing');
    drawResults.forEach((result, index) => {
      timersRef.current.push(window.setTimeout(() => {
        setRevealedCount(index + 1);
        if (result.rarity === 'jackpot') onPlaySfx('notification');
        else if (result.rarity === 'legendary') onPlaySfx('purchase');
        else onPlaySfx('tap');
        if (index === drawResults.length - 1) {
          setCanSkip(false);
          setPhase('results');
          drawLockRef.current = false;
        }
      }, index * interval));
    });
  };

  const executeDraw = (draw: PendingGachaDraw) => {
    if (isAnimating || drawLockRef.current || detailKind) return;
    clearTimers();
    onClearSaveFeedback();
    drawLockRef.current = true;
    const outcome = draw.machine === 'heart'
      ? onHeartDraw(draw.count)
      : onDraw(draw.payment, draw.count);
    if (outcome.error) {
      drawLockRef.current = false;
      const key = outcome.error === 'inventory_full'
        ? 'ui.gacha.inventoryFull'
        : outcome.error === 'not_enough_tickets'
        ? 'ui.gacha.notEnoughTickets'
        : outcome.error === 'not_enough_golden_apples'
          ? 'ui.gacha.notEnoughGoldenApples'
          : 'ui.gacha.notEnoughCoins';
      setErrorText(t(key));
      onPlaySfx('error');
      return;
    }

    const drawResults = outcome.results;
    setErrorText('');
    setResults(drawResults);
    setRevealedCount(0);
    setCanSkip(false);
    onPlaySfx('coin');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setPhase('revealing');
      timersRef.current.push(window.setTimeout(() => setCanSkip(drawResults.length > 1), gachaSkipDelayMs));
      beginReveal(drawResults, gachaReducedMotionRevealIntervalMs);
      return;
    }

    setPhase('charging');
    timersRef.current.push(window.setTimeout(() => setCanSkip(true), gachaSkipDelayMs));
    timersRef.current.push(window.setTimeout(() => {
      setPhase('burst');
      onPlaySfx('open');
    }, gachaBurstDelayMs));
    timersRef.current.push(window.setTimeout(() => beginReveal(drawResults, drawResults.length === 10 ? gachaTenRevealIntervalMs : 0), gachaRevealDelayMs));
  };

  const requestDraw = (count: 1 | 10) => {
    if (isAnimating || drawLockRef.current || detailKind || pendingDraw) return;
    if (machine === 'heart' && goldenAppleCount < count) {
      setErrorText(t('ui.gacha.notEnoughGoldenApples'));
      onPlaySfx('error');
      return;
    }
    onPlaySfx('open');
    setPendingDraw(machine === 'heart' ? { machine, count } : { machine, count, payment });
  };

  const cancelDraw = () => {
    onPlaySfx('close');
    setPendingDraw(null);
  };

  const confirmDraw = () => {
    if (!pendingDraw) return;
    const draw = pendingDraw;
    setPendingDraw(null);
    executeDraw(draw);
  };

  const handleClaimStarterGift = () => {
    if (isAnimating || !onClaimStarterGift()) return;
    onPlaySfx('notification');
    setStarterFeedback(t('ui.gacha.starterGiftClaimed', { count: goldenAppleGachaStarterGiftTickets }));
    if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setStarterFeedback(''), 2200);
  };

  const openDetail = (kind: GachaDetailKind) => {
    if (isAnimating) return;
    onPlaySfx('open');
    setDetailKind(kind);
  };

  const closeDetail = () => {
    onPlaySfx('close');
    setDetailKind(null);
  };

  const selectMachine = (nextMachine: GachaMachine) => {
    if (nextMachine === machine || isAnimating || drawLockRef.current || pendingDraw || detailKind) return;
    clearTimers();
    setMachine(nextMachine);
    setPhase('idle');
    setResults([]);
    setRevealedCount(0);
    setCanSkip(false);
    setErrorText('');
    setStarterFeedback('');
    onClearSaveFeedback();
    onPlaySfx('tap');
  };

  const handleSaveResults = () => {
    if (phase !== 'results' || results.length === 0 || isSavingResults) return;
    onSaveResults(machine, results);
  };

  const returnToPool = () => {
    setPhase('idle');
    setResults([]);
    setRevealedCount(0);
    setErrorText('');
    onClearSaveFeedback();
    onPlaySfx('tap');
  };

  return (
    <>
      <DialogShell fullscreen className="gacha-modal gacha-supply-modal" labelId="gacha-title" onClose={onClose}>
        <header className="dialog-header gacha-modal__header">
          <div className="dialog-title-group">
            <span className="dialog-title-icon gacha-modal__title-icon" aria-hidden="true"><Dices size={22} /></span>
            <div>
              <h2 id="gacha-title">{t('ui.gacha.title')}</h2>
              <p>{t(machine === 'heart' ? 'ui.gacha.heartSubtitle' : 'ui.gacha.subtitle')}</p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('ui.gacha.close')} title={t('ui.gacha.close')}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="gacha-machine-tabs" role="group" aria-label={t('ui.gacha.machineAria')}>
          <button
            type="button"
            aria-pressed={machine === 'apple'}
            onClick={() => selectMachine('apple')}
            disabled={isAnimating || Boolean(pendingDraw)}
          >
            <Dices size={17} aria-hidden="true" />{t('ui.gacha.machineOne')}
          </button>
          <button
            type="button"
            aria-pressed={machine === 'heart'}
            onClick={() => selectMachine('heart')}
            disabled={isAnimating || Boolean(pendingDraw)}
          >
            <Heart size={17} aria-hidden="true" />{t('ui.gacha.machineTwo')}
          </button>
        </div>

        <div className="gacha-wallet" aria-label={t('ui.gacha.walletAria')}>
          {machine === 'apple' ? (
            <>
              <span title={String(pet.coins)}><img src={currencyIcon} alt="" aria-hidden="true" /><small>{t('ui.gacha.payCoins')}</small><strong>{formatCompactNumber(pet.coins)}</strong></span>
              <span title={String(pet.goldenAppleGacha.tickets)}><Ticket size={17} aria-hidden="true" /><small>{t('ui.gacha.payTickets')}</small><strong>{formatCompactNumber(pet.goldenAppleGacha.tickets)}</strong></span>
              <span title={String(goldenAppleCount)}><img src={itemIconMap.golden_apple ?? unknownItemIcon} alt="" aria-hidden="true" /><small>{t('ui.gacha.groups.apples')}</small><strong>{formatCompactNumber(goldenAppleCount)}</strong></span>
            </>
          ) : (
            <>
              <span title={String(goldenAppleCount)}><img src={itemIconMap.golden_apple ?? unknownItemIcon} alt="" aria-hidden="true" /><small>{t('ui.gacha.groups.apples')}</small><strong>{formatCompactNumber(goldenAppleCount)}</strong></span>
              <span title={String(pet.hearts)}><Heart size={17} aria-hidden="true" /><small>{t('ui.gacha.heartsLabel')}</small><strong>{formatCompactNumber(pet.hearts)}</strong></span>
            </>
          )}
        </div>

        <div className={`gacha-supply-layout${showingResults ? ' gacha-supply-layout--results' : ''}`}>
        <div className="gacha-play-panel">
        {machine === 'apple' && !hasClaimedStarterGift && !isAnimating ? (
          <button type="button" className="gacha-welcome-gift" onClick={handleClaimStarterGift}>
            <Gift size={20} aria-hidden="true" /><span><strong>{t('ui.gacha.starterGift')}</strong><small>{t('ui.gacha.starterGiftHint', { count: goldenAppleGachaStarterGiftTickets })}</small></span>
          </button>
        ) : null}
        {starterFeedback ? <p className="gacha-inline-feedback" role="status">{starterFeedback}</p> : null}
        {showingResults ? <div className="gacha-results-heading"><h3>{t('ui.gacha.resultsTitle', { count: results.length })}</h3><span>{revealedCount}/{results.length}</span></div> : null}
        <div
          className={`gacha-stage gacha-stage--${phase}${machine === 'heart' ? ' gacha-stage--heart-machine' : ''}${results.slice(0, revealedCount).some((result) => result.rarity === 'jackpot') ? ' gacha-stage--jackpot' : ''}${canSkip && isAnimating ? ' gacha-stage--skippable' : ''}`}
          aria-live="polite"
          onClick={canSkip && isAnimating ? revealAll : undefined}
        >
          {phase === 'idle' || phase === 'charging' ? (
            <div className="gacha-machine-display">
            <span className="gacha-machine-caption">{t(machine === 'heart' ? 'ui.gacha.heartMachineCaption' : 'ui.gacha.supplyMachineCaption')}</span>
            <GachaMachineArt machine={machine} phase={phase} itemIconMap={itemIconMap} />
            <p>{t(machine === 'heart' ? 'ui.gacha.heartTopPrize' : 'ui.gacha.supplyTopPrize')}</p>
            </div>
          ) : phase === 'burst' ? (
            <div className="gacha-animation" aria-label={t('ui.gacha.burst')}>
              <div className="gacha-animation__core">
                {machine === 'heart' ? <Heart size={48} aria-hidden="true" /> : <Dices size={48} aria-hidden="true" />}
              </div>
              <Sparkles className="gacha-animation__spark gacha-animation__spark--one" aria-hidden="true" />
              <Sparkles className="gacha-animation__spark gacha-animation__spark--two" aria-hidden="true" />
            </div>
          ) : (
            <div className={results.length === 1 ? 'gacha-results gacha-results--single' : 'gacha-results'}>
              {results.map((result, index) => {
                const visible = index < revealedCount;
                return (
                  <article
                    key={result.id}
                    className={`gacha-result gacha-result--${result.rarity}${visible ? ' gacha-result--visible' : ''}`}
                    aria-hidden={!visible}
                  >
                    <span className="gacha-result-rarity">{t(`ui.gacha.rarity.${result.rarity}`)}</span>
                    <GachaRewardArtwork reward={result} itemIconMap={itemIconMap} />
                    <strong>{getGachaRewardLabel(result)}</strong>
                    <GachaRewardContents reward={result} />
                    {result.guaranteed ? <small>{t(machine === 'heart' ? 'ui.gacha.heartGuaranteed' : 'ui.gacha.guaranteed')}</small> : null}
                    {result.pityGuaranteed ? <small className="gacha-pity-label">{t('ui.gacha.pityGuaranteed')}</small> : null}
                    {result.rarity === 'jackpot' ? <span className="gacha-result__jackpot">{t('ui.gacha.jackpot')}</span> : null}
                  </article>
                );
              })}
            </div>
          )}
          {canSkip && isAnimating ? (
            <button
              type="button"
              className="gacha-skip"
              onClick={(event) => {
                event.stopPropagation();
                revealAll();
              }}
            >
              <FastForward size={16} aria-hidden="true" />{t('ui.gacha.revealAll')}
            </button>
          ) : null}
        </div>

        {phase === 'results' ? <GachaResultsSummary results={results} itemIconMap={itemIconMap} /> : null}
        <div className="gacha-controls">
          <p className="gacha-guarantee-hint"><Sparkles size={16} aria-hidden="true" />{t(machine === 'heart' ? 'ui.gacha.heartGuaranteed' : 'ui.gacha.guaranteed')}</p>
          {machine === 'apple' ? (
            <div className="gacha-payment" role="group" aria-label={t('ui.gacha.paymentAria')}>
              <button type="button" aria-pressed={payment === 'coins'} onClick={() => { setPayment('coins'); setErrorText(''); }} disabled={isAnimating}>
                <Coins size={17} aria-hidden="true" />{t('ui.gacha.payCoins')}
              </button>
              <button type="button" aria-pressed={payment === 'tickets'} onClick={() => { setPayment('tickets'); setErrorText(''); }} disabled={isAnimating}>
                <Ticket size={17} aria-hidden="true" />{t('ui.gacha.payTickets')}
              </button>
            </div>
          ) : null}
          <div className="gacha-draw-actions">
            <button type="button" className="secondary-button" onClick={() => requestDraw(1)} disabled={isAnimating || Boolean(pendingDraw) || availableCurrency < singleCost}>
              {machine === 'heart' ? <img src={itemIconMap.golden_apple ?? unknownItemIcon} alt="" /> : payment === 'coins' ? <Coins size={18} aria-hidden="true" /> : <Ticket size={18} aria-hidden="true" />}
              {t(machine === 'heart' ? 'ui.gacha.heartSingleDraw' : 'ui.gacha.singleDraw', {
                cost: singleCost,
              })}
            </button>
            <button type="button" className="primary-button" onClick={() => requestDraw(10)} disabled={isAnimating || Boolean(pendingDraw) || availableCurrency < tenCost}>
              {machine === 'heart' ? <img src={itemIconMap.golden_apple ?? unknownItemIcon} alt="" /> : payment === 'coins' ? <Coins size={18} aria-hidden="true" /> : <Ticket size={18} aria-hidden="true" />}
              {t(machine === 'heart' ? 'ui.gacha.heartTenDraw' : 'ui.gacha.tenDraw', {
                cost: tenCost,
              })}
            </button>
          </div>
          {machine === 'apple' && payment === 'tickets' ? (
            <small className="gacha-controls__hint">{t('ui.gacha.ticketCostHint')}</small>
          ) : null}
          {errorText ? <p className="gacha-error" role="alert">{errorText}</p> : null}
          {!errorText && availableCurrency < singleCost ? <p className="gacha-error">{t(machine === 'heart' ? 'ui.gacha.notEnoughGoldenApples' : payment === 'tickets' ? 'ui.gacha.notEnoughTickets' : 'ui.gacha.notEnoughCoins')}</p> : null}
          {phase === 'results' && results.length > 0 ? (
            <button type="button" className="secondary-button gacha-save-results" disabled={!features.shareCards || isSavingResults} title={!features.shareCards ? t('ui.editionNotice.restricted') : undefined} onClick={handleSaveResults}>
              <Download size={17} aria-hidden="true" />
              {isSavingResults ? t('ui.gacha.resultCardSaving') : t('ui.gacha.resultCardSave')}
            </button>
          ) : null}
          {saveFeedback ? <p className="gacha-share-feedback" role="status">{saveFeedback}</p> : null}
        </div>

        <div className="gacha-detail-actions" aria-label={t('ui.gacha.detailsAria')}>
          {phase === 'results' ? <button type="button" className="secondary-button" onClick={returnToPool}><Package size={17} aria-hidden="true" />{t('ui.gacha.backToPool')}</button> : null}
          <button type="button" className="secondary-button" onClick={() => openDetail('probabilities')} disabled={isAnimating}>
            <ListIcon size={17} aria-hidden="true" />{t('ui.gacha.probabilities')}
          </button>
          <button type="button" className="secondary-button" onClick={() => openDetail('history')} disabled={isAnimating}>
            <History size={17} aria-hidden="true" />{t('ui.gacha.recentTitle')}
          </button>
        </div>
        </div>
        {!showingResults ? <GachaPrizePreview machine={machine} itemIconMap={itemIconMap} disabled={isAnimating} onOpenProbabilities={() => openDetail('probabilities')} /> : null}
        </div>
      </DialogShell>

      {detailKind ? (
        <GachaDetailDialog
          kind={detailKind}
          machine={machine}
          results={machine === 'heart' ? pet.goldenAppleGacha.recentHeartResults : pet.goldenAppleGacha.recentResults}
          gachaState={pet.goldenAppleGacha}
          itemIconMap={itemIconMap}
          onClose={closeDetail}
        />
      ) : null}
      {pendingDraw ? (
        <GachaDrawConfirmDialog
          draw={pendingDraw}
          goldenAppleCount={goldenAppleCount}
          onCancel={cancelDraw}
          onConfirm={confirmDraw}
        />
      ) : null}
    </>
  );
};
