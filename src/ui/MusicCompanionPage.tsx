import { useEffect, useState } from 'react';
import { ArrowLeft, Headphones, Heart, Pause, Play, Repeat, Repeat1, SkipForward, Volume2 } from 'lucide-react';
import { bgmTracks, getBgmPlaybackState, nextMusicTrack, setBgmRepeatMode, setBgmVolume, setMusicBackground, supportsMusicBackground, type BgmPlaybackState } from '../core/bgm';
import { musicHeartIntervalMs, getPartnerScheduleActivity, getPrimaryStatus, getSeasonInfo, type PetState, type PetStatus, type RecentActivity } from '../core/pet';
import { isExpeditionAway } from '../core/expeditionData';
import { RoomBackdrop } from './RoomBackdrop';
import { formatCompactNumber } from './numberFormat';

const quietActivities = ['reading_books', 'workout', 'work_plants', 'happy', 'idle'] as const;
const activityCaptions: Partial<Record<RecentActivity, string>> = {
  reading_books: '翻几页书，听一段旋律', workout: '跟着节拍，舒展一下',
  work_plants: '照料绿意，也陪着你', happy: '这首歌，伙伴也很喜欢', idle: '什么也不做，一起待一会儿',
};
const durationText = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 3600) > 0 ? `${Math.floor(seconds / 3600)}:` : ''}${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const currentTrack = (state: BgmPlaybackState) => bgmTracks.find(track => track.id === state.trackId) ?? bgmTracks[0];
const wantsPause = (state: BgmPlaybackState) => state.active && !state.paused && state.enabled && !state.error;

interface Controls {
  playback: BgmPlaybackState;
  blocked: boolean;
  pendingListeningMs: number;
  onStart: () => void;
  onPause: () => void;
  onFinish: () => void;
}
interface Props extends Controls {
  pet: PetState;
  petStatusImages: Record<PetStatus, string>;
  petActivityImages: Partial<Record<RecentActivity, string>>;
  onBack: () => void;
}

export const MusicCompanionPage = ({ pet, playback, blocked, pendingListeningMs, petStatusImages, petActivityImages, onBack, onStart, onPause, onFinish }: Props) => {
  const [activity, setActivity] = useState<RecentActivity>('idle');
  useEffect(() => {
    if (!playback.active) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (document.visibilityState === 'visible' && getBgmPlaybackState().playing) setActivity(previous => {
          const choices = quietActivities.filter(value => value !== previous);
          return choices[Math.floor(Math.random() * choices.length)];
        });
        schedule();
      }, 30_000 + Math.random() * 30_000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [playback.active]);

  const status = getPrimaryStatus(pet);
  const away = Boolean(pet.adventure.active || isExpeditionAway(pet));
  const fishing = Boolean(pet.community.fishing.active);
  const recent = pet.recentActivity !== 'idle' && pet.recentActivityUntil > Date.now() ? pet.recentActivity : undefined;
  const displayedActivity = pet.isSleeping || away || fishing ? undefined : pet.partnerSchedule.active
    ? getPartnerScheduleActivity(pet.partnerSchedule.active.category) : recent ?? (pet.pomodoro.isRunning ? pet.pomodoro.currentActivity : playback.active ? activity : undefined);
  const portrait = displayedActivity ? petActivityImages[displayedActivity] ?? petStatusImages[status] : petStatusImages[status];
  const caption = pet.isSleeping ? '伙伴睡着了，让旋律轻轻陪伴' : away ? '伙伴正在外出，音乐陪你等它回来' : fishing ? '伙伴正在水边钓鱼' : pet.partnerSchedule.active ? '伙伴正在社区帮忙' : recent ? '伙伴正忙着手边的小事' : activityCaptions[displayedActivity ?? 'idle'];
  const season = getSeasonInfo(pet.lastUpdatedAt);
  const reward = Math.floor(pendingListeningMs / musicHeartIntervalMs);
  const remaining = musicHeartIntervalMs - pendingListeningMs % musicHeartIntervalMs;
  const playLabel = !playback.enabled ? '开启声音并播放' : playback.error ? '重试播放' : wantsPause(playback) ? '暂停' : playback.active ? '继续播放' : '开始聆听';
  return <section className="music-page" aria-label="音乐陪伴">
    <header className="music-heading"><button type="button" className="secondary-button" onClick={onBack}><ArrowLeft size={17} />{playback.active ? '收起陪伴' : '回到主页'}</button><div><p>BGM 鉴赏</p><h2><Headphones size={25} />音乐陪伴</h2></div><span>把时间交给喜欢的旋律</span></header>
    <div className="music-layout">
      <div className={`pet-scene room-v2 music-room pet-scene--${status} pet-scene--weather-${pet.weather} scene-${season.id}`}>
        <RoomBackdrop season={season.id} />
        <div className="music-room-note"><Headphones size={18} /><span>{pet.name}的陪伴时光</span></div>
        <div className={`pet pet--image pet--${status}`}><img src={portrait} alt={`${pet.name} · ${caption}`} draggable="false" /></div>
        <span className="room-caption">{caption}</span>
      </div>
      <div className="music-player">
        <div className={`music-record${playback.playing ? ' music-record--playing' : ''}`} aria-hidden="true"><span><Headphones size={30} /></span></div>
        <p className="music-kicker">{playback.active ? '此刻陪伴你的旋律' : '共 11 首，慢慢听'}</p><h3>{currentTrack(playback).title}</h3>
        <div className="music-transport"><button type="button" className="primary-button" disabled={blocked} onClick={wantsPause(playback) ? onPause : onStart}>{wantsPause(playback) ? <Pause size={20} /> : <Play size={20} />}{playLabel}</button><button type="button" className="secondary-button" disabled={!playback.active || blocked} onClick={nextMusicTrack}><SkipForward size={19} />下一首</button></div>
        <button type="button" className="music-repeat secondary-button" aria-pressed={playback.repeatMode === 'single'} onClick={() => setBgmRepeatMode(playback.repeatMode === 'single' ? 'sequence' : 'single')}>{playback.repeatMode === 'single' ? <Repeat1 size={18} /> : <Repeat size={18} />}{playback.repeatMode === 'single' ? '单曲循环' : '顺序轮播'}</button>
        <label className="music-volume"><span><Volume2 size={18} />音乐音量</span><input type="range" min="0" max="100" step="1" value={Math.round(playback.volume * 100)} onChange={event => setBgmVolume(Number(event.target.value) / 100)} /><output>{Math.round(playback.volume * 100)}%</output></label>
        <label className="music-background"><input type="checkbox" checked={playback.allowBackground} disabled={!supportsMusicBackground} onChange={event => setMusicBackground(event.target.checked)} /><span>后台继续播放<small>{supportsMusicBackground ? '切换标签或最小化窗口时，音乐继续陪伴' : '后台播放支持网页版和桌面版，安卓请保持前台'}</small></span></label>
        <div className="music-listening"><div><small>本次有效聆听</small><strong>{durationText(playback.active ? playback.sessionListeningMs : 0)}</strong></div><div><small>待领取小心心</small><strong><Heart size={17} />{formatCompactNumber(reward)}</strong></div></div>
        <p className="music-reward-hint">每听满 10 分钟，收获 1 颗小心心。<br />再听 {durationText(remaining)} 可多领一颗，零头会留到下次。</p>
        {playback.error && <p className="music-message" role="alert">{playback.error}</p>}
        {blocked ? <p className="music-message">请先处理存档提示，再继续陪伴。</p> : pet.timePause ? <p className="music-message">时间已冻结，可以听歌；恢复时间后继续积攒小心心。</p> : (!playback.enabled || playback.volume === 0) && <p className="music-message">当前音乐已静音，聆听时间暂停累计。</p>}
        <button type="button" className="secondary-button music-finish" disabled={blocked || !playback.active && (reward === 0 || Boolean(pet.timePause))} onClick={onFinish}>{playback.active ? '结束陪伴' : '领取上次的陪伴心意'}{reward > 0 && !pet.timePause ? ` · +${formatCompactNumber(reward)} 小心心` : ''}</button>
      </div>
    </div>
    <p className="music-footer">听歌时，伙伴也照常生活。偶尔回来看看它，一起度过普通又温柔的一天。</p>
  </section>;
};

export const MusicCompanionBar = ({ playback, blocked, pendingListeningMs, onStart, onPause, onFinish, onOpen }: Controls & { onOpen: () => void }) => <aside className="music-mini" aria-label="正在音乐陪伴">
  <button type="button" className="music-mini-title" onClick={onOpen}><Headphones size={21} /><span><strong>{currentTrack(playback).title}</strong><small>{playback.error ? '播放遇到问题，点击查看' : `${playback.playing ? '正在陪伴' : '已暂停'} · ${durationText(playback.sessionListeningMs)}`} · 待领 {formatCompactNumber(Math.floor(pendingListeningMs / musicHeartIntervalMs))} 心</small></span></button>
  <button type="button" className="icon-button" disabled={blocked} onClick={wantsPause(playback) ? onPause : onStart} aria-label={wantsPause(playback) ? '暂停音乐陪伴' : '继续音乐陪伴'}>{wantsPause(playback) ? <Pause size={18} /> : <Play size={18} />}</button>
  <button type="button" className="secondary-button" disabled={blocked} onClick={onFinish}>结束</button>
</aside>;
