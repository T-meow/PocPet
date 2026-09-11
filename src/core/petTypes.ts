import type { DishId, KitchenMaterialId, KitchenState, MiniGameState, CompanionMemoryState } from './companionActivityTypes';

export type PetStatus = 'content' | 'hungry' | 'sad' | 'dirty' | 'tired' | 'sick' | 'sleeping';

export type BuiltinItemId =
  | DishId
  | KitchenMaterialId
  | 'emergency_biscuit'
  | 'bento'
  | 'orange'
  | 'apple'
  | 'banana'
  | 'watermelon'
  | 'nutri_meal'
  | 'pig_trotter'
  | 'strawberry_cake'
  | 'birthday_cake'
  | 'ad_milk'
  | 'strawberry_milk'
  | 'small_bouquet'
  | 'shiny_sticker'
  | 'soft_cloud_doll'
  | 'ribbon_bell'
  | 'toy_ball'
  | 'picture_book'
  | 'shampoo'
  | 'wet_wipes'
  | 'medicine'
  | 'vitamin_tablet'
  | 'blanket'
  | 'energy_drink'
  | 'golden_apple'
  | 'fruit_tree_sapling'
  | 'care_tree_sapling'
  | 'gift_tree_sapling'
  | 'money_tree_sapling'
  | 'golden_apple_tree_sapling'
  | 'normal_fertilizer'
  | 'heart_fertilizer'
  | 'harvest_nutrient';

export type ModItemId = `${string}:${string}`;

export type ItemId = BuiltinItemId | ModItemId;

export type Inventory = Record<string, number>;

export type GardenTreeId = 'fruit_tree' | 'care_tree' | 'gift_tree' | 'money_tree' | 'golden_apple_tree';

export type GardenFertilizerId = 'normal' | 'heart';

export type GardenCareActionId = 'water' | GardenFertilizerId;

export type GardenCareBlockedReason = 'minimum_remaining' | 'round_limit';

export interface GardenCarePreview {
  percent: number;
  nominalReductionMs: number;
  actualReductionMs: number;
  remainingAfterMs: number;
  blockedReason?: GardenCareBlockedReason;
}

export type GardenToolId = 'watering_can' | 'shovel' | 'fertilizer_box';

export type GardenSlotState = 'empty' | 'growing' | 'ready' | 'withered';

export interface GardenDrop {
  kind?: 'item' | 'coins';
  itemId?: ItemId;
  amount: number;
}

export interface GardenSlot {
  slotIndex: number;
  unlocked: boolean;
  treeId?: GardenTreeId;
  plantedAt: number;
  lastWateredAt: number;
  lastFertilizedAt: number;
  lastBoostedAt: number;
  lastWateredDateKey: string;
  lastFertilizedDateKey: string;
  lastBoostedDateKey: string;
  naturalReadyAt: number;
  careReductionMs: number;
  nextReadyAt: number;
  harvestsUsed: number;
  maxHarvests: number;
  fertilizerType?: GardenFertilizerId;
  hasNutrientBoost: boolean;
  dailyHarvestDateKey: string;
  dailyHarvestCount: number;
  pendingDrops: GardenDrop[];
  state: GardenSlotState;
}

export interface GardenTools {
  wateringCanLevel: number;
  shovelLevel: number;
  fertilizerBoxLevel: number;
}

export interface GardenState {
  schemaVersion: 4;
  activeSlotIndex: number;
  slots: GardenSlot[];
  dailyCareDateKey: string;
  dailyWaterCount: number;
  dailyFertilizeCount: number;
  dailyHarvestDateKey: string;
  dailyHarvestCount: number;
  tools: GardenTools;
  lifetimeHarvestCount: number;
}

export type BoostCardId = 'friend_pass' | 'best_friend_pass';

export interface BoostCardState {
  schemaVersion: 2;
  friendPassExpiresAt: number;
  bestFriendPassExpiresAt: number;
  bestFriendPassPurchasedDays: number;
  dailyDateKey: string;
  dailyRewardClaimed: boolean;
  dailyWorkBonusCoinsUsed: number;
  dailyGardenExtraDrops: number;
}

export type GachaTicketSource = 'partner_schedule' | 'daily_wish' | 'daily_encounter';

export type GachaPaymentMethod = 'coins' | 'tickets';

export type GachaRewardRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'jackpot';

export interface GachaResult {
  id: string;
  rewardId: string;
  kind: 'coins' | 'item' | 'hearts';
  amount: number;
  itemId?: BuiltinItemId;
  rarity: GachaRewardRarity;
  guaranteed: boolean;
  pityGuaranteed: boolean;
  drawnAt: number;
}

export interface GoldenAppleGachaState {
  schemaVersion: 4;
  tickets: number;
  totalDraws: number;
  coinsSpent: number;
  ticketsSpent: number;
  rngSeed: string;
  rngCounter: number;
  dailyDateKey: string;
  dailyProcessedSources: GachaTicketSource[];
  dailyGrantedSources: GachaTicketSource[];
  dailyTicketsGranted: number;
  jackpotCount: number;
  jackpotPityMisses: number;
  jackpotPityUsed: boolean;
  recentResults: GachaResult[];
  heartGachaTotalDraws: number;
  heartGachaApplesSpent: number;
  heartGachaRngCounter: number;
  recentHeartResults: GachaResult[];
}

export interface DreamProjectProgress {
  completedStages: number;
  currentStageCoins: number;
  completedAt?: number;
}

export interface ClassicEndgameState {
  schemaVersion: 2;
  projects: Record<PartnerScheduleCategory, DreamProjectProgress>;
  completedAt?: number;
  legacyLevel: number;
  legacyCoinsInvested: number;
  lifetimeCoinsInvested: number;
}

export type ShopCategory = 'food' | 'item' | 'care' | 'garden';

export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'breezy';

export type CareActionKey = 'play' | 'clean' | 'work' | 'feed' | 'gift' | 'touch';

export interface ActionStreak {
  key: CareActionKey | 'none';
  count: number;
  windowStartedAt: number;
  lastAt: number;
}

export type RecentActivity =
  | 'idle'
  | 'happy'
  | 'bath'
  | 'eat_cookie'
  | 'eat_noodles'
  | 'eat_meat'
  | 'give_heart'
  | 'level_up'
  | 'reading_books'
  | 'workout'
  | 'work_food'
  | 'work_plants';

export type PomodoroPhase = 'focus' | 'short_break';

export interface PomodoroDurations {
  focusMinutes: number;
  shortBreakMinutes: number;
  targetRounds: number;
}

export type PomodoroActivity = Extract<RecentActivity, 'reading_books' | 'workout' | 'work_food' | 'work_plants'>;

export interface PomodoroState {
  isRunning: boolean;
  phase: PomodoroPhase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  round: number;
  completedFocusCount: number;
  dailyFocusDate: string;
  dailyCompletedFocusCount: number;
  settings: PomodoroDurations;
  currentActivity: PomodoroActivity;
  lastSettledPhaseId: string;
  pausedRemainingMs: number;
  focusRewardCheckpointAt: number;
  sessionFocusMs: number;
  baseRewardCoinsPaid: number;
  bonusRewardedHours: number;
  moodRewardedBlocks: number;
  hasTriggeredSessionResetEvent: boolean;
}

export interface PetBirthday {
  month: number;
  day: number;
}

export interface PetCalendarDate extends PetBirthday {
  year: number;
}

export type YearlyCareActionKey = Extract<CareActionKey, 'play' | 'clean' | 'work' | 'feed' | 'gift' | 'touch'>;

export interface YearlyStats {
  year: number;
  activeDateKeys: string[];
  careActionCounts: Record<YearlyCareActionKey, number>;
  itemUseCount: number;
  pomodoroFocusCount: number;
}

export interface YearReview {
  year: number;
  companionDays: number;
  activeDays: number;
  careActions: number;
  itemUseCount: number;
  pomodoroFocusCount: number;
  topCareAction?: YearlyCareActionKey;
}

export type DailyWishActionKey = 'feed' | 'clean' | 'play' | 'touch' | 'work';

export type DailyWishId = 'feed_once' | 'clean_once' | 'play_once' | 'touch_once' | 'work_once';

export interface DailyWishState {
  dateKey: string;
  id: DailyWishId;
  action: DailyWishActionKey;
  progress: number;
  target: number;
  rewardCoins: number;
  completedAt?: number;
  claimedAt?: number;
}

export type ReturnWelcomeActionKey = 'feed' | 'clean' | 'touch' | 'sleep';

export type ReturnWelcomeTaskId = 'feed_once' | 'clean_once' | 'touch_once' | 'sleep_once';

export interface ReturnWelcomeState {
  startedAt: number;
  awayDays: number;
  taskId: ReturnWelcomeTaskId;
  action: ReturnWelcomeActionKey;
  progress: number;
  target: number;
  rewardCoins: number;
  rewardItemIds: ItemId[];
  completedAt?: number;
  claimedAt?: number;
}

export type PartnerScheduleCategory = 'study' | 'cooking' | 'garden' | 'exercise';

export type PartnerScheduleSize = 'short' | 'standard' | 'long';

export type PartnerScheduleRewardChoice = 'coins' | 'category';

export interface PartnerScheduleOffer {
  id: string;
  templateId: string;
  dateKey: string;
}

export type NeighborReference =
  | { kind: 'generic' }
  | { kind: 'mod'; modId: string };

export interface NeighborIdentity {
  modId: string;
  name: string;
}

export interface NeighborGiftCandidate {
  itemId: ItemId;
  displayName: string;
  price: number;
}

export interface NeighborEventContext {
  neighbors: readonly NeighborIdentity[];
  giftCandidates: readonly NeighborGiftCandidate[];
  random?: () => number;
}

export interface PartnerScheduleSkill {
  level: number;
  xp: number;
  masterCompletions: number;
}

export interface ActivePartnerSchedule {
  offerId: string;
  templateId: string;
  category: PartnerScheduleCategory;
  size: PartnerScheduleSize;
  startedAt: number;
  endsAt: number;
  coinReward: number;
  skillXp: number;
  trophyRewardMultiplier: number;
  grantsMasterCompletion: boolean;
  neighbor?: NeighborReference;
}

export interface PartnerScheduleResult {
  offerId: string;
  templateId: string;
  category: PartnerScheduleCategory;
  size: PartnerScheduleSize;
  completedAt: number;
  coinReward: number;
  skillXp: number;
  trophyRewardMultiplier: number;
  grantsMasterCompletion: boolean;
  neighbor?: NeighborReference;
}

export interface PartnerScheduleState {
  schemaVersion: 6;
  boardDateKey: string;
  boardOfferCount: number;
  offers: PartnerScheduleOffer[];
  neighborOfferId?: string;
  completedOfferIds: string[];
  active?: ActivePartnerSchedule;
  pendingResult?: PartnerScheduleResult;
  skills: Record<PartnerScheduleCategory, PartnerScheduleSkill>;
}

export type AchievementId = string;

export interface AchievementCounters {
  careActionCounts: Record<YearlyCareActionKey, number>;
  pomodoroFocusCount: number;
  bestDailyPomodoroFocusCount: number;
  itemUseCountsById: Partial<Record<string, number>>;
  totalItemUseCount: number;
  purchaseCount: number;
  paidPurchaseCount: number;
  sleepStartCount: number;
  dailyWishClaimCount: number;
  returnWelcomeClaimCount: number;
  dateRewardClaimCountsByKind: Partial<Record<string, number>>;
  heartEarnedTotal: number;
  coinEarnedTotal: number;
  maxCoinsHeld: number;
  manualWakeCount: number;
  naturalWakeCount: number;
  gardenPlantCount: number;
  gardenWaterCount: number;
  gardenHarvestCountsByTreeId: Partial<Record<GardenTreeId, number>>;
  partnerScheduleClaimCount: number;
  partnerScheduleClaimCountsByCategory: Partial<Record<PartnerScheduleCategory, number>>;
  partnerScheduleLongClaimCountsByCategory: Partial<Record<PartnerScheduleCategory, number>>;
  partnerScheduleCategoryRewardClaimCount: number;
  companionYearActiveDateKeysByYear: Record<string, string[]>;
}

export interface AchievementState {
  unlockedAtById: Partial<Record<AchievementId, number>>;
  claimedOneTimeRewardIds: AchievementId[];
  dailyStipendClaimDateKey: string;
  completedGoodEndingYears: number[];
  unlockedCgIds: string[];
  pendingReviewNotice: boolean;
  counters: AchievementCounters;
}

export interface TimeGuardState {
  schemaVersion: 1;
  lastObservedAt: number;
  maxDailyDateKey: string;
}

export interface PetState {
  name: string;
  level: number;
  hunger: number;
  mood: number;
  cleanliness: number;
  energy: number;
  health: number;
  createdAt: number;
  metDate: PetCalendarDate;
  ageSeconds: number;
  lastUpdatedAt: number;
  isSleeping: boolean;
  recentEvent: string;
  recentActivity: RecentActivity;
  recentActivityUntil: number;
  coins: number;
  hearts: number;
  inventory: Inventory;
  lastDailyRewardAt: number;
  lastDailyEncounterAt: number;
  dailyEncounterDateKey: string;
  neighborGiftDateKey: string;
  neighborGiftCount: number;
  dailyBiscuitClaimDate: string;
  dailyBiscuitClaims: number;
  dailyDiscountDate: string;
  dailyDiscountItemIds: BuiltinItemId[];
  dailyDiscountUsedItemIds: BuiltinItemId[];
  dailyDiscountUsed: boolean;
  dailyHeartExchangeDate: string;
  dailyHeartExchangeCount: number;
  weatherDate: string;
  weather: WeatherType;
  lastEnergyRecoveryAt: number;
  sleepStartedAt: number;
  sleepStartMood: number;
  sleepStartHunger: number;
  sleepStartCleanliness: number;
  lowCleanlinessSleepConfirmCount: number;
  lastDreamTalkAt: number;
  actionStreak: ActionStreak;
  lastInteractionAt: number;
  lastPetInteractionAt: number;
  pomodoro: PomodoroState;
  hasOpenedHelp: boolean;
  hasSeenCommonDreamsUnlock: boolean;
  suppressGoldenAppleUseConfirm: boolean;
  claimedRewardIds: string[];
  birthday?: PetBirthday;
  claimedDateRewardKeys: string[];
  dailyLoginRewardDateKey?: string;
  yearlyStats: YearlyStats;
  pendingYearReview?: YearReview;
  latestYearReview?: YearReview;
  lastYearReviewYear?: number;
  dailyWish: DailyWishState;
  returnWelcome?: ReturnWelcomeState;
  achievements: AchievementState;
  lastCleanActionAt: number;
  garden: GardenState;
  boostCards: BoostCardState;
  partnerSchedule: PartnerScheduleState;
  goldenAppleGacha: GoldenAppleGachaState;
  classicEndgame: ClassicEndgameState;
  timeGuard: TimeGuardState;
  kitchen: KitchenState;
  miniGames: MiniGameState;
  companionMemories: CompanionMemoryState;
}

export type PetAction = 'play' | 'clean' | 'sleep' | 'work';

export interface ItemEffect {
  hunger?: number;
  mood?: number;
  cleanliness?: number;
  energy?: number;
  health?: number;
}

export interface ShopItem {
  id: BuiltinItemId;
  name: string;
  kind: ShopCategory;
  price: number;
  effect: ItemEffect;
  summary: string;
  tags?: string[];
  usable?: boolean;
}

export interface ItemDefinition {
  id: ItemId;
  name: string;
  kind: ShopCategory;
  price: number;
  effect: ItemEffect;
  summary: string;
  imageUrl?: string;
  source: 'builtin' | 'mod' | 'unknown';
  shop: boolean;
  tags: string[];
  usable: boolean;
}

export type ItemRegistry = ReadonlyMap<string, ItemDefinition>;

export type InventoryItemDefinition = ItemDefinition & {
  displayName: string;
  displaySummary: string;
};

export interface UseInventoryItemOptions {
  actorId?: string;
  favoriteFoodIds?: readonly ItemId[];
  favoriteText?: (amount: number) => string | undefined;
  itemName?: string;
  item?: ItemDefinition;
  quantity?: number;
}

export interface BuyItemOptions {
  item?: ItemDefinition;
  quantity?: number;
}


