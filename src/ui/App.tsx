import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { CloudUpload, Heart, Settings, Ticket, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import {
  buyBoostCard,
  authorFollowGiftRewardId,
  completeClassicLegacyLevel,
  completeDreamProjectStage,
  exchangeClassicGoldenApplesForHearts,
  claimBoostCardDailyReward,
  getGardenReminder,
  cancelPartnerSchedule,
  claimPartnerScheduleResult,
  applyPetAction,
  claimAllAchievementRewards,
  claimAchievementReward,
  claimReturnWelcomeReward,
  buyItem,
  canStartPomodoro,
  claimDailyWishReward,
  claimGoldenAppleGachaStarterGift,
  exchangeHeartForCoins,
  createDefaultPet,
  drawGoldenAppleHeartGacha,
  drawGoldenAppleGacha,
  defaultPetBirthday,
  defaultPetName,
  dismissYearReview,
  getAchievementSummary,
  gardenCompensationCoins,
  gardenCompensationRewardId,
  getNextUpgradeHeartCost,
  getPetStatThreshold,
  getInventoryItem,
  getInventoryDefinitions,
  getItemDefinition,
  getNeighborIdentities,
  getShopDefinitions,
  resolveNeighborName,
  selectNeighborReference,
  createItemRegistry,
  heartExchangeCooldownMs,
  interactWithPet,
  investClassicLegacy,
  investDreamProject,
  isPetCriticallyHungry,
  isPetLowEnergy,
  markAchievementReviewSeen,
  markClassicEndgameUnlockSeen,
  pausePomodoro,
  petInteractionHeartHealthThreshold,
  petInteractionHeartMoodThreshold,
  resetPomodoro,
  pomodoroMinHealthThreshold,
  recordPetInteraction,
  updatePetProfile,
  shopCategories,
  startPomodoro,
  startPartnerSchedule,
  updatePomodoroSettings,
  upgradePet,
  useInventoryItem,
  withBackfilledBirthday,
  withPetIdentityBirthday,
  type AchievementId,
  type AchievementView,
  type BoostCardId,
  type InventoryItemDefinition,
  type GachaPaymentMethod,
  type GachaResult,
  type GoldenAppleGachaDrawOutcome,
  type ItemId,
  type NeighborEventContext,
  type NeighborIdentity,
  type PetAction,
  type PetBirthday,
  type PetState,
  type PetStatus,
  type PartnerScheduleRewardChoice,
  type PartnerScheduleCategory,
  type PomodoroDurations,
  type ShopCategory,
  type YearReview,
} from '../core/pet';
import { currencyIcon, giftBoxIcon, goodEndingImage, resolveItemIcons, resolvePetActivityImages, resolvePetStatusImages } from '../assets';
import {
  getAudioEnabled,
  playSfx,
  setAudioEnabled,
  syncBgm,
  unlockAudio,
  type BgmMode,
  type SfxId,
} from '../core/audio';
import {
  clearPet,
  getImportBackup,
  getPreservedCorruptPetRaw,
  loadPet,
  replacePetFromImport,
  restorePetBackup,
  savePet,
  type PetStorageLoadResult,
} from '../core/storage';
import {
  formatFavoriteFoodText,
  getModFavoriteFoodIds,
  getModStatusText,
  parsePetModZip,
  type ActivePetMod,
  type InstalledPetModSummary,
} from '../core/mod';
import { builtinMintMod, getBuiltinPetMod } from '../core/builtinPetMods';
import {
  clearActivePetMod,
  deletePetMod,
  getPetModLibraryState,
  installPetMod,
  listInstalledPetMods,
  loadActivePetMod,
  loadPetMod,
  setActivePetMod,
} from '../core/modStorage';
import { createSaveFileText, mintSaveAppId, parseSaveFileText, type PocPetImportedSave } from '../core/saveCodec';
import { resolveImportedSaveMod } from '../core/saveImport';
import { AchievementsPage, type AchievementTabId } from './AchievementsPage';
import { BoostCardModal } from './BoostCardModal';
import { CommonDreamsPage } from './CommonDreamsPage';
import { ConfirmDialog } from './ConfirmDialog';
import { GardenPage } from './GardenPage';
import { GoldenAppleGachaModal } from './GoldenAppleGachaModal';
import { HomePage } from './HomePage';
import { InventoryModal } from './InventoryModal';
import { PomodoroOverlay } from './PomodoroOverlay';
import { PartnerSchedulePage } from './PartnerSchedulePage';
import { RolePicker } from './RolePicker';
import { SettingsModal, type SettingsPage } from './SettingsModal';
import { ShopModal } from './ShopModal';
import { YearReviewModal } from './YearReviewModal';
import { formatCompactNumber } from './numberFormat';
import { getLanguage, setLanguage, t, type LanguageCode } from '../i18n';
import { createSaveFileName, saveTextFile } from '../platform/saveTextFile';
import { createShareImageFileName, saveShareImage, type SaveImageFileResult } from '../platform/saveImageFile';
import { createGachaPoster, createPetProfilePoster, createYearReviewPoster, getToyPosterQrCode, type GachaMachine } from '../platform/sharePoster';
import { useAppNavigation } from './app/useAppNavigation';
import { useInventoryController } from './app/useInventoryController';
import { useGardenController } from './app/useGardenController';
import { usePetSession } from './app/usePetSession';
import { useRewardController, type RewardPopupData } from './app/useRewardController';
import { useToyIntegration } from './app/useToyIntegration';
import { features } from '../platform/edition';
import { acknowledgeEditionNotice, readEditionNotice, shouldShowEditionNotice } from '../core/editionNotice';
import { useAutomaticBackup } from './app/useAutomaticBackup';
import { useClientUpdates } from './app/useClientUpdates';
import { assertStorageUnchanged, getStoredSaveIdentity, setStoredSaveIdentity } from '../core/storage';
import type { BackupSnapshot } from '../platform/automaticBackup';
import { collectRecoveryCandidates, readRecoveryCandidate, type SaveRecoveryCandidate } from '../platform/saveRecovery';
import { SaveRecovery } from './SaveRecovery';

const getPomodoroRemainingMs = (pet: PetState) =>
  pet.pomodoro.isRunning ? pet.pomodoro.phaseEndsAt - Date.now() : pet.pomodoro.pausedRemainingMs;

const getPomodoroPhaseDurationMs = (pet: PetState) => {
  if (pet.pomodoro.isRunning && pet.pomodoro.phaseStartedAt > 0 && pet.pomodoro.phaseEndsAt > pet.pomodoro.phaseStartedAt) {
    return pet.pomodoro.phaseEndsAt - pet.pomodoro.phaseStartedAt;
  }

  const minutes = pet.pomodoro.phase === 'focus' ? pet.pomodoro.settings.focusMinutes : pet.pomodoro.settings.shortBreakMinutes;

  return minutes * 60 * 1000;
};

const getPomodoroProgress = (pet: PetState) => {
  const duration = getPomodoroPhaseDurationMs(pet);
  if (duration <= 0) return 0;
  const elapsed = duration - Math.max(0, getPomodoroRemainingMs(pet));
  return Math.max(0, Math.min(100, (elapsed / duration) * 100));
};

type PomodoroSettingKey = keyof PomodoroDurations;
type SoundOutcome = 'success' | 'blocked' | 'heart' | 'low_state';
type RewardPopup = RewardPopupData;
type RewardDisplayItem = { key: string; icon?: string; glyph?: 'heart' | 'ticket'; label: string; title?: string };
type WishQuickAction = PetState['dailyWish']['action'] | NonNullable<PetState['returnWelcome']>['action'];
type AchievementCgPopup = { title: string; description: string; image: string; fileName: string };
type PendingImageSave =
  | { kind: 'profile' }
  | { kind: 'year'; review: YearReview }
  | { kind: 'gacha'; machine: GachaMachine; results: GachaResult[] }
  | { kind: 'achievement'; fileName: string; imageUrl: string };
type PetAppProps = {
  initialPet: PetState;
  initialPersistenceError?: string;
  initialActiveMod: ActivePetMod | null;
  initialInstalledMods: readonly InstalledPetModSummary[];
  onResetToPicker: (storedMod: ActivePetMod | null, installedMods: readonly InstalledPetModSummary[]) => void;
};
const achievementToastLabels = {
  single: t('ui.achievements.toast.single'),
  review: t('ui.achievements.toast.review'),
  reviewTitle: t('ui.achievements.toast.reviewTitle'),
};
const achievementCgImages: Record<string, string> = {
  good_ending_year_1: goodEndingImage,
};

const getInventoryCount = (pet: PetState, itemId: ItemId) => pet.inventory[itemId] ?? 0;
const getDisplayItem = (items: readonly InventoryItemDefinition[], itemId: ItemId) => items.find((item) => item.id === itemId);
const getActionSfx = (action: PetAction): SfxId => {
  if (action === 'clean') return 'action_bath';
  if (action === 'play' || action === 'work') return 'action_work_play_medicine';
  return 'pet_touch';
};

const getItemSfx = (itemId: ItemId, item?: { kind: 'food' | 'item' | 'care' | 'garden' }): SfxId => {
  const resolvedItem = item ?? getInventoryItem(itemId);
  if (resolvedItem?.kind === 'food') return 'action_eat';
  if (itemId === 'shampoo' || itemId === 'wet_wipes') return 'action_bath';
  if (itemId === 'blanket' || itemId === 'soft_cloud_doll' || itemId === 'picture_book') return 'action_blanket';
  if (itemId === 'medicine' || itemId === 'vitamin_tablet' || itemId === 'energy_drink') return 'action_work_play_medicine';
  return 'pet_heart';
};
const downloadImageFile = (fileName: string, imageUrl: string) => {
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const readFileText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(t('ui.settings.save.readFileFailed')));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });

const getPetInteractionOutcome = (pet: PetState): SoundOutcome => {
  if (
    pet.isSleeping
    || isPetLowEnergy(pet)
    || isPetCriticallyHungry(pet)
    || pet.health < petInteractionHeartHealthThreshold
  ) {
    return 'low_state';
  }
  return pet.mood >= petInteractionHeartMoodThreshold ? 'heart' : 'success';
};

const createPetForMod = (mod: ActivePetMod | null) => {
  const fresh = createDefaultPet();
  if (!mod) return withPetIdentityBirthday(fresh, defaultPetBirthday);
  return {
    ...withPetIdentityBirthday(fresh, mod.manifest.birthday),
    name: mod.manifest.defaultPetName,
    recentEvent: mod.manifest.texts?.recentEvent ?? fresh.recentEvent,
  };
};

const createNeighborEventContext = (
  installedMods: readonly InstalledPetModSummary[],
  activeMod: ActivePetMod | null,
): NeighborEventContext => {
  const registry = createItemRegistry(activeMod);
  return {
    neighbors: getNeighborIdentities(installedMods, activeMod?.manifest.id),
    giftCandidates: getShopDefinitions(registry).map((item) => ({
      itemId: item.id,
      displayName: item.displayName,
      price: item.price,
    })),
  };
};

let initialAppLoadPromise: Promise<{
  mods: readonly InstalledPetModSummary[];
  mod: ActivePetMod | null;
  petResult: PetStorageLoadResult;
}> | undefined;

const loadInitialAppState = () => {
  if (!initialAppLoadPromise) {
    initialAppLoadPromise = Promise.resolve().then(() => {
      getPetModLibraryState();
      return Promise.all([listInstalledPetMods(), loadActivePetMod()]);
    })
      .then(([mods, mod]) => ({
        mods,
        mod,
        petResult: loadPet(Date.now(), createNeighborEventContext(mods, mod), mod?.manifest.defaultPetName),
      }));
  }
  return initialAppLoadPromise;
};

const PetApp = ({ initialPet, initialPersistenceError, initialActiveMod, initialInstalledMods, onResetToPicker }: PetAppProps) => {
  const {
    activePage,
    isHomeRef,
    utilityDialog,
    setActivePage,
    openUtilityDialog,
    closeUtilityDialog,
  } = useAppNavigation();
  const [isPomodoroOpen, setPomodoroOpen] = useState(false);
  const [isAudioEnabled, setAudioEnabledState] = useState(() => getAudioEnabled());
  const [language, setLanguageState] = useState<LanguageCode>(() => getLanguage());
  const [activeShopCategory, setActiveShopCategory] = useState(shopCategories[0].id);
  const [draftName, setDraftName] = useState(initialPet.name);
  const [draftBirthday, setDraftBirthday] = useState<PetBirthday | undefined>(initialPet.birthday);
  const [activeMod, setActiveMod] = useState<ActivePetMod | null>(initialActiveMod);
  const [installedMods, setInstalledMods] = useState<readonly InstalledPetModSummary[]>(initialInstalledMods);
  const [modMessage, setModMessage] = useState('');
  const [saveText, setSaveText] = useState('');
  const [importSaveText, setImportSaveText] = useState('');
  const [pendingImportedSave, setPendingImportedSave] = useState<PocPetImportedSave | null>(null);
  const [pendingImportSourceText, setPendingImportSourceText] = useState('');
  const [isImportingSave, setIsImportingSave] = useState(false);
  const importInProgressRef = useRef(false);
  const [hasImportBackup, setHasImportBackup] = useState(() => Boolean(getImportBackup()));
  const [isResetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [modDeleteConfirmId, setModDeleteConfirmId] = useState<string | null>(null);
  const [isPartnerScheduleCancelConfirmOpen, setPartnerScheduleCancelConfirmOpen] = useState(false);
  const [isGoldenAppleUseConfirmOpen, setGoldenAppleUseConfirmOpen] = useState(false);
  const [activeAchievementCategory, setActiveAchievementCategory] = useState<AchievementTabId>('all');
  const [achievementCgPopup, setAchievementCgPopup] = useState<AchievementCgPopup | null>(null);
  const [settingsInitialPage, setSettingsInitialPage] = useState<SettingsPage>('main');
  const [isCloudUploadConfirmOpen, setCloudUploadConfirmOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState<'profile' | 'year' | 'gacha' | null>(null);
  const [yearCardSaveFeedback, setYearCardSaveFeedback] = useState('');
  const [gachaCardSaveFeedback, setGachaCardSaveFeedback] = useState('');
  const [pendingImageSave, setPendingImageSave] = useState<PendingImageSave | null>(null);
  const shareBusyRef = useRef(false);
  const pendingImageSaveRef = useRef<PendingImageSave | null>(null);
  const itemIconMap = useMemo(() => resolveItemIcons(activeMod), [activeMod]);
  const itemRegistry = useMemo(() => createItemRegistry(activeMod, itemIconMap), [activeMod, itemIconMap]);
  const neighbors = useMemo(
    () => getNeighborIdentities(installedMods, activeMod?.manifest.id),
    [activeMod?.manifest.id, installedMods],
  );
  const eventContext = useMemo<NeighborEventContext>(() => ({
    neighbors,
    giftCandidates: getShopDefinitions(itemRegistry).map((item) => ({
      itemId: item.id,
      displayName: item.displayName,
      price: item.price,
    })),
  }), [itemRegistry, neighbors]);
  const { pet, petRef, setPet, commitPet, achievementToast, setAchievementToast, persistenceError } = usePetSession(initialPet, isHomeRef, eventContext, initialPersistenceError);
  const backupController = useAutomaticBackup(petRef, getStoredSaveIdentity() ?? activeMod?.manifest, Boolean(persistenceError || pendingImportedSave || isImportingSave));
  const updateController = useClientUpdates();
  const [editionNoticeVisible, setEditionNoticeVisible] = useState(() => features.cloudSave && shouldShowEditionNotice(readEditionNotice()));
  const completedFocusCountRef = useRef(pet.pomodoro.completedFocusCount);
  const lastHeartExchangeAtRef = useRef(0);
  const [isHeartExchangeCoolingDown, setHeartExchangeCoolingDown] = useState(false);
  const hasLoadedModRef = useRef(false);
  const isInventoryOpen = utilityDialog === 'inventory';
  const isShopOpen = utilityDialog === 'shop';
  const isBoostCardOpen = utilityDialog === 'boostCards';
  const isGachaOpen = utilityDialog === 'gacha';
  const isSettingsOpen = utilityDialog === 'settings';

  const requestImageSave = (request: PendingImageSave) => {
    if (!features.shareCards && request.kind !== 'achievement') return;
    if (shareBusyRef.current || pendingImageSaveRef.current) return;
    if (request.kind === 'year') setYearCardSaveFeedback('');
    if (request.kind === 'gacha') setGachaCardSaveFeedback('');
    pendingImageSaveRef.current = request;
    setPendingImageSave(request);
  };

  useEffect(() => {
    setActiveMod(initialActiveMod);
    setPet((current) => {
      if (!initialActiveMod) return withBackfilledBirthday(current, defaultPetBirthday);
      const next = withPetIdentityBirthday(current, initialActiveMod.manifest.birthday);
      return next;
    });
    if (initialActiveMod) {
      setDraftBirthday(initialActiveMod.manifest.birthday);
      setModMessage(t('ui.settings.mod.active', { name: initialActiveMod.manifest.name, version: initialActiveMod.manifest.version }));
    } else {
      setDraftBirthday(defaultPetBirthday);
    }
    hasLoadedModRef.current = true;
  }, [initialActiveMod]);

  const petStatusImageMap = useMemo(() => resolvePetStatusImages(activeMod), [activeMod]);
  const petActivityImageMap = useMemo(() => resolvePetActivityImages(activeMod), [activeMod]);
  const displayInventoryItems = useMemo(() => getInventoryDefinitions(itemRegistry, pet.inventory), [itemRegistry, pet.inventory]);
  const inventoryController = useInventoryController(displayInventoryItems);
  const displayShopItems = useMemo(() => getShopDefinitions(itemRegistry), [itemRegistry]);
  const getStatusLabel = (status: PetStatus) => getModStatusText(activeMod, status) ?? t(`pet.status.${status}`);
  const ownedItems = displayInventoryItems;
  const visibleShopItems = useMemo(
    () => displayShopItems.filter((item) => item.kind === activeShopCategory),
    [activeShopCategory, displayShopItems],
  );
  const isLowEnergy = isPetLowEnergy(pet);
  const isCriticallyHungry = isPetCriticallyHungry(pet);
  const nextUpgradeCost = getNextUpgradeHeartCost(pet);
  const canUpgrade = nextUpgradeCost > 0 && pet.hearts >= nextUpgradeCost;
  const canRunPomodoro = canStartPomodoro(pet);
  const pomodoroRemainingMs = getPomodoroRemainingMs(pet);
  const pomodoroProgress = getPomodoroProgress(pet);
  const showPomodoroPanel = isPomodoroOpen;
  const pomodoroStartTitle = isLowEnergy
    ? t('ui.pomodoro.lowEnergyTitle')
    : pet.health <= getPetStatThreshold(pet, pomodoroMinHealthThreshold)
      ? t('ui.pomodoro.lowHealthTitle')
      : undefined;
  const isPomodoroActionDisabled = !pet.pomodoro.isRunning && !canRunPomodoro;
  const currentBgmMode: BgmMode = isShopOpen ? 'shop' : pet.isSleeping ? 'sleep' : 'room';
  const achievementSummary = getAchievementSummary(pet);
  const hasAchievementNotice = achievementSummary.pendingReviewNotice || achievementSummary.claimable > 0;
  const gardenReminder = getGardenReminder(pet);

  const playAfterUnlock = (id: SfxId) => {
    void unlockAudio().then(() => playSfx(id));
  };

  const gardenController = useGardenController({ petRef, setPet, commitPet, playAfterUnlock });
  const rewardController = useRewardController({ pet, setPet, commitPet, hasLoadedModRef, playAfterUnlock });
  const {
    clearConfirm: gardenClearConfirm,
    resetClearConfirm: resetGardenClearConfirm,
    selectSlot: handleSelectGardenSlot,
    unlockSlot: handleUnlockGardenSlot,
    plantTree: handlePlantTree,
    recycleSapling: handleRecycleGardenSapling,
    waterTree: handleWaterTree,
    fertilizeTree: handleFertilizeTree,
    useNutrient: handleGardenNutrient,
    harvestTree: handleHarvestTree,
    requestClear: handleRequestClearGardenSlot,
    cancelClear: handleCancelGardenClear,
    confirmClear: handleConfirmGardenClear,
    upgradeTool: handleUpgradeGardenTool,
    commitAction: commitGardenAction,
  } = gardenController;
  const {
    activeReward: activeRewardPopup,
    closeActiveReward,
    enqueueReward,
    availableFloatingReward,
    hasClaimedHelpGift: hasClaimedHelpPageGift,
    hasClaimedGardenCompensation,
    claimDateRewards,
    claimFloatingReward: handleClaimFloatingReward,
    claimHelpGift: handleClaimHelpPageGift,
    claimGardenCompensation: handleClaimGardenCompensation,
  } = rewardController;
  const toyIntegration = useToyIntegration({
    pet,
    petRef,
    activeMod,
    setPet,
    commitPet,
    onMessage: setModMessage,
    onAuthorReward: (tickets) => {
      playAfterUnlock('notification');
      enqueueReward({
        id: authorFollowGiftRewardId,
        title: t('ui.settings.author.rewardTitle'),
        message: t('ui.settings.author.rewardMessage', { count: tickets }),
        gachaTickets: tickets,
        items: [],
      });
    },
  });

  useEffect(() => {
    syncBgm(currentBgmMode);
  }, [currentBgmMode, isAudioEnabled]);

  useEffect(() => {
    claimDateRewards();
  }, [pet.lastUpdatedAt, pet.birthday, activeMod]);

  useEffect(() => {
    if (pet.pomodoro.completedFocusCount > completedFocusCountRef.current) {
      playSfx('notification');
    }
    completedFocusCountRef.current = pet.pomodoro.completedFocusCount;
  }, [pet.pomodoro.completedFocusCount]);

  useEffect(() => {
    if (activePage === 'home' && pet.achievements.pendingReviewNotice && !achievementToast) {
      setAchievementToast({ kind: 'review' });
    }
  }, [activePage, achievementToast, pet.achievements.pendingReviewNotice]);

  const handleAudioToggle = () => {
    const nextEnabled = !isAudioEnabled;
    setAudioEnabled(nextEnabled);
    setAudioEnabledState(nextEnabled);
    if (nextEnabled) {
      void unlockAudio().then(() => {
        syncBgm(currentBgmMode);
        playSfx('tap');
      });
    }
  };

  const handleAction = (action: PetAction) => {
    playAfterUnlock('tap');
    setPet((current) => {
      const next = applyPetAction(current, action);
      const actionSucceeded = next.recentEvent !== current.recentEvent || next.recentActivity !== current.recentActivity;
      playSfx(actionSucceeded ? getActionSfx(action) : 'error');
      return commitPet(next);
    });
  };

  const handleBuyItem = (itemId: ItemId, quantity: number) => {
    playAfterUnlock('tap');
    setPet((current) => {
      const beforeCount = getInventoryCount(current, itemId);
      const beforeCoins = current.coins;
      const item = getItemDefinition(itemRegistry, itemId);
      const next = buyItem(current, itemId, Date.now(), { item, quantity });
      const didGainItem = getInventoryCount(next, itemId) > beforeCount;
      const didSpendCoins = next.coins < beforeCoins;
      playSfx(didGainItem ? (didSpendCoins ? 'purchase' : 'coin') : 'error');
      return commitPet(next);
    });
  };

  const handleExchangeHeart = () => {
    const now = Date.now();
    if (now - lastHeartExchangeAtRef.current < heartExchangeCooldownMs) {
      playAfterUnlock('error');
      return;
    }

    lastHeartExchangeAtRef.current = now;
    setHeartExchangeCoolingDown(true);
    window.setTimeout(() => setHeartExchangeCoolingDown(false), heartExchangeCooldownMs);
    playAfterUnlock('tap');

    setPet((current) => {
      const beforeCoins = current.coins;
      const beforeHearts = current.hearts;
      const next = exchangeHeartForCoins(current, now);
      const didExchange = next.coins > beforeCoins && next.hearts < beforeHearts;
      playSfx(didExchange ? 'coin' : 'error');
      return commitPet(next);
    });
  };

  const useItemNow = (itemId: ItemId, quantity = 1, suppressGoldenAppleConfirm = false) => {
    playAfterUnlock('tap');
    setPet((current) => {
      const currentWithPreference = suppressGoldenAppleConfirm
        ? { ...current, suppressGoldenAppleUseConfirm: true }
        : current;
      const beforeCount = getInventoryCount(currentWithPreference, itemId);
      const displayItem = getDisplayItem(displayInventoryItems, itemId);
      const item = getItemDefinition(itemRegistry, itemId);
      const next = useInventoryItem(currentWithPreference, itemId, Date.now(), {
        favoriteFoodIds: getModFavoriteFoodIds(activeMod),
        favoriteText: (amount) => formatFavoriteFoodText(activeMod, amount),
        itemName: displayItem?.displayName,
        item,
        quantity,
      });
      playSfx(getInventoryCount(next, itemId) < beforeCount ? getItemSfx(itemId, item) : 'error');
      return commitPet(next);
    });
  };
  const handleInteract = () => {
    const outcome = getPetInteractionOutcome(petRef.current);
    playAfterUnlock(outcome === 'heart' ? 'pet_heart' : outcome === 'low_state' ? 'pet_low_state' : 'pet_touch');
    setPet((current) => commitPet(interactWithPet(current)));
  };

  const handleOpenShop = (category?: ShopCategory) => {
    playAfterUnlock('open');
    if (category) setActiveShopCategory(category);
    setPet((current) => recordPetInteraction(current));
    openUtilityDialog('shop');
  };

  const handleCloseShop = () => {
    playAfterUnlock('close');
    closeUtilityDialog();
  };

  const handleOpenInventory = () => {
    playAfterUnlock('open');
    inventoryController.prepareOpen();
    setPet((current) => recordPetInteraction(current));
    openUtilityDialog('inventory');
  };

  const handleCloseInventory = () => {
    playAfterUnlock('close');
    closeUtilityDialog();
  };

  const handleOpenGarden = () => {
    playAfterUnlock('open');
    setActivePage('garden');
    setPet((current) => recordPetInteraction(current));
  };

  const handleCloseGarden = () => {
    playAfterUnlock('close');
    resetGardenClearConfirm();
    setActivePage('home');
  };

  const handleOpenPartnerSchedule = () => {
    if (petRef.current.level < 3) {
      playAfterUnlock('error');
      return;
    }
    playAfterUnlock('open');
    setActivePage('partnerSchedule');
    setPet((current) => recordPetInteraction(current));
  };

  const handleClosePartnerSchedule = () => {
    playAfterUnlock('close');
    setPartnerScheduleCancelConfirmOpen(false);
    setActivePage('home');
  };

  const handleStartPartnerSchedule = (offerId: string) => {
    playAfterUnlock('tap');
    const neighbor = petRef.current.partnerSchedule.neighborOfferId === offerId
      ? selectNeighborReference(offerId, neighbors)
      : undefined;
    const next = startPartnerSchedule(petRef.current, offerId, Date.now(), neighbor);
    const didStart = next.partnerSchedule.active?.offerId === offerId;
    playSfx(didStart ? 'action_work_play_medicine' : 'error');
    setPet(commitPet(next));
    if (didStart) setActivePage('home');
  };

  const handleClaimPartnerSchedule = (choice: PartnerScheduleRewardChoice) => {
    playAfterUnlock('tap');
    setPet((current) => {
      const hadResult = Boolean(current.partnerSchedule.pendingResult);
      const neighborName = resolveNeighborName(current.partnerSchedule.pendingResult?.neighbor, neighbors);
      const next = claimPartnerScheduleResult(current, choice, Date.now(), neighborName);
      playSfx(hadResult && !next.partnerSchedule.pendingResult ? 'coin' : 'error');
      return commitPet(next);
    });
  };

  const handleUseItem = (itemId: ItemId, quantity: number) => {
    if (itemId === 'golden_apple' && !petRef.current.suppressGoldenAppleUseConfirm) {
      playAfterUnlock('tap');
      setGoldenAppleUseConfirmOpen(true);
      return;
    }
    useItemNow(itemId, quantity);
  };

  const handleSuppressGoldenAppleUseConfirm = () => {
    setGoldenAppleUseConfirmOpen(false);
    useItemNow('golden_apple', 1, true);
  };

  const handleConfirmPartnerScheduleCancel = () => {
    setPartnerScheduleCancelConfirmOpen(false);
    playAfterUnlock('close');
    setPet((current) => commitPet(cancelPartnerSchedule(current)));
  };

  const handleOpenBoostCards = () => {
    playAfterUnlock('open');
    openUtilityDialog('boostCards');
  };

  const handleCloseBoostCards = () => {
    playAfterUnlock('close');
    closeUtilityDialog();
  };

  const handleBuyBoostCard = (cardId: BoostCardId) => {
    commitGardenAction((current) => buyBoostCard(current, cardId), 'purchase');
  };

  const handleClaimBoostCardReward = () => {
    playAfterUnlock('tap');
    setPet((current) => {
      const result = claimBoostCardDailyReward(current, eventContext);
      playSfx(result.coins > 0 ? 'coin' : 'error');
      if (result.coins > 0) {
        enqueueReward({
          id: `boost_card:${result.pet.boostCards.dailyDateKey}`,
          title: t(result.gift ? 'ui.boostCards.rewardGiftTitle' : 'ui.boostCards.rewardCoinsTitle'),
          message: result.pet.recentEvent,
          coins: result.coins,
          items: result.gift ? [{ itemId: result.gift.itemId, amount: result.gift.itemAmount }] : [],
        });
        closeUtilityDialog();
      }
      return commitPet(result.pet);
    });
  };

  const handleOpenGacha = () => {
    playAfterUnlock('open');
    openUtilityDialog('gacha');
  };

  const handleCloseGacha = () => {
    playAfterUnlock('close');
    closeUtilityDialog();
  };

  const handleGachaDraw = (payment: GachaPaymentMethod, count: 1 | 10): GoldenAppleGachaDrawOutcome => {
    const outcome = drawGoldenAppleGacha(petRef.current, payment, count, Date.now());
    if (outcome.error) return outcome;
    const settled = commitPet(outcome.pet);
    savePet(settled);
    petRef.current = settled;
    setPet(settled);
    return { ...outcome, pet: settled };
  };

  const handleHeartGachaDraw = (count: 1 | 10): GoldenAppleGachaDrawOutcome => {
    const outcome = drawGoldenAppleHeartGacha(petRef.current, count, Date.now());
    if (outcome.error) return outcome;
    const settled = commitPet(outcome.pet);
    savePet(settled);
    petRef.current = settled;
    setPet(settled);
    return { ...outcome, pet: settled };
  };

  const handleClaimGachaStarterGift = () => {
    const outcome = claimGoldenAppleGachaStarterGift(petRef.current);
    if (!outcome.claimed) return false;
    const settled = commitPet(outcome.pet);
    savePet(settled);
    petRef.current = settled;
    setPet(settled);
    return true;
  };

  const handleOpenCommonDreams = () => {
    playAfterUnlock('open');
    setPet((current) => markClassicEndgameUnlockSeen(current));
    setActivePage('commonDreams');
  };

  const handleCloseCommonDreams = () => {
    playAfterUnlock('close');
    setActivePage('home');
  };

  const commitEndgameAction = (updater: (current: PetState) => PetState) => {
    playAfterUnlock('tap');
    setPet((current) => commitPet(updater(current)));
  };

  const handleOpenAchievements = () => {
    playAfterUnlock('open');
    setAchievementToast(null);
    setActivePage('achievements');
  };

  const handleCloseAchievements = () => {
    playAfterUnlock('close');
    setAchievementToast(null);
    setPet((current) => markAchievementReviewSeen(current));
    setActivePage('home');
  };

  const handleClaimAchievementReward = (id: AchievementId) => {
    playAfterUnlock('coin');
    setPet((current) => commitPet(claimAchievementReward(current, id)));
  };

  const handleClaimAllAchievementRewards = () => {
    playAfterUnlock('coin');
    setPet((current) => commitPet(claimAllAchievementRewards(current).pet));
  };

  const handleOpenAchievementCg = (achievement: AchievementView) => {
    const cgId = achievement.reward.cgId;
    const image = cgId ? activeMod?.cgImageUrls[cgId as keyof typeof activeMod.cgImageUrls] ?? achievementCgImages[cgId] : undefined;
    if (!achievement.unlocked || !image) {
      playAfterUnlock('error');
      return;
    }
    playAfterUnlock('open');
    setAchievementCgPopup({ title: achievement.title, description: achievement.description, image, fileName: `${achievement.id}.png` });
  };

  const handleSaveAchievementCg = () => {
    if (!achievementCgPopup) return;
    playAfterUnlock('tap');
    requestImageSave({
      kind: 'achievement',
      fileName: achievementCgPopup.fileName,
      imageUrl: achievementCgPopup.image,
    });
  };

  const handleCloseAchievementCg = () => {
    playAfterUnlock('close');
    setAchievementCgPopup(null);
  };


  const handleOpenPomodoro = () => {
    const willOpen = !isPomodoroOpen;
    playAfterUnlock(willOpen ? 'open' : 'close');
    setPet((current) => recordPetInteraction(current));
    setPomodoroOpen(willOpen);
  };

  const handleTogglePomodoro = () => {
    if (isPomodoroActionDisabled) {
      playAfterUnlock('error');
      return;
    }
    playAfterUnlock(petRef.current.pomodoro.isRunning ? 'tap' : 'pet_read');
    setPomodoroOpen(true);
    setPet((current) => commitPet(current.pomodoro.isRunning ? pausePomodoro(current) : startPomodoro(current)));
  };

  const handleResetPomodoro = () => {
    playAfterUnlock('notification');
    setPomodoroOpen(true);
    setPet((current) => commitPet(resetPomodoro(current)));
  };

  const handleUpgrade = () => {
    playAfterUnlock(canUpgrade ? 'pet_heart' : 'error');
    setPet((current) => commitPet(upgradePet(current)));
  };

  const handlePomodoroSettingChange = (key: PomodoroSettingKey, value: number) => {
    if (!Number.isFinite(value)) return;
    setPet((current) => updatePomodoroSettings(current, { [key]: value }));
  };

  const handleSaveProfile = () => {
    playAfterUnlock('tap');
    setPet((current) => updatePetProfile(current, features.rename ? draftName : current.name, draftBirthday));
    closeUtilityDialog();
  };

  const handleOpenHelp = () => {
    setModMessage('');
    setPet((current) => (current.hasOpenedHelp ? current : { ...current, hasOpenedHelp: true }));
    void toyIntegration.loadAuthorContent();
  };

  const handleClaimDailyWish = () => {
    playAfterUnlock('tap');
    setPet((current) => {
      const beforeClaimedAt = current.dailyWish.claimedAt;
      const next = claimDailyWishReward(current);
      const didClaim = next.dailyWish.claimedAt !== beforeClaimedAt;
      playSfx(didClaim ? 'coin' : 'error');
      return commitPet(next);
    });
  };

  const completeFeedWishAction = () => {
    const foodItem = displayInventoryItems.find((item) => item.kind === 'food' && item.id !== 'golden_apple' && getInventoryCount(petRef.current, item.id) > 0);
    if (!foodItem) {
      playAfterUnlock('open');
      setActiveShopCategory('food');
      setPet((current) => recordPetInteraction(current));
      openUtilityDialog('shop');
      return;
    }

    playAfterUnlock('tap');
    setPet((current) => {
      const beforeCount = getInventoryCount(current, foodItem.id);
      const displayItem = getDisplayItem(displayInventoryItems, foodItem.id);
      const item = getItemDefinition(itemRegistry, foodItem.id);
      const next = useInventoryItem(current, foodItem.id, Date.now(), {
        favoriteFoodIds: getModFavoriteFoodIds(activeMod),
        favoriteText: (amount) => formatFavoriteFoodText(activeMod, amount),
        itemName: displayItem?.displayName,
        item,
      });
      playSfx(getInventoryCount(next, foodItem.id) < beforeCount ? getItemSfx(foodItem.id, item) : 'error');
      return commitPet(next);
    });
  };

  const handleWishQuickAction = (action: WishQuickAction) => {
    switch (action) {
      case 'feed':
        completeFeedWishAction();
        return;
      case 'touch':
        handleInteract();
        return;
      case 'clean':
      case 'play':
      case 'work':
      case 'sleep':
        handleAction(action);
        return;
    }
  };

  const handleDailyWishButton = () => {
    const wish = petRef.current.dailyWish;
    if (wish.claimedAt) {
      playAfterUnlock('error');
      return;
    }
    if (wish.completedAt) {
      handleClaimDailyWish();
      return;
    }
    handleWishQuickAction(wish.action);
  };

  const handleClaimReturnWelcome = () => {
    playAfterUnlock('tap');
    setPet((current) => {
      const beforeClaimedAt = current.returnWelcome?.claimedAt;
      const next = claimReturnWelcomeReward(current);
      const didClaim = next.returnWelcome?.claimedAt !== beforeClaimedAt;
      playSfx(didClaim ? 'coin' : 'error');
      return commitPet(next);
    });
  };

  const handleReturnWelcomeButton = () => {
    const welcome = petRef.current.returnWelcome;
    if (!welcome) return;
    if (welcome.claimedAt) {
      playAfterUnlock('error');
      return;
    }
    if (welcome.completedAt) {
      handleClaimReturnWelcome();
      return;
    }
    handleWishQuickAction(welcome.action);
  };

  const handleLanguageChange = (nextLanguage: LanguageCode) => {
    if (nextLanguage === language) return;
    setLanguage(nextLanguage);
    setLanguageState(nextLanguage);
    window.location.reload();
  };

  const handleReset = () => {
    playAfterUnlock('tap');
    setResetConfirmOpen(true);
  };

  const handleCancelReset = () => {
    playAfterUnlock('close');
    setResetConfirmOpen(false);
  };

  const handleConfirmReset = () => {
    playAfterUnlock('tap');
    try { clearPet(); }
    catch { setModMessage(t('ui.backup.recoveryStorage')); setResetConfirmOpen(false); return; }
    onResetToPicker(activeMod, installedMods);
    setDraftName(defaultPetName);
    setDraftBirthday(defaultPetBirthday);
    setPomodoroOpen(false);
    closeUtilityDialog();
    setResetConfirmOpen(false);
  };

  const handleModFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!features.importMod) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const parsed = await parsePetModZip(file);
      await installPetMod(parsed);
      setInstalledMods(await listInstalledPetMods());
      if (activeMod?.manifest.id === parsed.manifest.id) {
        const oldDefaultName = activeMod.manifest.defaultPetName;
        const loaded = await loadPetMod(parsed.manifest.id);
        if (!loaded) throw new Error(t('ui.settings.mod.loadFailed'));
        setActiveMod(loaded);
        setPet((current) => ({
          ...withPetIdentityBirthday(current, parsed.manifest.birthday),
          name: current.name === oldDefaultName ? parsed.manifest.defaultPetName : current.name,
        }));
        setDraftName((current) => current === oldDefaultName ? parsed.manifest.defaultPetName : current);
        setDraftBirthday(parsed.manifest.birthday);
      }
      setModMessage(
        parsed.warnings.length > 0
          ? t('ui.settings.mod.importedWithFallback', { name: parsed.manifest.name, count: parsed.warnings.length })
          : t('ui.settings.mod.installed', { name: parsed.manifest.name }),
      );
      setSaveText('');
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.importFailed'));
      playSfx('error');
    }
  };

  const handleActivateMod = async (modId: string) => {
    try {
      const loaded = await loadPetMod(modId);
      if (!loaded) throw new Error(t('ui.settings.mod.loadFailed'));
      const oldDefaultName = activeMod?.manifest.defaultPetName ?? defaultPetName;
      assertStorageUnchanged();
      setActivePetMod(modId);
      setStoredSaveIdentity(loaded.manifest);
      setActiveMod(loaded);
      setPet((current) => {
        const shouldUseDefaultName = current.name === defaultPetName || current.name === oldDefaultName;
        return {
          ...withPetIdentityBirthday(current, loaded.manifest.birthday),
          name: shouldUseDefaultName ? loaded.manifest.defaultPetName : current.name,
          recentEvent: loaded.manifest.texts?.recentEvent ?? t('ui.settings.mod.switched', { name: loaded.manifest.name }),
        };
      });
      setDraftName((current) => current === defaultPetName || current === oldDefaultName ? loaded.manifest.defaultPetName : current);
      setDraftBirthday(loaded.manifest.birthday);
      setSaveText('');
      setModMessage(t('ui.settings.mod.active', { name: loaded.manifest.name, version: loaded.manifest.version }));
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.loadFailed'));
      playSfx('error');
    }
  };

  const handleClearMod = async () => {
    try {
      assertStorageUnchanged();
      const oldDefaultName = activeMod?.manifest.defaultPetName;
      await clearActivePetMod();
      setStoredSaveIdentity();
      setActiveMod(null);
      setPet((current) => {
        const shouldRestoreDefaultName = Boolean(oldDefaultName) && current.name === oldDefaultName;
        return {
          ...withPetIdentityBirthday(current, defaultPetBirthday),
          name: shouldRestoreDefaultName ? defaultPetName : current.name,
        };
      });
      setDraftName((current) => (oldDefaultName && current === oldDefaultName ? defaultPetName : current));
      setDraftBirthday(defaultPetBirthday);
      setSaveText('');
      setModMessage(t('ui.settings.mod.restored'));
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.restoreFailed'));
    }
  };

  const handleConfirmDeleteMod = async () => {
    const modId = modDeleteConfirmId;
    if (!modId) return;
    const target = installedMods.find((mod) => mod.manifest.id === modId);
    try {
      const wasActive = activeMod?.manifest.id === modId;
      const oldDefaultName = wasActive ? activeMod?.manifest.defaultPetName : undefined;
      assertStorageUnchanged();
      await deletePetMod(modId);
      setInstalledMods(await listInstalledPetMods());
      if (wasActive) {
        setActiveMod(null);
        setPet((current) => ({
          ...withPetIdentityBirthday(current, defaultPetBirthday),
          name: oldDefaultName && current.name === oldDefaultName ? defaultPetName : current.name,
        }));
        setDraftName((current) => oldDefaultName && current === oldDefaultName ? defaultPetName : current);
        setDraftBirthday(defaultPetBirthday);
      }
      setSaveText('');
      setModMessage(t('ui.settings.mod.deleted', { name: target?.manifest.name ?? modId }));
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.deleteFailed'));
      playSfx('error');
    } finally {
      setModDeleteConfirmId(null);
    }
  };

  const handleExportSave = () => {
    const text = createSaveFileText(petRef.current, getStoredSaveIdentity() ?? activeMod?.manifest);
    setSaveText(text);
    setModMessage(t('ui.settings.save.generated'));
  };

  const handleDownloadSave = async () => {
    const text = createSaveFileText(petRef.current, getStoredSaveIdentity() ?? activeMod?.manifest);
    setSaveText(text);
    try {
      const result = await saveTextFile(createSaveFileName(petRef.current.name), text);
      if (result === 'saved') setModMessage(t('ui.settings.save.saved'));
      if (result === 'downloaded') setModMessage(t('ui.settings.save.downloadStarted'));
      if (result === 'cancelled') setModMessage(t('ui.settings.save.saveCancelled'));
      if (result === 'text') setModMessage(t('ui.backup.textFallback'));
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.save.saveFailed'));
      playSfx('error');
    }
  };

  const handleCopySave = async () => {
    try { await navigator.clipboard.writeText(saveText); setModMessage(t('ui.backup.copied')); }
    catch { setModMessage(t('ui.backup.copyFallback')); }
  };
  const handleExportBackup = async (snapshot: BackupSnapshot) => {
    setSaveText(snapshot.text);
    try {
      const result = await saveTextFile(createSaveFileName(snapshot.petName, snapshot.savedAt), snapshot.text);
      setModMessage(t(result === 'text' ? 'ui.backup.textFallback' : result === 'cancelled' ? 'ui.settings.save.saveCancelled' : result === 'saved' ? 'ui.settings.save.saved' : 'ui.settings.save.downloadStarted'));
    } catch { setModMessage(t('ui.settings.save.saveFailed')); }
  };

  const getPosterSavedMessage = (result: SaveImageFileResult) => {
    if (result === 'album') return t('ui.share.savedAlbum');
    if (result === 'saved') return t('ui.share.savedFile');
    if (result === 'downloaded') return t('ui.share.downloadStarted');
    return t('ui.share.saveCancelled');
  };

  const getSharePetName = () => features.shareCustomName
    ? petRef.current.name
    : activeMod?.manifest.defaultPetName ?? defaultPetName;

  const performSaveProfileCard = async () => {
    if (shareBusyRef.current) return;
    shareBusyRef.current = true;
    setShareBusy('profile');
    setModMessage(t('ui.share.cardGenerating'));
    try {
      const name = getSharePetName();
      const qrCodeDataUrl = await getToyPosterQrCode();
      const image = await createPetProfilePoster({
        pet: { ...petRef.current, name },
        petImageUrl: petStatusImageMap.content,
        qrCodeDataUrl,
      });
      const result = await saveShareImage(createShareImageFileName(`${name}-profile`), image);
      setModMessage(getPosterSavedMessage(result));
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.share.saveFailed'));
      playSfx('error');
    } finally {
      shareBusyRef.current = false;
      setShareBusy(null);
    }
  };

  const performSaveYearReviewCard = async (review: YearReview) => {
    if (shareBusyRef.current) return;
    shareBusyRef.current = true;
    setShareBusy('year');
    setModMessage(t('ui.share.cardGenerating'));
    setYearCardSaveFeedback('');
    try {
      const name = getSharePetName();
      const qrCodeDataUrl = await getToyPosterQrCode();
      const image = await createYearReviewPoster({
        petName: name,
        review,
        petImageUrl: petStatusImageMap.content,
        qrCodeDataUrl,
      });
      const result = await saveShareImage(createShareImageFileName(`${name}-${review.year}`), image);
      const message = getPosterSavedMessage(result);
      setModMessage(message);
      setYearCardSaveFeedback(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('ui.share.saveFailed');
      setModMessage(message);
      setYearCardSaveFeedback(message);
      playSfx('error');
    } finally {
      shareBusyRef.current = false;
      setShareBusy(null);
    }
  };

  const performSaveGachaCard = async (machine: GachaMachine, results: readonly GachaResult[]) => {
    if (results.length === 0 || shareBusyRef.current) return;
    shareBusyRef.current = true;
    setShareBusy('gacha');
    setGachaCardSaveFeedback('');
    try {
      const qrCodeDataUrl = await getToyPosterQrCode();
      const image = await createGachaPoster({
        machine,
        results,
        itemIconMap,
        petImageUrl: petStatusImageMap.content,
        qrCodeDataUrl,
        createdAt: results[0]?.drawnAt,
      });
      const result = await saveShareImage(createShareImageFileName(`PocPet-gacha-${results.length}`), image);
      const message = getPosterSavedMessage(result);
      setModMessage(message);
      setGachaCardSaveFeedback(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('ui.share.saveFailed');
      setModMessage(message);
      setGachaCardSaveFeedback(message);
      playSfx('error');
    } finally {
      shareBusyRef.current = false;
      setShareBusy(null);
    }
  };

  const handleSaveProfileCard = () => requestImageSave({ kind: 'profile' });

  const handleSaveYearReviewCard = (review = petRef.current.latestYearReview) => {
    if (!review) return;
    requestImageSave({ kind: 'year', review: { ...review } });
  };

  const handleSaveGachaCard = (machine: GachaMachine, results: readonly GachaResult[]) => {
    if (results.length === 0) return;
    requestImageSave({ kind: 'gacha', machine, results: [...results] });
  };

  const handleCancelImageSave = () => {
    if (!pendingImageSaveRef.current) return;
    pendingImageSaveRef.current = null;
    setPendingImageSave(null);
  };

  const handleConfirmImageSave = () => {
    const request = pendingImageSaveRef.current;
    if (!request) return;
    pendingImageSaveRef.current = null;
    setPendingImageSave(null);
    if (request.kind === 'achievement') {
      downloadImageFile(request.fileName, request.imageUrl);
      return;
    }
    if (request.kind === 'profile') {
      void performSaveProfileCard();
      return;
    }
    if (request.kind === 'year') {
      void performSaveYearReviewCard(request.review);
      return;
    }
    void performSaveGachaCard(request.machine, request.results);
  };

  const handleConfirmCloudUpload = async () => {
    setCloudUploadConfirmOpen(false);
    try {
      await toyIntegration.upload();
      playAfterUnlock('notification');
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.cloud.uploadFailed'));
      playSfx('error');
    }
  };

  const handleCloudRestore = async () => {
    try {
      const restored = await toyIntegration.restore();
      prepareImportSaveFromText(restored.plainText);
      if (restored.recoveredFromPrevious) setModMessage(t('ui.settings.cloud.restoreFallback'));
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.cloud.restoreFailed'));
      playSfx('error');
    }
  };

  const prepareImportSaveFromText = (text: string) => {
    if (importInProgressRef.current) return;
    try {
      const imported = parseSaveFileText(text);
      setPendingImportedSave(imported);
      setPendingImportSourceText(text);
      setModMessage(t('ui.settings.save.previewReady'));
    } catch (error) {
      setPendingImportedSave(null);
      setPendingImportSourceText('');
      setModMessage(error instanceof Error ? error.message : t('ui.settings.save.importFailed'));
      playSfx('error');
    }
  };

  const handleConfirmImportSave = async () => {
    const preview = pendingImportedSave;
    const sourceText = pendingImportSourceText;
    if (!preview || !sourceText || importInProgressRef.current) return;

    importInProgressRef.current = true;
    setIsImportingSave(true);
    const previousActiveModId = activeMod?.manifest.id;
    let activeModResourcesMayHaveChanged = false;
    let importCommitted = false;

    try {
      let imported = parseSaveFileText(sourceText, Date.now());
      const importedMod = imported.activeMod;
      const { mod: resolvedMod, missingImportedMod, usedMintFallback } = await resolveImportedSaveMod(imported, loadPetMod);
      imported = parseSaveFileText(sourceText, Date.now(), (missingImportedMod ? importedMod?.defaultPetName : undefined) ?? resolvedMod?.manifest.defaultPetName);
      activeModResourcesMayHaveChanged = Boolean(resolvedMod);
      const nextPet = resolvedMod
        ? withPetIdentityBirthday(imported.pet, resolvedMod.manifest.birthday)
        : importedMod
          ? imported.pet
          : withBackfilledBirthday(imported.pet, defaultPetBirthday);

      assertStorageUnchanged();
      setActivePetMod(resolvedMod?.manifest.id);
      activeModResourcesMayHaveChanged = true;
      replacePetFromImport(nextPet, createSaveFileText(petRef.current, getStoredSaveIdentity() ?? activeMod?.manifest), importedMod ?? resolvedMod?.manifest ?? null);
      importCommitted = true;

      setHasImportBackup(true);
      setActiveMod(resolvedMod);
      petRef.current = nextPet;
      setPet(nextPet);
      setDraftName(nextPet.name);
      setDraftBirthday(nextPet.birthday);
      setImportSaveText('');
      setPendingImportedSave(null);
      setPendingImportSourceText('');
      setModMessage(
        importedMod && missingImportedMod
          ? t(
              usedMintFallback
                ? 'ui.settings.save.importedMissingModFallbackMint'
                : 'ui.settings.save.importedMissingMod',
              { name: importedMod.name, version: importedMod.version },
            )
          : t('ui.settings.save.imported'),
      );
    } catch (error) {
      if (!importCommitted && activeModResourcesMayHaveChanged) {
        try {
          setActivePetMod(previousActiveModId);
          setActiveMod(previousActiveModId ? await loadPetMod(previousActiveModId) : null);
        } catch {
          // Keep the original import error; persistent pet storage rolls itself back.
        }
      }
      setModMessage(error instanceof Error ? error.message : t('ui.settings.save.importFailed'));
      playSfx('error');
    } finally {
      importInProgressRef.current = false;
      setIsImportingSave(false);
    }
  };

  const handleCancelImportSave = () => {
    if (importInProgressRef.current) return;
    setPendingImportedSave(null);
    setPendingImportSourceText('');
  };

  const handleImportSaveFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      prepareImportSaveFromText(await readFileText(file));
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.save.readFailed'));
    }
  };

  const handleRestoreImportBackup = () => {
    const backupText = getImportBackup();
    if (!backupText) {
      setHasImportBackup(false);
      setModMessage(t('ui.settings.save.importBackupMissing'));
      playSfx('error');
      return;
    }
    prepareImportSaveFromText(backupText);
  };

  const modDeleteTarget = installedMods.find((mod) => mod.manifest.id === modDeleteConfirmId);
  const pendingImportExportTime = pendingImportedSave?.exportedAt
    ? new Date(pendingImportedSave.exportedAt).toLocaleString(language)
    : t('ui.settings.save.previewLegacyTime');
  const pendingImportModSummary = pendingImportedSave?.activeMod
    ?? (pendingImportedSave?.sourceApp === mintSaveAppId ? builtinMintMod.manifest : undefined);
  const pendingImportMod = pendingImportModSummary
    ? `${pendingImportModSummary.name} v${pendingImportModSummary.version}`
    : t('ui.settings.save.previewBuiltinMod');
  const pendingImportMessage = pendingImportedSave
    ? t('ui.settings.save.previewMessage', {
        name: pendingImportedSave.pet.name,
        level: pendingImportedSave.pet.level,
        exportedAt: pendingImportExportTime,
        mod: pendingImportMod,
      })
    : '';
  const activeYearReview = !activeRewardPopup && !achievementCgPopup && !utilityDialog && !isResetConfirmOpen && !modDeleteConfirmId && !gardenClearConfirm && !pendingImportedSave ? pet.pendingYearReview : undefined;

  const handleCloseYearReview = () => {
    playAfterUnlock('tap');
    setPet((current) => dismissYearReview(current));
  };

  const renderRewardItems = (reward: RewardPopup) => {
    const rewardItems: RewardDisplayItem[] = [];

    if (reward.coins) {
      rewardItems.push({
        key: 'coins',
        icon: currencyIcon,
        label: t('ui.rewards.coins', { coins: formatCompactNumber(reward.coins) }),
        title: t('ui.rewards.coins', { coins: reward.coins }),
      });
    }

    if (reward.hearts) {
      rewardItems.push({
        key: 'hearts',
        glyph: 'heart',
        label: t('ui.rewards.hearts', { hearts: formatCompactNumber(reward.hearts) }),
        title: t('ui.rewards.hearts', { hearts: reward.hearts }),
      });
    }

    if (reward.gachaTickets) {
      rewardItems.push({
        key: 'gacha-tickets',
        glyph: 'ticket',
        label: t('ui.rewards.gachaTickets', { count: formatCompactNumber(reward.gachaTickets) }),
        title: t('ui.rewards.gachaTickets', { count: reward.gachaTickets }),
      });
    }

    reward.items.forEach((item, index) => {
      const displayItem = getItemDefinition(itemRegistry, item.itemId);
      rewardItems.push({
        key: `${item.itemId}:${index}`,
        icon: itemIconMap[item.itemId] ?? displayItem?.imageUrl,
        label: t('ui.rewards.item', { item: displayItem?.name ?? item.itemId, count: item.amount }),
      });
    });

    return rewardItems.map((item) => (
      <div className="reward-modal__item" key={item.key} title={item.title}>
        {item.icon
          ? <img src={item.icon} alt="" aria-hidden="true" />
          : item.glyph === 'ticket'
            ? <Ticket size={22} aria-hidden="true" />
            : <Heart size={22} aria-hidden="true" />}
        <span>{item.label}</span>
      </div>
    ));
  };

  const pomodoroOverlay = showPomodoroPanel ? (
    <PomodoroOverlay
      pet={pet}
      progress={pomodoroProgress}
      remainingMs={pomodoroRemainingMs}
      isActionDisabled={isPomodoroActionDisabled}
      startTitle={pomodoroStartTitle}
      onToggle={handleTogglePomodoro}
      onReset={handleResetPomodoro}
      onSettingChange={handlePomodoroSettingChange}
    />
  ) : undefined;
  return (
    <main className="app-shell">
      {updateController.showReminder && !persistenceError && !utilityDialog && !pendingImportedSave && <div className="client-update-banner" role="status">
        <button type="button" className="text-button" onClick={() => { setSettingsInitialPage('updates'); openUtilityDialog('settings'); }}>{t('ui.updates.available', { version: updateController.result?.update?.version ?? '' })}</button>
        <button type="button" className="icon-button" title={t('ui.updates.later')} aria-label={t('ui.updates.later')} onClick={updateController.remindLater}><X size={18} /></button>
      </div>}
      {persistenceError && <div role="alert" className="persistence-warning">
        <p>{t(`ui.backup.${persistenceError}`)}</p>
        <button type="button" className="secondary-button" onClick={() => { setSettingsInitialPage('save'); openUtilityDialog('settings'); }}>{t('ui.backup.export')}</button>
        <button type="button" className="secondary-button" onClick={() => window.location.reload()}>{t('ui.backup.reload')}</button>
      </div>}
      {editionNoticeVisible && !persistenceError && !activeRewardPopup && !utilityDialog && !pendingImportedSave && !activeYearReview && !achievementCgPopup && !isResetConfirmOpen && !isCloudUploadConfirmOpen && !modDeleteConfirmId && !gardenClearConfirm && !pendingImageSave && !isPartnerScheduleCancelConfirmOpen && !isGoldenAppleUseConfirmOpen && (
        <ConfirmDialog title={t('ui.editionNotice.title')} message={t('ui.editionNotice.message')}
          cancelLabel={t('ui.editionNotice.acknowledge')} confirmLabel={t('ui.editionNotice.backup')} confirmTone="primary"
          onCancel={() => { acknowledgeEditionNotice(); setEditionNoticeVisible(false); }}
          onConfirm={() => { acknowledgeEditionNotice(); setEditionNoticeVisible(false); setSettingsInitialPage('save'); openUtilityDialog('settings'); }} />
      )}
      <header className="top-bar">
        <div>
          <p className="eyebrow">{t('ui.brand.eyebrow')}</p>
          <h1>{pet.name}</h1>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="coin-pill"
            onClick={() => handleOpenShop()}
            aria-label={`${t('ui.top.openShop')}: ${t('ui.shop.wallet', { coins: pet.coins })}`}
            title={t('ui.shop.wallet', { coins: pet.coins })}
          >
            <img src={currencyIcon} alt="" aria-hidden="true" />
            <strong>{pet.coins}</strong>
          </button>
          <div className="heart-pill" aria-label={t('ui.top.heartsAria', { hearts: pet.hearts })} title={t('ui.top.heartsAria', { hearts: pet.hearts })}>
            <Heart size={20} aria-hidden="true" />
            <strong>{pet.hearts}</strong>
          </div>
          <button
            type="button"
            className={`icon-button achievement-entry${hasAchievementNotice ? ' achievement-entry--notice' : ''}`}
            aria-label={t('ui.top.openAchievements')}
            title={t('ui.achievements.title')}
            onClick={handleOpenAchievements}
          >
            <Trophy size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button audio-button"
            aria-label={isAudioEnabled ? t('ui.top.audioOn') : t('ui.top.audioOff')}
            title={isAudioEnabled ? t('ui.top.audioOn') : t('ui.top.audioOff')}
            aria-pressed={isAudioEnabled}
            onClick={handleAudioToggle}
          >
            {isAudioEnabled ? <Volume2 size={21} aria-hidden="true" /> : <VolumeX size={21} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className={`icon-button settings-entry${toyIntegration.isCloudReminderDue ? ' settings-entry--notice' : ''}`}
            aria-label={t('ui.top.openSettings')}
            title={t('ui.top.settings')}
            onClick={() => {
              playAfterUnlock('open');
              setSettingsInitialPage('main');
              setDraftName(pet.name);
              setDraftBirthday(pet.birthday);
              openUtilityDialog('settings');
            }}
          >
            <Settings size={22} aria-hidden="true" />
          </button>
        </div>
      </header>

      {activePage === 'achievements' ? (
        <AchievementsPage
          pet={pet}
          activeCategory={activeAchievementCategory}
          itemIconMap={itemIconMap}
          onBack={handleCloseAchievements}
          onCategoryChange={setActiveAchievementCategory}
          onClaimReward={handleClaimAchievementReward}
          onClaimAllRewards={handleClaimAllAchievementRewards}
          onOpenCg={handleOpenAchievementCg}
        />
      ) : activePage === 'garden' ? (
        <GardenPage
          pet={pet}
          itemIconMap={itemIconMap}
          onBack={handleCloseGarden}
          onSelectSlot={handleSelectGardenSlot}
          onUnlockSlot={handleUnlockGardenSlot}
          onPlantTree={handlePlantTree}
          onRecycleSapling={handleRecycleGardenSapling}
          onWater={handleWaterTree}
          onFertilize={handleFertilizeTree}
          onNutrient={handleGardenNutrient}
          onHarvest={handleHarvestTree}
          onClear={handleRequestClearGardenSlot}
          onUpgradeTool={handleUpgradeGardenTool}
          onOpenShop={() => handleOpenShop('garden')}
          compensationCoins={gardenCompensationCoins}
          onClaimCompensation={hasClaimedGardenCompensation ? undefined : handleClaimGardenCompensation}
        />
      ) : activePage === 'partnerSchedule' ? (
        <PartnerSchedulePage
          pet={pet}
          itemIconMap={itemIconMap}
          neighbors={neighbors}
          onBack={handleClosePartnerSchedule}
          onStart={handleStartPartnerSchedule}
          onCancel={() => setPartnerScheduleCancelConfirmOpen(true)}
          onClaim={handleClaimPartnerSchedule}
        />
      ) : activePage === 'commonDreams' ? (
        <CommonDreamsPage
          pet={pet}
          onBack={handleCloseCommonDreams}
          onInvestProject={(category: PartnerScheduleCategory, coins: number) => commitEndgameAction((current) => investDreamProject(current, category, coins))}
          onCompleteProjectStage={(category: PartnerScheduleCategory) => commitEndgameAction((current) => completeDreamProjectStage(current, category))}
          onInvestLegacy={(coins: number) => commitEndgameAction((current) => investClassicLegacy(current, coins))}
          onCompleteLegacy={() => commitEndgameAction((current) => completeClassicLegacyLevel(current))}
          onExchangeGoldenApples={(apples: number) => commitEndgameAction((current) => exchangeClassicGoldenApplesForHearts(current, apples))}
        />
      ) : (
        <HomePage
          pet={pet}
          neighbors={neighbors}
          inventoryKindCount={ownedItems.length}
          isLowEnergy={isLowEnergy}
          isCriticallyHungry={isCriticallyHungry}
          canUpgrade={canUpgrade}
          nextUpgradeCost={nextUpgradeCost}
          isPomodoroOpen={isPomodoroOpen}
          pomodoroRemainingMs={pomodoroRemainingMs}
          pomodoroStartTitle={pomodoroStartTitle}
          gardenReminder={gardenReminder}
          pomodoroOverlay={pomodoroOverlay}
          petStatusImages={petStatusImageMap}
          petActivityImages={petActivityImageMap}
          getStatusLabel={getStatusLabel}
          onInteract={handleInteract}
          onUpgrade={handleUpgrade}
          onDailyWish={handleDailyWishButton}
          onReturnWelcome={handleReturnWelcomeButton}
          onOpenInventory={handleOpenInventory}
          onOpenPomodoro={handleOpenPomodoro}
          onOpenGarden={handleOpenGarden}
          onOpenBoostCards={handleOpenBoostCards}
          onOpenPartnerSchedule={handleOpenPartnerSchedule}
          onOpenGacha={handleOpenGacha}
          onOpenCommonDreams={handleOpenCommonDreams}
          onAction={handleAction}
        />
      )}

      {toyIntegration.isReminderPromptVisible
        && activePage === 'home'
        && !utilityDialog
        && !activeRewardPopup
        && !achievementToast && (
        <aside className="cloud-reminder" role="status" aria-label={t('ui.cloudReminder.title')}>
          <span className="cloud-reminder__icon" aria-hidden="true"><CloudUpload size={22} /></span>
          <span className="cloud-reminder__copy">
            <strong>{t('ui.cloudReminder.title')}</strong>
          </span>
          <div className="cloud-reminder__actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                toyIntegration.dismissReminder();
                setSettingsInitialPage('save');
                setDraftName(pet.name);
                setDraftBirthday(pet.birthday);
                openUtilityDialog('settings');
              }}
            >
              {t('ui.cloudReminder.backup')}
            </button>
            <button type="button" className="text-button" onClick={toyIntegration.snoozeReminder}>
              {t('ui.cloudReminder.snooze')}
            </button>
          </div>
          <button
            type="button"
            className="cloud-reminder__close"
            aria-label={t('ui.cloudReminder.close')}
            title={t('ui.cloudReminder.close')}
            onClick={toyIntegration.dismissReminder}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </aside>
      )}

      {availableFloatingReward && !toyIntegration.isReminderPromptVisible && (
        <button
          type="button"
          className="floating-reward-button"
          aria-label={t('ui.rewards.claim')}
          title={t('ui.rewards.claim')}
          onClick={() => handleClaimFloatingReward(availableFloatingReward)}
        >
          <img src={giftBoxIcon} alt="" aria-hidden="true" />
        </button>
      )}

      {achievementToast && activePage === 'home' && (
        <button type="button" className="achievement-toast" onClick={handleOpenAchievements}>
          <span className="achievement-toast__icon" aria-hidden="true"><Trophy size={22} /></span>
          <span className="achievement-toast__copy">
            <span>{achievementToast.kind === 'single' ? achievementToastLabels.single : achievementToastLabels.review}</span>
            <strong>{achievementToast.kind === 'single' ? achievementToast.achievement.title : achievementToastLabels.reviewTitle}</strong>
          </span>
        </button>
      )}
      {isInventoryOpen && (
        <InventoryModal
          items={ownedItems}
          inventory={pet.inventory}
          pet={pet}
          itemIconMap={itemIconMap}
          activeCategory={inventoryController.activeCategory}
          isPetBusy={Boolean(pet.partnerSchedule.active)}
          onCategoryChange={inventoryController.setActiveCategory}
          onClose={handleCloseInventory}
          onOpenShop={handleOpenShop}
          onOpenGarden={handleOpenGarden}
          onUseItem={handleUseItem}
        />
      )}
      {isGachaOpen && (
        <GoldenAppleGachaModal
          pet={pet}
          itemIconMap={itemIconMap}
          onClose={handleCloseGacha}
          onDraw={handleGachaDraw}
          onHeartDraw={handleHeartGachaDraw}
          onClaimStarterGift={handleClaimGachaStarterGift}
          isSavingResults={shareBusy !== null}
          saveFeedback={gachaCardSaveFeedback}
          onSaveResults={handleSaveGachaCard}
          onClearSaveFeedback={() => setGachaCardSaveFeedback('')}
          onPlaySfx={playAfterUnlock}
        />
      )}
      {activeRewardPopup && (
        <div className="modal-backdrop" role="presentation">
          <section className="reward-modal" role="dialog" aria-modal="true" aria-labelledby="reward-title">
            <img className="reward-modal__gift" src={giftBoxIcon} alt="" aria-hidden="true" />
            <div className="reward-modal__copy">
              <span>{t('ui.rewards.kicker')}</span>
              <h2 id="reward-title">{activeRewardPopup.title}</h2>
              <p>{activeRewardPopup.message}</p>
            </div>
            <div className="reward-modal__items">{renderRewardItems(activeRewardPopup)}</div>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                playAfterUnlock('tap');
                closeActiveReward();
              }}
            >
              {t('ui.rewards.confirm')}
            </button>
          </section>
        </div>
      )}

      {achievementCgPopup && (
        <div className="modal-backdrop" role="presentation">
          <section className="achievement-cg-modal" role="dialog" aria-modal="true" aria-labelledby="achievement-cg-title">
            <img className="achievement-cg-modal__image" src={achievementCgPopup.image} alt={achievementCgPopup.title} />
            <div className="achievement-cg-modal__copy">
              <span>{t('ui.achievements.cg.kicker')}</span>
              <h2 id="achievement-cg-title">{achievementCgPopup.title}</h2>
              <p>{achievementCgPopup.description}</p>
            </div>
            <div className="achievement-cg-modal__actions">
              <button type="button" className="primary-button" disabled={shareBusy !== null} onClick={handleSaveAchievementCg}>
                {t('ui.achievements.cg.save')}
              </button>
              <button type="button" className="text-button" onClick={handleCloseAchievementCg}>
                {t('ui.achievements.cg.close')}
              </button>
            </div>
          </section>
        </div>
      )}

      {activeYearReview && (
        <YearReviewModal
          review={activeYearReview}
          isSaving={shareBusy !== null}
          saveFeedback={yearCardSaveFeedback}
          onSave={() => handleSaveYearReviewCard(activeYearReview)}
          onClose={handleCloseYearReview}
        />
      )}

      {isShopOpen && (
        <ShopModal
          pet={pet}
          visibleItems={visibleShopItems}
          activeCategory={activeShopCategory}
          itemIconMap={itemIconMap}
          onClose={handleCloseShop}
          onSelectCategory={setActiveShopCategory}
          onBuyItem={handleBuyItem}
          onExchangeHeart={handleExchangeHeart}
          isHeartExchangeCoolingDown={isHeartExchangeCoolingDown}
        />
      )}
      {isBoostCardOpen && (
        <BoostCardModal
          pet={pet}
          onClose={handleCloseBoostCards}
          onBuyCard={handleBuyBoostCard}
          onClaimDailyReward={handleClaimBoostCardReward}
        />
      )}
      {isSettingsOpen && (
        <SettingsModal
          updateController={updateController}
          backupController={backupController}
          onRestoreBackup={prepareImportSaveFromText}
          onExportBackup={(snapshot) => void handleExportBackup(snapshot)}
          onCopySave={() => void handleCopySave()}
          initialPage={settingsInitialPage}
          activeMod={activeMod}
          installedMods={installedMods}
          modMessage={modMessage}
          draftName={draftName}
          draftBirthday={draftBirthday}
          metDate={pet.metDate}
          language={language}
          saveText={saveText}
          importSaveText={importSaveText}
          hasImportBackup={hasImportBackup}
          hasOpenedHelp={pet.hasOpenedHelp}
          hasClaimedAuthorFollowGift={toyIntegration.hasClaimedAuthorFollowGift}
          hasClaimedHelpPageGift={hasClaimedHelpPageGift}
          cloudAvailability={toyIntegration.cloudAvailability}
          cloudManifest={toyIntegration.cloudManifest}
          cloudUsedFallback={toyIntegration.cloudUsedFallback}
          cloudBusy={toyIntegration.cloudBusy}
          cloudReminderEnabled={toyIntegration.preferences.enabled}
          cloudReminderDue={toyIntegration.isCloudReminderDue}
          hasLatestYearReview={Boolean(pet.latestYearReview)}
          shareBusy={shareBusy === 'profile' || shareBusy === 'year' ? shareBusy : null}
          shareDetails={toyIntegration.shareDetails}
          authorSummary={toyIntegration.authorSummary}
          authorVideo={toyIntegration.authorVideo}
          isAuthorLoading={toyIntegration.isAuthorLoading}
          onDraftNameChange={setDraftName}
          onDraftBirthdayChange={setDraftBirthday}
          onLanguageChange={handleLanguageChange}
          onImportSaveTextChange={setImportSaveText}
          onOpenHelp={handleOpenHelp}
          onOpenAuthorSpace={() => {
            setModMessage('');
            void toyIntegration.openAuthorSpace();
          }}
          onOpenIntroVideo={() => void toyIntegration.openIntroVideo()}
          onClaimHelpPageGift={handleClaimHelpPageGift}
          onClose={() => {
            playAfterUnlock('close');
            closeUtilityDialog();
          }}
          onSaveProfile={handleSaveProfile}
          onReset={handleReset}
          onClearMod={handleClearMod}
          onActivateMod={(modId) => void handleActivateMod(modId)}
          onDeleteMod={setModDeleteConfirmId}
          onExportSave={handleExportSave}
          onDownloadSave={handleDownloadSave}
          onImportPastedSave={() => prepareImportSaveFromText(importSaveText)}
          onRestoreImportBackup={handleRestoreImportBackup}
          onCloudUpload={() => setCloudUploadConfirmOpen(true)}
          onCloudRestore={() => void handleCloudRestore()}
          onCloudReminderEnabledChange={toyIntegration.setReminderEnabled}
          onSaveProfileCard={handleSaveProfileCard}
          onSaveYearReviewCard={handleSaveYearReviewCard}
          onShareApp={toyIntegration.shareApp}
          onCopyShareLink={() => void toyIntegration.copyShareLink()}
          onModFileChange={handleModFileChange}
          onImportSaveFileChange={handleImportSaveFileChange}
        />
      )}
      {isResetConfirmOpen && (
        <ConfirmDialog
          title={t('ui.settings.resetDialog.title')}
          message={t('ui.settings.resetDialog.message')}
          cancelLabel={t('ui.settings.resetDialog.cancel')}
          confirmLabel={t('ui.settings.resetDialog.confirm')}
          onCancel={handleCancelReset}
          onConfirm={handleConfirmReset}
        />
      )}
      {isCloudUploadConfirmOpen && (
        <ConfirmDialog
          title={t('ui.settings.cloud.confirmTitle')}
          message={t(toyIntegration.cloudManifest
            ? 'ui.settings.cloud.confirmOverwrite'
            : 'ui.settings.cloud.confirmUpload')}
          cancelLabel={t('ui.settings.cloud.confirmCancel')}
          confirmLabel={t('ui.settings.cloud.confirmSubmit')}
          confirmTone="primary"
          disabled={toyIntegration.cloudBusy !== null}
          onCancel={() => setCloudUploadConfirmOpen(false)}
          onConfirm={() => void handleConfirmCloudUpload()}
        />
      )}
      {pendingImportedSave && (
        <ConfirmDialog
          title={t('ui.settings.save.previewTitle')}
          message={pendingImportMessage}
          cancelLabel={t('ui.settings.save.previewCancel')}
          confirmLabel={t('ui.settings.save.previewConfirm')}
          confirmTone="primary"
          disabled={isImportingSave}
          onCancel={handleCancelImportSave}
          onConfirm={() => void handleConfirmImportSave()}
        />
      )}
      {modDeleteConfirmId && (
        <ConfirmDialog
          title={t('ui.settings.mod.deleteDialog.title')}
          message={t('ui.settings.mod.deleteDialog.message', { name: modDeleteTarget?.manifest.name ?? modDeleteConfirmId })}
          cancelLabel={t('ui.settings.mod.deleteDialog.cancel')}
          confirmLabel={t('ui.settings.mod.deleteDialog.confirm')}
          onCancel={() => setModDeleteConfirmId(null)}
          onConfirm={() => void handleConfirmDeleteMod()}
        />
      )}
      {isPartnerScheduleCancelConfirmOpen && (
        <ConfirmDialog
          title={t('ui.partnerSchedule.cancelDialog.title')}
          message={t('ui.partnerSchedule.cancelDialog.message')}
          cancelLabel={t('ui.partnerSchedule.cancelDialog.keep')}
          confirmLabel={t('ui.partnerSchedule.cancelDialog.confirm')}
          onCancel={() => setPartnerScheduleCancelConfirmOpen(false)}
          onConfirm={handleConfirmPartnerScheduleCancel}
        />
      )}
      {isGoldenAppleUseConfirmOpen && (
        <ConfirmDialog
          title={t('ui.gacha.appleUseConfirm.title')}
          message={t('ui.gacha.appleUseConfirm.message')}
          cancelLabel={t('ui.gacha.appleUseConfirm.cancel')}
          confirmLabel={t('ui.gacha.appleUseConfirm.confirm')}
          onCancel={() => setGoldenAppleUseConfirmOpen(false)}
          onConfirm={handleSuppressGoldenAppleUseConfirm}
        />
      )}
      {gardenClearConfirm && (
        <ConfirmDialog
          title={t(`ui.garden.confirm.${gardenClearConfirm.kind}Title`)}
          message={t(`ui.garden.confirm.${gardenClearConfirm.kind}Message`, {
            tree: t(`ui.garden.trees.${gardenClearConfirm.treeId}.name`),
            slot: gardenClearConfirm.slotIndex + 1,
            coins: gardenClearConfirm.coins,
          })}
          cancelLabel={t('ui.garden.confirm.cancel')}
          confirmLabel={t(`ui.garden.confirm.${gardenClearConfirm.kind}Confirm`)}
          onCancel={handleCancelGardenClear}
          onConfirm={handleConfirmGardenClear}
        />
      )}
      {pendingImageSave && (
        <ConfirmDialog
          title={t('ui.share.saveConfirm.title')}
          message={t('ui.share.saveConfirm.message')}
          cancelLabel={t('ui.share.saveConfirm.cancel')}
          confirmLabel={t('ui.share.saveConfirm.confirm')}
          confirmTone="primary"
          disabled={shareBusy !== null}
          onCancel={handleCancelImageSave}
          onConfirm={handleConfirmImageSave}
        />
      )}
    </main>
  );
};


export const App = () => {
  const [initialPet, setInitialPet] = useState<PetState | null | undefined>(undefined);
  const [initialPersistenceError, setInitialPersistenceError] = useState('');
  const [startupRecovery, setStartupRecovery] = useState<Exclude<PetStorageLoadResult, { status: 'ok' }> | null>(null);
  const [recoveryCandidates, setRecoveryCandidates] = useState<SaveRecoveryCandidate[]>([]);
  const [installedMods, setInstalledMods] = useState<readonly InstalledPetModSummary[]>([]);
  const [activeMod, setActiveMod] = useState<ActivePetMod | null>(null);
  const [modMessage, setModMessage] = useState('');
  const [isAudioEnabled, setAudioEnabledState] = useState(() => getAudioEnabled());

  useEffect(() => {
    let cancelled = false;
    const applyLoaded = async (petResult: PetStorageLoadResult, mod: ActivePetMod | null) => {
      if (petResult.status === 'ok') {
        if (!cancelled) {
          setInitialPersistenceError(petResult.persistenceError ?? '');
          setInitialPet(petResult.pet);
        }
        return;
      }
      const recovery = await collectRecoveryCandidates(mod?.manifest.defaultPetName);
      if (cancelled) return;
      setRecoveryCandidates(recovery.candidates);
      if (petResult.status !== 'missing' || recovery.candidates.length || recovery.unavailable) setStartupRecovery(petResult);
      if (recovery.unavailable) setModMessage(t('ui.backup.failed'));
      else if (recovery.warnings.length) setModMessage(t('ui.backup.skippedFiles', { count: recovery.warnings.length }));
      setInitialPet(null);
    };
    void loadInitialAppState()
      .then(async ({ mods, mod, petResult }) => {
        if (cancelled) return;
        setInstalledMods(mods);
        setActiveMod(mod);
        await applyLoaded(petResult, mod);
      })
      .catch(async (error) => {
        if (cancelled) return;
        setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.loadFailed'));
        await applyLoaded(loadPet(), null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRecover = async (candidate: SaveRecoveryCandidate) => {
    try {
      let restored = readRecoveryCandidate(candidate);
      const resolution = await resolveImportedSaveMod(restored, loadPetMod);
      restored = readRecoveryCandidate(candidate, (resolution.missingImportedMod ? restored.activeMod?.defaultPetName : undefined) ?? resolution.mod?.manifest.defaultPetName);
      const original = startupRecovery?.status === 'corrupt' ? startupRecovery.raw : '';
      replacePetFromImport(restored.pet, original, restored.activeMod ?? resolution.mod?.manifest ?? null);
      setActivePetMod(resolution.mod?.manifest.id);
      setActiveMod(resolution.mod);
      setInitialPersistenceError('');
      setInitialPet(restored.pet);
      setStartupRecovery(null);
    } catch (error) { setModMessage(error instanceof Error ? error.message : t('ui.settings.save.recoveryRestoreFailed')); }
  };

  const handleExportCorruptSave = async () => {
    const raw = getPreservedCorruptPetRaw() ?? (startupRecovery?.status === 'corrupt' ? startupRecovery.raw : '');
    if (!raw) return;
    try {
      const result = await saveTextFile(createSaveFileName(t('ui.settings.save.recoveryFileName')), raw);
      setModMessage(t(result === 'text' ? 'ui.backup.textFallback' : result === 'cancelled' ? 'ui.settings.save.saveCancelled' : 'ui.settings.save.recoveryExported'));
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.save.saveFailed'));
      playSfx('error');
    }
  };

  const handleResetCorruptSave = () => {
    try {
      clearPet();
      setStartupRecovery(null);
      setInitialPet(null);
      setModMessage(t('ui.settings.save.recoveryReset'));
    } catch { setModMessage(t('ui.backup.recoveryStorage')); }
  };

  const handleAudioToggle = () => {
    const nextEnabled = !isAudioEnabled;
    setAudioEnabled(nextEnabled);
    setAudioEnabledState(nextEnabled);
    if (nextEnabled) {
      void unlockAudio().then(() => {
        syncBgm('room');
        playSfx('tap');
      });
    }
  };

  const startWithMod = (mod: ActivePetMod | null) => {
    setActivePetMod(mod?.manifest.id);
    setStoredSaveIdentity(mod?.manifest);
    setActiveMod(mod);
    setInitialPersistenceError('');
    setInitialPet(createPetForMod(mod));
    setModMessage(mod ? t('ui.settings.mod.active', { name: mod.manifest.name, version: mod.manifest.version }) : '');
  };

  const handleUseBuiltin = async () => {
    try {
      await clearActivePetMod();
      startWithMod(null);
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.restoreFailed'));
    }
  };

  const handleUseBuiltinMod = (modId: string) => {
    const mod = getBuiltinPetMod(modId);
    if (!mod) {
      setModMessage(t('ui.settings.mod.loadFailed'));
      playSfx('error');
      return;
    }
    startWithMod(mod);
  };

  const handleUseInstalledMod = async (modId: string) => {
    try {
      const loaded = await loadPetMod(modId);
      if (!loaded) throw new Error(t('ui.settings.mod.loadFailed'));
      startWithMod(loaded);
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.loadFailed'));
      playSfx('error');
    }
  };

  const handleImportMod = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!features.importMod) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = await parsePetModZip(file);
      await installPetMod(parsed);
      const mods = await listInstalledPetMods();
      setInstalledMods(mods);
      if (activeMod?.manifest.id === parsed.manifest.id) {
        setActiveMod(await loadPetMod(parsed.manifest.id));
      }
      setModMessage(parsed.warnings.length > 0
        ? t('ui.settings.mod.importedWithFallback', { name: parsed.manifest.name, count: parsed.warnings.length })
        : t('ui.settings.mod.installed', { name: parsed.manifest.name }));
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.importFailed'));
      playSfx('error');
    }
  };

  if (startupRecovery) {
    return <SaveRecovery candidates={recoveryCandidates} stage={startupRecovery.status === 'missing' ? undefined : startupRecovery.stage}
      unavailable={startupRecovery.status === 'unavailable'} raw={startupRecovery.status === 'corrupt' ? startupRecovery.raw : ''} message={modMessage}
      onRestore={handleRecover} onExport={() => void handleExportCorruptSave()} onStartNew={handleResetCorruptSave}
      onImport={async (text) => handleRecover({ id: 'import', text, format: 'file', savedAt: Date.now(), petName: '', level: 0 })} />;
  }

  if (initialPet === undefined) {
    return (
      <RolePicker
        installedMods={[]}
        modMessage={modMessage}
        isAudioEnabled={isAudioEnabled}
        isLoading
        onUseBuiltin={handleUseBuiltin}
        onUseBuiltinMod={() => undefined}
        onUseInstalledMod={() => undefined}
        onImportMod={handleImportMod}
        onAudioToggle={handleAudioToggle}
      />
    );
  }

  if (!initialPet) {
    return (
      <RolePicker
        installedMods={installedMods}
        modMessage={modMessage}
        isAudioEnabled={isAudioEnabled}
        onUseBuiltin={handleUseBuiltin}
        onUseBuiltinMod={handleUseBuiltinMod}
        onUseInstalledMod={(modId) => void handleUseInstalledMod(modId)}
        onImportMod={handleImportMod}
        onAudioToggle={handleAudioToggle}
      />
    );
  }

  return (
    <PetApp
      key={initialPet.createdAt + ':' + (activeMod?.manifest.id ?? 'builtin')}
      initialPet={initialPet}
      initialPersistenceError={initialPersistenceError}
      initialActiveMod={activeMod}
      initialInstalledMods={installedMods}
      onResetToPicker={(storedMod, storedMods) => {
        setActiveMod(storedMod);
        setInstalledMods(storedMods);
        setInitialPet(null);
      }}
    />
  );
};
