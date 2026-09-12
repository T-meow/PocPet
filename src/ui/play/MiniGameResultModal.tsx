import { Heart, RotateCcw, Smile, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { MiniGameResult } from '../../core/companionActivityTypes';
import { activityText as L } from '../../core/kitchenRecipes';
import { gameName, getMiniGameSkillCategory } from '../../core/miniGames';
import { formatPracticeSkillXp } from '../../core/partnerSchedule';
import { DialogShell } from '../DialogShell';

interface Props {
  result: MiniGameResult;
  portrait: string;
  canReplay: boolean;
  onClose: () => void;
  onBack: () => void;
  onReplay: () => void;
}

export const MiniGameResultModal = ({ result, portrait, canReplay, onClose, onBack, onReplay }: Props) => {
  const score = result.game === 'matching' ? L(`${result.score} 次翻牌配对`, `${result.score} pairing attempts`)
    : result.game === 'catch' ? L(`最佳连续接住 ${result.score} 次`, `Best streak: ${result.score} catches`)
      : L(`一起吹了 ${result.score} 个泡泡`, `${result.score} bubbles together`);
  const bonus = result.baseHearts === undefined ? 0 : Math.max(0, result.hearts - result.baseHearts);
  const skillCategory = getMiniGameSkillCategory(result.game);
  return <DialogShell className="activity-modal play-reward-modal" labelId="play-reward-title" onClose={onClose}>
    <button className="icon-button play-reward-close" onClick={onClose} aria-label={L('关闭并回到小窝', 'Close and return home')}><X /></button>
    <div className="play-reward-art" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => <i key={index} style={{ '--spark-index': index } as CSSProperties}>{index % 2 ? '✦' : '♥'}</i>)}
      <img src={portrait} alt="" />
    </div>
    <div className="play-reward-content">
      <small>{gameName(result.game)} · {L('本次收获', 'THIS TIME TOGETHER')}</small>
      <h2 id="play-reward-title">{L('又多了一段开心时光', 'Another happy moment together')}</h2>
      <div className="play-reward-hearts"><Heart size={28} fill="currentColor" /><strong>+{result.hearts}</strong><span>{L('心心', 'hearts')}</span></div>
      {result.rewardLevel !== undefined && <p className="play-reward-breakdown">{L(`Lv.${result.rewardLevel} 基础 ${result.baseHearts ?? result.hearts} 心`, `Lv.${result.rewardLevel} base: ${result.baseHearts ?? result.hearts} hearts`)}{bonus > 0 && L(` + 加成 ${bonus} 心`, ` + ${bonus} bonus hearts`)}</p>}
      {result.mood !== undefined && <p className="play-reward-mood"><Smile size={17} />{result.mood > 0 ? L(`心情 +${Number(result.mood.toFixed(1))}`, `Mood +${Number(result.mood.toFixed(1))}`) : L('心情已经满满的啦', 'Already full of good spirits')}</p>}
      {skillCategory && (result.skillXp ?? 0) > 0 && <p className="activity-skill-xp">{formatPracticeSkillXp(skillCategory, result.skillXp)}</p>}
      <p className="play-reward-score">{score}</p>
      <p className="activity-muted">{L('收获已经放进小窝，随时可以休息。', 'Your rewards are already saved. Rest whenever you like.')}</p>
      <div className="play-reward-actions">
        <button className="activity-primary" disabled={!canReplay} onClick={onReplay}><RotateCcw size={16} />{L('再玩一局', 'Play again')}</button>
        <button className="activity-secondary" onClick={onBack}>{L('返回游戏列表', 'Back to games')}</button>
      </div>
      {result.game === 'catch' && <p className="activity-muted">{canReplay ? L('再玩一局会消耗 1 个玩具球', 'Playing again uses one toy ball') : L('可以先返回列表，补充玩具球或休息一下', 'Return to the list to get a toy ball or take a break')}</p>}
    </div>
  </DialogShell>;
};
