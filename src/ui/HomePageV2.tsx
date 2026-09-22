import { ArrowUpRight, Bath, CalendarDays, ChefHat, Gamepad2, Gift, Headphones, LockKeyhole, Moon, PackageOpen, ShoppingBag, Smile, Sparkles, Sprout, Ticket, Timer, Trophy } from 'lucide-react';
import { canClaimBoostCardDailyReward, dreamProjectCategories, gardenCompensationRewardId, getAchievementSummary, getClassicLegacyAppleCost, getClassicLegacyLevelCoinCost, getDailyWishView, getDreamProjectSupplySupplement, getDreamStageEligibility, getReturnWelcomeView, goldenAppleGachaStarterGiftRewardId, isClassicEndgameComplete, isClassicEndgameUnlocked } from '../core/pet';
import { activityText as L } from '../core/kitchenRecipes';
import { getCompanionWish } from '../core/companionMemories';
import { gameName, miniGameUnlockLevel } from '../core/miniGames';
import { AdventureEntry, type AdventureEntryState } from './AdventureEntry';
import { t } from '../i18n';
import { PetDisplay } from './PetDisplay';
import { PartnerScheduleDock } from './PartnerScheduleDock';
import { CompanionStatus } from './CompanionStatus';
import { MemoryCover } from './MemoryCover';
import { FestivalEntry } from './FestivalStories';
import type { FestivalId } from '../core/festivalCalendar';
import type { HomePageProps } from './HomePage';
import { hasFestivalReward } from '../core/festivalStories';
import { ClaimNotice } from './ClaimNotice';

interface Props extends HomePageProps {
  actorId: string;
  adventure: AdventureEntryState;
  hasAchievementNotice: boolean;
  onOpenKitchen: () => void;
  onOpenPlay: () => void;
  onOpenMemories: () => void;
  onOpenMusic: () => void;
  musicActive: boolean;
  onOpenFestival?: (festival: FestivalId) => void;
  onOpenShop: () => void;
  onOpenCommunity?: () => void;
  onOpenAchievements: () => void;
  onOpenNotices?: () => void;
  onOpenAppearance?: () => void;
  memoryImage?: string;
  memoryArtUnlocked?: boolean;
}
export const HomePageV2 = (props: Props) => {
  const { pet, actorId, neighbors, onInteract, canUpgrade, nextUpgradeCost, onUpgrade, pomodoroOverlay, petStatusImages, petActivityImages, getStatusLabel, onOpenInventory, onOpenPlay, onOpenKitchen, onOpenGarden, onOpenPartnerSchedule, onOpenPomodoro, onDailyWish, onReturnWelcome, onAction, onOpenMemories } = props;
  const busy = Boolean(pet.partnerSchedule.active || pet.adventure.active || isExpeditionAway(pet) || pet.community.fishing.active);
  const wish = getDailyWishView(pet);
  const welcome = getReturnWelcomeView(pet);
  const companionWish = getCompanionWish(pet, actorId);
  const friendGiftReady = canClaimBoostCardDailyReward(pet);
  const gardenGiftReady = props.gardenReminder === 'ready' || !pet.claimedRewardIds.includes(gardenCompensationRewardId);
  const farmGiftReady = gardenGiftReady || Boolean(pet.community.commission?.found || pet.community.fishing.pending)
    || pet.community.tasks.some(task => task.found) || Object.values(pet.community.animals).some(state => state.stock > 0)
    || pet.community.plots.some(plot => plot.crop && plot.crop.readyAt <= Date.now());
  const farmHint = [
    pet.community.fishing.active?.mode === 'idle' ? '伙伴在小屋挂机钓鱼' : pet.community.fishing.active ? '回到水边，继续这一竿' : pet.community.fishing.pending ? '小屋有鱼获待领取' : undefined,
    props.gardenReminder === 'ready' ? '果园有果实可以收获' : gardenGiftReady ? '果园补偿待领取' : props.gardenReminder === 'withered' ? '果园有植物需要照顾' : undefined,
  ].filter(Boolean).join(' · ') || '果树、菜地、养殖、钓鱼与委托';
  const achievementGiftReady = getAchievementSummary(pet).claimable > 0;
  const dreamsUnlocked = isClassicEndgameUnlocked(pet);
  const dreamGiftReady = dreamProjectCategories.some(category => {
    if (getDreamProjectSupplySupplement(pet, category).amount > 0) return true;
    const stage = getDreamStageEligibility(pet, category);
    return dreamsUnlocked && !stage.complete && stage.requirementsMet && stage.coinsMet && stage.applesMet && Boolean(stage.rewardFits);
  }) || dreamsUnlocked && isClassicEndgameComplete(pet) && pet.classicEndgame.legacyCoinsInvested >= getClassicLegacyLevelCoinCost(pet.classicEndgame.legacyLevel + 1) && (pet.inventory.golden_apple ?? 0) >= getClassicLegacyAppleCost(pet.classicEndgame.legacyLevel + 1);
  const festivalGiftReady = Object.values(pet.festivalStories.runs).some(run => run.stage === 'complete' && !hasFestivalReward(pet, run));
  const adventureGiftReady = Boolean(pet.adventure.pending || pet.community.expedition.pending) || !pet.adventure.active && !pet.community.expedition.active && (!pet.adventure.starterClaimed || !pet.adventure.starterMealsClaimed);
  const today = !wish.claimed || Boolean(welcome) || Boolean(pet.partnerSchedule.pendingResult) || Boolean(props.gardenReminder) || friendGiftReady;
  const activeGame = pet.miniGames.active?.actorId === actorId ? pet.miniGames.active : undefined;
  const playLocked = pet.level < miniGameUnlockLevel;
  const quickPlayBlocked = busy || props.isLowEnergy || props.isCriticallyHungry;
  const quickPlayHint = isExpeditionAway(pet) ? '伙伴正在远行，请先在基地暂停或返回' : pet.community.fishing.active ? '伙伴正在水边钓鱼，请先收起鱼竿' : pet.adventure.active ? L('伙伴正在溪谷探查，请先返回基地', 'Your companion is scouting. Return to the outpost first.') : busy ? L('伙伴正在社区帮忙', 'Your companion is helping in the community')
    : props.isCriticallyHungry ? t('ui.actionDock.lowHunger')
      : props.isLowEnergy ? t('ui.actionDock.lowEnergy') : L('消耗体力，恢复心情', 'Spend energy to lift their mood');
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
          <button className="home-quick kitchen" disabled={Boolean(pet.adventure.active)} onClick={onOpenKitchen}>
            <span className="home-primary-icon"><ChefHat size={28} /></span><ArrowUpRight className="home-entry-arrow" size={17} aria-hidden="true" />
            <strong>{L('一起做饭', 'Cook together')}</strong><small>{L('选一道菜，做点好吃的', 'Pick a recipe. Make something tasty.')}</small>
            <ClaimNotice show={!pet.kitchen.starterClaimed && !pet.adventure.active} />
          </button>
          <button className="home-quick garden" onClick={props.onOpenCommunity ?? onOpenGarden}>
            <span className="home-primary-icon"><Sprout size={28} /></span><ArrowUpRight className="home-entry-arrow" size={17} aria-hidden="true" />
            <strong>溪畔农场</strong><small>{farmHint}</small>
            <ClaimNotice show={farmGiftReady} />
          </button>
        </div>
        <nav className="home-tools" aria-label={L('常用工具', 'Everyday essentials')}>
          <button data-tone="peach" onClick={props.onOpenShop}><ShoppingBag size={20} /><span>{L('商店', 'Shop')}</span></button>
          <button data-tone="rose" onClick={props.onOpenBoostCards}><Ticket size={20} /><span>{L('朋友卡', 'Friend cards')}</span><ClaimNotice show={friendGiftReady} /></button>
          <button data-tone="lilac" onClick={props.onOpenGacha}><Gift size={20} /><span>{L('扭蛋', 'Gacha')}</span><ClaimNotice show={!pet.claimedRewardIds.includes(goldenAppleGachaStarterGiftRewardId)} /></button>
        </nav>
        <div className="home-quick-grid home-services-grid home-services-grid--music">
          <button className="home-quick play" disabled={playLocked || Boolean(pet.adventure.active)} onClick={onOpenPlay}>
            {playLocked ? <LockKeyhole /> : <Gamepad2 />}<strong>{!playLocked && activeGame ? L('继续游戏', 'Continue game') : L('一起游戏', 'Games together')}</strong>
            <small>{playLocked ? L(`Lv.${miniGameUnlockLevel} 解锁`, `Unlocks at Lv.${miniGameUnlockLevel}`) : activeGame ? L(`${gameName(activeGame.game)} · 上次的进度还在`, `${gameName(activeGame.game)} · right where we left off`) : L('翻牌、接球，或吹一会儿泡泡', 'Cards, catch, or a few bubbles')}</small>
          </button>
          <button className="home-quick schedule" onClick={onOpenPartnerSchedule}>
            <CalendarDays /><strong>{L('社区工作', 'Community work')}</strong><small>{pet.partnerSchedule.pendingResult ? L('报酬待领取', 'Rewards are ready') : pet.partnerSchedule.active ? L('正在帮忙', 'Lending a hand') : L('快速工作与邻里事务', 'Quick work and local requests')}</small>
            <ClaimNotice show={Boolean(pet.partnerSchedule.pendingResult)} />
          </button>
          <button className="home-quick focus" onClick={onOpenPomodoro}><Timer /><strong>{L('专注时光', 'Focus')}</strong><small>{pet.pomodoro.isRunning ? L('正在专注中', 'Focus in progress') : L('陪你完成一件小事', 'One small thing together')}</small></button>
          <button className="home-quick music" onClick={props.onOpenMusic}><Headphones /><strong>音乐陪伴</strong><small>{props.musicActive ? '旋律还在，回来坐一会儿' : '听听音乐，和伙伴慢慢待着'}</small></button>
        </div>
        {props.onOpenFestival && <FestivalEntry pet={pet} onOpen={props.onOpenFestival} />}
        <AdventureEntry entry={props.adventure} hasReward={adventureGiftReady} />
        {companionWish && <p className="home-companion-wish"><span>💭</span>{companionWish}</p>}
      </section>
      <section className="home-records">
        <div className="home-section-title"><h3>{L('慢慢积攒的故事', 'Little stories, collected')}</h3></div>
        <nav className="home-record-grid" aria-label={L('记录与成长', 'Memories and growth')}>
          <button data-tone="gold" onClick={props.onOpenAchievements}>
            <Trophy size={20} /><strong>{L('成就', 'Achievements')}</strong><small className={props.hasAchievementNotice || achievementGiftReady ? 'home-notice-text' : undefined}>{achievementGiftReady ? L('有奖励待领取', 'Rewards to claim') : props.hasAchievementNotice ? L('有新成就可以看看', 'New achievements to view') : L('每一步都算数', 'Every little step')}</small><ClaimNotice show={achievementGiftReady} />
          </button>
          <button data-tone="sky" onClick={props.onOpenCommonDreams}><Sparkles size={20} /><strong>{L('伙伴梦想', 'Dreams')}</strong><small>{L('一起期待的未来', 'A future together')}</small><ClaimNotice show={dreamGiftReady} /></button>
        </nav>
      </section>
      <p className="home-quiet-note">{L('把普通的每一天，过成喜欢的样子。', 'A little life, made brighter together.')}</p>
      <MemoryCover days={Math.max(1, Math.floor(pet.ageSeconds / 86400) + 1)} image={props.memoryImage ?? petStatusImages?.content ?? ''} unlocked={Boolean(props.memoryArtUnlocked)} hasReward={festivalGiftReady} onOpen={onOpenMemories} />
    </aside>
    {today && <section className="home-today">
      <div className="home-section-title"><h3>{L('今日小事', 'Little things today')}</h3><small>{L('什么时候都可以', 'Whenever you feel like it')}</small></div>
      {!wish.claimed && <button className="home-todo" disabled={busy && !wish.canClaim} onClick={onDailyWish}><span>💌</span><div><strong>{wish.title}</strong><small>{wish.progressText} · {wish.rewardText}</small></div><b>›</b><ClaimNotice show={wish.canClaim} /></button>}
      {welcome && <button className="home-todo" disabled={busy && !welcome.canClaim} onClick={onReturnWelcome}><span>🌼</span><div><strong>{welcome.title}</strong><small>{welcome.progressText} · {welcome.rewardText}</small></div><b>›</b><ClaimNotice show={welcome.canClaim} /></button>}
      {pet.partnerSchedule.pendingResult && <button className="home-todo" onClick={onOpenPartnerSchedule}><span>🧺</span><div><strong>{L('伙伴带着收获回来啦', 'Your companion is back')}</strong><small>{L('看看这次计时工作的小收获', 'See what they brought back')}</small></div><b>›</b></button>}
      {friendGiftReady && <button className="home-todo" onClick={props.onOpenBoostCards}><span>🎁</span><div><strong>{L('邻居的小礼物', 'A little gift from next door')}</strong><small>{L('朋友卡今日礼物和金币待领取', 'Your daily friend card gift and coins are ready')}</small></div><b>›</b></button>}
      {props.gardenReminder === 'ready' && <button className="home-todo" onClick={onOpenGarden}><span>🌱</span><div><strong>{L('花园有好消息', 'Good news from the garden')}</strong><small>{L('有果实可以收获啦', 'Ready to harvest')}</small></div><b>›</b></button>}
      {props.gardenReminder === 'withered' && <button className="home-todo" onClick={onOpenGarden}><span>🌿</span><div><strong>{L('小花园需要照顾', 'A little garden care')}</strong><small>{L('看看枯萎的植物，安排下一次种植', 'Check a wilted plant and plan your next planting')}</small></div><b>›</b></button>}
    </section>}
    </div>
  </div>;
};
import { isExpeditionAway } from '../core/expeditionData';
