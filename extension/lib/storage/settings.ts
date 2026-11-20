import type { AppSettings } from '../types';

export const DEFAULT_AD_KEYWORDS: string[] = [
  'Truyện được đăng tại',
  'Chúc bạn đọc truyện vui vẻ',
  'Đọc truyện online tại',
  'Nguồn:',
  'nguồn:',
  'Shared by:',
  'Edit by:',
  'Chuyển ngữ:',
  'Vui lòng không reup',
  'Ủng hộ dịch giả tại',
  'Bạn đang đọc truyện tại',
  'Website:',
  'Web truyện:',
  'Mọi thắc mắc xin liên hệ',
  'Tìm kiếm nhiều nhất trên Google',
  'Bản quyền thuộc về'
];

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'vi',
  theme: 'dark',
  politeDelayMin: 1.5,
  politeDelayMax: 3.0,
  defaultFormat: 'txt',
  adKeywords: DEFAULT_AD_KEYWORDS,
  deobfuscateText: true,
  customReplacements: [],
  splitVolumeSize: 0,
  omitChapterTitles: false
};

export function normalizeAdKeywords(raw: any): string[] {
  if (Array.isArray(raw)) {
    return raw.map((k: any) => String(k).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw.split('\n').map((s: string) => s.trim()).filter(Boolean);
  }
  if (raw && typeof raw === 'object') {
    return Object.values(raw).map((k: any) => String(k).trim()).filter(Boolean);
  }
  return [...DEFAULT_AD_KEYWORDS];
}

export function normalizeCustomReplacements(raw: any): Array<{ from: string; to: string }> {
  if (!raw) return [];
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === 'object'
    ? Object.values(raw)
    : [];

  return items
    .filter((item: any) => item && typeof item === 'object' && typeof item.from === 'string' && item.from.trim().length > 0)
    .map((item: any) => ({
      from: item.from.trim(),
      to: item.to !== undefined && item.to !== null ? String(item.to) : ''
    }));
}

export async function getSettings(): Promise<AppSettings> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const res = await chrome.storage.local.get('novel_scraper_settings');
      if (res && res.novel_scraper_settings) {
        const raw = res.novel_scraper_settings;
        const adKeywords = raw.adKeywords !== undefined ? normalizeAdKeywords(raw.adKeywords) : [...DEFAULT_AD_KEYWORDS];
        const customReplacements = normalizeCustomReplacements(raw.customReplacements);
        return {
          ...DEFAULT_SETTINGS,
          ...raw,
          adKeywords,
          customReplacements
        };
      }
    }
  } catch (err) {
    console.warn('[Novel Scraper] Failed to read settings from storage, fallback to defaults', err);
  }
  return {
    ...DEFAULT_SETTINGS,
    adKeywords: [...DEFAULT_AD_KEYWORDS],
    customReplacements: []
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const plain = JSON.parse(JSON.stringify(settings || DEFAULT_SETTINGS));
      plain.adKeywords = normalizeAdKeywords(plain.adKeywords);
      plain.customReplacements = normalizeCustomReplacements(plain.customReplacements);
      await chrome.storage.local.set({ novel_scraper_settings: plain });
    }
  } catch (err) {
    console.error('[Novel Scraper] Failed to save settings to storage', err);
  }
}
