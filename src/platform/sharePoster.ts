import { getInventoryItem, type GachaResult, type YearReview, type YearlyCareActionKey } from '../core/pet';
import { createGachaCardData, createPetProfileCardData, type PetProfileCardData } from '../core/shareCards';
import type { PetState } from '../core/pet';
import { t } from '../i18n';
import { getToySdk, supportsToyAbility, withToySdkTimeout } from './toySdk';

export const sharePosterWidth = 1080;
export const sharePosterHeight = 1440;
const posterFont = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';
const numberFormatter = new Intl.NumberFormat();
const posterColors = {
  ink: '#24334c',
  muted: '#5f6f86',
  blue: '#2f73c9',
  coral: '#df6d88',
  yellow: '#f2b84b',
  green: '#59a56a',
  teal: '#4ba7b8',
  surface: 'rgba(255, 255, 255, 0.9)',
  softBlue: 'rgba(232, 247, 255, 0.94)',
} as const;

export type GachaMachine = 'apple' | 'heart';

interface PosterBaseOptions {
  petImageUrl: string;
  qrCodeDataUrl?: string;
}

interface ProfilePosterOptions extends PosterBaseOptions {
  pet: PetState;
  now?: number;
}

interface YearReviewPosterOptions extends PosterBaseOptions {
  petName: string;
  review: YearReview;
}

interface GachaPosterOptions extends PosterBaseOptions {
  machine: GachaMachine;
  results: readonly GachaResult[];
  itemIconMap: Partial<Record<string, string>>;
  createdAt?: number;
}

const createCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = sharePosterWidth;
  canvas.height = sharePosterHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable.');
  return { canvas, context };
};

const roundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 8,
) => {
  const resolvedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + resolvedRadius, y);
  context.lineTo(x + width - resolvedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + resolvedRadius);
  context.lineTo(x + width, y + height - resolvedRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - resolvedRadius, y + height);
  context.lineTo(x + resolvedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - resolvedRadius);
  context.lineTo(x, y + resolvedRadius);
  context.quadraticCurveTo(x, y, x + resolvedRadius, y);
  context.closePath();
};

const fillPanel = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) => {
  context.fillStyle = color;
  roundedRect(context, x, y, width, height, 8);
  context.fill();
};

const drawCloud = (context: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
  context.save();
  context.fillStyle = 'rgba(255, 255, 255, 0.78)';
  context.beginPath();
  context.ellipse(x, y, 72 * scale, 34 * scale, 0, 0, Math.PI * 2);
  context.ellipse(x - 55 * scale, y + 10 * scale, 50 * scale, 28 * scale, 0, 0, Math.PI * 2);
  context.ellipse(x + 58 * scale, y + 12 * scale, 54 * scale, 29 * scale, 0, 0, Math.PI * 2);
  context.ellipse(x - 10 * scale, y - 22 * scale, 48 * scale, 39 * scale, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
};

const drawSceneBackground = (context: CanvasRenderingContext2D) => {
  const sky = context.createLinearGradient(0, 0, 0, 900);
  sky.addColorStop(0, '#7ecbfa');
  sky.addColorStop(0.62, '#dff4ff');
  sky.addColorStop(1, '#f4fbff');
  context.fillStyle = sky;
  context.fillRect(0, 0, sharePosterWidth, sharePosterHeight);

  const sun = context.createRadialGradient(875, 205, 16, 875, 205, 118);
  sun.addColorStop(0, 'rgba(255, 235, 146, 0.96)');
  sun.addColorStop(0.5, 'rgba(255, 225, 116, 0.48)');
  sun.addColorStop(1, 'rgba(255, 225, 116, 0)');
  context.fillStyle = sun;
  context.beginPath();
  context.arc(875, 205, 118, 0, Math.PI * 2);
  context.fill();
  drawCloud(context, 175, 250, 0.92);
  drawCloud(context, 620, 390, 0.68);

  const grass = context.createLinearGradient(0, 790, 0, sharePosterHeight);
  grass.addColorStop(0, '#d9efce');
  grass.addColorStop(1, '#bfe0b1');
  context.fillStyle = grass;
  context.beginPath();
  context.moveTo(0, 845);
  context.bezierCurveTo(210, 775, 385, 875, 570, 820);
  context.bezierCurveTo(760, 760, 900, 855, sharePosterWidth, 800);
  context.lineTo(sharePosterWidth, sharePosterHeight);
  context.lineTo(0, sharePosterHeight);
  context.closePath();
  context.fill();
};

const setFont = (context: CanvasRenderingContext2D, size: number, weight = 400) => {
  context.font = `${weight} ${size}px ${posterFont}`;
};

const truncateText = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  if (context.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && context.measureText(`${value}...`).width > maxWidth) value = value.slice(0, -1);
  return `${value}...`;
};

const loadImage = (url?: string) => new Promise<HTMLImageElement | undefined>((resolve) => {
  if (!url) {
    resolve(undefined);
    return;
  }
  const image = new Image();
  let settled = false;
  const finish = (value?: HTMLImageElement) => {
    if (settled) return;
    settled = true;
    globalThis.clearTimeout(timer);
    resolve(value);
  };
  const timer = globalThis.setTimeout(() => finish(), 4_000);
  image.onload = () => finish(image);
  image.onerror = () => finish();
  image.src = url;
});

const drawContainedImage = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
};

const drawHeader = (context: CanvasRenderingContext2D, title: string, subtitle: string) => {
  fillPanel(context, 55, 45, 970, 125, 'rgba(255, 255, 255, 0.84)');
  context.fillStyle = posterColors.blue;
  setFont(context, 34, 700);
  context.fillText('PocPet', 80, 98);
  context.fillStyle = posterColors.muted;
  setFont(context, 24, 600);
  context.fillText(truncateText(context, subtitle, 360), 80, 138);
  context.textAlign = 'right';
  context.fillStyle = posterColors.ink;
  setFont(context, 40, 700);
  context.fillText(truncateText(context, title, 530), 995, 118);
  context.textAlign = 'left';
};

const drawFooter = async (context: CanvasRenderingContext2D, qrCodeDataUrl?: string) => {
  fillPanel(context, 55, 1300, 970, 110, 'rgba(255, 255, 255, 0.9)');
  context.fillStyle = posterColors.ink;
  setFont(context, 25, 700);
  context.fillText(truncateText(context, t('ui.share.poster.footer'), 790), 80, 1350);
  context.fillStyle = posterColors.muted;
  setFont(context, 19, 400);
  context.fillText(truncateText(context, t('ui.share.poster.footerHint'), 790), 80, 1383);
  const qr = await loadImage(qrCodeDataUrl);
  if (qr) {
    context.fillStyle = '#ffffff';
    context.fillRect(910, 1309, 92, 92);
    context.drawImage(qr, 915, 1314, 82, 82);
  }
};

const canvasToJpeg = (canvas: HTMLCanvasElement) => {
  let quality = 0.92;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > 2 * 1024 * 1024 && quality > 0.64) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrl.length > 5 * 1024 * 1024) throw new Error('Generated image exceeds the Toy album limit.');
  return dataUrl;
};

const drawProfileIdentity = async (
  context: CanvasRenderingContext2D,
  data: PetProfileCardData,
  petImageUrl: string,
) => {
  fillPanel(context, 55, 190, 970, 250, posterColors.surface);
  context.fillStyle = posterColors.softBlue;
  roundedRect(context, 80, 210, 240, 210, 8);
  context.fill();
  const petImage = await loadImage(petImageUrl);
  if (petImage) drawContainedImage(context, petImage, 90, 218, 220, 194);
  context.fillStyle = posterColors.ink;
  setFont(context, 50, 700);
  context.fillText(truncateText(context, data.name, 615), 355, 275);
  context.fillStyle = posterColors.coral;
  setFont(context, 30, 700);
  context.fillText(`Lv.${data.level}`, 355, 326);
  context.fillStyle = posterColors.muted;
  setFont(context, 27, 500);
  context.fillText(t('ui.share.poster.companionDays', { days: data.companionDays }), 355, 375);
  context.fillStyle = posterColors.yellow;
  context.fillRect(355, 402, 180, 7);
  context.fillStyle = posterColors.green;
  context.fillRect(545, 402, 180, 7);
};

const drawProgressRing = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  value: number,
  max: number,
  color: string,
) => {
  const ratio = Math.max(0, Math.min(1, value / Math.max(1, max)));
  context.save();
  context.lineWidth = 12;
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(76, 104, 139, 0.16)';
  context.beginPath();
  context.arc(x, y, 45, 0, Math.PI * 2);
  context.stroke();
  if (ratio > 0) {
    context.strokeStyle = color;
    context.beginPath();
    context.arc(x, y, 45, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
    context.stroke();
  }
  context.restore();
};

export const createPetProfilePoster = async ({ pet, petImageUrl, qrCodeDataUrl, now = Date.now() }: ProfilePosterOptions) => {
  const data = createPetProfileCardData(pet, now);
  const { canvas, context } = createCanvas();
  drawSceneBackground(context);
  drawHeader(context, t('ui.share.profileCard'), t('ui.share.poster.profileSubtitle'));
  await drawProfileIdentity(context, data, petImageUrl);

  fillPanel(context, 55, 460, 970, 230, posterColors.surface);
  context.fillStyle = posterColors.ink;
  setFont(context, 28, 700);
  context.fillText(t('ui.share.poster.statusTitle'), 80, 505);
  const statusColors = [posterColors.blue, posterColors.coral, posterColors.green, posterColors.yellow, posterColors.teal];
  data.statuses.forEach((status, index) => {
    const x = 150 + index * 195;
    drawProgressRing(context, x, 592, status.value, status.max, statusColors[index]);
    context.textAlign = 'center';
    context.fillStyle = posterColors.ink;
    setFont(context, 21, 700);
    context.fillText(`${Math.round(status.value)}/${status.max}`, x, 599);
    context.fillStyle = posterColors.muted;
    setFont(context, 19, 600);
    context.fillText(truncateText(context, status.label, 150), x, 668);
    context.textAlign = 'left';
  });

  fillPanel(context, 55, 710, 970, 150, posterColors.surface);
  context.fillStyle = posterColors.ink;
  setFont(context, 28, 700);
  context.fillText(t('ui.share.poster.assetTitle'), 80, 752);
  data.assets.forEach((asset, index) => {
    const x = 155 + index * 255;
    context.textAlign = 'center';
    context.fillStyle = [posterColors.coral, posterColors.green, posterColors.yellow, posterColors.blue][index];
    setFont(context, 31, 700);
    context.fillText(truncateText(context, numberFormatter.format(asset.value), 190), x, 808);
    context.fillStyle = posterColors.muted;
    setFont(context, 18, 500);
    context.fillText(truncateText(context, asset.label, 190), x, 839);
    context.textAlign = 'left';
  });

  fillPanel(context, 55, 880, 970, 395, posterColors.surface);
  context.fillStyle = posterColors.ink;
  setFont(context, 28, 700);
  context.fillText(t('ui.share.poster.activityTitle'), 80, 925);
  data.activity.forEach((activity, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 80 + column * 235;
    const y = 973 + row * 72;
    context.fillStyle = [posterColors.blue, posterColors.coral, posterColors.green, posterColors.yellow][column];
    setFont(context, 24, 700);
    context.fillText(truncateText(context, activity.value, 190), x, y);
    context.fillStyle = posterColors.muted;
    setFont(context, 16, 500);
    context.fillText(truncateText(context, activity.label, 190), x, y + 27);
  });
  data.tags.forEach((tag, index) => {
    const x = 80 + index * 310;
    fillPanel(context, x, 1180, 290, 62, index === 0 ? '#e7f5ff' : index === 1 ? '#fff1ca' : '#ffe8ec');
    context.fillStyle = posterColors.ink;
    setFont(context, 16, 600);
    context.fillText(truncateText(context, tag, 260), x + 15, 1218);
  });
  await drawFooter(context, qrCodeDataUrl);
  return canvasToJpeg(canvas);
};

const getCareActionLabel = (action?: YearlyCareActionKey) =>
  action ? t(`ui.yearReview.actions.${action}`) : t('ui.yearReview.noTopCareAction');

export const createYearReviewPoster = async ({ petName, review, petImageUrl, qrCodeDataUrl }: YearReviewPosterOptions) => {
  const { canvas, context } = createCanvas();
  drawSceneBackground(context);
  drawHeader(context, t('ui.yearReview.title', { year: review.year }), t('ui.share.poster.yearSubtitle'));
  fillPanel(context, 55, 195, 970, 315, posterColors.surface);
  context.fillStyle = posterColors.coral;
  setFont(context, 104, 700);
  context.fillText(String(review.year), 75, 335);
  context.fillStyle = posterColors.ink;
  setFont(context, 42, 700);
  context.fillText(truncateText(context, petName, 535), 80, 400);
  context.fillStyle = posterColors.muted;
  setFont(context, 25, 500);
  context.fillText(truncateText(context, t('ui.share.poster.yearMessage'), 535), 80, 452);
  const image = await loadImage(petImageUrl);
  if (image) drawContainedImage(context, image, 680, 215, 305, 275);

  const metrics = [
    [t('ui.yearReview.companionDays'), review.companionDays],
    [t('ui.yearReview.activeDays'), review.activeDays],
    [t('ui.yearReview.careActions'), review.careActions],
    [t('ui.yearReview.itemUseCount'), review.itemUseCount],
    [t('ui.yearReview.pomodoroFocusCount'), review.pomodoroFocusCount],
    [t('ui.yearReview.topCareAction'), getCareActionLabel(review.topCareAction)],
  ] as const;
  metrics.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 55 + column * 505;
    const y = 535 + row * 170;
    fillPanel(context, x, y, 465, 145, posterColors.surface);
    context.fillStyle = [posterColors.blue, posterColors.coral, posterColors.green, posterColors.yellow, posterColors.teal, posterColors.blue][index];
    setFont(context, typeof value === 'number' ? 48 : 34, 700);
    context.fillText(truncateText(context, typeof value === 'number' ? numberFormatter.format(value) : value, 405), x + 28, y + 68);
    context.fillStyle = posterColors.muted;
    setFont(context, 21, 500);
    context.fillText(truncateText(context, label, 405), x + 28, y + 108);
  });
  fillPanel(context, 55, 1065, 970, 190, posterColors.softBlue);
  context.fillStyle = posterColors.blue;
  context.fillRect(80, 1100, 8, 120);
  context.fillStyle = posterColors.ink;
  setFont(context, 31, 700);
  context.fillText(truncateText(context, t('ui.share.poster.yearQuote', { name: petName }), 870), 110, 1168);
  await drawFooter(context, qrCodeDataUrl);
  return canvasToJpeg(canvas);
};

const rarityColors: Record<GachaResult['rarity'], string> = {
  common: '#f2f6f9',
  uncommon: '#e4f5e8',
  rare: '#e2f2ff',
  legendary: '#fff2c9',
  jackpot: '#ffe4ea',
};

const getGachaRewardLabel = (result: GachaResult) => {
  if (result.kind === 'coins') return t('ui.gacha.coinReward', { coins: numberFormatter.format(result.amount) });
  if (result.kind === 'hearts') return t('ui.gacha.heartReward', { hearts: numberFormatter.format(result.amount) });
  const itemName = result.itemId ? getInventoryItem(result.itemId)?.name ?? result.itemId : t('ui.gacha.unknownReward');
  return `${itemName} x${result.amount}`;
};

export const createGachaPoster = async ({
  machine,
  results,
  itemIconMap,
  petImageUrl,
  qrCodeDataUrl,
  createdAt = Date.now(),
}: GachaPosterOptions) => {
  const cardData = createGachaCardData(machine, results);
  const { canvas, context } = createCanvas();
  drawSceneBackground(context);
  drawHeader(context, t('ui.share.poster.gachaTitle', { count: results.length }), t(machine === 'heart' ? 'ui.gacha.machineTwo' : 'ui.gacha.machineOne'));
  fillPanel(context, 55, 195, 970, 240, posterColors.surface);
  const petImage = await loadImage(petImageUrl);
  if (petImage) drawContainedImage(context, petImage, 75, 210, 235, 205);
  context.fillStyle = posterColors.ink;
  setFont(context, 40, 700);
  context.fillText(truncateText(context, t('ui.share.poster.gachaMessage'), 620), 345, 285);
  context.fillStyle = posterColors.muted;
  setFont(context, 23, 500);
  context.fillText(new Date(createdAt).toLocaleString(), 345, 337);
  context.fillStyle = machine === 'heart' ? posterColors.coral : posterColors.blue;
  setFont(context, 25, 700);
  context.fillText(t('ui.share.poster.gachaFlags', {
    jackpot: cardData.jackpotCount,
    guaranteed: cardData.guaranteedCount,
  }), 345, 390);

  const isSingle = results.length === 1;
  const columns = isSingle ? 1 : 2;
  const cardWidth = isSingle ? 700 : 460;
  const cardHeight = isSingle ? 410 : 135;
  const startX = isSingle ? 190 : 60;
  const startY = isSingle ? 500 : 465;
  const loadedIcons = await Promise.all(results.map((result) =>
    loadImage(result.itemId ? itemIconMap[result.itemId] : undefined)));
  results.forEach((result, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = startX + column * 500;
    const y = startY + row * (cardHeight + 16);
    fillPanel(context, x, y, cardWidth, cardHeight, rarityColors[result.rarity]);
    const icon = loadedIcons[index];
    if (icon) drawContainedImage(context, icon, x + 18, y + 18, isSingle ? 230 : 96, isSingle ? 230 : 96);
    else {
      context.fillStyle = result.kind === 'hearts' ? '#df5b72' : '#d08b18';
      context.beginPath();
      context.arc(x + (isSingle ? 130 : 66), y + (isSingle ? 130 : 66), isSingle ? 78 : 42, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.textAlign = 'center';
      setFont(context, isSingle ? 72 : 38, 700);
      context.fillText(result.kind === 'hearts' ? '♥' : 'C', x + (isSingle ? 130 : 66), y + (isSingle ? 154 : 80));
      context.textAlign = 'left';
    }
    const copyX = x + (isSingle ? 285 : 130);
    context.fillStyle = posterColors.ink;
    setFont(context, isSingle ? 38 : 22, 700);
    context.fillText(truncateText(context, getGachaRewardLabel(result), cardWidth - (copyX - x) - 25), copyX, y + (isSingle ? 105 : 54));
    context.fillStyle = posterColors.muted;
    setFont(context, isSingle ? 26 : 17, 600);
    context.fillText(t(`ui.gacha.rarity.${result.rarity}`), copyX, y + (isSingle ? 155 : 86));
    if (result.pityGuaranteed || result.guaranteed) {
      context.fillStyle = posterColors.coral;
      setFont(context, isSingle ? 24 : 15, 700);
      context.fillText(t(result.pityGuaranteed ? 'ui.gacha.pityGuaranteed' : 'ui.gacha.guaranteed'), copyX, y + (isSingle ? 205 : 112));
    }
  });
  await drawFooter(context, qrCodeDataUrl);
  return canvasToJpeg(canvas);
};

export const getToyPosterQrCode = async () => {
  const sdk = getToySdk();
  if (!sdk || !await supportsToyAbility('getQrCode', sdk)) return undefined;
  try {
    const result = await withToySdkTimeout(
      sdk.getQrCode({ path: 'index.html', size: 240 }),
      3_000,
      'Toy QR code request timed out.',
    );
    return result.base64;
  } catch {
    return undefined;
  }
};
