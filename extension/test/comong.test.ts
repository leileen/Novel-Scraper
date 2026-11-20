import { describe, it, expect } from 'vitest';
import { extractChapterWithRule, extractTocFromDocument } from '../lib/extractor';
import { extractChapterHeuristically, findChapterTitle, findNextChapterUrl } from '../lib/extractor/heuristic';
import { sanitizeHtmlContent } from '../lib/sanitizer';
import { naturalSortChapters } from '../lib/exporter/sorter';
import type { SiteRule, Chapter } from '../lib/types';
import { DEFAULT_SITE_RULES } from '../lib/db/presets';

describe('comong.info Extraction & DOM Suite', () => {
  // Authoritative SiteRule specification for comong.info per PROJECT.md Feature Inventory
  const comongSpecRule: SiteRule = {
    domain: 'comong.info',
    name: 'Cổ Mộng',
    contentSelector: '.page-description, .story-content, .reading-content, .entry-content',
    titleSelector: 'h1:not(.story-title), .chapter-title, .entry-title',
    nextSelector: '.wpc-nav-next a, .wpc-nav-next .wpc-nav-link, a.next-chapter, .nav-next a',
    tocSelector: '.chapter-item a, .list-chapter li a',
    paginationSelector: '.pagination a.next, .pagination-next, .nav-pagination a.next, a.page-numbers.next',
    excludeSelectors: [
      '.w2w_read_more',
      '.wpc-chapter-nav-simple',
      '.story-title',
      '#comments',
      '.comments-area',
      '.kk-star-ratings',
      '.gap-element',
      '.ads',
      '.adsbygoogle',
      '.header-content',
      '.footer-content',
      '.post-ad'
    ],
    isPreset: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000
  };

  // =========================================================================
  // Tier 1: Feature Coverage (Happy Path for comong.info)
  // =========================================================================
  describe('Tier 1: Feature Coverage', () => {
    it('T1.1: Should extract full Table of Contents (TOC) using .chapter-item a inside .chapter-row', () => {
      const tocHtml = `
        <div class="chapter-list-container">
          <div class="chapter-list-grid">
            <div class="chapter-row">
              <div class="chapter-item"><a href="https://comong.info/chapter/chuong-1-2526/">Chương 1: Chọn Chồng</a></div>
              <div class="chapter-item"><a href="https://comong.info/chapter/chuong-2-2523/">Chương 2: Hòa Ly</a></div>
            </div>
            <div class="chapter-row">
              <div class="chapter-item"><a href="https://comong.info/chapter/chuong-3-2518/">Chương 3: Rời Khỏi Tướng Phủ</a></div>
              <div class="chapter-item"><a href="https://comong.info/chapter/chuong-4-2007/">Chương 4: Gặp Lại Cố Nhân</a></div>
            </div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(tocHtml, 'text/html');
      const { chapters } = extractTocFromDocument(doc, comongSpecRule);

      expect(chapters).toHaveLength(4);
      expect(chapters[0].title).toBe('Chương 1: Chọn Chồng');
      expect(chapters[0].url).toBe('https://comong.info/chapter/chuong-1-2526/');
      expect(chapters[0].chapterNumber).toBe(1);

      expect(chapters[1].title).toBe('Chương 2: Hòa Ly');
      expect(chapters[1].url).toBe('https://comong.info/chapter/chuong-2-2523/');
      expect(chapters[1].chapterNumber).toBe(2);

      expect(chapters[3].title).toBe('Chương 4: Gặp Lại Cố Nhân');
      expect(chapters[3].url).toBe('https://comong.info/chapter/chuong-4-2007/');
      expect(chapters[3].chapterNumber).toBe(4);
    });

    it('T1.2: Should extract chapter content from .page-description without outer layout elements', () => {
      const chapterHtml = `
        <main id="main">
          <div id="content">
            <div class="col-inner text-center">
              <h1 class="story-title"><a href="https://comong.info/novel/muoi-muoi/">Muội Muội Chọn Chồng</a></h1>
              <h1 style="">Chương 1: Mở đầu</h1>
            </div>
            <div class="page-description">
              <p>Muội muội từ nhỏ đã biết tính toán.</p>
              <p>Mẫu thân sợ thiên vị nên mỗi lần chia đồ đều để tỷ muội chúng ta luân phiên chọn trước.</p>
              <p>Kiếp trước, nàng chọn gả cho Thám hoa lang tuấn tú tài hoa.</p>
            </div>
            <div class="comments-area">Bình luận của độc giả...</div>
          </div>
        </main>
      `;
      const doc = new DOMParser().parseFromString(chapterHtml, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-1', comongSpecRule);

      expect(result.content).toContain('Muội muội từ nhỏ đã biết tính toán.');
      expect(result.content).toContain('Kiếp trước, nàng chọn gả cho Thám hoa lang tuấn tú tài hoa.');
      expect(result.content).not.toContain('Bình luận của độc giả');
    });

    it('T1.3: Should isolate chapter title (h1:not(.story-title)) without colliding with novel title (h1.story-title)', () => {
      const chapterHtml = `
        <div id="content">
          <h1 class="story-title">
            <a href="https://comong.info/novel-slug/">Tên Tiểu Thuyết Gốc Cổ Mộng</a>
          </h1>
          <h1 style="">Chương 1: Trọng sinh trở về</h1>
          <div class="page-description">
            <p>Nội dung câu chuyện...</p>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(chapterHtml, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-1', comongSpecRule);

      expect(result.title).toBe('Chương 1: Trọng sinh trở về');
      expect(result.title).not.toBe('Tên Tiểu Thuyết Gốc Cổ Mộng');
    });

    it('T1.4: Should detect next chapter URL via .wpc-nav-next a with link text containing right arrow', () => {
      const chapterHtml = `
        <div id="content">
          <h1 style="">Chương 1</h1>
          <div class="page-description"><p>Nội dung...</p></div>
          <div class="wpc-chapter-nav-simple">
            <div class="wpc-nav-prev"><span class="wpc-nav-disabled">← Chương trước</span></div>
            <div class="wpc-nav-next">
              <a href="https://comong.info/chapter/chuong-2-2523/" class="wpc-nav-link">Chương tiếp →</a>
            </div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(chapterHtml, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-1', comongSpecRule);

      expect(result.nextUrl).toBe('https://comong.info/chapter/chuong-2-2523/');
    });

    it('T1.5: Should validate comong.info site rule preset exists and identifies comong domain', () => {
      const preset = DEFAULT_SITE_RULES.find((r) => r.domain === 'comong.info');
      expect(preset).toBeDefined();
      expect(preset?.domain).toBe('comong.info');
      expect(preset?.name).toBe('Cổ Mộng');
      expect(preset?.tocSelector).toContain('.chapter-item a');
    });
  });

  // =========================================================================
  // Tier 2: Boundary & Corner Cases
  // =========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('T2.1: Empty Table of Contents should return 0 chapters without throwing', () => {
      const emptyTocHtml = `
        <div class="chapter-list-container">
          <div class="chapter-list-grid">
            <!-- No chapter-row or chapter-item elements yet -->
            <p class="no-chapters">Truyện đang được cập nhật, chưa có chương nào.</p>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(emptyTocHtml, 'text/html');
      const { chapters, nextPaginationUrl } = extractTocFromDocument(doc, comongSpecRule);

      expect(chapters).toEqual([]);
      expect(nextPaginationUrl).toBeUndefined();
    });

    it('T2.2: 1-chapter novel should extract chapter 1 and return undefined nextUrl', () => {
      const singleChapterHtml = `
        <div id="content">
          <h1 style="">Chương 1: Đoản văn duy nhất</h1>
          <div class="page-description">
            <p>Đây là một câu chuyện ngắn chỉ vỏn vẹn trong một chương duy nhất.</p>
          </div>
          <!-- No next button exists on single-chapter story -->
        </div>
      `;
      const doc = new DOMParser().parseFromString(singleChapterHtml, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-1', comongSpecRule);

      expect(result.title).toBe('Chương 1: Đoản văn duy nhất');
      expect(result.content).toContain('Đây là một câu chuyện ngắn');
      expect(result.nextUrl).toBeUndefined();
      expect(result.isLocked).toBe(false);
    });

    it('T2.3: Final chapter with disabled next button (.wpc-nav-disabled) should resolve nextUrl as undefined', () => {
      const finalChapterHtml = `
        <div id="content">
          <h1 style="">Chương 100: Đại Kết Cục</h1>
          <div class="page-description">
            <p>Hắn nắm tay nàng, mỉm cười nhìn non sông gấm vóc.</p>
            <p>Hết truyện.</p>
          </div>
          <div class="wpc-chapter-nav-simple">
            <div class="wpc-nav-prev"><a href="https://comong.info/chapter/chuong-99/">← Chương trước</a></div>
            <div class="wpc-nav-next">
              <span class="wpc-nav-disabled">Chương tiếp →</span>
            </div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(finalChapterHtml, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-100', comongSpecRule);

      expect(result.title).toBe('Chương 100: Đại Kết Cục');
      expect(result.nextUrl).toBeUndefined();
    });

    it('T2.4: Should strip collapsible read-more buttons (.w2w_read_more) from novel content', () => {
      const chapterWithReadMore = `
        <div id="content">
          <h1 style="">Chương 5: Bão táp</h1>
          <div class="page-description">
            <p>Gió rít gào qua khe cửa sổ gỗ mun.</p>
            <p>Bóng đen lướt qua trong đêm tối tĩnh mịch.</p>
            <div class="w2w_read_more readmore_close_button display-none">
              <a class="button"><span>Thu gọn nội dung </span><i class="icon-angle-up"></i></a>
            </div>
            <div class="w2w_read_more readmore_open_button" style="display:none">
              <a class="button"><span>Xem thêm nội dung </span><i class="icon-angle-down"></i></a>
            </div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(chapterWithReadMore, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-5', comongSpecRule);

      expect(result.content).toContain('Gió rít gào qua khe cửa sổ gỗ mun.');
      expect(result.content).toContain('Bóng đen lướt qua trong đêm tối tĩnh mịch.');
      expect(result.content).not.toContain('Thu gọn nội dung');
      expect(result.content).not.toContain('Xem thêm nội dung');
    });

    it('T2.5: Next chapter link navigation should support various Unicode arrows and symbols', () => {
      const arrows = ['→', '»', '>', '›'];

      for (const arrow of arrows) {
        const html = `
          <div id="content">
            <h1 class="entry-title">Chương 1</h1>
            <div class="reading-content"><p>Nội dung...</p></div>
            <div class="wpc-nav-next">
              <a href="https://comong.info/chapter/next" class="wpc-nav-link">Chương tiếp ${arrow}</a>
            </div>
          </div>
        `;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const result = extractChapterWithRule(doc, 'https://comong.info/chapter/current', comongSpecRule);
        expect(result.nextUrl).toBe('https://comong.info/chapter/next');
      }
    });

    it('T2.6: Should gracefully extract when HTML is malformed (unclosed tags, unexpected wrappers)', () => {
      const malformedHtml = `
        <div id="content">
          <h1 style="">Chương 7: Dị biến
          <div class="page-description">
            <p>Đoạn văn bị thiếu thẻ đóng p
            <p>Đoạn văn tiếp theo <b>vẫn hiển thị tốt</b>
          </div>
          <div class="wpc-nav-next"><a href="https://comong.info/chapter/chuong-8" class="wpc-nav-link">Chương tiếp →</a>
      `;
      const doc = new DOMParser().parseFromString(malformedHtml, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-7', comongSpecRule);

      expect(result.title).toContain('Chương 7: Dị biến');
      expect(result.content).toContain('Đoạn văn bị thiếu thẻ đóng p');
      expect(result.content).toContain('Đoạn văn tiếp theo vẫn hiển thị tốt');
      expect(result.nextUrl).toBe('https://comong.info/chapter/chuong-8');
    });

    it('T2.7: Should extract content even if only fallback heuristic is used without preset rule', () => {
      const chapterHtml = `
        <main>
          <h1>Chương 1: Khởi đầu mới</h1>
          <div class="page-description">
            <p>Ánh nắng ban mai xuyên qua tàng cây rọi xuống thềm đá xanh rêu phong cổ kính.</p>
            <p>Một bóng người thon thả đứng trước sơn môn lộng gió ngắm nhìn biển mây trập trùng.</p>
            <p>Hành trình tu tiên từ đây chính thức bắt đầu bước sang một trang sử hào hùng mới.</p>
          </div>
          <a class="wpc-nav-link" href="https://comong.info/chapter/chuong-2">Chương tiếp</a>
        </main>
      `;
      const doc = new DOMParser().parseFromString(chapterHtml, 'text/html');
      const result = extractChapterHeuristically(doc, 'https://comong.info/chapter/chuong-1');

      expect(result.title).toBe('Chương 1: Khởi đầu mới');
      expect(result.content).toContain('Ánh nắng ban mai');
    });
  });

  // =========================================================================
  // Tier 3: Cross-Feature Integration (TOC -> Extract -> Sanitize -> Sort)
  // =========================================================================
  describe('Tier 3: Cross-Feature Pipeline', () => {
    it('T3.1: Should execute full TOC parsing, extract individual chapters, and natural sort them', () => {
      // 1. Parse TOC
      const tocHtml = `
        <div class="chapter-list-grid">
          <div class="chapter-row">
            <div class="chapter-item"><a href="https://comong.info/c1">Chương 1: Mở màn</a></div>
            <div class="chapter-item"><a href="https://comong.info/c10">Chương 10: Thập toàn</a></div>
            <div class="chapter-item"><a href="https://comong.info/c2">Chương 2: Tiếp nối</a></div>
          </div>
        </div>
      `;
      const tocDoc = new DOMParser().parseFromString(tocHtml, 'text/html');
      const { chapters: tocChapters } = extractTocFromDocument(tocDoc, comongSpecRule);

      expect(tocChapters).toHaveLength(3);

      // 2. Simulate extracting chapter content for each
      const simulatedChapters: Chapter[] = tocChapters.map((tc, idx) => {
        const chapterHtml = `
          <div id="content">
            <h1 style="">${tc.title}</h1>
            <div class="page-description">
              <p>Nội dung chi tiết của ${tc.title}.</p>
            </div>
          </div>
        `;
        const cDoc = new DOMParser().parseFromString(chapterHtml, 'text/html');
        const extracted = extractChapterWithRule(cDoc, tc.url, comongSpecRule);

        return {
          id: idx + 1,
          novelId: 101,
          chapterNumber: 0,
          title: extracted.title,
          url: tc.url,
          content: extracted.content,
          wordCount: 8,
          status: 'completed'
        };
      });

      // 3. Natural sort
      const sorted = naturalSortChapters(simulatedChapters);
      expect(sorted[0].title).toBe('Chương 1: Mở màn');
      expect(sorted[1].title).toBe('Chương 2: Tiếp nối');
      expect(sorted[2].title).toBe('Chương 10: Thập toàn');
    });
  });

  // =========================================================================
  // Tier 4: Real-World Scenarios (Authentic comong.info HTML Fixtures)
  // =========================================================================
  describe('Tier 4: Real-World Scenarios', () => {
    it('T4.1: Authentic comong.info multi-chapter crawl sequence simulation', () => {
      // Chapter 1 Realistic Fixture
      const ch1Html = `
        <div id="wrapper">
          <main id="main">
            <div id="content">
              <div class="gap-element" style="display:block; height:auto; padding-top:15px"></div>
              <div class="col-inner text-center">
                <h1 class="story-title"><a href="https://comong.info/muoi-muoi-chon-chong-ta-chon-hoa-ly/">Muội Muội Chọn Chồng, Ta Chọn Hòa Ly</a></h1>
                <h1 style="">Chương 1</h1>
              </div>
              <div class="wpc-chapter-nav-simple">
                <div class="wpc-nav-prev"><span class="wpc-nav-disabled">← Chương trước</span></div>
                <div class="wpc-chapter-select">
                  <select><option selected>Chương 1</option><option>Chương 2</option></select>
                </div>
                <div class="wpc-nav-next"><a href="https://comong.info/chapter/chuong-2-2523/" class="wpc-nav-link">Chương tiếp →</a></div>
              </div>
              <div class="page-description" style="font-size: 26px; position: relative; overflow: hidden; margin-bottom: 20px;">
                <p>Muội muội từ nhỏ đã biết tính toán.</p>
                <p>Mẫu thân sợ thiên vị nên mỗi lần chia đồ đều để tỷ muội chúng ta luân phiên chọn trước.</p>
                <div class="w2w_read_more readmore_close_button display-none"><a class="button"><span>Thu gọn nội dung </span></a></div>
              </div>
              <div class="comments-area" id="comments"><h3>Bình luận</h3></div>
            </div>
          </main>
        </div>
      `;

      // Chapter 2 Realistic Fixture
      const ch2Html = `
        <div id="wrapper">
          <main id="main">
            <div id="content">
              <div class="col-inner text-center">
                <h1 class="story-title"><a href="https://comong.info/muoi-muoi-chon-chong-ta-chon-hoa-ly/">Muội Muội Chọn Chồng, Ta Chọn Hòa Ly</a></h1>
                <h1 style="">Chương 2</h1>
              </div>
              <div class="wpc-chapter-nav-simple">
                <div class="wpc-nav-prev"><a href="https://comong.info/chapter/chuong-1-2526/" class="wpc-nav-link">← Chương trước</a></div>
                <div class="wpc-nav-next"><span class="wpc-nav-disabled">Chương tiếp →</span></div>
              </div>
              <div class="page-description">
                <p>Ngày đại hôn của muội muội, cả kinh thành rợp bóng cờ hoa.</p>
                <p>Ta ngồi trong kiệu hoa đơn sơ, lặng lẽ rời khỏi thành môn.</p>
              </div>
            </div>
          </main>
        </div>
      `;

      // Crawl Step 1: Extract Chapter 1
      const doc1 = new DOMParser().parseFromString(ch1Html, 'text/html');
      const res1 = extractChapterWithRule(doc1, 'https://comong.info/chapter/chuong-1-2526/', comongSpecRule);

      expect(res1.title).toBe('Chương 1');
      expect(res1.content).toContain('Muội muội từ nhỏ đã biết tính toán.');
      expect(res1.content).not.toContain('Bình luận');
      expect(res1.content).not.toContain('Thu gọn nội dung');
      expect(res1.nextUrl).toBe('https://comong.info/chapter/chuong-2-2523/');

      // Crawl Step 2: Follow nextUrl to Chapter 2
      const doc2 = new DOMParser().parseFromString(ch2Html, 'text/html');
      const res2 = extractChapterWithRule(doc2, res1.nextUrl!, comongSpecRule);

      expect(res2.title).toBe('Chương 2');
      expect(res2.content).toContain('Ngày đại hôn của muội muội, cả kinh thành rợp bóng cờ hoa.');
      expect(res2.nextUrl).toBeUndefined(); // Reached end of novel
    });
  });
});
