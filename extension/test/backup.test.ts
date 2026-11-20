import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Novel, Chapter, SiteRule } from '../lib/types';

const { mockNovels, mockChapters, mockRules } = vi.hoisted(() => {
  return {
    mockNovels: new Map<number, Novel>(),
    mockChapters: new Map<number, Chapter>(),
    mockRules: new Map<number, SiteRule>()
  };
});

vi.mock('../lib/db', () => {
  let novelIdCounter = 1;
  let chapterIdCounter = 1;
  let ruleIdCounter = 1;

  return {
    db: {
      novels: {
        toArray: vi.fn(async () => Array.from(mockNovels.values())),
        add: vi.fn(async (novel: any) => {
          const id = novelIdCounter++;
          const item = { ...novel, id };
          mockNovels.set(id, item);
          return id;
        }),
        where: vi.fn((field: string) => ({
          equals: vi.fn((val: any) => ({
            toArray: vi.fn(async () => Array.from(mockNovels.values()).filter((n: any) => n[field] === val))
          }))
        }))
      },
      chapters: {
        toArray: vi.fn(async () => Array.from(mockChapters.values())),
        add: vi.fn(async (chap: any) => {
          const id = chapterIdCounter++;
          const item = { ...chap, id };
          mockChapters.set(id, item);
          return id;
        }),
        where: vi.fn((field: string) => ({
          equals: vi.fn((val: any) => ({
            toArray: vi.fn(async () => Array.from(mockChapters.values()).filter((c: any) => c[field] === val))
          }))
        }))
      },
      siteRules: {
        toArray: vi.fn(async () => Array.from(mockRules.values())),
        add: vi.fn(async (r: any) => {
          const id = ruleIdCounter++;
          mockRules.set(id, { ...r, id });
          return id;
        }),
        where: vi.fn((field: string) => ({
          equals: vi.fn((val: any) => ({
            first: vi.fn(async () => Array.from(mockRules.values()).find((r: any) => r[field] === val))
          }))
        }))
      }
    }
  };
});

import { db } from '../lib/db';
import { exportDatabaseBackup, restoreDatabaseBackup } from '../lib/storage/backup';

describe('Database Backup & Restore (Mục 9.6)', () => {
  beforeEach(async () => {
    mockNovels.clear();
    mockChapters.clear();
    mockRules.clear();
  });

  it('exports database to valid JSON backup structure', async () => {
    const novelId = (await db.novels.add({
      title: 'Truyện Thử Nghiệm Sao Lưu',
      sourceUrl: 'https://example.com/novel',
      totalChapters: 2,
      downloadedChapters: 2,
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now()
    })) as number;

    await db.chapters.add({
      novelId,
      chapterNumber: 1,
      title: 'Chương 1',
      url: 'https://example.com/c1',
      content: 'Nội dung chương 1',
      wordCount: 4,
      status: 'completed'
    });

    const json = await exportDatabaseBackup();
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBeDefined();
    expect(parsed.novels.length).toBeGreaterThan(0);
    expect(parsed.novels[0].title).toBe('Truyện Thử Nghiệm Sao Lưu');
    expect(parsed.chapters.length).toBeGreaterThan(0);
    expect(parsed.chapters[0].content).toBe('Nội dung chương 1');
  });

  it('restores novels and re-links chapters properly from JSON backup', async () => {
    const mockBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      novels: [
        {
          id: 999,
          title: 'Truyện Được Khôi Phục',
          sourceUrl: 'https://example.com/restored',
          totalChapters: 1,
          downloadedChapters: 1,
          status: 'completed',
          createdAt: 1000,
          updatedAt: 2000
        }
      ],
      chapters: [
        {
          id: 8888,
          novelId: 999,
          chapterNumber: 1,
          title: 'Chương 1 Khôi Phục',
          url: 'https://example.com/c1-restored',
          content: 'Nội dung khôi phục chuẩn xác',
          wordCount: 5,
          status: 'completed'
        }
      ],
      rules: []
    };

    const res = await restoreDatabaseBackup(JSON.stringify(mockBackup));
    expect(res.novelsCount).toBe(1);
    expect(res.chaptersCount).toBe(1);

    const novelsInDb = await db.novels.where('title').equals('Truyện Được Khôi Phục').toArray();
    expect(novelsInDb.length).toBe(1);
    const restoredNovel = novelsInDb[0];

    const chaptersInDb = await db.chapters.where('novelId').equals(restoredNovel.id!).toArray();
    expect(chaptersInDb.length).toBe(1);
    expect(chaptersInDb[0].title).toBe('Chương 1 Khôi Phục');
    expect(chaptersInDb[0].content).toBe('Nội dung khôi phục chuẩn xác');
  });

  it('throws error when JSON backup is malformed or missing novels', async () => {
    await expect(restoreDatabaseBackup(JSON.stringify({ version: 1 }))).rejects.toThrow(
      'File sao lưu không hợp lệ'
    );
  });
});
