import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Images, RefreshCw } from 'lucide-react';
import type { PetState } from '../core/pet';
import { activityText as L } from '../core/kitchenRecipes';
import { features } from '../platform/edition';
import { createMemoryPoster } from '../platform/albumPoster';
import { createAlbumData, createCurrentReview, createReviewAlbumData } from './albumData';
import { CompanionMemories } from './CompanionMemories';

interface MemoryAlbumProps {
  pet: PetState;
  actorId: string;
  portrait: string;
  art?: string;
  onBack: () => void;
  onOpenArt: () => void;
  onSave: (image: string) => void;
  onError: (message: string) => void;
}

export const MemoryAlbum = ({ pet, actorId, portrait, art, onBack, onOpenArt, onSave, onError }: MemoryAlbumProps) => {
  const [period, setPeriod] = useState<'all' | 'current' | 'previous'>('all');
  const [poster, setPoster] = useState<{ key: string; image: string }>();
  const [failedKey, setFailedKey] = useState('');
  const [retry, setRetry] = useState(0);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const data = period === 'all' ? createAlbumData(pet) : createReviewAlbumData(pet.name, period === 'previous' && pet.latestYearReview ? pet.latestYearReview : createCurrentReview(pet), period !== 'previous');
  // The exact snapshot displayed here is also sent to the save action.
  const key = JSON.stringify([data, art ?? portrait]);
  useEffect(() => {
    let active = true;
    setFailedKey('');
    const [snapshot, image] = JSON.parse(key) as [typeof data, string];
    void createMemoryPoster(snapshot, image).then((result) => {
      if (active) setPoster({ key, image: result });
    }).catch(() => {
      if (!active) return;
      setFailedKey(key);
      errorRef.current(L('暂时无法生成回顾图片，请重试。', 'Unable to create the image. Please try again.'));
    });
    return () => { active = false; };
  }, [key, retry]);
  return (
    <section className="memory-album">
      <header className="v2-page-heading">
        <button className="icon-button" onClick={onBack} aria-label={L('返回小窝', 'Back home')}><ArrowLeft /></button>
        <div><p className="eyebrow">OUR MEMORY BOOK</p><h2>{L('我们的纪念册', 'Our little album')}</h2></div>
      </header>
      <div className="album-layout">
        <section className="album-review">
          <nav className="album-tabs" aria-label={L('回顾范围', 'Review period')}>
            <button aria-pressed={period === 'all'} onClick={() => setPeriod('all')}>{L('累计陪伴', 'All moments')}</button>
            <button aria-pressed={period === 'current'} onClick={() => setPeriod('current')}>{L('今年', 'This year')}</button>
            {pet.latestYearReview && <button aria-pressed={period === 'previous'} onClick={() => setPeriod('previous')}>{pet.latestYearReview.year} {L('年度回顾', 'Review')}</button>}
          </nav>
          {poster?.key === key
            ? <img className="album-poster" src={poster.image} alt={`${data.title} · ${data.subtitle}`} />
            : <div className="album-placeholder">
                <h3>{data.title}</h3><p>{data.subtitle}</p><img src={art ?? portrait} alt="" />
                {failedKey === key
                  ? <button className="secondary-button" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={16} />{L('重新生成', 'Try again')}</button>
                  : <p>{L('正在整理我们的回忆…', 'Collecting our memories…')}</p>}
              </div>}
          <dl className="album-accessible-metrics">{data.metrics.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>
          <button className="secondary-button" disabled={!features.shareCards || poster?.key !== key} onClick={() => { if (poster?.key === key) onSave(poster.image); }}><Download size={17} />{L('保存这张回顾', 'Save this review')}</button>
        </section>
        <aside className="album-stories">
          <section className="v2-card"><CompanionMemories pet={pet} actorId={actorId} /></section>
          <section className="v2-card album-art">
            <h3>{L('纪念插画', 'Keepsake artwork')}</h3>
            {art
              ? <button onClick={onOpenArt}><img src={art} alt={L('已解锁纪念插画', 'Unlocked keepsake artwork')} /><span><Images size={17} />{L('查看与保存插画', 'View and save artwork')}</span></button>
              : <><img src={portrait} alt="" /><p>{L('先把今天收藏起来，未来还有新的纪念。', 'Keep today close. More memories are waiting ahead.')}</p></>}
          </section>
        </aside>
      </div>
    </section>
  );
};
