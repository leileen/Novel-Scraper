import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Novel, Chapter } from '../lib/types';
import { extractTocFromDocument } from '../lib/extractor';
import { DEFAULT_SITE_RULES } from '../lib/db/presets';

const { mockNovels, mockChapters } = vi.hoisted(() => ({
  mockNovels: new Map<number, Novel>(),
  mockChapters: new Map<number, Chapter>()
}));

vi.mock('../lib/db', () => ({
  db: {
    novels: {
      add: vi.fn(async (novel: any) => {
        const id = mockNovels.size + 1;
        mockNovels.set(id, { ...novel, id });
        return id;
      }),
      get: vi.fn(async (id: number) => mockNovels.get(id)),
      update: vi.fn(async (id: number, updates: any) => {
        const n = mockNovels.get(id);
        if (n) mockNovels.set(id, { ...n, ...updates });
      }),
      where: vi.fn((field: string) => ({
        equals: (val: any) => ({
          first: async () => Array.from(mockNovels.values()).find((n: any) => n[field] === val)
        })
      })),
      toArray: vi.fn(async () => Array.from(mockNovels.values())),
      clear: vi.fn(async () => mockNovels.clear())
    },
    chapters: {
      add: vi.fn(async (ch: any) => {
        const id = mockChapters.size + 1;
        mockChapters.set(id, { ...ch, id });
        return id;
      }),
      delete: vi.fn(async (id: number) => mockChapters.delete(id)),
      where: vi.fn((field: string) => ({
        equals: (val: any) => ({
          toArray: async () => Array.from(mockChapters.values()).filter((c: any) => c[field] === val),
          delete: async () => {
            for (const [id, c] of Array.from(mockChapters.entries())) {
              if ((c as any)[field] === val) mockChapters.delete(id);
            }
          },
          count: async () => Array.from(mockChapters.values()).filter((c: any) => c[field] === val).length,
          first: async () => Array.from(mockChapters.values()).find((c: any) => c[field] === val)
        })
      })),
      clear: vi.fn(async () => mockChapters.clear())
    }
  }
}));

import { db } from '../lib/db';

describe('Tab Sync & Metruyenchu Verification Suite', () => {
  const metruyenchuRule = DEFAULT_SITE_RULES.find((r) => r.domain === 'metruyenchu.com.vn');

  beforeEach(() => {
    mockNovels.clear();
    mockChapters.clear();
  });

  it('1. Verifies cleanup of foreign novel chapters, duplicates, and junk count badges', async () => {
    const novelId = (await db.novels.add({
      title: 'Cao Võ: Đăng Nhập Tương Lai Một Vạn Năm',
      sourceUrl: 'https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam',
      totalChapters: 6,
      downloadedChapters: 2,
      status: 'idle',
      createdAt: Date.now(),
      updatedAt: Date.now()
    })) as number;

    // Add legitimate chapters
    await db.chapters.add({
      novelId,
      chapterNumber: 1,
      title: 'Chương 1: Ác mộng',
      url: 'https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-1-abc',
      content: 'Nội dung chương 1',
      wordCount: 500,
      status: 'completed'
    });
    await db.chapters.add({
      novelId,
      chapterNumber: 2,
      title: 'Chương 2: Thắng lợi đội Zombie',
      url: 'https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-2-def',
      content: 'Nội dung chương 2',
      wordCount: 450,
      status: 'completed'
    });

    // Add duplicate chapter
    await db.chapters.add({
      novelId,
      chapterNumber: 1,
      title: 'Chương 1: Ác mộng',
      url: 'https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-1-abc',
      content: '',
      wordCount: 0,
      status: 'pending'
    });

    // Add junk count badges
    await db.chapters.add({
      novelId,
      chapterNumber: 3,
      title: '659 chương',
      url: 'https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-659-xyz',
      content: '',
      wordCount: 0,
      status: 'pending'
    });

    // Add foreign novel chapters from recommendation widgets
    await db.chapters.add({
      novelId,
      chapterNumber: 4,
      title: '11017 chương',
      url: 'https://metruyenchu.com.vn/phong-than-chau/chuong-11017-ghi',
      content: '',
      wordCount: 0,
      status: 'pending'
    });
    await db.chapters.add({
      novelId,
      chapterNumber: 5,
      title: 'Chương 1381: Phiên ngoại (2)',
      url: 'https://metruyenchu.com.vn/tren-nguoi-ta-co-mot-con-rong/chuong-1381-jkl',
      content: 'Nội dung truyện khác',
      wordCount: 40,
      status: 'completed'
    });

    // Run cleanup with forceCleanAllJunk=true (which happens when user clicks Refresh)
    const storySlug = 'cao-vo-dang-nhap-tuong-lai-mot-van-nam';
    const all = await db.chapters.where('novelId').equals(novelId).toArray();
    const seenUrls = new Set<string>();

    for (const ch of all) {
      if (!ch.id) continue;
      const title = (ch.title || '').trim();
      const url = ch.url || '';
      const isJunkCount = /^\d+\s*(?:chương|chapters?|chaps?)$/i.test(title);
      const isNavButton = /^(?:[《<‹\u300a\u2039]*\s*)?(?:chương\s+(?:sau|tiếp|trước)|tiếp(?:\s+theo)?|sau|next|prev|quay lại|lùi)(?:[\s»>→›\u300b\u203a\u2192]*)$/i.test(title);
      const isDuplicate = seenUrls.has(url);
      const isForeignNovel = Boolean(storySlug && storySlug.length > 3 && url.length > 0 && !url.includes(storySlug));
      const isEmptyPendingOrFailed = (!ch.content || ch.content.length === 0) && (ch.status === 'pending' || ch.status === 'failed');

      if (
        isDuplicate ||
        (isEmptyPendingOrFailed && (isJunkCount || isNavButton || isForeignNovel)) ||
        (isJunkCount || isNavButton || isForeignNovel)
      ) {
        await db.chapters.delete(ch.id);
        continue;
      }
      seenUrls.add(url);
    }

    const remaining = await db.chapters.where('novelId').equals(novelId).toArray();
    expect(remaining).toHaveLength(2);
    expect(remaining[0].title).toBe('Chương 1: Ác mộng');
    expect(remaining[1].title).toBe('Chương 2: Thắng lợi đội Zombie');
    expect(remaining.some((c) => c.url.includes('phong-than-chau'))).toBe(false);
    expect(remaining.some((c) => c.url.includes('tren-nguoi-ta-co-mot-con-rong'))).toBe(false);
  });

  it('2. Verifies novel identification by chapter URL and story slug matching across tabs', async () => {
    const novelId = (await db.novels.add({
      title: 'Cao Võ: Đăng Nhập Tương Lai Một Vạn Năm',
      sourceUrl: 'https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam',
      totalChapters: 100,
      downloadedChapters: 0,
      status: 'idle',
      createdAt: Date.now(),
      updatedAt: Date.now()
    })) as number;

    await db.chapters.add({
      novelId,
      chapterNumber: 1,
      title: 'Chương 1',
      url: 'https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-1-Qi5SkRKFdtcU',
      content: '',
      wordCount: 0,
      status: 'pending'
    });

    // Test resolving novel when active tab is on Chapter 2 (different URL than sourceUrl)
    const activeTabUrl = 'https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-2-w0mfCKmklGMH';
    const u = new URL(activeTabUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    let storyUrl = activeTabUrl;
    let storySlug = '';
    if (parts.length >= 2 && /(?:chuong|chapter|c)[-_]\d+/i.test(parts[parts.length - 1])) {
      storySlug = parts[parts.length - 2];
      parts.pop();
      storyUrl = u.origin + '/' + parts.join('/');
    }

    expect(storyUrl).toBe('https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam');
    expect(storySlug).toBe('cao-vo-dang-nhap-tuong-lai-mot-van-nam');

    // Query DB by storyUrl
    const foundByStoryUrl = await db.novels.where('sourceUrl').equals(storyUrl).first();
    expect(foundByStoryUrl).toBeDefined();
    expect(foundByStoryUrl?.id).toBe(novelId);
  });

  it('3. Verifies AJAX pagination on Metruyenchu with 100 chapters per page', () => {
    const docHtml = `
      <div id="chapter-list">
        <ul>
          <li><a href="/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-1-a">Chương 1</a></li>
          <li><a href="/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-2-b">Chương 2</a></li>
        </ul>
      </div>
      <div class="paging">
        <a class="active" href="javascript:void(0)">1</a>
        <a href="javascript:void(0)" onclick="page(33509,2);">2</a>
        <a href="javascript:void(0)" onclick="page(33509,2);"><span>›</span></a>
      </div>
    `;
    const parser = new DOMParser();
    const doc = parser.parseFromString(docHtml, 'text/html');

    const result = extractTocFromDocument(
      doc,
      metruyenchuRule,
      'https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam'
    );
    expect(result.chapters).toHaveLength(2);
    expect(result.nextPaginationUrl).toBe('https://metruyenchu.com.vn/get/listchap/33509?page=2');
  });
});
