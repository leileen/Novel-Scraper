import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  safeQuerySelector,
  safeQuerySelectorAll,
  resolveUrl,
  extractChapterWithRule,
  extractTocFromDocument,
  extractTocWithRule
} from '../lib/extractor';
import {
  findContentContainer,
  findChapterTitle,
  findNextChapterUrl,
  isChapterLocked,
  extractChapterHeuristically,
  CHAPTER_TITLE_REGEX,
  NEXT_LINK_REGEX
} from '../lib/extractor/heuristic';
import {
  sanitizeHtmlContent,
  normalizeUnicodeAndCleanChars,
  removeAdLines,
  formatParagraphs,
  countWords,
  UNWANTED_TAGS
} from '../lib/sanitizer';
import { DEFAULT_SITE_RULES } from '../lib/db/presets';
import type { SiteRule } from '../lib/types';

// Mock DB for rules testing without browser IndexedDB
const mockRulesStore = new Map<number, SiteRule>();
let nextRuleId = 1;

vi.mock('../lib/db', () => {
  return {
    db: {
      siteRules: {
        get: vi.fn(async (id: number) => mockRulesStore.get(id)),
        where: (field: string) => ({
          equals: (val: any) => ({
            first: async () => {
              for (const r of mockRulesStore.values()) {
                if ((r as any)[field] === val) return r;
              }
              return undefined;
            }
          })
        }),
        toArray: vi.fn(async () => Array.from(mockRulesStore.values())),
        add: vi.fn(async (rule: SiteRule) => {
          const id = nextRuleId++;
          const saved = { ...rule, id };
          mockRulesStore.set(id, saved);
          return id;
        }),
        update: vi.fn(async (id: number, updates: Partial<SiteRule>) => {
          const existing = mockRulesStore.get(id);
          if (existing) {
            Object.assign(existing, updates);
            mockRulesStore.set(id, existing);
          }
          return 1;
        }),
        delete: vi.fn(async (id: number) => {
          mockRulesStore.delete(id);
          return 1;
        })
      }
    }
  };
});

import {
  extractDomainFromUrl,
  getRuleForDomain,
  saveSiteRule,
  deleteSiteRule,
  exportRulesToJson,
  importRulesFromJson
} from '../lib/rules';
import {
  t,
  setLanguage,
  getCurrentLanguage,
  getInitialLanguage,
  onLanguageChange
} from '../lib/i18n';

describe('Tier 5 Adversarial Coverage Hardening: Extractor, Sanitizer, Rules & Presets', () => {
  beforeEach(() => {
    mockRulesStore.clear();
    nextRuleId = 1;
    // Seed default presets into mock store
    DEFAULT_SITE_RULES.forEach((rule) => {
      const id = nextRuleId++;
      mockRulesStore.set(id, { ...rule, id } as SiteRule);
    });
  });

  // =========================================================================
  // SECTION 1: EXTRACTOR & HEURISTICS ADVERSARIAL STRESS
  // =========================================================================
  describe('Section 1: Extractor & Heuristics Boundary & Malformed Inputs', () => {
    it('E1.1: Missing document.body / headless empty DOM does not crash extraction', () => {
      // Create an XML or minimal document without a <body> tag
      const doc = document.implementation.createDocument(null, 'html', null);
      doc.body?.remove(); // Explicitly remove body if environment created default body

      expect(doc.body).toBeNull();

      // safeQuerySelector and safeQuerySelectorAll on headless document
      expect(() => safeQuerySelector(doc, '.content')).not.toThrow();
      expect(safeQuerySelector(doc, '.content')).toBeNull();

      expect(() => safeQuerySelectorAll(doc, 'a')).not.toThrow();
      expect(safeQuerySelectorAll(doc, 'a')).toEqual([]);

      // Heuristic routines on headless document
      expect(() => findChapterTitle(doc, 'Fallback Title')).not.toThrow();
      expect(findChapterTitle(doc, 'Fallback Title')).toBe('Fallback Title');

      expect(() => findContentContainer(doc)).not.toThrow();
      expect(findContentContainer(doc)).toBeNull();

      expect(() => findNextChapterUrl(doc, 'https://example.com/chap1')).not.toThrow();
      expect(findNextChapterUrl(doc, 'https://example.com/chap1')).toBeUndefined();

      // High-level extraction uses 'Không có tiêu đề' when fallbackTitle is not provided to findChapterTitle
      const chapter = extractChapterHeuristically(doc, 'https://example.com/chap1');
      expect(chapter.title).toBe('Không có tiêu đề');
      expect(chapter.content).toBe('');
      expect(chapter.nextUrl).toBeUndefined();
      expect(chapter.isLocked).toBe(false);

      // TOC extraction on headless document
      const toc = extractTocFromDocument(doc, null, 'https://example.com');
      expect(toc.chapters).toEqual([]);
      expect(toc.nextPaginationUrl).toBeUndefined();
    });

    it('E1.2: Malformed DOM trees with deeply unclosed tags and mismatched elements', () => {
      // Unclosed tags: p, b, i, a, unclosed comment
      const malformedHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Chương 88: Hỗn Loạn Đạo Cảnh - Ma Đạo Tổ Sư</title></head>
        <body>
          <div class="page-description">
            <p>Đoạn 1 chưa đóng thẻ p
            <p>Đoạn 2 với <b>chữ đậm chưa đóng <i>nghiêng lồng nhau
            <p>Đoạn 3 chứa liên kết hỏng <a href="/next">chưa đóng thẻ a
            <div class="unclosed-inner">
              <p>Đoạn 4 bên trong div chưa đóng
            </div>
            <!-- Bắt đầu comment bình thường -->
            <p>Đoạn 5 sau comment đã đóng</p>
            <!-- Unclosed comment at the very end
            <p>Nội dung bị comment nuốt theo đặc tả HTML5</p>
          </div>
        </body>
        </html>
      `;
      const doc = new DOMParser().parseFromString(malformedHtml, 'text/html');

      // safeQuerySelector on malformed DOM
      const container = safeQuerySelector(doc, '.page-description');
      expect(container).not.toBeNull();

      // Content sanitization on malformed DOM
      const sanitized = sanitizeHtmlContent(container!);
      expect(sanitized).toContain('Đoạn 1 chưa đóng thẻ p');
      expect(sanitized).toContain('Đoạn 2 với chữ đậm chưa đóng nghiêng lồng nhau');
      expect(sanitized).toContain('Đoạn 3 chứa liên kết hỏng');
      expect(sanitized).toContain('Đoạn 4 bên trong div chưa đóng');
      expect(sanitized).toContain('Đoạn 5 sau comment đã đóng');
      // Content after unclosed comment is correctly parsed as comment data according to HTML5 spec
      expect(sanitized).not.toContain('Nội dung bị comment nuốt');

      // Rule extraction
      const rule = DEFAULT_SITE_RULES.find((r) => r.domain === 'comong.info');
      const result = extractChapterWithRule(doc, 'https://comong.info/chap-88', rule);
      expect(result.title).toBe('Chương 88: Hỗn Loạn Đạo Cảnh');
      expect(result.content.length).toBeGreaterThan(50);
    });

    it('E1.3: Circular relative URLs, directory backtracking, and invalid URI schemes in resolveUrl', () => {
      const base = 'https://example.com/novel/arc1/chapter-5.html';

      // Circular and redundant relative segments
      expect(resolveUrl('./././chapter-6.html', base)).toBe('https://example.com/novel/arc1/chapter-6.html');
      expect(resolveUrl('./sub/./../chapter-6.html', base)).toBe('https://example.com/novel/arc1/chapter-6.html');

      // Backtracking
      expect(resolveUrl('../arc2/chapter-1.html', base)).toBe('https://example.com/novel/arc2/chapter-1.html');
      expect(resolveUrl('../../arc2/chapter-1.html', base)).toBe('https://example.com/arc2/chapter-1.html');
      expect(resolveUrl('../../../../../../root.html', base)).toBe('https://example.com/root.html');

      // Query params and path permutations
      expect(resolveUrl('?page=2', base)).toBe('https://example.com/novel/arc1/chapter-5.html?page=2');
      expect(resolveUrl('/absolute/path/chap', base)).toBe('https://example.com/absolute/path/chap');

      // Protocol-relative URLs
      expect(resolveUrl('//cdn.example.com/chap-7', base)).toBe('https://cdn.example.com/chap-7');

      // Exact in-page anchors and pseudo-protocol targets that should return undefined
      expect(resolveUrl('#', base)).toBeUndefined();
      expect(resolveUrl('#top', base)).toBeUndefined();
      expect(resolveUrl('javascript:void(0)', base)).toBeUndefined();
      expect(resolveUrl('javascript:alert("pwned")', base)).toBeUndefined();
      expect(resolveUrl('', base)).toBeUndefined();
      expect(resolveUrl('   ', base)).toBeUndefined();
      expect(resolveUrl(null, base)).toBeUndefined();
      expect(resolveUrl(undefined, base)).toBeUndefined();

      // White-box finding: Named anchor fragments like '#chapter-comments' resolve to full URL
      // (Callers like extractChapterWithRule split on '#' to filter same-page navigation)
      expect(resolveUrl('#chapter-comments', base)).toBe('https://example.com/novel/arc1/chapter-5.html#chapter-comments');

      // Graceful fallback when base is missing or invalid
      expect(resolveUrl('chapter-6.html', undefined)).toBe('chapter-6.html');
      expect(resolveUrl('chapter-6.html', 'invalid-base-url')).toBe('chapter-6.html');
    });

    it('E1.4: Heavily nested divs (120 levels deep) executes without stack overflow', () => {
      const depth = 120;
      let html = '';
      for (let i = 0; i < depth; i++) {
        html += `<div class="nest-level-${i}">`;
      }
      // Content of realistic chapter size (>200 chars to satisfy readability threshold)
      const chapterProse = 'Nội dung tiểu thuyết ẩn sâu trong 120 tầng div lồng nhau của website. '.repeat(10);
      html += `<div class="story-content"><p>${chapterProse}</p></div>`;
      for (let i = 0; i < depth; i++) {
        html += `</div>`;
      }

      const doc = new DOMParser().parseFromString(html, 'text/html');

      const startTime = performance.now();

      // Rule extraction targeting deepest element
      const rule = DEFAULT_SITE_RULES.find((r) => r.domain === 'comong.info');
      const result = extractChapterWithRule(doc, 'https://comong.info/deep', rule);

      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(250); // Must be fast and not freeze
      expect(result.content).toContain('Nội dung tiểu thuyết ẩn sâu trong 120 tầng div');

      // Heuristic extraction through deep hierarchy
      const heuristicResult = extractChapterHeuristically(doc, 'https://comong.info/deep');
      expect(heuristicResult.content).toContain('Nội dung tiểu thuyết ẩn sâu trong 120 tầng div');
    });

    it('E1.5: Misleading navigation text in comments, sidebars, and footers does not hijack nextUrl', () => {
      const html = `
        <div id="content">
          <h1 class="chapter-title">Chương 10: Rời Núi</h1>
          <div class="page-description">
            <p>Nội dung chương 10 diễn ra tại bờ suối hoang sơ...</p>
          </div>
          <!-- Scoped genuine next button -->
          <div class="wpc-nav-next">
            <a href="https://comong.info/chap-11" class="wpc-nav-link">Chương tiếp →</a>
          </div>
        </div>

        <!-- Adversarial Comment Section with misleading anchor text -->
        <div class="comments-area">
          <div class="comment-item">
            <p>Ai biết khi nào có chương mới không?</p>
            <a href="https://spam-site.com/fake-link" class="reply-link">Chương tiếp theo</a>
          </div>
        </div>

        <!-- Adversarial Footer with misleading anchor text -->
        <footer class="site-footer">
          <div class="footer-links">
            <a href="https://comong.info/help">Hướng dẫn đọc chương tiếp</a>
          </div>
        </footer>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const rule = DEFAULT_SITE_RULES.find((r) => r.domain === 'comong.info');

      // Rule-based extraction must pick the genuine next chapter link (.wpc-nav-next a)
      const chapter = extractChapterWithRule(doc, 'https://comong.info/chap-10', rule);
      expect(chapter.nextUrl).toBe('https://comong.info/chap-11');
      expect(chapter.nextUrl).not.toContain('spam-site.com');

      // Heuristic navigation resolver also tests button selectors before general anchor scan
      const heuristicNext = findNextChapterUrl(doc, 'https://comong.info/chap-10');
      expect(heuristicNext).toBe('https://comong.info/chap-11');
      expect(heuristicNext).not.toContain('spam-site.com');
    });

    it('E1.6: Title detection collisions between site logo, novel title, chapter heading, and footer h1', () => {
      const html = `
        <header>
          <h1 class="logo site-title">Mê Đọc Truyện Online</h1>
        </header>
        <main>
          <h1 class="story-title novel-title">Phàm Nhân Tu Tiên</h1>
          <div class="chapter-container">
            <h1 class="chapter-title">Chương 100: Kết Đan Đại Thành</h1>
            <div class="entry-content">
              <p>Hàn Lập ngồi xếp bằng trong động phủ...</p>
            </div>
          </div>
        </main>
        <footer>
          <h1 class="footer-heading">Thông Tin Bản Quyền</h1>
        </footer>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // findChapterTitle should avoid site-title, story-title, and footer, and extract chapter title
      const extractedTitle = findChapterTitle(doc);
      expect(extractedTitle).toBe('Chương 100: Kết Đan Đại Thành');
      expect(extractedTitle).not.toContain('Mê Đọc Truyện Online');
      expect(extractedTitle).not.toContain('Phàm Nhân Tu Tiên');
      expect(extractedTitle).not.toContain('Thông Tin Bản Quyền');
    });

    it('E1.7: Title detection fallback hierarchy when in-page DOM headings lack chapter identifiers', () => {
      // Scenario A: No h1 tags present in body, title present only in document.title
      const htmlA = `
        <html>
        <head>
          <title>Chương 42: Bí Mật Tông Môn - Tuyệt Thế Võ Thần - TruyenFull</title>
        </head>
        <body>
          <div class="text-content">
            <p>Nội dung chương 42 bắt đầu từ đây...</p>
          </div>
        </body>
        </html>
      `;
      const docA = new DOMParser().parseFromString(htmlA, 'text/html');
      const extractedA = findChapterTitle(docA);
      expect(extractedA).toBe('Chương 42: Bí Mật Tông Môn');

      // Scenario B: Document has <h1 class="story-title"> and chapter in <h2 class="chapter-title">
      const htmlB = `
        <html>
        <head><title>Trang đọc truyện</title></head>
        <body>
          <h1 class="story-title">Tuyệt Thế Võ Thần</h1>
          <h2 class="chapter-title">Chương 43: Đột Phá Hóa Cảnh</h2>
          <div class="text-content"><p>Nội dung...</p></div>
        </body>
        </html>
      `;
      const docB = new DOMParser().parseFromString(htmlB, 'text/html');
      const extractedB = findChapterTitle(docB);
      expect(extractedB).toBe('Chương 43: Đột Phá Hóa Cảnh');

      // Scenario C: Document has only <h1 class="story-title"> without any chapter heading.
      // White-box finding: findChapterTitle has 'h1' at the end of titleSelectors, which
      // matches <h1 class="story-title"> when text.length < 150.
      const htmlC = `
        <html>
        <head><title>Chương 44: Ngoại Truyện - Tuyệt Thế Võ Thần</title></head>
        <body>
          <h1 class="story-title">Tuyệt Thế Võ Thần</h1>
          <div class="text-content"><p>Nội dung...</p></div>
        </body>
        </html>
      `;
      const docC = new DOMParser().parseFromString(htmlC, 'text/html');
      const extractedC = findChapterTitle(docC);
      // Documenting the behavior: matches h1 (novel title) because 'h1' fallback precedes doc.title
      expect(extractedC).toBe('Tuyệt Thế Võ Thần');
    });
  });

  // =========================================================================
  // SECTION 2: SANITIZER ADVERSARIAL STRESS (ReDoS, Watermarks, Traps)
  // =========================================================================
  describe('Section 2: Content Sanitizer ReDoS Resilience & Trap Stripping', () => {
    it('S2.1: ReDoS resilience with 100,000 character strings and pathological regex triggers', () => {
      const adKeywords = ['nguồn', 'website', 'truyện', 'link', 'dịch'];

      // Construct a 100,000 char paragraph without newlines, with an ad keyword embedded midway
      const filler = 'Một ngày nọ tại vùng núi xa xôi của đế quốc cổ đại hoàng hôn buông xuống. ';
      const hugeParagraph = filler.repeat(1500) + ' Nguồn gốc sức mạnh này là bí ẩn. ' + filler.repeat(100);
      expect(hugeParagraph.length).toBeGreaterThan(100000);

      const t0 = performance.now();
      const cleanedProse = removeAdLines(hugeParagraph, adKeywords);
      const t1 = performance.now();

      expect(t1 - t0).toBeLessThan(200); // Must execute in < 200ms
      expect(cleanedProse).toContain('Nguồn gốc sức mạnh này là bí ẩn.');

      // Pathological quotes and backtracks: 10,000 open quotes and dashes
      const pathologicalQuotes = '"'.repeat(10000) + 'Đối thoại bình thường' + '"'.repeat(10000);
      const t2 = performance.now();
      const dialogueResult = removeAdLines(pathologicalQuotes, adKeywords);
      const t3 = performance.now();

      expect(t3 - t2).toBeLessThan(200);
      expect(dialogueResult.length).toBeGreaterThan(0);

      // Pathological word count on 100,000 characters
      const t4 = performance.now();
      const totalWords = countWords(hugeParagraph);
      const t5 = performance.now();

      expect(t5 - t4).toBeLessThan(200);
      expect(totalWords).toBeGreaterThan(10000);
    });

    it('S2.2: Compound words with punctuation permutations (colon, em-dash, brackets, full-width)', () => {
      const adKeywords = ['nguồn', 'website', 'truyện'];

      // Legitimate narrative sentences using compound nouns with punctuation:
      const legitimateProse = [
        'Nguồn gốc của hiện tượng này bắt đầu từ ngàn năm trước.',
        'Nguồn nước suối này vô cùng tinh khiết và ngọt lành.',
        'Hắn ta tìm thấy nguồn năng lượng huyền bí trong hang động.',
        'Nguồn sáng le lói phát ra từ viên ngọc bích.',
        'Bảo tồn nguồn tài nguyên quý giá của gia tộc.',
        'Nguồn sống của muôn loài đang dần hồi sinh.',
        'Nguồn gốc... ai mà biết được sự thật phía sau?',
        'Nguồn gốc! Đó chính là bí mật lớn nhất!',
        'Nguồn gốc? Ngươi thực sự muốn biết sao?'
      ].join('\n');

      const preserved = removeAdLines(legitimateProse, adKeywords);
      expect(preserved).toContain('Nguồn gốc của hiện tượng');
      expect(preserved).toContain('Nguồn nước suối này');
      expect(preserved).toContain('nguồn năng lượng huyền bí');
      expect(preserved).toContain('Nguồn sáng le lói');
      expect(preserved).toContain('nguồn tài nguyên quý giá');
      expect(preserved).toContain('Nguồn sống của muôn loài');
      expect(preserved).toContain('Nguồn gốc... ai mà biết được');
      expect(preserved).toContain('Nguồn gốc! Đó chính là bí mật');
      expect(preserved).toContain('Nguồn gốc? Ngươi thực sự muốn biết');

      // Actual ad watermark lines with punctuation permutations:
      const adLines = [
        'Nguồn gốc: Convert từ TruyenFull',
        'Nguồn gốc：ST',
        'Nguồn gốc - Editor Con Bướm',
        '[Nguồn: Mê Truyện Chữ]',
        '(Nguồn gốc: sưu tầm)',
        'Nguồn: truyenfull.io',
        'Nguồn truyện tại website truyenfull.vn'
      ].join('\n');

      const stripped = removeAdLines(adLines, adKeywords);
      expect(stripped.trim()).toBe('');
    });

    it('S2.3: Mixed Vietnamese/English text and NFD decomposition normalization', () => {
      // Decomposed (NFD) string with separate base characters and combining accent marks
      const nfdText = 'Chương 1: Tiên Hiệp Kỳ Duyên - Tác giả Cà Chua'.normalize('NFD');
      expect(nfdText).not.toBe('Chương 1: Tiên Hiệp Kỳ Duyên - Tác giả Cà Chua'); // NFD != NFC

      const normalized = normalizeUnicodeAndCleanChars(nfdText);
      expect(normalized).toBe('Chương 1: Tiên Hiệp Kỳ Duyên - Tác giả Cà Chua');
      expect(normalized).toBe(normalized.normalize('NFC'));

      // Mixed Vietnamese, English, numbers, and tech jargon
      const mixedHtml = `
        <div>
          <p>Lập trình viên sử dụng TypeScript 5.7 và Svelte 5 để build Chrome Extension với 60 FPS.</p>
          <p>“Hello World!” - hắn mỉm cười nói: ‘Đây là kỷ nguyên AI Agent!’</p>
        </div>
      `;
      const cleanMixed = sanitizeHtmlContent(mixedHtml);
      expect(cleanMixed).toContain('TypeScript 5.7 và Svelte 5');
      expect(cleanMixed).toContain('“Hello World!” - hắn mỉm cười nói: ‘Đây là kỷ nguyên AI Agent!’');

      // Word count: 'Chương 1: Welcome to Novel Scraper v1.0.0, bạn nhé!'
      // Matches [\p{L}\p{N}]+ tokens: Chương, 1, Welcome, to, Novel, Scraper, v1, 0, 0, bạn, nhé = 11 tokens
      const words = countWords('Chương 1: Welcome to Novel Scraper v1.0.0, bạn nhé!');
      expect(words).toBe(11);
    });

    it('S2.4: Anti-scraping honeypot traps embedded in SVGs and inline style attributes', () => {
      const html = `
        <div class="content">
          <p>Đoạn văn hợp lệ thứ nhất của chương truyện.</p>
          <!-- SVG honeypot trap with text -->
          <svg><text>Bẫy chống cào dữ liệu qua thẻ SVG</text></svg>
          <svg style="display:none"><desc>Hidden SVG description trap</desc></svg>
          
          <!-- Hidden inline styles -->
          <p style="display:none">Bẫy display none</p>
          <p style="display: none;">Bẫy display none space</p>
          <p style="DISPLAY:NONE">Bẫy display uppercase</p>
          <p style="visibility:hidden">Bẫy visibility hidden</p>
          <p style="margin: 0; visibility: hidden; font-size: 0px;">Bẫy multi styles</p>
          
          <!-- Hidden attributes -->
          <p hidden>Bẫy thuộc tính hidden</p>
          <p aria-hidden="true">Bẫy thuộc tính aria-hidden</p>

          <p>Đoạn văn hợp lệ thứ hai của chương truyện.</p>
        </div>
      `;

      const result = sanitizeHtmlContent(html);

      expect(result).toContain('Đoạn văn hợp lệ thứ nhất của chương truyện.');
      expect(result).toContain('Đoạn văn hợp lệ thứ hai của chương truyện.');

      // All honeypots must be stripped
      expect(result).not.toContain('thẻ SVG');
      expect(result).not.toContain('Hidden SVG');
      expect(result).not.toContain('Bẫy display none');
      expect(result).not.toContain('Bẫy display uppercase');
      expect(result).not.toContain('Bẫy visibility');
      expect(result).not.toContain('thuộc tính hidden');
      expect(result).not.toContain('thuộc tính aria-hidden');
    });

    it('S2.5: Zero-width spaces, joiners, soft hyphens, and non-breaking spaces are stripped/normalized', () => {
      // String riddled with invisible zero-width characters and non-breaking spaces
      const dirty = 'Ch\u200Bư\u200Cơ\u200Dng\uFEFF \u00AD1:\u2060 \u200EK\u200Fhởi\u00A0Đầu';
      const clean = normalizeUnicodeAndCleanChars(dirty);

      expect(clean).toBe('Chương 1: Khởi Đầu');
      expect(clean).not.toContain('\u200B');
      expect(clean).not.toContain('\u200C');
      expect(clean).not.toContain('\u200D');
      expect(clean).not.toContain('\uFEFF');
      expect(clean).not.toContain('\u00AD');
      expect(clean).not.toContain('\u2060');
      expect(clean).not.toContain('\u200E');
      expect(clean).not.toContain('\u200F');
      expect(clean).not.toContain('\u00A0');
    });
  });

  // =========================================================================
  // SECTION 3: PRESETS & RULES ADVERSARIAL STRESS
  // =========================================================================
  describe('Section 3: Presets & Site Rules Resolution & Domain Matching', () => {
    it('R3.1: Subdomain matching resolves to base preset rule', async () => {
      // comong.info preset is seeded
      const mobileRule = await getRuleForDomain('https://m.comong.info/truyen-1/chap-1');
      expect(mobileRule).toBeDefined();
      expect(mobileRule?.domain).toBe('comong.info');

      const subSubRule = await getRuleForDomain('https://sub.m.comong.info/truyen-1');
      expect(subSubRule).toBeDefined();
      expect(subSubRule?.domain).toBe('comong.info');

      // truyenfull.vn preset is seeded
      const wapRule = await getRuleForDomain('https://wap.truyenfull.vn/chuong-1');
      expect(wapRule).toBeDefined();
      expect(wapRule?.domain).toBe('truyenfull.vn');
    });

    it('R3.2: Uppercase hostnames and protocol variants match case-insensitively', async () => {
      const upperUrl = 'HTTPS://COMONG.INFO/TRUYEN/CHUONG-1';
      const rule = await getRuleForDomain(upperUrl);
      expect(rule).toBeDefined();
      expect(rule?.domain).toBe('comong.info');

      const upperDomain = 'COMONG.INFO';
      const directRule = await getRuleForDomain(upperDomain);
      expect(directRule).toBeDefined();
      expect(directRule?.domain).toBe('comong.info');

      const mixedCase = 'https://TruyenFull.Io/doc-truyen/1';
      const ioRule = await getRuleForDomain(mixedCase);
      expect(ioRule).toBeDefined();
      expect(ioRule?.domain).toBe('truyenfull.io');
    });

    it('R3.3: Trailing dots in hostnames (FQDN notation) and extractDomainFromUrl behavior', async () => {
      // Verify extractDomainFromUrl on FQDN notation
      const fqdnUrl = 'https://comong.info./novel/chapter-1';
      const extractedFqdn = extractDomainFromUrl(fqdnUrl);
      expect(extractedFqdn).toBe('comong.info.');

      // Standard URLs
      expect(extractDomainFromUrl('https://comong.info/chap-1')).toBe('comong.info');
      expect(extractDomainFromUrl('http://truyenfull.vn/')).toBe('truyenfull.vn');
      expect(extractDomainFromUrl('not-a-valid-url')).toBe('');

      // White-box finding: trailing dot hostname does not match preset without dot normalization
      const fqdnRule = await getRuleForDomain(fqdnUrl);
      // 'comong.info.' does not equal 'comong.info'
      expect(fqdnRule).toBeUndefined();
    });

    it('R3.4: URLs without protocol and direct domain strings', async () => {
      // Naked domain
      const nakedRule = await getRuleForDomain('comong.info');
      expect(nakedRule).toBeDefined();
      expect(nakedRule?.domain).toBe('comong.info');

      // www. domain
      const wwwRule = await getRuleForDomain('www.comong.info');
      expect(wwwRule).toBeDefined();
      expect(wwwRule?.domain).toBe('comong.info');

      // Domain with uppercase www
      const upperWwwRule = await getRuleForDomain('WWW.COMONG.INFO');
      expect(upperWwwRule).toBeDefined();
      expect(upperWwwRule?.domain).toBe('comong.info');

      // White-box finding: URL path without protocol ('comong.info/truyen/1')
      // Since it lacks '://', extractDomainFromUrl is bypassed and getRuleForDomain
      // treats the whole string as the domain, failing exact and subdomain match.
      const pathWithoutProtocol = await getRuleForDomain('comong.info/truyen/1');
      expect(pathWithoutProtocol).toBeUndefined();
    });

    it('R3.5: Preset deletion protection and rule export/import safety', async () => {
      // Built-in presets cannot be deleted via deleteSiteRule
      const preset = Array.from(mockRulesStore.values()).find((r) => r.isPreset);
      expect(preset).toBeDefined();

      const deleteResult = await deleteSiteRule(preset!.id!);
      expect(deleteResult).toBe(false);
      expect(mockRulesStore.has(preset!.id!)).toBe(true);

      // JSON export
      const exportedJson = await exportRulesToJson();
      expect(exportedJson).toContain('comong.info');

      // JSON import with malformed payload
      const malformedResult = await importRulesFromJson('{ "not": "an array" }');
      expect(malformedResult.imported).toBe(0);
      expect(malformedResult.errors.length).toBeGreaterThan(0);

      // JSON import with valid custom rule
      const validCustom = JSON.stringify([
        {
          domain: 'custom-novel.net',
          name: 'Custom Novel Site',
          contentSelector: '#read-box',
          titleSelector: 'h2.title'
        }
      ]);
      const importResult = await importRulesFromJson(validCustom);
      expect(importResult.imported).toBe(1);
      expect(importResult.errors).toEqual([]);

      const customRule = await getRuleForDomain('custom-novel.net');
      expect(customRule).toBeDefined();
      expect(customRule?.name).toBe('Custom Novel Site');
      expect(customRule?.isPreset).toBe(false);

      // Custom rule can be deleted
      const deleteCustom = await deleteSiteRule(customRule!.id!);
      expect(deleteCustom).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 4: I18N MODULE RESILIENCE
  // =========================================================================
  describe('Section 4: i18n Localization Resilience', () => {
    it('I4.1: Fallback handling for missing keys, language switching, and listener cleanup', () => {
      // Known Vietnamese key
      const appTitle = t('app_name', 'Default Title');
      expect(appTitle).toBeDefined();

      // Missing key returns fallback or key itself
      const missingWithFallback = t('non_existent_key_123', 'Bản dự phòng');
      expect(missingWithFallback).toBe('Bản dự phòng');

      const missingWithoutFallback = t('non_existent_key_xyz');
      expect(missingWithoutFallback).toBe('non_existent_key_xyz');

      // Language switching and reactive listener
      let notificationCount = 0;
      let lastLang = '';
      const unsubscribe = onLanguageChange((lang) => {
        notificationCount++;
        lastLang = lang;
      });

      setLanguage('en');
      expect(getCurrentLanguage()).toBe('en');
      expect(notificationCount).toBe(1);
      expect(lastLang).toBe('en');

      // Switch back to vi
      setLanguage('vi');
      expect(getCurrentLanguage()).toBe('vi');
      expect(notificationCount).toBe(2);
      expect(lastLang).toBe('vi');

      // Unsubscribe prevents subsequent invocations
      unsubscribe();
      setLanguage('en');
      expect(notificationCount).toBe(2); // Still 2

      // Restore vi for subsequent tests
      setLanguage('vi');
    });
  });
});
