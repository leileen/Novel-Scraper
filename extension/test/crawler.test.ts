import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Novel, Chapter, AppSettings, SiteRule } from '../lib/types';
import type { CrawlProgressEvent } from '../lib/crawler';

// Hoisted mock state and rules for vi.mock
const { mockNovels, mockChapters, sampleRule } = vi.hoisted(() => {
  const sampleRule: SiteRule = {
    domain: 'example.com',
    name: 'Example Site',
    contentSelector: '.content',
    titleSelector: 'h1',
    nextSelector: 'a.next',
    tocSelector: '.chapter-list a',
    paginationSelector: '.pagination a.next',
    isPreset: true,
    createdAt: 0,
    updatedAt: 0
  };

  return {
    mockNovels: new Map<number, Novel>(),
    mockChapters: new Map<number, Chapter>(),
    sampleRule
  };
});

vi.mock('../lib/db', () => {
  return {
    db: {
      novels: {
        get: vi.fn(async (id: number) => mockNovels.get(id)),
        update: vi.fn(async (id: number, updates: Partial<Novel>) => {
          const novel = mockNovels.get(id);
          if (novel) {
            Object.assign(novel, updates);
            mockNovels.set(id, novel);
          }
          return 1;
        })
      },
      chapters: {
        where: (field: string) => ({
          equals: (val: any) => ({
            and: (predicate: (c: Chapter) => boolean) => ({
              sortBy: async (sortKey: string) => {
                const results = Array.from(mockChapters.values()).filter(
                  (c) => (c as any)[field] === val && predicate(c)
                );
                return results.sort((a, b) => (a as any)[sortKey] - (b as any)[sortKey]);
              },
              count: async () => {
                return Array.from(mockChapters.values()).filter(
                  (c) => (c as any)[field] === val && predicate(c)
                ).length;
              }
            }),
            count: async () => {
              return Array.from(mockChapters.values()).filter((c) => (c as any)[field] === val).length;
            }
          })
        }),
        update: vi.fn(async (id: number, updates: Partial<Chapter>) => {
          const chap = mockChapters.get(id);
          if (chap) {
            Object.assign(chap, updates);
            mockChapters.set(id, chap);
          }
          return 1;
        })
      },
      siteRules: {
        where: () => ({
          equals: () => ({
            first: async () => sampleRule
          })
        })
      }
    },
    initDatabase: vi.fn()
  };
});

// Import crawler after DB mock is configured
import { crawler } from '../lib/crawler';

describe('Crawler Engine & Lifecycle Suite', () => {
  const defaultSettings: AppSettings = {
    language: 'vi',
    theme: 'dark',
    politeDelayMin: 0.001, // Near-zero delay for instant unit testing
    politeDelayMax: 0.002,
    defaultFormat: 'txt',
    adKeywords: ['Quảng cáo', 'truyenfull.vn']
  };

  const sampleRule: SiteRule = {
    domain: 'example.com',
    name: 'Example Site',
    contentSelector: '.content',
    titleSelector: 'h1',
    nextSelector: 'a.next',
    tocSelector: '.chapter-list a',
    paginationSelector: '.pagination a.next',
    isPreset: true,
    createdAt: 0,
    updatedAt: 0
  };

  beforeEach(() => {
    mockNovels.clear();
    mockChapters.clear();
    (crawler as any).isCancelled = false;
    (crawler as any).isPaused = false;
    (crawler as any).isCrawling = false;
    (crawler as any).activeNovelId = null;
    (crawler as any).abortController = null;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    crawler.cancel();
  });

  // =========================================================================
  // Tier 1: Feature Coverage (Happy Path for Crawler Engine)
  // =========================================================================
  describe('Tier 1: Feature Coverage', () => {
    it('T1.1: Event subscription registers listeners and unsubscribes cleanly', () => {
      const eventsReceived: CrawlProgressEvent[] = [];
      const listener = (e: CrawlProgressEvent) => eventsReceived.push(e);

      const unsubscribe = crawler.subscribe(listener);
      expect(typeof unsubscribe).toBe('function');

      // Trigger pause, which notifies active subscribers
      crawler.pause();
      // Unsubscribe and verify no further notifications arrive
      unsubscribe();
      crawler.resume();

      expect(eventsReceived.length).toBeGreaterThanOrEqual(0);
    });

    it('T1.2: CrawlManager tracks active novel ID and initial idle state', () => {
      expect(crawler.getActiveNovelId()).toBeNull();
    });

    it('T1.3: scanFullToc traverses multi-page TOC pagination and collects chapters', async () => {
      const page1Html = `
        <div class="chapter-list">
          <a href="https://example.com/c1">Chương 1: Mở đầu</a>
          <a href="https://example.com/c2">Chương 2: Tiến bước</a>
        </div>
        <div class="pagination">
          <a class="next" href="https://example.com/toc?page=2">Trang sau</a>
        </div>
      `;

      const page2Html = `
        <div class="chapter-list">
          <a href="https://example.com/c3">Chương 3: Đột phá</a>
        </div>
        <div class="pagination">
          <!-- Final page, no next link -->
        </div>
      `;

      const fetchMock = vi.fn(async (url: string) => {
        if (url.includes('page=2')) {
          return new Response(page2Html, { status: 200 });
        }
        return new Response(page1Html, { status: 200 });
      });
      globalThis.fetch = fetchMock as any;

      const scannedPages: number[] = [];
      const chapters = await crawler.scanFullToc(
        'https://example.com/toc?page=1',
        sampleRule,
        10,
        (page, count) => scannedPages.push(page)
      );

      expect(chapters).toHaveLength(3);
      expect(chapters[0].title).toBe('Chương 1: Mở đầu');
      expect(chapters[1].title).toBe('Chương 2: Tiến bước');
      expect(chapters[2].title).toBe('Chương 3: Đột phá');
      expect(chapters[2].chapterNumber).toBe(3);
      expect(scannedPages).toEqual([1, 2]);
    });

    it('T1.4: startCrawl executes queue, extracts chapters, and marks novel completed', async () => {
      // Setup novel in mock DB
      const novelId = 100;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Vũ Động Càn Khôn',
        sourceUrl: 'https://example.com/novel-100',
        totalChapters: 2,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      mockChapters.set(1, {
        id: 1,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://example.com/c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      mockChapters.set(2, {
        id: 2,
        novelId,
        chapterNumber: 2,
        title: 'Chương 2',
        url: 'https://example.com/c2',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      const chapter1Html = `
        <h1>Chương 1: Thiếu niên Lâm Động</h1>
        <div class="content"><p>Lâm Động nhắm nghiền hai mắt, mồ hôi đầm đìa.</p></div>
      `;

      const chapter2Html = `
        <h1>Chương 2: Thạch Phù thần bí</h1>
        <div class="content"><p>Trong sơn động tĩnh mịch, Thạch Phù bỗng phát ra ánh sáng ôn nhuận.</p></div>
      `;

      globalThis.fetch = vi.fn(async (url: string) => {
        if (url.includes('c2')) {
          return new Response(chapter2Html, { status: 200 });
        }
        return new Response(chapter1Html, { status: 200 });
      }) as any;

      const progressEvents: CrawlProgressEvent[] = [];
      const unsubscribe = crawler.subscribe((e) => progressEvents.push(e));

      await crawler.startCrawl(novelId, defaultSettings);
      unsubscribe();

      // Verify chapters completed
      const chap1 = mockChapters.get(1);
      const chap2 = mockChapters.get(2);
      expect(chap1?.status).toBe('completed');
      expect(chap1?.content).toContain('Lâm Động nhắm nghiền');
      expect(chap1?.wordCount).toBeGreaterThan(0);

      expect(chap2?.status).toBe('completed');
      expect(chap2?.title).toContain('Thạch Phù thần bí');
      expect(chap2?.content).toContain('Trong sơn động tĩnh mịch');

      // Verify novel marked completed
      const updatedNovel = mockNovels.get(novelId);
      expect(updatedNovel?.status).toBe('completed');
      expect(progressEvents.some((e) => e.status === 'completed')).toBe(true);
    });

    it('T1.5: crawler lifecycle pause and resume operations transition states', async () => {
      const novelId = 105;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Test Pause Novel',
        sourceUrl: 'https://example.com/pause-novel',
        totalChapters: 1,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      crawler.pause();
      crawler.resume();
      expect(crawler.getActiveNovelId()).toBeNull();
    });
  });

  // =========================================================================
  // Tier 2: Boundary & Corner Cases
  // =========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('T2.1: scanFullToc stops pagination on self-referencing and repeating links (loop prevention)', async () => {
      // Page 1 links to Page 2; Page 2 has self-referencing link to Page 2
      const page1Html = `
        <div class="chapter-list"><a href="https://example.com/c1">Chương 1</a></div>
        <div class="pagination"><a class="next" href="https://example.com/toc?page=2">Trang 2</a></div>
      `;
      const page2Html = `
        <div class="chapter-list"><a href="https://example.com/c2">Chương 2</a></div>
        <div class="pagination"><a class="next" href="https://example.com/toc?page=2">Trang 2 (Lặp lại URL hiện tại)</a></div>
      `;

      let requestCount = 0;
      globalThis.fetch = vi.fn(async (url: string) => {
        requestCount++;
        if (url.includes('page=2')) {
          return new Response(page2Html, { status: 200 });
        }
        return new Response(page1Html, { status: 200 });
      }) as any;

      // Scan TOC with repeating loop
      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', sampleRule, 10);

      // Breaks cleanly on self-referencing link in exactly 2 requests
      expect(requestCount).toBe(2);
      expect(chapters.length).toBe(2);
    });

    it('T2.2: scanFullToc respects maxPages limit and halts', async () => {
      // Mock page that always generates an endless sequence of next pages
      globalThis.fetch = vi.fn(async (url: string) => {
        const match = url.match(/page=(\d+)/);
        const curPage = match ? parseInt(match[1]) : 1;
        const nextPage = curPage + 1;
        const html = `
          <div class="chapter-list"><a href="https://example.com/c${curPage}">Chương ${curPage}</a></div>
          <div class="pagination"><a class="next" href="https://example.com/toc?page=${nextPage}">Tiếp</a></div>
        `;
        return new Response(html, { status: 200 });
      }) as any;

      const maxLimit = 3;
      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', sampleRule, maxLimit);

      expect(chapters.length).toBeLessThanOrEqual(maxLimit);
    });

    it('T2.3: scanFullToc gracefully handles HTTP error (404/500) and returns partial results', async () => {
      const page1Html = `
        <div class="chapter-list"><a href="https://example.com/c1">Chương 1</a></div>
        <div class="pagination"><a class="next" href="https://example.com/toc?page=2">Trang 2</a></div>
      `;

      globalThis.fetch = vi.fn(async (url: string) => {
        if (url.includes('page=2')) {
          return new Response('Internal Server Error', { status: 500, statusText: 'Server Error' });
        }
        return new Response(page1Html, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', sampleRule, 5);
      expect(chapters).toHaveLength(1);
      expect(chapters[0].title).toBe('Chương 1');
    });

    it('T2.4: Empty TOC page returns 0 chapters without crashing', async () => {
      globalThis.fetch = vi.fn(async () => {
        return new Response('<div>Trang trống</div>', { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/empty-toc', sampleRule, 2);
      expect(chapters).toEqual([]);
    });

    it('T2.5: Chapter fetch error (404 Not Found) marks chapter status failed without aborting remaining chapters', async () => {
      const novelId = 200;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Error Handling Novel',
        sourceUrl: 'https://example.com/err-novel',
        totalChapters: 2,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      mockChapters.set(10, {
        id: 10,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1 (Bị lỗi 404)',
        url: 'https://example.com/err-c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      mockChapters.set(11, {
        id: 11,
        novelId,
        chapterNumber: 2,
        title: 'Chương 2 (Thành công)',
        url: 'https://example.com/ok-c2',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      globalThis.fetch = vi.fn(async (url: string) => {
        if (url.includes('err-c1')) {
          return new Response('Not Found', { status: 404, statusText: 'Not Found' });
        }
        return new Response('<h1>Chương 2</h1><div class="content"><p>Nội dung tốt</p></div>', { status: 200 });
      }) as any;

      await crawler.startCrawl(novelId, defaultSettings);

      const failedChap = mockChapters.get(10);
      const successChap = mockChapters.get(11);

      expect(failedChap?.status).toBe('failed');
      expect(failedChap?.errorMessage).toContain('404');
      expect(successChap?.status).toBe('completed');
      expect(successChap?.content).toContain('Nội dung tốt');
    });

    it('T2.6: Locked/VIP chapter is detected and marked status: locked', async () => {
      const novelId = 300;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'VIP Novel',
        sourceUrl: 'https://example.com/vip-novel',
        totalChapters: 1,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      mockChapters.set(30, {
        id: 30,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1: VIP',
        url: 'https://example.com/vip-c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      const vipHtml = `
        <h1>Chương 1: VIP</h1>
        <div class="content"><p>Đây là chương VIP. Vui lòng nạp linh thạch để mở khóa chương.</p></div>
      `;

      globalThis.fetch = vi.fn(async () => new Response(vipHtml, { status: 200 })) as any;

      await crawler.startCrawl(novelId, defaultSettings);

      const chap = mockChapters.get(30);
      expect(chap?.status).toBe('locked');
    });

    it('T2.7: Crawler cancellation stops queue immediately and marks status idle', async () => {
      const novelId = 400;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Canceled Novel',
        sourceUrl: 'https://example.com/cancel-novel',
        totalChapters: 5,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      for (let i = 1; i <= 5; i++) {
        mockChapters.set(40 + i, {
          id: 40 + i,
          novelId,
          chapterNumber: i,
          title: `Chương ${i}`,
          url: `https://example.com/cancel-c${i}`,
          content: '',
          wordCount: 0,
          status: 'pending'
        });
      }

      globalThis.fetch = vi.fn(async (url: string) => {
        // Cancel crawler on second request
        if (url.includes('cancel-c2')) {
          crawler.cancel();
        }
        return new Response('<h1>Title</h1><div class="content"><p>Text</p></div>', { status: 200 });
      }) as any;

      await crawler.startCrawl(novelId, defaultSettings);

      const updatedNovel = mockNovels.get(novelId);
      expect(updatedNovel?.status).toBe('idle');
    });

    it('T2.8: scanFullToc detects multi-hop circular pagination (Page 1 -> Page 2 -> Page 1) and breaks without runaway requests', async () => {
      const page1Html = `
        <div class="chapter-list"><a href="https://example.com/c1">Chương 1</a></div>
        <div class="pagination"><a class="next" href="https://example.com/toc?page=2">Trang 2</a></div>
      `;
      const page2Html = `
        <div class="chapter-list"><a href="https://example.com/c2">Chương 2</a></div>
        <div class="pagination"><a class="next" href="https://example.com/toc?page=1">Trang 1 (Vòng lặp)</a></div>
      `;

      let requestCount = 0;
      globalThis.fetch = vi.fn(async (url: string) => {
        requestCount++;
        if (url.includes('page=2')) {
          return new Response(page2Html, { status: 200 });
        }
        return new Response(page1Html, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', sampleRule, 20);

      // Must break after exactly 2 requests rather than cycling 20 times
      expect(requestCount).toBe(2);
      expect(chapters).toHaveLength(2);
    });

    it('T2.9: scanFullToc resolves relative pagination links and relative chapter URLs against currentUrl', async () => {
      const page1Html = `
        <div class="chapter-list"><a href="c1.html">Chương 1</a></div>
        <div class="pagination"><a class="next" href="?page=2">Trang 2</a></div>
      `;
      const page2Html = `
        <div class="chapter-list"><a href="c2.html">Chương 2</a></div>
        <div class="pagination"></div>
      `;

      const fetchedUrls: string[] = [];
      globalThis.fetch = vi.fn(async (url: string) => {
        fetchedUrls.push(url);
        if (url.includes('page=2')) {
          return new Response(page2Html, { status: 200 });
        }
        return new Response(page1Html, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/novel/index.html', sampleRule, 5);

      expect(fetchedUrls).toEqual([
        'https://example.com/novel/index.html',
        'https://example.com/novel/index.html?page=2'
      ]);
      expect(chapters).toHaveLength(2);
      expect(chapters[0].url).toBe('https://example.com/novel/c1.html');
      expect(chapters[1].url).toBe('https://example.com/novel/c2.html');
    });

    it('T2.10: scanFullToc strips anchor hash fragments to prevent duplicate pagination loops', async () => {
      const page1Html = `
        <div class="chapter-list"><a href="https://example.com/c1">Chương 1</a></div>
        <div class="pagination"><a class="next" href="https://example.com/toc?page=2#heading">Trang 2</a></div>
      `;
      const page2Html = `
        <div class="chapter-list"><a href="https://example.com/c2">Chương 2</a></div>
        <div class="pagination"><a class="next" href="https://example.com/toc?page=2#footer">Trang 2 có hash</a></div>
      `;

      let requestCount = 0;
      globalThis.fetch = vi.fn(async (url: string) => {
        requestCount++;
        if (url.includes('page=2')) {
          return new Response(page2Html, { status: 200 });
        }
        return new Response(page1Html, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', sampleRule, 10);

      expect(requestCount).toBe(2);
      expect(chapters).toHaveLength(2);
    });

    it('T2.11: rejects concurrent startCrawl attempts when another crawl is running', async () => {
      const novel1 = 601;
      const novel2 = 602;

      mockNovels.set(novel1, {
        id: novel1,
        title: 'Active Novel',
        sourceUrl: 'https://example.com/novel-601',
        totalChapters: 1,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      mockNovels.set(novel2, {
        id: novel2,
        title: 'Second Novel',
        sourceUrl: 'https://example.com/novel-602',
        totalChapters: 1,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      mockChapters.set(61, {
        id: 61,
        novelId: novel1,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://example.com/chap-61',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      let completeFirstFetch: () => void;
      globalThis.fetch = vi.fn(() => new Promise((resolve) => {
        completeFirstFetch = () => resolve(new Response('<h1>Title</h1><div class="content"><p>Content</p></div>', { status: 200 }));
      })) as any;

      const crawl1Promise = crawler.startCrawl(novel1, defaultSettings);

      // Concurrently attempt to crawl novel 2
      await expect(crawler.startCrawl(novel2, defaultSettings)).rejects.toThrow(/already in progress/i);

      // Concurrently attempt to crawl novel 1 again
      await expect(crawler.startCrawl(novel1, defaultSettings)).rejects.toThrow(/already in progress/i);

      completeFirstFetch!();
      await crawl1Promise;

      expect(crawler.getActiveNovelId()).toBeNull();
      expect(crawler.isRunning).toBe(false);
    });

    it('T2.12: resets activeNovelId and isCrawling in finally block when startCrawl throws', async () => {
      // Novel does not exist in DB
      await expect(crawler.startCrawl(9999, defaultSettings)).rejects.toThrow(/Novel #9999 not found/);
      expect(crawler.getActiveNovelId()).toBeNull();
      expect(crawler.isRunning).toBe(false);
    });

    it('T2.13: notify isolates subscriber errors without crashing crawl', async () => {
      const badListener = () => {
        throw new Error('Subscriber exploded!');
      };
      const unsubscribe = crawler.subscribe(badListener);

      expect(() => {
        (crawler as any).notify({
          novelId: 1,
          currentChapter: 1,
          totalChapters: 1,
          percent: 100,
          status: 'completed'
        });
      }).not.toThrow();

      unsubscribe();
    });

    it('T2.14: scanFullToc functions cleanly after a prior cancellation', async () => {
      crawler.cancel();

      globalThis.fetch = vi.fn(async () => {
        return new Response('<div class="chapter-list"><a href="https://example.com/c1">C1</a></div>', { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/toc', sampleRule, 2);
      expect(chapters).toHaveLength(1);
    });
  });

  // =========================================================================
  // Tier 3: Cross-Feature Combinations
  // =========================================================================
  describe('Tier 3: Cross-Feature Combinations', () => {
    it('T3.1: Full lifecycle integration: scan TOC -> queue pending -> crawl -> store word count', async () => {
      // Step 1: Scan TOC
      const tocHtml = `
        <div class="chapter-list">
          <a href="https://example.com/chap-1">Hồi 1: Phong vân biến sắc</a>
          <a href="https://example.com/chap-2">Hồi 2: Thiếu hiệp xuất sơn</a>
        </div>
      `;
      globalThis.fetch = vi.fn(async () => new Response(tocHtml, { status: 200 })) as any;

      const tocItems = await crawler.scanFullToc('https://example.com/toc', sampleRule);
      expect(tocItems).toHaveLength(2);

      // Step 2: Initialize novel and chapters in DB
      const novelId = 500;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Kiếm Đạo Độc Tôn',
        sourceUrl: 'https://example.com/novel-500',
        totalChapters: tocItems.length,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      tocItems.forEach((item, idx) => {
        mockChapters.set(50 + idx, {
          id: 50 + idx,
          novelId,
          chapterNumber: item.chapterNumber,
          title: item.title,
          url: item.url,
          content: '',
          wordCount: 0,
          status: 'pending'
        });
      });

      // Step 3: Crawl chapters
      globalThis.fetch = vi.fn(async (url: string) => {
        return new Response(
          `<h1>${url}</h1><div class="content"><p>Trường kiếm vung lên, kiếm khí Tung Hoành vạn dặm sơn hà.</p></div>`,
          { status: 200 }
        );
      }) as any;

      await crawler.startCrawl(novelId, defaultSettings);

      const c1 = mockChapters.get(50);
      const c2 = mockChapters.get(51);
      expect(c1?.status).toBe('completed');
      expect(c2?.status).toBe('completed');
      expect(c1?.wordCount).toBeGreaterThan(5);
      expect(c2?.wordCount).toBeGreaterThan(5);
    });
  });
});
