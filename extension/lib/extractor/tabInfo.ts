import {
  findNovelTitle,
  findNovelUrl,
  findChapterTitle,
  findNovelCover,
  findNovelAuthor,
  parseNovelTitleFromTabString,
  cleanNovelTitleText
} from './heuristic';
import { parseSafeHtmlDocument } from '../sanitizer';

export interface TabNovelInfo {
  title: string;
  canonicalUrl: string;
  chapterTitle: string;
  domain: string;
  isReadingPage: boolean;
  coverUrl?: string;
  author?: string;
}

const GENERIC_SLUGS = new Set([
  'chapter', 'chuong', 'chap', 'c', 'doc-truyen', 'truyen', 'novel', 'book', 'read', 'post', 'archives', 'detail', 'story'
]);

/**
 * Checks whether a tab URL is a standard web page that extensions are allowed to inspect/script.
 * Excludes chrome://, edge://, about:, chrome-extension://, moz-extension://, view-source:, and browser web stores.
 */
export function isInspectableWebUrl(url?: string): url is string {
  if (!url || typeof url !== 'string') return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (
    /^https?:\/\/(?:chromewebstore\.google\.com|chrome\.google\.com\/webstore|microsoftedge\.microsoft\.com\/addons|addons\.mozilla\.org)/i.test(
      url
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Robustly resolves the real novel title, canonical story URL, chapter title, coverUrl, and author from a browser tab.
 */
export async function resolveActiveTabNovel(tab?: chrome.tabs.Tab | null): Promise<TabNovelInfo> {
  const result: TabNovelInfo = {
    title: '',
    canonicalUrl: '',
    chapterTitle: '',
    domain: '',
    isReadingPage: false
  };

  if (!tab || !isInspectableWebUrl(tab.url)) {
    return result;
  }

  try {
    const urlObj = new URL(tab.url);
    result.domain = urlObj.hostname;
    result.isReadingPage = /(?:chuong|chapter|c)[-_]\d+/i.test(urlObj.pathname);
  } catch {
    return result;
  }

  // Tier 1: Try content script message
  if (tab.id) {
    try {
      const pageInfo = await chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_INFO' });
      if (pageInfo?.success) {
        if (pageInfo.novelTitle && !/^(?:chương|chapter)\s*\d+/i.test(pageInfo.novelTitle)) {
          result.title = cleanNovelTitleText(pageInfo.novelTitle);
        }
        if (pageInfo.novelUrl && !isGenericUrl(pageInfo.novelUrl)) {
          result.canonicalUrl = pageInfo.novelUrl;
        }
        if (pageInfo.chapterTitle) {
          result.chapterTitle = pageInfo.chapterTitle;
        }
        if (pageInfo.coverUrl) {
          result.coverUrl = pageInfo.coverUrl;
        }
        if (pageInfo.author) {
          result.author = pageInfo.author;
        }
        if (result.title && (result.canonicalUrl || !result.isReadingPage)) {
          if (!result.coverUrl && result.isReadingPage && result.canonicalUrl) {
            await enrichFromCanonicalStoryPage(result);
          }
          return result;
        }
      }
    } catch {
      // Content script disconnected or not yet injected, proceed to Tier 2
    }
  }

  // Tier 2: Try direct chrome.scripting.executeScript
  const chromeScripting = (chrome as any)?.scripting;
  if (tab.id && typeof chrome !== 'undefined' && chromeScripting?.executeScript) {
    try {
      const scriptResults = await chromeScripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const doc = document;
          const storySelectors = [
            'h1.story-title a', 'h1.story-title', '.story-title a', '.story-title',
            'h1.current-book a', 'h1.current-book', 'a.current-book', '.current-book',
            'h1[itemprop="name"]', '.mRightCol h1',
            'h1.truyen-title a', 'h1.truyen-title', 'a.truyen-title', '.truyen-title',
            'h1.novel-title', '.novel-title a', '.novel-title',
            'h1.book-title a', 'h1.book-title', '.book-title a', '.book-title',
            '.chapter-info .story-name a', '.chapter-info .story-name'
          ];

          let nTitle = '';
          let nUrl = '';

          for (const sel of storySelectors) {
            const el = doc.querySelector(sel);
            if (el) {
              const text = (el.textContent || '').trim();
              if (text && text.length < 200 && !/^(?:chương|chapter|hồi|tiết)\s*\d+/i.test(text)) {
                nTitle = text;
                if (el.tagName === 'A' && (el as HTMLAnchorElement).href) {
                  nUrl = (el as HTMLAnchorElement).href;
                } else {
                  const childA = el.querySelector('a');
                  if (childA && childA.href) nUrl = childA.href;
                }
                break;
              }
            }
          }

          if (!nUrl) {
            const breadcrumbLinks = Array.from(doc.querySelectorAll('.breadcrumb a, .breadcrumbs a, ol.breadcrumb li a, nav.breadcrumb a'));
            for (let i = breadcrumbLinks.length - 1; i >= 0; i--) {
              const a = breadcrumbLinks[i] as HTMLAnchorElement;
              const txt = (a.textContent || '').trim();
              const href = a.href || '';
              if (
                href &&
                href !== '/' &&
                !href.includes('javascript:') &&
                !/^(?:trang chủ|home|mục lục|danh sách|chương|chapter)/i.test(txt) &&
                !/(?:chuong|chapter|c)[-_]\d+/i.test(href)
              ) {
                if (!nTitle) nTitle = txt;
                nUrl = href;
                break;
              }
            }
          }

          const chapEl = doc.querySelector('h1:not(.story-title):not(.site-title):not(.logo), h2.chapter-title, .chapter-title, .entry-title');
          const cTitle = chapEl?.textContent?.trim() || '';

          const coverImg = doc.querySelector('.book-info-pic img, .book-thum img, .book-img img, .books .book img, .info-holder .book img, .book-cover img, img[itemprop="image"]') as HTMLImageElement | null;
          const ogImg = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
          const rawCover = coverImg?.src || ogImg || '';

          const authorEl = doc.querySelector('a[itemprop="author"], [itemprop="author"], .book-info-text a[href*="/tac-gia/"], .author a');
          const nAuthor = (authorEl?.textContent || '').trim();

          return { nTitle, nUrl, cTitle, rawCover, nAuthor };
        }
      });

      if (scriptResults && scriptResults[0]?.result) {
        const { nTitle, nUrl, cTitle, rawCover, nAuthor } = scriptResults[0].result;
        if (nTitle && !/^(?:chương|chapter)\s*\d+/i.test(nTitle)) {
          result.title = cleanNovelTitleText(nTitle);
        }
        if (nUrl && !isGenericUrl(nUrl)) {
          result.canonicalUrl = nUrl;
        }
        if (cTitle) {
          result.chapterTitle = cTitle;
        }
        if (rawCover && /^https?:\/\//i.test(rawCover)) {
          result.coverUrl = rawCover;
        }
        if (nAuthor) {
          result.author = nAuthor;
        }
        if (result.title) {
          if (!result.coverUrl && result.isReadingPage && result.canonicalUrl) {
            await enrichFromCanonicalStoryPage(result);
          }
          return result;
        }
      }
    } catch {
      // Scripting blocked or tab closed, proceed silently to Tier 3
    }
  }

  // Tier 3: Try direct HTML fetch from Side Panel
  if (tab.url && isInspectableWebUrl(tab.url)) {
    try {
      const resp = await window.fetch(tab.url, {
        headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
      });
      if (resp.ok) {
        const html = await resp.text();
        const doc = parseSafeHtmlDocument(html);

        const fetchedTitle = findNovelTitle(doc, tab.title);
        const fetchedUrl = findNovelUrl(doc, tab.url);
        const fetchedChapter = findChapterTitle(doc);
        const fetchedCover = findNovelCover(doc, tab.url);
        const fetchedAuthor = findNovelAuthor(doc);

        if (fetchedTitle && !/^(?:chương|chapter)\s*\d+/i.test(fetchedTitle) && fetchedTitle !== 'Chưa đặt tên') {
          result.title = cleanNovelTitleText(fetchedTitle);
        }
        if (fetchedUrl && !isGenericUrl(fetchedUrl)) {
          result.canonicalUrl = fetchedUrl;
        }
        if (fetchedChapter) {
          result.chapterTitle = fetchedChapter;
        }
        if (fetchedCover) {
          result.coverUrl = fetchedCover;
        }
        if (fetchedAuthor) {
          result.author = fetchedAuthor;
        }
        if (result.title) {
          if (!result.coverUrl && result.isReadingPage && result.canonicalUrl) {
            await enrichFromCanonicalStoryPage(result);
          }
          return result;
        }
      }
    } catch {
      // Direct fetch failed, proceed silently to Tier 4
    }
  }

  // Tier 4: Tab Title String Fallback
  const fromTab = parseNovelTitleFromTabString(tab.title || '');
  if (fromTab && !/^(?:chương|chapter)\s*\d+/i.test(fromTab)) {
    result.title = fromTab;
  } else {
    try {
      const u = new URL(tab.url);
      const segments = u.pathname.split('/').filter(Boolean);
      if (segments.length >= 2 && /(?:chuong|chapter|c)[-_]\d+/i.test(segments[segments.length - 1])) {
        const seg = segments[segments.length - 2];
        if (!GENERIC_SLUGS.has(seg.toLowerCase())) {
          result.title = seg.split(/[-_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          result.canonicalUrl = u.origin + '/' + segments.slice(0, -1).join('/');
        }
      } else if (segments.length >= 1) {
        const seg = segments[0];
        if (!GENERIC_SLUGS.has(seg.toLowerCase()) && seg.length > 3) {
          result.title = seg.split(/[-_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
      }
    } catch {}
  }

  if (!result.title) {
    result.title = (tab.title || 'Chưa đặt tên').replace(/ - (?:Cổ Mộng|TruyệnFull|Tàng Thư Viện|Mê Truyện Chữ).*$/i, '').trim();
  }

  return result;
}

async function enrichFromCanonicalStoryPage(result: TabNovelInfo): Promise<void> {
  if (!result.canonicalUrl || !isInspectableWebUrl(result.canonicalUrl)) return;
  try {
    const resp = await window.fetch(result.canonicalUrl, {
      headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
    });
    if (!resp.ok) return;
    const html = await resp.text();
    const doc = parseSafeHtmlDocument(html);
    const cover = findNovelCover(doc, result.canonicalUrl);
    const author = findNovelAuthor(doc);
    if (cover) result.coverUrl = cover;
    if (author && !result.author) result.author = author;
  } catch {}
}

function isGenericUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return true;
    if (parts.length === 1 && GENERIC_SLUGS.has(parts[0].toLowerCase())) return true;
    return false;
  } catch {
    return true;
  }
}
