import { describe, it, expect } from 'vitest';
import { extractChapterWithRule, extractTocWithRule, extractTocFromDocument, resolveUrl } from '../lib/extractor';
import { extractChapterHeuristically, findChapterTitle, findNextChapterUrl } from '../lib/extractor/heuristic';
import { DEFAULT_SITE_RULES } from '../lib/db/presets';
import type { SiteRule } from '../lib/types';

describe('Empirical Adversarial Challenge: comong.info DOM Extraction', () => {
  const comongRule = DEFAULT_SITE_RULES.find((r) => r.domain === 'comong.info') as SiteRule;

  expect(comongRule).toBeDefined();

  // =========================================================================
  // Challenge 1: Multiple <h1> tags and Header Hierarchies
  // =========================================================================
  describe('Challenge 1: Multiple <h1> tags & Header Hierarchies', () => {
    it('C1.1: Standard comong layout (h1.story-title vs unclassed h1 chapter title)', () => {
      const html = `
        <div id="wrapper">
          <div class="col-inner text-center">
            <h1 class="story-title"><a href="https://comong.info/novel/truyen-1/">Tên Tiểu Thuyết Gốc</a></h1>
            <h1 style="">Chương 1: Mở Đầu Hành Trình</h1>
          </div>
          <div class="page-description">
            <p>Nội dung chương 1...</p>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c1', comongRule);

      expect(result.title).toBe('Chương 1: Mở Đầu Hành Trình');
      expect(result.title).not.toContain('Tên Tiểu Thuyết Gốc');
    });

    it('C1.2: Adversarial: Header contains site logo/branding h1.site-title before chapter content', () => {
      const html = `
        <header id="header">
          <div class="header-inner">
            <h1 class="site-title"><a href="https://comong.info/">Cổ Mộng - Đọc Truyện Online</a></h1>
          </div>
        </header>
        <main id="main">
          <div class="col-inner text-center">
            <h1 class="story-title"><a href="https://comong.info/novel/truyen-1/">Tên Tiểu Thuyết Gốc</a></h1>
            <h1 class="chapter-title">Chương 1: Bắt Đầu</h1>
          </div>
          <div class="page-description">
            <p>Nội dung chương 1...</p>
          </div>
        </main>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c1', comongRule);

      // We evaluate whether site branding h1 leaked into chapter title or if chapter title is preserved
      console.log('C1.2 Extracted title with site-title header:', result.title);
      // Site branding in header is excluded; chapter title is correctly captured:
      expect(result.title).toBe('Chương 1: Bắt Đầu');
    });

    it('C1.3: Nested inline elements inside chapter title h1', () => {
      const html = `
        <div class="col-inner text-center">
          <h1 class="story-title"><a href="https://comong.info/novel/slug/">Tiểu Thuyết Hay</a></h1>
          <h1><span>Chương 15:</span> <em>Trở Về Cố Hương</em> <small>(Thượng)</small></h1>
        </div>
        <div class="page-description">
          <p>Nội dung chương 15...</p>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c15', comongRule);

      expect(result.title).toBe('Chương 15: Trở Về Cố Hương (Thượng)');
    });

    it('C1.4: Adversarial: Trailing widget / comments h1 after novel content', () => {
      const html = `
        <div class="col-inner text-center">
          <h1 class="story-title"><a href="...">Tên Truyện</a></h1>
          <h1>Chương 20: Đại Chiến</h1>
        </div>
        <div class="page-description">
          <p>Nội dung trận chiến kịch tính...</p>
        </div>
        <div class="comments-section">
          <h1 class="comments-title">Bình luận độc giả</h1>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c20', comongRule);

      expect(result.title).toBe('Chương 20: Đại Chiến');
    });

    it('C1.5: Chapter title with h1.entry-title or .chapter-title without generic h1', () => {
      const html = `
        <div class="col-inner text-center">
          <h1 class="story-title"><a href="...">Tên Truyện</a></h1>
          <h2 class="chapter-title">Chương 30: Hồi Kết</h2>
        </div>
        <div class="page-description">
          <p>Nội dung hồi kết...</p>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c30', comongRule);

      expect(result.title).toBe('Chương 30: Hồi Kết');
    });
  });

  // =========================================================================
  // Challenge 2: Collapsible Readmore Buttons & Navigation Wrappers
  // =========================================================================
  describe('Challenge 2: Collapsible Readmore Buttons & Navigation Wrappers', () => {
    it('C2.1: Strips .w2w_read_more with both close and open buttons embedded in .page-description', () => {
      const html = `
        <div class="page-description">
          <p>Đoạn mở đầu của câu chuyện ngôn tình cổ đại.</p>
          <div class="w2w_read_more readmore_close_button display-none">
            <a class="button"><span>Thu gọn nội dung </span><i class="icon-angle-up"></i></a>
          </div>
          <p>Đoạn thân bài nằm giữa hai nút xem thêm và thu gọn.</p>
          <div class="w2w_read_more readmore_open_button" style="display:none">
            <a class="button"><span>Xem thêm nội dung </span><i class="icon-angle-down"></i></a>
          </div>
          <p>Đoạn kết thúc chương hoàn chỉnh.</p>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/c1', comongRule);

      expect(result.content).toContain('Đoạn mở đầu của câu chuyện ngôn tình cổ đại.');
      expect(result.content).toContain('Đoạn thân bài nằm giữa hai nút xem thêm và thu gọn.');
      expect(result.content).toContain('Đoạn kết thúc chương hoàn chỉnh.');
      expect(result.content).not.toContain('Thu gọn nội dung');
      expect(result.content).not.toContain('Xem thêm nội dung');
      expect(result.content).not.toContain('w2w_read_more');
    });

    it('C2.2: Strips inline navigation wrapper (.wpc-chapter-nav-simple) when nested inside content container', () => {
      const html = `
        <div class="page-description">
          <p>Nội dung chương chính thống.</p>
          <div class="wpc-chapter-nav-simple">
            <div class="wpc-nav-prev"><a href="/c1" class="wpc-nav-link">← Chương trước</a></div>
            <div class="wpc-chapter-select"><select><option>Chương 2</option></select></div>
            <div class="wpc-nav-next"><a href="/c3" class="wpc-nav-link">Chương tiếp →</a></div>
          </div>
          <p>Lời bạt của tác giả sau chương.</p>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/c2', comongRule);

      expect(result.content).toContain('Nội dung chương chính thống.');
      expect(result.content).toContain('Lời bạt của tác giả sau chương.');
      expect(result.content).not.toContain('Chương trước');
      expect(result.content).not.toContain('Chương tiếp');
    });

    it('C2.3: Preserves novel paragraphs and formatting when ads and readmore buttons are intermingled', () => {
      const html = `
        <div class="story-content">
          <p>Thiếu nữ bước từng bước nhẹ nhàng vào đại điện.</p>
          <div class="ads adsbygoogle"><ins>Quảng cáo Google</ins></div>
          <div class="post-ad"><p>Quảng cáo banner tài trợ</p></div>
          <p>Gió lay động rèm châu lấp lánh dưới ánh nến hoàng hôn.</p>
          <div class="w2w_read_more"><button>Đọc tiếp...</button></div>
          <p>Nàng khẽ nâng mắt nhìn vị đế vương uy nghiêm phía trên ngai vàng.</p>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/c1', comongRule);

      expect(result.content).toContain('Thiếu nữ bước từng bước nhẹ nhàng vào đại điện.');
      expect(result.content).toContain('Gió lay động rèm châu lấp lánh dưới ánh nến hoàng hôn.');
      expect(result.content).toContain('Nàng khẽ nâng mắt nhìn vị đế vương uy nghiêm phía trên ngai vàng.');
      expect(result.content).not.toContain('Quảng cáo Google');
      expect(result.content).not.toContain('Quảng cáo banner tài trợ');
      expect(result.content).not.toContain('Đọc tiếp...');
    });
  });

  // =========================================================================
  // Challenge 3: Chapter Grid with Multiple Rows & Relative URLs
  // =========================================================================
  describe('Challenge 3: Chapter Grid with Multiple Rows & Relative URLs', () => {
    it('C3.1: Extracts all chapters across multiple rows with root-relative and path-relative URLs', () => {
      const tocHtml = `
        <div class="chapter-list-container">
          <div class="chapter-list-grid">
            <div class="chapter-row">
              <div class="chapter-item"><a href="/chapter/chuong-1-1001/">Chương 1: Khởi nguồn</a></div>
              <div class="chapter-item"><a href="/chapter/chuong-2-1002/">Chương 2: Ly biệt</a></div>
            </div>
            <div class="chapter-row">
              <div class="chapter-item"><a href="chuong-3-1003/">Chương 3: Trắc trở</a></div>
              <div class="chapter-item"><a href="./chuong-4-1004/">Chương 4: Phong ba</a></div>
            </div>
            <div class="chapter-row">
              <div class="chapter-item"><a href="https://comong.info/chapter/chuong-5-1005/">Chương 5: Trùng phùng</a></div>
              <div class="chapter-item"><a href="/chapter/chuong-6-1006/?ref=toc">Chương 6: Tương kiến</a></div>
            </div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(tocHtml, 'text/html');
      const baseUrl = 'https://comong.info/novel/co-mong-truyen/';
      const result = extractTocWithRule(doc, comongRule, baseUrl);

      expect(result).toHaveLength(6);
      expect(result[0]).toEqual({
        title: 'Chương 1: Khởi nguồn',
        url: 'https://comong.info/chapter/chuong-1-1001/',
        chapterNumber: 1
      });
      expect(result[1]).toEqual({
        title: 'Chương 2: Ly biệt',
        url: 'https://comong.info/chapter/chuong-2-1002/',
        chapterNumber: 2
      });
      expect(result[2]).toEqual({
        title: 'Chương 3: Trắc trở',
        url: 'https://comong.info/novel/co-mong-truyen/chuong-3-1003/',
        chapterNumber: 3
      });
      expect(result[3]).toEqual({
        title: 'Chương 4: Phong ba',
        url: 'https://comong.info/novel/co-mong-truyen/chuong-4-1004/',
        chapterNumber: 4
      });
      expect(result[4]).toEqual({
        title: 'Chương 5: Trùng phùng',
        url: 'https://comong.info/chapter/chuong-5-1005/',
        chapterNumber: 5
      });
      expect(result[5]).toEqual({
        title: 'Chương 6: Tương kiến',
        url: 'https://comong.info/chapter/chuong-6-1006/?ref=toc',
        chapterNumber: 6
      });
    });

    it('C3.2: Deduplicates repeated chapter URLs in grid while preserving chapter numbering', () => {
      const tocHtml = `
        <div class="chapter-list-grid">
          <div class="chapter-row">
            <div class="chapter-item"><a href="/chapter/c1">Chương 1: Nhập môn</a></div>
            <div class="chapter-item"><a href="/chapter/c1">Chương 1: Nhập môn (bản sao)</a></div>
            <div class="chapter-item"><a href="/chapter/c2">Chương 2: Luyện khí</a></div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(tocHtml, 'text/html');
      const result = extractTocWithRule(doc, comongRule, 'https://comong.info/novel/slug/');

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Chương 1: Nhập môn');
      expect(result[0].chapterNumber).toBe(1);
      expect(result[1].title).toBe('Chương 2: Luyện khí');
      expect(result[1].chapterNumber).toBe(2);
    });

    it('C3.3: Ignores non-chapter or empty links in grid', () => {
      const tocHtml = `
        <div class="chapter-list-grid">
          <div class="chapter-row">
            <div class="chapter-item"><a href="javascript:void(0)">   </a></div>
            <div class="chapter-item"><a href="/chapter/c1">Chương 1: Khai màn</a></div>
            <div class="chapter-item"><a href=""></a></div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(tocHtml, 'text/html');
      const result = extractTocWithRule(doc, comongRule, 'https://comong.info/novel/slug/');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Chương 1: Khai màn');
    });

    it('C3.4: Nested span badges inside chapter anchor tags', () => {
      const tocHtml = `
        <div class="chapter-list-grid">
          <div class="chapter-row">
            <div class="chapter-item">
              <a href="/chapter/c1">
                <span class="chapter-index">Chương 1:</span>
                <span class="chapter-title">Gặp gỡ dưới mưa</span>
              </a>
            </div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(tocHtml, 'text/html');
      const result = extractTocWithRule(doc, comongRule, 'https://comong.info/novel/slug/');

      expect(result).toHaveLength(1);
      expect(result[0].title).toMatch(/Chương 1:\s+Gặp gỡ dưới mưa/);
      expect(result[0].url).toBe('https://comong.info/chapter/c1');
    });
  });

  // =========================================================================
  // Challenge 4: Single-Chapter Novel & Next URL Edge Cases
  // =========================================================================
  describe('Challenge 4: Single-Chapter Novel & Next URL Edge Cases', () => {
    it('C4.1: Single-chapter novel without any navigation block returns undefined nextUrl', () => {
      const html = `
        <div id="content">
          <h1 class="story-title"><a href="...">Truyện Ngắn</a></h1>
          <h1>Chương 1: Một Lần Và Mãi Mãi</h1>
          <div class="page-description">
            <p>Toàn bộ câu chuyện gói gọn trong một chương duy nhất này.</p>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c1', comongRule);

      expect(result.title).toBe('Chương 1: Một Lần Và Mãi Mãi');
      expect(result.nextUrl).toBeUndefined();
    });

    it('C4.2: Single-chapter / last chapter with disabled span (.wpc-nav-disabled) returns undefined nextUrl', () => {
      const html = `
        <div id="content">
          <h1>Chương 1: Kết thúc</h1>
          <div class="page-description"><p>Hết truyện.</p></div>
          <div class="wpc-chapter-nav-simple">
            <div class="wpc-nav-prev"><span class="wpc-nav-disabled">← Chương trước</span></div>
            <div class="wpc-nav-next"><span class="wpc-nav-disabled">Chương tiếp →</span></div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c1', comongRule);

      expect(result.nextUrl).toBeUndefined();
    });

    it('C4.3: Adversarial: Disabled next button rendered as anchor with href="#" or "javascript:void(0)"', () => {
      const html1 = `
        <div id="content">
          <h1>Chương 1: Độc nhất</h1>
          <div class="page-description"><p>Nội dung...</p></div>
          <div class="wpc-nav-next">
            <a href="javascript:void(0)" class="wpc-nav-link">Chương tiếp →</a>
          </div>
        </div>
      `;
      const doc1 = new DOMParser().parseFromString(html1, 'text/html');
      const res1 = extractChapterWithRule(doc1, 'https://comong.info/chapter/c1', comongRule);
      expect(res1.nextUrl).toBeUndefined();

      const html2 = `
        <div id="content">
          <h1>Chương 1: Độc nhất</h1>
          <div class="page-description"><p>Nội dung...</p></div>
          <div class="wpc-nav-next">
            <a href="#" class="wpc-nav-link">Chương tiếp →</a>
          </div>
        </div>
      `;
      const doc2 = new DOMParser().parseFromString(html2, 'text/html');
      const res2 = extractChapterWithRule(doc2, 'https://comong.info/chapter/c1', comongRule);
      // href="#" correctly evaluated as no next chapter:
      expect(res2.nextUrl).toBeUndefined();
    });

    it('C4.4: Adversarial: Next button linking to current chapter URL must return undefined', () => {
      const html = `
        <div id="content">
          <h1>Chương 1</h1>
          <div class="page-description"><p>Nội dung...</p></div>
          <div class="wpc-nav-next">
            <a href="https://comong.info/chapter/c1" class="wpc-nav-link">Chương tiếp →</a>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c1', comongRule);

      expect(result.nextUrl).toBeUndefined();
    });

    it('C4.5: Resolves relative next chapter URL against currentUrl', () => {
      const html = `
        <div id="content">
          <h1>Chương 1</h1>
          <div class="page-description"><p>Nội dung...</p></div>
          <div class="wpc-nav-next">
            <a href="/chapter/chuong-2-2523/" class="wpc-nav-link">Chương tiếp →</a>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-1-2526/', comongRule);

      expect(result.nextUrl).toBe('https://comong.info/chapter/chuong-2-2523/');
    });

    it('C4.6: Prev button should NOT be mistaken for next button even if selector order varies', () => {
      const html = `
        <div id="content">
          <h1>Chương 2</h1>
          <div class="page-description"><p>Nội dung...</p></div>
          <div class="wpc-chapter-nav-simple">
            <div class="wpc-nav-prev"><a href="/chapter/chuong-1/" class="wpc-nav-link">Chương trước ←</a></div>
            <div class="wpc-nav-next"><a href="/chapter/chuong-3/" class="wpc-nav-link">Chương sau →</a></div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-2/', comongRule);

      expect(result.nextUrl).toBe('https://comong.info/chapter/chuong-3/');
    });
  });

  // =========================================================================
  // Challenge 5: Contract Conformance & API Ergonomics
  // =========================================================================
  describe('Challenge 5: Contract Conformance & API Ergonomics', () => {
    it('C5.1: extractTocWithRule returns array and provides compatibility fields', () => {
      const tocHtml = `
        <div class="chapter-list-grid">
          <div class="chapter-row">
            <div class="chapter-item"><a href="/c1">Chương 1</a></div>
          </div>
        </div>
        <div class="pagination"><a class="next" href="/toc?page=2">Trang sau</a></div>
      `;
      const doc = new DOMParser().parseFromString(tocHtml, 'text/html');
      const res = extractTocWithRule(doc, comongRule, 'https://comong.info/novel/slug/');

      // Must be an Array
      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBe(1);
      expect(res[0].title).toBe('Chương 1');
      expect(res[0].url).toBe('https://comong.info/c1');
      expect(res[0].chapterNumber).toBe(1);

      // Must also have .chapters and .nextPaginationUrl
      expect(res.chapters).toBeDefined();
      expect(res.chapters).toHaveLength(1);
      expect(res.nextPaginationUrl).toBe('https://comong.info/toc?page=2');
    });
  });
});
