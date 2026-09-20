import { pick, t } from '../i18n';
import { applyHeartGain, recordEarnedCoins, recordEarnedHearts } from './achievements';
import { grantDailyGachaTickets } from './goldenAppleGacha';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem } from './items';
import { createNeighborGift, getNeighborEventRandom, pickNeighborEventValue, pickNeighborName } from './neighborGifts';
import { clampCoins, clampCount, clampPetEnergy, clampPetHealth, clampPetHunger, clampPetStat, getPetStatThreshold, roundPetStatDisplayAmount, scalePetStatDelta } from './petStats';
import type { ItemEffect, ItemId, NeighborEventContext, PetState, WeatherType } from './petTypes';
import { hashString, pickRandom } from './utils';
import { neighborGiftDailyLimit } from './neighbors';

export interface DailyEncounter {
  kind?: 'neighbor_gift';
  coins?: number;
  hearts?: number;
  itemId?: ItemId;
  itemAmount?: number;
  effect?: ItemEffect;
  text: string;
}

export interface TimedEvent {
  kind?: 'neighbor_gift';
  coins?: number;
  hearts?: number;
  itemId?: ItemId;
  itemAmount?: number;
  effect?: ItemEffect;
  gachaTickets?: number;
  text: string;
}

export interface OfflineEventOptions {
  allowNeighborGift?: boolean;
  allowGachaTicket?: boolean;
}

const dreamEventMinSleepMinutes = 15;

const getTimedEventEffectText = (effect: ItemEffect) => {
  const entries = ([
    ['hunger', effect.hunger],
    ['mood', effect.mood],
    ['cleanliness', effect.cleanliness],
    ['energy', effect.energy],
    ['health', effect.health],
  ] as const).filter((entry): entry is readonly [keyof ItemEffect, number] => Boolean(entry[1]));
  if (entries.length === 0) return '';
  const effects = entries.map(([key, amount]) => {
    const rounded = roundPetStatDisplayAmount(amount);
    return t(`pet.effectSummary.${key}`, { amount: rounded > 0 ? `+${rounded}` : rounded });
  }).join(t('common.comma'));
  return t('pet.effectSummary.wrap', { effects });
};

export const dreamTalkStartDelayMs = 8 * 60 * 1000;

export const dreamTalkCooldownMs = 15 * 60 * 1000;

const getNeighborGiftEvent = (context: NeighborEventContext | undefined, key: 'dailyEncounter' | 'offlineEvent'): TimedEvent => {
  const { neighborName, gift } = createNeighborGift(context);
  return {
    kind: 'neighbor_gift',
    itemId: gift.itemId,
    itemAmount: 1,
    text: t(`pet.${key}.${neighborName ? 'neighborGiftNamed' : 'neighborGiftGeneric'}`, {
      neighbor: neighborName ?? '',
      item: gift.displayName,
    }),
  };
};

export const getRandomDailyEncounter = (
  name: string,
  context?: NeighborEventContext,
  allowNeighborGift = true,
): DailyEncounter => {
  const random = getNeighborEventRandom(context);
  const options: Array<() => DailyEncounter> = [
    () => ({
      coins: 18,
      text: t('pet.dailyEncounter.coins', { name }),
    }),
    () => ({
      effect: { mood: 8, cleanliness: -2 },
      text: t('pet.dailyEncounter.sun', { name }),
    }),
    () => ({
      effect: { energy: 10 },
      text: t('pet.dailyEncounter.rest', { name }),
    }),
    () => ({
      effect: { hunger: 10, cleanliness: -3 },
      text: t('pet.dailyEncounter.snack', { name }),
    }),
    () => ({
      effect: { mood: -5 },
      text: t('pet.dailyEncounter.nightmare', { name }),
    }),
    () => ({
      hearts: 1,
      text: t('pet.dailyEncounter.heart', { name, hearts: '{hearts}' }),
    }),
  ];
  if (allowNeighborGift) options.splice(1, 0, () => getNeighborGiftEvent(context, 'dailyEncounter'));
  return pickNeighborEventValue(options, random)();
};

export const getRandomOfflineDiary = (name: string, weather: WeatherType) => pick(`pet.offlineDiary.${weather}`, { name });

export const getRandomOfflineEvent = (
  name: string,
  weather: WeatherType,
  context?: NeighborEventContext,
  eventOptions: OfflineEventOptions = {},
): TimedEvent => {
  const random = getNeighborEventRandom(context);
  const allowNeighborGift = eventOptions.allowNeighborGift ?? true;
  const allowGachaTicket = eventOptions.allowGachaTicket ?? false;
  const neighborPlay = () => {
    const neighbor = pickNeighborName(context, random);
    return {
      effect: { mood: 6, cleanliness: -2 },
      text: pick(`pet.offlineEvent.${weather === 'sunny' ? 'sunnyPlay' : 'play'}${neighbor ? 'Named' : 'Generic'}`, {
        name,
        neighbor: neighbor ?? '',
      }),
    };
  };
  const options: Array<() => TimedEvent> = [
    () => ({
      coins: 12,
      text: pick('pet.offlineEvent.coins', { name }),
    }),
    () => ({
      hearts: 1,
      text: pick('pet.offlineEvent.heart', { name, hearts: '{hearts}' }),
    }),
    neighborPlay,
    () => ({
      effect: { hunger: -4, mood: 4 },
      text: pick('pet.offlineEvent.hungryHappy', { name }),
    }),
    () => ({
      effect: { energy: 8 },
      text: pick('pet.offlineEvent.rest', { name }),
    }),
    () => ({
      effect: { cleanliness: -5 },
      text: pick('pet.offlineEvent.mess', { name }),
    }),
  ];
  if (allowNeighborGift) options.splice(1, 0, () => getNeighborGiftEvent(context, 'offlineEvent'));
  if (allowGachaTicket) options.push(() => {
    const gachaTickets = random() < 0.01 ? 10 : 1;
    return {
      gachaTickets,
      text: t(gachaTickets === 10 ? 'pet.offlineEvent.tenTickets' : 'pet.offlineEvent.ticket', {
        tickets: '{tickets}',
      }),
    };
  });
  return pickNeighborEventValue(options, random)();
};

export const getRandomDreamEvent = (name: string): TimedEvent =>
  pickRandom([
    {
      effect: { mood: 3 },
      text: pick('pet.dreamEvent.cloudNap', { name }),
    },
    {
      coins: 10,
      text: pick('pet.dreamEvent.coinPath', { name }),
    },
    {
      hearts: 1,
      text: pick('pet.dreamEvent.sticker', { name, hearts: '{hearts}' }),
    },
    {
      itemId: 'emergency_biscuit',
      itemAmount: 1,
      text: pick('pet.dreamEvent.biscuit'),
    },
    {
      effect: { energy: 4, cleanliness: -1 },
      text: pick('pet.dreamEvent.puddleRun', { name }),
    },
  ]);

export const applyTimedEvent = (pet: PetState, event: TimedEvent, now: number, prefix: string): PetState => {
  const ticketGrant = event.gachaTickets
    ? grantDailyGachaTickets(pet, event.gachaTickets, now)
    : { pet, grantedTickets: 0, quotaConsumed: false };
  const current = ticketGrant.pet;
  const effect = event.effect ?? {};
  const scaledEffect: ItemEffect = {
    hunger: scalePetStatDelta(current, effect.hunger ?? 0),
    mood: scalePetStatDelta(current, effect.mood ?? 0),
    cleanliness: scalePetStatDelta(current, effect.cleanliness ?? 0),
    energy: effect.energy ?? 0,
    health: scalePetStatDelta(current, effect.health ?? 0),
  };
  const heartGain = applyHeartGain(current, event.hearts ?? 0);
  const neighborGiftDateKey = getEffectiveDailyDateKey(current, now);
  const currentNeighborGiftCount = current.neighborGiftDateKey === neighborGiftDateKey
    ? Math.min(neighborGiftDailyLimit, clampCount(current.neighborGiftCount))
    : 0;
  const canSettleNeighborGift = event.kind !== 'neighbor_gift'
    || (Boolean(event.itemId) && currentNeighborGiftCount < neighborGiftDailyLimit);
  const canSettleGachaTickets = !event.gachaTickets || ticketGrant.quotaConsumed;
  const canSettleEvent = canSettleNeighborGift && canSettleGachaTickets;
  const eventText = event.gachaTickets === 10 && ticketGrant.grantedTickets < event.gachaTickets
    ? t('pet.offlineEvent.tenTicketsCapped', { tickets: ticketGrant.grantedTickets })
    : event.text.replace(/\{tickets\}/g, String(ticketGrant.grantedTickets));
  const effectText = getTimedEventEffectText(scaledEffect);
  const withEvent: PetState = {
    ...current,
    hunger: clampPetHunger(current, current.hunger + (scaledEffect.hunger ?? 0)),
    mood: clampPetStat(current, current.mood + (scaledEffect.mood ?? 0)),
    cleanliness: clampPetStat(current, current.cleanliness + (scaledEffect.cleanliness ?? 0)),
    energy: clampPetEnergy(current, current.energy + (scaledEffect.energy ?? 0)),
    health: clampPetHealth(current, current.health + (scaledEffect.health ?? 0)),
    coins: clampCoins(current.coins + (event.coins ?? 0)),
    hearts: heartGain.hearts,
    boostCards: heartGain.boostCards,
    inventory: event.itemId && canSettleEvent
      ? addInventoryItem(current.inventory, event.itemId, event.itemAmount ?? 1)
      : current.inventory,
    recentEvent: canSettleEvent
      ? `${prefix}${eventText.replace(/\{hearts\}/g, String(heartGain.amount))}${effectText}`
      : current.recentEvent,
    lastDailyRewardAt: prefix === t('pet.prefix.dailyEncounter') ? now : pet.lastDailyRewardAt,
    lastDailyEncounterAt: prefix === t('pet.prefix.dailyEncounter') ? now : pet.lastDailyEncounterAt,
    dailyEncounterDateKey: prefix === t('pet.prefix.dailyEncounter') ? neighborGiftDateKey : pet.dailyEncounterDateKey,
    neighborGiftDateKey,
    neighborGiftCount: Math.min(
      neighborGiftDailyLimit,
      currentNeighborGiftCount + (event.kind === 'neighbor_gift' && canSettleEvent ? 1 : 0),
    ),
  };
  return recordEarnedHearts(recordEarnedCoins(withEvent, event.coins ?? 0), heartGain.amount);
};

const addEffects = (left?: ItemEffect, right?: ItemEffect): ItemEffect | undefined => {
  if (!left && !right) return undefined;
  return {
    hunger: (left?.hunger ?? 0) + (right?.hunger ?? 0),
    mood: (left?.mood ?? 0) + (right?.mood ?? 0),
    cleanliness: (left?.cleanliness ?? 0) + (right?.cleanliness ?? 0),
    energy: (left?.energy ?? 0) + (right?.energy ?? 0),
    health: (left?.health ?? 0) + (right?.health ?? 0),
  };
};

const addDreamEvent = (event: TimedEvent, pet: PetState, sleptMinutes: number): TimedEvent => {
  if (sleptMinutes < dreamEventMinSleepMinutes) return event;

  const dream = getRandomDreamEvent(pet.name);
  return {
    effect: addEffects(event.effect, dream.effect),
    coins: (event.coins ?? 0) + (dream.coins ?? 0),
    hearts: (event.hearts ?? 0) + (dream.hearts ?? 0),
    itemId: dream.itemId ?? event.itemId,
    itemAmount: dream.itemId ? dream.itemAmount ?? 1 : event.itemAmount,
    text: `${event.text} ${t('pet.prefix.dreamEvent')}${dream.text}`,
  };
};

const getSleepSettlement = (pet: PetState, now: number): TimedEvent => {
  const sleptMinutes = pet.sleepStartedAt > 0 ? Math.floor((now - pet.sleepStartedAt) / 60000) : 0;
  const startMood = Number.isFinite(pet.sleepStartMood) ? pet.sleepStartMood : pet.mood;
  const startHunger = Number.isFinite(pet.sleepStartHunger) ? pet.sleepStartHunger : pet.hunger;
  const startCleanliness = Number.isFinite(pet.sleepStartCleanliness) ? pet.sleepStartCleanliness : pet.cleanliness;

  if (sleptMinutes < 10) {
    return {
      effect: { mood: -1 },
      text: pick('pet.sleepSettlement.tooShort', { name: pet.name }),
    };
  }

  if (
    startMood <= getPetStatThreshold(pet, 25)
    || startHunger <= getPetStatThreshold(pet, 25)
    || startCleanliness <= getPetStatThreshold(pet, 25)
  ) {
    return addDreamEvent({
      effect: { mood: -3, health: -1 },
      text: pick('pet.sleepSettlement.bad', { name: pet.name }),
    }, pet, sleptMinutes);
  }

  if (
    startMood >= getPetStatThreshold(pet, 60)
    && startHunger >= getPetStatThreshold(pet, 45)
    && startCleanliness >= getPetStatThreshold(pet, 45)
    && sleptMinutes >= 20
  ) {
    return addDreamEvent({
      effect: { mood: 4, energy: 5 },
      text: pick('pet.sleepSettlement.good', { name: pet.name }),
    }, pet, sleptMinutes);
  }

  return addDreamEvent({
    effect: { mood: 2 },
    text: pick('pet.sleepSettlement.normal', { name: pet.name }),
  }, pet, sleptMinutes);
};

export const resetSleepSnapshot = (pet: PetState): PetState => ({
  ...pet,
  sleepStartedAt: 0,
  sleepStartMood: 0,
  sleepStartHunger: 0,
  sleepStartCleanliness: 0,
  lastDreamTalkAt: 0,
});

export const startSleepSnapshot = (pet: PetState, now: number): PetState => ({
  ...pet,
  sleepStartedAt: now,
  sleepStartMood: pet.mood,
  sleepStartHunger: pet.hunger,
  sleepStartCleanliness: pet.cleanliness,
  lastDreamTalkAt: 0,
});

export const settleSleep = (pet: PetState, now: number): PetState =>
  resetSleepSnapshot(applyTimedEvent(pet, getSleepSettlement(pet, now), now, t('pet.prefix.sleepSettlement')));

export const wakePet = (pet: PetState, now: number): PetState =>
  pet.isSleeping || pet.sleepStartedAt > 0
    ? settleSleep({ ...pet, isSleeping: false }, now)
    : resetSleepSnapshot(pet);

export const maybeApplyDreamTalk = (pet: PetState, now: number): PetState => {
  if (!pet.isSleeping || pet.sleepStartedAt <= 0) return pet;
  if (now - pet.sleepStartedAt < dreamTalkStartDelayMs) return pet;
  if (pet.lastDreamTalkAt > 0 && now - pet.lastDreamTalkAt < dreamTalkCooldownMs) return pet;

  const bucket = Math.floor(now / dreamTalkCooldownMs);
  const shouldTalk = hashString(`${pet.name}:${pet.sleepStartedAt}:${bucket}`) % 100 < 55;
  return {
    ...pet,
    lastDreamTalkAt: now,
    recentEvent: shouldTalk ? `${t('pet.prefix.dreamTalk')}${pick('pet.dreamTalk', { name: pet.name })}` : pet.recentEvent,
  };
};
