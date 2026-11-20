import { db } from '../db';
import { getSettings, saveSettings } from './settings';
import type { Novel, Chapter, SiteRule, AppSettings } from '../types';

export interface DatabaseBackup {
  version: number;
  exportedAt: string;
  settings?: AppSettings;
  novels: Novel[];
  chapters: Chapter[];
  rules: SiteRule[];
}

/**
 * Exports all IndexedDB tables (novels, chapters, rules) and settings to a JSON string.
 */
export async function exportDatabaseBackup(): Promise<string> {
  const allNovels = await db.novels.toArray();
  const allChapters = await db.chapters.toArray();
  const allRules = await db.siteRules.toArray();
  const settings = await getSettings();

  const backupData: DatabaseBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    novels: allNovels,
    chapters: allChapters,
    rules: allRules
  };

  return JSON.stringify(backupData, null, 2);
}

/**
 * Triggers a download of the backup JSON file.
 */
export function downloadBackupFile(jsonString: string): void {
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `novel-scraper-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Restores novels, chapters, rules, and settings from a parsed backup object.
 */
export async function restoreDatabaseBackup(
  jsonData: string
): Promise<{ novelsCount: number; chaptersCount: number; rulesCount: number }> {
  const parsed: DatabaseBackup = JSON.parse(jsonData);

  if (!parsed.novels || !Array.isArray(parsed.novels)) {
    throw new Error('File sao lưu không hợp lệ: Thiếu danh sách tiểu thuyết (novels).');
  }

  let rulesCount = 0;
  if (parsed.rules && Array.isArray(parsed.rules)) {
    for (const r of parsed.rules) {
      const existing = await db.siteRules.where('domain').equals(r.domain).first();
      if (!existing) {
        const { id, ...ruleData } = r;
        await db.siteRules.add(ruleData as SiteRule);
        rulesCount++;
      }
    }
  }

  let novelsCount = 0;
  let chaptersCount = 0;

  for (const novel of parsed.novels) {
    const originalId = novel.id;
    const { id, ...novelData } = novel;
    const newNovelId = (await db.novels.add(novelData as Novel)) as number;
    novelsCount++;

    if (originalId && parsed.chapters && Array.isArray(parsed.chapters)) {
      const matchingChapters = parsed.chapters.filter((c) => c.novelId === originalId);
      for (const chap of matchingChapters) {
        const { id: chapId, ...chapData } = chap;
        await db.chapters.add({
          ...chapData,
          novelId: newNovelId
        } as Chapter);
        chaptersCount++;
      }
    }
  }

  if (parsed.settings) {
    await saveSettings(parsed.settings);
  }

  return { novelsCount, chaptersCount, rulesCount };
}
