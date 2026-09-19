import zhCN from './zh-CN.json';
import enUS from './en-US.json';

export type LanguageCode = 'zh-CN' | 'en-US';

type Primitive = string | number | boolean | null | undefined;
type Params = Record<string, Primitive>;
type LocaleResource = Record<string, unknown>;

const resources: Record<LanguageCode, LocaleResource> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

const languageLabels: Record<LanguageCode, string> = {
  'zh-CN': '\u7b80\u4f53\u4e2d\u6587',
  'en-US': 'English',
};

const storageKey = 'pocpet.language';
const fallbackLanguage: LanguageCode = 'zh-CN';

const isLanguageCode = (value: unknown): value is LanguageCode =>
  typeof value === 'string' && value in resources;

const readStoredLanguage = (): LanguageCode => {
  if (typeof window === 'undefined') return fallbackLanguage;

  try {
    const stored = window.localStorage.getItem(storageKey);
    return isLanguageCode(stored) ? stored : fallbackLanguage;
  } catch {
    return fallbackLanguage;
  }
};

let currentLanguage = readStoredLanguage();
let locale = resources[currentLanguage];

if (typeof document !== 'undefined') {
  document.documentElement.lang = currentLanguage;
}

const resolvePath = (key: string, resource = locale): unknown =>
  key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, resource);

const formatText = (template: string, params?: Params) =>
  template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params?.[token];
    return value === undefined || value === null ? '' : String(value);
  });

export const t = (key: string, params?: Params) => {
  const value = resolvePath(key) ?? resolvePath(key, resources[fallbackLanguage]);
  return typeof value === 'string' ? formatText(value, params) : key;
};

export const list = (key: string, params?: Params) => {
  const value = resolvePath(key);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map((item) => formatText(item, params));
};

export const pick = (key: string, params?: Params) => {
  const items = list(key, params);
  if (items.length === 0) return t(key, params);
  return items[Math.floor(Math.random() * items.length)];
};

export const languages = (Object.keys(resources) as LanguageCode[]).map((code) => ({
  code,
  label: languageLabels[code],
}));

export const getLanguage = () => currentLanguage;

export const setLanguage = (language: LanguageCode) => {
  if (!isLanguageCode(language)) return currentLanguage;

  currentLanguage = language;
  locale = resources[language];
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, language);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }

  return currentLanguage;
};
