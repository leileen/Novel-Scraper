import { describe, it, expect, vi } from 'vitest';
import { normalizeCustomReplacements, normalizeAdKeywords } from '../lib/storage/settings';
import { applyCustomReplacements } from '../lib/sanitizer';
import { isInspectableWebUrl, resolveActiveTabNovel } from '../lib/extractor/tabInfo';

describe('Settings Normalization & Browser Restricted URL Guards', () => {
  it('normalizes customReplacements safely when stored as an object or corrupted value', () => {
    // Object-serialized array from chrome.storage.local (e.g. {"0": {from: "a", to: "b"}})
    const objSerialized = {
      '0': { from: 'truyencv', to: '' },
      '1': { from: 'Tiêu Viêm', to: 'Viêm Đế' }
    };
    const res1 = normalizeCustomReplacements(objSerialized);
    expect(Array.isArray(res1)).toBe(true);
    expect(res1).toEqual([
      { from: 'truyencv', to: '' },
      { from: 'Tiêu Viêm', to: 'Viêm Đế' }
    ]);

    // Empty object {}
    const res2 = normalizeCustomReplacements({});
    expect(Array.isArray(res2)).toBe(true);
    expect(res2).toEqual([]);

    // Null / undefined / primitive
    expect(normalizeCustomReplacements(null)).toEqual([]);
    expect(normalizeCustomReplacements(undefined)).toEqual([]);
    expect(normalizeCustomReplacements('invalid')).toEqual([]);
  });

  it('normalizes adKeywords safely from array, string, or object', () => {
    expect(normalizeAdKeywords({ '0': 'Nguồn:', '1': 'Website:' })).toEqual(['Nguồn:', 'Website:']);
    expect(normalizeAdKeywords('Nguồn:\nWebsite:')).toEqual(['Nguồn:', 'Website:']);
  });

  it('applyCustomReplacements works with both array and object-serialized array', () => {
    const text = 'Tiêu Viêm đọc tại truyencv hôm nay';
    const objSerialized = {
      '0': { from: 'truyencv', to: 'Cổ Mộng' },
      '1': { from: 'Tiêu Viêm', to: 'Viêm Đế' }
    };
    expect(applyCustomReplacements(text, objSerialized)).toBe('Viêm Đế đọc tại Cổ Mộng hôm nay');
  });

  it('isInspectableWebUrl blocks chrome://, edge://, about:, extension:// and webstore URLs', () => {
    expect(isInspectableWebUrl('chrome://extensions')).toBe(false);
    expect(isInspectableWebUrl('edge://extensions/?id=aenhchldbcnfoinfopijpafhcpfhnagp')).toBe(false);
    expect(isInspectableWebUrl('about:blank')).toBe(false);
    expect(isInspectableWebUrl('chrome-extension://abcdef/sidepanel.html')).toBe(false);
    expect(isInspectableWebUrl('https://chromewebstore.google.com/detail/xyz')).toBe(false);
    expect(isInspectableWebUrl('https://microsoftedge.microsoft.com/addons/detail/xyz')).toBe(false);
    expect(isInspectableWebUrl('https://comong.info/truyen/sinh-nhat-toi')).toBe(true);
  });

  it('resolveActiveTabNovel immediately returns empty result without calling executeScript on edge:// or chrome:// URLs', async () => {
    const spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const edgeTab = {
      id: 99,
      url: 'edge://extensions/?errors=aenhchldbcnfoinfopijpafhcpfhnagp',
      title: 'Extensions'
    } as any;

    const res = await resolveActiveTabNovel(edgeTab);
    expect(res.title).toBe('');
    expect(res.canonicalUrl).toBe('');
    expect(spyWarn).not.toHaveBeenCalled();
    spyWarn.mockRestore();
  });
});
