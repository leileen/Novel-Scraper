import viMessages from '../../public/_locales/vi/messages.json';
import enMessages from '../../public/_locales/en/messages.json';

type LocaleDict = Record<string, { message: string; description?: string }>;

const dictionaries: Record<'vi' | 'en', LocaleDict> = {
  vi: viMessages as unknown as LocaleDict,
  en: enMessages as unknown as LocaleDict
};

let currentLanguage: 'vi' | 'en' = 'vi';
const listeners = new Set<(lang: 'vi' | 'en') => void>();

export function getInitialLanguage(): 'vi' | 'en' {
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage) {
      const browserLang = chrome.i18n.getUILanguage().toLowerCase();
      if (browserLang.startsWith('vi')) return 'vi';
      if (browserLang.startsWith('en')) return 'en';
    }
  } catch {
    // fallback
  }
  return 'vi';
}

export function setLanguage(lang: 'vi' | 'en'): void {
  currentLanguage = lang;
  listeners.forEach((listener) => listener(lang));
}

export function getCurrentLanguage(): 'vi' | 'en' {
  return currentLanguage;
}

export function onLanguageChange(listener: (lang: 'vi' | 'en') => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key: string, fallback?: string): string {
  const dict = dictionaries[currentLanguage] || dictionaries.vi;
  if (dict[key]?.message) {
    return dict[key].message;
  }
  // Try chrome.i18n if available
  if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
    const msg = chrome.i18n.getMessage(key);
    if (msg) return msg;
  }
  return fallback || key;
}
