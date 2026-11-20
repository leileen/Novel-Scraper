/**
 * Pure Text Sanitizer Pipeline for Novel Scraper
 * Normalizes Vietnamese Unicode (NFC), strips invisible characters, removes ads/watermarks,
 * and produces clean, properly spaced paragraphs.
 */

// Invisible zero-width and control characters to strip
const INVISIBLE_CHARS_REGEX = /[\u200B-\u200D\uFEFF\u00AD\u2060\u200E\u200F]/g;

// Unwanted HTML elements to drop completely before extracting text
export const UNWANTED_TAGS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'img',
  'video',
  'audio',
  'svg',
  'canvas',
  'button',
  'input',
  'select',
  'textarea',
  'form',
  'header',
  'footer',
  'nav',
  'aside'
];

/**
 * Known 2-letter technical units / symbols / abbreviations that must NOT be deobfuscated.
 */
const PROTECTED_TWO_LETTER_UNITS = new Set([
  'm/s', 'v/m', 'v/p', 'v/s', 'a/b', 'x/y', 'n/a', 'c/o', 'p/o', 'd/o', 'w/o', 'w/e'
]);

/**
 * Common 2-letter Vietnamese words that are often obfuscated (e.g. đ/ụ, m/ẹ, đ/i, r/a, v/ợ, b/ù...).
 */
const VIETNAMESE_TWO_LETTER_WORDS = new Set([
  'đi', 'ra', 'ăn', 'bị', 'lo', 'sợ', 'họ', 'nó', 'vợ', 'mẹ', 'ba', 'má', 'té',
  'đè', 'hạ', 'xử', 'đụ', 'bú', 'xé', 'kẻ', 'về', 'kì', 'mơ', 'dù', 'bỏ', 'ru',
  'hả', 'hử', 'ơ', 'ơi', 'ác', 'ôm', 'ép', 'úi', 'ôi'
]);

/**
 * Intelligently deobfuscates words intentionally split with slashes, backslashes,
 * or dashes/dots to bypass censorship filters (e.g. "g/h/e/n t/u/ô/n/g" -> "ghen tuông").
 *
 * Guaranteed safe with zero false positives on:
 * - Dates / Fractions (12/04/2026, 1/2)
 * - URLs & Paths (comong.info/page/2)
 * - Multi-letter choices (và/hoặc, anh/chị, ông/bà, nam/nữ, đúng/sai)
 * - Units & Metrics (km/h, 10 m/s)
 */
export function deobfuscateWordSlashes(text: string): string {
  if (!text) return '';

  // 1. Process slash and backslash obfuscations:
  // Matches sequences of single letters separated by slashes/backslashes:
  // e.g. "g/h/e/n", "t/u/ô/n/g", "g / h / e / n", "k\h\ỏ\a"
  const slashRegex = /(?<!\p{L})(\p{L}(?:\s*[\/\\]\s*\p{L})+)(?!\p{L})/gu;

  let result = text.replace(slashRegex, (match, wordGroup, offset, fullString) => {
    // Split into individual letters
    const letters = wordGroup.split(/\s*[\/\\]\s*/);

    // If any segment has more than 1 letter:
    if (letters.some((l: string) => l.length !== 1)) {
      return match;
    }

    const combined = letters.join('');
    const lowerCombined = combined.toLowerCase();
    const cleanLowerMatch = match.replace(/\s+/g, '').toLowerCase();

    // Protection: If it's only 2 letters (e.g. m/s or a/b):
    if (letters.length === 2) {
      // Check if it's a protected unit like m/s, v/m, n/a
      if (PROTECTED_TWO_LETTER_UNITS.has(cleanLowerMatch)) {
        return match;
      }

      // Check if preceded by digits (e.g. "10 m/s")
      const beforeSlice = offset >= 5 ? fullString.slice(offset - 5, offset) : fullString.slice(0, offset);
      if (/\d\s*$/.test(beforeSlice)) {
        return match;
      }

      // Check if combined is a known Vietnamese syllable or part of an adjacent obfuscated word
      const isKnownWord = VIETNAMESE_TWO_LETTER_WORDS.has(lowerCombined);
      const isAdjacentToSlashWord =
        /(?:[\/\\]\s*\p{L}\s*){2,}/u.test(fullString.slice(Math.max(0, offset - 15), offset)) ||
        /(?:\p{L}\s*[\/\\]\s*){2,}/u.test(fullString.slice(offset + match.length, offset + match.length + 15));

      if (!isKnownWord && !isAdjacentToSlashWord) {
        return match;
      }
    }

    return combined;
  });

  // 2. Process dot or dash obfuscations for 3 or more letters:
  // e.g. "g.h.e.n" -> "ghen", "g-h-e-n" -> "ghen"
  // (We require at least 3 letters for dot/dash to avoid interfering with abbreviations like T.P. or hyphenated words)
  const dotDashRegex = /(?<!\p{L})(\p{L}(?:\s*[-.]\s*\p{L}){2,})(?!\p{L})/gu;
  result = result.replace(dotDashRegex, (match, wordGroup) => {
    const letters = wordGroup.split(/\s*[-.]\s*/);
    if (letters.some((l: string) => l.length !== 1)) {
      return match;
    }

    // Avoid uppercase abbreviation patterns like U.S.A or V.N
    if (letters.every((l: string) => l === l.toUpperCase() && l !== l.toLowerCase())) {
      if (match.includes('.')) {
        return match;
      }
    }

    return letters.join('');
  });

  return result;
}

/**
 * Applies custom find & replace list configured by the user.
 */
export function applyCustomReplacements(
  text: string,
  replacements?: Array<{ from: string; to: string }> | Record<string, any>
): string {
  if (!text || !replacements) return text;

  let list: Array<{ from: string; to: string }> = [];
  if (Array.isArray(replacements)) {
    list = replacements;
  } else if (typeof replacements === 'object') {
    const values = Object.values(replacements);
    if (values.length > 0 && values.every((v) => v && typeof v === 'object' && 'from' in v)) {
      list = values as Array<{ from: string; to: string }>;
    } else {
      list = Object.entries(replacements)
        .filter(([, to]) => typeof to === 'string' || typeof to === 'number')
        .map(([from, to]) => ({ from, to: String(to) }));
    }
  }

  let result = text;
  for (const item of list) {
    if (!item || typeof item.from !== 'string' || !item.from) continue;
    const escaped = item.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), item.to ?? '');
  }

  return result;
}

/**
 * Normalizes text to Unicode NFC and strips invisible zero-width chars.
 */
export function normalizeUnicodeAndCleanChars(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFC')
    .replace(INVISIBLE_CHARS_REGEX, '')
    .replace(/\u00A0/g, ' '); // Replace non-breaking space with standard space
}

/**
 * Filters out ad/watermark lines based on keywords.
 * Operates strictly on ad-like lines and avoids deleting legitimate narrative paragraphs
 * when generic words appear in dialogue or story prose.
 */
export function removeAdLines(text: string, adKeywords?: any): string {
  if (!text) return '';
  if (!adKeywords) return text;

  let rawList: string[] = [];
  if (Array.isArray(adKeywords)) {
    rawList = adKeywords;
  } else if (typeof adKeywords === 'string') {
    rawList = adKeywords.split(/[\r\n,]+/);
  } else if (typeof adKeywords === 'object') {
    rawList = Object.values(adKeywords);
  }

  const validKeywords = rawList
    .map((k) => (typeof k === 'string' ? k.toLowerCase().trim() : ''))
    .filter(Boolean);

  if (validKeywords.length === 0) return text;

  const lines = text.split('\n');

  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true; // keep blank lines to preserve paragraphs
    const lowerLine = trimmed.toLowerCase();

    // Check if any ad keyword is in this line
    const matchedKeyword = validKeywords.find((kw) => lowerLine.includes(kw));
    if (!matchedKeyword) return true; // No keyword matched

    // The line contains a keyword. Determine if this line is an actual ad line
    // or a legitimate narrative paragraph / dialogue.

    // 1. Dialogue detection:
    // Dialogue lines typically have quotation marks or start with dialogue dashes:
    // e.g. "...", “...”, '...', ‘...’, 「...」, or starting with - / — / –
    const isQuotedDialogue =
      /(?:^|[\s(])[“"「‘'][^”"」’']{2,}[”"」’']/.test(trimmed) ||
      /^[-—–]\s+\S+/.test(trimmed);

    // 2. Strong ad indicators that definitely mark a line as an ad regardless of quotes:
    // (e.g. contains URL/domains, platform indicators like facebook/zalo, explicit labels like "nguồn:", "dịch:", or ad call-to-actions)
    const hasStrongAdIndicator =
      /(?:https?:\/\/|www\.|\.(?:com|vn|net|info|org|xyz|top|cc|me)\b|(?:facebook|zalo)\b)/i.test(lowerLine) ||
      /(?:^|[\s(\[])(?:nguồn(?:\s+(?:gốc|cội))?|dịch|biên tập|tác giả|editor|credit|convert|liên kết|link|website)\s*[:：\-]/i.test(lowerLine) ||
      /(?:đọc truyện tại|ủng hộ dịch giả|theo dõi fanpage|chia sẻ truyện|chia sẻ lên|chia sẻ qua|like fanpage|truy cập website|truy cập web|quảng cáo banner|tải app|tải ứng dụng)/i.test(lowerLine);

    // If it is dialogue and doesn't have a strong ad indicator, preserve it
    if (isQuotedDialogue && !hasStrongAdIndicator) {
      return true;
    }

    // 3. Explicit compound noun protection for "nguồn":
    // Compound words like "nguồn gốc", "nguồn nước", "nguồn năng lượng", "nguồn cội", "nguồn sáng", etc.
    // must NOT be purged unless accompanied by an explicit ad separator or strong ad indicator.
    const isCompoundNoun =
      /(?:^|[\s(\[])nguồn\s+(?:gốc|nước|năng lượng|cội|sáng|lực|tài nguyên|sống|suối|sinh|cảm hứng)\b/i.test(lowerLine);
    const hasSeparatorAfterCompound =
      /(?:^|[\s(\[])(?:nguồn(?:\s+(?:gốc|nước|năng lượng|cội|sáng|lực|tài nguyên|sống|suối|sinh|cảm hứng))?)\s*[:：\-]/i.test(lowerLine);
    if (isCompoundNoun && !hasStrongAdIndicator && !hasSeparatorAfterCompound) {
      return true;
    }

    // 4. For non-dialogue lines:
    // If the matched keyword is a generic short word (e.g. "nguồn", "website", "truyện", "link", "web", "chia sẻ", "liên kết"),
    // but the line is a normal narrative sentence without any ad indicators:
    const isGenericKeyword =
      /^(?:nguồn|nguồn\s+gốc|nguồn\s+nước|truyện|web|website|link|tải|nhóm|app|chia sẻ|liên kết)$/i.test(matchedKeyword);
    if (isGenericKeyword && !hasStrongAdIndicator) {
      const escapedKeyword = matchedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const isStandaloneAdLine =
        lowerLine.length < 60 &&
        (new RegExp(`^${escapedKeyword}\\s*[-:：]`, 'i').test(lowerLine) ||
         /(?:^|[\s(\[])nguồn\s+(?:gốc|cội)\s*[-:：]/i.test(lowerLine) ||
         new RegExp(`^${escapedKeyword}\\s+(?:tại|online|chữ|full|hàng đầu|convert|dịch|edit|vip|web|website|link|app|ứng dụng|facebook|zalo|fanpage|group|bài viết|ủng hộ)\\b`, 'i').test(lowerLine) ||
         new RegExp(`^${escapedKeyword}\\s*$`, 'i').test(lowerLine));

      if (!isStandaloneAdLine) {
        return true; // Preserve legitimate narrative prose
      }
    }

    // Otherwise, it's an ad line - filter it out
    return false;
  });

  return filteredLines.join('\n');
}

/**
 * Removes anti-scraping divider bars, recurring novel title watermark lines,
 * and chapter title duplicates embedded between narrative paragraphs.
 */
export function removeWatermarksAndDividers(
  text: string,
  novelTitle?: string,
  chapterTitle?: string,
  options?: { omitChapterTitles?: boolean }
): string {
  if (!text) return '';

  const normNovel = novelTitle
    ? novelTitle.trim().toLowerCase().normalize('NFC').replace(/[\s\-_—–:：.,|/\\()[\]{}]+/g, ' ').trim()
    : '';
  const normChap = chapterTitle
    ? chapterTitle.trim().toLowerCase().normalize('NFC').replace(/[\s\-_—–:：.,|/\\()[\]{}]+/g, ' ').trim()
    : '';

  const lines = text.split(/\r?\n+/);

  // 1. First pass: count frequency of short lines to detect repeating watermark lines
  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // We only care about short lines (< 80 chars) that don't look like dialogue
    if (trimmed.length < 80 && !/(?:^|[\s(])[“"「‘'][^”"」’']{2,}[”"」’']/.test(trimmed) && !/^[-—–]\s+\S+/.test(trimmed)) {
      const norm = trimmed.toLowerCase().normalize('NFC').replace(/[\s\-_—–:：.,|/\\()[\]{}]+/g, ' ').trim();
      if (norm) {
        lineCounts.set(norm, (lineCounts.get(norm) || 0) + 1);
      }
    }
  }

  // 2. Filter lines
  const cleanLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check for divider bars (e.g. "-----------------", "================", "****************")
    if (/^[-—–=_*~.]{3,}\s*$/.test(trimmed)) {
      continue;
    }

    const normLine = trimmed.toLowerCase().normalize('NFC').replace(/[\s\-_—–:：.,|/\\()[\]{}]+/g, ' ').trim();

    // Check if line strictly matches novel title or chapter title
    if (normNovel && (normLine === normNovel || (normLine.length > 5 && normNovel.includes(normLine) && normLine.length >= normNovel.length * 0.85))) {
      continue;
    }

    if (options?.omitChapterTitles) {
      // If user chooses to omit chapter numbering lines:
      // Strip any line matching the chapter title, "Chương X", "Hồi X", "Tiết X", "Quyển X", "Chapter X", "Chap X",
      // or standalone chapter digits (e.g. "3", "03", "Chương 3", "Chương 3: Tiêu đề")
      if (
        (normChap && (normLine === normChap || normLine.startsWith(normChap))) ||
        /^(?:chương|hồi|tiết|quyển|tập|phần|chap|chapter|episode|ep)\s*(?:\d+|[ivxlcdm]+)(?:[\s:：\-—–.]+.*)?$/i.test(normLine) ||
        /^\d{1,4}$/.test(normLine)
      ) {
        continue;
      }
    } else {
      if (normChap && (normLine === normChap || /^chương\s*\d+$/i.test(normLine))) {
        if (normLine === normChap) {
          continue;
        }
      }
      // Check standalone 1-4 digit chapter number line (e.g. "02" in comong.info)
      if (/^\d{1,4}$/.test(normLine)) {
        continue;
      }
    }

    // Check if short line is repeated 3 or more times throughout the chapter (anti-scraping watermark)
    const count = lineCounts.get(normLine) || 0;
    if (count >= 3 && trimmed.length < 80 && !/(?:^|[\s(])[“"「‘'][^”"」’']{2,}[”"」’']/.test(trimmed) && !/^[-—–]\s+\S+/.test(trimmed)) {
      continue;
    }

    cleanLines.push(trimmed);
  }

  return cleanLines.join('\n\n');
}

/**
 * Standardizes paragraph breaks:
 * - Trims whitespace on each line.
 * - Filters out divider bars and repeating watermarks.
 * - Collapses consecutive empty lines into a clean double newline.
 */
export function formatParagraphs(
  text: string,
  novelTitle?: string,
  chapterTitle?: string,
  options?: { omitChapterTitles?: boolean }
): string {
  if (!text) return '';
  return removeWatermarksAndDividers(text, novelTitle, chapterTitle, options);
}

/**
 * Strips script tags, noscript tags, inline event handlers (onclick, onload, onerror, etc.),
 * and dangerous pseudo-protocols from raw HTML strings before parsing.
 * Inline event handlers are safely converted to data-on* attributes, which completely
 * prevents Chrome extension CSP violations ('script-src self') while preserving
 * attributes needed for pagination metadata (e.g. onclick="page(id, page)").
 */
export function sanitizeHtmlString(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // 1. Remove all <script>...</script> tags and contents
  let cleaned = html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '');

  // 2. Remove all <noscript>...</noscript> tags and contents
  cleaned = cleaned.replace(/<noscript\b[\s\S]*?<\/noscript\s*>/gi, '');

  // 3. Neutralize inline event handlers inside HTML tags by renaming them to data-on*
  cleaned = cleaned.replace(/<([a-zA-Z1-6][^>]*?)>/g, (_match: string, tagContent: string) => {
    const strippedTag = tagContent
      .replace(
        /\s+on([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
        (_m: string, eventName: string, v1?: string, v2?: string, v3?: string) => {
          const val = v1 !== undefined ? `"${v1}"` : v2 !== undefined ? `'${v2}'` : `"${v3}"`;
          return ` data-on${eventName}=${val}`;
        }
      )
      .replace(/\s+(?:href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '');
    return `<${strippedTag}>`;
  });

  return cleaned;
}

/**
 * Safely parses raw HTML into a DOM Document without executing scripts or triggering
 * Chrome Content Security Policy (CSP) inline event handler violations.
 */
export function parseSafeHtmlDocument(rawHtml: string): Document {
  const sanitized = sanitizeHtmlString(rawHtml);
  const parser = new DOMParser();
  return parser.parseFromString(sanitized, 'text/html');
}

/**
 * Extracts clean text from an HTML string or DOM Element.
 */
export function sanitizeHtmlContent(
  htmlOrElement: string | Element,
  adKeywords: any = [],
  options?: {
    deobfuscate?: boolean;
    replacements?: Array<{ from: string; to: string }>;
    novelTitle?: string;
    chapterTitle?: string;
  }
): string {
  let doc: Document;

  if (typeof htmlOrElement === 'string') {
    doc = parseSafeHtmlDocument(`<div>${htmlOrElement}</div>`);
  } else {
    // Clone node so we don't mutate original DOM
    const clone = htmlOrElement.cloneNode(true) as Element;
    // Strip all inline on* event handlers from element before processing to prevent CSP violations
    const all = [clone, ...Array.from(clone.querySelectorAll('*'))];
    for (const el of all) {
      for (const attr of el.getAttributeNames()) {
        if (attr.toLowerCase().startsWith('on')) {
          el.removeAttribute(attr);
        }
      }
    }
    const docImpl = document.implementation.createHTMLDocument('');
    const wrapper = docImpl.createElement('div');
    wrapper.appendChild(docImpl.importNode(clone, true));
    docImpl.body.appendChild(wrapper);
    doc = docImpl;
  }

  // Strip all inline event handlers from doc to prevent extension CSP warnings
  const allInDoc = Array.from(doc.querySelectorAll('*'));
  for (const el of allInDoc) {
    for (const attr of el.getAttributeNames()) {
      if (attr.toLowerCase().startsWith('on')) {
        el.removeAttribute(attr);
      }
    }
  }

  // Remove unwanted tags
  UNWANTED_TAGS.forEach((tag) => {
    const elements = doc.querySelectorAll(tag);
    elements.forEach((el) => el.remove());
  });

  // Remove hidden honeypot/anti-scraping trap elements
  // Includes display:none, visibility:hidden inline styles, [hidden], and [aria-hidden="true"]
  const allElements = Array.from(doc.querySelectorAll('*'));
  for (const el of allElements) {
    if (!el.parentNode) continue; // Already removed by ancestor
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') {
      el.remove();
      continue;
    }
    const styleAttr = el.getAttribute('style');
    if (styleAttr && (/display\s*:\s*none/i.test(styleAttr) || /visibility\s*:\s*hidden/i.test(styleAttr))) {
      el.remove();
    }
  }

  // Strip collapsible read-more buttons, UI widgets, and common ad classes
  const unwantedSelectors = [
    '.w2w_read_more',
    '.readmore_open_button',
    '.readmore_close_button',
    '.ads',
    '.adsbygoogle',
    '.advertisement',
    '.banner',
    '.fb-like',
    '.social-share',
    '.chapter-nav',
    '.nav-buttons'
  ];
  unwantedSelectors.forEach((sel) => {
    const elements = doc.querySelectorAll(sel);
    elements.forEach((el) => el.remove());
  });

  // Convert <br> and block elements to linebreaks
  const blockElements = doc.querySelectorAll('p, div, br, h1, h2, h3, h4, h5, h6, li');
  blockElements.forEach((el) => {
    if (el.tagName.toLowerCase() === 'br') {
      el.replaceWith(doc.createTextNode('\n'));
    } else {
      el.prepend(doc.createTextNode('\n'));
      el.append(doc.createTextNode('\n'));
    }
  });

  const rawText = doc.body?.textContent || '';
  const cleanedUnicode = normalizeUnicodeAndCleanChars(rawText);
  const withoutAds = removeAdLines(cleanedUnicode, adKeywords);
  const shouldDeobfuscate = options?.deobfuscate !== false;
  const deobfuscated = shouldDeobfuscate ? deobfuscateWordSlashes(withoutAds) : withoutAds;
  const replaced = options?.replacements ? applyCustomReplacements(deobfuscated, options.replacements) : deobfuscated;
  return formatParagraphs(replaced, options?.novelTitle, options?.chapterTitle);
}

/**
 * Counts words in a string accurately, taking into account Vietnamese and English words.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  const matches = text.trim().match(/[\p{L}\p{N}]+/gu);
  return matches ? matches.length : 0;
}
