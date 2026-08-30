import { useEffect, useRef, useState } from 'react';
import { Coins, Dices, Download, FastForward, Gift, Heart, History, List as ListIcon, Sparkles, Ticket, X } from 'lucide-react';
import {
  getInventoryItem,
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

type GachaAnimationPhase = 'idle' | 'charging' | 'burst' | 'revealing' | 'results';
type GachaDetailKind = 'probabilities' | 'history';
type GachaMachine = 'apple' | 'heart';
type PendingGachaDraw =
  | { machine: 'apple'; count: 1 | 10; payment: GachaPaymentMethod }
  | { machine: 'heart'; count: 1 | 10 };

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

const getRewardLabel = (result: Pick<GachaResult, 'kind' | 'amount' | 'itemId'>) => {
  if (result.kind === 'coins') return t('ui.gacha.coinReward', { coins: formatCompactNumber(result.amount) });
  if (result.kind === 'hearts') return t('ui.gacha.heartReward', { hearts: formatCompactNumber(result.amount) });
  const itemName = result.itemId ? getInventoryItem(result.itemId)?.name ?? result.itemId : t('ui.gacha.unknownReward');
  return `${itemName} ×${result.amount}`;
};

const formatProbability = (weight: number) => {
  const percent = weight / 1000;
  return `${percent.toFixed(3).replace(/\.0+$|0+$/g, '').replace(/\.$/, '')}%`;
};

const getRevealAllSfx = (results: readonly GachaResult[]): SfxId => {
  if (results.some((result) => result.rarity === 'jackpot')) return 'notification';
  if (results.some((result) => result.rarity === 'legendary')) return 'purchase';
  return 'open';
};

const GachaDetailDialog = ({ kind, machine, results, gachaState, itemIconMap, onClose }: GachaDetailDialogProps) => {
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
        <div className="gacha-probabilities__list">
          {rewards.map((reward) => (
            <div key={reward.id}>
              <span>{getRewardLabel(reward)}</span>
              <strong>{formatProbability(reward.weight)}</strong>
            </div>
          ))}
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
              <span className={`gacha-history-item__icon${result.kind === 'hearts' ? ' gacha-history-item__icon--heart' : ''}`} aria-hidden="true">
                {result.kind === 'coins'
                  ? <Coins size={24} />
                  : result.kind === 'hearts'
                    ? <Heart size={24} />
                    : <img src={itemIconMap[result.itemId ?? ''] ?? unknownItemIcon} alt="" />}
              </span>
              <span className="gacha-history-item__copy">
                <strong>{getRewardLabel(result)}</strong>
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
      const key = outcome.error === 'not_enough_tickets'
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

  return (
    <>
      <DialogShell className="gacha-modal" labelId="gacha-title" onClose={onClose}>
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
              <span><img src={currencyIcon} alt="" aria-hidden="true" />{formatCompactNumber(pet.coins)}</span>
              <span><Ticket size={17} aria-hidden="true" />{formatCompactNumber(pet.goldenAppleGacha.tickets)}</span>
              <span><img src={itemIconMap.golden_apple ?? unknownItemIcon} alt="" aria-hidden="true" />{formatCompactNumber(goldenAppleCount)}</span>
            </>
          ) : (
            <>
              <span><img src={itemIconMap.golden_apple ?? unknownItemIcon} alt="" aria-hidden="true" />{formatCompactNumber(goldenAppleCount)}</span>
              <span><Heart size={17} aria-hidden="true" />{formatCompactNumber(pet.hearts)}</span>
            </>
          )}
        </div>

        <div
          className={`gacha-stage gacha-stage--${phase}${machine === 'heart' ? ' gacha-stage--heart-machine' : ''}${results.some((result) => result.rarity === 'jackpot') ? ' gacha-stage--jackpot' : ''}${canSkip && isAnimating ? ' gacha-stage--skippable' : ''}`}
          aria-live="polite"
          onClick={canSkip && isAnimating ? revealAll : undefined}
        >
          {machine === 'apple' && !hasClaimedStarterGift && !isAnimating ? (
            <button
              type="button"
              className="gacha-starter-gift"
              onClick={handleClaimStarterGift}
              aria-label={t('ui.gacha.starterGiftHint', { count: goldenAppleGachaStarterGiftTickets })}
              title={t('ui.gacha.starterGiftHint', { count: goldenAppleGachaStarterGiftTickets })}
            >
              <Gift size={20} aria-hidden="true" />
              <span>
                <strong>{t('ui.gacha.starterGift')}</strong>
                <small>{t('ui.gacha.starterGiftHint', { count: goldenAppleGachaStarterGiftTickets })}</small>
              </span>
            </button>
          ) : null}
          {starterFeedback ? <p className="gacha-starter-feedback" role="status">{starterFeedback}</p> : null}

          {phase === 'idle' ? (
            <div className={`gacha-machine${machine === 'heart' ? ' gacha-machine--heart' : ''}`} aria-hidden="true">
              <span className="gacha-machine__cap">{machine === 'heart' ? <Heart size={26} /> : <Sparkles size={26} />}</span>
              <span className="gacha-machine__window">
                {machine === 'heart'
                  ? <Heart className="gacha-machine__heart" size={70} />
                  : <img src={itemIconMap.golden_apple ?? unknownItemIcon} alt="" />}
              </span>
              <span className="gacha-machine__slot" />
            </div>
          ) : isAnimating && phase !== 'revealing' ? (
            <div className="gacha-animation" aria-label={phase === 'charging' ? t('ui.gacha.charging') : t('ui.gacha.burst')}>
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
                    <div className="gacha-result__icon">
                      {result.kind === 'coins'
                        ? <Coins size={results.length === 1 ? 56 : 30} aria-hidden="true" />
                        : result.kind === 'hearts'
                          ? <Heart size={results.length === 1 ? 56 : 30} aria-hidden="true" />
                          : <img src={itemIconMap[result.itemId ?? ''] ?? unknownItemIcon} alt="" aria-hidden="true" />}
                    </div>
                    <strong>{getRewardLabel(result)}</strong>
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

        <div className="gacha-controls">
          {machine === 'apple' ? (
            <div className="gacha-payment" role="group" aria-label={t('ui.gacha.paymentAria')}>
              <button type="button" aria-pressed={payment === 'coins'} onClick={() => setPayment('coins')} disabled={isAnimating}>
                <Coins size={17} aria-hidden="true" />{t('ui.gacha.payCoins')}
              </button>
              <button type="button" aria-pressed={payment === 'tickets'} onClick={() => setPayment('tickets')} disabled={isAnimating}>
                <Ticket size={17} aria-hidden="true" />{t('ui.gacha.payTickets')}
              </button>
            </div>
          ) : null}
          <div className="gacha-draw-actions">
            <button type="button" className="secondary-button" onClick={() => requestDraw(1)} disabled={isAnimating}>
              {t(machine === 'heart' ? 'ui.gacha.heartSingleDraw' : 'ui.gacha.singleDraw', {
                cost: machine === 'heart' ? goldenAppleHeartGachaSingleCost : payment === 'coins' ? goldenAppleGachaSingleCost : 1,
              })}
            </button>
            <button type="button" className="primary-button" onClick={() => requestDraw(10)} disabled={isAnimating}>
              {t(machine === 'heart' ? 'ui.gacha.heartTenDraw' : 'ui.gacha.tenDraw', {
                cost: machine === 'heart' ? goldenAppleHeartGachaTenCost : payment === 'coins' ? goldenAppleGachaTenCost : 10,
              })}
            </button>
          </div>
          {machine === 'apple' && payment === 'tickets' ? (
            <small className="gacha-controls__hint">{t('ui.gacha.ticketCostHint')}</small>
          ) : null}
          {errorText ? <p className="gacha-error" role="alert">{errorText}</p> : null}
          {phase === 'results' && results.length > 0 ? (
            <button type="button" className="secondary-button gacha-save-results" disabled={isSavingResults} onClick={handleSaveResults}>
              <Download size={17} aria-hidden="true" />
              {isSavingResults ? t('ui.gacha.resultCardSaving') : t('ui.gacha.resultCardSave')}
            </button>
          ) : null}
          {saveFeedback ? <p className="gacha-share-feedback" role="status">{saveFeedback}</p> : null}
        </div>

        <div className="gacha-detail-actions" aria-label={t('ui.gacha.detailsAria')}>
          <button type="button" className="secondary-button" onClick={() => openDetail('probabilities')} disabled={isAnimating}>
            <ListIcon size={17} aria-hidden="true" />{t('ui.gacha.probabilities')}
          </button>
          <button type="button" className="secondary-button" onClick={() => openDetail('history')} disabled={isAnimating}>
            <History size={17} aria-hidden="true" />{t('ui.gacha.recentTitle')}
          </button>
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
