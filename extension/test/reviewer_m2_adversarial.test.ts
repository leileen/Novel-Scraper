import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sanitizeHtmlContent,
  removeAdLines,
  normalizeUnicodeAndCleanChars,
  formatParagraphs
} from '../lib/sanitizer';
import { startVisualPicker, stopVisualPicker } from '../lib/picker/overlay';
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

// Import saveSiteRule and getRuleForDomain after mocking db
import { saveSiteRule, getRuleForDomain } from '../lib/rules';

describe('Adversarial Reviewer Stress Suite: Milestone 2', () => {
  beforeEach(() => {
    mockRulesStore.clear();
    nextRuleId = 1;
  });

  afterEach(async () => {
    stopVisualPicker();
    document.body.innerHTML = '';
  });

  // =========================================================================
  // Challenge 1: Honeypot & Anti-Scraper Evasion Stress Testing
  // =========================================================================
  describe('Challenge 1: Honeypot Evasion & Widget Stripping', () => {
    it('C1.1: Handles bizarre CSS whitespace, capitalization, and !important', () => {
      const html = `
        <div class="content">
          <p>Đoạn văn mở đầu câu chuyện.</p>
          <span style="display:none !important">Trap display:none !important</span>
          <div style="DISPLAY : NONE ;">Trap DISPLAY : NONE ;</div>
          <span style="visibility : hidden ; font-size: 10px;">Trap visibility : hidden</span>
          <p style="VISIBILITY:HIDDEN">Trap VISIBILITY:HIDDEN</p>
          <div style="color: blue; display : none; margin: 0">Trap middle display:none</div>
          <p>Đoạn văn thứ hai hoàn toàn sạch sẽ.</p>
        </div>
      `;
      const clean = sanitizeHtmlContent(html);
      expect(clean).toContain('Đoạn văn mở đầu câu chuyện.');
      expect(clean).toContain('Đoạn văn thứ hai hoàn toàn sạch sẽ.');
      expect(clean).not.toContain('Trap display');
      expect(clean).not.toContain('Trap DISPLAY');
      expect(clean).not.toContain('Trap visibility');
      expect(clean).not.toContain('Trap VISIBILITY');
      expect(clean).not.toContain('Trap middle');
    });

    it('C1.2: Strips various hidden and aria-hidden attributes without removing visible elements', () => {
      const html = `
        <div class="content">
          <p>Chính văn chương 1.</p>
          <span hidden>Hidden boolean trap</span>
          <span hidden="true">Hidden true trap</span>
          <span hidden="hidden">Hidden value trap</span>
          <div aria-hidden="true">Aria hidden trap</div>
          <div style="display: block;">Visible block text</div>
          <div style="display: inline-block;">Visible inline-block text</div>
          <div style="visibility: visible;">Visible visibility text</div>
          <p>Chính văn chương kết.</p>
        </div>
      `;
      const clean = sanitizeHtmlContent(html);
      expect(clean).toContain('Chính văn chương 1.');
      expect(clean).toContain('Visible block text');
      expect(clean).toContain('Visible inline-block text');
      expect(clean).toContain('Visible visibility text');
      expect(clean).toContain('Chính văn chương kết.');
      expect(clean).not.toContain('Hidden boolean trap');
      expect(clean).not.toContain('Hidden true trap');
      expect(clean).not.toContain('Hidden value trap');
      expect(clean).not.toContain('Aria hidden trap');
    });

    it('C1.3: Deeply nested honeypots and ancestor/descendant relationships', () => {
      const html = `
        <div class="story">
          <p>Đoạn văn 1.</p>
          <div style="display: none;">
            <div class="trap-outer">
              <span class="trap-inner">Lồng nhiều cấp trong display none</span>
              <p>Trap text 2</p>
            </div>
          </div>
          <div class="normal-container">
            <span style="visibility: hidden;">Nested hidden in normal</span>
            <p>Nội dung hợp lệ trong normal container.</p>
          </div>
        </div>
      `;
      const clean = sanitizeHtmlContent(html);
      expect(clean).toContain('Đoạn văn 1.');
      expect(clean).toContain('Nội dung hợp lệ trong normal container.');
      expect(clean).not.toContain('Lồng nhiều cấp');
      expect(clean).not.toContain('Trap text 2');
      expect(clean).not.toContain('Nested hidden in normal');
    });

    it('C1.4: Purges .w2w_read_more and collapsible buttons regardless of tag type', () => {
      const html = `
        <div class="entry-content">
          <p>Lời mở đầu câu chuyện phiêu lưu.</p>
          <div class="w2w_read_more">Đọc thêm chi tiết...</div>
          <a href="#" class="w2w_read_more">Xem thêm tại đây</a>
          <button class="readmore_open_button">Mở rộng nội dung</button>
          <span class="readmore_close_button">Thu gọn nội dung</span>
          <p>Hành trình tiếp tục qua ngọn núi băng.</p>
        </div>
      `;
      const clean = sanitizeHtmlContent(html);
      expect(clean).toContain('Lời mở đầu câu chuyện phiêu lưu.');
      expect(clean).toContain('Hành trình tiếp tục qua ngọn núi băng.');
      expect(clean).not.toContain('Đọc thêm chi tiết');
      expect(clean).not.toContain('Xem thêm tại đây');
      expect(clean).not.toContain('Mở rộng nội dung');
      expect(clean).not.toContain('Thu gọn nội dung');
    });
  });

  // =========================================================================
  // Challenge 2: Dialogue & Narrative Ad Filtering Stress Testing
  // =========================================================================
  describe('Challenge 2: Dialogue & Narrative Ad Filtering Resilience', () => {
    const keywords = [
      'nguồn',
      'nguồn:',
      'truyện',
      'truyenfull',
      'website',
      'link',
      'tải'
    ];

    it('C2.1: Protects all dialogue variations containing ad keywords', () => {
      const dialogueText = [
        '“Nguồn gốc của bảo kiếm này thực chất là gì?” - Thiếu niên hỏi.',
        '"Ngươi có biết truyện cổ tích này không?"',
        '「Website này là cái gì mà các ngươi nhắc tới hoài vậy?」',
        '‘Nguồn năng lượng này đang tăng nhanh!’',
        '- Nguồn nước ở đây có độc, mọi người cẩn thận!',
        '— Truyện này ta đã nghe qua từ lâu.',
        '– Link này đứt rồi, chúng ta phải đi đường khác.'
      ].join('\n\n');

      const filtered = removeAdLines(dialogueText, keywords);

      expect(filtered).toContain('“Nguồn gốc của bảo kiếm này thực chất là gì?” - Thiếu niên hỏi.');
      expect(filtered).toContain('"Ngươi có biết truyện cổ tích này không?"');
      expect(filtered).toContain('「Website này là cái gì mà các ngươi nhắc tới hoài vậy?」');
      expect(filtered).toContain('‘Nguồn năng lượng này đang tăng nhanh!’');
      expect(filtered).toContain('- Nguồn nước ở đây có độc, mọi người cẩn thận!');
      expect(filtered).toContain('— Truyện này ta đã nghe qua từ lâu.');
      expect(filtered).toContain('– Link này đứt rồi, chúng ta phải đi đường khác.');
    });

    it('C2.2: Strips ads disguised with quotes or dashes when strong ad indicators are present', () => {
      const disguisedAds = [
        '- Nguồn: truyenfull.vn',
        '“Đọc truyện tại TruyenFull ủng hộ dịch giả”',
        '"Website: truyenfull.com - cập nhật chương mới nhất"',
        '- Truy cập website https://novels.xyz để đọc thêm',
        '“Like fanpage để theo dõi truyện mới nhất”',
        '- Nguồn: Bạch Ngọc Sách',
        'Nguồn : Tàng Thư Viện'
      ].join('\n\n');

      const filtered = removeAdLines(disguisedAds, keywords);

      expect(filtered).not.toContain('truyenfull.vn');
      expect(filtered).not.toContain('ủng hộ dịch giả');
      expect(filtered).not.toContain('truyenfull.com');
      expect(filtered).not.toContain('novels.xyz');
      expect(filtered).not.toContain('Like fanpage');
      expect(filtered).not.toContain('Bạch Ngọc Sách');
      expect(filtered).not.toContain('Tàng Thư Viện');
    });

    it('C2.3: Preserves long legitimate narrative sentences containing generic keywords', () => {
      const narrativeText = [
        'Hắn tìm đến một nguồn suối trong veo nằm sâu giữa rừng già để rửa sạch vết máu.',
        'Quyển truyện cũ kỹ nằm trên bàn đã phủ một lớp bụi mỏng theo thời gian.',
        'Sự liên kết vô hình giữa linh hồn và thể xác bắt đầu xuất hiện những rạn nứt nghiêm trọng.'
      ].join('\n\n');

      const filtered = removeAdLines(narrativeText, ['nguồn', 'truyện', 'link']);

      expect(filtered).toContain('Hắn tìm đến một nguồn suối trong veo nằm sâu giữa rừng già để rửa sạch vết máu.');
      expect(filtered).toContain('Quyển truyện cũ kỹ nằm trên bàn đã phủ một lớp bụi mỏng theo thời gian.');
      expect(filtered).toContain('Sự liên kết vô hình giữa linh hồn và thể xác bắt đầu xuất hiện những rạn nứt nghiêm trọng.');
    });
  });

  // =========================================================================
  // Challenge 3: Visual Picker Cancel Button Event Propagation
  // =========================================================================
  describe('Challenge 3: Visual Picker Cancel Button Event Propagation', () => {
    it('C3.1: Clicking the Cancel button fires onCancel and NOT onSelect through document capture', () => {
      const targetDiv = document.createElement('div');
      targetDiv.id = 'novel-body';
      targetDiv.textContent = 'Nội dung tiểu thuyết';
      document.body.appendChild(targetDiv);

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      startVisualPicker('content', onSelect, onCancel);

      const banner = document.getElementById('novel-scraper-picker-banner');
      expect(banner).not.toBeNull();
      const cancelBtn = document.getElementById('novel-scraper-cancel-btn');
      expect(cancelBtn).not.toBeNull();

      // Dispatch click directly on cancel button
      cancelBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
      expect(document.getElementById('novel-scraper-picker-banner')).toBeNull();
      expect(document.getElementById('novel-scraper-picker-overlay')).toBeNull();
    });

    it('C3.2: Clicking an element selects it and cleanly dismantles overlay', () => {
      const storyEl = document.createElement('div');
      storyEl.id = 'real-story-chapter';
      storyEl.textContent = 'Chương 10: Trở về hoàng cung.';
      document.body.appendChild(storyEl);

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      startVisualPicker('content', onSelect, onCancel);

      // Simulate mousemove over storyEl to set hoveredElement
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 100,
        bubbles: true
      });
      // Mock elementFromPoint to return storyEl
      const origFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => storyEl;

      document.dispatchEvent(mouseMoveEvent);

      // Click on storyEl
      storyEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(onSelect).toHaveBeenCalledTimes(1);
      const callArg = onSelect.mock.calls[0][0];
      expect(callArg.targetType).toBe('content');
      expect(callArg.selector).toBe('#real-story-chapter');
      expect(callArg.previewText).toContain('Chương 10: Trở về hoàng cung.');
      expect(onCancel).not.toHaveBeenCalled();

      // Restore
      document.elementFromPoint = origFromPoint;
      expect(document.getElementById('novel-scraper-picker-banner')).toBeNull();
    });
  });

  // =========================================================================
  // Challenge 4: IndexedDB Persistence via saveSiteRule
  // =========================================================================
  describe('Challenge 4: IndexedDB SiteRule Persistence', () => {
    it('C4.1: saveSiteRule saves new rule and updates existing rule without duplicating domain', async () => {
      const testDomain = 'adversarial-test.com';

      // 1. First save (insert)
      const ruleData = {
        domain: testDomain,
        name: 'Adversarial Test Site',
        contentSelector: '.old-content',
        titleSelector: 'h1',
        nextSelector: 'a.next',
        tocSelector: '',
        isPreset: false
      };

      const savedId = await saveSiteRule(ruleData);
      expect(savedId).toBe(1);

      const retrieved1 = await getRuleForDomain(testDomain);
      expect(retrieved1).toBeDefined();
      expect(retrieved1?.contentSelector).toBe('.old-content');

      // 2. Simulated PICKER_RESULT update matching ScraperTab logic:
      retrieved1!.contentSelector = '.new-content-from-picker';
      retrieved1!.tocSelector = '.toc-list a';
      const updatedId = await saveSiteRule(retrieved1!);

      expect(updatedId).toBe(savedId);

      const retrieved2 = await getRuleForDomain(testDomain);
      expect(retrieved2?.contentSelector).toBe('.new-content-from-picker');
      expect(retrieved2?.tocSelector).toBe('.toc-list a');
      expect(mockRulesStore.size).toBe(1); // No duplicate domain rules!
    });
  });
});
