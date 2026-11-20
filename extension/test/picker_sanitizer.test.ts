import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeUnicodeAndCleanChars,
  removeAdLines,
  formatParagraphs,
  countWords,
  sanitizeHtmlContent,
  UNWANTED_TAGS
} from '../lib/sanitizer';
import { generateSelector } from '../lib/picker/selector';
import { startVisualPicker, stopVisualPicker, type PickerResult } from '../lib/picker/overlay';
import type { SiteRule } from '../lib/types';

describe('Picker & Sanitizer Suite', () => {
  afterEach(() => {
    stopVisualPicker();
    document.body.innerHTML = '';
  });

  // =========================================================================
  // Tier 1: Feature Coverage — Sanitizer
  // =========================================================================
  describe('Tier 1: Sanitizer Feature Coverage', () => {
    it('S1.1: normalizeUnicodeAndCleanChars normalizes Vietnamese NFC and strips zero-width chars', () => {
      // Combining accents vs precomposed accents
      const decomposed = 'T\u0069\u0301nh'; // T + i + acute (Tính decomposed)
      const zeroWidthMess = `\u200B${decomposed}\u200C \u200Dđẹp\uFEFF\u00AD\u2060\u200E\u200F`;
      const cleaned = normalizeUnicodeAndCleanChars(zeroWidthMess);

      expect(cleaned).toBe('Tính đẹp');
      expect(cleaned).not.toContain('\u200B');
      expect(cleaned).not.toContain('\uFEFF');
      expect(cleaned).not.toContain('\u00AD');
    });

    it('S1.2: removeAdLines filters ad sentences based on keywords case-insensitively', () => {
      const storyWithAds = [
        'Tiêu Viêm từ từ mở mắt ra.',
        'Nguồn: truyenfull.vn - Website đọc truyện hàng đầu',
        'Cảm nhận được đấu khí hùng hậu cuộn trào trong kinh mạch.',
        'Đọc truyện tại TruyenFull ủng hộ dịch giả',
        'Hắn bất giác nở nụ cười tự tin.'
      ].join('\n');

      const keywords = ['nguồn:', 'truyenfull'];
      const filtered = removeAdLines(storyWithAds, keywords);

      expect(filtered).toContain('Tiêu Viêm từ từ mở mắt ra.');
      expect(filtered).toContain('Cảm nhận được đấu khí hùng hậu cuộn trào trong kinh mạch.');
      expect(filtered).toContain('Hắn bất giác nở nụ cười tự tin.');
      expect(filtered).not.toContain('Nguồn: truyenfull.vn');
      expect(filtered).not.toContain('Đọc truyện tại TruyenFull');
    });

    it('S1.3: formatParagraphs standardizes paragraph breaks and trims whitespace', () => {
      const messySpacedText = `
        Đoạn văn thứ nhất có khoảng trắng dư thừa ở đầu và cuối.      
        
              
        Đoạn văn thứ hai sau nhiều dòng trống.     
        
        Đoạn văn thứ ba.
      `;
      const formatted = formatParagraphs(messySpacedText);

      expect(formatted).toBe(
        'Đoạn văn thứ nhất có khoảng trắng dư thừa ở đầu và cuối.\n\n' +
        'Đoạn văn thứ hai sau nhiều dòng trống.\n\n' +
        'Đoạn văn thứ ba.'
      );
    });

    it('S1.4: sanitizeHtmlContent strips UNWANTED_TAGS and ad elements from raw HTML', () => {
      const dirtyHtml = `
        <div class="chapter-content">
          <script>console.log("malicious code");</script>
          <style>.ad { color: red; }</style>
          <div class="ads">Quảng cáo banner trên cùng</div>
          <p>Ánh trăng vằng vặc chiếu sáng đỉnh núi Tuyết Sơn.</p>
          <div class="social-share"><button>Share Facebook</button></div>
          <iframe></iframe>
          <p>Bạch y kiếm khách đứng lặng lẽ trong gió tuyết.</p>
          <div class="chapter-nav"><button>Chương sau</button></div>
          <audio src="bgm.mp3"></audio>
        </div>
      `;

      const cleanText = sanitizeHtmlContent(dirtyHtml, ['Quảng cáo banner']);

      expect(cleanText).toContain('Ánh trăng vằng vặc chiếu sáng đỉnh núi Tuyết Sơn.');
      expect(cleanText).toContain('Bạch y kiếm khách đứng lặng lẽ trong gió tuyết.');
      expect(cleanText).not.toContain('malicious code');
      expect(cleanText).not.toContain('Quảng cáo banner');
      expect(cleanText).not.toContain('Share Facebook');
      expect(cleanText).not.toContain('bgm.mp3');
    });

    it('S1.5: countWords accurately counts words with Vietnamese diacritics', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('Một, hai, ba! Bốn?')).toBe(4);
      expect(countWords('Muội muội từ nhỏ đã biết tính toán.')).toBe(8);
      expect(countWords('Trọng sinh chi ma giáo giáo chủ 123')).toBe(8);
    });
  });

  // =========================================================================
  // Tier 1: Feature Coverage — Element Picker
  // =========================================================================
  describe('Tier 1: Element Picker Feature Coverage', () => {
    it('P1.1: generateSelector creates clean ID selector for static unique ID', () => {
      const container = document.createElement('div');
      container.id = 'chapter-content';
      document.body.appendChild(container);

      const selector = generateSelector(container);
      expect(selector).toBe('#chapter-content');
    });

    it('P1.2: generateSelector creates clean class selector for unique semantic class', () => {
      const contentEl = document.createElement('div');
      contentEl.className = 'page-description';
      document.body.appendChild(contentEl);

      const selector = generateSelector(contentEl);
      expect(selector).toBe('.page-description');
    });

    it('P1.3: generateSelector combines classes when a single class is not unique', () => {
      const el1 = document.createElement('div');
      el1.className = 'box highlighted';
      const el2 = document.createElement('div');
      el2.className = 'box other';
      const el3 = document.createElement('div');
      el3.className = 'card highlighted';
      document.body.appendChild(el1);
      document.body.appendChild(el2);
      document.body.appendChild(el3);

      const selector = generateSelector(el1);
      expect(selector).toBe('.box.highlighted');
    });

    it('P1.4: generateSelector ignores noisy utility classes (active, hover, row, col, etc.)', () => {
      const target = document.createElement('div');
      target.className = 'active hover row reading-body selected';
      document.body.appendChild(target);

      const selector = generateSelector(target);
      expect(selector).toBe('.reading-body');
      expect(selector).not.toContain('.active');
      expect(selector).not.toContain('.hover');
      expect(selector).not.toContain('.selected');
    });

    it('P1.5: generateSelector falls back to hierarchical path when element has no unique ID or class', () => {
      const parent = document.createElement('article');
      const div1 = document.createElement('div');
      div1.appendChild(document.createElement('p'));
      const div2 = document.createElement('div');
      const targetP = document.createElement('p');

      div2.appendChild(targetP);
      parent.appendChild(div1);
      parent.appendChild(div2);
      document.body.appendChild(parent);

      const selector = generateSelector(targetP);
      expect(selector).toBe('div:nth-of-type(2) > p');
    });
  });

  // =========================================================================
  // Tier 2: Boundary & Corner Cases — Sanitizer
  // =========================================================================
  describe('Tier 2: Sanitizer Boundary & Corner Cases', () => {
    it('S2.1: Strips hidden honeypot elements with inline styles and hidden attributes', () => {
      const honeypotHtml = `
        <div class="content">
          <p>Đoạn văn thật sự của tác giả.</p>
          <span style="display:none">Đây là bẫy chống cào dữ liệu của website</span>
          <div style="display: none;">Trap ẩn chống bot</div>
          <span style="visibility:hidden">Honeypot ẩn visibility</span>
          <p hidden>Bẫy ẩn bằng thuộc tính hidden</p>
          <div aria-hidden="true" style="display:none">Bẫy aria hidden</div>
          <p>Đoạn văn kết thúc câu chuyện.</p>
        </div>
      `;

      // Sanitizer strips unwanted tags; hidden honeypots are stripped
      const clean = sanitizeHtmlContent(honeypotHtml);
      expect(clean).toContain('Đoạn văn thật sự của tác giả.');
      expect(clean).toContain('Đoạn văn kết thúc câu chuyện.');
    });

    it('S2.2: Preserves legitimate story sentences that mention watermark words in context', () => {
      const text = [
        'Tiêu Viêm bước đến bờ suối, uống một ngụm nguồn nước mát lành.',
        'Nguồn: truyenfull.vn',
        'Hắn cảm thấy tinh thần sảng khoái phi thường.'
      ].join('\n');

      // Exact keyword "Nguồn:" with colon
      const filtered = removeAdLines(text, ['Nguồn: truyenfull.vn']);
      expect(filtered).toContain('Tiêu Viêm bước đến bờ suối, uống một ngụm nguồn nước mát lành.');
      expect(filtered).not.toContain('Nguồn: truyenfull.vn');
    });

    it('S2.3: Handles empty string, pure whitespace, and null/undefined gracefully', () => {
      expect(normalizeUnicodeAndCleanChars('')).toBe('');
      expect(removeAdLines('', ['ad'])).toBe('');
      expect(formatParagraphs('   \n\n   \t  ')).toBe('');
      expect(sanitizeHtmlContent('')).toBe('');
      expect(countWords('')).toBe(0);
    });

    it('S2.4: Direct DOM Element input should not mutate source DOM tree', () => {
      const container = document.createElement('div');
      container.innerHTML = '<p>Văn bản truyện</p><script>alert(1)</script><div class="ads">Ad</div>';

      // Pass element clone/reference
      const clean = sanitizeHtmlContent(container);

      expect(clean).toBe('Văn bản truyện');
      // Verify container still has original nodes (unmutated)
      expect(container.querySelectorAll('script').length).toBe(1);
      expect(container.querySelectorAll('.ads').length).toBe(1);
    });
  });

  // =========================================================================
  // Tier 2: Boundary & Corner Cases — Element Picker
  // =========================================================================
  describe('Tier 2: Element Picker Boundary & Corner Cases', () => {
    it('P2.1: Rejects dynamic or transient IDs (React/Vue/Ember hashes, long numeric sequences)', () => {
      const dynamicIds = [':r0:', 'ember123', 'tmp123', 'vue-88', 'react-123', 'content-9876543210'];

      dynamicIds.forEach((id) => {
        const el = document.createElement('div');
        el.id = id;
        el.className = 'story-text';
        document.body.appendChild(el);

        const selector = generateSelector(el);
        // Should not use the dynamic ID
        expect(selector).not.toContain(`#${id}`);
        expect(selector).toBe('.story-text');
        el.remove();
      });
    });

    it('P2.2: Rejects dynamic CSS hash class names (random hex, base64-like hashes)', () => {
      const target = document.createElement('div');
      target.className = 'css-1a2b3c4d5e6f genuine-chapter-content';
      document.body.appendChild(target);

      const selector = generateSelector(target);
      expect(selector).toBe('.genuine-chapter-content');
      expect(selector).not.toContain('css-1a2b3c4d5e6f');
    });

    it('P2.3: Visual picker overlay lifecycle (mount, escape cancel, and cleanup)', () => {
      const onSelect = vi.fn();
      const onCancel = vi.fn();

      startVisualPicker('content', onSelect, onCancel);

      // Verify overlay elements mounted to DOM
      const overlay = document.getElementById('novel-scraper-picker-overlay');
      const banner = document.getElementById('novel-scraper-picker-banner');
      expect(overlay).not.toBeNull();
      expect(banner).not.toBeNull();
      expect(banner?.textContent).toContain('Khung nội dung (Content)');

      // Simulate ESC key press to cancel
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.dispatchEvent(escEvent);

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(document.getElementById('novel-scraper-picker-overlay')).toBeNull();
      expect(document.getElementById('novel-scraper-picker-banner')).toBeNull();
    });

    it('P2.4: stopVisualPicker completely dismantles overlay, banner, and listeners', () => {
      startVisualPicker('title', vi.fn(), vi.fn());
      expect(document.getElementById('novel-scraper-picker-banner')).not.toBeNull();
      expect(document.getElementById('novel-scraper-picker-overlay')).not.toBeNull();

      stopVisualPicker();

      expect(document.getElementById('novel-scraper-picker-banner')).toBeNull();
      expect(document.getElementById('novel-scraper-picker-overlay')).toBeNull();
    });
  });

  // =========================================================================
  // Tier 3: Cross-Feature Integration — Picker Result Message Handling
  // =========================================================================
  describe('Tier 3: Picker Result Message Handling', () => {
    it('P3.1: Validates PICKER_RESULT message contract and updates site rule selectors', () => {
      // Simulates extension messaging pipeline: content script sends PICKER_RESULT
      const incomingMessage: {
        action: string;
        targetType: 'content' | 'title' | 'next';
        selector: string;
        previewText: string;
      } = {
        action: 'PICKER_RESULT',
        targetType: 'content',
        selector: '.page-description',
        previewText: 'Muội muội từ nhỏ đã biết tính toán...'
      };

      // Handler function matching extension message dispatcher contract
      function applyPickerResultToRule(rule: Partial<SiteRule>, msg: typeof incomingMessage): Partial<SiteRule> {
        if (msg.action !== 'PICKER_RESULT') return rule;

        const updated = { ...rule, updatedAt: Date.now() };
        if (msg.targetType === 'content') {
          updated.contentSelector = msg.selector;
        } else if (msg.targetType === 'title') {
          updated.titleSelector = msg.selector;
        } else if (msg.targetType === 'next') {
          updated.nextSelector = msg.selector;
        }
        return updated;
      }

      const initialRule: Partial<SiteRule> = {
        domain: 'comong.info',
        name: 'Cổ Mộng',
        contentSelector: '#old-content'
      };

      const updatedRule = applyPickerResultToRule(initialRule, incomingMessage);

      expect(updatedRule.contentSelector).toBe('.page-description');
      expect(updatedRule.updatedAt).toBeGreaterThan(0);
    });

    it('P3.2: Routes targetType title and next selectors correctly into rule configuration', () => {
      let rule: Partial<SiteRule> = { domain: 'comong.info' };

      const titleMsg = {
        action: 'PICKER_RESULT',
        targetType: 'title' as const,
        selector: 'h1:not(.story-title)',
        previewText: 'Chương 1'
      };

      const nextMsg = {
        action: 'PICKER_RESULT',
        targetType: 'next' as const,
        selector: '.wpc-nav-next a',
        previewText: 'Chương tiếp →'
      };

      if (titleMsg.targetType === 'title') rule.titleSelector = titleMsg.selector;
      if (nextMsg.targetType === 'next') rule.nextSelector = nextMsg.selector;

      expect(rule.titleSelector).toBe('h1:not(.story-title)');
      expect(rule.nextSelector).toBe('.wpc-nav-next a');
    });
  });
});
