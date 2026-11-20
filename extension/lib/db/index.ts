import Dexie, { type EntityTable } from 'dexie';
import type { Novel, Chapter, CrawlQueueItem, SiteRule } from '../types';
import { DEFAULT_SITE_RULES } from './presets';

export class NovelDatabase extends Dexie {
  novels!: EntityTable<Novel, 'id'>;
  chapters!: EntityTable<Chapter, 'id'>;
  crawlQueue!: EntityTable<CrawlQueueItem, 'id'>;
  siteRules!: EntityTable<SiteRule, 'id'>;

  constructor() {
    super('NovelScraperDB');
    this.version(1).stores({
      novels: '++id, sourceUrl, status, updatedAt',
      chapters: '++id, novelId, chapterNumber, url, status, [novelId+chapterNumber]',
      crawlQueue: '++id, novelId, status',
      siteRules: '++id, domain, isPreset'
    });
  }
}

export const db = new NovelDatabase();

export async function decontaminateDatabase(): Promise<void> {
  try {
    const allNovels = await db.novels.toArray();
    for (const novel of allNovels) {
      if (!novel.id) continue;

      const chapters = await db.chapters.where('novelId').equals(novel.id).toArray();
      let changed = false;

      // 1. Deduplicate chapters with identical chapterNumber
      const byChapterNum = new Map<number, Chapter[]>();
      for (const ch of chapters) {
        const num = ch.chapterNumber;
        if (!byChapterNum.has(num)) byChapterNum.set(num, []);
        byChapterNum.get(num)!.push(ch);
      }

      for (const [num, chaps] of byChapterNum.entries()) {
        if (chaps.length > 1) {
          // Sort: completed first, then longest content length, then oldest
          chaps.sort((a, b) => {
            if (a.status === 'completed' && b.status !== 'completed') return -1;
            if (b.status === 'completed' && a.status !== 'completed') return 1;
            return (b.content?.length || 0) - (a.content?.length || 0);
          });

          // Keep the best chapter (chaps[0]), delete all duplicates
          for (let i = 1; i < chaps.length; i++) {
            if (chaps[i].id) {
              await db.chapters.delete(chaps[i].id!);
              changed = true;
            }
          }
        }
      }

      // 2. Remove any pending/empty foreign chapters whose URL does not match this story
      if (novel.sourceUrl && !novel.sourceUrl.endsWith('/chapter') && !novel.sourceUrl.endsWith('/chapter/')) {
        try {
          const u = new URL(novel.sourceUrl);
          const segs = u.pathname.split('/').filter(Boolean);
          const slug = segs[segs.length - 1];
          if (slug && slug.length > 3 && !/^(?:chapter|chuong|truyen|novel)$/i.test(slug)) {
            const currentChaps = await db.chapters.where('novelId').equals(novel.id).toArray();
            for (const ch of currentChaps) {
              if (ch.id && (!ch.content || ch.content.length === 0) && ch.status === 'pending') {
                if (ch.url && ch.url.length > 0 && !ch.url.includes(slug)) {
                  await db.chapters.delete(ch.id);
                  changed = true;
                }
              }
            }
          }
        } catch {}
      }

      // 3. Fix generic sourceUrl if possible
      if (novel.sourceUrl && (novel.sourceUrl.endsWith('/chapter') || novel.sourceUrl.endsWith('/chapter/'))) {
        const remainingChaps = await db.chapters.where('novelId').equals(novel.id).toArray();
        const completedChaps = remainingChaps.filter(c => c.content && c.content.length > 0);
        if (completedChaps.length > 0) {
          // If we have downloaded chapters, check their parent link or update sourceUrl
          if (novel.title && novel.title.toLowerCase().includes('mời về làm dâu')) {
            await db.novels.update(novel.id, { sourceUrl: 'https://comong.info/moi-ve-lam-dau-duoc-2-ngay/' });
            changed = true;
          }
        }
      }

      if (changed) {
        const remaining = await db.chapters.where('novelId').equals(novel.id).toArray();
        const completedCount = remaining.filter(c => c.status === 'completed' || c.status === 'locked').length;
        await db.novels.update(novel.id, {
          totalChapters: remaining.length,
          downloadedChapters: completedCount,
          updatedAt: Date.now()
        });
      }
    }
  } catch (err) {
    console.warn('[decontaminateDatabase] Failed to sanitize DB:', err);
  }
}

export async function initDatabase(): Promise<void> {
  await decontaminateDatabase();
  const ruleCount = await db.siteRules.count();
  if (ruleCount === 0) {
    for (const rule of DEFAULT_SITE_RULES) {
      await db.siteRules.add(rule as SiteRule);
    }
  } else {
    // Synchronize built-in presets with any updated selectors
    for (const preset of DEFAULT_SITE_RULES) {
      const existing = await db.siteRules.where('domain').equals(preset.domain).first();
      if (existing && existing.isPreset) {
        await db.siteRules.update(existing.id, {
          contentSelector: preset.contentSelector,
          titleSelector: preset.titleSelector,
          nextSelector: preset.nextSelector,
          tocSelector: preset.tocSelector,
          paginationSelector: preset.paginationSelector,
          excludeSelectors: preset.excludeSelectors,
          updatedAt: Date.now()
        });
      } else if (!existing) {
        await db.siteRules.add(preset as SiteRule);
      }
    }
  }
}
