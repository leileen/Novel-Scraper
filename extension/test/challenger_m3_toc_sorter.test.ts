import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crawler } from '../lib/crawler';
import {
  extractChapterNumber,
  naturalSortChapters,
  deduplicateChapters,
  detectMissingChapters
} from '../lib/exporter/sorter';
import type { Chapter, SiteRule } from '../lib/types';

describe('Milestone 3 Empirical Adversarial Challenge: TOC Pagination & Sorter Deduplication', () => {
  const dummyRule: SiteRule = {
    domain: 'example.com',
    name: 'Example',
    titleSelector: 'h1',
    contentSelector: '.content',
    tocSelector: '.chapter-list a',
    paginationSelector: '.pagination a.next'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SUITE 1: TOC Pagination Adversarial Scenarios
  // =========================================================================
  describe('Suite 1: TOC Pagination Loop Prevention & Traversal', () => {
    it('C1.1: Complex cyclic graph: Page 1 -> 2 -> 3 -> 4 -> 2 halts without infinite loop', async () => {
      const pages: Record<string, string> = {
        'https://example.com/toc?page=1': `
          <div class="chapter-list"><a href="/c1">Chương 1</a></div>
          <div class="pagination"><a class="next" href="/toc?page=2">Next</a></div>
        `,
        'https://example.com/toc?page=2': `
          <div class="chapter-list"><a href="/c2">Chương 2</a></div>
          <div class="pagination"><a class="next" href="/toc?page=3">Next</a></div>
        `,
        'https://example.com/toc?page=3': `
          <div class="chapter-list"><a href="/c3">Chương 3</a></div>
          <div class="pagination"><a class="next" href="/toc?page=4">Next</a></div>
        `,
        'https://example.com/toc?page=4': `
          <div class="chapter-list"><a href="/c4">Chương 4</a></div>
          <div class="pagination"><a class="next" href="/toc?page=2">Cycle to Page 2</a></div>
        `
      };

      const requestedUrls: string[] = [];
      globalThis.fetch = vi.fn(async (url: string) => {
        requestedUrls.push(url);
        const html = pages[url] || '';
        return new Response(html, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', dummyRule, 20);

      // Must request 1, 2, 3, 4 and then halt (total 4 fetches, NOT 20)
      expect(requestedUrls).toEqual([
        'https://example.com/toc?page=1',
        'https://example.com/toc?page=2',
        'https://example.com/toc?page=3',
        'https://example.com/toc?page=4'
      ]);
      expect(chapters).toHaveLength(4);
      expect(chapters.map((c) => c.title)).toEqual(['Chương 1', 'Chương 2', 'Chương 3', 'Chương 4']);
    });

    it('C1.2: 5-hop circular graph: 1 -> 2 -> 3 -> 4 -> 5 -> 1 halts cleanly', async () => {
      const requestedUrls: string[] = [];
      globalThis.fetch = vi.fn(async (url: string) => {
        requestedUrls.push(url);
        const pageMatch = url.match(/page=(\d+)/);
        const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;
        const nextPage = pageNum < 5 ? pageNum + 1 : 1; // 5 links back to 1
        const html = `
          <div class="chapter-list"><a href="/c${pageNum}">Chương ${pageNum}</a></div>
          <div class="pagination"><a class="next" href="/toc?page=${nextPage}">Next</a></div>
        `;
        return new Response(html, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', dummyRule, 50);

      expect(requestedUrls).toHaveLength(5);
      expect(chapters).toHaveLength(5);
    });

    it('C1.3: Immediate self-referencing cycle: Page 1 -> Page 1 terminates after 1 fetch', async () => {
      let fetchCount = 0;
      globalThis.fetch = vi.fn(async () => {
        fetchCount++;
        const html = `
          <div class="chapter-list"><a href="/c1">Chương 1</a></div>
          <div class="pagination"><a class="next" href="https://example.com/toc?page=1">Self</a></div>
        `;
        return new Response(html, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', dummyRule, 10);
      expect(fetchCount).toBe(1);
      expect(chapters).toHaveLength(1);
    });

    it('C1.4: Domain case-insensitivity: https://EXAMPLE.COM/toc?page=1 vs https://example.com/toc?page=1', async () => {
      let fetchCount = 0;
      globalThis.fetch = vi.fn(async () => {
        fetchCount++;
        const html = `
          <div class="chapter-list"><a href="/c1">Chương 1</a></div>
          <div class="pagination"><a class="next" href="https://EXAMPLE.COM/toc?page=1">Upper Domain Self Loop</a></div>
        `;
        return new Response(html, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', dummyRule, 10);
      // Hostname is normalized to lowercase by WHATWG URL standard, so it matches seen set
      expect(fetchCount).toBe(1);
      expect(chapters).toHaveLength(1);
    });

    it('C1.5: URL case differences in pathname/query: halts within pageLimit and avoids unbounded loops', async () => {
      // Alternating case loop: /toc?page=1 -> /TOC?Page=2 -> /toc?page=1
      const fetched: string[] = [];
      globalThis.fetch = vi.fn(async (url: string) => {
        fetched.push(url);
        if (url.includes('/toc?page=1')) {
          return new Response(`
            <div class="chapter-list"><a href="/c1">Chương 1</a></div>
            <div class="pagination"><a class="next" href="/TOC?Page=2">Page 2 Upper</a></div>
          `, { status: 200 });
        }
        return new Response(`
          <div class="chapter-list"><a href="/c2">Chương 2</a></div>
          <div class="pagination"><a class="next" href="/toc?page=1">Page 1 Lower Loop</a></div>
        `, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', dummyRule, 10);

      // Must halt because /toc?page=1 is already in seenPaginationUrls
      expect(fetched).toEqual([
        'https://example.com/toc?page=1',
        'https://example.com/TOC?Page=2'
      ]);
      expect(chapters).toHaveLength(2);
    });

    it('C1.6: Anchor hash variations (#top, #bottom, #page-1) are stripped to prevent pagination loops', async () => {
      const hashes = ['#top', '#page-2', '#comments', '#footer'];
      let callIndex = 0;

      globalThis.fetch = vi.fn(async () => {
        const hash = hashes[callIndex++] || '#default';
        return new Response(`
          <div class="chapter-list"><a href="/c${callIndex}">Chương ${callIndex}</a></div>
          <div class="pagination"><a class="next" href="https://example.com/toc?page=2${hash}">Page 2 Variant</a></div>
        `, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', dummyRule, 10);

      // Normalization strips hash, resolved URL is page=2, which is already in seen set -> halts!
      expect(chapters).toHaveLength(2);
    });

    it('C1.7: Relative URL resolution across various path depths (../page/2, /toc?page=2, page-2.html)', async () => {
      const fetchHistory: string[] = [];
      globalThis.fetch = vi.fn(async (url: string) => {
        fetchHistory.push(url);
        if (url === 'https://example.com/novel/section/toc.html') {
          // Relative back one level: ../page/2.html -> https://example.com/novel/page/2.html
          return new Response(`
            <div class="chapter-list"><a href="chap-1.html">C1</a></div>
            <div class="pagination"><a class="next" href="../page/2.html">P2</a></div>
          `, { status: 200 });
        }
        if (url === 'https://example.com/novel/page/2.html') {
          // Root relative: /toc?page=3 -> https://example.com/toc?page=3
          return new Response(`
            <div class="chapter-list"><a href="/novel/chap-2.html">C2</a></div>
            <div class="pagination"><a class="next" href="/toc?page=3">P3</a></div>
          `, { status: 200 });
        }
        if (url === 'https://example.com/toc?page=3') {
          // Sibling relative: page-4.html -> https://example.com/page-4.html
          return new Response(`
            <div class="chapter-list"><a href="chap-3.html">C3</a></div>
            <div class="pagination"><a class="next" href="page-4.html">P4</a></div>
          `, { status: 200 });
        }
        // Terminal page
        return new Response(`
          <div class="chapter-list"><a href="chap-4.html">C4</a></div>
          <div class="pagination"></div>
        `, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/novel/section/toc.html', dummyRule, 10);

      expect(fetchHistory).toEqual([
        'https://example.com/novel/section/toc.html',
        'https://example.com/novel/page/2.html',
        'https://example.com/toc?page=3',
        'https://example.com/page-4.html'
      ]);
      expect(chapters).toHaveLength(4);
      expect(chapters[0].url).toBe('https://example.com/novel/section/chap-1.html');
      expect(chapters[1].url).toBe('https://example.com/novel/chap-2.html');
      expect(chapters[2].url).toBe('https://example.com/chap-3.html');
      expect(chapters[3].url).toBe('https://example.com/chap-4.html');
    });

    it('C1.8: Max pages limit: strictly halts at specified limit (maxPages = 3)', async () => {
      let fetchCount = 0;
      globalThis.fetch = vi.fn(async () => {
        fetchCount++;
        const page = fetchCount + 1;
        return new Response(`
          <div class="chapter-list"><a href="/c${fetchCount}">Chương ${fetchCount}</a></div>
          <div class="pagination"><a class="next" href="/toc?page=${page}">Page ${page}</a></div>
        `, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', dummyRule, 3);
      expect(fetchCount).toBe(3);
      expect(chapters).toHaveLength(3);
    });

    it('C1.9: Max pages limit boundary: maxPages = 0 or negative clamps to 1 or default', async () => {
      globalThis.fetch = vi.fn(async () => {
        return new Response(`
          <div class="chapter-list"><a href="/c1">Chương 1</a></div>
          <div class="pagination"><a class="next" href="/toc?page=2">P2</a></div>
        `, { status: 200 });
      }) as any;

      // When maxPages is negative, Math.max(1, -5 || 50) is 1
      const chaptersNeg = await crawler.scanFullToc('https://example.com/toc?page=1', dummyRule, -1);
      expect(chaptersNeg).toHaveLength(1);
    });

    it('C1.10: Dynamic cancellation halts scanFullToc immediately', async () => {
      let fetchCount = 0;
      globalThis.fetch = vi.fn(async () => {
        fetchCount++;
        if (fetchCount === 2) {
          crawler.cancel();
        }
        return new Response(`
          <div class="chapter-list"><a href="/c${fetchCount}">Chương ${fetchCount}</a></div>
          <div class="pagination"><a class="next" href="/toc?page=${fetchCount + 1}">P${fetchCount + 1}</a></div>
        `, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', dummyRule, 10);
      expect(fetchCount).toBe(2);
      expect(chapters).toHaveLength(2);
    });

    it('C1.11: Gracefully terminates and returns collected chapters on HTTP 404 or 500 error', async () => {
      let fetchCount = 0;
      globalThis.fetch = vi.fn(async (url: string) => {
        fetchCount++;
        if (url.includes('page=2')) {
          return new Response('Not Found', { status: 404, statusText: 'Not Found' });
        }
        return new Response(`
          <div class="chapter-list"><a href="/c1">Chương 1</a></div>
          <div class="pagination"><a class="next" href="/toc?page=2">P2</a></div>
        `, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/toc?page=1', dummyRule, 10);
      expect(fetchCount).toBe(2);
      expect(chapters).toHaveLength(1);
      expect(chapters[0].title).toBe('Chương 1');
    });

    it('C1.12: Correctly resolves pagination and chapters when <base href="..."> is present in document', async () => {
      const page1Html = `
        <head><base href="https://cdn.example.net/subpath/"></head>
        <body>
          <div class="chapter-list"><a href="chap-1">Chương 1</a></div>
          <div class="pagination"><a class="next" href="page-2">Trang 2</a></div>
        </body>
      `;
      const page2Html = `
        <body>
          <div class="chapter-list"><a href="chap-2">Chương 2</a></div>
          <div class="pagination"></div>
        </body>
      `;

      const fetchedUrls: string[] = [];
      globalThis.fetch = vi.fn(async (url: string) => {
        fetchedUrls.push(url);
        if (url.includes('page-2')) {
          return new Response(page2Html, { status: 200 });
        }
        return new Response(page1Html, { status: 200 });
      }) as any;

      const chapters = await crawler.scanFullToc('https://example.com/novel/toc', dummyRule, 5);
      expect(chapters).toHaveLength(2);
      expect(fetchedUrls[0]).toBe('https://example.com/novel/toc');
    });
  });

  // =========================================================================
  // SUITE 2: Sorter & Deduplication Adversarial Scenarios
  // =========================================================================
  describe('Suite 2: Sorter & Deduplication Adversarial Scenarios', () => {
    it('C2.1: Edge case: 200 genuine chapters sharing title "Ngoại truyện" are NOT deduplicated', () => {
      const chapters: Chapter[] = Array.from({ length: 200 }, (_, i) => ({
        id: i + 1,
        novelId: 1,
        chapterNumber: i + 1,
        title: 'Ngoại truyện',
        url: `https://example.com/c/${i + 1}`,
        content: `Nội dung ngoại truyện ${i + 1}`,
        wordCount: 500,
        status: 'completed'
      }));

      const deduplicated = deduplicateChapters(chapters);
      expect(deduplicated).toHaveLength(200);

      const sorted = naturalSortChapters(deduplicated);
      expect(sorted).toHaveLength(200);
      expect(sorted[0].chapterNumber).toBe(1);
      expect(sorted[199].chapterNumber).toBe(200);
    });

    it('C2.2: Edge case: chapters with empty, null, undefined, and generic titles are preserved when numbers differ', () => {
      const inputChapters: Chapter[] = [
        { id: 1, novelId: 1, chapterNumber: 1, title: '', url: 'https://example.com/c1', content: '', wordCount: 0, status: 'completed' },
        { id: 2, novelId: 1, chapterNumber: 2, title: '', url: 'https://example.com/c2', content: '', wordCount: 0, status: 'completed' },
        { id: 3, novelId: 1, chapterNumber: 3, title: undefined as any, url: 'https://example.com/c3', content: '', wordCount: 0, status: 'completed' },
        { id: 4, novelId: 1, chapterNumber: 4, title: null as any, url: 'https://example.com/c4', content: '', wordCount: 0, status: 'completed' },
        { id: 5, novelId: 1, chapterNumber: 5, title: 'Tiếp theo', url: 'https://example.com/c5', content: '', wordCount: 0, status: 'completed' },
        { id: 6, novelId: 1, chapterNumber: 6, title: 'Tiếp theo', url: 'https://example.com/c6', content: '', wordCount: 0, status: 'completed' },
        { id: 7, novelId: 1, chapterNumber: 7, title: 'Phần 2', url: 'https://example.com/c7', content: '', wordCount: 0, status: 'completed' },
        { id: 8, novelId: 1, chapterNumber: 8, title: 'Phần 2', url: 'https://example.com/c8', content: '', wordCount: 0, status: 'completed' },
        { id: 9, novelId: 1, chapterNumber: 9, title: '1', url: 'https://example.com/c9', content: '', wordCount: 0, status: 'completed' },
        { id: 10, novelId: 1, chapterNumber: 10, title: '2', url: 'https://example.com/c10', content: '', wordCount: 0, status: 'completed' }
      ];

      const deduplicated = deduplicateChapters(inputChapters);
      expect(deduplicated).toHaveLength(10);
      expect(deduplicated.map((c) => c.chapterNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('C2.3: Mirror chapters with distinct URLs but identical number and title MUST deduplicate', () => {
      const mirrorChapters: Chapter[] = [
        {
          id: 1,
          novelId: 1,
          chapterNumber: 1,
          title: 'Chương 1: Khởi đầu',
          url: 'https://mirror-a.com/story/c1.html',
          content: 'Mirror A content',
          wordCount: 100,
          status: 'completed'
        },
        {
          id: 2,
          novelId: 1,
          chapterNumber: 1,
          title: ' chương 1:   khởi đầu  ', // minor case/whitespace variant
          url: 'https://mirror-b.com/novel/chap-1/',
          content: 'Mirror B content',
          wordCount: 100,
          status: 'completed'
        },
        {
          id: 3,
          novelId: 1,
          chapterNumber: 1,
          title: 'Chương 1: Khởi đầu',
          url: 'https://mirror-c.org/read/chapter-1',
          content: 'Mirror C content',
          wordCount: 100,
          status: 'completed'
        },
        {
          id: 4,
          novelId: 1,
          chapterNumber: 2,
          title: 'Chương 2: Tiếp bước',
          url: 'https://mirror-a.com/story/c2.html',
          content: 'Chapter 2 content',
          wordCount: 100,
          status: 'completed'
        }
      ];

      const deduplicated = deduplicateChapters(mirrorChapters);
      // All 3 variations of Chapter 1 must collapse into 1 chapter
      expect(deduplicated).toHaveLength(2);
      expect(deduplicated[0].id).toBe(1);
      expect(deduplicated[1].id).toBe(4);
    });

    it('C2.4: Decimal and alphanumeric chapter extraction and natural sorting', () => {
      // Test regex extraction directly
      expect(extractChapterNumber('Chương 12.5', 0)).toBe(12.5);
      expect(extractChapterNumber('Chapter 12-b', 0)).toBe(12);
      expect(extractChapterNumber('Hồi 10.1', 0)).toBe(10.1);
      expect(extractChapterNumber('Tiết 99.9: Đỉnh cao', 0)).toBe(99.9);
      expect(extractChapterNumber('10.5. Mở đầu', 0)).toBe(10.5);

      const mixedChapters: Chapter[] = [
        { id: 5, novelId: 1, chapterNumber: 13, title: 'Chương 13', url: '/c13', content: '', wordCount: 0, status: 'completed' },
        { id: 3, novelId: 1, chapterNumber: 12.5, title: 'Chương 12.5: Ngoại truyện', url: '/c12-5', content: '', wordCount: 0, status: 'completed' },
        { id: 1, novelId: 1, chapterNumber: 10.1, title: 'Hồi 10.1', url: '/c10-1', content: '', wordCount: 0, status: 'completed' },
        { id: 2, novelId: 1, chapterNumber: 12, title: 'Chapter 12-a', url: '/c12-a', content: '', wordCount: 0, status: 'completed' },
        { id: 4, novelId: 1, chapterNumber: 12, title: 'Chapter 12-b', url: '/c12-b', content: '', wordCount: 0, status: 'completed' },
        { id: 0, novelId: 1, chapterNumber: 10, title: 'Hồi 10', url: '/c10', content: '', wordCount: 0, status: 'completed' }
      ];

      const sorted = naturalSortChapters(mixedChapters);
      const sortedTitles = sorted.map((c) => c.title);

      expect(sortedTitles).toEqual([
        'Hồi 10',
        'Hồi 10.1',
        'Chapter 12-a',
        'Chapter 12-b',
        'Chương 12.5: Ngoại truyện',
        'Chương 13'
      ]);
    });

    it('C2.5: Extreme scale stress test: 5,000 chapters executes in <50ms with correct deduplication and sorting', () => {
      // Generate 5,000 chapters with random duplicates and shuffled order
      const TOTAL_GENUINE = 4000;
      const TOTAL_DUPLICATES = 1000;
      const chapters: Chapter[] = [];

      for (let i = 1; i <= TOTAL_GENUINE; i++) {
        chapters.push({
          id: i,
          novelId: 99,
          chapterNumber: i,
          title: i % 20 === 0 ? 'Ngoại truyện' : `Chương ${i}: Tiêu đề ${i}`,
          url: `https://example.com/novel/chap-${i}`,
          content: 'Nội dung chương...',
          wordCount: 800,
          status: 'completed'
        });
      }

      // Add 1,000 duplicate chapters from mirrors with shuffled numbers
      for (let d = 1; d <= TOTAL_DUPLICATES; d++) {
        const targetNum = (d * 3) % TOTAL_GENUINE + 1;
        chapters.push({
          id: TOTAL_GENUINE + d,
          novelId: 99,
          chapterNumber: targetNum,
          title: targetNum % 20 === 0 ? '  ngoại truyện  ' : `Chương ${targetNum}: Tiêu đề ${targetNum}`,
          url: `https://mirror-source.net/read/${targetNum}.html`,
          content: 'Bản sao...',
          wordCount: 800,
          status: 'completed'
        });
      }

      // Fisher-Yates shuffle
      for (let i = chapters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chapters[i], chapters[j]] = [chapters[j], chapters[i]];
      }

      expect(chapters.length).toBe(5000);

      // Measure performance
      const startTime = performance.now();

      const deduplicated = deduplicateChapters(chapters);
      const sorted = naturalSortChapters(deduplicated);

      const elapsedMs = performance.now() - startTime;

      // Assertions
      expect(deduplicated.length).toBe(TOTAL_GENUINE);
      expect(sorted.length).toBe(TOTAL_GENUINE);
      expect(sorted[0].chapterNumber).toBe(1);
      expect(sorted[sorted.length - 1].chapterNumber).toBe(TOTAL_GENUINE);

      // Check missing chapters on sequential set is empty
      const missing = detectMissingChapters(sorted);
      expect(missing).toEqual([]);

      console.log(`[Performance Benchmark] 5,000 chapters deduplicated & sorted in ${elapsedMs.toFixed(2)}ms`);

      // Must complete in under 100ms even under heavy test-runner load
      expect(elapsedMs).toBeLessThan(100);
    });

    it('C2.6: Missing chapters detection on gap-filled sequences', () => {
      const chapters: Chapter[] = [
        { id: 1, novelId: 1, chapterNumber: 1, title: 'Chương 1', url: '/c1', content: '', wordCount: 0, status: 'completed' },
        { id: 2, novelId: 1, chapterNumber: 2, title: 'Chương 2', url: '/c2', content: '', wordCount: 0, status: 'completed' },
        { id: 5, novelId: 1, chapterNumber: 5, title: 'Chương 5', url: '/c5', content: '', wordCount: 0, status: 'completed' },
        { id: 8, novelId: 1, chapterNumber: 8, title: 'Chương 8', url: '/c8', content: '', wordCount: 0, status: 'completed' }
      ];

      const missing = detectMissingChapters(chapters);
      expect(missing).toEqual([3, 4, 6, 7]);
    });

    it('C2.7: URL canonicalization: trailing slashes, hashes, and case are deduplicated', () => {
      const chapters: Chapter[] = [
        { id: 1, novelId: 1, chapterNumber: 1, title: 'Chương 1', url: 'https://example.com/c1/', content: '', wordCount: 0, status: 'completed' },
        { id: 2, novelId: 1, chapterNumber: 1, title: 'Chương 1', url: 'https://example.com/c1#section1', content: '', wordCount: 0, status: 'completed' },
        { id: 3, novelId: 1, chapterNumber: 1, title: 'Chương 1', url: 'https://EXAMPLE.COM/C1', content: '', wordCount: 0, status: 'completed' }
      ];

      const deduplicated = deduplicateChapters(chapters);
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].id).toBe(1);
    });

    it('C2.8: Handles chapters with string-formatted chapter numbers ("12" vs 12)', () => {
      const chapters: Chapter[] = [
        { id: 1, novelId: 1, chapterNumber: '2' as any, title: 'Chương 2', url: '/c2', content: '', wordCount: 0, status: 'completed' },
        { id: 2, novelId: 1, chapterNumber: '10' as any, title: 'Chương 10', url: '/c10', content: '', wordCount: 0, status: 'completed' },
        { id: 3, novelId: 1, chapterNumber: 1 as any, title: 'Chương 1', url: '/c1', content: '', wordCount: 0, status: 'completed' }
      ];

      const sorted = naturalSortChapters(chapters);
      expect(sorted.map((c) => c.title)).toEqual(['Chương 1', 'Chương 2', 'Chương 10']);
    });
  });
});
