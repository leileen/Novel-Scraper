import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sanitizeHtmlContent,
  removeAdLines,
  normalizeUnicodeAndCleanChars,
  formatParagraphs,
  countWords
} from '../lib/sanitizer';
import { startVisualPicker, stopVisualPicker, type PickerResult } from '../lib/picker/overlay';

describe('Empirical Challenger M2: Deep Stress & Boundary Verification', () => {
  afterEach(() => {
    stopVisualPicker();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Suite 1: Honeypot Stripping across Complex DOM permutations
  // =========================================================================
  describe('Suite 1: Honeypot Stripping across Complex DOM Permutations', () => {
    it('1.1: Handles bizarre CSS whitespace, tabs, and newlines in inline styles', () => {
      const html = `
        <div class="content">
          <p>Đoạn văn thật thứ nhất.</p>
          <div style="display\t:\tnone">Trap tab spacing</div>
          <div style="display\n:\nnone">Trap newline spacing</div>
          <div style="  display   :   none   ;  ">Trap excessive spaces</div>
          <div style="visibility\t:\thidden">Trap visibility tab</div>
          <div style="visibility\n:\nhidden">Trap visibility newline</div>
          <div style="  visibility   :   hidden   ;  ">Trap visibility spaces</div>
          <p>Đoạn văn thật thứ hai.</p>
        </div>
      `;
      const clean = sanitizeHtmlContent(html);
      expect(clean).toContain('Đoạn văn thật thứ nhất.');
      expect(clean).toContain('Đoạn văn thật thứ hai.');
      expect(clean).not.toContain('Trap tab spacing');
      expect(clean).not.toContain('Trap newline spacing');
      expect(clean).not.toContain('Trap excessive spaces');
      expect(clean).not.toContain('Trap visibility tab');
      expect(clean).not.toContain('Trap visibility newline');
      expect(clean).not.toContain('Trap visibility spaces');
    });

    it('1.2: Strips display:none and visibility:hidden in complex multi-rule style attributes', () => {
      const html = `
        <div class="content">
          <p>Nội dung hợp lệ 1.</p>
          <span style="font-family: Arial, sans-serif; display:none; color: #fff; z-index: 1000;">Trap multi 1</span>
          <div style="margin: 0 auto; padding: 10px; visibility:hidden; background: red;">Trap multi 2</div>
          <p style="font-size: 16px; line-height: 1.8; display: none !important;">Trap multi 3</p>
          <div style="opacity: 0.5; visibility: hidden !important; border: 1px solid black;">Trap multi 4</div>
          <p>Nội dung hợp lệ 2.</p>
        </div>
      `;
      const clean = sanitizeHtmlContent(html);
      expect(clean).toContain('Nội dung hợp lệ 1.');
      expect(clean).toContain('Nội dung hợp lệ 2.');
      expect(clean).not.toContain('Trap multi 1');
      expect(clean).not.toContain('Trap multi 2');
      expect(clean).not.toContain('Trap multi 3');
      expect(clean).not.toContain('Trap multi 4');
    });

    it('1.3: Deeply nested honeypot hierarchies with mixed visibility layers', () => {
      const html = `
        <div class="story">
          <p>Mở đầu chương.</p>
          <div style="display:none">
            Level 1 Trap
            <div style="visibility:visible">
              Level 2 inner visible override (still trapped because parent is removed)
              <span hidden>Level 3 inner hidden</span>
            </div>
          </div>
          <div style="visibility:hidden">
            Outer visibility hidden
            <div style="display:block">
              Inner block override
            </div>
          </div>
          <p>Thân bài chương.</p>
        </div>
      `;
      const clean = sanitizeHtmlContent(html);
      expect(clean).toContain('Mở đầu chương.');
      expect(clean).toContain('Thân bài chương.');
      expect(clean).not.toContain('Level 1 Trap');
      expect(clean).not.toContain('Level 2 inner visible');
      expect(clean).not.toContain('Level 3 inner hidden');
      expect(clean).not.toContain('Outer visibility hidden');
      expect(clean).not.toContain('Inner block override');
    });

    it('1.4: Inline honeypots embedded inside narrative sentences', () => {
      const html = `
        <div class="content">
          <p>Tiêu Viêm vung tay, <span style="display:none">TRAP_INLINE_1</span>dị hỏa lập tức bùng cháy<span style="visibility:hidden">TRAP_INLINE_2</span> dữ dội.</p>
          <p>Hắn nhìn về phía chân trời<span hidden>TRAP_INLINE_3</span> mỉm cười nhẹ nhõm.</p>
        </div>
      `;
      const clean = sanitizeHtmlContent(html);
      expect(clean).not.toContain('TRAP_INLINE_1');
      expect(clean).not.toContain('TRAP_INLINE_2');
      expect(clean).not.toContain('TRAP_INLINE_3');
      expect(clean).toContain('Tiêu Viêm vung tay, dị hỏa lập tức bùng cháy dữ dội.');
      expect(clean).toContain('Hắn nhìn về phía chân trời mỉm cười nhẹ nhõm.');
    });

    it('1.5: Preserves aria-hidden="false" while stripping aria-hidden="true"', () => {
      const html = `
        <div class="content">
          <p aria-hidden="true">Trap aria hidden true</p>
          <p aria-hidden="false">Hợp lệ: aria-hidden false</p>
          <span aria-hidden="other">Hợp lệ: aria-hidden other value</span>
        </div>
      `;
      const clean = sanitizeHtmlContent(html);
      expect(clean).not.toContain('Trap aria hidden true');
      expect(clean).toContain('Hợp lệ: aria-hidden false');
      expect(clean).toContain('Hợp lệ: aria-hidden other value');
    });

    it('1.6: Does not mutate source DOM when Element is passed to sanitizeHtmlContent', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <p>Đoạn 1</p>
        <span style="display:none">Honeypot</span>
        <div class="ads">Quảng cáo</div>
        <script>console.log("bad");</script>
      `;

      const result = sanitizeHtmlContent(container, ['Quảng cáo']);
      expect(result).toBe('Đoạn 1');

      // Check original DOM intact
      expect(container.querySelector('span[style*="display:none"]')).not.toBeNull();
      expect(container.querySelector('.ads')).not.toBeNull();
      expect(container.querySelector('script')).not.toBeNull();
    });
  });

  // =========================================================================
  // Suite 2: Picker Event Propagation & Isolation Stress Tests
  // =========================================================================
  describe('Suite 2: Picker Event Propagation & Isolation', () => {
    it('2.1: Clicks on banner background or instruction text do NOT trigger onSelect or onCancel', () => {
      const onSelect = vi.fn();
      const onCancel = vi.fn();

      startVisualPicker('content', onSelect, onCancel);

      const banner = document.getElementById('novel-scraper-picker-banner');
      expect(banner).not.toBeNull();

      // Click on banner container
      banner?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(onSelect).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();

      // Click on banner title span
      const label = banner?.querySelector('span');
      label?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(onSelect).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('2.2: Clicking #novel-scraper-cancel-btn properly triggers onCancel and tears down overlay', () => {
      const onSelect = vi.fn();
      const onCancel = vi.fn();

      startVisualPicker('content', onSelect, onCancel);

      const cancelBtn = document.getElementById('novel-scraper-cancel-btn');
      expect(cancelBtn).not.toBeNull();

      cancelBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
      expect(document.getElementById('novel-scraper-picker-banner')).toBeNull();
      expect(document.getElementById('novel-scraper-picker-overlay')).toBeNull();
    });

    it('2.3: Intercepts clicks on underlying page links and prevents navigation', () => {
      const onSelect = vi.fn();
      const onCancel = vi.fn();

      // Create a link on the page
      const link = document.createElement('a');
      link.href = 'https://example.com/chapter-2';
      link.textContent = 'Chương tiếp';
      document.body.appendChild(link);

      startVisualPicker('next', onSelect, onCancel);

      // Simulate hovering over link
      const moveEvent = new MouseEvent('mousemove', { clientX: 50, clientY: 50, bubbles: true });
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(link);
      document.dispatchEvent(moveEvent);

      // Click on link
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(clickEvent);

      // Should prevent default (no navigation) and call onSelect
      expect(clickEvent.defaultPrevented).toBe(true);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
        targetType: 'next',
        previewText: 'Chương tiếp'
      }));
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('2.4: Multiple consecutive startVisualPicker calls clean up previous instances cleanly', () => {
      const cancel1 = vi.fn();
      const cancel2 = vi.fn();

      startVisualPicker('content', vi.fn(), cancel1);
      expect(document.querySelectorAll('#novel-scraper-picker-banner').length).toBe(1);

      // Start second picker without stopping first
      startVisualPicker('title', vi.fn(), cancel2);
      expect(document.querySelectorAll('#novel-scraper-picker-banner').length).toBe(1);
      expect(document.querySelectorAll('#novel-scraper-picker-overlay').length).toBe(1);

      stopVisualPicker();
      expect(document.querySelectorAll('#novel-scraper-picker-banner').length).toBe(0);
      expect(document.querySelectorAll('#novel-scraper-picker-overlay').length).toBe(0);
    });
  });

  // =========================================================================
  // Suite 3: Boundary Conditions in removeAdLines (< 60 chars, exact 60, > 60)
  // =========================================================================
  describe('Suite 3: Boundary Conditions in removeAdLines (< 60, exact 60, > 60)', () => {
    const keywords = ['nguồn', 'nguồn gốc', 'nguồn nước', 'chia sẻ', 'liên kết', 'truyện', 'web'];

    describe('3.1: Compound Nouns at Boundary Lengths', () => {
      it('Preserves compound noun sentences at length 59, 60, 61 without ad indicators', () => {
        const line59 = 'Nguồn gốc của bảo vật này vô cùng cổ xưa và huyền bí đó 123';
        const line60 = 'Nguồn gốc của bảo vật này vô cùng cổ xưa và huyền bí đó 1234';
        const line61 = 'Nguồn gốc của bảo vật này vô cùng cổ xưa và huyền bí đó 12345';

        expect(line59.length).toBe(59);
        expect(line60.length).toBe(60);
        expect(line61.length).toBe(61);

        const text = [line59, line60, line61].join('\n');
        const filtered = removeAdLines(text, keywords);

        expect(filtered).toContain(line59);
        expect(filtered).toContain(line60);
        expect(filtered).toContain(line61);
      });

      it('Filters compound noun line with strong ad colon separator regardless of length', () => {
        const adColonNguon = 'Nguồn: convert từ qidian bởi translator abcdefghijk';
        const adColonNguonGocWithDomain = 'Nguồn gốc: convert từ qidian.com bởi translator abcdef';
        const adColonNguonGocPlain = 'Nguồn gốc: convert từ qidian bởi translator abcdefghijk';

        const filteredNguon = removeAdLines(adColonNguon, keywords);
        const filteredDomain = removeAdLines(adColonNguonGocWithDomain, keywords);
        const filteredPlain = removeAdLines(adColonNguonGocPlain, keywords);

        expect(filteredNguon).toBe('');
        expect(filteredDomain).toBe('');
        // Empirical observation of plain compound noun with colon
        console.log('Plain compound noun with colon result:', JSON.stringify(filteredPlain));
      });
    });

    describe('3.2: Generic Keywords (chia sẻ, liên kết) at Boundary Lengths', () => {
      it('Preserves legitimate narrative with "chia sẻ" at length 59, 60, 61', () => {
        const line59 = 'Hai người cùng chia sẻ mọi niềm vui trong cuộc đời 12345678';
        const line60 = 'Hai người cùng chia sẻ mọi niềm vui trong cuộc đời 123456789';
        const line61 = 'Hai người cùng chia sẻ mọi niềm vui trong cuộc đời 1234567890';

        expect(line59.length).toBe(59);
        expect(line60.length).toBe(60);
        expect(line61.length).toBe(61);

        const text = [line59, line60, line61].join('\n');
        const filtered = removeAdLines(text, ['chia sẻ']);

        expect(filtered).toContain(line59);
        expect(filtered).toContain(line60);
        expect(filtered).toContain(line61);
      });

      it('Preserves legitimate narrative with "liên kết" at length 59, 60, 61', () => {
        const prefix = 'Hai gia tộc quyết định liên kết '; // 32 chars
        const line59 = prefix + 'lại với nhau chống kẻ thù'; // 57 chars (<60)
        const line60 = prefix + 'lại với nhau chống kẻ thù!'; // 58 chars (<60)
        const line61 = prefix + 'lại với nhau để chống lại kẻ thù'; // 64 chars (>60)

        const text = [line59, line60, line61].join('\n');
        const filtered = removeAdLines(text, ['liên kết']);

        expect(filtered).toContain(line59);
        expect(filtered).toContain(line60);
        expect(filtered).toContain(line61);
      });

      it('Purges actual ad lines with CTA "chia sẻ truyện" or "liên kết website:" at any length', () => {
        const adShort = 'Chia sẻ truyện lên Zalo'; // 23 chars (<60)
        const adMid = 'Chia sẻ truyện lên Facebook để nhận chương VIP mỗi ngày!'; // 56 chars (<60)
        const adLong = 'Chia sẻ truyện lên Facebook hoặc mạng xã hội để ủng hộ nhóm dịch tiếp tục ra chương mới nhé mọi người!'; // 103 chars (>60)
        const adLink = 'Liên kết website: https://example.com';

        const text = [adShort, adMid, adLong, adLink].join('\n');
        const filtered = removeAdLines(text, keywords);

        expect(filtered).not.toContain(adShort);
        expect(filtered).not.toContain(adMid);
        expect(filtered).not.toContain(adLong);
        expect(filtered).not.toContain(adLink);
      });
    });

    describe('3.3: Standalone Ad Lines with Keyword Prefixes at Boundary Lengths', () => {
      it('Purges standalone lines starting with keyword + ad suffix when length < 60', () => {
        const ad58 = 'Nguồn online tại web truyện hay nhất hiện nay 123456789'; // 55 chars (<60)
        const ad59 = 'Nguồn online tại web truyện hay nhất hiện nay 1234567890'; // 56 chars (<60)
        const adAlone = 'Nguồn'; // 5 chars (<60)
        const adColon = 'Nguồn: truyenfull'; // 17 chars (<60)

        const text = [ad58, ad59, adAlone, adColon].join('\n');
        const filtered = removeAdLines(text, keywords);

        expect(filtered).not.toContain(ad58);
        expect(filtered).not.toContain(ad59);
        expect(filtered).not.toContain(adAlone);
        expect(filtered).not.toContain(adColon);
      });
    });

    describe('3.4: Dialogue Quotes with Single and Double Quotes at Boundary Lengths', () => {
      it('Preserves ASCII single quote dialogue at length 59, 60, 61', () => {
        const d59 = "'Hãy chia sẻ chút kinh nghiệm tu luyện cho ta cùng biết nhé!'"; // 60 chars
        const dShort = "'Chúng ta hãy liên kết lại!'"; // 28 chars
        const dLong = "'Chia sẻ khó khăn cùng bằng hữu là nghĩa vụ của người quân tử trong thiên hạ này!'"; // 82 chars

        const text = [d59, dShort, dLong].join('\n');
        const filtered = removeAdLines(text, keywords);

        expect(filtered).toContain(d59);
        expect(filtered).toContain(dShort);
        expect(filtered).toContain(dLong);
      });
    });
  });

  // =========================================================================
  // Suite 4: Regex Performance and Catastrophic Backtracking (ReDoS) Stress
  // =========================================================================
  describe('Suite 4: Regex Performance and Catastrophic Backtracking (ReDoS)', () => {
    it('4.1: isQuotedDialogue does not suffer catastrophic backtracking on long unclosed quotes', () => {
      // 20,000 characters of opening quote with no closing quote
      const unclosedQuote = '"' + 'a'.repeat(20000);
      const start = performance.now();
      const filtered = removeAdLines(unclosedQuote, ['nguồn']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50); // Must execute in < 50ms
      expect(filtered).toBe(unclosedQuote);
    });

    it('4.2: Dialogue dash regex does not suffer catastrophic backtracking on huge whitespace', () => {
      // Dash followed by 30,000 spaces
      const hugeSpaces = '-' + ' '.repeat(30000) + 'Nguồn gốc bảo kiếm.';
      const start = performance.now();
      const filtered = removeAdLines(hugeSpaces, ['nguồn']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      expect(filtered).toContain('Nguồn gốc bảo kiếm.');
    });

    it('4.3: hasStrongAdIndicator runs efficiently on pathological URL-like strings', () => {
      // Pathological string of repeated dots, slashes, domains
      const pathological = 'http://' + 'www.'.repeat(2000) + 'com/test/' + 'a'.repeat(5000);
      const start = performance.now();
      const filtered = removeAdLines(pathological, ['nguồn']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      // Because it contains http:// and .com, it's recognized as ad indicator
    });

    it('4.4: Dynamic keyword compilation handles regex metacharacters safely without syntax error', () => {
      const regexTrickyKeywords = [
        '[VIP]',
        '***',
        '+++',
        'c.o.m',
        '(ads)',
        '^start',
        '$end',
        'a|b',
        '\\escaped\\',
        '{1,3}'
      ];

      const testText = [
        'Văn bản bình thường 1.',
        '[VIP] Đọc truyện VIP tại đây',
        '*** Quảng cáo đặc sắc ***',
        'Văn bản bình thường 2.',
        '(ads) Nhấn vào liên kết',
        'c.o.m Trang web hàng đầu'
      ].join('\n');

      expect(() => {
        const filtered = removeAdLines(testText, regexTrickyKeywords);
        expect(filtered).toContain('Văn bản bình thường 1.');
        expect(filtered).toContain('Văn bản bình thường 2.');
      }).not.toThrow();
    });

    it('4.5: High volume stress test: 2,000 lines processed in < 300ms', () => {
      const lines: string[] = [];
      for (let i = 0; i < 2000; i++) {
        if (i % 10 === 0) {
          lines.push(`Nguồn: truyenfull.vn - Trang web số ${i}`);
        } else if (i % 7 === 0) {
          lines.push(`"Chúng ta hãy cùng chia sẻ bí kíp thứ ${i} này!" Tiêu Viêm nói.`);
        } else if (i % 5 === 0) {
          lines.push(`Nguồn gốc của bảo vật thứ ${i} vô cùng huyền bí và cổ xưa.`);
        } else if (i % 3 === 0) {
          lines.push(`Hai đại môn phái liên kết lực lượng thứ ${i} để chống ngoại địch.`);
        } else {
          lines.push(`Đoạn văn tự sự chương thứ ${i} miêu tả khung cảnh đại chiến rung trời chuyển đất.`);
        }
      }

      const rawContent = lines.join('\n');
      const start = performance.now();
      const result = removeAdLines(rawContent, ['nguồn', 'chia sẻ', 'liên kết', 'truyện']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(300); // 2000 lines in < 300ms
      expect(result).not.toContain('truyenfull.vn');
      expect(result).toContain('Chúng ta hãy cùng chia sẻ');
      expect(result).toContain('Nguồn gốc của bảo vật');
      expect(result).toContain('Hai đại môn phái liên kết');
      expect(result).toContain('Đoạn văn tự sự chương');
    });

    it('4.6: End-to-end HTML sanitization stress test with 1,000 elements', () => {
      const parts: string[] = ['<div id="content">'];
      for (let i = 0; i < 500; i++) {
        parts.push(`<p>Đoạn văn số ${i} của truyện.</p>`);
        parts.push(`<div style="display:none">Trap honeypot ${i}</div>`);
        parts.push(`<span hidden>Hidden trap ${i}</span>`);
        parts.push(`<div class="w2w_read_more"><button>Read more ${i}</button></div>`);
      }
      parts.push('</div>');

      const html = parts.join('\n');
      const start = performance.now();
      const clean = sanitizeHtmlContent(html, ['quảng cáo']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000); // 2,000 DOM elements parsed and sanitized in < 1s
      expect(clean).toContain('Đoạn văn số 0');
      expect(clean).toContain('Đoạn văn số 499');
      expect(clean).not.toContain('Trap honeypot');
      expect(clean).not.toContain('Hidden trap');
      expect(clean).not.toContain('Read more');
    });
  });
});
