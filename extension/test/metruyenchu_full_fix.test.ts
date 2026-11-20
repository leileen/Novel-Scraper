import { describe, it, expect, vi } from 'vitest';
import { sanitizeHtmlContent } from '../lib/sanitizer';
import { getSettings, saveSettings } from '../lib/storage/settings';
import { crawler } from '../lib/crawler';

describe('Mê Truyện Chữ Deep Reliability & Bug Fix Verification', () => {
  it('CSP Safety: sanitizeHtmlContent strips all on* inline event handlers to prevent CSP violations', () => {
    const dirtyHtml = `
      <div onclick="alert('hacked')" onmouseover="console.log('hover')">
        <p>Phần mở đầu câu chuyện.</p>
        <button onclick="page(1, 2)">Trang tiếp</button>
        <img src="avatar.jpg" onerror="alert('error')" />
        <a href="/chuong-2" onclick="return false;">Chương sau</a>
      </div>
    `;

    const parser = new DOMParser();
    const doc = parser.parseFromString(dirtyHtml, 'text/html');
    const container = doc.body.firstElementChild as Element;

    // Must not throw or create inline event handlers
    const cleanText = sanitizeHtmlContent(container, []);
    expect(cleanText).toContain('Phần mở đầu câu chuyện.');
    expect(cleanText).not.toContain('alert');
    expect(cleanText).not.toContain('page(');
    expect(cleanText).not.toContain('onclick');
    expect(cleanText).not.toContain('onerror');
  });

  it('Storage Integrity: getSettings normalizes corrupted/object/string adKeywords into clean string[]', async () => {
    // Simulate chrome.storage.local having an object or string instead of array
    const fakeStorage: Record<string, any> = {
      novel_scraper_settings: {
        theme: 'dark',
        adKeywords: { '0': 'Quảng cáo 1', '1': 'Quảng cáo 2' }
      }
    };

    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn(async () => fakeStorage),
          set: vi.fn(async () => {})
        }
      }
    };

    const settings = await getSettings();
    expect(Array.isArray(settings.adKeywords)).toBe(true);
    expect(settings.adKeywords).toEqual(['Quảng cáo 1', 'Quảng cáo 2']);
    // Calling .join('\n') must succeed without throwing TypeError
    expect(settings.adKeywords.join('\n')).toBe('Quảng cáo 1\nQuảng cáo 2');
  });

  it('CrawlManager fetchHtml: delegates to active tab content script when direct fetch encounters CORS or network error', async () => {
    // Mock direct fetch throwing TypeError: Failed to fetch (typical Chrome MV3 extension CORS block)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    // Mock chrome.tabs sending message to content script
    (globalThis as any).chrome = {
      tabs: {
        query: vi.fn(async () => [{ id: 123, active: true, url: 'https://metruyenchu.com.vn/cao-vo' }]),
        sendMessage: vi.fn(async (_tabId: number, msg: any) => {
          if (msg.action === 'FETCH_URL') {
            return {
              success: true,
              text: '<html><body><div id="chapter-list"><ul><li><a href="/cao-vo/chuong-1">Chương 1</a></li></ul></div></body></html>',
              status: 200
            };
          }
          return { success: false };
        })
      }
    };

    try {
      const res = await crawler.fetchHtml('https://metruyenchu.com.vn/cao-vo');
      expect(res.ok).toBe(true);
      expect(res.text).toContain('Chương 1');
      expect(res.status).toBe(200);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(123, {
        action: 'FETCH_URL',
        url: 'https://metruyenchu.com.vn/cao-vo'
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('CrawlManager scanFullToc: fast-resolves parent story URL from chapter reading URL when no dropdown TOC is present', async () => {
    const storyHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="chapter-list">
            <ul>
              <li><a href="/cao-vo/chuong-1">Chương 1: Khởi đầu</a></li>
              <li><a href="/cao-vo/chuong-2">Chương 2: Tiến bước</a></li>
            </ul>
          </div>
        </body>
      </html>
    `;

    // Direct fetch resolves story page HTML
    globalThis.fetch = vi.fn(async (url: any) => {
      return {
        ok: true,
        status: 200,
        text: async () => storyHtml
      } as any;
    });

    (globalThis as any).chrome = {
      tabs: {
        query: vi.fn(async () => [{ id: 1, active: true, url: 'https://metruyenchu.com.vn/cao-vo/chuong-1-hash' }]),
        sendMessage: vi.fn(async () => ({ success: false }))
      }
    };

    const chapters = await crawler.scanFullToc(
      'https://metruyenchu.com.vn/cao-vo/chuong-1-hash',
      {
        id: 1,
        domain: 'metruyenchu.com.vn',
        name: 'MTC',
        contentSelector: '.truyen',
        titleSelector: 'h2',
        nextSelector: 'a.next',
        tocSelector: '#chapter-list a',
        isPreset: true,
        createdAt: 0,
        updatedAt: 0
      }
    );

    expect(chapters.length).toBe(2);
    expect(chapters[0].title).toBe('Chương 1: Khởi đầu');
    expect(chapters[1].title).toBe('Chương 2: Tiến bước');
  });
});
