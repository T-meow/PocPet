export const appearanceStorageKey = 'pocpet.appearance.v1';
export const appearanceThemes = [
  { id: 'sage', color: '#476b55', zh: '浅绿', en: 'Sage' },
  { id: 'apricot', color: '#a06c45', zh: '暖杏', en: 'Apricot' },
  { id: 'blue', color: '#537a99', zh: '雾蓝', en: 'Mist blue' },
  { id: 'lilac', color: '#88709e', zh: '淡紫', en: 'Lilac' },
] as const;
export type Appearance = { theme: typeof appearanceThemes[number]['id'] | 'custom'; color: string };
export const defaultAppearance: Appearance = { theme: 'sage', color: '#476b55' };
export const validAccent = (value: string) => /^#[\da-f]{6}$/i.test(value);
export const normalizeAppearance = (value: unknown): Appearance => {
  if (!value || typeof value !== 'object') return { ...defaultAppearance };
  const raw = value as Partial<Appearance>;
  const theme = appearanceThemes.find((entry) => entry.id === raw.theme);
  if (theme) return { theme: theme.id, color: theme.color };
  return raw.theme === 'custom' && typeof raw.color === 'string' && validAccent(raw.color)
    ? { theme: 'custom', color: raw.color.toLowerCase() } : { ...defaultAppearance };
};
export const mixColor = (a: string, b: string, weight: number) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - weight) + parseInt(b.slice(i, i + 2), 16) * weight).toString(16).padStart(2, '0')).join('');
const luminance = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
export const colorContrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
export const appearancePalette = (appearance: Appearance) => {
  const color = normalizeAppearance(appearance).color;
  const backdrop = mixColor('#f6f8fc', color, .06);
  let text = color;
  for (let i = 0; i < 30 && Math.min(colorContrast(text, backdrop), colorContrast(text, '#ffffff')) < 4.5; i++) text = mixColor(text, '#20314b', .12);
  return { '--app-bg': backdrop, '--brand-color': color, '--brand-text': text, '--brand-on': colorContrast(color, '#ffffff') >= colorContrast(color, '#000000') ? '#ffffff' : '#000000' };
};
export const readAppearance = (): Appearance => {
  try { return normalizeAppearance(JSON.parse(localStorage.getItem(appearanceStorageKey) ?? 'null')); }
  catch { return { ...defaultAppearance }; }
};
export const persistAppearance = (appearance: Appearance) => {
  try {
    localStorage.setItem(appearanceStorageKey, JSON.stringify(normalizeAppearance(appearance)));
    return true;
  } catch { return false; }
};
