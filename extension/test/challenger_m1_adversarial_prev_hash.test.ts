import { describe, it, expect } from 'vitest';
import {
  extractChapterWithRule,
  resolveUrl,
  safeQuerySelector,
  safeQuerySelectorAll
} from '../lib/extractor';
import {
  findNextChapterUrl,
  extractChapterHeuristically,
  NEXT_LINK_REGEX
} from '../lib/extractor/heuristic';
import { DEFAULT_SITE_RULES } from '../lib/db/presets';
import type { SiteRule } from '../lib/types';

describe('Milestone 1 Challenger 3 Adversarial Prev-Link & Hash Anchor Verification', () => {
  const comongPreset = DEFAULT_SITE_RULES.find((r) => r.domain === 'comong.info') as SiteRule;

  // =========================================================================
  // Requirement 3: Adversarial Prev-Link Labels
  // Prev-link must NEVER be returned as nextUrl under any label or layout
  // =========================================================================
  describe('Adversarial Prev-Link Labels in comong.info Preset', () => {
    const adversarialPrevLabels = [
      '←',
      '«',
      '‹',
      '<',
      'Lùi',
      'lùi',
      'Back',
      'back',
      'BACK',
      'Quay lại',
      'quay lại',
      'Trước',
      'trước',
      'Chương trước',
      'Prev',
      'prev',
      'Previous',
      'Previous Chapter',
      'Tập trước',
      'Tập cũ',
      'Chap trước',
      '', // empty text (e.g. icon only)
      '   ', // whitespace only
      '<i class="fa fa-angle-left"></i>',
      '<svg class="icon-prev"></svg>'
    ];

    it('3.1: Multi-chapter page: nextUrl is ALWAYS next chapter, NEVER prev chapter, across all adversarial prev labels', () => {
      const currentUrl = 'https://comong.info/chapter/chuong-2';
      const prevUrl = 'https://comong.info/chapter/chuong-1';
      const nextUrlExpected = 'https://comong.info/chapter/chuong-3';

      for (const label of adversarialPrevLabels) {
        const html = `
          <div id="content">
            <h1>Chương 2: Thử thách hiểm nguy</h1>
            <div class="page-description"><p>Nội dung chương 2...</p></div>
            <div class="wpc-chapter-nav-simple">
              <div class="wpc-nav-prev">
                <a href="${prevUrl}" class="wpc-nav-link">${label}</a>
              </div>
              <div class="wpc-nav-next">
                <a href="${nextUrlExpected}" class="wpc-nav-link">Chương tiếp →</a>
              </div>
            </div>
          </div>
        `;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const result = extractChapterWithRule(doc, currentUrl, comongPreset);

        expect(result.nextUrl, `Failed for prev label: "${label}"`).toBe(nextUrlExpected);
        expect(result.nextUrl).not.toBe(prevUrl);
      }
    });

    it('3.2: Terminal / Last chapter page (no next button): nextUrl is NEVER prev chapter, MUST be undefined', () => {
      const currentUrl = 'https://comong.info/chapter/chuong-100';
      const prevUrl = 'https://comong.info/chapter/chuong-99';

      for (const label of adversarialPrevLabels) {
        const html = `
          <div id="content">
            <h1>Chương 100: Đại kết cục</h1>
            <div class="page-description"><p>Hết truyện.</p></div>
            <div class="wpc-chapter-nav-simple">
              <div class="wpc-nav-prev">
                <a href="${prevUrl}" class="wpc-nav-link">${label}</a>
              </div>
            </div>
          </div>
        `;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const result = extractChapterWithRule(doc, currentUrl, comongPreset);

        expect(result.nextUrl, `Failed on terminal chapter for prev label: "${label}"`).toBeUndefined();
        expect(result.nextUrl).not.toBe(prevUrl);
      }
    });

    it('3.3: Terminal chapter with disabled next element: nextUrl is NEVER prev chapter', () => {
      const currentUrl = 'https://comong.info/chapter/chuong-50';
      const prevUrl = 'https://comong.info/chapter/chuong-49';

      for (const label of adversarialPrevLabels) {
        const html = `
          <div id="content">
            <h1>Chương 50: Hồi kết</h1>
            <div class="page-description"><p>Kết thúc bộ truyện.</p></div>
            <div class="wpc-chapter-nav-simple">
              <div class="wpc-nav-prev">
                <a href="${prevUrl}" class="wpc-nav-link">${label}</a>
              </div>
              <div class="wpc-nav-next">
                <span class="wpc-nav-disabled">Chương tiếp →</span>
              </div>
            </div>
          </div>
        `;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const result = extractChapterWithRule(doc, currentUrl, comongPreset);

        expect(result.nextUrl, `Failed for label: "${label}"`).toBeUndefined();
      }
    });
  });

  describe('Adversarial Prev-Link Labels in Heuristic Extraction (no preset)', () => {
    const heuristicPrevLabels = [
      '←',
      '«',
      '‹',
      'Lùi',
      'Back',
      'Quay lại',
      'Trước',
      'Chương trước',
      'Prev',
      'Previous'
    ];

    it('3.4: Heuristic findNextChapterUrl when next button is present alongside adversarial prev buttons', () => {
      const currentUrl = 'https://unknown-site.org/novel/chap-5';
      const prevUrl = 'https://unknown-site.org/novel/chap-4';
      const nextUrlExpected = 'https://unknown-site.org/novel/chap-6';

      for (const label of heuristicPrevLabels) {
        const html = `
          <div>
            <h1>Chap 5: Bí mật hoàng gia</h1>
            <div class="content"><p>Nội dung câu chuyện...</p></div>
            <div class="nav-controls">
              <a href="${prevUrl}" class="btn-prev">${label}</a>
              <a href="${nextUrlExpected}" class="btn-next">Chương tiếp →</a>
            </div>
          </div>
        `;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const nextFound = findNextChapterUrl(doc, currentUrl);

        expect(nextFound, `Heuristic failed for label: "${label}"`).toBe(nextUrlExpected);
        expect(nextFound).not.toBe(prevUrl);
      }
    });

    it('3.5: Heuristic findNextChapterUrl when NO next button exists: must return undefined, NEVER prevUrl', () => {
      const currentUrl = 'https://unknown-site.org/novel/chap-50';
      const prevUrl = 'https://unknown-site.org/novel/chap-49';

      for (const label of heuristicPrevLabels) {
        const html = `
          <div>
            <h1>Chap 50: Hết truyện</h1>
            <div class="content"><p>Nội dung...</p></div>
            <div class="nav-controls">
              <a href="${prevUrl}" class="btn-prev">${label}</a>
            </div>
          </div>
        `;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const nextFound = findNextChapterUrl(doc, currentUrl);

        expect(nextFound, `Heuristic falsely picked prev link for label: "${label}"`).toBeUndefined();
      }
    });

    it('3.6: NEXT_LINK_REGEX strictly rejects all adversarial prev-link labels', () => {
      const negativeLabels = [
        '←',
        '«',
        '‹',
        '<',
        'Lùi',
        'lùi',
        'Back',
        'back',
        'BACK',
        'Quay lại',
        'quay lại',
        'Trước',
        'trước',
        'Chương trước',
        'chương trước',
        'Prev',
        'prev',
        'Previous',
        'previous',
        'Previous Chapter',
        'Tập trước',
        'Chap trước',
        'Hồi trước',
        '',
        ' '
      ];

      for (const label of negativeLabels) {
        expect(NEXT_LINK_REGEX.test(label), `NEXT_LINK_REGEX must not match "${label}"`).toBe(false);
      }
    });
  });

  // =========================================================================
  // Requirement 4: Verify href="#" and href="#top" return undefined nextUrl
  // =========================================================================
  describe('Requirement 4: Hash Anchors (#, #top, in-page fragments) Safety', () => {
    it('4.1: Direct resolveUrl tests with "#", "#top", and case/whitespace variations', () => {
      const base = 'https://comong.info/chapter/chuong-1';

      expect(resolveUrl('#', base)).toBeUndefined();
      expect(resolveUrl('#top', base)).toBeUndefined();
      expect(resolveUrl('  #  ', base)).toBeUndefined();
      expect(resolveUrl('  #top  ', base)).toBeUndefined();
      expect(resolveUrl('\t#\n', base)).toBeUndefined();
      expect(resolveUrl('\t#top\n', base)).toBeUndefined();
      expect(resolveUrl('', base)).toBeUndefined();
      expect(resolveUrl('   ', base)).toBeUndefined();
      expect(resolveUrl(null, base)).toBeUndefined();
      expect(resolveUrl(undefined, base)).toBeUndefined();
    });

    it('4.2: extractChapterWithRule: href="#", href="#top", "#TOP", "#header" on next button return undefined nextUrl', () => {
      const currentUrl = 'https://comong.info/chapter/chuong-1';
      const dummyHrefs = ['#', '#top', '#TOP', '#Top', '  #  ', '  #top  ', '\t#\n', '#header', '#content'];

      for (const href of dummyHrefs) {
        const html = `
          <div id="content">
            <h1>Chương 1</h1>
            <div class="page-description"><p>Nội dung...</p></div>
            <div class="wpc-nav-next">
              <a href="${href}" class="wpc-nav-link">Chương tiếp →</a>
            </div>
          </div>
        `;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const result = extractChapterWithRule(doc, currentUrl, comongPreset);

        expect(result.nextUrl, `Failed for href="${href}" in extractChapterWithRule`).toBeUndefined();
      }
    });

    it('4.2b: When currentUrl itself contains a fragment, fragment links to current page still return undefined', () => {
      const currentUrlWithHash = 'https://comong.info/chapter/chuong-1#top';
      const dummyHrefs = ['#', '#top', '#TOP', '#section2', '/chapter/chuong-1#comments'];

      for (const href of dummyHrefs) {
        const html = `
          <div id="content">
            <h1>Chương 1</h1>
            <div class="page-description"><p>Nội dung...</p></div>
            <div class="wpc-nav-next">
              <a href="${href}" class="wpc-nav-link">Chương tiếp →</a>
            </div>
          </div>
        `;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const result = extractChapterWithRule(doc, currentUrlWithHash, comongPreset);

        expect(result.nextUrl, `Failed for href="${href}" when currentUrl has fragment`).toBeUndefined();
      }
    });

    it('4.3: In-page fragment anchors (e.g. #content, #comments, #chapter-nav) return undefined nextUrl', () => {
      const currentUrl = 'https://comong.info/chapter/chuong-1';
      const fragmentHrefs = [
        '#content',
        '#comments',
        '#nav',
        '#footer',
        '#header',
        'https://comong.info/chapter/chuong-1#top',
        'https://comong.info/chapter/chuong-1#section-2',
        '/chapter/chuong-1#content'
      ];

      for (const href of fragmentHrefs) {
        const html = `
          <div id="content">
            <h1>Chương 1</h1>
            <div class="page-description"><p>Nội dung...</p></div>
            <div class="wpc-nav-next">
              <a href="${href}" class="wpc-nav-link">Chương tiếp →</a>
            </div>
          </div>
        `;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const result = extractChapterWithRule(doc, currentUrl, comongPreset);

        expect(result.nextUrl, `Failed: fragment link "${href}" was returned as nextUrl`).toBeUndefined();
      }
    });

    it('4.4: Heuristic findNextChapterUrl: href="#" and in-page fragment links return undefined nextUrl', () => {
      const currentUrl = 'https://novel-site.com/c1';
      const dummyHrefs = ['#', '#top', '#comments', 'https://novel-site.com/c1#page-top'];

      for (const href of dummyHrefs) {
        const html = `
          <div>
            <h1>Chương 1</h1>
            <div class="content"><p>Nội dung...</p></div>
            <div class="pagination">
              <a href="${href}" class="btn-next">Chương tiếp →</a>
            </div>
          </div>
        `;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const nextUrl = findNextChapterUrl(doc, currentUrl);

        expect(nextUrl, `Heuristic failed for href="${href}"`).toBeUndefined();
      }
    });

    it('4.5: Genuine different chapter with fragment (e.g. chuong-2#top) extracts cleanly', () => {
      const currentUrl = 'https://comong.info/chapter/chuong-1';
      const html = `
        <div id="content">
          <h1>Chương 1</h1>
          <div class="page-description"><p>Nội dung...</p></div>
          <div class="wpc-nav-next">
            <a href="https://comong.info/chapter/chuong-2#top" class="wpc-nav-link">Chương tiếp →</a>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, currentUrl, comongPreset);

      expect(result.nextUrl).toBe('https://comong.info/chapter/chuong-2#top');
    });

    it('4.6: Case variations in JavaScript schemes return undefined nextUrl', () => {
      const scriptHrefs = [
        'javascript:void(0)',
        'JAVASCRIPT:void(0)',
        'JavaScript:void(0);',
        'javascript:;',
        'javascript:goToNextChapter()',
        'JavaScript:window.location.reload()'
      ];

      for (const href of scriptHrefs) {
        expect(resolveUrl(href, 'https://example.com/c1')).toBeUndefined();

        const html = `
          <div id="content">
            <h1>Chương 1</h1>
            <div class="page-description"><p>Nội dung...</p></div>
            <div class="wpc-nav-next">
              <a href="${href}" class="wpc-nav-link">Chương tiếp →</a>
            </div>
          </div>
        `;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const result = extractChapterWithRule(doc, 'https://comong.info/chapter/c1', comongPreset);
        expect(result.nextUrl, `Failed for script scheme: "${href}"`).toBeUndefined();
      }
    });
  });
});
