import { describe, it, expect } from 'vitest';
import {
  extractChapterWithRule,
  extractTocWithRule,
  extractTocFromDocument,
  resolveUrl,
  safeQuerySelector,
  safeQuerySelectorAll
} from '../lib/extractor';
import {
  findChapterTitle,
  findNextChapterUrl,
  extractChapterHeuristically
} from '../lib/extractor/heuristic';
import { sanitizeHtmlContent } from '../lib/sanitizer';
import { DEFAULT_SITE_RULES } from '../lib/db/presets';
import type { SiteRule } from '../lib/types';

describe('Challenger 4: Empirical Stress & Adversarial Verification for comong.info', () => {
  const comongRule = DEFAULT_SITE_RULES.find((r) => r.domain === 'comong.info') as SiteRule;

  expect(comongRule).toBeDefined();

  // =========================================================================
  // Section 1: C1.2 & Title Extraction Fidelity
  // =========================================================================
  describe('Section 1: Title Extraction Fidelity & Header Exclusion (C1.2 deep dive)', () => {
    it('CH4-T1: Excludes multi-class site branding header h1 (<h1 class="site-title logo branding">)', () => {
      const html = `
        <header id="masthead" class="site-header">
          <div class="site-branding">
            <h1 class="site-title logo branding"><a href="https://comong.info/">Cổ Mộng Truyện Hay</a></h1>
          </div>
        </header>
        <div id="content">
          <div class="col-inner text-center">
            <h1 class="story-title"><a href="/truyen/kiem-lai">Kiếm Lai</a></h1>
            <h1 class="chapter-title">Chương 101: Nhất Kiếm Phá Vạn Pháp</h1>
          </div>
          <div class="page-description">
            <p>Trần Bình An cất bước lên núi...</p>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c101', comongRule);

      expect(result.title).toBe('Chương 101: Nhất Kiếm Phá Vạn Pháp');
      expect(result.title).not.toContain('Cổ Mộng Truyện Hay');
      expect(result.title).not.toContain('Kiếm Lai');
    });

    it('CH4-T2: Unclassed <h1> chapter title preceded by <h1 class="logo"> and <h1 class="story-title">', () => {
      const html = `
        <header>
          <h1 class="logo"><img src="/logo.png" alt="Logo" />Trang chủ Cổ Mộng</h1>
        </header>
        <main>
          <div class="header-content">
            <h1 class="site-logo">Cổ Mộng</h1>
          </div>
          <div class="page-description-header">
            <h1 class="story-title">Tiên Nghịch</h1>
            <h1>Chương 50: Hóa Thần Chi Lộ</h1>
          </div>
          <div class="page-description">
            <p>Vương Lâm khoanh chân ngồi trên đỉnh núi...</p>
          </div>
        </main>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c50', comongRule);

      expect(result.title).toBe('Chương 50: Hóa Thần Chi Lộ');
      expect(result.title).not.toContain('Trang chủ Cổ Mộng');
      expect(result.title).not.toContain('Tiên Nghịch');
    });

    it('CH4-T3: Preserves complex Vietnamese titles with accents, subtitles, quotes, and punctuation', () => {
      const titleWithAccents = 'Chương 999: «Đại Kết Cục» — Hoàng Hôn Bi Tráng & Bình Minh Rực Rỡ (Phần 2: Hoàn Tất)';
      const html = `
        <div id="content">
          <h1 class="chapter-title">${titleWithAccents}</h1>
          <div class="page-description">
            <p>Kết thúc trọn vẹn trường thiên tiểu thuyết.</p>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c999', comongRule);

      expect(result.title).toBe(titleWithAccents);
    });

    it('CH4-T4: Handles noisy whitespace, line breaks, and nested badges within chapter title', () => {
      const html = `
        <div id="content">
          <h1 class="entry-title">
            \n\t   <span class="prefix">Chương 12:</span>
            \n\t   <span class="name">Dạ Vũ Đoạt Hồn</span>
            \n\t   <small class="badge">[VIP Miễn Phí]</small>\n
          </h1>
          <div class="page-description">
            <p>Mưa đêm rả rích khắp thành Lạc Dương...</p>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c12', comongRule);

      expect(result.title).toMatch(/Chương 12:\s+Dạ Vũ Đoạt Hồn\s+\[VIP Miễn Phí\]/);
      expect(result.title.startsWith('\n')).toBe(false);
      expect(result.title.endsWith('\n')).toBe(false);
    });

    it('CH4-T5: Heuristic fallback correctly excludes header branding when rule is null', () => {
      const html = `
        <header>
          <h1 class="site-title"><a href="/">Trang Chủ</a></h1>
          <h1 class="logo">Logo Website</h1>
        </header>
        <div class="main-content">
          <h1 class="story-title">Tên Truyện</h1>
          <h1 class="chapter-title">Chương 7: Rời Khỏi Tông Môn</h1>
          <p>Nội dung chương 7...</p>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c7', null);

      expect(result.title).toBe('Chương 7: Rời Khỏi Tông Môn');
      expect(result.title).not.toContain('Trang Chủ');
      expect(result.title).not.toContain('Logo Website');
    });
  });

  // =========================================================================
  // Section 2: C4.3 & Next URL Edge Cases
  // =========================================================================
  describe('Section 2: Next URL Edge Cases & Traversal Safety (C4.3 deep dive)', () => {
    it('CH4-N1: Multi-candidate navigation: first anchor is disabled href="#", second anchor is valid next URL', () => {
      // In some layouts, there might be a disabled dropdown or placeholder anchor followed by the real next anchor
      const html = `
        <div id="content">
          <h1>Chương 5</h1>
          <div class="page-description"><p>Nội dung...</p></div>
          <div class="wpc-nav-next">
            <a href="#" class="wpc-nav-link disabled-placeholder" style="display:none">Không có</a>
            <a href="/chapter/chuong-6" class="wpc-nav-link real-next">Chương tiếp →</a>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-5', comongRule);

      expect(result.nextUrl).toBe('https://comong.info/chapter/chuong-6');
    });

    it('CH4-N2: Case-insensitive javascript: anchors (JAVASCRIPT:void(0), JavaScript:;) return undefined', () => {
      const html = `
        <div id="content">
          <h1>Chương Cuối</h1>
          <div class="page-description"><p>Hết truyện.</p></div>
          <div class="wpc-nav-next">
            <a href="JAVASCRIPT:void(0);" class="wpc-nav-link">Hết truyện</a>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c-last', comongRule);

      expect(result.nextUrl).toBeUndefined();
    });

    it('CH4-N3: Self-referencing in-page fragment anchors (#top, #content, #comments) return undefined', () => {
      const fragments = ['#', '#top', '#content', '#comments', '#header', '#nav'];
      for (const frag of fragments) {
        const html = `
          <div id="content">
            <h1>Chương 1</h1>
            <div class="page-description"><p>Nội dung...</p></div>
            <div class="wpc-nav-next">
              <a href="${frag}" class="wpc-nav-link">Lên đầu trang</a>
            </div>
          </div>
        `;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c1', comongRule);

        expect(result.nextUrl).toBeUndefined();
      }
    });

    it('CH4-N4: Full URL self-reference with fragment (https://comong.info/chapter/c1#next) returns undefined', () => {
      const html = `
        <div id="content">
          <h1>Chương 1</h1>
          <div class="page-description"><p>Nội dung...</p></div>
          <div class="wpc-nav-next">
            <a href="https://comong.info/chapter/c1#next" class="wpc-nav-link">Chương tiếp</a>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c1', comongRule);

      expect(result.nextUrl).toBeUndefined();
    });

    it('CH4-N5: Candidate anchor text matching "quay lại" / "lùi" / "prev" / "trước" is skipped in favor of real next button', () => {
      const html = `
        <div id="content">
          <h1>Chương 3</h1>
          <div class="page-description"><p>Nội dung...</p></div>
          <div class="wpc-nav-next">
            <a href="/chapter/c2" class="wpc-nav-link">Quay lại mục lục</a>
            <a href="/chapter/c4" class="wpc-nav-link">Đi tới chương sau →</a>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c3', comongRule);

      expect(result.nextUrl).toBe('https://comong.info/chapter/c4');
    });

    it('CH4-N6: Whitespace-only href and empty href return undefined', () => {
      const html = `
        <div id="content">
          <h1>Chương 10</h1>
          <div class="page-description"><p>Nội dung...</p></div>
          <div class="wpc-nav-next">
            <a href="   " class="wpc-nav-link">Chương tiếp</a>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c10', comongRule);

      expect(result.nextUrl).toBeUndefined();
    });
  });

  // =========================================================================
  // Section 3: Read-More Button & Unwanted Element Exclusion
  // =========================================================================
  describe('Section 3: Read-More Button Exclusion & Novel Text Preservation', () => {
    it('CH4-R1: Strips .w2w_read_more with custom nested tags (<button>, <i>, <span>, <div>)', () => {
      const html = `
        <div class="page-description">
          <p>Mặt trời lặn dần sau rặng liễu biếc ven sông Tô Lịch.</p>
          <div class="w2w_read_more readmore_open_button">
            <button type="button" class="btn-toggle">
              <span class="btn-text">Xem thêm toàn bộ nội dung</span>
              <i class="fa fa-chevron-down"></i>
            </button>
          </div>
          <p>Nàng khẽ thở dài, tay vân vê tà áo lụa mỏng manh.</p>
          <div class="w2w_read_more readmore_close_button">
            <a href="javascript:void(0)"><span>Thu gọn nội dung</span></a>
          </div>
          <p>Tiếng chuông chùa ngân nga vọng lại từ xa báo hiệu canh ba.</p>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/c1', comongRule);

      expect(result.content).toContain('Mặt trời lặn dần sau rặng liễu biếc ven sông Tô Lịch.');
      expect(result.content).toContain('Nàng khẽ thở dài, tay vân vê tà áo lụa mỏng manh.');
      expect(result.content).toContain('Tiếng chuông chùa ngân nga vọng lại từ xa báo hiệu canh ba.');
      expect(result.content).not.toContain('Xem thêm');
      expect(result.content).not.toContain('Thu gọn');
      expect(result.content).not.toContain('btn-toggle');
    });

    it('CH4-R2: Legitimate dialogue containing "xem thêm" or "đọc tiếp" is NEVER stripped from novel text', () => {
      const html = `
        <div class="page-description">
          <p>Sư phụ nhìn hắn rồi dặn dò: "Hãy đọc tiếp bí kíp này khi ngươi đã đả thông kinh mạch."</p>
          <p>Tiểu sư muội cũng giục: "Huynh mau xem thêm một trang nữa đi xem kiếm pháp biến hóa thế nào!"</p>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/c1', comongRule);

      expect(result.content).toContain('Hãy đọc tiếp bí kíp này khi ngươi đã đả thông kinh mạch.');
      expect(result.content).toContain('Huynh mau xem thêm một trang nữa đi xem kiếm pháp biến hóa thế nào!');
    });

    it('CH4-R3: Strips multiple ad containers intermingled with novel content (.ads, .adsbygoogle, .post-ad, .header-content)', () => {
      const html = `
        <div class="page-description">
          <div class="header-content"><p>Header banner quảng cáo</p></div>
          <p>Đoạn 1: Mở màn cuộc quyết đấu đỉnh phong.</p>
          <div class="ads adsbygoogle"><ins>Google Ads</ins></div>
          <p>Đoạn 2: Kiếm khí tung hoành ba ngàn dặm.</p>
          <div class="post-ad">Banner liên kết cá cược</div>
          <p>Đoạn 3: Vạn kiếm quy tông khuynh đảo đất trời.</p>
          <div class="footer-content">Footer quảng cáo</div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/c1', comongRule);

      expect(result.content).toContain('Đoạn 1: Mở màn cuộc quyết đấu đỉnh phong.');
      expect(result.content).toContain('Đoạn 2: Kiếm khí tung hoành ba ngàn dặm.');
      expect(result.content).toContain('Đoạn 3: Vạn kiếm quy tông khuynh đảo đất trời.');
      expect(result.content).not.toContain('Google Ads');
      expect(result.content).not.toContain('Banner liên kết');
      expect(result.content).not.toContain('Header banner quảng cáo');
      expect(result.content).not.toContain('Footer quảng cáo');
    });
  });

  // =========================================================================
  // Section 4: TOC Relative URL Resolution
  // =========================================================================
  describe('Section 4: Table of Contents (TOC) Relative URL Resolution & Grid Robustness', () => {
    it('CH4-TOC1: Resolves root-relative (/chapter/c1), relative (c2/), dot-relative (./c3/), and parent-relative (../chapter/c4/)', () => {
      const tocHtml = `
        <div class="chapter-list-grid">
          <div class="chapter-row">
            <div class="chapter-item"><a href="/chapter/c1/">Chương 1</a></div>
            <div class="chapter-item"><a href="c2/">Chương 2</a></div>
            <div class="chapter-item"><a href="./c3/">Chương 3</a></div>
            <div class="chapter-item"><a href="../c4/">Chương 4</a></div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(tocHtml, 'text/html');
      const baseUrl = 'https://comong.info/novel/kiem-lai/';
      const result = extractTocWithRule(doc, comongRule, baseUrl);

      expect(result).toHaveLength(4);
      expect(result[0].url).toBe('https://comong.info/chapter/c1/');
      expect(result[1].url).toBe('https://comong.info/novel/kiem-lai/c2/');
      expect(result[2].url).toBe('https://comong.info/novel/kiem-lai/c3/');
      expect(result[3].url).toBe('https://comong.info/novel/c4/');
    });

    it('CH4-TOC2: Resolves URLs with base element in document (<base href="...">)', () => {
      const tocHtml = `
        <head>
          <base href="https://comong.info/truyen-moi/">
        </head>
        <body>
          <div class="chapter-list-grid">
            <div class="chapter-item"><a href="chuong-1">Chương 1</a></div>
            <div class="chapter-item"><a href="/toan-bo/chuong-2">Chương 2</a></div>
          </div>
        </body>
      `;
      const doc = new DOMParser().parseFromString(tocHtml, 'text/html');
      // When baseUrl not passed to extractTocFromDocument, it uses document's <base href>
      const { chapters } = extractTocFromDocument(doc, comongRule);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].url).toBe('https://comong.info/truyen-moi/chuong-1');
      expect(chapters[1].url).toBe('https://comong.info/toan-bo/chuong-2');
    });

    it('CH4-TOC3: Preserves query parameters and cleans fragment-only / dummy anchors', () => {
      const tocHtml = `
        <div class="chapter-list-grid">
          <div class="chapter-row">
            <div class="chapter-item"><a href="#">Mục Lục Chương</a></div>
            <div class="chapter-item"><a href="javascript:void(0)">Đang cập nhật</a></div>
            <div class="chapter-item"><a href="/chapter/c1?view=desktop&page=1">Chương 1: Mở màn</a></div>
            <div class="chapter-item"><a href="/chapter/c2#heading-1">Chương 2: Tiến bước</a></div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(tocHtml, 'text/html');
      const result = extractTocWithRule(doc, comongRule, 'https://comong.info/novel/truyen-1/');

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Chương 1: Mở màn');
      expect(result[0].url).toBe('https://comong.info/chapter/c1?view=desktop&page=1');
      expect(result[0].chapterNumber).toBe(1);

      expect(result[1].title).toBe('Chương 2: Tiến bước');
      expect(result[1].url).toBe('https://comong.info/chapter/c2#heading-1');
      expect(result[1].chapterNumber).toBe(2);
    });

    it('CH4-TOC4: Handles encoded and raw UTF-8 Vietnamese slug URLs in TOC correctly', () => {
      const tocHtml = `
        <div class="chapter-list-grid">
          <div class="chapter-row">
            <div class="chapter-item"><a href="/chapter/ch%C6%B0%C6%A1ng-1-b%E1%BA%AFt-%C4%91%E1%BA%A7u/">Chương 1</a></div>
            <div class="chapter-item"><a href="/chapter/chương-2-hồi-kết/">Chương 2</a></div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(tocHtml, 'text/html');
      const result = extractTocWithRule(doc, comongRule, 'https://comong.info/novel/truyen/');

      expect(result).toHaveLength(2);
      expect(result[0].url).toContain('/chapter/ch%C6%B0%C6%A1ng-1-b%E1%BA%AFt-%C4%91%E1%BA%A7u/');
      expect(result[1].url).toContain('/chapter/');
      expect(result[0].chapterNumber).toBe(1);
      expect(result[1].chapterNumber).toBe(2);
    });

    it('CH4-TOC5: Correctly extracts pagination next page with relative URL', () => {
      const tocHtml = `
        <div class="chapter-list-grid">
          <div class="chapter-row">
            <div class="chapter-item"><a href="/chapter/c1">Chương 1</a></div>
          </div>
        </div>
        <div class="nav-pagination">
          <a class="page-numbers" href="/novel/truyen/page/1">1</a>
          <a class="next page-numbers" href="page/2/">Trang sau →</a>
        </div>
      `;
      const doc = new DOMParser().parseFromString(tocHtml, 'text/html');
      const result = extractTocWithRule(doc, comongRule, 'https://comong.info/novel/truyen/');

      expect(result.nextPaginationUrl).toBe('https://comong.info/novel/truyen/page/2/');
    });
  });
});
