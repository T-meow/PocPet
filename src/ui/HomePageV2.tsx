import { ArrowUpRight, Bath, BriefcaseBusiness, CalendarDays, ChefHat, Gamepad2, Gift, LockKeyhole, Moon, PackageOpen, ShoppingBag, Smile, Sparkles, Sprout, Ticket, Timer, Trophy } from 'lucide-react';
import { canClaimBoostCardDailyReward, getDailyWishView, getReturnWelcomeView, partnerScheduleUnlockLevel } from '../core/pet';
import { activityText as L } from '../core/kitchenRecipes';
import { getCompanionWish } from '../core/companionMemories';
import { gameName, miniGameUnlockLevel } from '../core/miniGames';
import { AdventureEntry, type AdventureEntryState } from './AdventureEntry';
import { t } from '../i18n';
import { PetDisplay } from './PetDisplay';
import { PartnerScheduleDock } from './PartnerScheduleDock';
import { CompanionStatus } from './CompanionStatus';
import { MemoryCover } from './MemoryCover';
import type { HomePageProps } from './HomePage';

interface Props extends HomePageProps {
  actorId: string;
  adventure: AdventureEntryState;
  hasAchievementNotice: boolean;
  onOpenKitchen: () => void;
  onOpenPlay: () => void;
  onOpenMemories: () => void;
  onOpenShop: () => void;
  onOpenAchievements: () => void;
  onOpenNotices?: () => void;
  onOpenAppearance?: () => void;
  memoryImage?: string;
  memoryArtUnlocked?: boolean;
}
export const HomePageV2 = (props: Props) => {
  const { pet, actorId, neighbors, onInteract, canUpgrade, nextUpgradeCost, onUpgrade, pomodoroOverlay, petStatusImages, petActivityImages, getStatusLabel, onOpenInventory, onOpenPlay, onOpenKitchen, onOpenGarden, onOpenPartnerSchedule, onOpenPomodoro, onDailyWish, onReturnWelcome, onAction, onOpenMemories } = props;
  const busy = Boolean(pet.partnerSchedule.active);
  const wish = getDailyWishView(pet);
  const welcome = getReturnWelcomeView(pet);
  const companionWish = getCompanionWish(pet, actorId);
  const friendGiftReady = canClaimBoostCardDailyReward(pet);
  const today = !wish.claimed || Boolean(welcome) || Boolean(pet.partnerSchedule.pendingResult) || Boolean(props.gardenReminder) || friendGiftReady;
  const activeGame = pet.miniGames.active?.actorId === actorId ? pet.miniGames.active : undefined;
  const playLocked = pet.level < miniGameUnlockLevel;
  const quickPlayBlocked = busy || props.isLowEnergy || props.isCriticallyHungry;
  const quickPlayHint = busy ? L('伙伴正在忙日程', 'Your companion is busy')
    : props.isCriticallyHungry ? t('ui.actionDock.lowHunger')
      : props.isLowEnergy ? t('ui.actionDock.lowEnergy') : L('消耗体力，恢复心情', 'Spend energy to lift their mood');
  const workBlocked = busy || pet.isSleeping || props.isLowEnergy || props.isCriticallyHungry;
  const workHint = busy ? L('伙伴正在忙日程', 'Your companion is busy')
    : pet.isSleeping ? L('睡醒再去也不迟', 'After a little rest')
      : props.isCriticallyHungry ? t('ui.actionDock.lowHunger')
        : props.isLowEnergy ? t('ui.actionDock.lowEnergy') : L('赚一点零花钱', 'A little pocket money');
  return <div className="home-v2"><div className="home-v2-title"><div><p>OUR LITTLE HOME</p><h2>{L(`${pet.name} 的小窝`, `${pet.name}’s little home`)}</h2></div><span>{L(`相伴第 ${Math.max(1, Math.floor(pet.ageSeconds / 86400) + 1)} 天`, `Day ${Math.max(1, Math.floor(pet.ageSeconds / 86400) + 1)} together`)}</span></div>
    <div className="home-v2-grid"><section className="home-companion-card"><div className="home-room"><PetDisplay pet={pet} onInteract={onInteract} canUpgrade={canUpgrade} isPetBusy={busy} nextUpgradeCost={nextUpgradeCost} onUpgrade={onUpgrade} overlay={pomodoroOverlay} petStatusImages={petStatusImages} petActivityImages={petActivityImages} getStatusLabel={getStatusLabel} onOpenAppearance={props.onOpenAppearance} /></div><button className="home-event" onClick={props.onOpenNotices} aria-label={L('查看完整消息', 'Read full message')}><span>✦</span><p>{pet.recentEvent}</p><span>›</span></button>
      <CompanionStatus pet={pet} />
      <nav className="home-care-bar" aria-label={L('日常照顾', 'Daily care')}>
        <button onClick={onOpenInventory}><PackageOpen size={20} />{L('背包 / 喂食', 'Bag / Feed')}</button>
        <button disabled={quickPlayBlocked} title={quickPlayHint} onClick={() => onAction('play')}><Smile size={20} />{L('玩耍', 'Play')}</button>
        <button disabled={busy || props.isCriticallyHungry} onClick={() => onAction('clean')}><Bath size={20} />{L('清洁', 'Wash')}</button>
        <button disabled={busy} onClick={() => onAction('sleep')}><Moon size={20} />{pet.isSleeping ? L('叫醒', 'Wake') : L('睡觉', 'Sleep')}</button>
      </nav>
      {pet.partnerSchedule.active && <PartnerScheduleDock pet={pet} neighbors={neighbors} onOpen={onOpenPartnerSchedule} />}
    </section><aside className="home-v2-sidebar">
      <section>
        <div className="home-section-title"><h3>{L('一起做点什么', 'A little time together')}</h3><small>{L('随时开始，慢慢来', 'At our own pace')}</small></div>
        <div className="home-primary-grid">
          <button className="home-quick kitchen" onClick={onOpenKitchen}>
            <span className="home-primary-icon"><ChefHat size={28} /></span><ArrowUpRight className="home-entry-arrow" size={17} aria-hidden="true" />
            <strong>{L('一起做饭', 'Cook together')}</strong><small>{L('选一道菜，做点好吃的', 'Pick a recipe. Make something tasty.')}</small>
          </button>
          <button className="home-quick play" disabled={playLocked} onClick={onOpenPlay}>
            <span className="home-primary-icon"><Gamepad2 size={28} /></span>{playLocked ? <LockKeyhole className="home-entry-arrow" size={17} aria-hidden="true" /> : <ArrowUpRight className="home-entry-arrow" size={17} aria-hidden="true" />}
            <strong>{!playLocked && activeGame ? L('继续游戏', 'Continue game') : L('一起游戏', 'Games together')}</strong>
            <small>{playLocked ? L(`Lv.${miniGameUnlockLevel} 解锁`, `Unlocks at Lv.${miniGameUnlockLevel}`) : activeGame ? L(`${gameName(activeGame.game)} · 上次的进度还在`, `${gameName(activeGame.game)} · right where we left off`) : L('翻牌、接球，或吹一会儿泡泡', 'Cards, catch, or a few bubbles')}</small>
          </button>
        </div>
        <nav className="home-tools" aria-label={L('常用工具', 'Everyday essentials')}>
          <button data-tone="peach" onClick={props.onOpenShop}><ShoppingBag size={20} /><span>{L('商店', 'Shop')}</span></button>
          <button data-tone="rose" onClick={props.onOpenBoostCards}><Ticket size={20} /><span>{L('朋友卡', 'Friend cards')}</span></button>
          <button data-tone="lilac" onClick={props.onOpenGacha}><Gift size={20} /><span>{L('扭蛋', 'Gacha')}</span></button>
        </nav>
        <div className="home-quick-grid">
          <button className="home-quick garden" onClick={onOpenGarden}><Sprout /><strong>{L('花园', 'Garden')}</strong><small>{props.gardenReminder === 'ready' ? L('有果实可以收获啦', 'Ready to harvest') : props.gardenReminder === 'withered' ? L('有植物需要照顾', 'A plant needs care') : L('照顾小小绿意', 'A little greenery')}</small></button>
          <button className="home-quick schedule" disabled={pet.level < partnerScheduleUnlockLevel} onClick={onOpenPartnerSchedule}>
            <CalendarDays /><strong>{L('伙伴日程', 'Activities')}</strong><small>{pet.level < partnerScheduleUnlockLevel ? L(`Lv.${partnerScheduleUnlockLevel} 开放`, `Available at Lv.${partnerScheduleUnlockLevel}`) : pet.partnerSchedule.pendingResult ? L('收获待领取', 'Rewards are ready') : busy ? L('进行中', 'In progress') : L('安排一段小日常', 'Make time for a little activity')}</small>
          </button>
          <button className="home-quick focus" onClick={onOpenPomodoro}><Timer /><strong>{L('专注时光', 'Focus')}</strong><small>{pet.pomodoro.isRunning ? L('正在专注中', 'Focus in progress') : L('陪你完成一件小事', 'One small thing together')}</small></button>
          <button className="home-quick work" disabled={workBlocked} title={workHint} onClick={() => onAction('work')}><BriefcaseBusiness /><strong>{L('打工', 'Work')}</strong><small>{workHint}</small></button>
        </div>
        <AdventureEntry entry={props.adventure} />
        {companionWish && <p className="home-companion-wish"><span>💭</span>{companionWish}</p>}
      </section>
      <section className="home-records">
        <div className="home-section-title"><h3>{L('慢慢积攒的故事', 'Little stories, collected')}</h3></div>
        <nav className="home-record-grid" aria-label={L('记录与成长', 'Memories and growth')}>
          <button data-tone="gold" onClick={props.onOpenAchievements}>
            <Trophy size={20} /><strong>{L('成就', 'Achievements')}</strong><small className={props.hasAchievementNotice ? 'home-notice-text' : undefined}>{props.hasAchievementNotice ? L('有奖励待领取', 'Rewards to claim') : L('每一步都算数', 'Every little step')}</small>
          </button>
          <button data-tone="sky" onClick={props.onOpenCommonDreams}><Sparkles size={20} /><strong>{L('伙伴梦想', 'Dreams')}</strong><small>{L('一起期待的未来', 'A future together')}</small></button>
        </nav>
      </section>
      <p className="home-quiet-note">{L('把普通的每一天，过成喜欢的样子。', 'A little life, made brighter together.')}</p>
      <MemoryCover days={Math.max(1, Math.floor(pet.ageSeconds / 86400) + 1)} image={props.memoryImage ?? petStatusImages?.content ?? ''} unlocked={Boolean(props.memoryArtUnlocked)} onOpen={onOpenMemories} />
    </aside>
    {today && <section className="home-today">
      <div className="home-section-title"><h3>{L('今日小事', 'Little things today')}</h3><small>{L('什么时候都可以', 'Whenever you feel like it')}</small></div>
      {!wish.claimed && <button className="home-todo" disabled={busy && !wish.canClaim} onClick={onDailyWish}><span>💌</span><div><strong>{wish.title}</strong><small>{wish.progressText} · {wish.rewardText}</small></div><b>›</b></button>}
      {welcome && <button className="home-todo" disabled={busy && !welcome.canClaim} onClick={onReturnWelcome}><span>🌼</span><div><strong>{welcome.title}</strong><small>{welcome.progressText} · {welcome.rewardText}</small></div><b>›</b></button>}
      {pet.partnerSchedule.pendingResult && <button className="home-todo" onClick={onOpenPartnerSchedule}><span>🧺</span><div><strong>{L('伙伴带着收获回来啦', 'Your companion is back')}</strong><small>{L('看看这次日程的小收获', 'See what they brought back')}</small></div><b>›</b></button>}
      {friendGiftReady && <button className="home-todo" onClick={props.onOpenBoostCards}><span>🎁</span><div><strong>{L('邻居的小礼物', 'A little gift from next door')}</strong><small>{L('朋友卡今日礼物和金币待领取', 'Your daily friend card gift and coins are ready')}</small></div><b>›</b></button>}
      {props.gardenReminder === 'ready' && <button className="home-todo" onClick={onOpenGarden}><span>🌱</span><div><strong>{L('花园有好消息', 'Good news from the garden')}</strong><small>{L('有果实可以收获啦', 'Ready to harvest')}</small></div><b>›</b></button>}
      {props.gardenReminder === 'withered' && <button className="home-todo" onClick={onOpenGarden}><span>🌿</span><div><strong>{L('小花园需要照顾', 'A little garden care')}</strong><small>{L('看看枯萎的植物，安排下一次种植', 'Check a wilted plant and plan your next planting')}</small></div><b>›</b></button>}
    </section>}
    </div>
  </div>;
};
