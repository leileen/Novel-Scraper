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
  NEXT_LINK_REGEX,
  CHAPTER_TITLE_REGEX,
  findNextChapterUrl,
  findChapterTitle,
  findContentContainer,
  isChapterLocked,
  extractChapterHeuristically
} from '../lib/extractor/heuristic';
import { DEFAULT_SITE_RULES } from '../lib/db/presets';
import type { SiteRule } from '../lib/types';

describe('Milestone 1 Adversarial & Empirical Stress Challenge', () => {
  const comongPreset = DEFAULT_SITE_RULES.find((r) => r.domain === 'comong.info') as SiteRule;

  // =========================================================================
  // Challenge 1: Comong Preset nextSelector Shadowing & Prev-link Capture
  // =========================================================================
  describe('Challenge 1: Preset nextSelector & Navigation Traversal Safety', () => {
    it('C1.1: Document order shadowing test when .wpc-nav-prev precedes .wpc-nav-next', () => {
      // In authentic comong.info DOM, .wpc-nav-prev comes before .wpc-nav-next.
      // Both anchor tags may share the .wpc-nav-link class.
      const html = `
        <div id="content">
          <h1>Chương 2</h1>
          <div class="page-description"><p>Nội dung chương 2...</p></div>
          <div class="wpc-chapter-nav-simple">
            <div class="wpc-nav-prev">
              <a href="https://comong.info/chapter/chuong-1" class="wpc-nav-link">← Chương trước</a>
            </div>
            <div class="wpc-nav-next">
              <a href="https://comong.info/chapter/chuong-3" class="wpc-nav-link">Chương tiếp →</a>
            </div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Direct check: what does safeQuerySelector return for comongPreset.nextSelector?
      // comongPreset.nextSelector is: '.wpc-nav-next a, .wpc-nav-link, .nav-next a, a.next-chapter'
      const matchedEl = safeQuerySelector<HTMLAnchorElement>(doc, comongPreset.nextSelector!);
      expect(matchedEl).not.toBeNull();

      // Because querySelector returns the first matching element in document order,
      // does matchedEl match .wpc-nav-prev's anchor because of .wpc-nav-link?
      const isPrevEl = matchedEl?.getAttribute('href')?.includes('chuong-1');
      console.log('C1.1 matchedEl href:', matchedEl?.getAttribute('href'), 'isPrevEl:', isPrevEl);

      // Now run extractChapterWithRule
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-2', comongPreset);

      // It MUST extract chuong-3, NEVER chuong-1
      expect(result.nextUrl).toBe('https://comong.info/chapter/chuong-3');
    });

    it('C1.2: VULNERABILITY CONFIRMED: unscoped .wpc-nav-link in comongPreset captures previous chapter when prev button lacks "trước/prev"', () => {
      // In authentic comong.info DOM, prev button comes before next button.
      // If prev button text is "←" or icon or English or "Lùi", it does NOT match /trước|prev/i.
      const html = `
        <div id="content">
          <h1>Chương 2</h1>
          <div class="page-description"><p>Nội dung chương 2...</p></div>
          <div class="wpc-chapter-nav-simple">
            <div class="wpc-nav-prev">
              <a href="https://comong.info/chapter/chuong-1" class="wpc-nav-link">←</a>
            </div>
            <div class="wpc-nav-next">
              <a href="https://comong.info/chapter/chuong-3" class="wpc-nav-link">Chương tiếp →</a>
            </div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // With fixed comongPreset (scoped .wpc-nav-link), extracts chuong-3:
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-2', comongPreset);
      expect(result.nextUrl).toBe('https://comong.info/chapter/chuong-3');

      // PROOF OF FIX: If nextSelector properly scopes .wpc-nav-link to .wpc-nav-next:
      const fixedRule: SiteRule = {
        ...comongPreset,
        nextSelector: '.wpc-nav-next a, .wpc-nav-next .wpc-nav-link, .nav-next a, a.next-chapter'
      };
      const fixedResult = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-2', fixedRule);
      expect(fixedResult.nextUrl).toBe('https://comong.info/chapter/chuong-3'); // With scoped selector, extracts next chapter!
    });

    it('C1.3: Last chapter where next button is absent and prev button has .wpc-nav-link with "trước"', () => {
      const html = `
        <div id="content">
          <h1>Chương 100</h1>
          <div class="page-description"><p>Hết truyện.</p></div>
          <div class="wpc-chapter-nav-simple">
            <div class="wpc-nav-prev">
              <a href="https://comong.info/chapter/chuong-99" class="wpc-nav-link">Quay lại tập trước</a>
            </div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-100', comongPreset);
      expect(result.nextUrl).toBeUndefined();
    });

    it('C1.4: VULNERABILITY CONFIRMED: Last chapter where prev button lacks "trước" mistakenly extracts prev chapter as nextUrl', () => {
      const html = `
        <div id="content">
          <h1>Chương 100</h1>
          <div class="page-description"><p>Hết truyện.</p></div>
          <div class="wpc-chapter-nav-simple">
            <div class="wpc-nav-prev">
              <a href="https://comong.info/chapter/chuong-99" class="wpc-nav-link">←</a>
            </div>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // On the last chapter with scoped selector, correctly identifies no next chapter:
      const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-100', comongPreset);
      expect(result.nextUrl).toBeUndefined();

      // PROOF OF FIX: With scoped selector:
      const fixedRule: SiteRule = {
        ...comongPreset,
        nextSelector: '.wpc-nav-next a, .wpc-nav-next .wpc-nav-link, .nav-next a, a.next-chapter'
      };
      const fixedResult = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-100', fixedRule);
      expect(fixedResult.nextUrl).toBeUndefined(); // Correctly identifies no next chapter!
    });
  });

  // =========================================================================
  // Challenge 2: Malformed CSS Selectors & jQuery Syntax Resilience
  // =========================================================================
  describe('Challenge 2: Malformed CSS Selectors & Non-Standard Syntax', () => {
    const malformedSelectors = [
      'a:contains("Sau")',
      'div:contains("Nội dung")',
      'div:has(p:contains("x"))',
      'div:first',
      'span:eq(0)',
      'div[class="open',
      'h1:not(:not)',
      '#',
      '.',
      '..invalid..',
      ':invalid-pseudo',
      'div > > span',
      '///xpath/syntax'
    ];

    it('C2.1: safeQuerySelector and safeQuerySelectorAll must never throw on malformed CSS selectors', () => {
      const doc = new DOMParser().parseFromString('<div><span>Hello</span></div>', 'text/html');

      for (const sel of malformedSelectors) {
        expect(() => safeQuerySelector(doc, sel)).not.toThrow();
        expect(safeQuerySelector(doc, sel)).toBeNull();

        expect(() => safeQuerySelectorAll(doc, sel)).not.toThrow();
        expect(safeQuerySelectorAll(doc, sel)).toEqual([]);
      }

      // Empty or whitespace strings
      expect(() => safeQuerySelector(doc, '')).not.toThrow();
      expect(safeQuerySelector(doc, '')).toBeNull();
      expect(() => safeQuerySelector(doc, '   ')).not.toThrow();
      expect(safeQuerySelector(doc, '   ')).toBeNull();
    });

    it('C2.2: extractChapterWithRule must not crash when SiteRule contains malformed selectors across all fields', () => {
      const hostileRule: SiteRule = {
        domain: 'hostile.test',
        name: 'Hostile',
        contentSelector: 'div:contains("Chương"):not(:not)',
        titleSelector: 'h1[unclosed="',
        nextSelector: 'a:contains("Tiếp"):first',
        tocSelector: 'li:has(> a:contains("Chap"))',
        paginationSelector: 'a:eq(2)',
        excludeSelectors: ['div:invalid()', '..bad..', '', '[broken'],
        isPreset: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const html = `
        <div id="content">
          <h1>Chương 1: Bình yên vô sự</h1>
          <div class="reading-content">
            <p>Nội dung chương sách vẫn được bảo toàn trọn vẹn dù selector bị lỗi.</p>
          </div>
          <a href="https://hostile.test/c2">Chương sau »</a>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');

      let result: any;
      expect(() => {
        result = extractChapterWithRule(doc, 'https://hostile.test/c1', hostileRule);
      }).not.toThrow();

      // Must gracefully fall back to heuristic extraction!
      expect(result).toBeDefined();
      expect(result.title).toContain('Chương 1: Bình yên vô sự');
      expect(result.content).toContain('Nội dung chương sách vẫn được bảo toàn');
      expect(result.nextUrl).toBe('https://hostile.test/c2');
    });

    it('C2.3: extractTocWithRule must not crash when SiteRule contains malformed tocSelector and paginationSelector', () => {
      const hostileRule: SiteRule = {
        domain: 'hostile.test',
        name: 'Hostile',
        contentSelector: '.content',
        tocSelector: 'a:contains("Chương")',
        paginationSelector: 'a:eq(1)',
        isPreset: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const html = `
        <ul class="list-chapter">
          <li><a href="/c1">Chương 1: Khởi đầu</a></li>
          <li><a href="/c2">Chương 2: Diễn biến</a></li>
        </ul>
        <div class="pagination"><a class="next" href="/page-2">Trang sau</a></div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');

      let tocResult: any;
      expect(() => {
        tocResult = extractTocWithRule(doc, hostileRule, 'https://hostile.test/novel/');
      }).not.toThrow();

      expect(tocResult.chapters).toHaveLength(2);
      expect(tocResult.chapters[0].url).toBe('https://hostile.test/c1');
      expect(tocResult.nextPaginationUrl).toBe('https://hostile.test/page-2');
    });
  });

  // =========================================================================
  // Challenge 3: NEXT_LINK_REGEX Adversarial Stress, Arrows & ReDoS
  // =========================================================================
  describe('Challenge 3: NEXT_LINK_REGEX Arrows & Robustness', () => {
    it('C3.1: Should match all legitimate next variations with trailing arrows and spaces', () => {
      const validLabels = [
        'chương sau',
        'Chương Sau',
        'CHƯƠNG SAU',
        'chương tiếp',
        'Chương tiếp',
        'tiếp',
        'Tiếp',
        'tiếp theo',
        'Tiếp Theo',
        'sau',
        'Sau',
        'next',
        'Next',
        'NEXT',
        'next chapter',
        'Next Chapter',
        // Trailing arrows
        'Chương tiếp →',
        'Chương sau »',
        'Next >',
        'Tiếp theo ›',
        'Sau \u2192',
        'Chương tiếp \u203A',
        'Chương tiếp    →   ',
        'Tiếp theo »»',
        'Next >>>'
      ];

      for (const label of validLabels) {
        expect(NEXT_LINK_REGEX.test(label)).toBe(true);
      }
    });

    it('C3.2: Behavior check on non-standard Unicode arrows and leading arrows', () => {
      const alternativeArrows = [
        'Chương tiếp ⇒', // \u21D2
        'Chương tiếp ➔', // \u2794
        'Chương tiếp ➜', // \u279C
        'Chương tiếp ➡', // \u27A1
        'Chương tiếp ▶', // \u25B6 black right-pointing triangle
        'Chương tiếp ►', // \u25BA black right-pointing pointer
        'Chương tiếp ▷', // \u25B7 white right-pointing triangle
        '→ Chương tiếp', // leading arrow
        '» Chương sau'   // leading guillemet
      ];

      for (const label of alternativeArrows) {
        const matches = NEXT_LINK_REGEX.test(label);
        console.log(`Alternative arrow "${label}" -> matches: ${matches}`);
      }
    });

    it('C3.3: Strict negative tests: Must NEVER match previous chapter or non-next keywords', () => {
      const invalidLabels = [
        'Chương trước',
        'chương trước',
        '← Chương trước',
        'Trước',
        'trước',
        'prev',
        'Prev',
        'previous',
        'Previous Chapter',
        'Mục lục',
        'Danh sách chương',
        'Bình luận',
        'Chương 2: Tiếp tục lên đường',
        'Hồi sau sẽ rõ',
        'Sau khi sống lại, ta trở thành đại lão',
        'Next Level',
        'Tiếp viên hàng không',
        'Chương trước →',
        'Về trang chủ',
        ''
      ];

      for (const label of invalidLabels) {
        expect(NEXT_LINK_REGEX.test(label)).toBe(false);
      }
    });

    it('C3.4: ReDoS resistance test with 50,000 characters input', () => {
      // Craft adversarial inputs that could trigger catastrophic backtracking if quantifiers overlap
      const longInput1 = 'tiếp ' + 'theo '.repeat(5000) + '!';
      const longInput2 = 'chương ' + '   '.repeat(10000) + 'sau' + '→'.repeat(10000);
      const longInput3 = 'sau' + ' '.repeat(50000);

      const t0 = performance.now();
      expect(NEXT_LINK_REGEX.test(longInput1)).toBe(false);
      const t1 = performance.now();
      expect(NEXT_LINK_REGEX.test(longInput2)).toBe(true);
      const t2 = performance.now();
      expect(NEXT_LINK_REGEX.test(longInput3)).toBe(true);
      const t3 = performance.now();

      const durationTotal = t3 - t0;
      console.log(`C3.4 ReDoS test execution time: ${durationTotal.toFixed(2)}ms`);
      expect(durationTotal).toBeLessThan(100); // Must be linear/instant (< 100ms)
    });
  });

  // =========================================================================
  // Challenge 4: URL Resolution Edge Cases & Complex Paths
  // =========================================================================
  describe('Challenge 4: URL Resolution & Relative Path Safety', () => {
    it('C4.1: Complex relative paths and parent directory traversals', () => {
      const base = 'https://comong.info/novel/muoi-muoi/chuong-1/';

      expect(resolveUrl('chuong-2/', base)).toBe('https://comong.info/novel/muoi-muoi/chuong-1/chuong-2/');
      expect(resolveUrl('../chuong-2/', base)).toBe('https://comong.info/novel/muoi-muoi/chuong-2/');
      expect(resolveUrl('../../chapter/chuong-2', base)).toBe('https://comong.info/novel/chapter/chuong-2');
      expect(resolveUrl('../../../chapter/chuong-2', base)).toBe('https://comong.info/chapter/chuong-2');
      expect(resolveUrl('/root-chap', base)).toBe('https://comong.info/root-chap');
      expect(resolveUrl('?page=2', base)).toBe('https://comong.info/novel/muoi-muoi/chuong-1/?page=2');
      expect(resolveUrl('#section', base)).toBe('https://comong.info/novel/muoi-muoi/chuong-1/#section');
    });

    it('C4.2: Handling missing, empty, or invalid baseUrl', () => {
      // No baseUrl
      expect(resolveUrl('/chuong-1', undefined)).toBe('/chuong-1');
      expect(resolveUrl('/chuong-1', '')).toBe('/chuong-1');

      // Invalid baseUrl
      expect(resolveUrl('/chuong-1', 'not-a-valid-url')).toBe('/chuong-1');
      expect(resolveUrl('https://valid.com/c1', 'not-a-valid-url')).toBe('https://valid.com/c1');
    });

    it('C4.3: Malicious, blank, or script schemes', () => {
      expect(resolveUrl('javascript:void(0)', 'https://example.com')).toBeUndefined();
      expect(resolveUrl('javascript:alert(1)', 'https://example.com')).toBeUndefined();
      expect(resolveUrl('  javascript:void(0);  ', 'https://example.com')).toBeUndefined();

      // Case-insensitive javascript:
      const upperJs = resolveUrl('JavaScript:void(0)', 'https://example.com');
      expect(upperJs).toBeUndefined();

      expect(resolveUrl('', 'https://example.com')).toBeUndefined();
      expect(resolveUrl('   ', 'https://example.com')).toBeUndefined();
      expect(resolveUrl(null, 'https://example.com')).toBeUndefined();
      expect(resolveUrl(undefined, 'https://example.com')).toBeUndefined();
    });

    it('C4.4: Prevents exact self-referencing nextUrl loops', () => {
      const currentUrl = 'https://comong.info/chapter/chuong-1';
      const html = `
        <div id="content">
          <h1>Chương 1</h1>
          <div class="page-description"><p>Nội dung...</p></div>
          <div class="wpc-nav-next">
            <a href="https://comong.info/chapter/chuong-1" class="wpc-nav-link">Chương tiếp →</a>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, currentUrl, comongPreset);

      // Must NOT return currentUrl as nextUrl (would cause infinite loop!)
      expect(result.nextUrl).toBeUndefined();
    });

    it('C4.5: Self-referencing with hash anchor (# or #top) correctly returns undefined', () => {
      const currentUrl = 'https://comong.info/chapter/chuong-1';
      const html = `
        <div id="content">
          <h1>Chương 1</h1>
          <div class="page-description"><p>Nội dung...</p></div>
          <div class="wpc-nav-next">
            <a href="#" class="wpc-nav-link">Chương tiếp →</a>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, currentUrl, comongPreset);

      // href="#" correctly evaluated as no next chapter:
      expect(result.nextUrl).toBeUndefined();
    });
  });

  // =========================================================================
  // Challenge 5: extractTocWithRule Interface Contract & Edge Cases
  // =========================================================================
  describe('Challenge 5: extractTocWithRule Interface Contract & Resilience', () => {
    it('C5.1: Dual interface access: both array methods and object destructuring work seamlessly', () => {
      const html = `
        <div class="chapter-item"><a href="/c1">Chương 1</a></div>
        <div class="chapter-item"><a href="/c2">Chương 2</a></div>
        <div class="pagination"><a class="next" href="/p2">Trang sau</a></div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Style A: Object destructuring
      const { chapters, nextPaginationUrl } = extractTocWithRule(doc, comongPreset, 'https://comong.info/novel/');
      expect(chapters).toHaveLength(2);
      expect(nextPaginationUrl).toBe('https://comong.info/p2');

      // Style B: Array access
      const arr = extractTocWithRule(doc, comongPreset, 'https://comong.info/novel/');
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBe(2);
      expect(arr[0].title).toBe('Chương 1');
      expect(arr[1].title).toBe('Chương 2');
      expect(arr.chapters).toEqual(chapters);
      expect(arr.nextPaginationUrl).toBe('https://comong.info/p2');
    });

    it('C5.2: Deduplication of chapter links when multiple identical URLs exist in TOC', () => {
      const html = `
        <div class="chapter-item"><a href="/c1">Chương 1: Khởi đầu (Top)</a></div>
        <div class="chapter-item"><a href="/c2">Chương 2: Diễn biến (Top)</a></div>
        <div class="chapter-item"><a href="/c1">Chương 1: Khởi đầu (Bottom)</a></div>
        <div class="chapter-item"><a href="/c2">Chương 2: Diễn biến (Bottom)</a></div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const { chapters } = extractTocWithRule(doc, comongPreset, 'https://comong.info/novel/');

      expect(chapters).toHaveLength(2);
      expect(chapters[0].url).toBe('https://comong.info/c1');
      expect(chapters[1].url).toBe('https://comong.info/c2');
    });

    it('C5.3: Base tag in document head overrides baseUrl if currentUrl is missing', () => {
      const html = `
        <html>
          <head><base href="https://custom-cdn.comong.info/dir/"></head>
          <body>
            <div class="chapter-item"><a href="chuong-1">Chương 1</a></div>
          </body>
        </html>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const { chapters } = extractTocWithRule(doc, comongPreset);

      expect(chapters).toHaveLength(1);
      expect(chapters[0].url).toBe('https://custom-cdn.comong.info/dir/chuong-1');
    });
  });
});
