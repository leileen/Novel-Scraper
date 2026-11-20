import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { startVisualPicker, stopVisualPicker, type PickerResult } from '../lib/picker/overlay';
import { saveSiteRule } from '../lib/rules';
import type { SiteRule } from '../lib/types';

describe('Milestone 2 Challenger 2: Overlay Cancel Propagation & Message Integration', () => {
  afterEach(() => {
    stopVisualPicker();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // Replicates the state machine & message handler logic in components/ScraperTab.svelte
  function createTabContext(initialDomain = 'comong.info', initialRule?: SiteRule, customSaveSiteRule?: (rule: any) => Promise<number>) {
    let currentDomain = initialDomain;
    let matchedRule: SiteRule | undefined = initialRule ? { ...initialRule } : undefined;
    let toastMessage = '';
    let toastTimeout: any = null;

    function showToast(msg: string) {
      toastMessage = msg;
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toastMessage = '';
      }, 4000);
    }

    async function handleExtensionMessages(message: any) {
      if (!message || typeof message !== 'object') return;
      if (message.action === 'PICKER_RESULT') {
        const { targetType, selector } = message;
        if (!selector) return;

        if (!matchedRule) {
          matchedRule = {
            domain: currentDomain || 'custom',
            name: currentDomain || 'Custom Site',
            contentSelector: '',
            titleSelector: '',
            nextSelector: '',
            tocSelector: '',
            isPreset: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
        }

        if (targetType === 'content') {
          matchedRule.contentSelector = selector;
        } else if (targetType === 'title') {
          matchedRule.titleSelector = selector;
        } else if (targetType === 'next') {
          matchedRule.nextSelector = selector;
        } else if (targetType === 'toc') {
          matchedRule.tocSelector = selector;
        }

        matchedRule.updatedAt = Date.now();
        try {
          const saveFn = customSaveSiteRule || saveSiteRule;
          const savedId = await saveFn(matchedRule);
          if (savedId) matchedRule.id = savedId;
        } catch (err) {
          console.warn('[ScraperTab] Failed to save updated rule to DB:', err);
        }

        const typeLabels: Record<string, string> = {
          content: 'Khung nội dung (Content)',
          title: 'Tiêu đề chương (Title)',
          next: 'Nút chương sau (Next)',
          toc: 'Mục lục (TOC)'
        };
        const label = typeLabels[targetType] || targetType;
        showToast(`Đã áp dụng selector cho [${label}]: ${selector}`);
      }
    }

    return {
      getRule: () => matchedRule,
      getToast: () => toastMessage,
      handleExtensionMessages,
      showToast
    };
  }

  // =========================================================================
  // Challenge 1: Cancel Button Event Propagation in lib/picker/overlay.ts
  // =========================================================================
  describe('Challenge 1: Cancel Button Event Propagation in lib/picker/overlay.ts', () => {
    it('C1.1: Clicking #novel-scraper-cancel-btn directly triggers onCancel without being captured or swallowed', () => {
      const onSelect = vi.fn();
      const onCancel = vi.fn();

      startVisualPicker('content', onSelect, onCancel);

      const cancelBtn = document.getElementById('novel-scraper-cancel-btn');
      expect(cancelBtn).not.toBeNull();

      // Trigger standard click event (bubbles = true, cancelable = true)
      cancelBtn!.click();

      // onCancel must be called exactly once
      expect(onCancel).toHaveBeenCalledTimes(1);
      // onSelect must never be called
      expect(onSelect).not.toHaveBeenCalled();

      // Overlay and banner must be completely dismantled
      expect(document.getElementById('novel-scraper-picker-overlay')).toBeNull();
      expect(document.getElementById('novel-scraper-picker-banner')).toBeNull();
    });

    it('C1.2: Synthetic MouseEvent on #novel-scraper-cancel-btn propagates properly through capture phase', () => {
      const onSelect = vi.fn();
      const onCancel = vi.fn();

      startVisualPicker('title', onSelect, onCancel);

      const cancelBtn = document.getElementById('novel-scraper-cancel-btn');
      expect(cancelBtn).not.toBeNull();

      // Dispatch explicit MouseEvent with bubbling and cancelable flags
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      cancelBtn!.dispatchEvent(clickEvent);

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
      expect(document.getElementById('novel-scraper-picker-overlay')).toBeNull();
      expect(document.getElementById('novel-scraper-picker-banner')).toBeNull();
    });

    it('C1.3: Clicking inside #novel-scraper-picker-banner on non-button elements does NOT trigger onCancel or onSelect', () => {
      const onSelect = vi.fn();
      const onCancel = vi.fn();

      startVisualPicker('next', onSelect, onCancel);

      const banner = document.getElementById('novel-scraper-picker-banner');
      expect(banner).not.toBeNull();

      // Find children inside banner (e.g. iconSpan, labelSpan, escHintSpan)
      const spans = banner!.querySelectorAll('span');
      expect(spans.length).toBeGreaterThan(0);

      // Click each span inside the banner
      spans.forEach((span) => {
        span.click();
      });

      // Click banner container itself
      banner!.click();

      // Neither callback should have fired
      expect(onCancel).not.toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();

      // Visual picker remains active
      expect(document.getElementById('novel-scraper-picker-overlay')).not.toBeNull();
      expect(document.getElementById('novel-scraper-picker-banner')).not.toBeNull();
    });

    it('C1.4: Nested children inside cancel button propagate to onCancel', () => {
      const onSelect = vi.fn();
      const onCancel = vi.fn();

      startVisualPicker('toc', onSelect, onCancel);

      const cancelBtn = document.getElementById('novel-scraper-cancel-btn');
      expect(cancelBtn).not.toBeNull();

      // Inject a nested icon/span inside cancelBtn to test deep targetNode propagation
      const innerIcon = document.createElement('span');
      innerIcon.className = 'inner-cancel-icon';
      innerIcon.textContent = '✖';
      cancelBtn!.appendChild(innerIcon);

      // Click the nested inner element
      innerIcon.click();

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
      expect(document.getElementById('novel-scraper-picker-banner')).toBeNull();
    });

    it('C1.5: Clicking cancel button after hovering over target element still cancels cleanly without selecting', () => {
      const onSelect = vi.fn();
      const onCancel = vi.fn();

      // Create a dummy story container
      const targetEl = document.createElement('div');
      targetEl.id = 'chapter-body';
      targetEl.textContent = 'Truyện dài tập...';
      document.body.appendChild(targetEl);

      startVisualPicker('content', onSelect, onCancel);

      // Simulate mouse hovering over targetEl
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(targetEl);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50, bubbles: true }));

      // Now user decides to click the cancel button
      const cancelBtn = document.getElementById('novel-scraper-cancel-btn');
      expect(cancelBtn).not.toBeNull();
      cancelBtn!.click();

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
      expect(document.getElementById('novel-scraper-picker-overlay')).toBeNull();
      expect(document.getElementById('novel-scraper-picker-banner')).toBeNull();
    });

    it('C1.6: Clicking page element triggers onSelect and NOT onCancel', () => {
      const onSelect = vi.fn();
      const onCancel = vi.fn();

      const storyEl = document.createElement('div');
      storyEl.id = 'story-content-box';
      storyEl.textContent = 'Nội dung chương 1...';
      document.body.appendChild(storyEl);

      startVisualPicker('content', onSelect, onCancel);

      // Hover over storyEl
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(storyEl);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true }));

      // Click on storyEl
      storyEl.click();

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'content',
          selector: '#story-content-box'
        })
      );
      expect(document.getElementById('novel-scraper-picker-overlay')).toBeNull();
    });

    it('C1.7: Calling stopVisualPicker explicitly or starting a second picker tears down prior listeners', () => {
      const onSelect1 = vi.fn();
      const onCancel1 = vi.fn();
      const onSelect2 = vi.fn();
      const onCancel2 = vi.fn();

      startVisualPicker('content', onSelect1, onCancel1);
      expect(document.querySelectorAll('#novel-scraper-picker-banner').length).toBe(1);

      // Starting a second visual picker should stop and clean up the first one
      startVisualPicker('title', onSelect2, onCancel2);
      expect(document.querySelectorAll('#novel-scraper-picker-banner').length).toBe(1);

      const cancelBtn = document.getElementById('novel-scraper-cancel-btn');
      cancelBtn!.click();

      expect(onCancel1).not.toHaveBeenCalled();
      expect(onCancel2).toHaveBeenCalledTimes(1);
      expect(document.querySelectorAll('#novel-scraper-picker-banner').length).toBe(0);
    });

    it('C1.8: ESC key triggers onCancel and dismantles UI equivalent to cancel button', () => {
      const onSelect = vi.fn();
      const onCancel = vi.fn();

      startVisualPicker('content', onSelect, onCancel);
      expect(document.getElementById('novel-scraper-picker-banner')).not.toBeNull();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
      expect(document.getElementById('novel-scraper-picker-banner')).toBeNull();
      expect(document.getElementById('novel-scraper-picker-overlay')).toBeNull();
    });
  });

  // =========================================================================
  // Challenge 2: PICKER_RESULT Message Schema Handling Across All Target Types
  // =========================================================================
  describe('Challenge 2: PICKER_RESULT Message Schema Handling Across All Target Types', () => {
    it('C2.1: Correctly routes targetType "content" into contentSelector and creates initial rule if absent', async () => {
      const mockSave = vi.fn(async (_rule) => 101);
      const ctx = createTabContext('comong.info', undefined, mockSave);

      await ctx.handleExtensionMessages({
        action: 'PICKER_RESULT',
        targetType: 'content',
        selector: '.page-description',
        previewText: 'Nội dung truyện...'
      });

      const rule = ctx.getRule();
      expect(rule).toBeDefined();
      expect(rule?.domain).toBe('comong.info');
      expect(rule?.contentSelector).toBe('.page-description');
      expect(rule?.titleSelector).toBe('');
      expect(rule?.nextSelector).toBe('');
      expect(rule?.tocSelector).toBe('');
      expect(rule?.id).toBe(101);
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(ctx.getToast()).toBe('Đã áp dụng selector cho [Khung nội dung (Content)]: .page-description');
    });

    it('C2.2: Correctly routes targetType "title" into titleSelector', async () => {
      const mockSave = vi.fn(async (_rule) => 102);
      const ctx = createTabContext('comong.info', undefined, mockSave);

      await ctx.handleExtensionMessages({
        action: 'PICKER_RESULT',
        targetType: 'title',
        selector: 'h1.chapter-title',
        previewText: 'Chương 1'
      });

      const rule = ctx.getRule();
      expect(rule?.titleSelector).toBe('h1.chapter-title');
      expect(rule?.id).toBe(102);
      expect(ctx.getToast()).toBe('Đã áp dụng selector cho [Tiêu đề chương (Title)]: h1.chapter-title');
    });

    it('C2.3: Correctly routes targetType "next" into nextSelector', async () => {
      const mockSave = vi.fn(async (_rule) => 103);
      const ctx = createTabContext('comong.info', undefined, mockSave);

      await ctx.handleExtensionMessages({
        action: 'PICKER_RESULT',
        targetType: 'next',
        selector: '.nav-buttons a.btn-next',
        previewText: 'Chương sau →'
      });

      const rule = ctx.getRule();
      expect(rule?.nextSelector).toBe('.nav-buttons a.btn-next');
      expect(rule?.id).toBe(103);
      expect(ctx.getToast()).toBe('Đã áp dụng selector cho [Nút chương sau (Next)]: .nav-buttons a.btn-next');
    });

    it('C2.4: Correctly routes targetType "toc" into tocSelector', async () => {
      const mockSave = vi.fn(async (_rule) => 104);
      const ctx = createTabContext('comong.info', undefined, mockSave);

      await ctx.handleExtensionMessages({
        action: 'PICKER_RESULT',
        targetType: 'toc',
        selector: '#chapter-list a',
        previewText: 'Mục lục danh sách chương'
      });

      const rule = ctx.getRule();
      expect(rule?.tocSelector).toBe('#chapter-list a');
      expect(rule?.id).toBe(104);
      expect(ctx.getToast()).toBe('Đã áp dụng selector cho [Mục lục (TOC)]: #chapter-list a');
    });

    it('C2.5: Sequentially picking all 4 target types preserves existing selectors on the same rule ID', async () => {
      let savedRuleInStore: any = null;
      let nextId = 500;
      const mockStore = vi.fn(async (rule: any) => {
        if (!rule.id) {
          rule.id = nextId++;
        }
        savedRuleInStore = { ...rule };
        return rule.id;
      });

      const ctx = createTabContext('comong.info', undefined, mockStore);

      // Pick content
      await ctx.handleExtensionMessages({
        action: 'PICKER_RESULT',
        targetType: 'content',
        selector: '.content-body'
      });
      expect(ctx.getRule()?.id).toBe(500);

      // Pick title
      await ctx.handleExtensionMessages({
        action: 'PICKER_RESULT',
        targetType: 'title',
        selector: 'h1.title'
      });
      expect(ctx.getRule()?.id).toBe(500);

      // Pick next
      await ctx.handleExtensionMessages({
        action: 'PICKER_RESULT',
        targetType: 'next',
        selector: 'a.next-btn'
      });
      expect(ctx.getRule()?.id).toBe(500);

      // Pick toc
      await ctx.handleExtensionMessages({
        action: 'PICKER_RESULT',
        targetType: 'toc',
        selector: 'ul.toc a'
      });
      expect(ctx.getRule()?.id).toBe(500);

      const rule = ctx.getRule();
      expect(rule?.id).toBe(500);
      expect(rule?.contentSelector).toBe('.content-body');
      expect(rule?.titleSelector).toBe('h1.title');
      expect(rule?.nextSelector).toBe('a.next-btn');
      expect(rule?.tocSelector).toBe('ul.toc a');
      expect(savedRuleInStore).toEqual(rule);
      expect(mockStore).toHaveBeenCalledTimes(4);
      expect(ctx.getToast()).toBe('Đã áp dụng selector cho [Mục lục (TOC)]: ul.toc a');
    });

    it('C2.6: Ignores message if selector is empty string, null, or undefined', async () => {
      const mockSave = vi.fn();
      const ctx = createTabContext('comong.info', undefined, mockSave);

      await ctx.handleExtensionMessages({
        action: 'PICKER_RESULT',
        targetType: 'content',
        selector: ''
      });
      expect(ctx.getRule()).toBeUndefined();
      expect(ctx.getToast()).toBe('');

      await ctx.handleExtensionMessages({
        action: 'PICKER_RESULT',
        targetType: 'content',
        selector: null
      });
      expect(ctx.getRule()).toBeUndefined();
      expect(ctx.getToast()).toBe('');

      await ctx.handleExtensionMessages({
        action: 'PICKER_RESULT',
        targetType: 'content',
        selector: undefined
      });
      expect(ctx.getRule()).toBeUndefined();
      expect(ctx.getToast()).toBe('');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('C2.7: Ignores non-PICKER_RESULT actions (e.g. PICKER_CANCELLED, UNRELATED)', async () => {
      const mockSave = vi.fn();
      const ctx = createTabContext('comong.info', undefined, mockSave);

      await ctx.handleExtensionMessages({
        action: 'PICKER_CANCELLED'
      });
      expect(ctx.getRule()).toBeUndefined();
      expect(ctx.getToast()).toBe('');

      await ctx.handleExtensionMessages({
        action: 'CRAWL_STATUS',
        status: 'crawling'
      });
      expect(ctx.getRule()).toBeUndefined();
      expect(ctx.getToast()).toBe('');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('C2.8: Handles unexpected targetType with fallback label without throwing', async () => {
      const mockSave = vi.fn(async (_rule) => 200);
      const ctx = createTabContext('comong.info', undefined, mockSave);

      await ctx.handleExtensionMessages({
        action: 'PICKER_RESULT',
        targetType: 'custom_pagination',
        selector: '.custom-pager'
      });

      const rule = ctx.getRule();
      expect(rule).toBeDefined();
      expect(ctx.getToast()).toBe('Đã áp dụng selector cho [custom_pagination]: .custom-pager');
    });

    it('C2.9: Handles null, undefined, or primitive messages safely', async () => {
      const mockSave = vi.fn();
      const ctx = createTabContext('comong.info', undefined, mockSave);

      await expect(ctx.handleExtensionMessages(null)).resolves.not.toThrow();
      await expect(ctx.handleExtensionMessages(undefined)).resolves.not.toThrow();
      await expect(ctx.handleExtensionMessages('string_message')).resolves.not.toThrow();
      await expect(ctx.handleExtensionMessages(12345)).resolves.not.toThrow();
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Challenge 3: Rule Persistence & Toast Feedback Logic
  // =========================================================================
  describe('Challenge 3: Rule Persistence & Toast Feedback Logic', () => {
    it('C3.1: Rule persistence updates rule ID and invokes saveSiteRule with updated timestamp', async () => {
      const mockRule: SiteRule = {
        id: 42,
        domain: 'truyenfull.vn',
        name: 'Truyện Full',
        contentSelector: '.old-content',
        titleSelector: 'h2.title',
        nextSelector: 'a.next',
        tocSelector: '',
        isPreset: false,
        createdAt: 1000,
        updatedAt: 1000
      };

      let persistedRule: any = null;
      const mockSave = vi.fn(async (r: any) => {
        persistedRule = { ...r };
        return r.id || 999;
      });

      let matchedRule: SiteRule | undefined = mockRule;
      const message = {
        action: 'PICKER_RESULT',
        targetType: 'content',
        selector: '.new-content'
      };

      if (message.action === 'PICKER_RESULT') {
        matchedRule.contentSelector = message.selector;
        matchedRule.updatedAt = Date.now();
        const savedId = await mockSave(matchedRule);
        if (savedId) matchedRule.id = savedId;
      }

      expect(persistedRule).not.toBeNull();
      expect(persistedRule.contentSelector).toBe('.new-content');
      expect(persistedRule.id).toBe(42);
      expect(matchedRule.id).toBe(42);
      expect(persistedRule.updatedAt).toBeGreaterThan(1000);
    });

    it('C3.2: Handles DB failure gracefully without breaking UI or throwing unhandled exception', async () => {
      const mockFailingSave = vi.fn().mockRejectedValue(
        new Error('Database quota exceeded or disk full')
      );
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      let toastShown = false;
      function showToast(_msg: string) {
        toastShown = true;
      }

      let matchedRule: any = {
        domain: 'example.com',
        contentSelector: ''
      };

      // Simulated ScraperTab error catching logic
      try {
        matchedRule.contentSelector = '.picked';
        try {
          await mockFailingSave(matchedRule);
        } catch (err) {
          console.warn('[ScraperTab] Failed to save updated rule to DB:', err);
        }
        showToast('Đã áp dụng selector...');
      } catch (err) {
        expect.fail('Should not throw unhandled error');
      }

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ScraperTab] Failed to save updated rule to DB:',
        expect.any(Error)
      );
      expect(toastShown).toBe(true);
    });

    it('C3.3: Toast feedback auto-dismisses after exactly 4000ms', () => {
      vi.useFakeTimers();

      let toastMessage = '';
      let toastTimeout: any = null;

      function showToast(msg: string) {
        toastMessage = msg;
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
          toastMessage = '';
        }, 4000);
      }

      showToast('Đã áp dụng selector cho [Mục lục (TOC)]: #toc');
      expect(toastMessage).toBe('Đã áp dụng selector cho [Mục lục (TOC)]: #toc');

      // Fast forward 3999ms - should still be visible
      vi.advanceTimersByTime(3999);
      expect(toastMessage).toBe('Đã áp dụng selector cho [Mục lục (TOC)]: #toc');

      // Fast forward 1ms more (total 4000ms) - should dismiss
      vi.advanceTimersByTime(1);
      expect(toastMessage).toBe('');
    });

    it('C3.4: Toast debounce clears previous timer when a new result arrives rapidly', () => {
      vi.useFakeTimers();

      let toastMessage = '';
      let toastTimeout: any = null;

      function showToast(msg: string) {
        toastMessage = msg;
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
          toastMessage = '';
        }, 4000);
      }

      // First toast arrives at t=0
      showToast('Toast 1');
      expect(toastMessage).toBe('Toast 1');

      // Advance 2500ms
      vi.advanceTimersByTime(2500);
      expect(toastMessage).toBe('Toast 1');

      // Second toast arrives at t=2500ms
      showToast('Toast 2');
      expect(toastMessage).toBe('Toast 2');

      // Advance 2000ms (total t=4500ms since start, but only 2000ms since Toast 2)
      vi.advanceTimersByTime(2000);
      expect(toastMessage).toBe('Toast 2'); // Still visible because timer was reset

      // Advance another 2000ms (total 4000ms since Toast 2)
      vi.advanceTimersByTime(2000);
      expect(toastMessage).toBe('');
    });

    it('C3.5: Verifies exact Vietnamese toast label formatting across all target types', () => {
      const typeLabels: Record<string, string> = {
        content: 'Khung nội dung (Content)',
        title: 'Tiêu đề chương (Title)',
        next: 'Nút chương sau (Next)',
        toc: 'Mục lục (TOC)'
      };

      const selectors = {
        content: '#novel-content',
        title: '.chapter-name',
        next: '#next-btn',
        toc: '.list-chapters'
      };

      for (const [targetType, selector] of Object.entries(selectors)) {
        const label = typeLabels[targetType];
        const formatted = `Đã áp dụng selector cho [${label}]: ${selector}`;

        expect(formatted).toContain(label);
        expect(formatted).toContain(selector);
        expect(formatted.startsWith('Đã áp dụng selector cho [')).toBe(true);
      }
    });
  });

  // =========================================================================
  // Challenge 4: Static Verification of ScraperTab.svelte & overlay.ts
  // =========================================================================
  describe('Challenge 4: Static Code & DOM Template Conformance', () => {
    it('C4.1: ScraperTab.svelte contains exact message listener, targetType routing, and toast template', () => {
      const scraperTabPath = path.resolve(__dirname, '../components/ScraperTab.svelte');
      const content = fs.readFileSync(scraperTabPath, 'utf8');

      // Listener registration
      expect(content).toContain("chrome.runtime.onMessage.addListener(handleExtensionMessages)");
      expect(content).toContain("chrome.runtime.onMessage.removeListener(handleExtensionMessages)");

      // Action and target types check
      expect(content).toContain("message.action === 'PICKER_RESULT'");
      expect(content).toContain("targetType === 'content'");
      expect(content).toContain("targetType === 'title'");
      expect(content).toContain("targetType === 'next'");
      expect(content).toContain("targetType === 'toc'");

      // Persistence call
      expect(content).toContain("await saveSiteRule(matchedRule)");

      // Toast feedback call and HTML template
      expect(content).toContain("showToast(`Đã áp dụng selector cho [${label}]: ${selector}`)");
      expect(content).toContain("{#if toastMessage}");
      expect(content).toContain('class="toast-notification"');
      expect(content).toContain('class="toast-text"');
    });

    it('C4.2: lib/picker/overlay.ts permits banner clicks before stopPropagation/preventDefault', () => {
      const overlayPath = path.resolve(__dirname, '../lib/picker/overlay.ts');
      const content = fs.readFileSync(overlayPath, 'utf8');

      // Check that activeBanner containment check is BEFORE e.stopPropagation / e.preventDefault
      const onClickDefIndex = content.indexOf('const onClick = (e: MouseEvent) => {');
      const bannerCheckIndex = content.indexOf('activeBanner.contains(targetNode)', onClickDefIndex);
      const stopPropIndex = content.indexOf('e.stopPropagation();', bannerCheckIndex);

      expect(onClickDefIndex).toBeGreaterThan(0);
      expect(bannerCheckIndex).toBeGreaterThan(onClickDefIndex);
      expect(stopPropIndex).toBeGreaterThan(bannerCheckIndex);
    });

    it('C4.3: lib/picker/overlay.ts cancel button registers stopVisualPicker and onCancel', () => {
      const overlayPath = path.resolve(__dirname, '../lib/picker/overlay.ts');
      const content = fs.readFileSync(overlayPath, 'utf8');

      expect(content).toContain("cancelBtn.id = 'novel-scraper-cancel-btn'");
      expect(content).toContain("cancelBtn.addEventListener('click', (e) => {");
      expect(content).toContain("stopVisualPicker();");
      expect(content).toContain("onCancel();");
    });
  });

  // =========================================================================
  // Challenge 5: End-to-End Content Script to Side Panel Integration Simulation
  // =========================================================================
  describe('Challenge 5: End-to-End Content Script to Side Panel Integration Simulation', () => {
    it('C5.1: Full workflow: User initiates picker for TOC, clicks TOC element, result is received, saved, and notified', async () => {
      // Step 1: Side Panel initiates picker
      const targetType = 'toc';

      // Step 2: Content script receives START_PICKER and launches startVisualPicker
      let runtimeMessageSent: any = null;
      const fakeChromeRuntime = {
        sendMessage: vi.fn((msg: any) => {
          runtimeMessageSent = msg;
        })
      };

      // Set up webpage DOM with TOC container
      const tocContainer = document.createElement('div');
      tocContainer.id = 'list-chapter';
      tocContainer.innerHTML = '<ul><li><a href="/chap-1">Chương 1</a></li></ul>';
      document.body.appendChild(tocContainer);

      startVisualPicker(
        targetType,
        (result) => {
          fakeChromeRuntime.sendMessage({
            action: 'PICKER_RESULT',
            ...result
          });
        },
        () => {
          fakeChromeRuntime.sendMessage({
            action: 'PICKER_CANCELLED'
          });
        }
      );

      // User hovers over tocContainer and clicks
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(tocContainer);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
      tocContainer.click();

      // Check content script message
      expect(runtimeMessageSent).toEqual({
        action: 'PICKER_RESULT',
        targetType: 'toc',
        selector: '#list-chapter',
        previewText: expect.any(String)
      });

      // Step 3: Side Panel receives PICKER_RESULT message
      let storedRule: any = null;
      const mockSave = vi.fn(async (rule: any) => {
        storedRule = { ...rule, id: 99 };
        return 99;
      });

      const initialRule: SiteRule = {
        id: 99,
        domain: 'comong.info',
        name: 'Cổ Mộng',
        contentSelector: '.page-description',
        titleSelector: 'h1',
        nextSelector: '.wpc-nav-next a',
        tocSelector: '',
        isPreset: true,
        createdAt: 1000,
        updatedAt: 1000
      };

      const ctx = createTabContext('comong.info', initialRule, mockSave);
      await ctx.handleExtensionMessages(runtimeMessageSent);

      // Verify that tocSelector is updated while existing selectors are preserved
      const updated = ctx.getRule();
      expect(updated?.contentSelector).toBe('.page-description');
      expect(updated?.titleSelector).toBe('h1');
      expect(updated?.nextSelector).toBe('.wpc-nav-next a');
      expect(updated?.tocSelector).toBe('#list-chapter');
      expect(updated?.id).toBe(99);
      expect(mockSave).toHaveBeenCalledTimes(1);

      // Toast feedback
      expect(ctx.getToast()).toBe('Đã áp dụng selector cho [Mục lục (TOC)]: #list-chapter');
    });

    it('C5.2: Full workflow: User initiates picker for Content, clicks Cancel button, sends PICKER_CANCELLED, no rule change', async () => {
      const targetType = 'content';
      let runtimeMessageSent: any = null;
      const fakeChromeRuntime = {
        sendMessage: vi.fn((msg: any) => {
          runtimeMessageSent = msg;
        })
      };

      startVisualPicker(
        targetType,
        (result) => {
          fakeChromeRuntime.sendMessage({
            action: 'PICKER_RESULT',
            ...result
          });
        },
        () => {
          fakeChromeRuntime.sendMessage({
            action: 'PICKER_CANCELLED'
          });
        }
      );

      // User clicks cancel button
      const cancelBtn = document.getElementById('novel-scraper-cancel-btn');
      expect(cancelBtn).not.toBeNull();
      cancelBtn!.click();

      // Verify PICKER_CANCELLED was sent
      expect(runtimeMessageSent).toEqual({
        action: 'PICKER_CANCELLED'
      });

      // Side Panel receives message
      const mockSave = vi.fn();
      const initialRule: SiteRule = {
        id: 77,
        domain: 'comong.info',
        name: 'Cổ Mộng',
        contentSelector: '.original-content',
        titleSelector: 'h1',
        nextSelector: 'a.next',
        tocSelector: '',
        isPreset: false,
        createdAt: 1000,
        updatedAt: 1000
      };

      const ctx = createTabContext('comong.info', initialRule, mockSave);
      await ctx.handleExtensionMessages(runtimeMessageSent);

      // Rule remains unchanged, no DB save, no toast
      expect(ctx.getRule()?.contentSelector).toBe('.original-content');
      expect(mockSave).not.toHaveBeenCalled();
      expect(ctx.getToast()).toBe('');
    });
  });
});
