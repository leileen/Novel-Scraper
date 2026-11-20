import type { ExtractedChapter } from '../types';
import { sanitizeHtmlContent, deobfuscateWordSlashes } from '../sanitizer';

// RegEx to identify chapter patterns in titles or text
export const CHAPTER_TITLE_REGEX = /(?:Chương|Hồi|Tiết|Quyển|Chapter|Chap|Episode)\s+\d+[\s\:\-\–\—\.]*.*$/i;

// RegEx to identify "Next Chapter" link labels (including trailing Unicode arrows: →, \u2192, », >, › and whitespace)
export const NEXT_LINK_REGEX = /^(?:chương\s+(?:sau|tiếp)|tiếp(?:\s+theo)?|sau|next(?:\s+chapter)?)[\s»>→›\u2192\u203A]*$/i;

// Lock/VIP indicators in text
const VIP_KEYWORDS = [
  'chương vip',
  'mua chương',
  'khóa chương',
  'nạp linh thạch',
  'mở khóa chương',
  'cần đăng nhập để đọc',
  'chương này đang khóa',
  'tải app để đọc'
];

/**
 * Calculates a readability score for a DOM element to decide if it's the chapter content.
 */
function scoreElement(el: Element): number {
  const tagName = el.tagName.toLowerCase();
  if (['nav', 'footer', 'header', 'aside', 'form', 'noscript'].includes(tagName)) {
    return -1000;
  }

  const className = el.className && typeof el.className === 'string' ? el.className.toLowerCase() : '';
  const idName = el.id ? el.id.toLowerCase() : '';

  // Strong negative signals
  if (
    className.includes('comment') ||
    className.includes('footer') ||
    className.includes('header') ||
    className.includes('sidebar') ||
    className.includes('widget') ||
    className.includes('menu') ||
    idName.includes('comment') ||
    idName.includes('footer') ||
    idName.includes('sidebar')
  ) {
    return -500;
  }

  const text = el.textContent || '';
  const textLength = text.trim().length;
  if (textLength < 100) return 0;

  // Calculate link density
  const links = el.querySelectorAll('a');
  let linkTextLength = 0;
  links.forEach((a) => {
    linkTextLength += (a.textContent || '').length;
  });
  const linkDensity = linkTextLength / (textLength || 1);
  if (linkDensity > 0.3) {
    // If more than 30% of text is links, it's a menu or list
    return 0;
  }

  let score = textLength * 0.5;

  // Paragraph count
  const pCount = el.querySelectorAll('p').length;
  score += pCount * 40;

  // Keyword bonuses
  if (className.includes('chapter') || idName.includes('chapter')) score += 300;
  if (className.includes('content') || idName.includes('content')) score += 200;
  if (className.includes('reading') || idName.includes('reading')) score += 200;
  if (className.includes('entry-content')) score += 250;
  if (tagName === 'article') score += 150;

  score = score * (1 - linkDensity * 1.5);
  return score;
}

/**
 * Finds the best candidate container element for novel text in a document.
 */
export function findContentContainer(doc: Document): Element | null {
  // First, check common well-known selectors
  const commonSelectors = [
    '#chapter-c',
    '.chapter-c',
    '.page-description',
    '.story-content',
    '.reading-content',
    '.entry-content',
    '#content',
    '.chapter-content',
    '.text-content',
    '#chapter-content',
    'article'
  ];

  for (const sel of commonSelectors) {
    const el = doc.querySelector(sel);
    if (el && (el.textContent || '').length > 200) {
      return el;
    }
  }

  // Fallback to heuristic scoring
  const candidates = doc.querySelectorAll('div, section, article, main');
  let bestElement: Element | null = null;
  let highestScore = 0;

  candidates.forEach((el) => {
    const score = scoreElement(el);
    if (score > highestScore) {
      highestScore = score;
      bestElement = el;
    }
  });

  return bestElement;
}

/**
 * Heuristically finds the chapter title from the document.
 */
export function findChapterTitle(doc: Document, fallbackTitle = ''): string {
  // Check common title selectors
  const titleSelectors = [
    'h2.current-chapter',
    'h1.current-chapter',
    '.current-chapter',
    'h1.chapter-title',
    'h2.chapter-title',
    '.chapter-title',
    'h1.entry-title',
    '.entry-title',
    'h1:not(.story-title):not(.site-title):not(.logo):not(.site-logo):not(.novel-title):not(.current-book)',
    'h1.truyen-title',
    'h1'
  ];

  for (const sel of titleSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const text = (el.textContent || '').trim();
      if (text.length > 0 && (CHAPTER_TITLE_REGEX.test(text) || text.length < 150)) {
        return text;
      }
    }
  }

  // Check document title
  const pageTitle = doc.title || '';
  if (pageTitle) {
    // Try to extract chapter info: e.g. "Chương 85: Gặp gỡ ngoài đời - Yêu Em Từ Cái Nhìn Đầu Tiên"
    const match = pageTitle.match(CHAPTER_TITLE_REGEX);
    if (match) {
      // Split by separator like - or |
      const parts = match[0].split(/[\-\|\_]/);
      return parts[0].trim();
    }
  }

  return fallbackTitle || 'Không có tiêu đề';
}

/**
 * Cleans novel title text by removing website brand suffixes, common prefixes, and extra whitespace.
 */
export function cleanNovelTitleText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/ - (TruyệnFull|Cổ Mộng|Tàng Thư Viện|Mê Truyện Chữ|Thích Truyện Chữ|Web|Full|Online|Manga|Novel).*$/i, '')
    .replace(/\|.*$/, '')
    .replace(/^Đọc truyện\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses the overall novel/story title from browser tab title string.
 */
export function parseNovelTitleFromTabString(raw: string): string {
  if (!raw) return '';
  // Split by common separators: - or | or •
  const parts = raw.split(/[\-\|\•]/).map((p) => p.trim()).filter(Boolean);
  const KNOWN_SITES = /^(?:truyệnfull|cổ mộng|tàng thư viện|mê truyện chữ|thích truyện chữ|web novel|đọc truyện|full|online)$/i;

  const validCandidates = parts.filter((part) => {
    if (KNOWN_SITES.test(part)) return false;
    if (/^(?:chương|chapter|hồi|tiết)\s*\d+/i.test(part)) return false;
    return part.length > 0;
  });

  if (validCandidates.length > 0) {
    return cleanNovelTitleText(validCandidates[0]);
  }
  return '';
}

/**
 * Finds the overall novel/story title from DOM containers, breadcrumbs, meta tags, or document title.
 */
export function findNovelTitle(doc: Document, fallbackTitle?: string): string {
  // 1. Check dedicated novel title elements in DOM
  const novelTitleSelectors = [
    'h1.current-book a',
    'h1.current-book',
    'a.current-book',
    '.current-book',
    'h1[itemprop="name"]',
    '.mRightCol h1',
    'h1.story-title a',
    'h1.story-title',
    '.story-title a',
    '.story-title',
    'h1.truyen-title a',
    'h1.truyen-title',
    'a.truyen-title',
    '.truyen-title',
    'h1.novel-title',
    '.novel-title a',
    '.novel-title',
    'h1.book-title',
    '.book-title a',
    '.book-title',
    '.story-info h1',
    '.truyen-info h1',
    '.book-info h1',
    '.info-holder h1',
    '.chapter-info .story-name',
    '.story-name'
  ];

  for (const sel of novelTitleSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const text = (el.textContent || '').trim();
      if (text.length > 0 && text.length < 150 && !/^(?:chương|chapter|hồi|tiết)\s+\d+/i.test(text)) {
        return cleanNovelTitleText(text);
      }
    }
  }

  // 2. Check meta tags
  const metaSelectors = [
    'meta[property="og:novel:novel_name"]',
    'meta[property="og:book:title"]',
    'meta[name="novel:title"]',
    'meta[name="book:title"]'
  ];
  for (const sel of metaSelectors) {
    const meta = doc.querySelector(sel);
    const content = meta?.getAttribute('content')?.trim();
    if (content && content.length < 150 && !/^(?:chương|chapter|hồi|tiết)\s+\d+/i.test(content)) {
      return cleanNovelTitleText(content);
    }
  }

  // 3. Check breadcrumbs
  const breadcrumbLinks = doc.querySelectorAll('.breadcrumb a, .breadcrumbs a, ol.breadcrumb li a, nav.breadcrumb a');
  if (breadcrumbLinks.length >= 2) {
    for (let i = breadcrumbLinks.length - 1; i >= 0; i--) {
      const linkText = (breadcrumbLinks[i].textContent || '').trim();
      if (
        linkText &&
        !/^(?:trang chủ|home|mục lục|danh sách|thể loại|chương|chapter)/i.test(linkText) &&
        linkText.length < 150
      ) {
        return cleanNovelTitleText(linkText);
      }
    }
  }

  // 4. Parse from document.title or fallbackTitle
  const rawTitle = fallbackTitle || doc.title || '';
  if (rawTitle) {
    const fromTab = parseNovelTitleFromTabString(rawTitle);
    if (fromTab && !/^(?:chương|chapter)\s*\d+/i.test(fromTab)) return fromTab;
  }

  // 5. Parse novel slug from URL
  const possibleUrl = doc.location?.href || doc.baseURI || (fallbackTitle?.includes('://') ? fallbackTitle : '');
  if (possibleUrl && possibleUrl !== 'about:blank') {
    try {
      const urlObj = new URL(possibleUrl);
      const segments = urlObj.pathname.split('/').filter(Boolean);
      for (const seg of segments) {
        if (
          !/^(?:chuong|chapter|story|truyen|read|doc)[-_]/i.test(seg) &&
          !/^\d+$/.test(seg) &&
          seg.length > 3
        ) {
          const capitalized = seg
            .split(/[-_]+/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          if (capitalized.length > 3) {
            return capitalized;
          }
        }
      }
    } catch {}
  }

  const cleanedFallback = cleanNovelTitleText(fallbackTitle || '');
  if (cleanedFallback && !/^(?:chương|chapter)\s*\d+/i.test(cleanedFallback)) {
    return cleanedFallback;
  }

  return 'Chưa đặt tên';
}

/**
 * Finds the parent/canonical novel URL from DOM elements or breadcrumbs on a reading page.
 */
export function findNovelUrl(doc: Document, currentUrl: string): string | undefined {
  const novelLinkSelectors = [
    'h1.current-book a',
    'a.current-book',
    '.current-book a',
    'h1.story-title a',
    '.story-title a',
    'h1.truyen-title a',
    '.truyen-title a',
    'a.truyen-title',
    'h1.novel-title a',
    '.novel-title a',
    'h1.book-title a',
    '.book-title a',
    '.chapter-info .story-name a'
  ];

  for (const sel of novelLinkSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const href = el.getAttribute('href');
      if (href && href !== '#' && !href.toLowerCase().startsWith('javascript:')) {
        try {
          return new URL(href, currentUrl).href;
        } catch {}
      }
    }
  }

  // Check breadcrumbs
  const breadcrumbLinks = doc.querySelectorAll('.breadcrumb a, .breadcrumbs a, ol.breadcrumb li a, nav.breadcrumb a');
  if (breadcrumbLinks.length >= 2) {
    for (let i = breadcrumbLinks.length - 1; i >= 0; i--) {
      const a = breadcrumbLinks[i];
      const linkText = (a.textContent || '').trim();
      const href = a.getAttribute('href');
      if (
        href &&
        href !== '/' &&
        href !== '#' &&
        !href.toLowerCase().startsWith('javascript:') &&
        !/^(?:trang chủ|home|mục lục|danh sách|thể loại|chương|chapter)/i.test(linkText) &&
        !/(?:chuong|chapter|c)[-_]\d+/i.test(href)
      ) {
        try {
          return new URL(href, currentUrl).href;
        } catch {}
      }
    }
  }

  return undefined;
}

/**
 * Extracts the novel cover/thumbnail URL from DOM elements or OpenGraph meta tags.
 */
export function findNovelCover(doc: Document, baseUrl?: string): string | undefined {
  const resolveImgUrl = (raw?: string | null): string | undefined => {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('data:image/svg') || trimmed.includes('logo') || trimmed.includes('favicon')) {
      return undefined;
    }
    try {
      return baseUrl ? new URL(trimmed, baseUrl).href : trimmed;
    } catch {
      return trimmed;
    }
  };

  // 1. Dedicated book cover selectors (metruyenchu, truyenfull, tangthuvien, comong, etc.)
  const coverSelectors = [
    '.book-info-pic img',
    '.book-thum img',
    '.book-img img',
    '.books .book img',
    '.info-holder .book img',
    '.book-cover img',
    '.novel-cover img',
    '.story-cover img',
    'img[itemprop="image"]',
    '.col-inner .img-inner img.attachment-original'
  ];

  for (const sel of coverSelectors) {
    const img = doc.querySelector(sel) as HTMLImageElement | null;
    if (img) {
      const rawSrc =
        img.getAttribute('data-src') ||
        img.getAttribute('data-lazy-src') ||
        img.getAttribute('data-original') ||
        img.getAttribute('src') ||
        img.src;
      const resolved = resolveImgUrl(rawSrc);
      if (resolved && /^https?:\/\//i.test(resolved)) {
        return resolved;
      }
    }
  }

  // 2. OpenGraph / Twitter image meta tags
  const metaSelectors = [
    'meta[property="og:image"]',
    'meta[name="og:image"]',
    'meta[name="twitter:image"]'
  ];

  for (const sel of metaSelectors) {
    const meta = doc.querySelector(sel);
    const content = meta?.getAttribute('content');
    const resolved = resolveImgUrl(content);
    if (resolved && /^https?:\/\//i.test(resolved)) {
      return resolved;
    }
  }

  return undefined;
}

/**
 * Extracts the novel author name from DOM elements or meta tags.
 */
export function findNovelAuthor(doc: Document): string | undefined {
  const authorSelectors = [
    'a[itemprop="author"]',
    '[itemprop="author"]',
    '.book-info-text a[href*="/tac-gia/"]',
    '.info a[href*="/tac-gia/"]',
    '.author a',
    '.author-name'
  ];

  for (const sel of authorSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const text = (el.textContent || '').replace(/^Tác giả\s*[:：\-]?\s*/i, '').trim();
      if (text && text.length > 1 && text.length < 100 && !/không có chuyên mục/i.test(text)) {
        return text;
      }
    }
  }

  const metaAuthor =
    doc.querySelector('meta[property="og:novel:author"]')?.getAttribute('content') ||
    doc.querySelector('meta[name="author"]')?.getAttribute('content');
  if (metaAuthor && metaAuthor.trim().length > 1 && metaAuthor.trim().length < 100) {
    return metaAuthor.trim();
  }

  return undefined;
}

/**
 * Finds the "Next Chapter" link on the page.
 */
export function findNextChapterUrl(doc: Document, currentUrl: string): string | undefined {
  const currentBase = currentUrl ? currentUrl.split('#')[0] : '';
  const resolve = (href: string | null | undefined): string | undefined => {
    if (!href) return undefined;
    const trimmed = href.trim();
    if (
      !trimmed ||
      trimmed === '#' ||
      trimmed === '#top' ||
      trimmed.toLowerCase().startsWith('javascript:')
    ) {
      return undefined;
    }
    try {
      const resolved = new URL(trimmed, currentUrl).href;
      return resolved.split('#')[0] !== currentBase ? resolved : undefined;
    } catch {
      return trimmed.split('#')[0] !== currentBase ? trimmed : undefined;
    }
  };

  // 1. rel="next"
  const relNext = doc.querySelector('a[rel="next"]') as HTMLAnchorElement | null;
  if (relNext) {
    const rawHref = relNext.getAttribute('href') || relNext.href;
    const nextUrl = resolve(rawHref);
    if (nextUrl) return nextUrl;
  }

  // 2. Common button selectors
  const nextSelectors = [
    '.wpc-nav-next a',
    '.wpc-nav-next .wpc-nav-link',
    '#next_chap',
    'a#next_chap',
    '.btn-next',
    'a.btn-next',
    '.nav-next a',
    'a.next-chapter',
    '.chapter-nav .next a'
  ];

  for (const sel of nextSelectors) {
    const el = doc.querySelector(sel) as HTMLAnchorElement | null;
    if (el) {
      const text = (el.textContent || '').trim();
      if (/trước|prev|quay lại|lùi/i.test(text)) continue;
      const rawHref = el.getAttribute('href') || el.href;
      const nextUrl = resolve(rawHref);
      if (nextUrl) return nextUrl;
    }
  }

  // 3. Scan all anchor tags for next keywords
  const allLinks = Array.from(doc.querySelectorAll('a'));
  for (const a of allLinks) {
    const text = (a.textContent || '').trim();
    if (NEXT_LINK_REGEX.test(text)) {
      const rawHref = a.getAttribute('href') || a.href;
      const nextUrl = resolve(rawHref);
      if (nextUrl) return nextUrl;
    }
  }

  return undefined;
}

/**
 * Checks if the content is a locked/VIP chapter.
 */
export function isChapterLocked(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  const isShort = text.length < 350;
  return isShort && VIP_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * High-level Heuristic Chapter Extractor.
 */
export function extractChapterHeuristically(
  doc: Document,
  currentUrl: string,
  adKeywords: string[] = []
): ExtractedChapter {
  const container = findContentContainer(doc);
  const title = deobfuscateWordSlashes(findChapterTitle(doc));
  const nextUrl = findNextChapterUrl(doc, currentUrl);

  if (!container) {
    return {
      title,
      content: '',
      nextUrl,
      isLocked: false
    };
  }

  const cleanContent = sanitizeHtmlContent(container, adKeywords);
  const isLocked = isChapterLocked(cleanContent);
  const novelTitle = findNovelTitle(doc);

  return {
    title,
    novelTitle,
    content: cleanContent,
    nextUrl,
    isLocked
  };
}
