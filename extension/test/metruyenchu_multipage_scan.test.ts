import { describe, it, expect, vi } from 'vitest';
import { extractTocFromDocument } from '../lib/extractor';
import { findNovelCover, findNovelAuthor } from '../lib/extractor/heuristic';
import { DEFAULT_SITE_RULES } from '../lib/db/presets';
import { buildEpubBlob } from '../lib/exporter/epub';
import { crawler } from '../lib/crawler';
import { DEFAULT_SETTINGS } from '../lib/storage/settings';
import type { Novel, Chapter, SiteRule } from '../lib/types';

const { mockNovels, mockChapters } = vi.hoisted(() => ({
  mockNovels: new Map<number, Novel>(),
  mockChapters: new Map<number, Chapter>()
}));

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
            count: async () =>
              Array.from(mockChapters.values()).filter((c) => (c as any)[field] === val && predicate(c)).length,
            first: async () =>
              Array.from(mockChapters.values()).find((c) => (c as any)[field] === val && predicate(c))
          }),
          count: async () => Array.from(mockChapters.values()).filter((c) => (c as any)[field] === val).length
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
          first: async () => undefined
        })
      }),
      toArray: async () => []
    }
  }
}));

const mtcRule = DEFAULT_SITE_RULES.find((r) => r.domain === 'metruyenchu.com.vn') as SiteRule;

describe('Mê Truyện Chữ 1638-Chapter Multi-Page TOC, Cover Thumbnail & Long-Novel EPUB Menu', () => {
  const parser = new DOMParser();

  it('extracts all 100 chapters on Page 7 (including un-numbered machine-translated titles & chuong-tiep URLs) and advances to Page 8', () => {
    // Construct realistic Page 7 AJAX HTML fragment (unwrapped, as returned by /get/listchap/58764?page=7)
    const chapters601To643 = Array.from({ length: 43 }, (_, i) => {
      const num = 601 + i;
      return `<li><a href="/dai-duong-ta-moi-vua-xuyen-qua-the-nhung-cho-ta-phat-tuc-phu/chuong-${num}-hash${num}">Chương ${num}: tiêu đề ${num}</a></li>`;
    }).join('\n');

    // The exact anomaly on Page 7 of Đại Đường (bookId=58764) that previously caused only 99 chapters to match:
    const unnumberedChap644 = `<li><a href="/dai-duong-ta-moi-vua-xuyen-qua-the-nhung-cho-ta-phat-tuc-phu/chuong-tiep-9sqh5BtHW!6E">Chương ngây ngẩn cả người nữ nhi gia chỗ đó như thế nào có thể làm nam</a></li>`;

    const chapters645To700 = Array.from({ length: 56 }, (_, i) => {
      const num = 645 + i;
      return `<li><a href="/dai-duong-ta-moi-vua-xuyen-qua-the-nhung-cho-ta-phat-tuc-phu/chuong-${num}-hash${num}">Chương ${num}: tiêu đề ${num}</a></li>`;
    }).join('\n');

    const page7Html = `
      <div class='row title-list-chapter'>
        <div class='title-bar-left'><span class='title-left'>Danh sách chương</span></div>
      </div>
      <div class='clearfix'>
        <ul>
          ${chapters601To643}
          ${unnumberedChap644}
          ${chapters645To700}
        </ul>
      </div>
      <div class='paging'>
        <a onclick="page(58764,6);"><span>‹</span></a>
        <a onclick="page(58764,1);">1</a>
        <a onclick="page(58764,6);">6</a>
        <a href="#" class="active">7</a>
        <a onclick="page(58764,8);">8</a>
        <a onclick="page(58764,17);">17</a>
        <a onclick="page(58764,8);"><span>›</span></a>
      </div>
    `;

    const doc = parser.parseFromString(page7Html, 'text/html');
    const res = extractTocFromDocument(
      doc,
      mtcRule,
      'https://metruyenchu.com.vn/get/listchap/58764?page=7'
    );

    expect(res.chapters.length).toBe(100);
    expect(res.chapters[43].title).toContain('Chương ngây ngẩn cả người');
    expect(res.chapters[99].title).toContain('Chương 700');
    expect(res.nextPaginationUrl).toBe('https://metruyenchu.com.vn/get/listchap/58764?page=8');
  });

  it('continues pagination even if a page has < 100 chapters when .paging explicitly links to nextPage, and stops on Page 17', () => {
    const partialItems = Array.from({ length: 98 }, (_, i) => {
      const num = 601 + i;
      return `<li><a href="/truyen/chuong-${num}">Chương ${num}</a></li>`;
    }).join('\n');

    const page7Doc = parser.parseFromString(`
      <div class="row title-list-chapter"></div>
      <div class="clearfix"><ul>${partialItems}</ul></div>
      <div class="paging">
        <a href="#" class="active">7</a>
        <a onclick="page(58764,8);">8</a>
      </div>
    `, 'text/html');

    const res7 = extractTocFromDocument(
      page7Doc,
      mtcRule,
      'https://metruyenchu.com.vn/get/listchap/58764?page=7'
    );
    expect(res7.chapters.length).toBe(98);
    expect(res7.nextPaginationUrl).toBe('https://metruyenchu.com.vn/get/listchap/58764?page=8');

    // Final page 17 (38 chapters, active=17, no page(58764,18))
    const finalItems = Array.from({ length: 38 }, (_, i) => {
      const num = 1601 + i;
      return `<li><a href="/truyen/chuong-${num}">Chương ${num}</a></li>`;
    }).join('\n');

    const page17Doc = parser.parseFromString(`
      <div class="row title-list-chapter"></div>
      <div class="clearfix"><ul>${finalItems}</ul></div>
      <div class="paging">
        <a onclick="page(58764,16);"><span>‹</span></a>
        <a onclick="page(58764,1);">1</a>
        <a onclick="page(58764,16);">16</a>
        <a href="#" class="active">17</a>
      </div>
    `, 'text/html');

    const res17 = extractTocFromDocument(
      page17Doc,
      mtcRule,
      'https://metruyenchu.com.vn/get/listchap/58764?page=17'
    );
    expect(res17.chapters.length).toBe(38);
    expect(res17.nextPaginationUrl).toBeUndefined();
  });

  it('extracts novel cover thumbnail and author from Mê Truyện Chữ story page', () => {
    const storyHtml = `
      <html>
        <head>
          <meta property="og:image" content="https://static.metruyenchu.com.vn/images/poster/dai-duong-ta-moi-vua-xuyen-qua-58764.jpg" />
        </head>
        <body>
          <div class="book-info-pic">
            <img itemprop="image" src="/images/poster/dai-duong-ta-moi-vua-xuyen-qua-58764.jpg" alt="Đại Đường" />
          </div>
          <div class="book-info-text">
            <h1 itemprop="name">Đại Đường, Ta Mới Vừa Xuyên Qua, Thế Nhưng Cho Ta Phát Tức Phụ</h1>
            <ul>
              <li>Tác giả : <a itemprop="author" href="/tac-gia/truy-can-thoi-gian-dich-tieu-oa-nguu">Truy Cản Thời Gian Đích Tiểu Oa Ngưu</a></li>
            </ul>
          </div>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(storyHtml, 'text/html');
    const cover = findNovelCover(doc, 'https://metruyenchu.com.vn/dai-duong-ta-moi-vua-xuyen-qua-the-nhung-cho-ta-phat-tuc-phu');
    const author = findNovelAuthor(doc);

    expect(cover).toBe('https://metruyenchu.com.vn/images/poster/dai-duong-ta-moi-vua-xuyen-qua-58764.jpg');
    expect(author).toBe('Truy Cản Thời Gian Đích Tiểu Oa Ngưu');
  });

  it('generates Quick-Jump Range Menu in nav.xhtml and 2-level collapsible groups in toc.ncx for long novels', async () => {
    const longNovel: Novel = {
      id: 58764,
      title: 'Đại Đường, Ta Mới Vừa Xuyên Qua, Thế Nhưng Cho Ta Phát Tức Phụ',
      author: 'Truy Cản Thời Gian Đích Tiểu Oa Ngưu',
      sourceUrl: 'https://metruyenchu.com.vn/dai-duong-ta-moi-vua-xuyen-qua-the-nhung-cho-ta-phat-tuc-phu',
      totalChapters: 250,
      downloadedChapters: 250,
      status: 'completed'
    };

    const chapters: Chapter[] = Array.from({ length: 250 }, (_, i) => ({
      id: i + 1,
      novelId: 58764,
      chapterNumber: i + 1,
      title: `Chương ${i + 1}: Tiêu đề chương ${i + 1}`,
      url: `https://metruyenchu.com.vn/dai-duong/chuong-${i + 1}`,
      content: `Nội dung chương ${i + 1}.`,
      wordCount: 10,
      status: 'completed'
    }));

    const blob = await buildEpubBlob(longNovel, chapters);
    const text = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()));

    // Verify Quick-Jump pills in nav.xhtml
    expect(text).toContain('Chọn nhanh phân đoạn (250 chương)');
    expect(text).toContain('href="#chap-group-1">Chương 1–100</a>');
    expect(text).toContain('href="#chap-group-101">Chương 101–200</a>');
    expect(text).toContain('href="#chap-group-201">Chương 201–250</a>');

    // Verify 2-level collapsible NCX groups
    expect(text).toContain('<meta name="dtb:depth" content="2"/>');
    expect(text).toContain('<navLabel><text>Chương 1 – 100</text></navLabel>');
    expect(text).toContain('<navLabel><text>Chương 101 – 200</text></navLabel>');
    expect(text).toContain('<navLabel><text>Chương 201 – 250</text></navLabel>');

    // Verify inline bottom chapter navigation bar
    expect(text).toContain('← Chương trước');
    expect(text).toContain('☰ Mục lục');
    expect(text).toContain('Chương sau →');
  });

  it('supports concurrent multi-novel / multi-tab crawling without interrupting background sessions on tab switch', async () => {
    mockNovels.clear();
    mockChapters.clear();

    const novelAId = 101;
    const novelBId = 202;

    mockNovels.set(novelAId, {
      id: novelAId,
      title: 'Truyện A (Mê Truyện Chữ)',
      sourceUrl: 'https://metruyenchu.com.vn/truyen-a',
      totalChapters: 3,
      downloadedChapters: 0,
      status: 'idle',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    mockNovels.set(novelBId, {
      id: novelBId,
      title: 'Truyện B (Cổ Mộng)',
      sourceUrl: 'https://comong.info/truyen-b',
      totalChapters: 3,
      downloadedChapters: 0,
      status: 'idle',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    for (let i = 1; i <= 3; i++) {
      mockChapters.set(1000 + i, {
        id: 1000 + i,
        novelId: novelAId,
        chapterNumber: i,
        title: `Chương ${i} A`,
        url: `https://metruyenchu.com.vn/truyen-a/chuong-${i}`,
        content: '',
        wordCount: 0,
        status: 'pending'
      });
      mockChapters.set(2000 + i, {
        id: 2000 + i,
        novelId: novelBId,
        chapterNumber: i,
        title: `Chương ${i} B`,
        url: `https://comong.info/truyen-b/chuong-${i}`,
        content: '',
        wordCount: 0,
        status: 'pending'
      });
    }

    const fetchSpy = vi.spyOn(crawler, 'fetchHtml').mockImplementation(async (url: string) => {
      await new Promise((r) => setTimeout(r, 15));
      return {
        ok: true,
        status: 200,
        text: `<html><body><h2 class="current-chapter">Tiêu đề ${url}</h2><div id="vungdoc"><p>${'Nội dung chương truyện đầy đủ chi tiết '.repeat(20)}</p></div></body></html>`
      };
    });

    const fastSettings = { ...DEFAULT_SETTINGS, politeDelayMin: 0.01, politeDelayMax: 0.02 };

    // Start both novels concurrently across 2 tabs
    const pA = crawler.startCrawl(novelAId, fastSettings, { allowConcurrent: true });
    const pB = crawler.startCrawl(novelBId, fastSettings, { allowConcurrent: true });

    await new Promise((r) => setTimeout(r, 5));
    expect(crawler.getActiveSessions().length).toBe(2);
    expect(crawler.isNovelCrawling(novelAId)).toBe(true);
    expect(crawler.isNovelCrawling(novelBId)).toBe(true);

    await Promise.all([pA, pB]);

    const chapsA = Array.from(mockChapters.values()).filter((c) => c.novelId === novelAId);
    const chapsB = Array.from(mockChapters.values()).filter((c) => c.novelId === novelBId);
    expect(chapsA.every((c) => c.status === 'completed')).toBe(true);
    expect(chapsB.every((c) => c.status === 'completed')).toBe(true);

    fetchSpy.mockRestore();
  });
});
