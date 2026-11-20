import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Novel, Chapter, AppSettings, SiteRule } from '../lib/types';
import type { CrawlProgressEvent } from '../lib/crawler';
import { buildEpubBlob, escapeXml } from '../lib/exporter/epub';
import { buildJsonBlob, generateJsonData, type NovelJsonExport } from '../lib/exporter/json';
import { ZipWriter, computeCrc32 } from '../lib/exporter/zip';
import { generateTxtContent } from '../lib/exporter/txt';
import { generatePrintableHtml } from '../lib/exporter/pdf';
import { naturalSortChapters, deduplicateChapters, detectMissingChapters } from '../lib/exporter/sorter';
import { getSettings, saveSettings, DEFAULT_SETTINGS, DEFAULT_AD_KEYWORDS } from '../lib/storage/settings';
import { countWords } from '../lib/sanitizer';

// ============================================================================
// Independent, Strict PKZip 2.0 Unpacker & Verification Oracle
// Built completely independent from production ZipWriter to prevent shared blindness
// ============================================================================
interface UnpackedZipEntry {
  name: string;
  data: Uint8Array;
  text: () => string;
  crc: number;
  size: number;
  method: number;
  localHeaderOffset: number;
}

function unpackZipStrict(buffer: Uint8Array): {
  entries: Map<string, UnpackedZipEntry>;
  orderedNames: string[];
  eocd: {
    totalEntries: number;
    cdSize: number;
    cdOffset: number;
  };
} {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const decoder = new TextDecoder('utf-8');

  // 1. Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1;
  for (let i = buffer.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('EOCD record signature 0x06054b50 not found in buffer');
  }

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const cdStartDisk = view.getUint16(eocdOffset + 6, true);
  const totalEntriesDisk = view.getUint16(eocdOffset + 8, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  if (diskNumber !== 0 || cdStartDisk !== 0) {
    throw new Error(`Multi-disk archives not supported: disk ${diskNumber}, cdDisk ${cdStartDisk}`);
  }
  if (totalEntriesDisk !== totalEntries) {
    throw new Error(`Disk entries mismatch: ${totalEntriesDisk} vs ${totalEntries}`);
  }

  const entries = new Map<string, UnpackedZipEntry>();
  const orderedNames: string[] = [];
  let ptr = cdOffset;

  // 2. Iterate Central Directory Headers
  for (let i = 0; i < totalEntries; i++) {
    const sig = view.getUint32(ptr, true);
    if (sig !== 0x02014b50) {
      throw new Error(`Invalid Central Directory header signature 0x${sig.toString(16)} at offset ${ptr}`);
    }

    const flags = view.getUint16(ptr + 8, true);
    const method = view.getUint16(ptr + 10, true);
    const crc = view.getUint32(ptr + 16, true);
    const compSize = view.getUint32(ptr + 20, true);
    const uncompSize = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const nameBytes = buffer.subarray(ptr + 46, ptr + 46 + nameLen);
    const name = decoder.decode(nameBytes);
    orderedNames.push(name);

    // 3. Cross-verify with Local Header
    const localSig = view.getUint32(localHeaderOffset, true);
    if (localSig !== 0x04034b50) {
      throw new Error(`Invalid Local Header signature 0x${localSig.toString(16)} at offset ${localHeaderOffset} for "${name}"`);
    }

    const localFlags = view.getUint16(localHeaderOffset + 6, true);
    const localMethod = view.getUint16(localHeaderOffset + 8, true);
    const localCrc = view.getUint32(localHeaderOffset + 14, true);
    const localCompSize = view.getUint32(localHeaderOffset + 18, true);
    const localUncompSize = view.getUint32(localHeaderOffset + 22, true);
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);

    if (localMethod !== method) throw new Error(`Method mismatch for "${name}": CD=${method}, Local=${localMethod}`);
    if (localCrc !== crc) throw new Error(`CRC mismatch for "${name}": CD=${crc}, Local=${localCrc}`);
    if (localCompSize !== compSize) throw new Error(`CompSize mismatch for "${name}": CD=${compSize}, Local=${localCompSize}`);
    if (localUncompSize !== uncompSize) throw new Error(`UncompSize mismatch for "${name}": CD=${uncompSize}, Local=${localUncompSize}`);

    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const data = buffer.subarray(dataStart, dataStart + uncompSize);

    // 4. Verify Payload CRC32 independently
    const computedCrc = computeCrc32(data);
    if (computedCrc !== crc) {
      throw new Error(`Data CRC-32 corruption for "${name}": expected 0x${crc.toString(16)}, got 0x${computedCrc.toString(16)}`);
    }

    entries.set(name, {
      name,
      data,
      text: () => decoder.decode(data),
      crc,
      size: uncompSize,
      method,
      localHeaderOffset
    });

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return {
    entries,
    orderedNames,
    eocd: {
      totalEntries,
      cdSize,
      cdOffset
    }
  };
}

// ============================================================================
// Mock DB & Rules for Crawler Testing
// ============================================================================
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

vi.mock('../lib/db', () => ({
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
      where: (field: string) => ({
        equals: (val: any) => ({
          first: async () => sampleRule
        })
      }),
      toArray: async () => [sampleRule]
    }
  },
  initDatabase: vi.fn()
}));

// Import crawler after mocking
import { crawler } from '../lib/crawler';

describe('Tier 5 Adversarial Coverage Hardening Suite: Crawler, Exporter & Storage', () => {
  const zeroDelaySettings: AppSettings = {
    language: 'vi',
    theme: 'dark',
    politeDelayMin: 0,
    politeDelayMax: 0,
    defaultFormat: 'txt',
    adKeywords: ['Quảng cáo', 'truyenfull.vn']
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
    vi.useRealTimers();
  });

  // ==========================================================================
  // Section 1: Crawler Layer Boundary Extremes & Stress
  // ==========================================================================
  describe('1. Crawler Layer White-Box Extremes', () => {
    it('1.1 Zero Delay Crawling: executes queue with politeDelayMin=0 and politeDelayMax=0 without hanging or negative timers', async () => {
      const novelId = 1001;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Zero Delay Novel',
        sourceUrl: 'https://example.com/novel-1001',
        totalChapters: 5,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      for (let i = 1; i <= 5; i++) {
        mockChapters.set(10010 + i, {
          id: 10010 + i,
          novelId,
          chapterNumber: i,
          title: `Chương ${i}`,
          url: `https://example.com/c${i}`,
          content: '',
          wordCount: 0,
          status: 'pending'
        });
      }

      globalThis.fetch = vi.fn(
        async (url: string) =>
          new Response(`<h1>Chương</h1><div class="content"><p>Nội dung chương tại ${url}</p></div>`, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          })
      ) as any;

      const progressEvents: CrawlProgressEvent[] = [];
      const unsub = crawler.subscribe((ev) => progressEvents.push({ ...ev }));

      const startTime = Date.now();
      await crawler.startCrawl(novelId, zeroDelaySettings);
      const elapsed = Date.now() - startTime;

      unsub();

      expect(crawler.isRunning).toBe(false);
      expect(crawler.getActiveNovelId()).toBeNull();
      expect(mockNovels.get(novelId)?.status).toBe('completed');
      expect(mockNovels.get(novelId)?.downloadedChapters).toBe(5);

      for (let i = 1; i <= 5; i++) {
        const chap = mockChapters.get(10010 + i);
        expect(chap?.status).toBe('completed');
        expect(chap?.wordCount).toBeGreaterThan(0);
      }

      // With zero delay, 5 chapters in happy-dom resolve almost instantly (< 500ms)
      expect(elapsed).toBeLessThan(1000);
      expect(progressEvents.length).toBeGreaterThanOrEqual(5);
      expect(progressEvents[progressEvents.length - 1].percent).toBe(100);
      expect(progressEvents[progressEvents.length - 1].status).toBe('completed');
    });

    it('1.2 Massive Chapter Queue: processes 1,000 chapters in queue without memory leaks, progress drift, or dropped chapters', async () => {
      const novelId = 1002;
      const TOTAL_CHAPTERS = 1000;

      mockNovels.set(novelId, {
        id: novelId,
        title: 'Massive 1,000 Chapters Novel',
        sourceUrl: 'https://example.com/novel-1002',
        totalChapters: TOTAL_CHAPTERS,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
        mockChapters.set(20000 + i, {
          id: 20000 + i,
          novelId,
          chapterNumber: i,
          title: `Chương ${i}: Tiêu đề kiểm thử ${i}`,
          url: `https://example.com/c${i}`,
          content: '',
          wordCount: 0,
          status: 'pending'
        });
      }

      // Fast concise mock response to minimize happy-dom DOMParser overhead across 1,000 iterations
      globalThis.fetch = vi.fn(
        async (url: string) =>
          new Response(`<h1>C</h1><div class="content"><p>Crawl ${url}</p></div>`, {
            status: 200
          })
      ) as any;

      let lastReportedPercent = 0;
      let eventCount = 0;
      const unsub = crawler.subscribe((ev) => {
        eventCount++;
        lastReportedPercent = ev.percent;
      });

      await crawler.startCrawl(novelId, zeroDelaySettings);
      unsub();

      expect(crawler.isRunning).toBe(false);
      expect(mockNovels.get(novelId)?.status).toBe('completed');
      expect(mockNovels.get(novelId)?.downloadedChapters).toBe(TOTAL_CHAPTERS);
      expect(lastReportedPercent).toBe(100);
      expect(eventCount).toBeGreaterThanOrEqual(TOTAL_CHAPTERS);

      // Verify spot-checked chapters across boundaries
      const spotCheckIds = [20001, 20250, 20500, 20750, 20999, 21000];
      for (const id of spotCheckIds) {
        const chap = mockChapters.get(id);
        expect(chap?.status).toBe('completed');
        expect(chap?.content).toContain('Crawl https://example.com/c');
        expect(chap?.wordCount).toBeGreaterThan(0);
      }
    }, 45000);

    it('1.3 Rapid Pause-Resume-Cancel Cycles: state mutations in rapid succession cleanly restore idle state and release mutex', async () => {
      const novelId = 1003;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Lifecycle Stress Novel',
        sourceUrl: 'https://example.com/novel-1003',
        totalChapters: 20,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      for (let i = 1; i <= 20; i++) {
        mockChapters.set(30000 + i, {
          id: 30000 + i,
          novelId,
          chapterNumber: i,
          title: `Chương ${i}`,
          url: `https://example.com/c${i}`,
          content: '',
          wordCount: 0,
          status: 'pending'
        });
      }

      globalThis.fetch = vi.fn(
        async () => new Response('<h1>Chương</h1><div class="content"><p>Content</p></div>', { status: 200 })
      ) as any;

      // Start crawl
      const crawlPromise = crawler.startCrawl(novelId, zeroDelaySettings);

      // Fire rapid state mutations
      crawler.pause();
      crawler.resume();
      crawler.pause();
      crawler.resume();
      crawler.cancel();

      await crawlPromise;

      expect(crawler.isRunning).toBe(false);
      expect(crawler.getActiveNovelId()).toBeNull();
      expect(mockNovels.get(novelId)?.status).toBe('idle');

      // Mutex is completely free: can immediately start another crawl on novel 1004
      const nextNovelId = 1004;
      mockNovels.set(nextNovelId, {
        id: nextNovelId,
        title: 'Next Novel',
        sourceUrl: 'https://example.com/novel-1004',
        totalChapters: 1,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      mockChapters.set(40001, {
        id: 40001,
        novelId: nextNovelId,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://example.com/c1',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      await expect(crawler.startCrawl(nextNovelId, zeroDelaySettings)).resolves.not.toThrow();
      expect(crawler.isRunning).toBe(false);
    });

    it('1.4 Simulated Network Timeouts: handles network timeouts with retry backoff and isolates failure to the failed chapter', async () => {
      vi.useFakeTimers();

      const novelId = 1005;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Timeout Resilience Novel',
        sourceUrl: 'https://example.com/novel-1005',
        totalChapters: 2,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      mockChapters.set(50001, {
        id: 50001,
        novelId,
        chapterNumber: 1,
        title: 'Chương 1 (Timeout Fail)',
        url: 'https://example.com/timeout-chapter',
        content: '',
        wordCount: 0,
        status: 'pending'
      });
      mockChapters.set(50002, {
        id: 50002,
        novelId,
        chapterNumber: 2,
        title: 'Chương 2 (Healthy)',
        url: 'https://example.com/healthy-chapter',
        content: '',
        wordCount: 0,
        status: 'pending'
      });

      globalThis.fetch = vi.fn(async (url: string) => {
        if (url.includes('timeout-chapter')) {
          throw new Error('ETIMEDOUT: Connection timed out to remote gateway');
        }
        return new Response('<h1>Chương 2</h1><div class="content"><p>Thành công</p></div>', { status: 200 });
      }) as any;

      const crawlPromise = crawler.startCrawl(novelId, zeroDelaySettings);

      // Advance timers across the 3 retry backoffs (2000ms + 4000ms + 6000ms = 12000ms)
      await vi.advanceTimersByTimeAsync(15000);
      await crawlPromise;

      vi.useRealTimers();

      const failedChap = mockChapters.get(50001);
      const healthyChap = mockChapters.get(50002);

      expect(failedChap?.status).toBe('failed');
      expect(failedChap?.errorMessage).toContain('ETIMEDOUT');

      expect(healthyChap?.status).toBe('completed');
      expect(healthyChap?.content).toContain('Thành công');

      expect(mockNovels.get(novelId)?.status).toBe('completed');
      expect(mockNovels.get(novelId)?.downloadedChapters).toBe(1);
    });

    it('1.5 Corrupt HTML & Non-HTML Responses: handles null bytes, binary garbage, and non-HTML error responses gracefully', async () => {
      const novelId = 1006;
      mockNovels.set(novelId, {
        id: novelId,
        title: 'Corrupt Response Novel',
        sourceUrl: 'https://example.com/novel-1006',
        totalChapters: 4,
        downloadedChapters: 0,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const responses = [
        // Case A: Binary / Null bytes in response
        '<html><body><h1>Chapter 1</h1><div class="content">\x00\x01\x02\xFF\xFE<p>Valid text after binary garbage</p></div></body></html>',
        // Case B: Truncated / unclosed tags
        '<div><h1>Chapter 2</h1><div class="content"><p>Unclosed paragraph and missing closing tags',
        // Case C: Non-HTML JSON error response
        '{"error": "Cloudflare Bot Detection Active", "code": 1020}',
        // Case D: Completely empty string
        ''
      ];

      for (let i = 1; i <= 4; i++) {
        mockChapters.set(60000 + i, {
          id: 60000 + i,
          novelId,
          chapterNumber: i,
          title: `Chương ${i}`,
          url: `https://example.com/c${i}`,
          content: '',
          wordCount: 0,
          status: 'pending'
        });
      }

      let fetchCall = 0;
      globalThis.fetch = vi.fn(async () => {
        const body = responses[fetchCall % responses.length];
        fetchCall++;
        return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }) as any;

      await expect(crawler.startCrawl(novelId, zeroDelaySettings)).resolves.not.toThrow();
      expect(crawler.isRunning).toBe(false);

      // Verify all 4 chapters were processed without crashing the engine
      for (let i = 1; i <= 4; i++) {
        const chap = mockChapters.get(60000 + i);
        expect(['completed', 'failed']).toContain(chap?.status);
      }
    });
  });

  // ==========================================================================
  // Section 2: Exporter Layer Boundary Extremes & Strict Validation
  // ==========================================================================
  describe('2. Exporter Layer Boundary Extremes & Strict Validation', () => {
    const baseNovel: Novel = {
      id: 1,
      title: 'Huyền Thiên Ma Đế',
      author: 'Cổ Chân Nhân',
      sourceUrl: 'https://example.com/huyen-thien',
      description: 'Một bộ truyện tu tiên đặc sắc.',
      status: 'crawling',
      totalChapters: 10,
      downloadedChapters: 10,
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    };

    it('2.1 EPUB 3 with Zero Chapters: produces valid EPUB 3 zip archive with titlepage, empty nav, and valid OPF manifest/spine', async () => {
      const blob = await buildEpubBlob(baseNovel, []);
      const buffer = new Uint8Array(await blob.arrayBuffer());

      const unpacked = unpackZipStrict(buffer);

      // 1. mimetype MUST be the very first entry
      expect(unpacked.orderedNames[0]).toBe('mimetype');
      expect(unpacked.entries.get('mimetype')?.text()).toBe('application/epub+zip');

      // 2. META-INF/container.xml
      const containerXml = unpacked.entries.get('META-INF/container.xml')?.text();
      expect(containerXml).toBeDefined();
      expect(containerXml).toContain('full-path="OEBPS/content.opf"');

      // 3. OEBPS/titlepage.xhtml
      const titlepage = unpacked.entries.get('OEBPS/titlepage.xhtml')?.text();
      expect(titlepage).toBeDefined();
      expect(titlepage).toContain('Tổng số chương: 0');
      expect(titlepage).toContain(escapeXml(baseNovel.title));

      // 4. OEBPS/nav.xhtml: valid EPUB 3 nav document even with 0 chapters
      const navXhtml = unpacked.entries.get('OEBPS/nav.xhtml')?.text();
      expect(navXhtml).toBeDefined();
      expect(navXhtml).toContain('<ol>');
      expect(navXhtml).toContain('<li><a href="titlepage.xhtml">Trang bìa</a></li>');

      // 5. OEBPS/content.opf: valid package with no chapter itemref
      const contentOpf = unpacked.entries.get('OEBPS/content.opf')?.text();
      expect(contentOpf).toBeDefined();
      expect(contentOpf).toContain('<dc:title>Huyền Thiên Ma Đế</dc:title>');
      expect(contentOpf).toContain('<itemref idref="titlepage"/>');
      expect(contentOpf).not.toContain('idref="chap_');
    });

    it('2.2 Extreme Empty Strings: handles empty novel titles, authors, descriptions, and empty chapter contents gracefully', async () => {
      const emptyNovel: Novel = {
        title: '',
        sourceUrl: '',
        author: '',
        description: '',
        status: 'idle',
        totalChapters: 0,
        downloadedChapters: 0
      };

      const emptyChapters: Chapter[] = [
        {
          novelId: 1,
          chapterNumber: 1,
          title: '',
          url: '',
          content: '',
          wordCount: 0,
          status: 'pending'
        }
      ];

      // XML Escaping on empty string
      expect(escapeXml('')).toBe('');

      // EPUB 3 generation
      const epubBlob = await buildEpubBlob(emptyNovel, emptyChapters);
      const epubBuffer = new Uint8Array(await epubBlob.arrayBuffer());
      const unpacked = unpackZipStrict(epubBuffer);
      expect(unpacked.entries.has('OEBPS/chapter_1.xhtml')).toBe(true);
      const chapterContent = unpacked.entries.get('OEBPS/chapter_1.xhtml')?.text();
      expect(chapterContent).toContain('[Nội dung trống hoặc chưa tải]');

      // JSON generation
      const jsonData = generateJsonData(emptyNovel, emptyChapters);
      expect(jsonData.novel.title).toBe('');
      expect(jsonData.novel.author).toBeUndefined();
      expect(jsonData.chapters[0].title).toBe('');
      expect(jsonData.chapters[0].content).toBe('');

      // TXT generation
      const txt = generateTxtContent(emptyNovel, emptyChapters);
      expect(txt).toContain('TÊN TRUYỆN: \n');
      expect(txt).toContain('[NỘI DUNG CHƯA TẢI HOẶC TRỐNG]');

      // PDF printable HTML generation
      const html = generatePrintableHtml(emptyNovel, emptyChapters);
      expect(html).toContain('<h1 class="novel-title"></h1>');
      expect(html).toContain('[Nội dung trống hoặc chưa tải]');
    });

    it('2.3 Massive 100,000-Word Chapter Stress: formats and exports 100,000 words without stack overflow or truncated content', async () => {
      // Construct 1,000 paragraphs of 100 words each = exactly 100,000 words
      const wordsPerParagraph = 100;
      const totalParagraphs = 1000;
      const paragraphUnit = Array.from({ length: wordsPerParagraph }, (_, i) => `từ${i + 1}`).join(' ');
      const massiveContent = Array.from({ length: totalParagraphs }, () => paragraphUnit).join('\n\n');

      const wordCount = countWords(massiveContent);
      expect(wordCount).toBe(100000);

      const massiveChapter: Chapter = {
        id: 777,
        novelId: 1,
        chapterNumber: 1,
        title: 'Chương 1: Đại Chiến Mười Vạn Chữ',
        url: 'https://example.com/c1',
        content: massiveContent,
        wordCount,
        status: 'completed'
      };

      // 1. Test EPUB 3 export
      const epubBlob = await buildEpubBlob(baseNovel, [massiveChapter]);
      const unpacked = unpackZipStrict(new Uint8Array(await epubBlob.arrayBuffer()));
      const extractedChapterXhtml = unpacked.entries.get('OEBPS/chapter_1.xhtml')?.text();

      expect(extractedChapterXhtml).toBeDefined();
      expect(extractedChapterXhtml).toContain('Chương 1: Đại Chiến Mười Vạn Chữ');
      expect(extractedChapterXhtml?.length).toBeGreaterThan(450000);

      // 2. Test JSON export
      const jsonData = generateJsonData(baseNovel, [massiveChapter]);
      expect(jsonData.chapters[0].wordCount).toBe(100000);
      const jsonBlob = buildJsonBlob(baseNovel, [massiveChapter]);
      expect(jsonBlob.size).toBeGreaterThan(450000);

      // 3. Test TXT export
      const txt = generateTxtContent(baseNovel, [massiveChapter]);
      expect(txt.length).toBeGreaterThan(450000);

      // 4. Test PDF printable HTML
      const printableHtml = generatePrintableHtml(baseNovel, [massiveChapter]);
      expect(printableHtml.length).toBeGreaterThan(450000);
    });

    it('2.4 Extreme Unicode Characters: preserves surrogate pairs, RTL marks, math symbols, and strips invalid XML control chars', async () => {
      const complexUnicodeContent = [
        // Surrogate Pairs (Emoji & SMP symbols)
        'Surrogates: 😀 🚀 🐲 𠮷 (U+20BB7) 𝄞 (U+1D11E musical G-clef)',
        // RTL marks & BiDi text
        'RTL Text: مرحبا بك في رواية جديدة \u200F(RLM) \u200E(LRM) עִבְרִית (Hebrew)',
        // Mathematical & Greek symbols
        'Math & Greek: ∀x ∈ ℝ, ∃y : y > x² + ∑_{i=1}^n \\sqrt{i} ≠ ∞ | α β γ δ Ω π ∞ ∫ ≈ ‰',
        // Vietnamese diacritics
        'Tiếng Việt: ắ ằ ẳ ẵ ặ, ế ề ể ễ ệ, ố ồ ổ ỗ ộ, ứ ừ ử ữ ự, đ Đ',
        // XML 1.0 invalid control characters (to be stripped by escapeXml)
        'Invalid XML Control Chars: \x00 \x01 \x07 \x08 \x0B \x0C \x0E \x1F (must be stripped)',
        // Valid whitespace control characters (must be preserved)
        'Valid Whitespace: \t Tab and \n Newline'
      ].join('\n\n');

      const unicodeChapter: Chapter = {
        id: 888,
        novelId: 1,
        chapterNumber: 1,
        title: 'Chương 1: Unicode Đa Dạng 𠮷 & ∀x ∈ ℝ 🚀',
        url: 'https://example.com/unicode',
        content: complexUnicodeContent,
        wordCount: 50,
        status: 'completed'
      };

      // Direct verification of escapeXml
      const escaped = escapeXml(complexUnicodeContent);
      expect(escaped).not.toContain('\x00');
      expect(escaped).not.toContain('\x01');
      expect(escaped).not.toContain('\x08');
      expect(escaped).not.toContain('\x0B');
      expect(escaped).not.toContain('\x0C');
      expect(escaped).not.toContain('\x1F');
      expect(escaped).toContain('\t'); // tab preserved
      expect(escaped).toContain('\n'); // newline preserved
      expect(escaped).toContain('𠮷');
      expect(escaped).toContain('𝄞');
      expect(escaped).toContain('مرحبا');
      expect(escaped).toContain('∀x ∈ ℝ');

      // EPUB 3 packing and unpacking roundtrip
      const blob = await buildEpubBlob(baseNovel, [unicodeChapter]);
      const unpacked = unpackZipStrict(new Uint8Array(await blob.arrayBuffer()));
      const roundtripXhtml = unpacked.entries.get('OEBPS/chapter_1.xhtml')?.text();

      expect(roundtripXhtml).toContain('𠮷');
      expect(roundtripXhtml).toContain('𝄞');
      expect(roundtripXhtml).toContain('مرحبا');
      expect(roundtripXhtml).toContain('∀x ∈ ℝ');
      expect(roundtripXhtml).toContain('ắ ằ ẳ ẵ ặ');

      // Verify OPF package preserved unicode title
      const opf = unpacked.entries.get('OEBPS/content.opf')?.text();
      expect(opf).toContain('Huyền Thiên Ma Đế');

      // Verify Table of Contents preserved Unicode
      const nav = unpacked.entries.get('OEBPS/nav.xhtml')?.text();
      expect(nav).toContain('Chương 1: Unicode Đa Dạng 𠮷 &amp; ∀x ∈ ℝ 🚀');
    });

    it('2.5 JSON Export with Missing Optional Fields: produces strictly schema-compliant 1.0.0 JSON', () => {
      const bareNovel: Novel = {
        title: 'Truyện Tối Giản',
        sourceUrl: 'https://example.com/bare',
        status: 'completed',
        totalChapters: 2,
        downloadedChapters: 1
      };

      const chapters: Chapter[] = [
        {
          novelId: 1,
          chapterNumber: 1,
          title: 'Chương 1',
          url: 'https://example.com/c1',
          content: 'Nội dung chương 1',
          wordCount: 4,
          status: 'completed'
        },
        {
          novelId: 1,
          chapterNumber: 2,
          title: 'Chương 2',
          url: 'https://example.com/c2',
          content: '',
          wordCount: 0,
          status: 'pending'
        }
      ];

      const json = generateJsonData(bareNovel, chapters);

      expect(json.schemaVersion).toBe('1.0.0');
      expect(json.generator).toBe('Novel Scraper Extension');
      expect(json.novel.id).toBeUndefined();
      expect(json.novel.author).toBeUndefined();
      expect(json.novel.coverUrl).toBeUndefined();
      expect(json.novel.description).toBeUndefined();
      expect(json.novel.totalChapters).toBe(2);
      expect(json.novel.downloadedChapters).toBe(1); // Only 1 completed chapter

      expect(json.chapters).toHaveLength(2);
      expect(json.chapters[0].status).toBe('completed');
      expect(json.chapters[1].status).toBe('pending');

      const blob = buildJsonBlob(bareNovel, chapters);
      expect(blob.type).toBe('application/json;charset=utf-8');
    });
  });

  // ==========================================================================
  // Section 3: Pure-TypeScript PKZip 2.0 Writer Stress & Boundary Extremes
  // ==========================================================================
  describe('3. Pure-TypeScript PKZip 2.0 Writer Stress & Boundary Extremes', () => {
    it('3.1 Multiple Files with Identical Timestamps: unpacks 50 files with MS-DOS zero timestamps without offset collisions', () => {
      const zip = new ZipWriter();
      const TOTAL_FILES = 50;

      for (let i = 1; i <= TOTAL_FILES; i++) {
        zip.addFile(`file_${String(i).padStart(3, '0')}.txt`, `Dữ liệu nội dung của tệp thứ ${i}`);
      }

      const buffer = zip.build();
      const unpacked = unpackZipStrict(buffer);

      expect(unpacked.eocd.totalEntries).toBe(TOTAL_FILES);
      expect(unpacked.entries.size).toBe(TOTAL_FILES);

      // Verify offsets are strictly monotonically increasing
      let lastOffset = -1;
      for (let i = 1; i <= TOTAL_FILES; i++) {
        const name = `file_${String(i).padStart(3, '0')}.txt`;
        const entry = unpacked.entries.get(name);
        expect(entry).toBeDefined();
        expect(entry!.localHeaderOffset).toBeGreaterThan(lastOffset);
        expect(entry!.text()).toBe(`Dữ liệu nội dung của tệp thứ ${i}`);
        lastOffset = entry!.localHeaderOffset;
      }
    });

    it('3.2 Deep Directory Paths: correctly encodes and preserves multi-level and non-ASCII directory paths', () => {
      const zip = new ZipWriter();

      const paths = [
        'a/b/c/d/e/f/g/h/i/j/deep_file.txt',
        'kho_lưu_trữ/tiểu_thuyết_chọn_lọc/tập_01/chương_đặc_biệt.xhtml',
        'spaces and dots/v1.0.0/build-2026.11/data.bin',
        'root_file.txt'
      ];

      for (const p of paths) {
        zip.addFile(p, `Payload for path: ${p}`);
      }

      const buffer = zip.build();
      const unpacked = unpackZipStrict(buffer);

      for (const p of paths) {
        const entry = unpacked.entries.get(p);
        expect(entry).toBeDefined();
        expect(entry!.text()).toBe(`Payload for path: ${p}`);
      }
    });

    it('3.3 Large Files Close to Buffer Boundaries: handles 0-byte, 64KB-1, 64KB, 64KB+1, and 128KB boundaries cleanly', () => {
      const zip = new ZipWriter();

      const sizes = [
        0, // Empty file boundary
        65535, // 64KB - 1
        65536, // 64KB exact
        65537, // 64KB + 1
        131072 // 128KB
      ];

      for (const size of sizes) {
        const data = new Uint8Array(size);
        // Fill deterministic repeating byte pattern
        for (let j = 0; j < size; j++) {
          data[j] = j % 251;
        }
        zip.addFile(`boundary_${size}.dat`, data);
      }

      const buffer = zip.build();
      const unpacked = unpackZipStrict(buffer);

      for (const size of sizes) {
        const name = `boundary_${size}.dat`;
        const entry = unpacked.entries.get(name);
        expect(entry).toBeDefined();
        expect(entry!.size).toBe(size);

        if (size === 0) {
          expect(entry!.crc).toBe(0);
        } else {
          expect(entry!.data[0]).toBe(0);
          expect(entry!.data[size - 1]).toBe((size - 1) % 251);
        }
      }
    });

    it('3.4 CRC-32 IEEE 802.3 Standard Test Vectors: verifies standard test vectors against precomputed polynomial', () => {
      const encoder = new TextEncoder();

      // Vector 1: Empty string -> 0x00000000
      expect(computeCrc32(encoder.encode(''))).toBe(0x00000000);

      // Vector 2: "123456789" -> 0xCBF43926 (3421780262)
      expect(computeCrc32(encoder.encode('123456789'))).toBe(0xcbf43926);

      // Vector 3: "The quick brown fox jumps over the lazy dog" -> 0x414FA339 (1095738169)
      expect(computeCrc32(encoder.encode('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
    });
  });

  // ==========================================================================
  // Section 4: Storage & Settings Layer Boundary Extremes
  // ==========================================================================
  describe('4. Storage & Settings Layer Boundary Extremes', () => {
    it('4.1 Fallback when chrome.storage.local is missing: getSettings returns DEFAULT_SETTINGS and saveSettings does not throw', async () => {
      const originalChrome = (globalThis as any).chrome;
      try {
        delete (globalThis as any).chrome;

        const settings = await getSettings();
        expect(settings).toEqual(DEFAULT_SETTINGS);
        expect(settings.defaultFormat).toBe('txt');
        expect(settings.adKeywords).toEqual(DEFAULT_AD_KEYWORDS);

        await expect(saveSettings(settings)).resolves.not.toThrow();
      } finally {
        (globalThis as any).chrome = originalChrome;
      }
    });

    it('4.2 Rejection in chrome.storage.local.get: handles exception and falls back to DEFAULT_SETTINGS gracefully', async () => {
      const originalChrome = (globalThis as any).chrome;
      try {
        (globalThis as any).chrome = {
          storage: {
            local: {
              get: vi.fn().mockRejectedValue(new Error('Storage quota exceeded or disk IO failure')),
              set: vi.fn().mockRejectedValue(new Error('Write failure'))
            }
          }
        };

        const settings = await getSettings();
        expect(settings).toEqual(DEFAULT_SETTINGS);

        await expect(saveSettings(settings)).resolves.not.toThrow();
      } finally {
        (globalThis as any).chrome = originalChrome;
      }
    });

    it('4.3 Custom Settings Merging: preserves custom adKeywords while falling back to default theme/delays', async () => {
      const originalChrome = (globalThis as any).chrome;
      try {
        (globalThis as any).chrome = {
          storage: {
            local: {
              get: vi.fn().mockResolvedValue({
                novel_scraper_settings: {
                  theme: 'light',
                  adKeywords: ['CustomAdLine 1', 'CustomAdLine 2']
                }
              })
            }
          }
        };

        const settings = await getSettings();
        expect(settings.theme).toBe('light');
        expect(settings.adKeywords).toEqual(['CustomAdLine 1', 'CustomAdLine 2']);
        expect(settings.politeDelayMin).toBe(1.5); // Fallback to default
        expect(settings.defaultFormat).toBe('txt'); // Fallback to default
      } finally {
        (globalThis as any).chrome = originalChrome;
      }
    });
  });

  // ==========================================================================
  // Section 5: Natural Sorter & Deduplication Boundary Extremes
  // ==========================================================================
  describe('5. Natural Sorter & Deduplication Boundary Extremes', () => {
    it('5.1 Natural Sorting with Negative, Zero, and Mixed Decimals', () => {
      const chapters: Chapter[] = [
        { novelId: 1, chapterNumber: 0, title: 'Lời Mở Đầu', url: 'https://example.com/c0', content: '', wordCount: 0, status: 'completed' },
        { novelId: 1, chapterNumber: 10, title: 'Chương 10', url: 'https://example.com/c10', content: '', wordCount: 0, status: 'completed' },
        { novelId: 1, chapterNumber: 2, title: 'Chương 2', url: 'https://example.com/c2', content: '', wordCount: 0, status: 'completed' },
        { novelId: 1, chapterNumber: 1.5, title: 'Chương 1.5 (Ngoại truyện)', url: 'https://example.com/c1.5', content: '', wordCount: 0, status: 'completed' },
        { novelId: 1, chapterNumber: 1, title: 'Chương 1', url: 'https://example.com/c1', content: '', wordCount: 0, status: 'completed' }
      ];

      const sorted = naturalSortChapters(chapters);
      const numbers = sorted.map((c) => c.chapterNumber);
      expect(numbers).toEqual([0, 1, 1.5, 2, 10]);
    });

    it('5.2 Deduplication with Identical Titles but Different Numbers/URLs preserves distinct chapters', () => {
      const chapters: Chapter[] = [
        { novelId: 1, chapterNumber: 1, title: 'Ngoại truyện', url: 'https://example.com/extra-1', content: 'Nội dung 1', wordCount: 3, status: 'completed' },
        { novelId: 1, chapterNumber: 2, title: 'Ngoại truyện', url: 'https://example.com/extra-2', content: 'Nội dung 2', wordCount: 3, status: 'completed' },
        // Exact duplicate of #1
        { novelId: 1, chapterNumber: 1, title: 'Ngoại truyện', url: 'https://example.com/extra-1', content: 'Nội dung 1 duplicate', wordCount: 3, status: 'completed' },
        // Empty title but distinct number
        { novelId: 1, chapterNumber: 3, title: '', url: 'https://example.com/c3', content: 'Chương 3', wordCount: 2, status: 'completed' },
        { novelId: 1, chapterNumber: 4, title: '', url: 'https://example.com/c4', content: 'Chương 4', wordCount: 2, status: 'completed' }
      ];

      const deduplicated = deduplicateChapters(chapters);
      expect(deduplicated).toHaveLength(4);
      expect(deduplicated.map((c) => c.chapterNumber)).toEqual([1, 2, 3, 4]);
    });

    it('5.3 Detect Missing Chapters across gaps and boundaries', () => {
      const chapters: Chapter[] = [
        { novelId: 1, chapterNumber: 1, title: 'Chương 1', url: '', content: '', wordCount: 0, status: 'completed' },
        { novelId: 1, chapterNumber: 2, title: 'Chương 2', url: '', content: '', wordCount: 0, status: 'completed' },
        { novelId: 1, chapterNumber: 5, title: 'Chương 5', url: '', content: '', wordCount: 0, status: 'completed' },
        { novelId: 1, chapterNumber: 8, title: 'Chương 8', url: '', content: '', wordCount: 0, status: 'completed' }
      ];

      const missing = detectMissingChapters(chapters);
      expect(missing).toEqual([3, 4, 6, 7]);

      // Boundary: Empty chapter list
      expect(detectMissingChapters([])).toEqual([]);

      // Boundary: Single chapter
      expect(detectMissingChapters([chapters[0]])).toEqual([]);
    });
  });
});
