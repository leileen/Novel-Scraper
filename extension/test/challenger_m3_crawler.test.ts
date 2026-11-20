import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Novel, Chapter, AppSettings, SiteRule } from '../lib/types';
import type { CrawlProgressEvent } from '../lib/crawler';

// Hoisted state for DB mocking
const { mockNovels, mockChapters, mockDbHooks, sampleRule } = vi.hoisted(() => {
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

  const mockDbHooks = {
    chaptersWhereShouldThrow: false,
    chaptersWhereError: new Error('Dexie: DatabaseClosedError - simulated catastrophic DB failure'),
    chaptersUpdateHook: null as ((id: number, updates: Partial<Chapter>) => void) | null,
    novelsGetShouldThrow: false,
    novelsGetError: new Error('Dexie: Read failure on novels table')
  };

  return {
    mockNovels: new Map<number, Novel>(),
    mockChapters: new Map<number, Chapter>(),
    mockDbHooks,
    sampleRule
  };
});

vi.mock('../lib/db', () => {
  return {
    db: {
      novels: {
        get: vi.fn(async (id: number) => {
          if (mockDbHooks.novelsGetShouldThrow) {
            throw mockDbHooks.novelsGetError;
          }
          return mockNovels.get(id);
        }),
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
        where: (field: string) => {
          if (mockDbHooks.chaptersWhereShouldThrow) {
            throw mockDbHooks.chaptersWhereError;
          }
          return {
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
          };
        },
        update: vi.fn(async (id: number, updates: Partial<Chapter>) => {
          if (mockDbHooks.chaptersUpdateHook) {
            mockDbHooks.chaptersUpdateHook(id, updates);
          }
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

// Import crawler singleton after mock
import { crawler } from '../lib/crawler';

describe('Milestone 3 Adversarial Challenge: Crawler Concurrency, Lifecycle & Error Boundaries', () => {
  const testSettings: AppSettings = {
    language: 'vi',
    theme: 'dark',
    politeDelayMin: 0.001,
    politeDelayMax: 0.002,
    defaultFormat: 'txt',
    adKeywords: ['Quảng cáo']
  };

  beforeEach(() => {
    mockNovels.clear();
    mockChapters.clear();
    mockDbHooks.chaptersWhereShouldThrow = false;
    mockDbHooks.chaptersUpdateHook = null;
    mockDbHooks.novelsGetShouldThrow = false;

    // Reset crawler internal state
    (crawler as any).isCancelled = false;
    (crawler as any).isPaused = false;
    (crawler as any).isCrawling = false;
    (crawler as any).activeNovelId = null;
    (crawler as any).abortController = null;
    (crawler as any).listeners.clear();

    vi.restoreAllMocks();
  });

  afterEach(() => {
    crawler.cancel();
  });

  // =========================================================================
  // Challenge 1: Concurrency Mutex Lock Stress
  // =========================================================================
  describe('Challenge 1: Concurrency Mutex Lock Stress', () => {
    it('C1.1: Rapid burst of 20 concurrent startCrawl calls for the same novel rejects 19 calls immediately', async () => {
      const novelId = 100;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Novel Mutex Test',
        sourceUrl: 'https://example.com/novel-100',
        totalChapters: 2,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      mockChapters.set(1001, {
        id: 1001,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://example.com/c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });
      mockChapters.set(1002, {
        id: 1002,
        novelId,
        chapterNumber: 2,
        title: 'Chương 2',
        url: 'https://example.com/c2',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      // Slow fetch to keep the crawl active while concurrent calls burst in
      let allowFetchToProceed = false;
      globalThis.fetch = vi.fn(
        () =>
          new Promise((resolve) => {
            const check = () => {
              if (allowFetchToProceed) {
                resolve(new Response('<h1>T</h1><div class="content"><p>Content</p></div>', { status: 200 }));
              } else {
                setTimeout(check, 10);
              }
            };
            check();
          })
      ) as any;

      // Launch 20 concurrent startCrawl calls in parallel
      // We map each promise to capture errors immediately, avoiding unhandled rejection warnings in Node
      const attempts = Array.from({ length: 20 }, async () => {
        try {
          await crawler.startCrawl(novelId, testSettings);
          return { status: 'fulfilled' as const };
        } catch (err) {
          return { status: 'rejected' as const, reason: err as Error };
        }
      });

      // Allow fetch to proceed after registering all calls
      await new Promise((r) => setTimeout(r, 20));
      allowFetchToProceed = true;

      const results = await Promise.all(attempts);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(19);

      // Verify all 19 rejections have the clear concurrency error message
      for (const rej of rejected) {
        if (rej.status === 'rejected') {
          expect(rej.reason.message).toMatch(
            /Crawl already in progress \(active novel #100\)\. Concurrent crawls are not permitted\./
          );
        }
      }

      // Mutex must be unlocked after completion
      expect(crawler.isRunning).toBe(false);
      expect(crawler.getActiveNovelId()).toBeNull();
    });

    it('C1.2: Rapid concurrent startCrawl calls across different novel IDs reject all secondary requests', async () => {
      const novels = [201, 202, 203, 204, 205];
      novels.forEach((id) => {
        mockNovels.set(id, {
          id,
          title: `Novel ${id}`,
          sourceUrl: `https://example.com/novel-${id}`,
          totalChapters: 1,
          downloadedChapters: 0,
          status: 'idle',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        mockChapters.set(id * 10, {
          id: id * 10,
          novelId: id,
          chapterNumber: 1,
          title: `Chương 1 of ${id}`,
          url: `https://example.com/novel-${id}/c1`,
          content: '',
          wordCount: 0,
          status: 'pending'
        });
      });

      let allowFetchToProceed = false;
      globalThis.fetch = vi.fn(
        () =>
          new Promise((resolve) => {
            const check = () => {
              if (allowFetchToProceed) {
                resolve(new Response('<h1>T</h1><div class="content"><p>Content</p></div>', { status: 200 }));
              } else {
                setTimeout(check, 10);
              }
            };
            check();
          })
      ) as any;

      // Concurrently trigger all 5 novels with immediate rejection trapping
      const attempts = novels.map(async (id) => {
        try {
          await crawler.startCrawl(id, testSettings);
          return { status: 'fulfilled' as const };
        } catch (err) {
          return { status: 'rejected' as const, reason: err as Error };
        }
      });

      await new Promise((r) => setTimeout(r, 20));
      allowFetchToProceed = true;

      const results = await Promise.all(attempts);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(4);

      // Verify that rejected calls report the first active novel ID
      for (const rej of rejected) {
        if (rej.status === 'rejected') {
          expect(rej.reason.message).toMatch(/Crawl already in progress/i);
          expect(rej.reason.message).toMatch(/active novel #201/);
        }
      }
    });

    it('C1.3: Mutex releases immediately when startCrawl fails early validation, allowing next crawl to succeed', async () => {
      // Non-existent novel
      await expect(crawler.startCrawl(9999, testSettings)).rejects.toThrow(/Novel #9999 not found/);

      expect(crawler.isRunning).toBe(false);
      expect(crawler.getActiveNovelId()).toBeNull();

      // Immediately initiate valid novel crawl
      const validId = 301;
      mockNovels.set(validId, {
        id: validId,
        title: 'Valid Novel',
        sourceUrl: 'https://example.com/novel-301',
        totalChapters: 0,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      // Should succeed without mutex collision
      await expect(crawler.startCrawl(validId, testSettings)).resolves.not.toThrow();
      expect(crawler.isRunning).toBe(false);
    });

    it('C1.4: isRunning and getActiveNovelId state consistency throughout lifecycle', async () => {
      const novelId = 401;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'State Consistency Novel',
        sourceUrl: 'https://example.com/novel-401',
        totalChapters: 1,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      mockChapters.set(4001, {
        id: 4001,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://example.com/c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      let allowFetch = false;
      globalThis.fetch = vi.fn(
        () =>
          new Promise((resolve) => {
            const check = () => {
              if (allowFetch) {
                resolve(new Response('<h1>T</h1><div class="content"><p>Content</p></div>', { status: 200 }));
              } else {
                setTimeout(check, 10);
              }
            };
            check();
          })
      ) as any;

      expect(crawler.isRunning).toBe(false);
      expect(crawler.getActiveNovelId()).toBeNull();

      const crawlPromise = crawler.startCrawl(novelId, testSettings);

      // Verify active state while running
      expect(crawler.isRunning).toBe(true);
      expect(crawler.getActiveNovelId()).toBe(novelId);

      allowFetch = true;
      await crawlPromise;

      expect(crawler.isRunning).toBe(false);
      expect(crawler.getActiveNovelId()).toBeNull();
    });
  });

  // =========================================================================
  // Challenge 2: AbortController & Instant Cancellation
  // =========================================================================
  describe('Challenge 2: AbortController & Instant Cancellation', () => {
    it('C2.1: Cancellation during in-flight fetch request aborts via signal without retry backoff loops', async () => {
      const novelId = 501;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Abort In-Flight Novel',
        sourceUrl: 'https://example.com/novel-501',
        totalChapters: 1,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      mockChapters.set(5001, {
        id: 5001,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://example.com/c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      let capturedSignal: AbortSignal | undefined;
      let abortTriggered = false;

      globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
        capturedSignal = init?.signal as AbortSignal;
        return new Promise((_, reject) => {
          if (capturedSignal) {
            capturedSignal.addEventListener('abort', () => {
              abortTriggered = true;
              const err = new Error('The user aborted a request.');
              (err as any).name = 'AbortError';
              reject(err);
            });
          }
        });
      }) as any;

      const startTime = Date.now();
      const crawlPromise = crawler.startCrawl(novelId, testSettings);

      // Wait a tick for fetch to be initiated
      await new Promise((r) => setTimeout(r, 20));

      expect(capturedSignal).toBeDefined();
      expect(capturedSignal?.aborted).toBe(false);

      // Issue cancellation while fetch is in-flight
      crawler.cancel();

      await crawlPromise;
      const elapsed = Date.now() - startTime;

      expect(abortTriggered).toBe(true);
      expect(capturedSignal?.aborted).toBe(true);
      // If retries had occurred (with 2000 * retry backoff), elapsed would be > 2000ms
      expect(elapsed).toBeLessThan(1000);

      // Chapter should be marked failed with cancellation message
      const chapter = mockChapters.get(5001);
      expect(chapter?.status).toBe('failed');
      expect(chapter?.errorMessage).toMatch(/bị hủy/);

      // Novel status must be idle
      const novel = mockNovels.get(novelId);
      expect(novel?.status).toBe('idle');

      // State unlocked
      expect(crawler.isRunning).toBe(false);
      expect(crawler.getActiveNovelId()).toBeNull();
    });

    it('C2.2: Cancellation during polite delay: measures delay exit responsiveness', async () => {
      const novelId = 502;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Polite Delay Cancel Novel',
        sourceUrl: 'https://example.com/novel-502',
        totalChapters: 3,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      mockChapters.set(5021, {
        id: 5021,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://example.com/c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });
      mockChapters.set(5022, {
        id: 5022,
        novelId,
        chapterNumber: 2,
        title: 'Chương 2',
        url: 'https://example.com/c2',
        content: '',
        wordCount: 0,
        status: 'pending'
      });
      mockChapters.set(5023, {
        id: 5023,
        novelId,
        chapterNumber: 3,
        title: 'Chương 3',
        url: 'https://example.com/c3',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      globalThis.fetch = vi.fn(
        async () => new Response('<h1>Chương</h1><div class="content"><p>Content</p></div>', { status: 200 })
      ) as any;

      // Configure a noticeable polite delay (e.g., 2.0s to 2.0s)
      const settingsWithDelay: AppSettings = {
        ...testSettings,
        politeDelayMin: 2.0,
        politeDelayMax: 2.0
      };

      const crawlPromise = crawler.startCrawl(novelId, settingsWithDelay);

      // Wait 100ms: chapter 1 completes, enters polite delay (2000ms)
      await new Promise((r) => setTimeout(r, 100));

      const cancelTime = Date.now();
      crawler.cancel();

      await crawlPromise;
      const elapsedSinceCancel = Date.now() - cancelTime;

      // EMPIRICAL OBSERVATION:
      // Does startCrawl exit immediately upon cancel during polite delay (<500ms),
      // or does it block for the full 2000ms delay?
      console.log(`[C2.2 Empirical Result] Time from cancel() during polite delay to crawl exit: ${elapsedSinceCancel}ms`);

      expect(crawler.isRunning).toBe(false);
      expect(crawler.getActiveNovelId()).toBeNull();
      expect(mockNovels.get(novelId)?.status).toBe('idle');

      // Requirement: "Cancel during polite delay setTimeout; verify immediate exit."
      // If polite delay does not abort on signal, elapsedSinceCancel will be ~1900ms (> 500ms)
      expect(elapsedSinceCancel).toBeLessThan(500);
    });

    it('C2.2b: Calling startCrawl immediately after cancelling during polite delay must not be blocked by lingering mutex', async () => {
      const novelA = 511;
      const novelB = 512;

      [novelA, novelB].forEach((id) => {
        mockNovels.set(id, {
          id,
          title: `Novel ${id}`,
          sourceUrl: `https://example.com/novel-${id}`,
          totalChapters: 2,
          downloadedChapters: 0,
          status: 'idle',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      });

      mockChapters.set(5111, {
        id: 5111,
        novelId: novelA,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://example.com/c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });
      mockChapters.set(5112, {
        id: 5112,
        novelId: novelA,
        chapterNumber: 2,
        title: 'Chương 2',
        url: 'https://example.com/c2',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      globalThis.fetch = vi.fn(
        async () => new Response('<h1>Chương</h1><div class="content"><p>Content</p></div>', { status: 200 })
      ) as any;

      const settingsWithDelay: AppSettings = {
        ...testSettings,
        politeDelayMin: 2.0,
        politeDelayMax: 2.0
      };

      const crawlAPromise = crawler.startCrawl(novelA, settingsWithDelay);

      // Wait 100ms: chapter 1 completes, enters 2000ms polite delay
      await new Promise((r) => setTimeout(r, 100));

      // User clicks cancel
      crawler.cancel();

      // Immediately (10ms later) try to start crawling novel B
      await new Promise((r) => setTimeout(r, 10));

      // If cancel did not instantly abort the polite delay, crawler.isCrawling is still true
      // and activeNovelId is still novelA, causing startCrawl(novelB) to be rejected!
      await expect(crawler.startCrawl(novelB, testSettings)).resolves.not.toThrow();

      await crawlAPromise;
    });

    it('C2.3: Cancellation while crawler is paused exits pause loop without hanging', async () => {
      const novelId = 503;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Pause Cancel Novel',
        sourceUrl: 'https://example.com/novel-503',
        totalChapters: 2,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      mockChapters.set(5031, {
        id: 5031,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://example.com/c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });
      mockChapters.set(5032, {
        id: 5032,
        novelId,
        chapterNumber: 2,
        title: 'Chương 2',
        url: 'https://example.com/c2',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      let pauseTriggered = false;
      globalThis.fetch = vi.fn(async () => {
        if (!pauseTriggered) {
          pauseTriggered = true;
          // Trigger pause after chapter 1 is fetched so it enters the pause loop on chapter 2
          crawler.pause();
        }
        return new Response('<h1>Chương</h1><div class="content"><p>Content</p></div>', { status: 200 });
      }) as any;

      const crawlPromise = crawler.startCrawl(novelId, testSettings);

      // Wait until pause loop is active
      await new Promise((r) => setTimeout(r, 80));

      // Cancel while paused
      crawler.cancel();

      await crawlPromise;

      expect(crawler.isRunning).toBe(false);
      expect(crawler.getActiveNovelId()).toBeNull();
      expect(mockNovels.get(novelId)?.status).toBe('idle');
    });

    it('C2.4: Immediate subsequent startCrawl after cancellation succeeds without mutex lockout', async () => {
      const novelId1 = 504;
      const novelId2 = 505;

      [novelId1, novelId2].forEach((id) => {
        mockNovels.set(id, {
          id,
          title: `Novel ${id}`,
          sourceUrl: `https://example.com/novel-${id}`,
          totalChapters: 0,
          downloadedChapters: 0,
          status: 'idle',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      });

      // Start and cancel novel 1
      crawler.cancel();
      expect(crawler.isRunning).toBe(false);

      // Start novel 2 immediately
      await expect(crawler.startCrawl(novelId2, testSettings)).resolves.not.toThrow();
      expect(crawler.isRunning).toBe(false);
    });

    it('C2.5: scanFullToc in-flight fetch passes AbortSignal so cancellation can terminate hanging TOC fetches', async () => {
      let capturedSignal: AbortSignal | undefined;
      globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
        capturedSignal = init?.signal as AbortSignal;
        return new Promise((_, reject) => {
          if (capturedSignal) {
            capturedSignal.addEventListener('abort', () => {
              const err = new Error('The user aborted a request.');
              (err as any).name = 'AbortError';
              reject(err);
            });
          }
        });
      }) as any;

      const tocPromise = crawler.scanFullToc('https://example.com/toc', sampleRule, 5);
      await new Promise((r) => setTimeout(r, 20));

      crawler.cancel();

      // EMPIRICAL OBSERVATION:
      // Does scanFullToc pass signal to fetch(currentUrl, { credentials: 'include', signal })?
      // In lib/crawler/index.ts: line 113 is:
      // const res = await fetch(currentUrl, { credentials: 'include' });
      // It does NOT pass signal, so capturedSignal is undefined!
      console.log(`[C2.5 Empirical Result] scanFullToc passed signal to fetch: ${capturedSignal !== undefined}`);
      expect(capturedSignal).toBeDefined();
      await tocPromise;
    });
  });

  // =========================================================================
  // Challenge 3: Resource Cleanup & Finally Guard
  // =========================================================================
  describe('Challenge 3: Resource Cleanup & Finally Guard', () => {
    it('C3.1: Severe database failure during chapter query releases mutex and allows subsequent crawl', async () => {
      const novelId = 601;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'DB Crash Novel',
        sourceUrl: 'https://example.com/novel-601',
        totalChapters: 5,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      // Enable catastrophic failure on db.chapters.where
      mockDbHooks.chaptersWhereShouldThrow = true;

      const events: CrawlProgressEvent[] = [];
      const unsub = crawler.subscribe((e) => events.push(e));

      await expect(crawler.startCrawl(novelId, testSettings)).rejects.toThrow(
        /Dexie: DatabaseClosedError/
      );

      unsub();

      // Verify that crawler state is completely cleaned up
      expect(crawler.isRunning).toBe(false);
      expect(crawler.getActiveNovelId()).toBeNull();

      // Verify error notification was dispatched
      const errorEvent = events.find((e) => e.status === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.errorMessage).toMatch(/Dexie: DatabaseClosedError/);

      // Disable the DB error and verify subsequent crawl succeeds
      mockDbHooks.chaptersWhereShouldThrow = false;
      const recoveryNovelId = 602;
      mockNovels.set(recoveryNovelId, {
        id: recoveryNovelId,
        title: 'Recovery Novel',
        sourceUrl: 'https://example.com/novel-602',
        totalChapters: 0,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      await expect(crawler.startCrawl(recoveryNovelId, testSettings)).resolves.not.toThrow();
      expect(crawler.isRunning).toBe(false);
    });

    it('C3.2: Severe database failure during db.novels.get releases mutex in finally block', async () => {
      mockDbHooks.novelsGetShouldThrow = true;

      await expect(crawler.startCrawl(603, testSettings)).rejects.toThrow(
        /Dexie: Read failure on novels table/
      );

      expect(crawler.isRunning).toBe(false);
      expect(crawler.getActiveNovelId()).toBeNull();
    });
  });

  // =========================================================================
  // Challenge 4: UI Subscriber Error Isolation
  // =========================================================================
  describe('Challenge 4: UI Subscriber Error Isolation', () => {
    it('C4.1: Multiple throwing listeners do not crash the engine and surviving listeners receive all events', async () => {
      const novelId = 701;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Subscriber Isolation Novel',
        sourceUrl: 'https://example.com/novel-701',
        totalChapters: 2,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      mockChapters.set(7011, {
        id: 7011,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://example.com/c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });
      mockChapters.set(7012, {
        id: 7012,
        novelId,
        chapterNumber: 2,
        title: 'Chương 2',
        url: 'https://example.com/c2',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      globalThis.fetch = vi.fn(
        async () => new Response('<h1>T</h1><div class="content"><p>Content</p></div>', { status: 200 })
      ) as any;

      const receivedByListener2: CrawlProgressEvent[] = [];
      const receivedByListener4: CrawlProgressEvent[] = [];

      // Listener 1: Throws generic Error
      crawler.subscribe(() => {
        throw new Error('Subscriber 1 Boom!');
      });

      // Listener 2: Healthy
      crawler.subscribe((e) => {
        receivedByListener2.push({ ...e });
      });

      // Listener 3: Throws string
      crawler.subscribe(() => {
        throw 'Subscriber 3 String Rejection!';
      });

      // Listener 4: Healthy
      crawler.subscribe((e) => {
        receivedByListener4.push({ ...e });
      });

      // Listener 5: Throws TypeError
      crawler.subscribe(() => {
        throw new TypeError('Subscriber 5 Type Error: undefined is not a function');
      });

      // The crawl should complete cleanly without throwing
      await expect(crawler.startCrawl(novelId, testSettings)).resolves.not.toThrow();

      // Verify that both healthy listeners received all progress lifecycle events
      expect(receivedByListener2.length).toBeGreaterThanOrEqual(3);
      expect(receivedByListener4.length).toBeGreaterThanOrEqual(3);

      const lastEvent2 = receivedByListener2[receivedByListener2.length - 1];
      const lastEvent4 = receivedByListener4[receivedByListener4.length - 1];

      expect(lastEvent2.status).toBe('completed');
      expect(lastEvent4.status).toBe('completed');
      expect(lastEvent2.percent).toBe(100);
      expect(lastEvent4.percent).toBe(100);
    });

    it('C4.2: Self-unsubscribing listener during notification does not break remaining subscribers', async () => {
      const novelId = 702;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Self Unsub Novel',
        sourceUrl: 'https://example.com/novel-702',
        totalChapters: 1,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      mockChapters.set(7021, {
        id: 7021,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://example.com/c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      globalThis.fetch = vi.fn(
        async () => new Response('<h1>T</h1><div class="content"><p>Content</p></div>', { status: 200 })
      ) as any;

      let unsubSelf: (() => void) | null = null;
      let selfCallCount = 0;
      let peerCallCount = 0;

      unsubSelf = crawler.subscribe(() => {
        selfCallCount++;
        if (unsubSelf) unsubSelf();
      });

      crawler.subscribe(() => {
        peerCallCount++;
      });

      await crawler.startCrawl(novelId, testSettings);

      // Self unsubscriber called once on first event, then unsubscribed
      expect(selfCallCount).toBe(1);
      // Peer listener called on all events
      expect(peerCallCount).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // Challenge 5: Per-Chapter Error Boundary
  // =========================================================================
  describe('Challenge 5: Per-Chapter Error Boundary', () => {
    it('C5.1: Corrupt chapter persistence throws; chapter marked failed and remaining chapters continue to completion', async () => {
      const novelId = 801;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Corrupt Chapter Novel',
        sourceUrl: 'https://example.com/novel-801',
        totalChapters: 3,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      mockChapters.set(8011, {
        id: 8011,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1 (Tốt)',
        url: 'https://example.com/c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });
      mockChapters.set(8012, {
        id: 8012,
        novelId,
        chapterNumber: 2,
        title: 'Chương 2 (Hỏng)',
        url: 'https://example.com/c2',
        content: '',
        wordCount: 0,
        status: 'pending'
      });
      mockChapters.set(8013, {
        id: 8013,
        novelId,
        chapterNumber: 3,
        title: 'Chương 3 (Tốt)',
        url: 'https://example.com/c3',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      globalThis.fetch = vi.fn(
        async () => new Response('<h1>T</h1><div class="content"><p>Content text</p></div>', { status: 200 })
      ) as any;

      // Simulate persistence failure ONLY when updating chapter 8012 with content
      mockDbHooks.chaptersUpdateHook = (id, updates) => {
        if (id === 8012 && updates.content !== undefined) {
          throw new Error('Dexie: QuotaExceededError - Payload exceeded browser storage limit');
        }
      };

      await crawler.startCrawl(novelId, testSettings);

      const c1 = mockChapters.get(8011);
      const c2 = mockChapters.get(8012);
      const c3 = mockChapters.get(8013);

      // Chapter 1 succeeded
      expect(c1?.status).toBe('completed');
      expect(c1?.content).toContain('Content text');

      // Chapter 2 caught by per-chapter error boundary, marked failed with error message
      expect(c2?.status).toBe('failed');
      expect(c2?.errorMessage).toMatch(/QuotaExceededError/);

      // Chapter 3 was not abandoned — crawled and completed!
      expect(c3?.status).toBe('completed');
      expect(c3?.content).toContain('Content text');

      // Novel completed overall with 2 downloaded chapters
      const novel = mockNovels.get(novelId);
      expect(novel?.status).toBe('completed');
      expect(novel?.downloadedChapters).toBe(2);
    });

    it('C5.2: Network 404 on chapter 1 marks chapter failed while chapter 2 succeeds', async () => {
      const novelId = 802;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'HTTP 404 Novel',
        sourceUrl: 'https://example.com/novel-802',
        totalChapters: 2,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      mockChapters.set(8021, {
        id: 8021,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1 (404)',
        url: 'https://example.com/missing-404',
        content: '',
        wordCount: 0,
        status: 'pending'
      });
      mockChapters.set(8022, {
        id: 8022,
        novelId,
        chapterNumber: 2,
        title: 'Chương 2 (200)',
        url: 'https://example.com/ok-200',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      globalThis.fetch = vi.fn(async (url: string) => {
        if (url.includes('missing-404')) {
          return new Response('Not Found', { status: 404, statusText: 'Not Found' });
        }
        return new Response('<h1>T</h1><div class="content"><p>Ok content</p></div>', { status: 200 });
      }) as any;

      await crawler.startCrawl(novelId, testSettings);

      const c1 = mockChapters.get(8021);
      const c2 = mockChapters.get(8022);

      expect(c1?.status).toBe('failed');
      expect(c1?.errorMessage).toMatch(/HTTP 404/);

      expect(c2?.status).toBe('completed');
      expect(c2?.content).toContain('Ok content');

      expect(mockNovels.get(novelId)?.status).toBe('completed');
      expect(mockNovels.get(novelId)?.downloadedChapters).toBe(1);
    });

    it('C5.3: Double failure in chapter error handler (both update and failure log throw) is caught without crashing crawl', async () => {
      const novelId = 803;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Double Failure Novel',
        sourceUrl: 'https://example.com/novel-803',
        totalChapters: 2,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      mockChapters.set(8031, {
        id: 8031,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1 (Double Fail)',
        url: 'https://example.com/c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });
      mockChapters.set(8032, {
        id: 8032,
        novelId,
        chapterNumber: 2,
        title: 'Chương 2 (Survives)',
        url: 'https://example.com/c2',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      globalThis.fetch = vi.fn(
        async () => new Response('<h1>T</h1><div class="content"><p>Content</p></div>', { status: 200 })
      ) as any;

      // Chapter 8031 throws on ANY update (both initial update and failure update)
      mockDbHooks.chaptersUpdateHook = (id) => {
        if (id === 8031) {
          throw new Error('Dexie: Fatal write error on chapter 8031');
        }
      };

      // Despite chapter 8031 failing completely on all writes, chapter 8032 must still crawl!
      await expect(crawler.startCrawl(novelId, testSettings)).resolves.not.toThrow();

      const c2 = mockChapters.get(8032);
      expect(c2?.status).toBe('completed');
      expect(c2?.content).toContain('Content');
    });
  });
});
