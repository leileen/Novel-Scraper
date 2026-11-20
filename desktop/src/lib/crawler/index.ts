import type { SiteRule } from '../types';
import { deobfuscateWordSlashes } from '../sanitizer';

export interface CrawledNovelMetadata {
  title: string;
  author: string;
  genres: string[];
  totalPublishedChapters?: number;
  coverUrl: string;
  description: string;
  sourceUrl: string;
  sourceDomain: string;
  chapters: Array<{ index: number; chapterNumber: number; title: string; url: string }>;
  bookId?: string;
  totalPages?: number;
  maxChapterNumber?: number;
}

/**
 * Extracts the real chapter number from a chapter's title or URL (e.g. "Chương 1558: ..." -> 1558).
 */
export function extractRealChapterNumber(
  title: string,
  url: string,
  fallbackIndex: number
): number {
  const titleMatch =
    title.match(/(?:chương|chapter|chap|hồi|tiết)\s*(\d+)/i) ||
    title.match(/^(\d+)\s*[:.-]/);
  if (titleMatch?.[1]) {
    const parsed = parseInt(titleMatch[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const urlMatch = url.match(/\/(?:chuong|chapter|chap)-(\d+)(?:[-/.]|$)/i);
  if (urlMatch?.[1]) {
    const parsed = parseInt(urlMatch[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallbackIndex;
}

/**
 * Normalizes a user-entered novel URL or chapter URL into the canonical novel main page URL.
 */
export function normalizeNovelUrl(rawUrl: string): string {
  let cleanUrl = rawUrl.trim();
  if (!cleanUrl) return '';

  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    if (
      cleanUrl.includes('metruyenchu') ||
      cleanUrl.includes('truyenfull') ||
      cleanUrl.includes('tangthuvien') ||
      cleanUrl.includes('.')
    ) {
      cleanUrl = 'https://' + cleanUrl;
    } else {
      cleanUrl = 'https://metruyenchu.com.vn/' + cleanUrl.replace(/^\/+/, '');
    }
  }

  try {
    const u = new URL(cleanUrl);
    u.hash = '';

    // Strip trailing /chuong-xxx or /chapter-xxx if user pasted a chapter link directly
    u.pathname = u.pathname.replace(/\/(chuong|chapter)-\d+[^/]*\/?$/i, '');

    // On metruyenchu.com.vn, novel URLs are at root /<slug> (not /truyen/<slug> which redirects to homepage)
    if (u.hostname.includes('metruyenchu.com.vn') && u.pathname.startsWith('/truyen/')) {
      u.pathname = u.pathname.replace(/^\/truyen\//, '/');
    }

    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }

    return u.href;
  } catch {
    return cleanUrl;
  }
}

/**
 * Fetches HTML content via native Tauri Rust backend (reqwest), CORS proxy in browser dev mode, or direct fetch.
 */
export async function fetchHtml(url: string): Promise<string> {
  const isBrowser = typeof window !== 'undefined';
  const isTauri =
    isBrowser &&
    Boolean(
      (window as unknown as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__?.invoke ||
        window.location?.hostname === 'tauri.localhost'
    );

  // 1. Prefer Native Rust HTTP client when running inside Tauri Desktop App (bypasses all CORS limits)
  if (isTauri) {
    const tauriInvoke = (
      window as unknown as {
        __TAURI_INTERNALS__?: { invoke: (cmd: string, args: Record<string, unknown>) => Promise<string> };
      }
    ).__TAURI_INTERNALS__?.invoke;

    if (tauriInvoke) {
      const html = await tauriInvoke('fetch_url_html', { url });
      if (html && html.length > 20) {
        return html;
      }
      throw new Error('Không nhận được phản hồi từ máy chủ truyện.');
    }
  }

  // 2. Browser dev server CORS proxy (only when NOT running inside Tauri static protocol)
  const proxyUrl = isBrowser && !isTauri ? `/api/proxy?url=${encodeURIComponent(url)}` : url;

  try {
    const res = await fetch(proxyUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const text = await res.text();
    if (
      proxyUrl !== url &&
      (text.includes('<div id="app"></div>') ||
        text.includes('data-sveltekit-preload-data') ||
        text.includes('Tauri + SvelteKit'))
    ) {
      throw new Error('SPA fallback returned instead of proxy response');
    }
    return text;
  } catch (err) {
    // 3. Direct fetch as final fallback
    if (proxyUrl !== url) {
      const directRes = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (directRes.ok) return await directRes.text();
    }
    throw err;
  }
}

/**
 * Helper to parse chapter links from an HTML fragment or document.
 */
function parseChapterLinksFromRoot(
  root: Document | Element,
  sourceUrl: string,
  novelSlug: string,
  seenUrls: Set<string>,
  chapters: Array<{ index: number; chapterNumber: number; title: string; url: string }>
) {
  let links = Array.from(
    root.querySelectorAll<HTMLAnchorElement>(
      '#chapter-list ul a, #list-chapter .list-chapter a, #list-chapter ul a, #ul-list-chap a, .chapter-list a'
    )
  );

  if (links.length === 0) {
    links = Array.from(
      root.querySelectorAll<HTMLAnchorElement>(
        'ul li a[href*="/chuong-"], ul li a[href*="/chapter-"], a[href*="/chuong-"], a[href*="/chapter-"]'
      )
    );
  }

  for (const a of links) {
    if (a.closest('.new-chap, .lstbtn, .book-relate, .suggest, .recently')) {
      continue;
    }

    const href = a.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript:')) continue;

    let fullUrl = '';
    try {
      fullUrl = new URL(href, sourceUrl).href;
    } catch {
      continue;
    }

    if (novelSlug && novelSlug.length > 3 && !fullUrl.includes(novelSlug)) {
      continue;
    }

    if (seenUrls.has(fullUrl)) continue;
    seenUrls.add(fullUrl);

    const rawTitle = (a.textContent || a.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    if (/^(chương\s+cuối|đọc\s+từ\s+đầu|tiếp\s+tục)$/i.test(rawTitle)) {
      continue;
    }

    const seqIndex = chapters.length + 1;
    const chapTitle = rawTitle || `Chương ${seqIndex}`;
    const chapNum = extractRealChapterNumber(chapTitle, fullUrl, seqIndex);

    chapters.push({
      index: seqIndex,
      chapterNumber: chapNum,
      title: chapTitle,
      url: fullUrl
    });
  }
}

/**
 * Extracts novel metadata and Page-1 Table of Contents (TOC) from raw HTML document.
 */
export function extractNovelMetadata(html: string, sourceUrl: string): CrawledNovelMetadata {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const urlObj = new URL(sourceUrl);
  const domain = urlObj.hostname;
  const novelSlug = urlObj.pathname.split('/').filter(Boolean).pop() || '';

  // 1. Title Extraction
  let title = '';
  const h1 = doc.querySelector(
    'h1[itemprop="name"], h1.truyen-title, h3.title[itemprop="name"], .book-info h1, h1:not(.h-hidden):not(.site-title):not(.logo)'
  );
  const h1Text = h1?.textContent?.replace(/\s+/g, ' ').trim() || '';
  const isGenericHeading = /thể\s*loại|đọc\s*truyện\s*chữ|mê\s*truyện\s*chữ|danh\s*sách|tauri\s*\+\s*sveltekit/i.test(
    h1Text
  );

  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc.title || '';
  const cleanedOg = ogTitle
    .replace(/^đọc\s+truyện\s+/i, '')
    .split(/\s+[-|]\s+/)[0]
    .replace(/\s+full.*$/i, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim();

  if (h1Text && !isGenericHeading) {
    title = h1Text;
  } else if (
    cleanedOg &&
    cleanedOg.length > 2 &&
    !/không\s*quảng\s*cáo|^mê\s*truyện|tauri\s*\+\s*sveltekit|novel\s*scraper\s*desktop/i.test(cleanedOg)
  ) {
    title = cleanedOg;
  } else {
    const slug = novelSlug || 'Novel';
    title = slug
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  // 2. Author Extraction
  let author = 'Đang cập nhật';
  const authorEl = doc.querySelector(
    '[itemprop="author"], .author, .author-name, a[href*="/tac-gia/"], .info a[href*="tac-gia"]'
  );
  if (authorEl && authorEl.textContent?.trim()) {
    author = authorEl.textContent.replace(/\s+/g, ' ').trim();
  } else {
    const fullText = doc.body?.textContent || '';
    const match = fullText.match(/Tác\s*giả\s*:\s*([^\n\r<|]+)/i);
    if (match && match[1]?.trim()) {
      author = match[1].trim();
    }
  }
  author = author.replace(/^Tác\s*giả\s*[:\-]\s*/i, '').trim();

  // 2b. Genres Extraction
  const genres: string[] = [];
  const genreEls = doc.querySelectorAll(
    '.info a[href*="the-loai"], a[itemprop="genre"], [itemprop="genre"], .truyen_info a[href*="the-loai"], .info-holder a[href*="the-loai"], .book-info a[href*="the-loai"]'
  );
  for (const el of Array.from(genreEls)) {
    const txt = el.textContent?.trim();
    if (txt && txt.length > 1 && !genres.includes(txt)) {
      genres.push(txt);
    }
  }
  if (genres.length === 0) {
    const fullText = doc.body?.textContent || '';
    const match = fullText.match(/Thể\s*loại\s*:\s*([^\n\r<|]+)/i);
    if (match && match[1]) {
      const parts = match[1].split(/[,;/]/);
      for (const p of parts) {
        const cleaned = p.trim().replace(/^[-•]\s*/, '');
        if (cleaned && cleaned.length > 1 && !genres.includes(cleaned)) {
          genres.push(cleaned);
        }
      }
    }
  }

  // 3. Cover Image Extraction
  let coverUrl = `https://picsum.photos/seed/${encodeURIComponent(title)}/240/340`;
  const coverEl = doc.querySelector(
    '.book-info-pic img, .book-cover img, .book-3d img, .book img, .cover img, img[itemprop="image"]'
  );
  const coverSrc = coverEl?.getAttribute('src') || coverEl?.getAttribute('data-src');
  const ogImg = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');

  if (coverSrc && !coverSrc.includes('default') && !coverSrc.includes('logo')) {
    coverUrl = new URL(coverSrc, sourceUrl).href;
  } else if (ogImg && !ogImg.includes('default.jpg') && !ogImg.includes('logo')) {
    coverUrl = new URL(ogImg, sourceUrl).href;
  }

  // 4. Description Extraction
  let description = 'Một bộ tiểu thuyết hấp dẫn đang được nhiều độc giả theo dõi.';
  const descEl = doc.querySelector(
    '#gioithieu [itemprop="description"], .desc-text, .truyen-desc, .book-intro, .story-description, [itemprop="description"]'
  );
  if (descEl && descEl.textContent?.trim()) {
    description = descEl.textContent.replace(/\s+\n/g, '\n').trim().slice(0, 1500);
  } else {
    const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
    if (ogDesc && ogDesc.length > 20) {
      description = ogDesc.trim().slice(0, 1500);
    }
  }

  // 5. Table of Contents (TOC) Extraction from Page 1
  const chapters: Array<{ index: number; chapterNumber: number; title: string; url: string }> = [];
  const seenUrls = new Set<string>();
  parseChapterLinksFromRoot(doc, sourceUrl, novelSlug, seenUrls, chapters);

  // Detect bookId & totalPages for multi-page AJAX pagination
  let bookId: string | undefined;
  let totalPages = 1;
  let reportedMaxChapter = 0;

  const bidInput = doc.querySelector<HTMLInputElement>('input[name="bid"], input#truyen-id');
  if (bidInput?.value) {
    bookId = bidInput.value.trim();
  } else {
    const ridMatch = html.match(/var\s+rid\s*=\s*['"](\d+)['"]/i) || html.match(/page\(\s*(\d+)\s*,/i);
    if (ridMatch?.[1]) {
      bookId = ridMatch[1];
    }
  }

  const pageMatches = html.matchAll(/page\(\s*\d+\s*,\s*(\d+)\s*\)/gi);
  for (const m of pageMatches) {
    const p = parseInt(m[1], 10);
    if (!isNaN(p) && p > totalPages) {
      totalPages = p;
    }
  }

  const totalPageInput = doc.querySelector<HTMLInputElement>('input#total-page');
  if (totalPageInput?.value) {
    const p = parseInt(totalPageInput.value, 10);
    if (!isNaN(p) && p > totalPages) {
      totalPages = p;
    }
  }

  let totalPublishedChapters: number | undefined;
  const totalChapMatch =
    html.match(/Số\s*chương\s*:\s*(?:<[^>]+>)*\s*([\d,.]+)/i) ||
    (doc.body?.textContent || '').match(/Số\s*chương\s*:\s*([\d,.]+)/i);
  if (totalChapMatch?.[1]) {
    const cleanNum = totalChapMatch[1].replace(/[.,]/g, '');
    const reportedTotal = parseInt(cleanNum, 10);
    if (!isNaN(reportedTotal) && reportedTotal > 0) {
      reportedMaxChapter = reportedTotal;
      totalPublishedChapters = reportedTotal;
      if (totalPages === 1 && chapters.length >= 50 && reportedTotal > chapters.length) {
        totalPages = Math.ceil(reportedTotal / chapters.length);
      }
    }
  }

  if (chapters.length === 0) {
    const baseChapterUrl = sourceUrl.endsWith('/') ? sourceUrl.slice(0, -1) : sourceUrl;
    for (let i = 1; i <= 60; i++) {
      chapters.push({
        index: i,
        chapterNumber: i,
        title: `Chương ${i}: ${
          i === 1
            ? 'Khởi đầu phong vân'
            : i === 2
              ? 'Thức tỉnh năng lực'
              : i === 3
                ? 'Gia tộc chấn động'
                : `Diễn biến hồi ${i}`
        }`,
        url: `${baseChapterUrl}/chuong-${i}`
      });
    }
  }

  const maxChapterNumber = Math.max(
    reportedMaxChapter,
    chapters.length,
    chapters[chapters.length - 1]?.chapterNumber || 0
  );

  return {
    title,
    author,
    genres,
    totalPublishedChapters,
    coverUrl,
    description,
    sourceUrl,
    sourceDomain: domain,
    chapters,
    bookId,
    totalPages,
    maxChapterNumber
  };
}

/**
 * Fetches a single TOC AJAX page with automatic retries on transient failure.
 */
async function fetchTocPageWithRetry(ajaxUrl: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const rawResp = await fetchHtml(ajaxUrl);
      if (rawResp && rawResp.length > 10) {
        if (rawResp.trim().startsWith('{')) {
          const parsedJson = JSON.parse(rawResp) as { data?: string };
          if (parsedJson.data) {
            return parsedJson.data;
          }
        }
        return rawResp;
      }
    } catch (e) {
      if (attempt === retries) {
        console.warn(`TOC page failed after ${retries} attempts (${ajaxUrl}):`, e);
      } else {
        await new Promise((r) => setTimeout(r, 350 * attempt));
      }
    }
  }
  return '';
}

/**
 * Fetches the novel main page AND all paginated Table of Contents pages so all chapters are discovered in order.
 */
export async function fetchFullNovelMetadata(
  rawUrl: string,
  onProgress?: (loadedPages: number, totalPages: number, chaptersCount: number) => void
): Promise<CrawledNovelMetadata> {
  let cleanUrl = normalizeNovelUrl(rawUrl);
  let html = await fetchHtml(cleanUrl);

  const parser = new DOMParser();
  const initialDoc = parser.parseFromString(html, 'text/html');
  const canonical = initialDoc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
  if (
    canonical &&
    new URL(canonical, cleanUrl).pathname === '/' &&
    new URL(cleanUrl).pathname !== '/'
  ) {
    const slug = new URL(cleanUrl).pathname.split('/').filter(Boolean).pop();
    if (slug) {
      cleanUrl = `${new URL(cleanUrl).origin}/${slug}`;
      html = await fetchHtml(cleanUrl);
    }
  }

  const metadata = extractNovelMetadata(html, cleanUrl);
  const urlObj = new URL(cleanUrl);
  const novelSlug = urlObj.pathname.split('/').filter(Boolean).pop() || '';
  const totalPages = metadata.totalPages || 1;

  if (onProgress) {
    onProgress(1, totalPages, metadata.chapters.length);
  }

  if (totalPages > 1 && metadata.bookId && urlObj.hostname.includes('metruyenchu')) {
    const seenUrls = new Set<string>(metadata.chapters.map((c) => c.url));
    const batchSize = 6;

    for (let startPage = 2; startPage <= totalPages; startPage += batchSize) {
      const endPage = Math.min(totalPages, startPage + batchSize - 1);
      const pageNumbers: number[] = [];
      for (let p = startPage; p <= endPage; p++) {
        pageNumbers.push(p);
      }

      const batchResults = await Promise.all(
        pageNumbers.map(async (p) => {
          const ajaxUrl = `${urlObj.origin}/get/listchap/${metadata.bookId}?page=${p}`;
          const fragmentHtml = await fetchTocPageWithRetry(ajaxUrl, 3);
          return { page: p, fragmentHtml };
        })
      );

      batchResults.sort((a, b) => a.page - b.page);
      for (const res of batchResults) {
        if (!res.fragmentHtml) continue;
        const fragDoc = parser.parseFromString(res.fragmentHtml, 'text/html');
        parseChapterLinksFromRoot(fragDoc, cleanUrl, novelSlug, seenUrls, metadata.chapters);
      }

      if (onProgress) {
        onProgress(endPage, totalPages, metadata.chapters.length);
      }
    }
  } else if (totalPages > 1 && urlObj.hostname.includes('truyenfull')) {
    const seenUrls = new Set<string>(metadata.chapters.map((c) => c.url));
    const batchSize = 5;
    const maxPagesToFetch = Math.min(totalPages, 40);

    for (let startPage = 2; startPage <= maxPagesToFetch; startPage += batchSize) {
      const endPage = Math.min(maxPagesToFetch, startPage + batchSize - 1);
      const pageNumbers: number[] = [];
      for (let p = startPage; p <= endPage; p++) {
        pageNumbers.push(p);
      }

      const batchResults = await Promise.all(
        pageNumbers.map(async (p) => {
          const pageUrl = `${cleanUrl.replace(/\/$/, '')}/trang-${p}/`;
          const pageHtml = await fetchTocPageWithRetry(pageUrl, 2);
          return { page: p, pageHtml };
        })
      );

      batchResults.sort((a, b) => a.page - b.page);
      for (const res of batchResults) {
        if (!res.pageHtml) continue;
        const pageDoc = parser.parseFromString(res.pageHtml, 'text/html');
        parseChapterLinksFromRoot(pageDoc, cleanUrl, novelSlug, seenUrls, metadata.chapters);
      }

      if (onProgress) {
        onProgress(endPage, maxPagesToFetch, metadata.chapters.length);
      }
    }
  }

  // Re-index sequential array position (1..N) while preserving real chapterNumber from title/URL
  let highestChapNum = metadata.maxChapterNumber || metadata.chapters.length;
  metadata.chapters.forEach((ch, idx) => {
    ch.index = idx + 1;
    ch.chapterNumber = extractRealChapterNumber(ch.title, ch.url, idx + 1);
    if (ch.chapterNumber > highestChapNum) {
      highestChapNum = ch.chapterNumber;
    }
  });
  metadata.maxChapterNumber = highestChapNum;

  return metadata;
}

/**
 * Extracts and sanitizes chapter content from raw HTML, preserving paragraph & line breaks.
 */
export function extractChapterContent(html: string, rule?: SiteRule): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const selectors = [
    rule?.contentSelector,
    rule?.chapterContentSelector,
    '#vungdoc .truyen',
    '#chapter-c',
    '.box-chap',
    '#vungdoc',
    '.chapter-content',
    '.reading-content',
    '.entry-content',
    '#content'
  ].filter(Boolean) as string[];

  let container: Element | null = null;
  for (const sel of selectors) {
    try {
      const found = doc.querySelector(sel);
      if (found && (found.textContent || '').trim().length > 80) {
        container = found;
        break;
      }
    } catch {}
  }

  if (!container) {
    container = doc.body;
  }

  const clone = container.cloneNode(true) as Element;

  const unwanted = clone.querySelectorAll(
    'script, style, noscript, iframe, .ads, .adsbygoogle, .banner, .chapter_control, .chapter-nav, #download-book, button, nav'
  );
  unwanted.forEach((el) => el.remove());

  clone.querySelectorAll('br').forEach((br) => {
    br.replaceWith('\n');
  });
  clone.querySelectorAll('p, div, li, h1, h2, h3, h4').forEach((block) => {
    block.append('\n\n');
  });

  const rawText = clone.textContent || '';
  return deobfuscateWordSlashes(rawText)
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && !/^(báo lỗi|bình luận|tải ebook|chương trước|chương tiếp)$/i.test(line))
    .join('\n\n');
}
