import type { ExtractedChapter, SiteRule, TocChapterItem } from '../types';
import { extractChapterHeuristically, findChapterTitle, findNovelTitle, findNextChapterUrl, isChapterLocked } from './heuristic';
import { sanitizeHtmlContent, deobfuscateWordSlashes } from '../sanitizer';

/**
 * Safely executes querySelector, catching any DOMException for malformed selectors.
 */
export function safeQuerySelector<T extends Element = Element>(root: ParentNode, selector: string): T | null {
  try {
    return root.querySelector<T>(selector);
  } catch (err) {
    console.warn(`[Extractor] Invalid selector: "${selector}"`, err);
    return null;
  }
}

/**
 * Safely executes querySelectorAll, catching any DOMException for malformed selectors.
 */
export function safeQuerySelectorAll<T extends Element = Element>(root: ParentNode, selector: string): T[] {
  try {
    return Array.from(root.querySelectorAll<T>(selector));
  } catch (err) {
    console.warn(`[Extractor] Invalid selector: "${selector}"`, err);
    return [];
  }
}

/**
 * Resolves a potentially relative URL against a base URL.
 */
export function resolveUrl(href: string | null | undefined, baseUrl?: string): string | undefined {
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
  if (!baseUrl) return trimmed;
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return trimmed;
  }
}

/**
 * Extracts chapter data using a specific SiteRule, or falls back to heuristic extraction.
 */
export function extractChapterWithRule(
  doc: Document,
  currentUrl: string,
  rule?: SiteRule | null,
  adKeywords: string[] = [],
  options?: { deobfuscate?: boolean; replacements?: Array<{ from: string; to: string }> }
): ExtractedChapter {
  if (!rule) {
    return extractChapterHeuristically(doc, currentUrl, adKeywords);
  }

  // 1. Content container
  let container: Element | null = null;
  if (rule.contentSelector) {
    // If multiple comma-separated selectors are present, evaluate candidates
    const rawSel = typeof rule.contentSelector === 'string' ? rule.contentSelector : String(rule.contentSelector || '');
    const selectors = rawSel.split(',').map((s) => s.trim()).filter(Boolean);
    
    for (const sel of selectors) {
      const matches = safeQuerySelectorAll(doc, sel);
      if (matches.length === 0) continue;

      if (matches.length > 1) {
        // If selector matched multiple elements (e.g. 'p', 'div.reading-content p'),
        // combine all matched elements into a virtual container so NO paragraph is lost!
        const virtualDiv = doc.createElement('div');
        for (const m of matches) {
          virtualDiv.appendChild(m.cloneNode(true));
        }
        if ((virtualDiv.textContent || '').trim().length > 0) {
          container = virtualDiv;
          break;
        }
      } else {
        let single = matches[0];
        // If single match is a leaf paragraph <p> or inline tag but parent has multiple paragraphs,
        // expand to parent container (common when visual picker clicked on a single paragraph)
        if (single.tagName === 'P' && single.parentElement && single.parentElement.tagName !== 'BODY') {
          const parent = single.parentElement;
          if (parent.querySelectorAll('p').length > 1) {
            single = parent;
          }
        }
        if ((single.textContent || '').trim().length > 0) {
          container = single;
          break;
        }
      }
    }

    // If no split candidate matched, try the full raw selector as fallback
    if (!container) {
      const fallbackMatches = safeQuerySelectorAll(doc, rawSel);
      if (fallbackMatches.length > 1) {
        const virtualDiv = doc.createElement('div');
        for (const m of fallbackMatches) {
          virtualDiv.appendChild(m.cloneNode(true));
        }
        container = virtualDiv;
      } else if (fallbackMatches.length === 1) {
        container = fallbackMatches[0];
      }
    }
  }

  // If container is missing or completely empty (0 characters), fall back to heuristic extraction
  if (!container || (container.textContent || '').trim().length === 0) {
    return extractChapterHeuristically(doc, currentUrl, adKeywords);
  }

  // Clone container to sanitize without affecting DOM
  const containerClone = container.cloneNode(true) as Element;

  // Remove elements matching excludeSelectors
  if (rule.excludeSelectors) {
    const rawExcludes = Array.isArray(rule.excludeSelectors)
      ? rule.excludeSelectors
      : typeof rule.excludeSelectors === 'string'
      ? (rule.excludeSelectors as string).split('\n')
      : Object.values(rule.excludeSelectors);
    rawExcludes.forEach((sel) => {
      try {
        const unwanted = containerClone.querySelectorAll(String(sel));
        unwanted.forEach((el) => el.remove());
      } catch {
        // Ignore invalid selectors
      }
    });
  }

  // 2. Title extraction
  let title = '';
  if (rule.titleSelector) {
    const rawTitleSel = typeof rule.titleSelector === 'string' ? rule.titleSelector : String(rule.titleSelector || '');
    const titleSelectors = rawTitleSel.split(',').map((s) => s.trim()).filter(Boolean);
    for (const sel of titleSelectors) {
      const titleEl = safeQuerySelector(doc, sel);
      if (titleEl) {
        const candidate = (titleEl.textContent || '').trim();
        if (candidate.length > 0 && candidate.length < 200) {
          title = candidate;
          break;
        }
      }
    }
  }
  if (!title) {
    title = findChapterTitle(doc);
  }
  title = deobfuscateWordSlashes(title);

  // 3. Next chapter URL
  let nextUrl: string | undefined;
  if (rule.nextSelector) {
    const candidates = safeQuerySelectorAll<HTMLAnchorElement>(doc, rule.nextSelector);
    for (const nextEl of candidates) {
      const text = (nextEl.textContent || '').trim();
      if (!/trước|prev|quay lại|lùi/i.test(text)) {
        const rawHref = nextEl.getAttribute('href') || nextEl.href;
        const resolved = resolveUrl(rawHref, currentUrl);
        if (resolved && resolved.split('#')[0] !== currentUrl.split('#')[0]) {
          nextUrl = resolved;
          break;
        }
      }
    }
  }
  if (!nextUrl) {
    nextUrl = findNextChapterUrl(doc, currentUrl);
  }

  // 4. Clean content
  const novelTitle = findNovelTitle(doc, doc.title);
  const cleanAdKeywords = (Array.isArray(adKeywords)
    ? adKeywords
    : typeof adKeywords === 'string'
    ? (adKeywords as string).split(/[\r\n,]+/)
    : typeof adKeywords === 'object' && adKeywords !== null
    ? Object.values(adKeywords)
    : []
  ).map((k: any) => String(k).trim()).filter(Boolean);

  let cleanContent = sanitizeHtmlContent(containerClone, cleanAdKeywords, {
    ...options,
    novelTitle,
    chapterTitle: title
  });

  // If content is completely empty after cleaning, fall back to heuristic
  if (cleanContent.trim().length === 0) {
    const heuristic = extractChapterHeuristically(doc, currentUrl, adKeywords);
    if (heuristic.content && heuristic.content.trim().length > 0) {
      return {
        title: title || heuristic.title,
        novelTitle: novelTitle || heuristic.novelTitle,
        content: heuristic.content,
        nextUrl: nextUrl || heuristic.nextUrl,
        isLocked: heuristic.isLocked
      };
    }
  }

  const isLocked = isChapterLocked(cleanContent);

  return {
    title,
    novelTitle,
    content: cleanContent,
    nextUrl,
    isLocked
  };
}

/**
 * Extracts Table of Contents chapter links from a novel index/TOC page.
 */
export function extractTocFromDocument(
  doc: Document,
  rule?: SiteRule | null,
  currentUrl?: string
): { chapters: TocChapterItem[]; nextPaginationUrl?: string } {
  const chapters: TocChapterItem[] = [];
  const seenUrls = new Set<string>();

  const baseEl = safeQuerySelector<HTMLBaseElement>(doc, 'base[href]');
  const baseHref = baseEl?.getAttribute('href') || baseEl?.href;
  const baseUrl = currentUrl || baseHref || (doc.baseURI && doc.baseURI !== 'about:blank' ? doc.baseURI : undefined);

  // Helper to extract chapters from a <select> element
  const extractFromSelect = (selectEl: HTMLSelectElement): TocChapterItem[] => {
    const list: TocChapterItem[] = [];
    const options = safeQuerySelectorAll<HTMLOptionElement>(selectEl, 'option');
    const validOptions = options.filter((opt) => {
      const val = opt.value || opt.getAttribute('value') || '';
      const txt = (opt.textContent || '').trim();
      return (
        (/(?:Chương|Chapter|Hồi|Tiết|Quyển|Phần|Bài)\s*\d+/i.test(txt) ||
         /\/(?:chuong|chapter|c)[-_]\d+/i.test(val) ||
         /^\d+$/.test(txt)) &&
        val &&
        val !== '#' &&
        !val.toLowerCase().startsWith('javascript:')
      );
    });

    if (validOptions.length > 1) {
      let optIndex = 1;
      for (const opt of validOptions) {
        const rawVal = opt.value || opt.getAttribute('value') || '';
        const url = resolveUrl(rawVal, baseUrl);
        const title = (opt.textContent || '').trim() || `Chương ${optIndex}`;
        if (url && !seenUrls.has(url)) {
          seenUrls.add(url);
          list.push({
            title,
            url,
            chapterNumber: optIndex++
          });
        }
      }
    }
    return list;
  };

  const EXCLUDED_TOC_CONTAINERS = `
    .book-relate, .sidebar, aside, #box-right, .box-right,
    .truyen-cung-tac-gia, .truyen-de-cu, .item-related, .related,
    .ichapter, .widget, .footer, footer, header, nav:not(.toc-nav),
    .comment, #comment, .user-menu, .chap-nav, .chapter_control, #gotochap,
    .full-book, .full-wrapper, .item, .caption, .tag-list, .new-chap, .line-control
  `.trim();

  // Determine novel path slug from baseUrl to filter out cross-novel recommendations
  let storySlug = '';
  try {
    if (baseUrl) {
      const u = new URL(baseUrl);
      const segments = u.pathname.split('/').filter(Boolean);
      if (segments.length >= 2 && /(?:chuong|chapter|c)[-_]\d+/i.test(segments[segments.length - 1])) {
        storySlug = segments[segments.length - 2];
      } else if (segments.length >= 1) {
        storySlug = segments[0];
      }
    }
  } catch {}

  // 1. If rule has a tocSelector, check it first (can be select or link selectors)
  if (rule?.tocSelector) {
    const rawSelectors = rule.tocSelector.split(',').map((s) => s.trim()).filter(Boolean);
    for (const sel of rawSelectors) {
      // Check if selector matches a select element
      const selectMatch = safeQuerySelector<HTMLSelectElement>(doc, sel);
      if (selectMatch && selectMatch.tagName === 'SELECT') {
        const fromSel = extractFromSelect(selectMatch);
        if (fromSel.length > 0) {
          chapters.push(...fromSel);
          break;
        }
      }
      // Check if selector matches links
      const linkMatches = safeQuerySelectorAll<HTMLAnchorElement>(doc, sel);
      if (linkMatches.length > 0) {
        let idx = 1;
        for (const a of linkMatches) {
          // Never extract links from excluded containers (recommendations, footer, nav)
          if (a.closest(EXCLUDED_TOC_CONTAINERS)) continue;

          const title = (a.textContent || '').trim();
          // Exclude pagination navigation links matching the selector
          const isPagingLink = Boolean(a.closest('.paging, .pagination, .page-nav, .navigation'));
          const isPagingText = /^(?:[‹«<]*\s*)?(?:\d+|›|»|>|cuối|đầu|trước|sau|tiếp|next|prev)(?:\s*[›»>]*)$/i.test(title);
          if (isPagingLink || isPagingText) continue;

          const rawHref = a.getAttribute('href') || a.href;
          const url = resolveUrl(rawHref, baseUrl);
          if (url && !seenUrls.has(url) && title.length > 0) {
            seenUrls.add(url);
            chapters.push({ title, url, chapterNumber: idx++ });
          }
        }
        if (chapters.length > 0) {
          break;
        }
      }
    }
  }

  // 2. If no chapters found yet, check dropdown <select> elements (common on reading pages like comong.info)
  if (chapters.length === 0) {
    const selects = safeQuerySelectorAll<HTMLSelectElement>(doc, 'select');
    for (const sel of selects) {
      const fromSel = extractFromSelect(sel);
      if (fromSel.length > 1) {
        chapters.push(...fromSel);
        break;
      }
    }
  }

  // 3. Fallback to standard TOC link selectors (excluding general site menus like .nav-dropdown)
  if (chapters.length === 0) {
    const tocSelectors = [
      '#chapter-list a',
      '.title-list-chapter ~ div ul li a',
      '.list-chapter a',
      '#list-chapter a',
      '.chapter-list a',
      'ul.list-chapters a',
      '.chapters a',
      'table.table-chapters a',
      '.chapter-item a',
      '.chapter-select a',
      '.mucluc a',
      'ul.mucluc a'
    ];

    let foundLinks: HTMLAnchorElement[] = [];

    for (const sel of tocSelectors) {
      const elements = safeQuerySelectorAll<HTMLAnchorElement>(doc, sel);
      if (elements.length > 0) {
        foundLinks = elements;
        break;
      }
    }

    // 4. Heuristic fallback: search links that look like chapter links (excluding navigation, sidebars, and unrelated novel links)
    // Note: Do not run heuristic TOC link extraction on a single chapter reading page without a <select> dropdown,
    // to avoid treating recommendation links or navigation buttons as a table of contents.
    const isSingleReadingPage = /(?:chuong|chapter|c)[-_]\d+/i.test(baseUrl || currentUrl || '');
    if (foundLinks.length === 0 && !isSingleReadingPage) {
      const allLinks = safeQuerySelectorAll<HTMLAnchorElement>(doc, 'a[href]');
      foundLinks = allLinks.filter((a) => {
        if (a.closest(EXCLUDED_TOC_CONTAINERS)) return false;

        const text = (a.textContent || '').trim();
        const href = a.getAttribute('href') || a.href || '';

        // Exclude pagination and navigation buttons (e.g. 《 Chương trước, Chương tiếp 》)
        const isNavButton = /^(?:[《<‹\u300a\u2039]*\s*)?(?:chương\s+(?:sau|tiếp|trước)|tiếp(?:\s+theo)?|sau|next|prev|quay lại|lùi)(?:[\s»>→›\u300b\u203a\u2192]*)$/i.test(text);
        if (isNavButton) return false;

        // Exclude chapter count badges (e.g. "659 chương", "11017 chương")
        if (/^\d+\s*(?:chương|chapters?|chaps?)$/i.test(text)) return false;

        // Exclude category, tag, author, or comment links
        if (/(?:tag|category|the-loai|tac-gia|author|comment)\//i.test(href)) return false;

        return (
          (/(?:Chương|Chapter|Hồi|Tiết)\s+\d+/i.test(text) ||
           /\d+\s*(?:Chương|Chapter|Hồi|Tiết)\b/i.test(text) ||
           /^Chương\s+\S+/i.test(text) ||
           /\/(?:chuong|chapter|c)[-_](?:\d+|tiep\b)/i.test(href)) &&
          !text.includes('Mục lục') &&
          !text.includes('Bình luận')
        );
      });

      // A heuristic TOC must have at least 2 distinct chapter URLs; duplicate links to the current chapter do not constitute a TOC
      const uniqueFoundUrls = new Set(
        foundLinks.map((a) => resolveUrl(a.getAttribute('href') || a.href, baseUrl)).filter(Boolean)
      );
      if (uniqueFoundUrls.size < 2) {
        foundLinks = [];
      }
    }

    let index = 1;
    foundLinks.forEach((a) => {
      const title = (a.textContent || '').trim();
      // Exclude pagination navigation links
      const isPagingLink = Boolean(a.closest('.paging, .pagination, .page-nav, .navigation'));
      const isPagingText = /^(?:[‹«<]*\s*)?(?:\d+|›|»|>|cuối|đầu|trước|sau|tiếp|next|prev)(?:\s*[›»>]*)$/i.test(title);
      if (isPagingLink || isPagingText) return;

      const rawHref = a.getAttribute('href') || a.href;
      const url = resolveUrl(rawHref, baseUrl);
      if (url && !seenUrls.has(url) && title.length > 0) {
        seenUrls.add(url);
        chapters.push({
          title,
          url,
          chapterNumber: index++
        });
      }
    });
  }

  // Pagination next page selector
  let nextPaginationUrl: string | undefined;
  const paginationSelectors = [
    ...(rule?.paginationSelector ? [rule.paginationSelector] : []),
    '.pagination li.active + li a',
    '.pagination a.next',
    'a.pagination-next',
    'a[rel="next"]'
  ];

  for (const sel of paginationSelectors) {
    const nextA = safeQuerySelector<HTMLAnchorElement>(doc, sel);
    if (nextA) {
      const rawHref = nextA.getAttribute('href') || nextA.href;
      const resolved = resolveUrl(rawHref, baseUrl);
      if (resolved && resolved !== baseUrl) {
        nextPaginationUrl = resolved;
        break;
      }
    }
  }

  // Handle AJAX pagination (e.g. Mê Truyện Chữ /get/listchap/{storyId}?page={p} and onclick="page(id, p)")
  if (!nextPaginationUrl) {
    const pagingA = safeQuerySelectorAll<HTMLAnchorElement>(doc, '.paging a, .pagination a');
    let storyIdFromPaging: string | undefined;
    const pagingTargets = new Set<number>();

    for (const a of pagingA) {
      const onclick = a.getAttribute('data-onclick') || a.getAttribute('onclick') || '';
      const m = onclick.match(/page\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (m) {
        storyIdFromPaging = m[1];
        const targetPage = parseInt(m[2], 10);
        if (!isNaN(targetPage)) {
          pagingTargets.add(targetPage);
        }
      }
    }

    if (baseUrl && /\/get\/listchap\/(\d+)\?page=(\d+)/i.test(baseUrl)) {
      const match = baseUrl.match(/\/get\/listchap\/(\d+)\?page=(\d+)/i);
      if (match) {
        const storyId = match[1];
        const currentPage = parseInt(match[2], 10);
        const nextPage = currentPage + 1;
        if (pagingTargets.size > 0) {
          // If .paging is present in the AJAX response, trust its explicit next-page onclick target
          if (pagingTargets.has(nextPage)) {
            nextPaginationUrl = resolveUrl(`/get/listchap/${storyId}?page=${nextPage}`, baseUrl);
          }
        } else if (chapters.length >= 90) {
          // Fallback when .paging is omitted (e.g. minimal HTML fragment): advance if page is full (>= 90 chapters)
          nextPaginationUrl = resolveUrl(`/get/listchap/${storyId}?page=${nextPage}`, baseUrl);
        }
      }
    } else {
      let storyId = storyIdFromPaging;
      if (!storyId) {
        const inputBid = safeQuerySelector<HTMLInputElement>(doc, 'input[name="bid"]');
        if (inputBid?.value) storyId = inputBid.value.trim();
      }
      if (storyId && pagingTargets.has(2)) {
        nextPaginationUrl = resolveUrl(`/get/listchap/${storyId}?page=2`, baseUrl);
      }
    }
  }

  return { chapters, nextPaginationUrl };
}

/**
 * Extracts Table of Contents with rule, returning chapters array with fully resolved absolute URLs.
 * Also provides .chapters and .nextPaginationUrl for compatibility.
 */
export function extractTocWithRule(
  doc: Document,
  rule?: SiteRule | null,
  currentUrl?: string
): TocChapterItem[] & { chapters: TocChapterItem[]; nextPaginationUrl?: string } {
  const result = extractTocFromDocument(doc, rule, currentUrl);
  const arr = [...result.chapters] as TocChapterItem[] & {
    chapters: TocChapterItem[];
    nextPaginationUrl?: string;
  };
  arr.chapters = result.chapters;
  arr.nextPaginationUrl = result.nextPaginationUrl;
  return arr;
}
